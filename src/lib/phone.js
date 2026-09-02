/**
 * US phone formatting and validation for the public quote wizard.
 *
 * No library and no lookup table — just the North American Numbering Plan's
 * two structural rules, which are enough to reject the placeholders people
 * actually type (0000000000, 1111111111, 1234567890) without rejecting any
 * real US number:
 *
 *   - exactly 10 digits, or 11 when the extra leading digit is the country
 *     code 1
 *   - the area code and the exchange code both start with 2-9
 *
 * The phone is the only field that lets the shop answer at all, so it is
 * worth getting right; it is also the field people type fastest on a phone
 * keypad, so formatting happens as they type and errors are held back until
 * they leave the field.
 */

/** Digits only, with a leading country-code 1 dropped. */
export function normalizePhoneDigits(value) {
  let digits = String(value || "").replace(/\D/g, "");
  if (digits.length === 11 && digits.startsWith("1")) digits = digits.slice(1);
  return digits.slice(0, 10);
}

/**
 * Progressive display format: "7", "(786", "(786) 79", "(786) 793-7665".
 * Never fights the caret by reformatting into something shorter than what
 * was typed.
 */
export function formatPhone(value) {
  const d = normalizePhoneDigits(value);
  if (d.length === 0) return "";
  if (d.length <= 3) return `(${d}`;
  if (d.length <= 6) return `(${d.slice(0, 3)}) ${d.slice(3)}`;
  return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`;
}

/** True when the digits form a structurally valid US number. */
export function isValidUsPhone(value) {
  const d = normalizePhoneDigits(value);
  if (d.length !== 10) return false;
  // NANP: area code and exchange code both start 2-9.
  if (!/^[2-9]/.test(d)) return false;
  if (!/^[2-9]/.test(d.slice(3))) return false;
  return true;
}

/** Empty is "not yet answered", not "wrong" — the step gate handles required-ness. */
export function phoneErrorKey(value) {
  const raw = String(value || "").trim();
  if (!raw) return null;
  return isValidUsPhone(raw) ? null : "wizard.fields.phoneError";
}
