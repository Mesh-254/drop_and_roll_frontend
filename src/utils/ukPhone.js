/**
 * UK phone number validation — frontend mirror of
 * drop_and_roll_backend/bookings/validators.py (keep the two in sync).
 *
 * Digit-count rules per prefix (national form):
 *   07…  mobiles   — exactly 11 digits
 *   02…  landlines — exactly 11 digits
 *   03…  non-geo   — exactly 11 digits
 *   01…  landlines — 10 or 11 digits
 * International form: +44 / 44 followed by the national number without its
 * leading 0. Spaces, dashes, dots and parentheses are ignored.
 */

export const UK_PHONE_ERROR =
  "Enter a valid UK phone number, e.g. 07123 456789 or +44 7123 456789";

/**
 * @param {string} raw
 * @returns {string|null} national-form number ("07123456789") or null if invalid
 */
function toNationalForm(raw) {
  const cleaned = String(raw || "").replace(/[\s\-.()]/g, "");
  let national = null;
  if (cleaned.startsWith("+44")) national = "0" + cleaned.slice(3);
  else if (cleaned.startsWith("44") && cleaned.length >= 12)
    national = "0" + cleaned.slice(2);
  else if (cleaned.startsWith("0")) national = cleaned;
  if (!national || !/^\d+$/.test(national)) return null;
  const prefix = national.slice(0, 2);
  if (prefix === "07" || prefix === "02" || prefix === "03") {
    return national.length === 11 ? national : null;
  }
  if (prefix === "01") {
    return national.length === 10 || national.length === 11 ? national : null;
  }
  return null;
}

/** @returns {boolean} */
export function isValidUkPhone(raw) {
  return toNationalForm(raw) !== null;
}

/** Normalize to E.164 (+447123456789); returns null when invalid. */
export function normalizeUkPhone(raw) {
  const national = toNationalForm(raw);
  return national ? "+44" + national.slice(1) : null;
}
