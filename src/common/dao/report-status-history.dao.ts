import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';

import { ReportStatus } from '../../modules/reports/domain/report-status';
import { ReportDao } from './report.dao';
import { UserDao } from './user.dao';

@Entity('report_status_history')
export class ReportStatusHistoryDao {
  @PrimaryGeneratedColumn('uuid', { name: 'id' })
  id: string;

  @Column({ name: 'report_id', type: 'uuid' })
  reportId: string;

  @ManyToOne(() => ReportDao, (report) => report.statusHistory, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'report_id' })
  report: ReportDao;

  @Column({
    name: 'from_status',
    type: 'enum',
    enum: ReportStatus,
    nullable: true,
  })
  fromStatus: ReportStatus | null;

  @Column({ name: 'to_status', type: 'enum', enum: ReportStatus })
  toStatus: ReportStatus;

  @Column({ name: 'changed_by_user_id', type: 'uuid', nullable: true })
  changedByUserId: string | null;

  @ManyToOne(() => UserDao, (user) => user.statusHistory, {
    nullable: true,
    onDelete: 'SET NULL',
  })
  @JoinColumn({ name: 'changed_by_user_id' })
  changedByUser: UserDao | null;

  @Column({ name: 'comment', type: 'varchar', length: 1000, nullable: true })
  comment: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp' })
  createdAt: Date;
}
