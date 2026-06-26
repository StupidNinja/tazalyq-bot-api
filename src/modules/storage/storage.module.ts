import { Module } from '@nestjs/common';

import { R2StorageService } from './storage.service';

@Module({
  providers: [R2StorageService],
  exports: [R2StorageService],
})
export class StorageModule {}
