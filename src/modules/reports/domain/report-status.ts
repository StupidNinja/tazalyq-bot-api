export enum ReportStatus {
  Draft = 'DRAFT',
  New = 'NEW',
  InProgress = 'IN_PROGRESS',
  Resolved = 'RESOLVED',
  Rejected = 'REJECTED',
  Cancelled = 'CANCELLED',
}

const allowedTransitions: Record<ReportStatus, ReportStatus[]> = {
  [ReportStatus.Draft]: [ReportStatus.New, ReportStatus.Cancelled],
  [ReportStatus.New]: [
    ReportStatus.InProgress,
    ReportStatus.Resolved,
    ReportStatus.Rejected,
  ],
  [ReportStatus.InProgress]: [ReportStatus.Resolved, ReportStatus.Rejected],
  [ReportStatus.Resolved]: [],
  [ReportStatus.Rejected]: [],
  [ReportStatus.Cancelled]: [],
};

export const canTransitionReportStatus = (
  fromStatus: ReportStatus,
  toStatus: ReportStatus,
) => allowedTransitions[fromStatus].includes(toStatus);

export const getReportStatusLabel = (
  status: ReportStatus,
  language: 'ru' | 'kk' = 'ru',
) => {
  const labels: Record<'ru' | 'kk', Record<ReportStatus, string>> = {
    ru: {
      [ReportStatus.Draft]: 'Черновик',
      [ReportStatus.New]: 'Новое',
      [ReportStatus.InProgress]: 'В работе',
      [ReportStatus.Resolved]: 'Закрыто',
      [ReportStatus.Rejected]: 'Отклонено',
      [ReportStatus.Cancelled]: 'Отменено',
    },
    kk: {
      [ReportStatus.Draft]: 'Нобай',
      [ReportStatus.New]: 'Жаңа',
      [ReportStatus.InProgress]: 'Орындалуда',
      [ReportStatus.Resolved]: 'Жабылды',
      [ReportStatus.Rejected]: 'Қабылданбады',
      [ReportStatus.Cancelled]: 'Бас тартылды',
    },
  };

  return labels[language][status];
};
