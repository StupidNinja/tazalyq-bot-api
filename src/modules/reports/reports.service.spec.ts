import { BadRequestException } from '@nestjs/common';
import { FindOperator, Repository } from 'typeorm';

import { ReportDao, ReportPhotoType, UserDao } from '../../common/dao';
import { ReportStatus } from './domain/report-status';
import { ReportsService } from './reports.service';

const createRepositoryMock = () => ({
  count: jest.fn(),
  create: jest.fn((value) => value),
  createQueryBuilder: jest.fn(),
  find: jest.fn(),
  findOne: jest.fn(),
  findOneBy: jest.fn(),
  save: jest.fn((value) => Promise.resolve(value)),
  update: jest.fn(),
});

describe('ReportsService admin improvements', () => {
  const createStatsQueryBuilderMock = (
    rows: { status: ReportStatus; count: string }[],
  ) => {
    const queryBuilder = {
      select: jest.fn().mockReturnThis(),
      addSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      groupBy: jest.fn().mockReturnThis(),
      getRawMany: jest.fn().mockResolvedValue(rows),
    };

    return queryBuilder;
  };

  const createService = () => {
    const reportsRepository = createRepositoryMock();
    const photosRepository = createRepositoryMock();
    const historyRepository = createRepositoryMock();
    const service = new ReportsService(
      reportsRepository as unknown as Repository<ReportDao>,
      photosRepository as never,
      historyRepository as never,
    );

    return {
      service,
      reportsRepository,
      photosRepository,
      historyRepository,
    };
  };

  it('loads latest admin queue reports by status', async () => {
    const { service, reportsRepository } = createService();
    reportsRepository.find.mockResolvedValueOnce([]);

    await service.listAdminReports({ status: ReportStatus.New });

    expect(reportsRepository.find).toHaveBeenCalledWith({
      where: { status: ReportStatus.New },
      order: { submittedAt: 'DESC', createdAt: 'DESC' },
      take: 10,
      relations: { author: true, assignedAdmin: true },
    });
  });

  it('loads reports assigned to the current admin', async () => {
    const { service, reportsRepository } = createService();
    reportsRepository.find.mockResolvedValueOnce([]);

    await service.listAdminReports({
      status: ReportStatus.InProgress,
      assignedAdminId: 'admin-id',
    });

    expect(reportsRepository.find).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          status: ReportStatus.InProgress,
          assignedAdminId: 'admin-id',
        },
      }),
    );
  });

  it('loads admin reports by multiple statuses', async () => {
    const { service, reportsRepository } = createService();
    reportsRepository.find.mockResolvedValueOnce([]);

    await service.listAdminReports({
      statuses: [ReportStatus.New, ReportStatus.InProgress],
    });

    expect(reportsRepository.find).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          status: expect.any(FindOperator),
        },
      }),
    );
  });

  it('loads operational statistics grouped by status and excludes drafts', async () => {
    const { service, reportsRepository } = createService();
    const queryBuilder = createStatsQueryBuilderMock([
      { status: ReportStatus.New, count: '2' },
      { status: ReportStatus.Resolved, count: '3' },
    ]);
    reportsRepository.createQueryBuilder.mockReturnValue(queryBuilder);

    const stats = await service.getOperationalStats(
      new Date('2026-06-26T08:00:00.000Z'),
    );

    expect(stats.allTime.total).toBe(5);
    expect(stats.allTime.byStatus[ReportStatus.New]).toBe(2);
    expect(queryBuilder.where).toHaveBeenCalledWith(
      'report.status != :draftStatus',
      { draftStatus: ReportStatus.Draft },
    );
    expect(queryBuilder.andWhere).toHaveBeenCalledWith(
      'report.submittedAt IS NOT NULL',
    );
  });

  it('applies submittedAt period filters to today and seven day stats', async () => {
    const { service, reportsRepository } = createService();
    const queryBuilders = [
      createStatsQueryBuilderMock([]),
      createStatsQueryBuilderMock([]),
      createStatsQueryBuilderMock([]),
    ];
    reportsRepository.createQueryBuilder
      .mockReturnValueOnce(queryBuilders[0])
      .mockReturnValueOnce(queryBuilders[1])
      .mockReturnValueOnce(queryBuilders[2]);

    await service.getOperationalStats(new Date('2026-06-26T08:00:00.000Z'));

    expect(queryBuilders[0].andWhere).toHaveBeenCalledWith(
      'report.submittedAt >= :from',
      { from: new Date('2026-06-25T19:00:00.000Z') },
    );
    expect(queryBuilders[0].andWhere).toHaveBeenCalledWith(
      'report.submittedAt < :to',
      { to: new Date('2026-06-26T19:00:00.000Z') },
    );
    expect(queryBuilders[1].andWhere).toHaveBeenCalledWith(
      'report.submittedAt >= :from',
      { from: new Date('2026-06-19T19:00:00.000Z') },
    );
  });

  it('stores admin comments when resolving reports', async () => {
    const { service, reportsRepository, historyRepository } = createService();
    const report = {
      id: 'report-id',
      status: ReportStatus.InProgress,
      assignedAdminId: 'admin-id',
      author: { id: 'author-id' },
      photos: [],
    } as ReportDao;
    const admin = { id: 'admin-id' } as UserDao;
    reportsRepository.findOne.mockResolvedValue(report);

    await service.changeStatus({
      reportId: 'report-id',
      status: ReportStatus.Resolved,
      admin,
      adminComment: 'Убрано.',
    });

    expect(reportsRepository.update).toHaveBeenCalledWith(
      'report-id',
      expect.objectContaining({
        adminComment: 'Убрано.',
        resolvedAt: expect.any(Date),
      }),
    );
    expect(historyRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({
        comment: 'Убрано.',
      }),
    );
  });

  it('stores completion photos separately from user report photos', async () => {
    const { service, photosRepository } = createService();
    photosRepository.count.mockResolvedValueOnce(0);

    await service.addPhoto({
      reportId: 'report-id',
      telegramFileId: 'telegram-file-id',
      r2Bucket: 'bucket',
      r2Key: 'reports/report-id/completion.jpg',
      photoType: ReportPhotoType.AdminCompletion,
      uploadedByUserId: 'admin-id',
    });

    expect(photosRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({
        photoType: ReportPhotoType.AdminCompletion,
        uploadedByUserId: 'admin-id',
      }),
    );
  });

  it('filters user report photos by type', async () => {
    const { service, photosRepository } = createService();
    photosRepository.find.mockResolvedValueOnce([]);

    await service.getReportUserPhotos('report-id');

    expect(photosRepository.find).toHaveBeenCalledWith({
      where: {
        reportId: 'report-id',
        photoType: ReportPhotoType.UserReport,
      },
      order: { createdAt: 'ASC' },
    });
  });

  it('filters completion photos by type', async () => {
    const { service, photosRepository } = createService();
    photosRepository.find.mockResolvedValueOnce([]);

    await service.getReportCompletionPhotos('report-id');

    expect(photosRepository.find).toHaveBeenCalledWith({
      where: {
        reportId: 'report-id',
        photoType: ReportPhotoType.AdminCompletion,
      },
      order: { createdAt: 'ASC' },
    });
  });

  it('requires completion photos before resolving reports', async () => {
    const { service, reportsRepository, photosRepository } = createService();
    reportsRepository.findOne.mockResolvedValue({
      id: 'report-id',
      status: ReportStatus.InProgress,
      assignedAdminId: 'admin-id',
      author: { id: 'author-id' },
      photos: [],
    });
    photosRepository.count.mockResolvedValueOnce(0);

    await expect(
      service.changeStatus({
        reportId: 'report-id',
        status: ReportStatus.Resolved,
        admin: { id: 'admin-id' } as UserDao,
        adminComment: 'Убрано.',
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('rejects stale admin status actions', async () => {
    const { service, reportsRepository } = createService();
    reportsRepository.findOne.mockResolvedValue({
      id: 'report-id',
      status: ReportStatus.Resolved,
    });

    await expect(
      service.changeStatus({
        reportId: 'report-id',
        status: ReportStatus.Rejected,
        admin: { id: 'admin-id' } as UserDao,
      }),
    ).rejects.toThrow(BadRequestException);
  });
});
