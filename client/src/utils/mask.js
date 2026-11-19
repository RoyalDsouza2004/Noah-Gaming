/**
 * Client-side helper to mask an email address for display.
 * Retains recognition while preserving privacy.
 * Examples:
 * - r***@gmail.com
 * - ro***@yahoo.com
 * - roy***@example.com
 */
export function maskEmail(email) {
  if (!email || typeof email !== 'string' || !email.includes('@')) {
    return 'your registered email';
  }
  const [local, domain] = email.trim().toLowerCase().split('@');
  if (local.length <= 1) return `*@${domain}`;
  if (local.length === 2) return `${local[0]}***@${domain}`;
  if (local.length <= 4) return `${local.slice(0, 2)}***@${domain}`;
  return `${local.slice(0, 3)}***@${domain}`;
}
