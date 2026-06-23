import { BotLanguage, t } from './bot-text';

describe('bot text', () => {
  it('returns russian text by key', () => {
    expect(t(BotLanguage.Ru, 'mainMenuTitle')).toBe('Главное меню');
  });

  it('returns kazakh text by key', () => {
    expect(t(BotLanguage.Kk, 'mainMenuTitle')).toBe('Басты мәзір');
  });

  it('falls back to russian when language is missing', () => {
    expect(t(undefined, 'help')).toContain('С помощью этого бота');
  });
});
