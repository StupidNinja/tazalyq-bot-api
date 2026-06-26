import { normalizePhoneNumber } from './phone-normalizer';

describe('normalizePhoneNumber', () => {
  it('normalizes Kazakhstan phone numbers with punctuation', () => {
    expect(normalizePhoneNumber('+7 (700) 123-45-67')).toBe('+77001234567');
  });

  it('converts leading 8 to +7', () => {
    expect(normalizePhoneNumber('87001234567')).toBe('+77001234567');
  });

  it('converts leading 7 to +7', () => {
    expect(normalizePhoneNumber('77001234567')).toBe('+77001234567');
  });

  it('returns cleaned text when the number cannot be normalized', () => {
    expect(normalizePhoneNumber('12345')).toBe('12345');
  });
});
