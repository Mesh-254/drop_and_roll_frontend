/* eslint-env jest */
// Where the wizard goes when processing finishes.
//
// THE BUG THIS FILE EXISTS FOR. deriveStatus had no case for `awaiting_review`,
// so it fell through to its default and returned "processing". The batch was
// finished, the bar read 100%, and the screen still said "Processing your
// batch / Please wait while we process your bookings…" with a Close button as
// the only way out. The Review screen existed and was reachable only from the
// dashboard; the wizard never went there.
//
// Pinned here:
//   1. awaiting_review is its own status, not a synonym for processing.
//   2. `partial` stays a terminal success -- it is a NET batch with some failed
//      rows, and treating it as processing got the UI stuck once already.
//   3. There is a fifth step, and it is where every finished batch lands.
//   4. A batch still working stays on Processing.

import { STEPS, deriveStatus, stepForStatus } from "./bulkUploadSteps";

// ── deriveStatus ─────────────────────────────────────────────────────────────

test("awaiting_review is its own status", () => {
  expect(deriveStatus({ status: "awaiting_review" }, false)).toBe("awaiting_review");
});

test("awaiting_review is not reported as processing", () => {
  // The whole defect in one assertion.
  expect(deriveStatus({ status: "awaiting_review" }, true)).not.toBe("processing");
});

test.each([
  ["completed", "completed"],
  ["partial", "completed"],
  ["failed", "failed"],
  ["payment_pending", "payment_pending"],
  ["processing", "processing"],
  ["pending", "processing"],
])("%s derives as %s", (status, expected) => {
  expect(deriveStatus({ status }, false)).toBe(expected);
});

test("case is ignored, because the server is not the only caller", () => {
  expect(deriveStatus({ status: "AWAITING_REVIEW" }, false)).toBe("awaiting_review");
});

test("no upload yet means processing only while polling", () => {
  expect(deriveStatus(null, true)).toBe("processing");
  expect(deriveStatus(null, false)).toBeNull();
});

// ── The steps ────────────────────────────────────────────────────────────────

test("there are five steps and the last is Review", () => {
  expect(STEPS).toHaveLength(5);
  expect(STEPS[4].label).toBe("Review");
});

test("Processing is no longer the final step", () => {
  expect(STEPS[STEPS.length - 1].label).not.toBe("Processing");
});

// ── Where each status lands ──────────────────────────────────────────────────

test.each(["awaiting_review", "completed", "failed"])(
  "%s lands on the Review step",
  (status) => {
    expect(stepForStatus(status)).toBe(4);
  },
);

test("payment_pending stays on Processing, because it navigates to checkout", () => {
  // Prepaid auto-navigates to /pay/bulk/:id from step 3. Moving it to Review
  // first would put a screen between the customer and a payment they have
  // already agreed to make.
  expect(stepForStatus("payment_pending")).toBeNull();
});

test("a batch still working does not move", () => {
  expect(stepForStatus("processing")).toBeNull();
  expect(stepForStatus(null)).toBeNull();
});
