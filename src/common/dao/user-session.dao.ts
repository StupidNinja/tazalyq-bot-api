import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

import { ReportDao } from './report.dao';
import { UserDao } from './user.dao';

export enum UserSessionState {
  Idle = 'IDLE',
  WaitingFullName = 'WAITING_FULL_NAME',
  WaitingPhone = 'WAITING_PHONE',
  WaitingPhotos = 'WAITING_PHOTOS',
  WaitingLocation = 'WAITING_LOCATION',
  WaitingAddressText = 'WAITING_ADDRESS_TEXT',
  WaitingDescription = 'WAITING_DESCRIPTION',
  WaitingConfirmation = 'WAITING_CONFIRMATION',
  WaitingRejectionReason = 'WAITING_REJECTION_REASON',
  WaitingAdminComment = 'WAITING_ADMIN_COMMENT',
}

@Entity('user_sessions')
export class UserSessionDao {
  @PrimaryGeneratedColumn('uuid', { name: 'id' })
  id: string;

  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @ManyToOne(() => UserDao, (user) => user.sessions, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: UserDao;

  @Column({
    name: 'state',
    type: 'enum',
    enum: UserSessionState,
    default: UserSessionState.Idle,
  })
  state: UserSessionState;

  @Column({ name: 'current_report_id', type: 'uuid', nullable: true })
  currentReportId: string | null;

  @ManyToOne(() => ReportDao, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'current_report_id' })
  currentReport: ReportDao | null;

  @Column({ name: 'metadata', type: 'jsonb', default: () => "'{}'" })
  metadata: Record<string, unknown>;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamp' })
  updatedAt: Date;
}
