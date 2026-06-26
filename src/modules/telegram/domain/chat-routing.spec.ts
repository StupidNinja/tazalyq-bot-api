import {
  shouldIgnoreNonPrivateMessage,
  shouldShowPrivateChatPrompt,
} from './chat-routing';

describe('chat routing', () => {
  it('ignores ordinary group messages', () => {
    expect(shouldIgnoreNonPrivateMessage('supergroup')).toBe(true);
  });

  it('does not ignore private messages', () => {
    expect(shouldIgnoreNonPrivateMessage('private')).toBe(false);
  });

  it('shows private-chat prompt for user commands in groups', () => {
    expect(shouldShowPrivateChatPrompt('group')).toBe(true);
  });
});
