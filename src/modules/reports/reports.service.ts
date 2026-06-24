import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import {
  ReportDao,
  ReportPhotoDao,
  ReportPhotoType,
  ReportStatusHistoryDao,
  UserDao,
} from '../../common/dao';
import {
  ReportStatus,
  canTransitionReportStatus,
} from './domain/report-status';

type AddPhotoInput = {
  reportId: string;
  telegramFileId: string;
  telegramFileUniqueId?: string | null;
  r2Bucket: string;
  r2Key: string;
  r2Url?: string | null;
  mimeType?: string | null;
  sizeBytes?: number | null;
  photoType?: ReportPhotoType;
  uploadedByUserId?: string | null;
};

type ListAdminReportsInput = {
  status?: ReportStatus;
  assignedAdminId?: string;
};

type ChangeReportStatusInput = {
  reportId: string;
  status: ReportStatus;
  admin: UserDao;
  rejectionReason?: string | null;
  adminComment?: string | null;
};

@Injectable()
export class ReportsService {
  constructor(
    @InjectRepository(ReportDao)
    private readonly reportsRepository: Repository<ReportDao>,
    @InjectRepository(ReportPhotoDao)
    private readonly photosRepository: Repository<ReportPhotoDao>,
    @InjectRepository(ReportStatusHistoryDao)
    private readonly historyRepository: Repository<ReportStatusHistoryDao>,
  ) {}

  async createDraft(author: UserDao) {
    const existingDraft = await this.reportsRepository.findOne({
      where: {
        authorId: author.id,
        status: ReportStatus.Draft,
      },
    });

    if (existingDraft) {
      return existingDraft;
    }

    return this.reportsRepository.save(
      this.reportsRepository.create({
        authorId: author.id,
        status: ReportStatus.Draft,
      }),
    );
  }

  async addPhoto(input: AddPhotoInput) {
    const photoType = input.photoType || ReportPhotoType.UserReport;
    const photoCount = await this.countReportPhotos(input.reportId, photoType);

    if (photoCount >= 5) {
      throw new BadRequestException('Report photo limit exceeded');
    }

    return this.photosRepository.save(
      this.photosRepository.create({
        reportId: input.reportId,
        photoType,
        uploadedByUserId: input.uploadedByUserId || null,
        telegramFileId: input.telegramFileId,
        telegramFileUniqueId: input.telegramFileUniqueId,
        r2Bucket: input.r2Bucket,
        r2Key: input.r2Key,
        r2Url: input.r2Url,
        mimeType: input.mimeType,
        sizeBytes: input.sizeBytes,
      }),
    );
  }

  async setLocation(
    reportId: string,
    location:
      | { latitude: number; longitude: number; addressText?: never }
      | { addressText: string; latitude?: never; longitude?: never },
  ) {
    const patch =
      'addressText' in location
        ? {
            addressText: location.addressText,
            latitude: null,
            longitude: null,
          }
        : {
            addressText: null,
            latitude: String(location.latitude),
            longitude: String(location.longitude),
          };

    await this.reportsRepository.update(reportId, patch);
  }

  async setDescription(reportId: string, description: string | null) {
    await this.reportsRepository.update(reportId, {
      description: description?.slice(0, 1000) || null,
    });
  }

  async submit(reportId: string) {
    const report = await this.findReportWithDetails(reportId);

    if (!report) {
      throw new BadRequestException('Report not found');
    }

    if (!report.photos?.length) {
      throw new BadRequestException('Report requires at least one photo');
    }

    if (!report.addressText && (!report.latitude || !report.longitude)) {
      throw new BadRequestException('Report requires location or address');
    }

    await this.transitionStatus(report, ReportStatus.New, report.authorId);
    await this.reportsRepository.update(report.id, { submittedAt: new Date() });

    return this.findReportWithDetails(reportId);
  }

