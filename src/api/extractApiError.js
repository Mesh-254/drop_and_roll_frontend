/**
 * extractApiError — the message the server actually sent, or a fallback.
 *
 * Written because of a reported dead end (12 Aug 2026). Submitting a resumed
 * draft returned:
 *
 *   400 {"duplicate_policy": ["This file contains rows you have already booked.
 *                             Choose skip or book_again explicitly."]}
 *
 * The caller read `err.response.data.detail`, which a DRF FIELD error does not
 * have, so the only sentence explaining what was wrong was thrown away and
 * replaced with "Could not submit this upload. Please try again." — an
 * instruction to retry an action that could not succeed until something changed.
 *
 * DRF has two error shapes and both are common:
 *   { "detail": "..." }                 APIException, permissions, 404, throttling
 *   { "<field>": ["...", "..."] }       serializer / validation errors
 *
 * So: `detail` first, then the first message of the first field, then the
 * caller's fallback. `non_field_errors` is preferred over an arbitrary field
 * when present, because it is the one that describes the request as a whole.
 */
export function extractApiError(err, fallback = "Something went wrong. Please try again.") {
  const data = err?.response?.data;

  if (typeof data === "string" && data.trim() && !data.trim().startsWith("<")) {
    return data.trim();
  }
  if (!data || typeof data !== "object") return fallback;

  if (typeof data.detail === "string" && data.detail) return data.detail;

  const first = (value) => {
    if (typeof value === "string") return value;
    if (Array.isArray(value)) {
      for (const item of value) {
        const found = first(item);
        if (found) return found;
      }
    }
    return null;
  };

  const keys = Object.keys(data);
  const ordered = keys.includes("non_field_errors")
    ? ["non_field_errors", ...keys.filter((k) => k !== "non_field_errors")]
    : keys;

  for (const key of ordered) {
    const message = first(data[key]);
    if (message) return message;
  }

  return fallback;
}

export default extractApiError;
