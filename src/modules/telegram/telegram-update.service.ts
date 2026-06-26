import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Bot, Context } from 'grammy';
import { Repository } from 'typeorm';

import {
  UserDao,
  UserLanguage,
  UserRole,
  UserSessionDao,
  UserSessionState,
  ReportPhotoType,
} from '../../common/dao';
import { getBotConfig } from '../../config/bot.config';
import { AdminService } from '../admin/admin.service';
import { ReportsService } from '../reports/reports.service';
import {
  ReportStatus,
  getReportStatusLabel,
} from '../reports/domain/report-status';
import {
  formatAdminCommentPrompt,
  isRejectionReasonCode,
} from '../reports/domain/rejection-reason';
import {
  formatAdminReportMessage,
  formatUserStatusMessage,
} from '../reports/presenter/admin-report-message';
import { formatAdminReportList } from '../reports/presenter/admin-report-list';
import { formatReportStatsMessage } from '../reports/presenter/report-stats-message';
import { R2StorageService } from '../storage/storage.service';
import { formatAdminChatList } from './domain/admin-chat-list';
import { t } from './domain/bot-text';
import {
  shouldIgnoreNonPrivateMessage,
  shouldShowPrivateChatPrompt,
} from './domain/chat-routing';
import { normalizePhoneNumber } from './domain/phone-normalizer';
import { getBotCommandsForRole } from './domain/telegram-commands';
import {
  isSameTelegramMessage,
  isTelegramMessageNotModifiedError,
} from './domain/telegram-message';
import {
  adminStatusKeyboard,
  adminMenuKeyboard,
  adminReportListKeyboard,
  confirmationKeyboard,
  descriptionKeyboard,
  languageKeyboard,
  locationKeyboard,
  mainMenuKeyboard,
  phoneKeyboard,
  photosKeyboard,
  rejectionReasonKeyboard,
} from './telegram-keyboards';
import { sendReportPhotoWithFallback } from './telegram-photo-sender';

@Injectable()
export class TelegramUpdateService {
  private readonly logger = new Logger(TelegramUpdateService.name);
  private readonly config = getBotConfig();
  private readonly syncedCommandScopes = new Set<string>();

  constructor(
    @InjectRepository(UserDao)
    private readonly usersRepository: Repository<UserDao>,
    @InjectRepository(UserSessionDao)
    private readonly sessionsRepository: Repository<UserSessionDao>,
    private readonly adminService: AdminService,
    private readonly reportsService: ReportsService,
    private readonly storageService: R2StorageService,
  ) {}

  register(bot: Bot) {
    bot.command('start', (ctx) => this.handleStart(ctx));
    bot.command('language', (ctx) => this.showLanguage(ctx));
    bot.command('new_report', (ctx) => this.startReport(ctx));
    bot.command('my_reports', (ctx) => this.showMyReports(ctx));
    bot.command('help', (ctx) => this.showHelp(ctx));
    bot.command('cancel', (ctx) => this.cancel(ctx));
    bot.command('admin', (ctx) => this.showAdminMenu(ctx));
    bot.command('admin_add', (ctx) => this.handleAdminAdd(ctx));
    bot.command('admin_remove', (ctx) => this.handleAdminRemove(ctx));
    bot.command('admins', (ctx) => this.handleAdmins(ctx));
    bot.command('admin_chat_add', (ctx) => this.handleAdminChatAdd(ctx));
    bot.command('admin_chat_remove', (ctx) => this.handleAdminChatRemove(ctx));
    bot.command('admin_chats', (ctx) => this.handleAdminChats(ctx));
    bot.command('stats', (ctx) => this.showStats(ctx));
    bot.callbackQuery(/^lang:(ru|kk)$/, (ctx) => this.handleLanguage(ctx));
    bot.callbackQuery(/^admin:/, (ctx) => this.handleAdminCallback(ctx));
    bot.on('message:photo', (ctx) => this.handlePhoto(ctx));
    bot.on('message:location', (ctx) => this.handleLocation(ctx));
    bot.on('message:contact', (ctx) => this.handleContact(ctx));
    bot.on('message:text', (ctx) => this.handleText(ctx));
    bot.catch((error) => {
      this.logger.error(error.message, error.stack);
    });
  }

  private async handleStart(ctx: Context) {
    if (await this.promptPrivateChatForUserCommand(ctx)) {
      return;
    }

    await this.ensureUser(ctx);
    await ctx.reply(t(null, 'chooseLanguage'), {
      reply_markup: languageKeyboard(),
    });
  }

  private async showLanguage(ctx: Context) {
    if (await this.promptPrivateChatForUserCommand(ctx)) {
      return;
    }

    await this.ensureUser(ctx);
    await ctx.reply(t(null, 'chooseLanguage'), {
      reply_markup: languageKeyboard(),
    });
  }

  private async handleLanguage(ctx: Context) {
    const user = await this.ensureUser(ctx);
    const language = ctx.callbackQuery?.data?.endsWith('kk')
      ? UserLanguage.Kk
      : UserLanguage.Ru;

    user.language = language;
    await this.usersRepository.save(user);
    await this.syncPrivateChatCommands(ctx, user);

    if (!user.fullName) {
      await this.setSession(user.id, UserSessionState.WaitingFullName);
      await ctx.reply(t(language, 'fullNamePrompt'));
    } else if (!user.phone) {
      await this.setSession(user.id, UserSessionState.WaitingPhone);
      await ctx.reply(t(language, 'phonePrompt'), {
        reply_markup: phoneKeyboard(language),
      });
    } else {
      await this.setSession(user.id, UserSessionState.Idle);
      await this.showMainMenu(ctx, user);
    }

    await ctx.answerCallbackQuery();
  }

