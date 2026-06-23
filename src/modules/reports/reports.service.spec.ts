import { BadRequestException } from '@nestjs/common';
import { Repository } from 'typeorm';

import { ReportDao, UserDao } from '../../common/dao';
import { ReportStatus } from './domain/report-status';
import { ReportsService } from './reports.service';

const createRepositoryMock = () => ({
  count: jest.fn(),
  create: jest.fn((value) => value),
  find: jest.fn(),
  findOne: jest.fn(),
  findOneBy: jest.fn(),
  save: jest.fn((value) => Promise.resolve(value)),
  update: jest.fn(),
});

describe('ReportsService admin improvements', () => {
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
