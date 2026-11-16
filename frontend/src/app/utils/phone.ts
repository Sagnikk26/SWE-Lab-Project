import { AbstractControl, ValidationErrors } from '@angular/forms';

/**
 * Matches either:
 * - A plain 10-digit local phone number (e.g. "9876543210", "98765 43210", "98765-43210"), or
 * - A "+" country code (1-3 digits) followed by a mandatory space or hyphen separator and
 *   strictly 10 local digits (e.g. "+91 9876543210", "+91 98765 43210", "+1-415-555-2671").
 * Unspaced >10-digit strings such as "+919876543210" or "987654321012345" are rejected.
 */
export const PHONE_REGEX = /^(?:\+[0-9]{1,3}(?:\s+|-))?[0-9](?:[\s-]?[0-9]){9}$/;

export const PHONE_ERROR_MESSAGE =
  'Please enter a valid 10 digit phone number (e.g. 9876543210 or +91 9876543210).';

/**
 * Normalizes a valid phone number string, preserving a single space after
 * "+<countryCode>" when a country code is provided and stripping formatting inside the 10-digit number.
 */
export function normalizePhone(value: string): string {
  const trimmed = value.trim();
  const ccMatch = trimmed.match(/^\+([0-9]{1,3})(?:\s+|-)(.+)$/);
  if (ccMatch) {
    const localDigits = ccMatch[2].replace(/[\s-]/g, '');
    return `+${ccMatch[1]} ${localDigits}`;
  }
  return trimmed.replace(/[\s-]/g, '');
}

/**
 * Reactive Forms validator enforcing strict phone format on trimmed control values.
 * Empty values pass so Validators.required handles presence checks independently.
 */
export function phoneValidator(control: AbstractControl): ValidationErrors | null {
  const value = control.value;
  if (value === null || value === undefined || value === '') {
    return null;
  }
  const trimmed = String(value).trim();
  return trimmed && PHONE_REGEX.test(trimmed) ? null : { invalidPhone: true };
}
