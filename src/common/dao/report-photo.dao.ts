import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';

import { ReportDao } from './report.dao';
import { UserDao } from './user.dao';

export enum ReportPhotoType {
  UserReport = 'USER_REPORT',
  AdminCompletion = 'ADMIN_COMPLETION',
}

@Entity('report_photos')
export class ReportPhotoDao {
  @PrimaryGeneratedColumn('uuid', { name: 'id' })
  id: string;

  @Column({ name: 'report_id', type: 'uuid' })
  reportId: string;

  @ManyToOne(() => ReportDao, (report) => report.photos, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'report_id' })
  report: ReportDao;

  @Column({
    name: 'photo_type',
    type: 'enum',
    enum: ReportPhotoType,
    default: ReportPhotoType.UserReport,
  })
  photoType: ReportPhotoType;

  @Column({ name: 'uploaded_by_user_id', type: 'uuid', nullable: true })
  uploadedByUserId: string | null;

  @ManyToOne(() => UserDao, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'uploaded_by_user_id' })
  uploadedByUser: UserDao | null;

  @Column({ name: 'telegram_file_id', type: 'varchar', length: 255 })
  telegramFileId: string;

  @Column({
    name: 'telegram_file_unique_id',
    type: 'varchar',
    length: 255,
    nullable: true,
  })
  telegramFileUniqueId: string | null;

  @Column({ name: 'r2_bucket', type: 'varchar', length: 255 })
  r2Bucket: string;

  @Column({ name: 'r2_key', type: 'varchar', length: 1000 })
  r2Key: string;

  @Column({ name: 'r2_url', type: 'varchar', length: 1000, nullable: true })
  r2Url: string | null;

  @Column({ name: 'mime_type', type: 'varchar', length: 255, nullable: true })
  mimeType: string | null;

  @Column({ name: 'size_bytes', type: 'integer', nullable: true })
  sizeBytes: number | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp' })
  createdAt: Date;
}
