import {
  isSameTelegramMessage,
  isTelegramMessageNotModifiedError,
} from './telegram-message';

describe('telegram message helpers', () => {
  it('detects the same telegram message across numeric and string chat ids', () => {
    expect(isSameTelegramMessage(-5590525660, 335, '-5590525660', 335)).toBe(
      true,
    );
  });

  it('does not treat different message ids as the same telegram message', () => {
    expect(isSameTelegramMessage(-5590525660, 336, '-5590525660', 335)).toBe(
      false,
    );
  });

  it('detects Telegram message-not-modified errors', () => {
    expect(
      isTelegramMessageNotModifiedError({
        error_code: 400,
        description:
          'Bad Request: message is not modified: specified new message content and reply markup are exactly the same as a current content and reply markup of the message',
      }),
    ).toBe(true);
  });
});
