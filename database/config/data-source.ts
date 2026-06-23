import { DataSource } from 'typeorm';
import { daos } from '../../src/common/dao';
import { AppEnvironment, getAppConfig } from '../../src/config/app.config';
import { getDatabaseConfig } from '../../src/config/database.config';

const appConfig = getAppConfig();
const databaseConfig = getDatabaseConfig();

export const dataSource = new DataSource({
  type: 'postgres',
  host: databaseConfig.host,
  port: databaseConfig.port,
  username: databaseConfig.username,
  password: databaseConfig.password,
  database: databaseConfig.database,
  migrations:
    appConfig.environment === AppEnvironment.Local
      ? ['database/migrations/*.ts']
      : ['dist/database/migrations/*.js'],
  entities:
    appConfig.environment === AppEnvironment.Local
      ? daos
      : ['dist/src/common/dao/*.dao.js'],
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
});