  private async handleText(ctx: Context) {
    if (this.shouldIgnoreNonPrivateUserMessage(ctx)) {
      return;
    }

    const user = await this.ensureUser(ctx);
    const text = ctx.message?.text?.trim() || '';
    const session = await this.getSession(user.id);

    if (text === t(user.language, 'newReport')) {
      await this.startReport(ctx);
      return;
    }

    if (text === t(user.language, 'myReports')) {
      await this.showMyReports(ctx);
      return;
    }

    if (text === t(user.language, 'changeLanguage')) {
      await this.showLanguage(ctx);
      return;
    }

    if (text === t(user.language, 'helpButton')) {
      await this.showHelp(ctx);
      return;
    }

    if (text === t(user.language, 'cancel')) {
      await this.cancel(ctx);
      return;
    }

    if (session?.state === UserSessionState.WaitingFullName) {
      await this.saveFullName(ctx, user, text);
      return;
    }

    if (session?.state === UserSessionState.WaitingAdminComment) {
      await this.saveAdminComment(ctx, user, session, text);
      return;
    }

    if (session?.state === UserSessionState.WaitingPhone) {
      await this.savePhone(ctx, user, text);
      return;
    }

    if (session?.state === UserSessionState.WaitingPhotos) {
      if (text === t(user.language, 'next')) {
        await this.finishPhotos(ctx, user, session);
        return;
      }

      await ctx.reply(t(user.language, 'sendPhoto'), {
        reply_markup: photosKeyboard(user.language),
      });
      return;
    }

    if (session?.state === UserSessionState.WaitingCompletionPhotos) {
      if (text === t(user.language, 'next')) {
        await this.finishCompletionPhotos(ctx, user, session);
        return;
      }

      await ctx.reply(
        'Отправьте фото выполненной работы или нажмите "Далее".',
        {
          reply_markup: photosKeyboard(user.language),
        },
      );
      return;
    }

    if (session?.state === UserSessionState.WaitingLocation) {
      if (text === t(user.language, 'enterAddress')) {
        await this.setSession(
          user.id,
          UserSessionState.WaitingAddressText,
          session.currentReportId,
        );
        await ctx.reply(t(user.language, 'enterAddress'));
        return;
      }
    }

    if (session?.state === UserSessionState.WaitingAddressText) {
      await this.saveAddress(ctx, user, session, text);
      return;
    }

    if (session?.state === UserSessionState.WaitingDescription) {
      await this.saveDescription(
        ctx,
        user,
        session,
        text === t(user.language, 'skip') ? null : text,
      );
      return;
    }

    if (session?.state === UserSessionState.WaitingConfirmation) {
      if (text === t(user.language, 'submit')) {
        await this.submitReport(ctx, user, session);
        return;
      }

      if (text === t(user.language, 'editLocation')) {
        await this.setSession(
          user.id,
          UserSessionState.WaitingLocation,
          session.currentReportId,
        );
        await ctx.reply(t(user.language, 'sendLocation'), {
          reply_markup: locationKeyboard(user.language),
        });
        return;
      }

      if (text === t(user.language, 'editDescription')) {
        await this.askDescription(ctx, user, session.currentReportId);
        return;
      }

      if (text === t(user.language, 'addPhoto')) {
        await this.setSession(
          user.id,
          UserSessionState.WaitingPhotos,
          session.currentReportId,
        );
        await ctx.reply(t(user.language, 'sendPhoto'), {
          reply_markup: photosKeyboard(user.language),
        });
        return;
      }
    }

    await this.remindCurrentStep(ctx, user, session);
  }

  private async handleContact(ctx: Context) {
    if (this.shouldIgnoreNonPrivateUserMessage(ctx)) {
      return;
    }

    const user = await this.ensureUser(ctx);
    const phone = ctx.message?.contact?.phone_number;

    if (!phone) {
      return;
    }

    await this.savePhone(ctx, user, phone);
  }

  private async startReport(ctx: Context) {
    if (await this.promptPrivateChatForUserCommand(ctx)) {
      return;
    }

    const user = await this.ensureRegisteredUser(ctx);
    const report = await this.reportsService.createDraft(user);
    await this.setSession(user.id, UserSessionState.WaitingPhotos, report.id);
    await ctx.reply(t(user.language, 'sendPhoto'), {
      reply_markup: photosKeyboard(user.language),
    });
  }

  private async handlePhoto(ctx: Context) {
    if (this.shouldIgnoreNonPrivateUserMessage(ctx)) {
      return;
    }

    const user = await this.ensureUser(ctx);
    const session = await this.getSession(user.id);

    if (!session?.currentReportId) {
      return;
    }

    if (
      session.state !== UserSessionState.WaitingPhotos &&
      session.state !== UserSessionState.WaitingCompletionPhotos
    ) {
      return;
    }

    const photos = ctx.message?.photo || [];
    const photo = photos[photos.length - 1];

    if (!photo) {
      return;
    }

    try {
      const photoType =
        session.state === UserSessionState.WaitingCompletionPhotos
          ? ReportPhotoType.AdminCompletion
          : ReportPhotoType.UserReport;
      await this.saveTelegramPhoto({
        ctx,
        reportId: session.currentReportId,
        telegramFileId: photo.file_id,
        telegramFileUniqueId: photo.file_unique_id,
        fileSize: photo.file_size,
        photoType,
        uploadedByUserId: user.id,
      });

      await ctx.reply(
        photoType === ReportPhotoType.AdminCompletion
          ? 'Фото выполненной работы добавлено. Отправьте ещё фото или нажмите "Далее".'
          : t(user.language, 'photoAdded'),
        {
          reply_markup: photosKeyboard(user.language),
        },
      );
    } catch (error) {
      if (error instanceof BadRequestException) {
        await ctx.reply(t(user.language, 'tooManyPhotos'));
        return;
      }

      this.logger.error(error);
      await ctx.reply(
        'Не удалось сохранить фото. Попробуйте отправить его ещё раз.',
      );
    }
  }

