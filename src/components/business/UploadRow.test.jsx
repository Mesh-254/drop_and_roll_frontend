// Behaviour tests for the NET-terms inline "Pay now" action on the bulk
// dashboard row (spec §C):
//   • prepaid + payment_pending  → "Pay"      → navigates /pay/bulk/:id
//   • NET + payable invoice      → "Pay now"  → navigates /invoices/:rid?action=pay
//   • NET + partial payment      → "Pay now"  → shows the REMAINING balance
//   • fully paid                 → "Settled", no pay control
//   • prepaid completed          → "Settled", no pay control
//
// 2026-07-30: the row no longer decides payability from `receivable_status`. It
// renders the server's `receivable_is_payable`, which comes from
// Receivable.is_payable — the same property guarding pay-via-gateway.
//
// The test that used to live here, "NET invoice still in draft shows no pay
// control (backend would reject it)", asserted the production bug as if it were
// the spec: the backend had been widened to accept DRAFT, so a DRAFT invoice
// with £16.00 owed was payable by the API while this row hid the button. The
// draft cases below now pin the corrected behaviour, and one case pins the
// stale-API path (flag absent ⇒ no button) so a frontend deployed ahead of the
// backend degrades to "use /billing" instead of a button that 400s.

import { render, screen, fireEvent } from "@testing-library/react";

const mockNavigate = jest.fn();
jest.mock("react-router-dom", () => ({
  useNavigate: () => mockNavigate,
}));

// framer-motion → plain host elements, preserving the tag (motion.button →
// <button>) so ARIA roles survive, and stripping animation-only props.
jest.mock("framer-motion", () => ({
  motion: new Proxy(
    {},
    {
      get: (_target, tag) => ({ children, ...props }) => {
        const React = require("react");
        for (const k of ["whileHover", "whileTap", "initial", "animate", "transition", "exit", "variants", "layout"]) {
          delete props[k];
        }
        return React.createElement(String(tag), props, children);
      },
    },
  ),
}));

import { UploadRow } from "./BulkUploadDashboard";

const baseUpload = {
  id: "up-1",
  batch_name: "March batch",
  status: "completed",
  payment_path: "net",
  total_rows: 10,
  successful: 10,
  failed: 0,
  computed_total: "500.00",
  created_at: new Date().toISOString(),
  receivable_id: null,
  outstanding: null,
  receivable_status: null,
  receivable_is_payable: false,
};

function renderRow(overrides = {}) {
  const onViewDetail = jest.fn();
  const onReupload = jest.fn();
  const { container } = render(
    <UploadRow upload={{ ...baseUpload, ...overrides }} onViewDetail={onViewDetail} onReupload={onReupload} />,
  );
  return { onViewDetail, onReupload, container };
}

beforeEach(() => mockNavigate.mockClear());

test("prepaid payment_pending shows Pay → /pay/bulk/:id", () => {
  renderRow({ payment_path: "prepaid", status: "payment_pending" });
  const btn = screen.getByRole("button", { name: /^Pay$/i });
  fireEvent.click(btn);
  expect(mockNavigate).toHaveBeenCalledWith("/pay/bulk/up-1");
});

test("NET upload with outstanding balance shows Pay now → invoice pay route", () => {
  renderRow({
    receivable_id: "rec-9",
    outstanding: "500.00",
    receivable_status: "issued",
    receivable_is_payable: true,
  });
  const btn = screen.getByRole("button", { name: /Pay now/i });
  fireEvent.click(btn);
  expect(mockNavigate).toHaveBeenCalledWith("/invoices/rec-9?action=pay");
});

