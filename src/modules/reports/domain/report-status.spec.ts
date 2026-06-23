import { ReportStatus, canTransitionReportStatus } from './report-status';

describe('canTransitionReportStatus', () => {
  it('allows submitting a draft report', () => {
    expect(
      canTransitionReportStatus(ReportStatus.Draft, ReportStatus.New),
    ).toBe(true);
  });

  it('allows an admin to take a new report into work', () => {
    expect(
      canTransitionReportStatus(ReportStatus.New, ReportStatus.InProgress),
    ).toBe(true);
  });

  it('prevents reopening resolved reports in the MVP flow', () => {
    expect(
      canTransitionReportStatus(ReportStatus.Resolved, ReportStatus.New),
    ).toBe(false);
  });
});
