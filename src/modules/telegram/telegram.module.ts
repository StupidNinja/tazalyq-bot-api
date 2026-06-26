import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { UserDao, UserSessionDao } from '../../common/dao';
import { AdminModule } from '../admin/admin.module';
import { ReportsModule } from '../reports/reports.module';
import { StorageModule } from '../storage/storage.module';
import { TelegramBotService } from './telegram-bot.service';
import { TelegramUpdateService } from './telegram-update.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([UserDao, UserSessionDao]),
    AdminModule,
    ReportsModule,
    StorageModule,
  ],
  providers: [TelegramBotService, TelegramUpdateService],
})
export class TelegramModule {}
