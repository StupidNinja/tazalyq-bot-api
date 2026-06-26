import { BotI18nService } from './bot-i18n.service';
import kk from './locales/kk.json';
import ru from './locales/ru.json';

const flattenKeys = (value: unknown, prefix = ''): string[] => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return [prefix];
  }

  return Object.entries(value).flatMap(([key, child]) =>
    flattenKeys(child, prefix ? `${prefix}.${key}` : key),
  );
};

describe('BotI18nService', () => {
  it('returns russian translations by key', () => {
    expect(new BotI18nService().t('ru', 'buttons.newReport')).toBe(
      '🗑 Создать обращение',
    );
  });

  it('returns kazakh translations by key', () => {
    expect(new BotI18nService().t('kk', 'buttons.newReport')).toBe(
      '🗑 Өтініш жасау',
    );
  });

  it('interpolates params', () => {
    expect(
      new BotI18nService().t('ru', 'reports.accepted', {
        reportNumber: 124,
      }),
    ).toContain('#124');
  });

  it('keeps russian and kazakh locale keys in sync', () => {
    expect(flattenKeys(kk).sort()).toEqual(flattenKeys(ru).sort());
  });
});