test("NET partial payment surfaces the remaining balance, not just the total", () => {
  // The row now renders both halves (bulkMoney.js): a part-paid invoice has to
  // say what was received AND what is still owed, because either figure alone
  // is a number the customer cannot act on. `receivable_amount` and
  // `receivable_paid_amount` are served alongside `outstanding` now.
  renderRow({
    receivable_id: "rec-9",
    receivable_amount: "500.00",
    receivable_paid_amount: "200.00",
    outstanding: "300.00",
    receivable_status: "partial",
    receivable_is_payable: true,
  });
  expect(screen.getByText(/£300\.00 outstanding/)).toBeInTheDocument();
  expect(screen.getByText(/£200\.00 paid/)).toBeInTheDocument();
  expect(screen.getByRole("button", { name: /Pay now/i })).toBeInTheDocument();
});

// ── The production regression ───────────────────────────────────────────────

test("DRAFT invoice with a balance shows Pay now (the prod bug: £16.00 owed, View only)", () => {
  renderRow({
    receivable_id: "rec-16",
    receivable_amount: "16.00",
    receivable_paid_amount: "0.00",
    outstanding: "16.00",
    receivable_status: "draft",
    receivable_is_payable: true,
  });
  expect(screen.getByText(/£16\.00 due/)).toBeInTheDocument();
  const btn = screen.getByRole("button", { name: /Pay now/i });
  fireEvent.click(btn);
  expect(mockNavigate).toHaveBeenCalledWith("/invoices/rec-16?action=pay");
});

test("row ignores receivable_status entirely and follows the served flag", () => {
  // A status the row's old whitelist would have accepted, with the server saying
  // it is not payable (e.g. the balance was cleared by a bank transfer). The
  // button must not appear: the server is the authority, not the status string.
  renderRow({
    receivable_id: "rec-9",
    outstanding: "0.00",
    receivable_status: "issued",
    receivable_is_payable: false,
  });
  expect(screen.queryByRole("button", { name: /Pay now/i })).not.toBeInTheDocument();
});

test("absent flag (frontend deployed ahead of backend) hides the button rather than showing a dead one", () => {
  renderRow({
    receivable_id: "rec-9",
    outstanding: "500.00",
    receivable_status: "issued",
    receivable_is_payable: undefined, // what an older API returns: no such field
  });
  expect(screen.queryByRole("button", { name: /Pay now/i })).not.toBeInTheDocument();
});

test("fully paid NET invoice shows Settled and no pay control", () => {
  renderRow({
    receivable_id: "rec-9",
    outstanding: "0.00",
    receivable_status: "paid",
    receivable_is_payable: false,
  });
  expect(screen.getByText(/Settled/i)).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: /Pay/i })).not.toBeInTheDocument();
});

test("prepaid completed upload shows Settled, no pay control", () => {
  renderRow({ payment_path: "prepaid", status: "completed" });
  expect(screen.getByText(/Settled/i)).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: /Pay/i })).not.toBeInTheDocument();
});

// ── Terminal-failure states (reaper output): failed / cancelled ──────────────

test("failed upload shows a static state, not a stuck '% complete' bar", () => {
  renderRow({ status: "failed", total_rows: 0, successful: 0, failed: 0 });
  expect(screen.getByText(/Didn't finish processing/i)).toBeInTheDocument();
  // The misleading "0% complete" progress label must be gone.
  expect(screen.queryByText(/% complete/i)).not.toBeInTheDocument();
});

test("cancelled (abandoned draft) shows 'Never submitted', not a progress bar", () => {
  renderRow({ status: "cancelled", total_rows: 0, successful: 0, failed: 0 });
  expect(screen.getByText(/Never submitted/i)).toBeInTheDocument();
  expect(screen.queryByText(/% complete/i)).not.toBeInTheDocument();
});

test("failed upload exposes a Retry action that calls onReupload", () => {
  // Renamed from "Re-upload": the brief calls this Retry, and the word matters
  // because the customer is resuming a batch they already have, not starting
  // an unrelated one.
  const { onReupload } = renderRow({ status: "failed", total_rows: 0 });
  const btn = screen.getByRole("button", { name: /Retry/i });
  fireEvent.click(btn);
  expect(onReupload).toHaveBeenCalledTimes(1);
});

test("non-terminal upload still shows the progress bar", () => {
  renderRow({ status: "processing", total_rows: 10, successful: 5, failed: 0, progress_pct: 50 });
  // "% processed", not "% complete": while a batch is running the bar tracks
  // lifecycle, and only once it stops does the row report the outcome.
  expect(screen.getByText(/% processed/i)).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: /Retry/i })).not.toBeInTheDocument();
});

