import { Injectable } from '@nestjs/common';

import kk from './locales/kk.json';
import ru from './locales/ru.json';

type Params = Record<string, string | number>;
type Language = 'ru' | 'kk' | string | null | undefined;

const dictionaries = { ru, kk };

const getByPath = (value: unknown, path: string) =>
  path.split('.').reduce<unknown>((current, segment) => {
    if (current && typeof current === 'object' && segment in current) {
      return (current as Record<string, unknown>)[segment];
    }

    return undefined;
  }, value);

const interpolate = (template: string, params?: Params) =>
  template.replace(/\{\{(\w+)}}/g, (_, key) => String(params?.[key] ?? ''));

@Injectable()
export class BotI18nService {
  t(language: Language, key: string, params?: Params) {
    const selectedLanguage = language === 'kk' ? 'kk' : 'ru';
    const value =
      getByPath(dictionaries[selectedLanguage], key) ||
      getByPath(dictionaries.ru, key);

    if (typeof value !== 'string') {
      return key;
    }

    return interpolate(value, params);
  }
}
