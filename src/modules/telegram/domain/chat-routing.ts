type ChatType = string | undefined;

export const isPrivateChat = (chatType: ChatType) => chatType === 'private';

export const shouldIgnoreNonPrivateMessage = (chatType: ChatType) =>
  !isPrivateChat(chatType);

export const shouldShowPrivateChatPrompt = (chatType: ChatType) =>
  !isPrivateChat(chatType);
