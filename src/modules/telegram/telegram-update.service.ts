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
} from '../../common/dao';
import { getBotConfig } from '../../config/bot.config';
import { ReportsService } from '../reports/reports.service';
import {
  ReportStatus,
  getReportStatusLabel,
} from '../reports/domain/report-status';
import {
  formatAdminReportMessage,
  formatUserStatusMessage,
} from '../reports/presenter/admin-report-message';
import { formatAdminReportList } from '../reports/presenter/admin-report-list';
import { R2StorageService } from '../storage/storage.service';
import { t } from './domain/bot-text';
import { normalizePhoneNumber } from './domain/phone-normalizer';
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

const rejectionReasons: Record<string, string> = {
  info: 'Недостаточно информации',
  not_garbage: 'Не относится к мусору',
  bad_photo: 'Некорректное фото',
  duplicate: 'Дубликат обращения',
  no_address: 'Адрес не найден',
};

@Injectable()
export class TelegramUpdateService {
  private readonly logger = new Logger(TelegramUpdateService.name);
  private readonly config = getBotConfig();

  constructor(
    @InjectRepository(UserDao)
    private readonly usersRepository: Repository<UserDao>,
    @InjectRepository(UserSessionDao)
    private readonly sessionsRepository: Repository<UserSessionDao>,
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
    await this.ensureUser(ctx);
    await ctx.reply(t(null, 'chooseLanguage'), {
      reply_markup: languageKeyboard(),
    });
  }

  private async showLanguage(ctx: Context) {
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
    const user = await this.ensureUser(ctx);
    const phone = ctx.message?.contact?.phone_number;

    if (!phone) {
      return;
    }

    await this.savePhone(ctx, user, phone);
  }

  private async startReport(ctx: Context) {
    const user = await this.ensureRegisteredUser(ctx);
    const report = await this.reportsService.createDraft(user);
    await this.setSession(user.id, UserSessionState.WaitingPhotos, report.id);
    await ctx.reply(t(user.language, 'sendPhoto'), {
      reply_markup: photosKeyboard(user.language),
    });
  }

  private async handlePhoto(ctx: Context) {
    const user = await this.ensureUser(ctx);
    const session = await this.getSession(user.id);

    if (
      session?.state !== UserSessionState.WaitingPhotos ||
      !session.currentReportId
    ) {
      return;
    }

    const photos = ctx.message?.photo || [];
    const photo = photos[photos.length - 1];

    if (!photo) {
      return;
    }

    try {
      const file = await ctx.api.getFile(photo.file_id);
      const body = await this.downloadTelegramFile(file.file_path);
      const key = this.buildR2Key(
        session.currentReportId,
        photo.file_unique_id,
      );
      const uploaded = await this.storageService.upload({
        key,
        body,
        contentType: 'image/jpeg',
      });

      await this.reportsService.addPhoto({
        reportId: session.currentReportId,
        telegramFileId: photo.file_id,
        telegramFileUniqueId: photo.file_unique_id,
        r2Bucket: uploaded.bucket,
        r2Key: uploaded.key,
        r2Url: uploaded.url,
        mimeType: 'image/jpeg',
        sizeBytes: photo.file_size || body.length,
      });

      await ctx.reply(t(user.language, 'photoAdded'), {
        reply_markup: photosKeyboard(user.language),
      });
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

  private async handleLocation(ctx: Context) {
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
    if (!this.config.adminChatId) {
      return;
    }

    for (const photo of report.photos || []) {
      await ctx.api.sendPhoto(this.config.adminChatId, photo.telegramFileId);
    }

    const message = await ctx.api.sendMessage(
      this.config.adminChatId,
      this.formatAdminMessage(report),
      {
        reply_markup: adminStatusKeyboard(report.id, report.status),
      },
    );

    await this.reportsService.saveAdminMessageId(report.id, message.message_id);
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
      await this.askAdminComment(ctx, user, reportId, ReportStatus.Resolved);
      await ctx.answerCallbackQuery({ text: 'Введите комментарий в личке' });
      return;
    }

    if (action === 'reject') {
      await this.askAdminComment(
        ctx,
        user,
        reportId,
        ReportStatus.Rejected,
        reasonCode ? rejectionReasons[reasonCode] : undefined,
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
    const reason = reasonCode ? rejectionReasons[reasonCode] : undefined;
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
    for (const photo of report.photos || []) {
      await ctx.api.sendPhoto(chatId, photo.telegramFileId);
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

    const prompt =
      status === ReportStatus.Resolved
        ? 'Введите комментарий для закрытия обращения. Он будет отправлен пользователю.'
        : `Введите комментарий для отклонения обращения.\nПричина: ${rejectionReason || '-'}`;

    if (ctx.chat?.type === 'private') {
      await ctx.reply(prompt);
      return;
    }

    if (user.telegramId) {
      await ctx.api.sendMessage(user.telegramId, prompt);
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

    await ctx.api.editMessageText(
      this.config.adminChatId,
      report.adminMessageId,
      this.formatAdminMessage(report),
      {
        reply_markup: adminStatusKeyboard(report.id, report.status),
      },
    );
  }

  private async editCurrentAdminMessage(
    ctx: Context,
    report: NonNullable<
      Awaited<ReturnType<ReportsService['findReportWithDetails']>>
    >,
  ) {
    try {
      await ctx.editMessageText(this.formatAdminMessage(report), {
        reply_markup: adminStatusKeyboard(report.id, report.status),
      });
    } catch (error) {
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
      photoCount: report.photos?.length || 0,
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
  }

  private async showMyReports(ctx: Context) {
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

    await ctx.reply('/stats будет расширен после базового MVP.');
  }

  private async cancel(ctx: Context) {
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
        role: this.config.adminIds.includes(telegramId)
          ? UserRole.Admin
          : UserRole.User,
      });
    } else {
      user.username = from.username || user.username;
      user.firstName = from.first_name || user.firstName;
      user.lastName = from.last_name || user.lastName;
      user.role = this.config.adminIds.includes(telegramId)
        ? UserRole.Admin
        : user.role;
    }

    return this.usersRepository.save(user);
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

  private buildR2Key(reportId: string, photoId: string) {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');

    return `reports/${year}/${month}/${day}/report-${reportId}/${photoId}.jpg`;
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
