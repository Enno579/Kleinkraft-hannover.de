/** International phone check for contact leads. Digits only after stripping separators. */

const PHONE_CHARS = /^[+0-9()/\.\-\s]+$/;

export function digitsOnly(raw: string): string {
  return raw.replace(/\D/g, '');
}

export function isValidPhone(raw: unknown): boolean {
  if (typeof raw !== 'string') return false;
  const s = raw.trim();
  if (!s || s.length > 40) return false;
  if (!PHONE_CHARS.test(s)) return false;
  const digits = digitsOnly(s);
  return digits.length >= 8 && digits.length <= 15;
}
