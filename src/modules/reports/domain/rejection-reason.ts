import { ReportStatus } from './report-status';

export type RejectionReasonCode =
  | 'info'
  | 'not_garbage'
  | 'bad_photo'
  | 'duplicate'
  | 'no_address';

type Language = 'ru' | 'kk';

const rejectionReasonLabels: Record<
  RejectionReasonCode,
  Record<Language, string>
> = {
  info: {
    ru: 'Недостаточно информации',
    kk: 'Ақпарат жеткіліксіз',
  },
  not_garbage: {
    ru: 'Не относится к мусору',
    kk: 'Қоқыс мәселесіне жатпайды',
  },
  bad_photo: {
    ru: 'Некорректное фото',
    kk: 'Фото жарамсыз',
  },
  duplicate: {
    ru: 'Дубликат обращения',
    kk: 'Қайталанған өтініш',
  },
  no_address: {
    ru: 'Адрес не найден',
    kk: 'Мекенжай табылмады',
  },
};

export const isRejectionReasonCode = (
  reason: string | null | undefined,
): reason is RejectionReasonCode =>
  Boolean(reason && reason in rejectionReasonLabels);

export const getRejectionReasonLabel = (
  reason: string | null | undefined,
  language: Language,
) => {
  if (!reason) {
    return null;
  }

  if (isRejectionReasonCode(reason)) {
    return rejectionReasonLabels[reason][language];
  }

  return reason;
};

export const formatAdminCommentPrompt = (
  status: ReportStatus,
  language: Language,
  rejectionReason?: string | null,
) => {
  if (status === ReportStatus.Resolved) {
    return language === 'kk'
      ? 'Админ әрекеті: өтінішті жабу.\n\nПайдаланушыға жіберілетін түсініктемені енгізіңіз.'
      : 'Админ-действие: закрытие обращения.\n\nВведите комментарий, который будет отправлен пользователю.';
  }

  const reason = getRejectionReasonLabel(rejectionReason, language) || '-';

  return language === 'kk'
    ? `Админ әрекеті: өтінішті қабылдамау.\nСебебі: ${reason}\n\nПайдаланушыға жіберілетін түсініктемені енгізіңіз.`
    : `Админ-действие: отклонение обращения.\nПричина: ${reason}\n\nВведите комментарий, который будет отправлен пользователю.`;
};