  private async finishPhotos(
    ctx: Context,
    user: UserDao,
    session: UserSessionDao,
  ) {
    if (!session.currentReportId) {
      return;
    }

    const report = await this.reportsService.findReportWithDetails(
      session.currentReportId,
    );

    if (!report?.photos?.length) {
      await ctx.reply(t(user.language, 'needPhoto'));
      return;
    }

    await this.setSession(
      user.id,
      UserSessionState.WaitingLocation,
      session.currentReportId,
    );
    await ctx.reply(t(user.language, 'sendLocation'), {
      reply_markup: locationKeyboard(user.language),
    });
  }

  private async finishCompletionPhotos(
    ctx: Context,
    user: UserDao,
    session: UserSessionDao,
  ) {
    if (!session.currentReportId) {
      return;
    }

    const photoCount = await this.reportsService.countCompletionPhotos(
      session.currentReportId,
    );

    if (photoCount < 1) {
      await ctx.reply(
        'Сначала отправьте хотя бы одно фото выполненной работы.',
      );
      return;
    }

    await this.askAdminComment(
      ctx,
      user,
      session.currentReportId,
      ReportStatus.Resolved,
    );
  }

  private async handleLocation(ctx: Context) {
    if (this.shouldIgnoreNonPrivateUserMessage(ctx)) {
      return;
    }

    const user = await this.ensureUser(ctx);
    const session = await this.getSession(user.id);
    const location = ctx.message?.location;

    if (
      session?.state !== UserSessionState.WaitingLocation ||
      !session.currentReportId ||
      !location
    ) {
      return;
    }

    await this.reportsService.setLocation(session.currentReportId, {
      latitude: location.latitude,
      longitude: location.longitude,
    });
    await this.askDescription(ctx, user, session.currentReportId);
  }

  private async saveAddress(
    ctx: Context,
    user: UserDao,
    session: UserSessionDao,
    addressText: string,
  ) {
    if (!session.currentReportId) {
      return;
    }

    await this.reportsService.setLocation(session.currentReportId, {
      addressText: addressText.slice(0, 1000),
    });
    await this.askDescription(ctx, user, session.currentReportId);
  }

  private async askDescription(ctx: Context, user: UserDao, reportId: string) {
    await this.setSession(
      user.id,
      UserSessionState.WaitingDescription,
      reportId,
    );
    await ctx.reply(t(user.language, 'descriptionPrompt'), {
      reply_markup: descriptionKeyboard(user.language),
    });
  }

  private async saveDescription(
    ctx: Context,
    user: UserDao,
    session: UserSessionDao,
    description: string | null,
  ) {
    if (!session.currentReportId) {
      return;
    }

    await this.reportsService.setDescription(
      session.currentReportId,
      description,
    );
    await this.showReportPreview(ctx, user, session.currentReportId);
  }

  private async showReportPreview(
    ctx: Context,
    user: UserDao,
    reportId: string,
  ) {
    const report = await this.reportsService.findReportWithDetails(reportId);

    if (!report) {
      return;
    }

    const location =
      report.addressText ||
      (report.latitude && report.longitude
        ? `${report.latitude}, ${report.longitude}`
        : '-');

    await this.setSession(
      user.id,
      UserSessionState.WaitingConfirmation,
      reportId,
    );
    await ctx.reply(
      [
        t(user.language, 'confirmReport'),
        '',
        `Фото: ${report.photos?.length || 0} шт.`,
        `Место: ${location}`,
        `Описание: ${report.description || '-'}`,
        '',
        'Отправить обращение?',
      ].join('\n'),
      {
        reply_markup: confirmationKeyboard(user.language),
      },
    );
  }

  private async submitReport(
    ctx: Context,
    user: UserDao,
    session: UserSessionDao,
  ) {
    if (!session.currentReportId) {
      return;
    }

    const report = await this.reportsService.submit(session.currentReportId);

    if (!report) {
      return;
    }

    await this.sendReportToAdmins(ctx, report);
    await this.setSession(user.id, UserSessionState.Idle, null);
    await ctx.reply(
      [
        `Обращение #${report.reportNumber} принято.`,
        '',
        `Статус: ${getReportStatusLabel(report.status, user.language)}`,
        '',
        'Спасибо! Ваше обращение передано ответственным лицам.',
      ].join('\n'),
      {
        reply_markup: mainMenuKeyboard(user.language),
      },
    );
  }

