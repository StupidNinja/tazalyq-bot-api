import { Injectable } from '@nestjs/common';
import { UsersSeeder } from './modules/users/users.seeder';

@Injectable()
export class Seeder {
  constructor(private readonly usersSeeder: UsersSeeder) {}

  async seed() {
    await this.usersSeeder.run();
  }
}
