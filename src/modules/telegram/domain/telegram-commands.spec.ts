import { UserRole } from '../../../common/dao';
import { getBotCommandsForRole } from './telegram-commands';

describe('telegram commands', () => {
  it('exposes base user commands by default', () => {
    expect(
      getBotCommandsForRole(UserRole.User).map((command) => command.command),
    ).toEqual([
      'start',
      'new_report',
      'my_reports',
      'language',
      'help',
      'cancel',
    ]);
  });

  it('adds admin queue commands for admins', () => {
    expect(
      getBotCommandsForRole(UserRole.Admin, 'ru').map(
        (command) => command.command,
      ),
    ).toContain('admin');
  });

  it('adds management commands only for super admins', () => {
    const adminCommands = getBotCommandsForRole(UserRole.Admin, 'ru').map(
      (command) => command.command,
    );
    const superAdminCommands = getBotCommandsForRole(
      UserRole.SuperAdmin,
      'ru',
    ).map((command) => command.command);

    expect(adminCommands).not.toContain('admin_add');
    expect(superAdminCommands).toEqual(
      expect.arrayContaining(['admin_add', 'admin_chat_add', 'admin_chats']),
    );
  });

  it('localizes command descriptions for kazakh users', () => {
    expect(getBotCommandsForRole(UserRole.User, 'kk')).toEqual(
      expect.arrayContaining([
        { command: 'new_report', description: 'Өтініш жасау' },
        { command: 'language', description: 'Тілді өзгерту' },
      ]),
    );
  });

  it('uses admin wording in kazakh admin commands too', () => {
    expect(getBotCommandsForRole(UserRole.SuperAdmin, 'kk')).toEqual(
      expect.arrayContaining([
        { command: 'admin', description: 'Админ мәзірі' },
        { command: 'admin_add', description: 'Админ қосу' },
        { command: 'admin_chats', description: 'Админ чаттары' },
      ]),
    );
  });
});
