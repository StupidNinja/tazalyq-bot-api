import kk from '../../i18n/locales/kk.json';
import ru from '../../i18n/locales/ru.json';

export enum BotLanguage {
  Ru = 'ru',
  Kk = 'kk',
}

export type BotTextKey =
  | 'chooseLanguage'
  | 'fullNamePrompt'
  | 'phonePrompt'
  | 'sharePhone'
  | 'mainMenuTitle'
  | 'newReport'
  | 'myReports'
  | 'changeLanguage'
  | 'helpButton'
  | 'help'
  | 'sendPhoto'
  | 'photoAdded'
  | 'next'
  | 'cancel'
  | 'sendLocation'
  | 'shareLocation'
  | 'enterAddress'
  | 'descriptionPrompt'
  | 'skip'
  | 'confirmReport'
  | 'editLocation'
  | 'editDescription'
  | 'addPhoto'
  | 'submit'
  | 'reportCancelled'
  | 'needPhoto'
  | 'tooManyPhotos'
  | 'savedProfile';

const messages: Record<BotLanguage, Record<BotTextKey, string>> = {
  [BotLanguage.Ru]: ru as unknown as Record<BotTextKey, string>,
  [BotLanguage.Kk]: kk as unknown as Record<BotTextKey, string>,
};

export const t = (
  language: BotLanguage | string | null | undefined,
  key: BotTextKey,
) => {
  const selectedLanguage =
    language === BotLanguage.Kk ? BotLanguage.Kk : BotLanguage.Ru;

  return messages[selectedLanguage][key] || messages[BotLanguage.Ru][key];
};
