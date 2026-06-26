import { ReportStatus } from '../domain/report-status';

export type ReportStatsPeriod = {
  total: number;
  byStatus: Partial<Record<ReportStatus, number>>;
};

export type OperationalReportStats = {
  today: ReportStatsPeriod;
  sevenDays: ReportStatsPeriod;
  allTime: ReportStatsPeriod;
};

const visibleStatuses = [
  ReportStatus.New,
  ReportStatus.InProgress,
  ReportStatus.Resolved,
  ReportStatus.Rejected,
  ReportStatus.Cancelled,
];

const statsStatusLabels: Record<ReportStatus, string> = {
  [ReportStatus.Draft]: 'Черновики',
  [ReportStatus.New]: 'Новые',
  [ReportStatus.InProgress]: 'В работе',
  [ReportStatus.Resolved]: 'Закрыто',
  [ReportStatus.Rejected]: 'Отклонено',
  [ReportStatus.Cancelled]: 'Отменено',
};

const formatPeriod = (title: string, period: ReportStatsPeriod) =>
  [
    `${title}:`,
    `Всего: ${period.total}`,
    ...visibleStatuses.map(
      (status) =>
        `${statsStatusLabels[status]}: ${period.byStatus[status] || 0}`,
    ),
  ].join('\n');

export const formatReportStatsMessage = (stats: OperationalReportStats) =>
  [
    '📊 Статистика обращений',
    '',
    formatPeriod('Сегодня', stats.today),
    '',
    formatPeriod('За 7 дней', stats.sevenDays),
    '',
    formatPeriod('За всё время', stats.allTime),
  ].join('\n');
