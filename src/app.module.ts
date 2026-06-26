import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppEnvironment, getAppConfig } from './config/app.config';
import { getDatabaseConfig } from './config/database.config';
import { daos } from './common/dao';
import { HealthModule } from './modules/health/health.module';
import { AdminModule } from './modules/admin/admin.module';
import { ReportsModule } from './modules/reports/reports.module';
import { StorageModule } from './modules/storage/storage.module';
import { TelegramModule } from './modules/telegram/telegram.module';

const appConfig = getAppConfig();
const databaseConfig = getDatabaseConfig();

@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: 'postgres',
      host: databaseConfig.host,
      port: databaseConfig.port,
      username: databaseConfig.username,
      password: databaseConfig.password,
      database: databaseConfig.database,
      entities: daos,
      extra:
        appConfig.environment !== AppEnvironment.Local
          ? {
              ssl: {
                rejectUnauthorized: false,
              },
            }
          : undefined,
      ssl: appConfig.environment !== AppEnvironment.Local,
      synchronize: false,
    }),
    HealthModule,
    AdminModule,
    ReportsModule,
    StorageModule,
    TelegramModule,
  ],
})
export class AppModule {}
