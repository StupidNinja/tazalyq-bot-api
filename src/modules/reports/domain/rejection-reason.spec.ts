import { ReportStatus } from './report-status';
import {
  formatAdminCommentPrompt,
  getRejectionReasonLabel,
} from './rejection-reason';

describe('rejection reasons', () => {
  it('translates rejection reason codes for user notifications', () => {
    expect(getRejectionReasonLabel('no_address', 'kk')).toBe(
      'Мекенжай табылмады',
    );
  });

  it('keeps old free-text rejection reasons as a fallback', () => {
    expect(getRejectionReasonLabel('Адрес не найден', 'kk')).toBe(
      'Адрес не найден',
    );
  });

  it('formats rejection comment prompts as admin-only prompts', () => {
    expect(
      formatAdminCommentPrompt(ReportStatus.Rejected, 'ru', 'no_address'),
    ).toBe(
      'Админ-действие: отклонение обращения.\nПричина: Адрес не найден\n\nВведите комментарий, который будет отправлен пользователю.',
    );
  });

  it('uses admin wording in kazakh admin prompts too', () => {
    expect(
      formatAdminCommentPrompt(ReportStatus.Rejected, 'kk', 'no_address'),
    ).toContain('Админ әрекеті');
  });
});
