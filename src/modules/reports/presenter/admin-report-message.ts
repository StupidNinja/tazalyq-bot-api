import { ReportStatus, getReportStatusLabel } from '../domain/report-status';

type AdminReportMessageInput = {
  id: string;
  reportNumber: number;
  createdAt: Date;
  status: ReportStatus;
  photoCount: number;
  author: {
    fullName: string;
    phone: string;
    telegramId: string;
    username?: string | null;
  };
  addressText?: string | null;
  latitude?: string | number | null;
  longitude?: string | number | null;
  description?: string | null;
  assignedAdmin?: {
    fullName?: string | null;
    username?: string | null;
    telegramId?: string | null;
  } | null;
};

const formatDate = (date: Date) =>
  new Intl.DateTimeFormat('ru-KZ', {
    dateStyle: 'short',
    timeStyle: 'short',
    timeZone: 'Asia/Almaty',
  }).format(date);

export const formatAdminReportMessage = (report: AdminReportMessageInput) => {
  const location =
    report.addressText ||
    (report.latitude && report.longitude
      ? `https://maps.google.com/?q=${report.latitude},${report.longitude}`
      : 'Не указано');
  const username = report.author.username ? `@${report.author.username}` : '-';

  return [
    `🗑 Новое обращение #${report.reportNumber}`,
    '',
    `Дата: ${formatDate(report.createdAt)}`,
    '',
    'Заявитель:',
    `ФИО: ${report.author.fullName}`,
    `Телефон: ${report.author.phone}`,
    `Telegram: ${username}`,
    `Telegram ID: ${report.author.telegramId}`,
    '',
    'Место:',
    location,
    '',
    'Описание:',
    report.description || '-',
    '',
    `Фото: ${report.photoCount} шт.`,
    '',
    `Статус: ${getReportStatusLabel(report.status, 'ru')}`,
    report.assignedAdmin
      ? `Ответственный: ${report.assignedAdmin.fullName || report.assignedAdmin.username || report.assignedAdmin.telegramId || '-'}`
      : null,
  ]
    .filter(Boolean)
    .join('\n');
};

export const getReportPublicId = (reportNumber: number | string) =>
  `#${reportNumber}`;

const formatCommentBlock = (language: 'ru' | 'kk', comment?: string | null) => {
  if (!comment) {
    return [];
  }

  return ['', language === 'kk' ? 'Пікір:' : 'Комментарий:', comment];
};

const formatReasonBlock = (language: 'ru' | 'kk', reason?: string | null) => {
  if (!reason) {
    return [];
  }

  return ['', language === 'kk' ? 'Себебі:' : 'Причина:', reason];
};

export const formatUserStatusMessage = (
  reportNumber: number,
  status: ReportStatus,
  language: 'ru' | 'kk',
  rejectionReason?: string | null,
  adminComment?: string | null,
) => {
  if (status === ReportStatus.Resolved) {
    const prefix =
      language === 'kk'
        ? `Өтініш #${reportNumber} жабылды.`
        : `Обращение #${reportNumber} закрыто.`;

    return [
      prefix,
      ...formatCommentBlock(language, adminComment),
      '',
      language === 'kk' ? 'Өтінішіңізге рақмет.' : 'Спасибо за обращение.',
    ].join('\n');
  }

  if (status === ReportStatus.Rejected) {
    const prefix =
      language === 'kk'
        ? `Өтініш #${reportNumber} қабылданбады.`
        : `Обращение #${reportNumber} отклонено.`;

    return [
      prefix,
      ...formatReasonBlock(language, rejectionReason),
      ...formatCommentBlock(language, adminComment),
    ].join('\n');
  }

  const statusLabel = getReportStatusLabel(status, language);

  return language === 'kk'
    ? `Өтініш #${reportNumber} мәртебесі өзгерді.\n\nЖаңа мәртебе: ${statusLabel}.`
    : `Статус обращения #${reportNumber} изменён.\n\nНовый статус: ${statusLabel}.`;
};
