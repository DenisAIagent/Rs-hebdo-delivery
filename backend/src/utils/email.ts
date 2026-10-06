const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_EMAIL_LENGTH = 254;

/** Adresse email nettoyee (espaces, minuscules), ou null si elle est invalide. */
export function normalizeEmail(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const email = raw.trim().toLowerCase();
  if (email.length > MAX_EMAIL_LENGTH || !EMAIL_RE.test(email)) return null;
  return email;
}
