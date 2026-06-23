import dotenv from 'dotenv';

dotenv.config();

const parseList = (value?: string) =>
  value
    ? value
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean)
    : [];

export const getBotConfig = () => {
  return {
    token: process.env.BOT_TOKEN,
    mode: process.env.BOT_MODE || 'polling',
    adminIds: parseList(process.env.ADMIN_IDS),
    adminChatId: process.env.ADMIN_CHAT_ID,
  };
};
