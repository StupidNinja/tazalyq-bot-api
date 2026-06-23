import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

import { ReportStatusHistoryDao } from './report-status-history.dao';
import { ReportDao } from './report.dao';
import { UserSessionDao } from './user-session.dao';

export enum UserRole {
  User = 'USER',
  Admin = 'ADMIN',
  SuperAdmin = 'SUPER_ADMIN',
}

export enum UserLanguage {
  Ru = 'ru',
  Kk = 'kk',
}

@Entity('users')
export class UserDao {
  @PrimaryGeneratedColumn('uuid', { name: 'id' })
  id: string;

  @Column({ name: 'telegram_id', type: 'bigint', unique: true, nullable: true })
  telegramId: string | null;

  @Column({ name: 'username', type: 'varchar', length: 255, nullable: true })
  username: string | null;

  @Column({ name: 'first_name', type: 'varchar', length: 255, nullable: true })
  firstName: string | null;

  @Column({ name: 'last_name', type: 'varchar', length: 255, nullable: true })
  lastName: string | null;

  @Column({
    name: 'language',
    type: 'enum',
    enum: UserLanguage,
    default: UserLanguage.Ru,
  })
  language: UserLanguage;

  @Column({ name: 'full_name', type: 'varchar', length: 255, nullable: true })
  fullName: string | null;

  @Column({ name: 'phone', type: 'varchar', length: 64, nullable: true })
  phone: string | null;

  @Column({
    name: 'role',
    type: 'enum',
    enum: UserRole,
    default: UserRole.User,
  })
  role: UserRole;

  @Column({ name: 'is_blocked', type: 'boolean', default: false })
  isBlocked: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamp' })
  updatedAt: Date;

  @DeleteDateColumn({ name: 'deleted_at', type: 'timestamp', nullable: true })
  deletedAt: Date | null;

  @OneToMany(() => UserSessionDao, (session) => session.user)
  sessions: UserSessionDao[];

  @OneToMany(() => ReportDao, (report) => report.author)
  reports: ReportDao[];

  @OneToMany(() => ReportStatusHistoryDao, (history) => history.changedByUser)
  statusHistory: ReportStatusHistoryDao[];
}
