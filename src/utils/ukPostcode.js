/**
 * utils/ukPostcode.js
 * ════════════════════════════════════════════════════════════════════════
 * Progressive UK-postcode shape matching for the postcode-ONLY address
 * search (spec §A). Address lookup is restricted to postcode-pattern
 * queries on BOTH providers — free-text/name queries must never reach the
 * metered Ideal Postcodes proxy or the Google fallback.
 *
 * Mirrors looks_like_postcode_query() in
 * backend bookings/utils/postcode_lookup.py — keep the two in sync.
 *
 * Progressive means "could still become a valid postcode as the user
 * types": an outward code in progress ("MK9", "OX49", "W1A") or a partial/
 * complete inward code following it ("MK9 1", "MK9 1A", "MK9 1AA").
 * Letters alone ("MK") don't trigger a search yet — no digit means the
 * whole area would match, which is a wasteful, meaningless query.
 */

// Outward code (area letters + district digit(s) + optional letter), then
// optionally a partial or complete inward code (digit + up to two letters).
const PARTIAL_POSTCODE_RE = /^[A-Z]{1,2}[0-9][A-Z0-9]?\s*(?:[0-9][A-Z]{0,2})?$/i;

// A complete UK postcode: outward + full inward (digit + two letters).
const FULL_POSTCODE_RE = /^[A-Z]{1,2}[0-9][A-Z0-9]?\s*[0-9][A-Z]{2}$/i;

/** True if `query` is a partial or complete UK postcode worth searching. */
export function isPostcodeQuery(query) {
  return PARTIAL_POSTCODE_RE.test((query || "").trim());
}

/** True if `query` is a complete UK postcode (e.g. "MK9 1AA" / "mk91aa"). */
export function isFullPostcode(query) {
  return FULL_POSTCODE_RE.test((query || "").trim());
}

/** Normalize to canonical display form: uppercase, single space before the
 *  3-character inward code ("mk91aa" → "MK9 1AA"). Returns the input
 *  unchanged (trimmed/uppercased) when it isn't a full postcode yet. */
export function formatPostcode(query) {
  const raw = (query || "").trim().toUpperCase().replace(/\s+/g, "");
  if (!FULL_POSTCODE_RE.test(raw)) return (query || "").trim().toUpperCase();
  return `${raw.slice(0, -3)} ${raw.slice(-3)}`;
}