  private async sendReportToAdmins(
    ctx: Context,
    report: NonNullable<
      Awaited<ReturnType<ReportsService['findReportWithDetails']>>
    >,
  ) {
    const adminChatIds = await this.getAdminChatIds();

    if (!adminChatIds.length) {
      return;
    }

    for (const chatId of adminChatIds) {
      for (const photo of this.getUserReportPhotos(report)) {
        await sendReportPhotoWithFallback(
          ctx.api,
          chatId,
          photo,
          this.storageService,
        );
      }

      const message = await ctx.api.sendMessage(
        chatId,
        this.formatAdminMessage(report),
        {
          reply_markup: adminStatusKeyboard(report.id, report.status),
        },
      );

      if (chatId === adminChatIds[0]) {
        await this.reportsService.saveAdminMessageId(
          report.id,
          message.message_id,
        );
      }
    }
  }

  private async handleAdminCallback(ctx: Context) {
    const user = await this.ensureUser(ctx);

    if (!this.isAdmin(user)) {
      await ctx.answerCallbackQuery({ text: 'Недостаточно прав' });
      return;
    }

    const data = ctx.callbackQuery?.data || '';
    const [, action, third, fourth] = data.split(':');

    if (action === 'reject-menu') {
      await ctx.editMessageReplyMarkup({
        reply_markup: rejectionReasonKeyboard(third),
      });
      await ctx.answerCallbackQuery();
      return;
    }

    if (action === 'menu') {
      await this.showAdminMenu(ctx);
      await ctx.answerCallbackQuery();
      return;
    }

    if (action === 'list') {
      await this.showAdminReportList(ctx, third);
      await ctx.answerCallbackQuery();
      return;
    }

    if (action === 'stats') {
      await this.showStats(ctx);
      await ctx.answerCallbackQuery();
      return;
    }

    if (action === 'open') {
      await this.openAdminReport(ctx, third);
      await ctx.answerCallbackQuery({ text: 'Карточка открыта' });
      return;
    }

    const reportId = action === 'reject' ? fourth : third;
    const reasonCode = action === 'reject' ? third : undefined;

    if (action === 'resolve') {
      await this.askCompletionPhotos(ctx, user, reportId);
      await ctx.answerCallbackQuery({ text: 'Отправьте фото в личке' });
      return;
    }

    if (action === 'reject') {
      if (reasonCode && !isRejectionReasonCode(reasonCode)) {
        await ctx.answerCallbackQuery({ text: 'Причина не найдена' });
        return;
      }

      await this.askAdminComment(
        ctx,
        user,
        reportId,
        ReportStatus.Rejected,
        reasonCode,
      );
      await ctx.answerCallbackQuery({ text: 'Введите комментарий в личке' });
      return;
    }

    const status =
      action === 'work'
        ? ReportStatus.InProgress
        : action === 'resolve'
          ? ReportStatus.Resolved
          : ReportStatus.Rejected;
    const reason =
      reasonCode && isRejectionReasonCode(reasonCode) ? reasonCode : undefined;
    const report = await this.applyAdminStatusChange(ctx, {
      reportId,
      status,
      admin: user,
      rejectionReason: reason,
    });

    if (!report) {
      await ctx.answerCallbackQuery({ text: 'Статус уже изменён' });
      return;
    }

    await this.notifyReportAuthor(ctx, report, reason);
    await this.updateAdminGroupMessage(ctx, report);
    await this.editCurrentAdminMessage(ctx, report);
    await ctx.answerCallbackQuery({ text: 'Статус обновлён' });
  }

  private async showAdminMenu(ctx: Context) {
    const user = await this.ensureUser(ctx);

    if (!this.isAdmin(user)) {
      await ctx.reply('Недостаточно прав.');
      return;
    }

    if (ctx.chat?.type !== 'private') {
      await ctx.reply('Откройте бота в личке для очереди обращений.');
      return;
    }

    await ctx.reply('Админ меню', {
      reply_markup: adminMenuKeyboard(),
    });
  }

  private async showAdminReportList(ctx: Context, listType: string) {
    const user = await this.ensureUser(ctx);
    const input =
      listType === 'mine'
        ? { status: ReportStatus.InProgress, assignedAdminId: user.id }
        : listType === 'active'
          ? { statuses: [ReportStatus.New, ReportStatus.InProgress] }
          : listType === 'inactive'
            ? {
                statuses: [
                  ReportStatus.Resolved,
                  ReportStatus.Rejected,
                  ReportStatus.Cancelled,
                ],
              }
            : {
                status:
                  listType === 'in_progress'
                    ? ReportStatus.InProgress
                    : ReportStatus.New,
              };
    const reports = await this.reportsService.listAdminReports(input);
    const title =
      listType === 'mine'
        ? 'Мои обращения в работе'
        : listType === 'active'
          ? 'Активные обращения'
          : listType === 'inactive'
            ? 'Неактивные обращения'
            : listType === 'in_progress'
              ? 'Обращения в работе'
              : 'Новые обращения';

    await ctx.reply(formatAdminReportList(title, reports), {
      reply_markup: adminReportListKeyboard(reports),
    });
  }

  private async openAdminReport(ctx: Context, reportId: string) {
    const report = await this.reportsService.findReportWithDetails(reportId);

    if (!report) {
      await ctx.reply('Обращение не найдено.');
      return;
    }

    const targetChatId =
      ctx.chat?.type === 'private' ? ctx.chat.id : ctx.from?.id;

    if (!targetChatId) {
      return;
    }

    try {
      await this.sendAdminReportDetails(ctx, targetChatId, report);
    } catch (error) {
      this.logger.warn(error);
      await ctx.reply('Откройте бота в личке для просмотра деталей обращения.');
    }
  }

