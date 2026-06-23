import { InlineKeyboard, Keyboard } from 'grammy';

import { ReportStatus } from '../reports/domain/report-status';
import { BotLanguage, t } from './domain/bot-text';

export const languageKeyboard = () =>
  new InlineKeyboard().text('Қазақша', 'lang:kk').text('Русский', 'lang:ru');

export const mainMenuKeyboard = (language: BotLanguage | string | null) =>
  new Keyboard()
    .text(t(language, 'newReport'))
    .row()
    .text(t(language, 'myReports'))
    .text(t(language, 'changeLanguage'))
    .row()
    .text(t(language, 'helpButton'))
    .resized();

export const phoneKeyboard = (language: BotLanguage | string | null) =>
  new Keyboard()
    .requestContact(t(language, 'sharePhone'))
    .row()
    .text(t(language, 'cancel'))
    .resized();

export const photosKeyboard = (language: BotLanguage | string | null) =>
  new Keyboard()
    .text(t(language, 'next'))
    .row()
    .text(t(language, 'cancel'))
    .resized();

export const locationKeyboard = (language: BotLanguage | string | null) =>
  new Keyboard()
    .requestLocation(t(language, 'shareLocation'))
    .row()
    .text(t(language, 'enterAddress'))
    .row()
    .text(t(language, 'cancel'))
    .resized();

export const descriptionKeyboard = (language: BotLanguage | string | null) =>
  new Keyboard()
    .text(t(language, 'skip'))
    .row()
    .text(t(language, 'cancel'))
    .resized();

export const confirmationKeyboard = (language: BotLanguage | string | null) =>
  new Keyboard()
    .text(t(language, 'submit'))
    .row()
    .text(t(language, 'editLocation'))
    .text(t(language, 'editDescription'))
    .row()
    .text(t(language, 'addPhoto'))
    .row()
    .text(t(language, 'cancel'))
    .resized();

export const adminMenuKeyboard = () =>
  new InlineKeyboard()
    .text('🆕 Новые', 'admin:list:new')
    .text('👀 В работе', 'admin:list:in_progress')
    .row()
    .text('🙋 Мои в работе', 'admin:list:mine')
    .text('📊 Статистика', 'admin:stats');

export const adminReportListKeyboard = (
  reports: { id: string; reportNumber: number }[],
) => {
  const keyboard = new InlineKeyboard();

  for (const report of reports) {
    keyboard
      .text(`Открыть #${report.reportNumber}`, `admin:open:${report.id}`)
      .row();
  }

  keyboard.text('⬅️ Админ меню', 'admin:menu');

  return keyboard;
};

export const adminStatusKeyboard = (reportId: string, status: ReportStatus) => {
  const keyboard = new InlineKeyboard();

  keyboard.text('🔎 Открыть', `admin:open:${reportId}`).row();

  if (status === ReportStatus.New) {
    keyboard.text('👀 В работу', `admin:work:${reportId}`).row();
  }

  if (status === ReportStatus.New || status === ReportStatus.InProgress) {
    keyboard
      .text('✅ Закрыть', `admin:resolve:${reportId}`)
      .text('❌ Отклонить', `admin:reject-menu:${reportId}`);
  }

  return keyboard;
};

export const rejectionReasonKeyboard = (reportId: string) =>
  new InlineKeyboard()
    .text('Недостаточно информации', `admin:reject:info:${reportId}`)
    .row()
    .text('Не относится к мусору', `admin:reject:not_garbage:${reportId}`)
    .row()
    .text('Некорректное фото', `admin:reject:bad_photo:${reportId}`)
    .row()
    .text('Дубликат обращения', `admin:reject:duplicate:${reportId}`)
    .row()
    .text('Адрес не найден', `admin:reject:no_address:${reportId}`);
