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
  render(
    <UploadRow upload={{ ...baseUpload, ...overrides }} onViewDetail={onViewDetail} onReupload={onReupload} />,
  );
  return { onViewDetail, onReupload };
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

test("NET partial payment surfaces the remaining balance, not the total", () => {
  renderRow({
    receivable_id: "rec-9",
    outstanding: "300.00",
    receivable_status: "partial",
    receivable_is_payable: true,
  });
  expect(screen.getByText(/Outstanding: £300\.00/)).toBeInTheDocument();
  expect(screen.getByRole("button", { name: /Pay now/i })).toBeInTheDocument();
});

// ── The production regression ───────────────────────────────────────────────

test("DRAFT invoice with a balance shows Pay now (the prod bug: £16.00 owed, View only)", () => {
  renderRow({
    receivable_id: "rec-16",
    outstanding: "16.00",
    receivable_status: "draft",
    receivable_is_payable: true,
  });
  expect(screen.getByText(/Outstanding: £16\.00/)).toBeInTheDocument();
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

test("failed upload exposes a Re-upload action that calls onReupload", () => {
  const { onReupload } = renderRow({ status: "failed", total_rows: 0 });
  const btn = screen.getByRole("button", { name: /Re-upload/i });
  fireEvent.click(btn);
  expect(onReupload).toHaveBeenCalledTimes(1);
});

test("non-terminal upload still shows the progress bar", () => {
  renderRow({ status: "processing", total_rows: 10, successful: 5, failed: 0 });
  expect(screen.getByText(/% complete/i)).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: /Re-upload/i })).not.toBeInTheDocument();
});
