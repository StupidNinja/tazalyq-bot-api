import { AppEnvironment, getAppConfig } from './app.config';

describe('app.config.ts', () => {
  describe('getAppConfig', () => {
    const originalEnv = process.env;

    beforeEach(() => {
      jest.resetModules();
      process.env = { ...originalEnv };
    });

    afterEach(() => {
      process.env = { ...originalEnv };
    });

    it('should be defined', () => {
      expect(getAppConfig).toBeDefined();
    });

    it('should return app config', () => {
      process.env.APP_PORT = '3000';
      process.env.APP_ENV = 'development';

      const result = getAppConfig();

      expect(result).toEqual({
        port: 3000,
        environment: process.env.APP_ENV || AppEnvironment.Development,
      });
    });

    it('should return app config with default values if env vars are not provided', () => {
      process.env.APP_PORT = '';
      process.env.APP_ENV = '';

      const result = getAppConfig();

      expect(result).toEqual({
        port: 4004,
        environment: AppEnvironment.Production,
      });
    });
  });
});