  private async sendAdminReportDetails(
    ctx: Context,
    chatId: number,
    report: NonNullable<
      Awaited<ReturnType<ReportsService['findReportWithDetails']>>
    >,
  ) {
    for (const photo of this.getUserReportPhotos(report)) {
      await sendReportPhotoWithFallback(
        ctx.api,
        chatId,
        photo,
        this.storageService,
      );
    }

    await ctx.api.sendMessage(chatId, this.formatAdminMessage(report), {
      reply_markup: adminStatusKeyboard(report.id, report.status),
    });
  }

  private async askAdminComment(
    ctx: Context,
    user: UserDao,
    reportId: string,
    status: ReportStatus,
    rejectionReason?: string,
  ) {
    await this.setSession(user.id, UserSessionState.WaitingAdminComment, null, {
      reportId,
      targetStatus: status,
      rejectionReason,
    });

    const prompt = formatAdminCommentPrompt(
      status,
      user.language,
      rejectionReason,
    );

    if (ctx.chat?.type === 'private') {
      await ctx.reply(prompt);
      return;
    }

    if (user.telegramId) {
      await ctx.api.sendMessage(user.telegramId, prompt);
    }
  }

  private async askCompletionPhotos(
    ctx: Context,
    user: UserDao,
    reportId: string,
  ) {
    await this.setSession(
      user.id,
      UserSessionState.WaitingCompletionPhotos,
      reportId,
      {
        reportId,
        targetStatus: ReportStatus.Resolved,
      },
    );

    const prompt =
      'Отправьте 1-5 фото выполненной работы. После фото нажмите "Далее".';

    if (ctx.chat?.type === 'private') {
      await ctx.reply(prompt, {
        reply_markup: photosKeyboard(user.language),
      });
      return;
    }

    if (user.telegramId) {
      await ctx.api.sendMessage(user.telegramId, prompt, {
        reply_markup: photosKeyboard(user.language),
      });
    }
  }

  private async saveAdminComment(
    ctx: Context,
    user: UserDao,
    session: UserSessionDao,
    text: string,
  ) {
    if (!this.isAdmin(user)) {
      await ctx.reply('Недостаточно прав.');
      return;
    }

    const comment = text.trim();

    if (!comment) {
      await ctx.reply('Введите комментарий текстом.');
      return;
    }

    const metadata = session.metadata as {
      reportId?: string;
      targetStatus?: ReportStatus;
      rejectionReason?: string;
    };

    if (!metadata.reportId || !metadata.targetStatus) {
      await this.setSession(user.id, UserSessionState.Idle, null, {});
      await ctx.reply('Действие устарело. Откройте обращение заново.');
      return;
    }

    const report = await this.applyAdminStatusChange(ctx, {
      reportId: metadata.reportId,
      status: metadata.targetStatus,
      admin: user,
      rejectionReason: metadata.rejectionReason,
      adminComment: comment,
    });

    await this.setSession(user.id, UserSessionState.Idle, null, {});

    if (!report) {
      await ctx.reply('Статус уже изменён. Откройте актуальную карточку.');
      return;
    }

    await this.notifyReportAuthor(ctx, report, metadata.rejectionReason);
    await this.updateAdminGroupMessage(ctx, report);
    await ctx.reply(`Статус обращения #${report.reportNumber} обновлён.`, {
      reply_markup: adminMenuKeyboard(),
    });
  }

  private async applyAdminStatusChange(
    ctx: Context,
    input: Parameters<ReportsService['changeStatus']>[0],
  ) {
    try {
      return await this.reportsService.changeStatus(input);
    } catch (error) {
      if (error instanceof BadRequestException) {
        return null;
      }

      throw error;
    }
  }

  private async updateAdminGroupMessage(
    ctx: Context,
    report: NonNullable<
      Awaited<ReturnType<ReportsService['findReportWithDetails']>>
    >,
  ) {
    if (!this.config.adminChatId || !report.adminMessageId) {
      return;
    }

    try {
      await ctx.api.editMessageText(
        this.config.adminChatId,
        report.adminMessageId,
        this.formatAdminMessage(report),
        {
          reply_markup: adminStatusKeyboard(report.id, report.status),
        },
      );
    } catch (error) {
      if (isTelegramMessageNotModifiedError(error)) {
        return;
      }

      throw error;
    }
  }

  private async editCurrentAdminMessage(
    ctx: Context,
    report: NonNullable<
      Awaited<ReturnType<ReportsService['findReportWithDetails']>>
    >,
  ) {
    const callbackMessage = ctx.callbackQuery?.message;

    if (
      isSameTelegramMessage(
        callbackMessage?.chat.id,
        callbackMessage?.message_id,
        this.config.adminChatId,
        report.adminMessageId,
      )
    ) {
      return;
    }

    try {
      await ctx.editMessageText(this.formatAdminMessage(report), {
        reply_markup: adminStatusKeyboard(report.id, report.status),
      });
    } catch (error) {
      if (isTelegramMessageNotModifiedError(error)) {
        return;
      }

      this.logger.warn(error);
    }
  }

  private formatAdminMessage(
    report: NonNullable<
      Awaited<ReturnType<ReportsService['findReportWithDetails']>>
    >,
  ) {
    return formatAdminReportMessage({
      id: report.id,
      reportNumber: report.reportNumber,
      createdAt: report.createdAt,
      status: report.status,
      photoCount: this.getUserReportPhotos(report).length,
      completionPhotoCount: this.getCompletionPhotos(report).length,
      author: {
        fullName: report.author.fullName || '-',
        phone: report.author.phone || '-',
        telegramId: report.author.telegramId || '-',
        username: report.author.username,
      },
      addressText: report.addressText,
      latitude: report.latitude,
      longitude: report.longitude,
      description: report.description,
      assignedAdmin: report.assignedAdmin,
    });
  }

