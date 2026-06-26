import { ReportStatus } from '../domain/report-status';
import {
  formatAdminReportMessage,
  formatUserStatusMessage,
} from './admin-report-message';

describe('admin report messages', () => {
  it('formats an admin report card with applicant and location data', () => {
    const message = formatAdminReportMessage({
      id: '124',
      reportNumber: 124,
      createdAt: new Date('2026-06-23T06:40:00.000Z'),
      status: ReportStatus.New,
      photoCount: 2,
      author: {
        fullName: 'Иванов Иван Иванович',
        phone: '+77001234567',
        telegramId: '123456789',
        username: 'ivan',
      },
      addressText: 'ул. Абая, возле дома 15',
      latitude: null,
      longitude: null,
      description: 'Незаконная свалка возле дороги.',
    });

    expect(message).toContain('Новое обращение #124');
    expect(message).toContain('ФИО: Иванов Иван Иванович');
    expect(message).toContain('Фото: 2 шт.');
    expect(message).toContain('Статус: Новое');
  });

  it('formats status notifications for users', () => {
    expect(formatUserStatusMessage(124, ReportStatus.InProgress, 'ru')).toBe(
      'Статус обращения #124 изменён.\n\nНовый статус: В работе.',
    );
  });

  it('includes rejection reason and admin comment in user notifications', () => {
    expect(
      formatUserStatusMessage(
        124,
        ReportStatus.Rejected,
        'ru',
        'Некорректное фото',
        'Фото не показывает место проблемы.',
      ),
    ).toBe(
      'Обращение #124 отклонено.\n\nПричина:\nНекорректное фото\n\nКомментарий:\nФото не показывает место проблемы.',
    );
  });

  it('translates rejection reason codes for user notifications', () => {
    expect(
      formatUserStatusMessage(
        124,
        ReportStatus.Rejected,
        'kk',
        'no_address',
        'Мекенжайды нақтылаңыз.',
      ),
    ).toBe(
      'Өтініш #124 қабылданбады.\n\nСебебі:\nМекенжай табылмады\n\nТүсініктеме:\nМекенжайды нақтылаңыз.',
    );
  });
});
