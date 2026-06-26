import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

import { UserDao } from './user.dao';

@Entity('admin_invites')
export class AdminInviteDao {
  @PrimaryGeneratedColumn('uuid', { name: 'id' })
  id: string;

  @Column({ name: 'username', type: 'varchar', length: 255, unique: true })
  username: string;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive: boolean;

  @Column({ name: 'invited_by_user_id', type: 'uuid', nullable: true })
  invitedByUserId: string | null;

  @ManyToOne(() => UserDao, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'invited_by_user_id' })
  invitedByUser: UserDao | null;

  @Column({ name: 'activated_user_id', type: 'uuid', nullable: true })
  activatedUserId: string | null;

  @ManyToOne(() => UserDao, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'activated_user_id' })
  activatedUser: UserDao | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamp' })
  updatedAt: Date;
}
