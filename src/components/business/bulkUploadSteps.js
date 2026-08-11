/**
 * The wizard's step list and the status logic that drives it.
 *
 * Its own module rather than exports hanging off BulkUploadFlow.jsx: mixing
 * component and non-component exports breaks fast refresh, and pure logic that
 * decides where a customer's batch goes deserves to be testable without
 * mounting a 900-line component behind five hooks.
 */

export const STEPS = [
  { label: "Upload File" },
  { label: "Batch Details" },
  { label: "Review & Confirm" },
  { label: "Processing" },
  // Results. Processing used to be the end of the wizard, so a finished batch
  // sat on "Please wait while we process your bookings…" with a Close button as
  // the only way out, while the Review screen existed and was reachable only
  // from the dashboard.
  { label: "Review" },
];

export const REVIEW_STEP = 4;

/**
 * Collapse the server's status into what the wizard needs to render.
 *
 * `partial` is a terminal success: a NET batch with some failed rows is
 * finished, and reporting it as processing got the UI stuck once already.
 */
export function deriveStatus(latestUpload, isPolling) {
  if (!latestUpload) return isPolling ? "processing" : null;
  const s = latestUpload.status?.toLowerCase();
  // Its own state, NOT a synonym for processing. Without this case it fell
  // through to the default below, and the wizard reported a finished batch as
  // still working, forever.
  if (s === "awaiting_review") return "awaiting_review";
  if (s === "payment_pending") return "payment_pending";
  if (s === "completed") return "completed";
  if (s === "partial") return "completed";
  if (s === "failed") return "failed";
  return "processing";
}

/**
 * Which step a derived status belongs on, or null to stay put.
 *
 * payment_pending deliberately does NOT move: prepaid auto-navigates from the
 * processing step to /pay/bulk/:id, and interposing the Review screen would put
 * a page between the customer and a payment they have already agreed to make.
 */
export function stepForStatus(status) {
  if (status === "awaiting_review" || status === "completed" || status === "failed") {
    return REVIEW_STEP;
  }
  return null;
}
