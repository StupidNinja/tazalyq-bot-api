import { getBotConfig } from './bot.config';

describe('getBotConfig', () => {
  const env = process.env;

  beforeEach(() => {
    process.env = { ...env };
  });

  afterAll(() => {
    process.env = env;
  });

  it('parses bootstrap super admin ids', () => {
    process.env.SUPER_ADMIN_IDS = '123, 456';

    expect(getBotConfig().superAdminIds).toEqual(['123', '456']);
  });
});
