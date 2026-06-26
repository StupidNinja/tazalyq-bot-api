type AdminChatListItem = {
  telegramChatId: string;
  title?: string | null;
  type: string;
};

export const formatAdminChatList = (
  chats: AdminChatListItem[],
  fallbackAdminChatId?: string | null,
) => {
  const rows = chats.map(
    (chat) => `${chat.telegramChatId} — ${chat.title || chat.type}`,
  );

  if (!rows.length && fallbackAdminChatId) {
    rows.push(`${fallbackAdminChatId} — ADMIN_CHAT_ID из .env`);
  }

  return [
    'Активные админские чаты:',
    '',
    ...(rows.length ? rows : ['Нет активных чатов.']),
  ].join('\n');
};
