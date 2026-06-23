import { ReportStatus, canTransitionReportStatus } from './report-status';

export const isStaleAdminStatusAction = (
  currentStatus: ReportStatus,
  requestedStatus: ReportStatus,
) => !canTransitionReportStatus(currentStatus, requestedStatus);
