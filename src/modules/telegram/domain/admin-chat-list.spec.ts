import { formatAdminChatList } from './admin-chat-list';

describe('admin chat list', () => {
  it('shows active database chats', () => {
    expect(
      formatAdminChatList(
        [
          {
            telegramChatId: '-100123',
            title: 'Ops',
            type: 'supergroup',
          },
        ],
        null,
      ),
    ).toContain('-100123 — Ops');
  });

  it('shows env fallback chat when no database chats are active', () => {
    expect(formatAdminChatList([], '-5590525660')).toContain(
      '-5590525660 — ADMIN_CHAT_ID из .env',
    );
  });
});