// ─── Task 10: the action a row offers ────────────────────────────────────────
//
// The dashboard is where an abandoned upload has to be recoverable, so the
// button it shows is the whole feature. Before this there was no Retry branch
// at all: a failed batch rendered View and nothing else, and the bar under a
// finished batch showed its SUCCESS RATE under the words "% complete" — a
// 43-row batch with 13 successes read "30% complete" forever.

test("a finished batch does not describe its success rate as completion", () => {
  renderRow({ status: "partial", total_rows: 43, successful: 13, failed: 30 });

  expect(screen.queryByText(/30% complete/)).not.toBeInTheDocument();
  expect(screen.getByText("13 of 43 succeeded")).toBeInTheDocument();
});

test("a processing batch shows lifecycle progress, not outcome", () => {
  renderRow({ status: "processing", total_rows: 43, successful: 4, progress_pct: 40 });

  expect(screen.getByText("40% processed")).toBeInTheDocument();
});

test("a batch awaiting review offers Review and never Pay", () => {
  renderRow({ status: "awaiting_review", successful: 13, total_rows: 43 });

  expect(screen.getByRole("button", { name: /review/i })).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: /^pay/i })).not.toBeInTheDocument();
});

test("a failed batch offers Retry and never Pay", () => {
  renderRow({ status: "failed", successful: 0, failed: 10, total_rows: 10 });

  expect(screen.getByRole("button", { name: /retry/i })).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: /^pay/i })).not.toBeInTheDocument();
});

test("an abandoned prepaid batch still offers Pay", () => {
  renderRow({
    status: "payment_pending",
    payment_path: "prepaid",
    successful: 13,
    total_rows: 43,
    outstanding: "423.43",
  });

  expect(screen.getByRole("button", { name: /pay/i })).toBeInTheDocument();
});

// ── Resumability: every non-terminal batch needs a way back in ───────────────
//
// Closing the tab mid-processing used to leave the read-only detail drawer as
// the only action, and a never-submitted draft was indistinguishable from a
// batch queued behind a busy worker. That second one had already been
// misdiagnosed once as a dead Celery worker, when the truth was that nobody had
// ever pressed submit.

test("a processing batch offers a way back into the progress view", () => {
  renderRow({ status: "processing", is_draft: false, progress_pct: 23 });
  expect(screen.getByRole("button", { name: /view progress/i })).toBeInTheDocument();
});

test("a processing batch shows its live percentage", () => {
  renderRow({ status: "processing", is_draft: false, progress_pct: 23 });
  expect(screen.getByText(/23%/)).toBeInTheDocument();
});

test("view progress navigates back into the batch", () => {
  renderRow({ status: "processing", is_draft: false, progress_pct: 5 });
  fireEvent.click(screen.getByRole("button", { name: /view progress/i }));
  expect(mockNavigate).toHaveBeenCalledWith(expect.stringContaining("up-1"));
});

test("a never-submitted draft says so and offers to continue setup", () => {
  renderRow({ status: "pending", is_draft: true, successful: 0, failed: 0 });
  expect(screen.getByRole("button", { name: /continue setup/i })).toBeInTheDocument();
  expect(screen.getByText(/not submitted/i)).toBeInTheDocument();
});

test("a dispatched batch reads as queued, not as a draft", () => {
  renderRow({ status: "pending", is_draft: false, successful: 0, failed: 0 });
  expect(screen.queryByRole("button", { name: /continue setup/i })).not.toBeInTheDocument();
  expect(screen.getByText(/queued/i)).toBeInTheDocument();
});

test("a draft offers no progress view, because there is no progress", () => {
  renderRow({ status: "pending", is_draft: true, successful: 0, failed: 0 });
  expect(screen.queryByRole("button", { name: /view progress/i })).not.toBeInTheDocument();
});