  async saveAdminMessageId(reportId: string, messageId: number) {
    await this.reportsRepository.update(reportId, {
      adminMessageId: messageId,
    });
  }

  async changeStatus(input: ChangeReportStatusInput) {
    const report = await this.findReportWithDetails(input.reportId);

    if (!report) {
      throw new BadRequestException('Report not found');
    }

    if (input.status === ReportStatus.Resolved) {
      const completionPhotoCount = await this.countReportPhotos(
        report.id,
        ReportPhotoType.AdminCompletion,
      );

      if (completionPhotoCount < 1) {
        throw new BadRequestException(
          'Report requires at least one completion photo',
        );
      }
    }

    await this.transitionStatus(
      report,
      input.status,
      input.admin.id,
      input.adminComment || input.rejectionReason || undefined,
    );

    const patch: Partial<ReportDao> = {
      assignedAdminId:
        input.status === ReportStatus.InProgress || !report.assignedAdminId
          ? input.admin.id
          : report.assignedAdminId,
      rejectionReason:
        input.status === ReportStatus.Rejected
          ? input.rejectionReason || null
          : null,
      adminComment: input.adminComment || null,
      resolvedAt: input.status === ReportStatus.Resolved ? new Date() : null,
    };

    await this.reportsRepository.update(report.id, patch);

    return this.findReportWithDetails(input.reportId);
  }

  async cancel(reportId: string, userId: string) {
    const report = await this.reportsRepository.findOneBy({ id: reportId });

    if (!report) {
      return;
    }

    await this.transitionStatus(report, ReportStatus.Cancelled, userId);
    await this.reportsRepository.update(report.id, { cancelledAt: new Date() });
  }

  async findReportWithDetails(reportId: string) {
    return this.reportsRepository.findOne({
      where: { id: reportId },
      relations: {
        author: true,
        photos: true,
        assignedAdmin: true,
      },
    });
  }

  async listUserReports(userId: string) {
    return this.reportsRepository.find({
      where: { authorId: userId },
      order: { createdAt: 'DESC' },
      take: 10,
    });
  }

  async listAdminReports(input: ListAdminReportsInput) {
    return this.reportsRepository.find({
      where: {
        ...(input.status ? { status: input.status } : {}),
        ...(input.assignedAdminId
          ? { assignedAdminId: input.assignedAdminId }
          : {}),
      },
      order: { submittedAt: 'DESC', createdAt: 'DESC' },
      take: 10,
      relations: { author: true, assignedAdmin: true },
    });
  }

  async getReportUserPhotos(reportId: string) {
    return this.getReportPhotos(reportId, ReportPhotoType.UserReport);
  }

  async getReportCompletionPhotos(reportId: string) {
    return this.getReportPhotos(reportId, ReportPhotoType.AdminCompletion);
  }

  async countCompletionPhotos(reportId: string) {
    return this.countReportPhotos(reportId, ReportPhotoType.AdminCompletion);
  }

  private async getReportPhotos(reportId: string, photoType: ReportPhotoType) {
    return this.photosRepository.find({
      where: {
        reportId,
        photoType,
      },
      order: { createdAt: 'ASC' },
    });
  }

  private async countReportPhotos(
    reportId: string,
    photoType: ReportPhotoType,
  ) {
    return this.photosRepository.count({
      where: {
        reportId,
        photoType,
      },
    });
  }

  private async transitionStatus(
    report: ReportDao,
    toStatus: ReportStatus,
    changedByUserId: string | null,
    comment?: string,
  ) {
    if (!canTransitionReportStatus(report.status, toStatus)) {
      throw new BadRequestException(
        `Cannot transition report from ${report.status} to ${toStatus}`,
      );
    }

    await this.reportsRepository.update(report.id, { status: toStatus });
    await this.historyRepository.save(
      this.historyRepository.create({
        reportId: report.id,
        fromStatus: report.status,
        toStatus,
        changedByUserId,
        comment,
      }),
    );
  }
}