  private async notifyReportAuthor(
    ctx: Context,
    report: NonNullable<
      Awaited<ReturnType<ReportsService['findReportWithDetails']>>
    >,
    reason?: string,
  ) {
    if (!report.author.telegramId) {
      return;
    }

    await ctx.api.sendMessage(
      report.author.telegramId,
      formatUserStatusMessage(
        report.reportNumber,
        report.status,
        report.author.language,
        reason,
        report.adminComment,
      ),
    );

    if (report.status === ReportStatus.Resolved) {
      for (const photo of this.getCompletionPhotos(report)) {
        await sendReportPhotoWithFallback(
          ctx.api,
          report.author.telegramId,
          photo,
          this.storageService,
        );
      }
    }
  }

  private async showMyReports(ctx: Context) {
    if (await this.promptPrivateChatForUserCommand(ctx)) {
      return;
    }

    const user = await this.ensureRegisteredUser(ctx);
    const reports = await this.reportsService.listUserReports(user.id);

    if (!reports.length) {
      await ctx.reply('У вас пока нет обращений.', {
        reply_markup: mainMenuKeyboard(user.language),
      });
      return;
    }

    await ctx.reply(
      [
        'Ваши обращения:',
        '',
        ...reports.map(
          (report) =>
            `#${report.reportNumber} — ${getReportStatusLabel(report.status, user.language)} — ${report.createdAt.toLocaleDateString('ru-KZ')}`,
        ),
      ].join('\n'),
      {
        reply_markup: mainMenuKeyboard(user.language),
      },
    );
  }

  private async showHelp(ctx: Context) {
    if (await this.promptPrivateChatForUserCommand(ctx)) {
      return;
    }

    const user = await this.ensureUser(ctx);
    await ctx.reply(t(user.language, 'help'), {
      reply_markup: mainMenuKeyboard(user.language),
    });
  }

  private async showStats(ctx: Context) {
    const user = await this.ensureUser(ctx);

    if (!this.isAdmin(user)) {
      await ctx.reply('Недостаточно прав.');
      return;
    }

    const stats = await this.reportsService.getOperationalStats();

    await ctx.reply(formatReportStatsMessage(stats));
  }

  private async handleAdminAdd(ctx: Context) {
    const user = await this.ensureUser(ctx);

    if (!(await this.ensureSuperAdmin(ctx, user))) {
      return;
    }

    const identifier = this.getCommandArgument(ctx);

    if (!identifier) {
      await ctx.reply('Использование: /admin_add @username');
      return;
    }

    const result = await this.adminService.addAdmin(user, identifier);

    if (result.status === 'pending') {
      await ctx.reply(
        `Приглашение для @${result.username} создано.\nПопросите пользователя открыть бота и нажать /start.`,
      );
      return;
    }

    await ctx.reply(
      `Админ ${result.user.username ? `@${result.user.username}` : result.user.telegramId} добавлен.`,
    );
  }

  private async handleAdminRemove(ctx: Context) {
    const user = await this.ensureUser(ctx);

    if (!(await this.ensureSuperAdmin(ctx, user))) {
      return;
    }

    const identifier = this.getCommandArgument(ctx);

    if (!identifier) {
      await ctx.reply('Использование: /admin_remove @username');
      return;
    }

    const result = await this.adminService.removeAdmin(user, identifier);

    if (result.status === 'removed') {
      await ctx.reply(
        `Админ ${result.user.username ? `@${result.user.username}` : result.user.telegramId} удалён.`,
      );
      return;
    }

    if (result.status === 'pending_removed') {
      await ctx.reply(`Pending-приглашение для @${result.username} удалено.`);
      return;
    }

    await ctx.reply('Админ или pending-приглашение не найдены.');
  }

  private async handleAdmins(ctx: Context) {
    const user = await this.ensureUser(ctx);

    if (!(await this.ensureSuperAdmin(ctx, user))) {
      return;
    }

    const admins = await this.adminService.listAdmins();
    const pendingInvites = await this.adminService.listPendingAdminInvites();

    await ctx.reply(
      [
        'Админы:',
        '',
        ...(admins.length
          ? admins.map(
              (admin) =>
                `${admin.role}: ${admin.telegramId || '-'} ${admin.fullName || (admin.username ? `@${admin.username}` : '')}`,
            )
          : ['Активных админов нет.']),
        '',
        'Ожидают входа:',
        ...(pendingInvites.length
          ? pendingInvites.map((invite) => `@${invite.username}`)
          : ['Нет pending-приглашений.']),
      ].join('\n'),
    );
  }

  private async handleAdminChatAdd(ctx: Context) {
    const user = await this.ensureUser(ctx);

    if (!(await this.ensureSuperAdmin(ctx, user))) {
      return;
    }

    const chat = ctx.chat;

    if (!chat || chat.type === 'private') {
      await ctx.reply(
        'Добавьте бота в нужную группу и отправьте /admin_chat_add прямо в этой группе. Так бот сам определит chat_id.',
      );
      return;
    }

    await this.adminService.addAdminChat(user, {
      telegramChatId: String(chat.id),
      title: 'title' in chat ? chat.title : null,
      type: chat.type,
    });
    await ctx.reply('Этот чат добавлен как админский.');
  }

