import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

import { ReportStatus } from '../../modules/reports/domain/report-status';
import { ReportPhotoDao } from './report-photo.dao';
import { ReportStatusHistoryDao } from './report-status-history.dao';
import { UserDao } from './user.dao';

@Entity('reports')
export class ReportDao {
  @PrimaryGeneratedColumn('uuid', { name: 'id' })
  id: string;

  @Column({ name: 'report_number', type: 'integer', unique: true })
  reportNumber: number;

  @Column({ name: 'author_id', type: 'uuid' })
  authorId: string;

  @ManyToOne(() => UserDao, (user) => user.reports, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'author_id' })
  author: UserDao;

  @Column({
    name: 'status',
    type: 'enum',
    enum: ReportStatus,
    default: ReportStatus.Draft,
  })
  status: ReportStatus;

  @Column({
    name: 'description',
    type: 'varchar',
    length: 1000,
    nullable: true,
  })
  description: string | null;

  @Column({
    name: 'address_text',
    type: 'varchar',
    length: 1000,
    nullable: true,
  })
  addressText: string | null;

  @Column({
    name: 'latitude',
    type: 'numeric',
    precision: 10,
    scale: 7,
    nullable: true,
  })
  latitude: string | null;

  @Column({
    name: 'longitude',
    type: 'numeric',
    precision: 10,
    scale: 7,
    nullable: true,
  })
  longitude: string | null;

  @Column({
    name: 'admin_comment',
    type: 'varchar',
    length: 1000,
    nullable: true,
  })
  adminComment: string | null;

  @Column({
    name: 'rejection_reason',
    type: 'varchar',
    length: 255,
    nullable: true,
  })
  rejectionReason: string | null;

  @Column({ name: 'assigned_admin_id', type: 'uuid', nullable: true })
  assignedAdminId: string | null;

  @ManyToOne(() => UserDao, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'assigned_admin_id' })
  assignedAdmin: UserDao | null;

  @Column({ name: 'admin_message_id', type: 'integer', nullable: true })
  adminMessageId: number | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp' })
  createdAt: Date;

  @Column({ name: 'submitted_at', type: 'timestamp', nullable: true })
  submittedAt: Date | null;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamp' })
  updatedAt: Date;

  @Column({ name: 'resolved_at', type: 'timestamp', nullable: true })
  resolvedAt: Date | null;

  @Column({ name: 'cancelled_at', type: 'timestamp', nullable: true })
  cancelledAt: Date | null;

  @OneToMany(() => ReportPhotoDao, (photo) => photo.report)
  photos: ReportPhotoDao[];

  @OneToMany(() => ReportStatusHistoryDao, (history) => history.report)
  statusHistory: ReportStatusHistoryDao[];
}
