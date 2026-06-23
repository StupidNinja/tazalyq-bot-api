/* eslint-disable no-console */
import { NestFactory } from '@nestjs/core';
import { Seeder } from 'database/seeds/seeder';
import { SeederModule } from 'database/seeds/seeder.module';

const bootstrap = async () => {
  const app = await NestFactory.createApplicationContext(SeederModule);

  const seeder = app.get(Seeder);

  try {
    await seeder.seed();
  } catch (e) {
    console.log(e);
  }

  app.close();
};

bootstrap();