  private async handleAdminChatRemove(ctx: Context) {
    const user = await this.ensureUser(ctx);

    if (!(await this.ensureSuperAdmin(ctx, user))) {
      return;
    }

    const commandArgument = this.getCommandArgument(ctx);
    const telegramChatId =
      commandArgument ||
      (ctx.chat && ctx.chat.type !== 'private' ? String(ctx.chat.id) : null);

    if (!telegramChatId) {
      await ctx.reply(
        'Использование: /admin_chat_remove <chat_id>\nИли отправьте команду в админском групповом чате.',
      );
      return;
    }

    await this.adminService.disableAdminChat(user, telegramChatId);
    await ctx.reply(`Админский чат ${telegramChatId} отключён.`);
  }

  private async handleAdminChats(ctx: Context) {
    const user = await this.ensureUser(ctx);

    if (!(await this.ensureSuperAdmin(ctx, user))) {
      return;
    }

    const chats = await this.adminService.listActiveAdminChats();

    await ctx.reply(formatAdminChatList(chats, this.config.adminChatId));
  }

  private async cancel(ctx: Context) {
    if (await this.promptPrivateChatForUserCommand(ctx)) {
      return;
    }

    const user = await this.ensureUser(ctx);
    const session = await this.getSession(user.id);

    if (session?.currentReportId) {
      await this.reportsService.cancel(session.currentReportId, user.id);
    }

    await this.setSession(user.id, UserSessionState.Idle, null);
    await ctx.reply(t(user.language, 'reportCancelled'), {
      reply_markup: mainMenuKeyboard(user.language),
    });
  }

  private async saveFullName(ctx: Context, user: UserDao, fullName: string) {
    if (!fullName || fullName.length > 255) {
      await ctx.reply(t(user.language, 'fullNamePrompt'));
      return;
    }

    user.fullName = fullName;
    await this.usersRepository.save(user);
    await this.setSession(user.id, UserSessionState.WaitingPhone);
    await ctx.reply(t(user.language, 'phonePrompt'), {
      reply_markup: phoneKeyboard(user.language),
    });
  }

  private async savePhone(ctx: Context, user: UserDao, phone: string) {
    user.phone = normalizePhoneNumber(phone);
    await this.usersRepository.save(user);
    await this.setSession(user.id, UserSessionState.Idle);
    await ctx.reply(t(user.language, 'savedProfile'), {
      reply_markup: mainMenuKeyboard(user.language),
    });
  }

  private async ensureRegisteredUser(ctx: Context) {
    const user = await this.ensureUser(ctx);

    if (!user.language) {
      await this.showLanguage(ctx);
      throw new Error('User language is required');
    }

    if (!user.fullName) {
      await this.setSession(user.id, UserSessionState.WaitingFullName);
      await ctx.reply(t(user.language, 'fullNamePrompt'));
      throw new Error('User full name is required');
    }

    if (!user.phone) {
      await this.setSession(user.id, UserSessionState.WaitingPhone);
      await ctx.reply(t(user.language, 'phonePrompt'), {
        reply_markup: phoneKeyboard(user.language),
      });
      throw new Error('User phone is required');
    }

    return user;
  }

  private async showMainMenu(ctx: Context, user: UserDao) {
    await ctx.reply(t(user.language, 'mainMenuTitle'), {
      reply_markup: mainMenuKeyboard(user.language),
    });
  }

  private async remindCurrentStep(
    ctx: Context,
    user: UserDao,
    session: UserSessionDao | null,
  ) {
    if (!session || session.state === UserSessionState.Idle) {
      await this.showMainMenu(ctx, user);
      return;
    }

    const messages: Partial<Record<UserSessionState, string>> = {
      [UserSessionState.WaitingFullName]: t(user.language, 'fullNamePrompt'),
      [UserSessionState.WaitingPhone]: t(user.language, 'phonePrompt'),
      [UserSessionState.WaitingPhotos]: t(user.language, 'sendPhoto'),
      [UserSessionState.WaitingLocation]: t(user.language, 'sendLocation'),
      [UserSessionState.WaitingAddressText]: t(user.language, 'enterAddress'),
      [UserSessionState.WaitingDescription]: t(
        user.language,
        'descriptionPrompt',
      ),
      [UserSessionState.WaitingConfirmation]:
        'Выберите действие на клавиатуре.',
      [UserSessionState.WaitingAdminComment]:
        'Введите комментарий администратора текстом.',
      [UserSessionState.WaitingCompletionPhotos]:
        'Отправьте фото выполненной работы или нажмите "Далее".',
    };

    await ctx.reply(
      messages[session.state] || t(user.language, 'mainMenuTitle'),
    );
  }

  private async ensureUser(ctx: Context) {
    const from = ctx.from;

    if (!from) {
      throw new Error('Telegram user is missing');
    }

    const telegramId = String(from.id);
    let user = await this.usersRepository.findOneBy({ telegramId });

    if (!user) {
      user = this.usersRepository.create({
        telegramId,
        username: from.username || null,
        firstName: from.first_name || null,
        lastName: from.last_name || null,
        language: UserLanguage.Ru,
        role: this.getBootstrapRole(telegramId),
      });
    } else {
      user.username = from.username || user.username;
      user.firstName = from.first_name || user.firstName;
      user.lastName = from.last_name || user.lastName;
      user.role =
        this.getBootstrapRole(telegramId) === UserRole.SuperAdmin
          ? UserRole.SuperAdmin
          : this.config.adminIds.includes(telegramId)
            ? UserRole.Admin
            : user.role;
    }

    const savedUser = await this.usersRepository.save(user);
    const adminInviteActivated =
      await this.adminService.activatePendingAdminInvite(savedUser);

    if (adminInviteActivated && ctx.chat?.type === 'private') {
      await ctx.reply('Вам выдан доступ админа.');
    }

    await this.syncPrivateChatCommands(ctx, savedUser);

    return savedUser;
  }

