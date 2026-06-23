import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import {
  ReportDao,
  ReportPhotoDao,
  ReportStatusHistoryDao,
  UserDao,
} from '../../common/dao';
import { ReportsService } from './reports.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      UserDao,
      ReportDao,
      ReportPhotoDao,
      ReportStatusHistoryDao,
    ]),
  ],
  providers: [ReportsService],
  exports: [ReportsService],
})
export class ReportsModule {}
