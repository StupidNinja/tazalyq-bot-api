import { ReportStatus } from '../domain/report-status';
import { formatReportStatsMessage } from './report-stats-message';

describe('formatReportStatsMessage', () => {
  it('formats operational stats in a stable status order', () => {
    expect(
      formatReportStatsMessage({
        today: {
          total: 4,
          byStatus: {
            [ReportStatus.New]: 1,
            [ReportStatus.InProgress]: 1,
            [ReportStatus.Resolved]: 2,
            [ReportStatus.Rejected]: 0,
            [ReportStatus.Cancelled]: 0,
          },
        },
        sevenDays: {
          total: 8,
          byStatus: {
            [ReportStatus.New]: 2,
            [ReportStatus.InProgress]: 2,
            [ReportStatus.Resolved]: 3,
            [ReportStatus.Rejected]: 1,
            [ReportStatus.Cancelled]: 0,
          },
        },
        allTime: {
          total: 10,
          byStatus: {
            [ReportStatus.New]: 2,
            [ReportStatus.InProgress]: 2,
            [ReportStatus.Resolved]: 4,
            [ReportStatus.Rejected]: 1,
            [ReportStatus.Cancelled]: 1,
          },
        },
      }),
    ).toBe(
      [
        '📊 Статистика обращений',
        '',
        'Сегодня:',
        'Всего: 4',
        'Новые: 1',
        'В работе: 1',
        'Закрыто: 2',
        'Отклонено: 0',
        'Отменено: 0',
        '',
        'За 7 дней:',
        'Всего: 8',
        'Новые: 2',
        'В работе: 2',
        'Закрыто: 3',
        'Отклонено: 1',
        'Отменено: 0',
        '',
        'За всё время:',
        'Всего: 10',
        'Новые: 2',
        'В работе: 2',
        'Закрыто: 4',
        'Отклонено: 1',
        'Отменено: 1',
      ].join('\n'),
    );
  });

  it('prints zeros for missing statuses', () => {
    expect(
      formatReportStatsMessage({
        today: { total: 0, byStatus: {} },
        sevenDays: { total: 0, byStatus: {} },
        allTime: { total: 0, byStatus: {} },
      }),
    ).toContain('Новые: 0\nВ работе: 0\nЗакрыто: 0');
  });
});
