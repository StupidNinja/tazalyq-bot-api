import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { UserDao, UserSessionDao } from '../../common/dao';
import { ReportsModule } from '../reports/reports.module';
import { StorageModule } from '../storage/storage.module';
import { TelegramBotService } from './telegram-bot.service';
import { TelegramUpdateService } from './telegram-update.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([UserDao, UserSessionDao]),
    ReportsModule,
    StorageModule,
  ],
  providers: [TelegramBotService, TelegramUpdateService],
})
export class TelegramModule {}
