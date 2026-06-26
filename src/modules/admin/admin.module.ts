import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AdminChatDao, AdminInviteDao, UserDao } from '../../common/dao';
import { AdminService } from './admin.service';

@Module({
  imports: [TypeOrmModule.forFeature([UserDao, AdminChatDao, AdminInviteDao])],
  providers: [AdminService],
  exports: [AdminService],
})
export class AdminModule {}