test("awaiting_review offers Review and never Pay", () => {
  renderRow({ status: "awaiting_review", successful: 12, failed: 30, receivable_is_payable: false });
  expect(screen.getByRole("button", { name: /^review$/i })).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: /pay/i })).not.toBeInTheDocument();
});

test.each([
  ["pending-draft", { status: "pending", is_draft: true }],
  ["pending-queued", { status: "pending", is_draft: false }],
  ["processing", { status: "processing", is_draft: false }],
  ["awaiting_review", { status: "awaiting_review", successful: 1 }],
])("%s has at least one action", (_name, overrides) => {
  renderRow({ ...overrides, successful: overrides.successful ?? 0, failed: 0 });
  expect(screen.getAllByRole("button").length).toBeGreaterThan(0);
});

// ── ONE debt, ONE button (pay_action) ───────────────────────────────────────
//
// The reported bug: a prepaid batch rendered "Pay" AND "Pay now" on the same
// row. Both were reachable, both opened a checkout, and each opened its own
// PaymentTransaction against the same £392.97.
//
// Neither boolean was wrong on its own. `receivable_is_payable` never asked "is
// this NET" — it asks "does this batch have a payable invoice", and prepaid
// batches gained one when `ensure_prepaid_receivable` began raising a proforma
// at the review gate so that money owed would be visible in Billing before it
// was paid. Two correct predicates, one debt, two buttons.
//
// `pay_action` is now computed server-side and is the only input to this
// decision. The rows below pin that, and the fallback (field absent) is pinned
// by every test above, all of which omit it.

test("a prepaid batch with a payable proforma shows ONE pay button, not two", () => {
  renderRow({
    payment_path: "prepaid",
    status: "payment_pending",
    pay_action: "prepaid",
    // The proforma is real and IS payable — that is not the bug, and the field
    // stays honest. What changed is that the row no longer reads it.
    receivable_id: "rec-1",
    outstanding: "392.97",
    receivable_status: "issued",
    receivable_is_payable: true,
  });

  expect(screen.getAllByRole("button", { name: /^pay/i })).toHaveLength(1);
  expect(screen.queryByRole("button", { name: /pay now/i })).not.toBeInTheDocument();
});

test("that one button is the batch checkout, which is what the email links to", () => {
  renderRow({
    payment_path: "prepaid",
    status: "payment_pending",
    pay_action: "prepaid",
    receivable_id: "rec-1",
    outstanding: "392.97",
    receivable_is_payable: true,
  });

  fireEvent.click(screen.getByRole("button", { name: /^Pay$/i }));
  expect(mockNavigate).toHaveBeenCalledWith("/pay/bulk/up-1");
});

test("a NET batch is sent to its invoice", () => {
  renderRow({
    payment_path: "net",
    status: "completed",
    pay_action: "invoice",
    receivable_id: "rec-9",
    outstanding: "500.00",
    receivable_is_payable: true,
  });

  fireEvent.click(screen.getByRole("button", { name: /pay now/i }));
  expect(mockNavigate).toHaveBeenCalledWith("/invoices/rec-9?action=pay");
});

test("pay_action null wins over a payable invoice", () => {
  // A prepaid batch settled by a bank transfer an admin recorded: the batch is
  // COMPLETED, so nothing more is owed, whatever the invoice row still says.
  renderRow({
    payment_path: "prepaid",
    status: "completed",
    pay_action: null,
    receivable_id: "rec-1",
    outstanding: "392.97",
    receivable_is_payable: true,
  });

  expect(screen.queryByRole("button", { name: /pay/i })).not.toBeInTheDocument();
  expect(screen.getByText(/Settled/i)).toBeInTheDocument();
});

test("pay_action null wins over payment_pending too", () => {
  renderRow({
    payment_path: "prepaid",
    status: "payment_pending",
    pay_action: null,
    receivable_is_payable: false,
  });

  expect(screen.queryByRole("button", { name: /pay/i })).not.toBeInTheDocument();
});

