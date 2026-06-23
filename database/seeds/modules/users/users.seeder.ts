import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserDao } from 'src/common/dao';
import { users } from './users.mock';

@Injectable()
export class UsersSeeder {
  constructor(
    @InjectRepository(UserDao)
    private readonly usersRepository: Repository<UserDao>,
  ) {}

  async run() {
    await this.usersRepository.insert(users);
  }
}
