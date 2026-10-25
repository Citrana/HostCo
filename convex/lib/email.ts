// Deliberately loose: one @, something on each side, a dot in the domain.
const EMAIL_SHAPE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

export function isEmail(email: string) {
  return EMAIL_SHAPE.test(email);
}
