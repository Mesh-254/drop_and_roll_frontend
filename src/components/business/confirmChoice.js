/**
 * confirmChoice — the rules behind "What is this upload?", as three pure functions.
 *
 * Two screens ask this question: the wizard's Review & Confirm step, and the
 * "Not Submitted Yet" banner on the detail page, which rescues a draft whose tab
 * was closed. Same question, same money at stake, so the rules live here rather
 * than twice in JSX. Same input, same output — nothing here belongs in a
 * component.
 *
 * WHY THE QUESTION IS DECLARED AND NOT INFERRED. Nothing in a file distinguishes
 * "I fixed the six bad rows" from "this is next week's run of the same route".
 * The template has no date column, so a weekly repeat is byte-identical to a
 * corrections re-upload. The customer knows which it is, so they are asked.
 *
 * WHY IT USED TO BE TWO QUESTIONS. "A new batch vs corrections" sat directly
 * above "skip them vs book them again", which is the same question in different
 * words: choosing corrections already answers skip-or-book-again. They are one
 * question now, and the answer maps to one of two wire shapes.
 */

/**
 * The kind to render as selected.
 *
 * `null` becomes "new" ONLY when the file contains nothing already booked. That
 * default cannot decide anything: with no matches, skip and book-again do the
 * same thing, so preselecting saves a click and costs nothing.
 *
 * With matches present it stays `null` and the caller's submit button stays
 * disabled. Both wrong answers cost money and only one of them is visible: a
 * needless booking shows up on an invoice, a needless skip is a parcel that
 * never ships and nobody notices. The backend refuses a submit with no answer
 * independently (400), because a disabled button is not a rule.
 */
export function resolveKind(kind, duplicateCount = 0) {
  if (kind === "new" || kind === "corrections") return kind;
  return duplicateCount > 0 ? null : "new";
}

/**
 * True while the question is unanswered — drives `disabled` on Submit.
 *
 * "Corrections to nothing" is not a declaration, so a corrections upload waits
 * for a batch to be named even though the kind itself is chosen.
 */
export function isConfirmIncomplete({ kind, correctsUpload, duplicateCount = 0 }) {
  const resolved = resolveKind(kind, duplicateCount);
  if (resolved === null) return true;
  if (resolved === "corrections") return !correctsUpload;
  return false;
}

/**
 * The extra keys to send alongside `status: "submitted"`.
 *
 * Never both: `corrects_upload` IS the answer to skip-or-book-again, and the
 * backend rejects a conflicting `duplicate_policy` sent with it rather than
 * silently preferring one.
 *
 * "A new batch" with matches present means book_again, explicitly. That is the
 * whole content of the choice the customer just made — they were told those
 * rows are already booked and that every row will be charged.
 *
 * With no matches, nothing is sent. There is nothing to have a policy about,
 * and the server default then stands for every client that never asks.
 */
export function confirmPayload({ kind, correctsUpload, duplicateCount = 0 }) {
  const resolved = resolveKind(kind, duplicateCount);
  if (resolved === "corrections" && correctsUpload) {
    return { correctsUpload };
  }
  if (resolved === "new" && duplicateCount > 0) {
    return { duplicatePolicy: "book_again" };
  }
  return {};
}
