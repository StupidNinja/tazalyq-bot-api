import { Entity, PrimaryColumn } from 'typeorm';

@Entity('users')
export class UserDao {
  @PrimaryColumn({ name: 'id', type: 'uuid' })
  id: string;
}
