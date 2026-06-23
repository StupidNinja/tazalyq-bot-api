import { ReportStatus, getReportStatusLabel } from '../domain/report-status';

type AdminReportListItem = {
  id: string;
  reportNumber: number;
  status: ReportStatus;
  createdAt: Date;
  addressText?: string | null;
  latitude?: string | number | null;
  longitude?: string | number | null;
  author?: {
    fullName?: string | null;
  };
};

const getLocationLabel = (report: AdminReportListItem) => {
  if (report.addressText) {
    return report.addressText;
  }

  if (report.latitude && report.longitude) {
    return `${report.latitude}, ${report.longitude}`;
  }

  return 'Место не указано';
};

export const formatAdminReportList = (
  title: string,
  reports: AdminReportListItem[],
) => {
  if (!reports.length) {
    return `${title}\n\nОчередь пуста.`;
  }

  return [
    title,
    '',
    ...reports.map((report) =>
      [
        `#${report.reportNumber}`,
        getReportStatusLabel(report.status, 'ru'),
        getLocationLabel(report),
        report.author?.fullName || 'Заявитель не указан',
      ].join(' — '),
    ),
  ].join('\n');
};
