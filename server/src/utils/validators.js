/**
 * Validation and Normalization Utilities for NOAH GAMING
 * Enforces strict email and mobile standards across Customer, Front Desk, and Admin flows.
 */

/**
 * Normalize phone number:
 * - Strips all non-digit characters
 * - Handles Indian country code +91 or 91 prefix (12 digits -> 10 digits)
 * - Handles trunk prefix 0 (11 digits -> 10 digits)
 * @param {string} phone
 * @returns {string} 10-digit normalized phone string
 */
export function normalizePhone(phone) {
  if (!phone) return '';
  const digits = String(phone).replace(/\D/g, '');
  if (digits.length === 12 && digits.startsWith('91')) {
    return digits.slice(2);
  }
  if (digits.length === 11 && digits.startsWith('0')) {
    return digits.slice(1);
  }
  return digits;
}

/**
 * Check if phone number is a valid 10-digit mobile number starting with 6, 7, 8, or 9
 * @param {string} phone
 * @returns {boolean}
 */
export function isValidIndianPhone(phone) {
  const normalized = normalizePhone(phone);
  return /^[6-9]\d{9}$/.test(normalized);
}

/**
 * Normalize email:
 * - Trim whitespace
 * - Lowercase
 * @param {string} email
 * @returns {string}
 */
export function normalizeEmail(email) {
  if (!email) return '';
  return String(email).trim().toLowerCase();
}

/**
 * Standard RFC-compliant email regex
 */
const EMAIL_REGEX = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;

/**
 * Check if string is a valid email format
 * @param {string} email
 * @returns {boolean}
 */
export function isValidEmail(email) {
  if (!email) return false;
  const clean = normalizeEmail(email);
  if (clean.length < 5 || clean.length > 254) return false;
  if (!EMAIL_REGEX.test(clean)) return false;
  const parts = clean.split('@');
  if (parts.length !== 2) return false;
  const [, domain] = parts;
  if (!domain.includes('.')) return false;
  const tld = domain.split('.').pop();
  return tld.length >= 2;
}

/**
 * Check if email is an auto-generated or placeholder/fake address
 * @param {string} email
 * @returns {boolean}
 */
export function isPlaceholderEmail(email) {
  if (!email) return true;
  const clean = normalizeEmail(email);
  const [localPart = '', domain = ''] = clean.split('@');

  const blockedDomains = [
    'gaminglounge.local',
    'example.com',
    'test.com',
    'fake.com',
    'dummy.com',
    'temp.com',
    'none.com',
    'mailinator.com',
    'throwaway.com',
    'tempmail.com',
  ];

  if (blockedDomains.includes(domain)) return true;
  if (localPart.startsWith('guest.') || localPart.startsWith('walkin_')) return true;

  const blockedLocals = ['none', 'dummy', 'fake', 'test', 'noemail', 'placeholder', 'temp', 'null', 'undefined'];
  if (blockedLocals.includes(localPart)) return true;

  return false;
}
