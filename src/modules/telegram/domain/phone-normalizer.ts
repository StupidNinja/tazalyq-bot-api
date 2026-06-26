export const normalizePhoneNumber = (value: string) => {
  const cleaned = value.replace(/[\s\-()]/g, '');

  if (/^\+7\d{10}$/.test(cleaned)) {
    return cleaned;
  }

  if (/^8\d{10}$/.test(cleaned)) {
    return `+7${cleaned.slice(1)}`;
  }

  if (/^7\d{10}$/.test(cleaned)) {
    return `+${cleaned}`;
  }

  return cleaned;
};