  private async getSession(userId: string) {
    return this.sessionsRepository.findOneBy({ userId });
  }

  private async setSession(
    userId: string,
    state: UserSessionState,
    currentReportId?: string | null,
    metadata?: Record<string, unknown>,
  ) {
    const session =
      (await this.sessionsRepository.findOneBy({ userId })) ||
      this.sessionsRepository.create({ userId });

    session.state = state;

    if (currentReportId !== undefined) {
      session.currentReportId = currentReportId;
    }

    if (metadata !== undefined) {
      session.metadata = metadata;
    }

    return this.sessionsRepository.save(session);
  }

  private isAdmin(user: UserDao) {
    return [UserRole.Admin, UserRole.SuperAdmin].includes(user.role);
  }

  private shouldIgnoreNonPrivateUserMessage(ctx: Context) {
    return shouldIgnoreNonPrivateMessage(ctx.chat?.type);
  }

  private async promptPrivateChatForUserCommand(ctx: Context) {
    if (!shouldShowPrivateChatPrompt(ctx.chat?.type)) {
      return false;
    }

    await ctx.reply('Для создания обращений откройте бота в личке.');
    return true;
  }

  private async ensureSuperAdmin(ctx: Context, user: UserDao) {
    if (user.role === UserRole.SuperAdmin) {
      return true;
    }

    await ctx.reply('Эта команда доступна только SUPER_ADMIN.');
    return false;
  }

  private async syncPrivateChatCommands(ctx: Context, user: UserDao) {
    if (ctx.chat?.type !== 'private') {
      return;
    }

    const scopeKey = `${ctx.chat.id}:${user.role}:${user.language}`;

    if (this.syncedCommandScopes.has(scopeKey)) {
      return;
    }

    try {
      await ctx.api.setMyCommands(
        getBotCommandsForRole(user.role, user.language),
        {
          scope: {
            type: 'chat',
            chat_id: ctx.chat.id,
          },
        },
      );
      this.syncedCommandScopes.add(scopeKey);
    } catch (error) {
      this.logger.warn(error);
    }
  }

  private getBootstrapRole(telegramId: string) {
    if (this.config.superAdminIds.includes(telegramId)) {
      return UserRole.SuperAdmin;
    }

    if (this.config.adminIds.includes(telegramId)) {
      return UserRole.Admin;
    }

    return UserRole.User;
  }

  private async getAdminChatIds() {
    const chats = await this.adminService.listActiveAdminChats();
    const chatIds = chats.map((chat) => chat.telegramChatId);

    if (!chatIds.length && this.config.adminChatId) {
      return [this.config.adminChatId];
    }

    return chatIds;
  }

  private getCommandArgument(ctx: Context) {
    const text = ctx.message && 'text' in ctx.message ? ctx.message.text : '';

    return text.split(/\s+/).slice(1).join(' ').trim();
  }

  private buildR2Key(reportId: string, photoId: string) {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');

    return `reports/${year}/${month}/${day}/report-${reportId}/${photoId}.jpg`;
  }

  private async saveTelegramPhoto(input: {
    ctx: Context;
    reportId: string;
    telegramFileId: string;
    telegramFileUniqueId?: string | null;
    fileSize?: number;
    photoType: ReportPhotoType;
    uploadedByUserId: string;
  }) {
    const file = await input.ctx.api.getFile(input.telegramFileId);
    const body = await this.downloadTelegramFile(file.file_path);
    const key = this.buildR2Key(
      input.reportId,
      `${input.photoType.toLowerCase()}-${input.telegramFileUniqueId || input.telegramFileId}`,
    );
    const uploaded = await this.storageService.upload({
      key,
      body,
      contentType: 'image/jpeg',
    });

    return this.reportsService.addPhoto({
      reportId: input.reportId,
      telegramFileId: input.telegramFileId,
      telegramFileUniqueId: input.telegramFileUniqueId,
      r2Bucket: uploaded.bucket,
      r2Key: uploaded.key,
      r2Url: uploaded.url,
      mimeType: 'image/jpeg',
      sizeBytes: input.fileSize || body.length,
      photoType: input.photoType,
      uploadedByUserId: input.uploadedByUserId,
    });
  }

  private getUserReportPhotos(
    report: NonNullable<
      Awaited<ReturnType<ReportsService['findReportWithDetails']>>
    >,
  ) {
    return (report.photos || []).filter(
      (photo) =>
        !photo.photoType || photo.photoType === ReportPhotoType.UserReport,
    );
  }

  private getCompletionPhotos(
    report: NonNullable<
      Awaited<ReturnType<ReportsService['findReportWithDetails']>>
    >,
  ) {
    return (report.photos || []).filter(
      (photo) => photo.photoType === ReportPhotoType.AdminCompletion,
    );
  }

  private async downloadTelegramFile(filePath?: string) {
    if (!filePath || !this.config.token) {
      throw new Error('Telegram file path is missing');
    }

    const response = await fetch(
      `https://api.telegram.org/file/bot${this.config.token}/${filePath}`,
    );

    if (!response.ok) {
      throw new Error(
        `Telegram file download failed with status ${response.status}`,
      );
    }

    return Buffer.from(await response.arrayBuffer());
  }
}
