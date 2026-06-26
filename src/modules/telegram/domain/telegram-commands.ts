import { BotCommand } from 'grammy/types';

import { UserRole } from '../../../common/dao';

type CommandLanguage = 'ru' | 'kk' | string | null | undefined;

const selectLanguage = (language: CommandLanguage) =>
  language === 'kk' ? 'kk' : 'ru';

const commandDescriptions: Record<'ru' | 'kk', Record<string, string>> = {
  ru: {
    start: 'Запустить бота',
    new_report: 'Создать обращение',
    my_reports: 'Мои обращения',
    language: 'Изменить язык',
    help: 'Помощь',
    cancel: 'Отменить текущий шаг',
    admin: 'Админ меню',
    stats: 'Статистика',
    admin_add: 'Добавить админа',
    admin_remove: 'Удалить админа',
    admins: 'Список админов',
    admin_chat_add: 'Добавить админ чат',
    admin_chat_remove: 'Отключить админ чат',
    admin_chats: 'Список админ чатов',
  },
  kk: {
    start: 'Ботты іске қосу',
    new_report: 'Өтініш жасау',
    my_reports: 'Менің өтініштерім',
    language: 'Тілді өзгерту',
    help: 'Көмек',
    cancel: 'Ағымдағы қадамды тоқтату',
    admin: 'Админ мәзірі',
    stats: 'Статистика',
    admin_add: 'Админ қосу',
    admin_remove: 'Админді алып тастау',
    admins: 'Админдер тізімі',
    admin_chat_add: 'Админ чатын қосу',
    admin_chat_remove: 'Админ чатын ажырату',
    admin_chats: 'Админ чаттары',
  },
};

const userCommandNames = [
  'start',
  'new_report',
  'my_reports',
  'language',
  'help',
  'cancel',
];

const adminCommandNames = ['admin', 'stats'];

const superAdminCommandNames = [
  'admin_add',
  'admin_remove',
  'admins',
  'admin_chat_add',
  'admin_chat_remove',
  'admin_chats',
];

const buildCommands = (
  commandNames: string[],
  language: CommandLanguage,
): BotCommand[] => {
  const selectedLanguage = selectLanguage(language);

  return commandNames.map((command) => ({
    command,
    description: commandDescriptions[selectedLanguage][command],
  }));
};

export const userBotCommands = buildCommands(userCommandNames, 'ru');

export const getBotCommandsForRole = (
  role: UserRole,
  language?: CommandLanguage,
): BotCommand[] => {
  const userCommands = buildCommands(userCommandNames, language);
  const adminCommands = buildCommands(adminCommandNames, language);
  const superAdminCommands = buildCommands(superAdminCommandNames, language);

  if (role === UserRole.SuperAdmin) {
    return [...userCommands, ...adminCommands, ...superAdminCommands];
  }

  if (role === UserRole.Admin) {
    return [...userCommands, ...adminCommands];
  }

  return userCommands;
};
