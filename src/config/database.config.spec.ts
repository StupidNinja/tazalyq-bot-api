import { getDatabaseConfig } from './database.config';

describe('database.config.ts', () => {
  describe('getDatabaseConfig', () => {
    const originalEnv = process.env;

    beforeEach(() => {
      jest.resetModules();
      process.env = { ...originalEnv };
    });

    afterEach(() => {
      process.env = { ...originalEnv };
    });

    it('should be defined', () => {
      expect(getDatabaseConfig).toBeDefined();
    });

    it('should return database config', () => {
      const config = {
        host: 'host',
        port: Math.floor(Math.random() * 10000),
        username: 'username',
        password: 'password',
        database: 'database',
      };

      process.env.DB_HOST = config.host;
      process.env.DB_PORT = config.port.toString();
      process.env.DB_USER = config.username;
      process.env.DB_PASSWORD = config.password;
      process.env.DB_NAME = config.database;

      const result = getDatabaseConfig();

      expect(result).toEqual({
        host: config.host,
        port: config.port,
        username: config.username,
        password: config.password,
        database: config.database,
      });
    });
  });
});
