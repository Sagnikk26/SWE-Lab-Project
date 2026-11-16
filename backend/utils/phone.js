/**
 * Phone number validation & normalization utility.
 *
 * Accepted formats:
 * - Plain 10-digit number (spaces/hyphens allowed within digits, e.g. "9876543210", "98765 43210", "98765-43210")
 * - Optional leading "+" with 1-3 digit country code, a mandatory space or hyphen separator,
 *   and strictly 10 local digits (e.g. "+91 9876543210", "+91 98765 43210", "+1-415-555-2671").
 *
 * Rejected formats:
 * - Unspaced numbers with more than 10 digits (e.g. "987654321012345", "+919876543210")
 * - Country codes without a leading "+" (e.g. "91 9876543210")
 * - Local part after country code having anything other than 10 digits (e.g. "+91 987654321", "+91 98765432101")
 */
const PHONE_REGEX = /^(?:\+[0-9]{1,3}(?:\s+|-))?[0-9](?:[\s-]?[0-9]){9}$/;

const PHONE_ERROR_MESSAGE =
  'Please provide a valid 10 digit phone number (e.g. 9876543210 or +91 9876543210).';

/**
 * Validates and normalizes a phone number string.
 * Preserves a single space after "+<countryCode>" when a country code is present,
 * and removes formatting spaces/hyphens inside the 10-digit main number.
 *
 * @param {unknown} value
 * @returns {{ valid: true, normalized: string } | { valid: false, error: string }}
 */
const validateAndNormalizePhone = (value) => {
  if (typeof value !== 'string') {
    return { valid: false, error: PHONE_ERROR_MESSAGE };
  }

  const trimmed = value.trim();
  if (!PHONE_REGEX.test(trimmed)) {
    return { valid: false, error: PHONE_ERROR_MESSAGE };
  }

  const ccMatch = trimmed.match(/^\+([0-9]{1,3})(?:\s+|-)(.+)$/);
  if (ccMatch) {
    const localDigits = ccMatch[2].replace(/[\s-]/g, '');
    return { valid: true, normalized: `+${ccMatch[1]} ${localDigits}` };
  }

  return { valid: true, normalized: trimmed.replace(/[\s-]/g, '') };
};

module.exports = {
  PHONE_REGEX,
  PHONE_ERROR_MESSAGE,
  validateAndNormalizePhone,
};
