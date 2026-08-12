/**
 * utils/bulkReview.js
 * ══════════════════════════════════════════════════════════════════════════════
 * The two decisions the batch Review screen makes that are not rendering.
 *
 * Both are same-input-same-output: a row shape in, a row shape out; a batch
 * status in, a destination out. They lived inside the component, which is how
 * they went untested against the API's real payloads for as long as they did.
 *
 * ── What each one is for ─────────────────────────────────────────────────────
 *
 * `normaliseFailedRow` — GET /bulk-uploads/{id}/errors/ serves `row_reference`
 * and an `errors` LIST (one entry per bad column, each with its own message,
 * code and suggested fix). The Review screen read `r.reference` and
 * `r.error_message`, neither of which the endpoint sends, so every failed row
 * rendered as a bare "Row 12" with an empty reason underneath it — on the one
 * screen whose job is to say WHY rows failed before the customer is billed.
 *
 * `resolveDone` — POST /bulk-uploads/{id}/continue/ 409s any batch that is not
 * awaiting_review. A customer reaches that state by opening a bookmark, using
 * the back button, or letting the wizard continue in another tab. None of those
 * is an error and all of them used to produce a red toast reading "This batch is
 * not awaiting review." on a screen with nothing else on it. This maps the batch
 * status to the place the customer actually needs to be.
 */

/**
 * One failed row, flattened to what the Review screen renders.
 *
 * Accepts BOTH the API's `errors` list and the flat `error_message` shape,
 * because more than one screen reads this endpoint and a row rendering blank is
 * a worse failure than a row rendering twice.
 *
 * `reason` is deliberately ONE line: this is a triage list, not a report. The
 * remaining problems are counted rather than listed, and the full diagnostic
 * file is one click away in the footer. `reason` is never empty.
 *
 * @param {object} r  a row from GET /bulk-uploads/{id}/errors/
 * @returns {{rowNumber:number, reference:string, reason:string, extra:number,
 *            column:string, fix:string}}
 */
export function normaliseFailedRow(r) {
  const errors = Array.isArray(r.errors) ? r.errors : [];
  const messages = errors.length
    ? errors
        .map((e) => (typeof e === "string" ? e : e?.error_message))
        .filter(Boolean)
    : [
        r.error_message,
        ...(Array.isArray(r.error_messages) ? r.error_messages : []),
      ]
        .filter(Boolean)
        .map((m) => (typeof m === "string" ? m : m?.message))
        .filter(Boolean);

  const reason =
    messages[0] ||
    "This row could not be booked. Download the error report for the full detail.";
  const extra = messages.length - 1;
  const first = errors[0] && typeof errors[0] === "object" ? errors[0] : null;

  return {
    rowNumber: r.row_number,
    reference: r.row_reference || r.reference || "",
    reason,
    // "and 2 more problems" beats silently dropping them: a row with four bad
    // columns and a row with one look identical otherwise, and they are not.
    extra: extra > 0 ? extra : 0,
    // The column that failed, when the API could attribute it. A message on its
    // own often does not say where to look in a 30-column spreadsheet.
    column: first ? first.column_name || "" : "",
    fix: (first ? first.suggested_fix : "") || r.suggested_fix || "",
  };
}

/**
 * Where a batch that is no longer awaiting review should send the customer.
 *
 * Returns null while the batch IS awaiting review — the only state in which the
 * Review screen's Continue button is the right answer. Every other status gets
 * a headline and exactly one door.
 *
 * @param {object|null} upload
 * @returns {{headline:string, cta:string, to:string, money?:boolean}|null}
 */
export function resolveDone(upload) {
  if (!upload || upload.status === "awaiting_review") return null;

  const isNet = upload.payment_path === "net";
  switch (upload.status) {
    case "payment_pending":
      return isNet
        ? {
            headline: "This batch has been invoiced.",
            cta: "View invoice",
            to: "/billing",
          }
        : {
            headline: "This batch is confirmed and waiting on payment.",
            cta: "Complete payment",
            to: `/pay/bulk/${upload.id}`,
            money: true,
          };
    case "completed":
    case "partial":
      return isNet
        ? {
            headline: "This batch has been invoiced and scheduled.",
            cta: "View invoice",
            to: "/billing",
          }
        : {
            headline:
              "This batch is paid and scheduled. Nothing further is needed.",
            cta: "View batch",
            to: `/bulk-upload/${upload.id}`,
          };
    case "pending":
    case "processing":
      return {
        headline: "This batch is still processing.",
        cta: "View progress",
        to: `/bulk-upload/${upload.id}`,
      };
    case "failed":
    case "cancelled":
      return {
        headline:
          "This batch did not finish processing, so nothing was booked or charged.",
        cta: "Back to uploads",
        to: "/bulk-upload",
      };
    default:
      return {
        headline: "This batch has already moved on from review.",
        cta: "View batch",
        to: `/bulk-upload/${upload.id}`,
      };
  }
}
