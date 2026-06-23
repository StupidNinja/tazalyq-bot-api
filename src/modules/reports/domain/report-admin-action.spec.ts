import { ReportStatus } from './report-status';
import { isStaleAdminStatusAction } from './report-admin-action';

describe('isStaleAdminStatusAction', () => {
  it('allows taking a new report into work', () => {
    expect(
      isStaleAdminStatusAction(ReportStatus.New, ReportStatus.InProgress),
    ).toBe(false);
  });

  it('marks repeated actions as stale', () => {
    expect(
      isStaleAdminStatusAction(
        ReportStatus.InProgress,
        ReportStatus.InProgress,
      ),
    ).toBe(true);
  });

  it('marks resolved reports as stale for terminal actions', () => {
    expect(
      isStaleAdminStatusAction(ReportStatus.Resolved, ReportStatus.Rejected),
    ).toBe(true);
  });
});