// ── Layout: the row has to survive a phone ──────────────────────────────────
//
// This is a 12-column table row that used to become five stacked full-width
// cells below `sm`. A phone got ~300px of vertical space per batch, in source
// order (name, counts, progress, money, actions), and the counts rendered as
// three `flex justify-between` rows — label pinned to the left edge of a 343px
// card, value pinned to the right, nothing between them.
//
// These assert the structural decisions rather than the pixels: jsdom computes
// no layout, so a screenshot test would prove nothing here either. What is
// pinned is what a regression would actually break — ordering, wrapping, and
// the fact that the counts are one line.

test("the counts are one line, not three stretched rows", () => {
  renderRow({ total_rows: 43, successful: 12, failed: 30 });

  // "43 rows · 12 booked · 30 failed" — the three facts, inline.
  expect(screen.getByText("43")).toBeInTheDocument();
  expect(screen.getByText("rows")).toBeInTheDocument();
  expect(screen.getByText("booked")).toBeInTheDocument();
  expect(screen.getByText("failed")).toBeInTheDocument();

  // The old labels are gone: they existed only to caption a justify-between row.
  expect(screen.queryByText("Rows:")).not.toBeInTheDocument();
  expect(screen.queryByText("Success:")).not.toBeInTheDocument();
});

test("a clean batch says nothing about failures", () => {
  renderRow({ total_rows: 43, successful: 43, failed: 0 });
  expect(screen.queryByText("failed")).not.toBeInTheDocument();
});

test("money is ordered above the counts on mobile", () => {
  // The question this screen gets opened for is "what does this batch owe".
  // Source order puts counts first; `order-*` overrides it below `sm`.
  const { container } = renderRow({
    payment_path: "prepaid",
    status: "payment_pending",
    pay_action: "prepaid",
    outstanding: "392.97",
  });

  const money = container.querySelector('[data-testid="upload-money-primary"]').closest("div.order-2");
  expect(money).not.toBeNull();
  expect(money.className).toContain("sm:order-4");
});

test("the action area wraps instead of overflowing", () => {
  // A payment_pending batch shows Pay + View inside two of twelve columns.
  const { container } = renderRow({
    payment_path: "prepaid",
    status: "payment_pending",
    pay_action: "prepaid",
  });

  const actions = container.querySelector(".order-5");
  expect(actions.className).toContain("flex-wrap");
});

test("action labels never break mid-word", () => {
  const { container } = renderRow({ status: "pending", is_draft: true });
  const btn = screen.getByRole("button", { name: /continue setup/i });
  expect(btn.className).toContain("whitespace-nowrap");
});

test("action targets are taller on mobile than on desktop", () => {
  // py-1.5 is a 28px tap target. Coarse pointers want closer to 44.
  renderRow({ status: "pending", is_draft: true });
  const btn = screen.getByRole("button", { name: /continue setup/i });
  expect(btn.className).toContain("py-2");
  expect(btn.className).toContain("sm:py-1.5");
});

test("the batch name and its lineage do not compete for one line", () => {
  // Both truncate. Sharing a flex row meant both lost.
  renderRow({ batch_name: "March Week 2", corrects_upload: "p1", corrects_upload_name: "March Week 1" });

  const name = screen.getByText("March Week 2");
  const lineage = screen.getByText(/continues/i);
  expect(name.parentElement).not.toBe(lineage.parentElement);
});

// ── Corrections lineage ─────────────────────────────────────────────────────

test("a corrections batch says which batch it continues", () => {
  renderRow({ corrects_upload: "parent-1", corrects_upload_name: "March Week 2" });
  expect(screen.getByText(/continues/i)).toBeInTheDocument();
  expect(screen.getByText(/March Week 2/)).toBeInTheDocument();
});

test("an ordinary batch says nothing about lineage", () => {
  renderRow({ corrects_upload: null, corrects_upload_name: null });
  expect(screen.queryByText(/continues/i)).not.toBeInTheDocument();
});
