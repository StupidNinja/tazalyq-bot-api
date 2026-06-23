import { ReportPhotoDao } from './report-photo.dao';
import { ReportStatusHistoryDao } from './report-status-history.dao';
import { ReportDao } from './report.dao';
import { UserDao } from './user.dao';
import { UserSessionDao } from './user-session.dao';

export * from './report-photo.dao';
export * from './report-status-history.dao';
export * from './report.dao';
export * from './user.dao';
export * from './user-session.dao';

export const daos = [
  UserDao,
  UserSessionDao,
  ReportDao,
  ReportPhotoDao,
  ReportStatusHistoryDao,
];
