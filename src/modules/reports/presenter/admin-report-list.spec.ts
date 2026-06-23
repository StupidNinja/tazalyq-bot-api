import { ReportStatus } from '../domain/report-status';
import { formatAdminReportList } from './admin-report-list';

describe('formatAdminReportList', () => {
  it('formats compact admin queue rows with short report numbers', () => {
    expect(
      formatAdminReportList('Новые обращения', [
        {
          id: 'uuid-1',
          reportNumber: 124,
          status: ReportStatus.New,
          createdAt: new Date('2026-06-23T06:40:00.000Z'),
          addressText: 'ул. Абая, 15',
          author: { fullName: 'Иванов Иван' },
        },
      ]),
    ).toContain('#124 — Новое — ул. Абая, 15 — Иванов Иван');
  });

  it('returns an empty queue message', () => {
    expect(formatAdminReportList('Новые обращения', [])).toBe(
      'Новые обращения\n\nОчередь пуста.',
    );
  });
});
