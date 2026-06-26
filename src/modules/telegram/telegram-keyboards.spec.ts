import { adminMenuKeyboard } from './telegram-keyboards';

describe('telegram keyboards', () => {
  it('shows active and inactive report list shortcuts in admin menu', () => {
    const keyboard = adminMenuKeyboard();

    expect(keyboard.inline_keyboard.flat()).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          text: '🟢 Активные',
          callback_data: 'admin:list:active',
        }),
        expect.objectContaining({
          text: '⚪️ Неактивные',
          callback_data: 'admin:list:inactive',
        }),
      ]),
    );
  });
});
