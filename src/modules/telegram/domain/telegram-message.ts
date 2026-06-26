export const isSameTelegramMessage = (
  currentChatId: string | number | undefined,
  currentMessageId: number | undefined,
  targetChatId: string | number | null | undefined,
  targetMessageId: number | null | undefined,
) =>
  currentChatId !== undefined &&
  currentMessageId !== undefined &&
  targetChatId !== undefined &&
  targetChatId !== null &&
  targetMessageId !== undefined &&
  targetMessageId !== null &&
  String(currentChatId) === String(targetChatId) &&
  currentMessageId === targetMessageId;

export const isTelegramMessageNotModifiedError = (error: unknown) => {
  if (!error || typeof error !== 'object') {
    return false;
  }

  const maybeError = error as {
    error_code?: number;
    description?: string;
  };

  return (
    maybeError.error_code === 400 &&
    typeof maybeError.description === 'string' &&
    maybeError.description.includes('message is not modified')
  );
};
