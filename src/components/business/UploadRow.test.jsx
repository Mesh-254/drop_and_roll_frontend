// Behaviour tests for the NET-terms inline "Pay now" action on the bulk
// dashboard row (spec §C):
//   • prepaid + payment_pending  → "Pay"      → navigates /pay/bulk/:id
//   • NET + outstanding balance  → "Pay now"  → navigates /invoices/:rid?action=pay
//   • NET + partial payment      → "Pay now"  → shows the REMAINING balance
//   • fully paid                 → "Settled", no pay control
//   • prepaid completed          → "Settled", no pay control

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
  });
  expect(screen.getByText(/Outstanding: £300\.00/)).toBeInTheDocument();
  expect(screen.getByRole("button", { name: /Pay now/i })).toBeInTheDocument();
});

test("NET invoice still in draft shows no pay control (backend would reject it)", () => {
  renderRow({
    receivable_id: "rec-9",
    outstanding: "500.00",
    receivable_status: "draft",
  });
  expect(screen.queryByRole("button", { name: /Pay now/i })).not.toBeInTheDocument();
});

test("fully paid NET invoice shows Settled and no pay control", () => {
  renderRow({
    receivable_id: "rec-9",
    outstanding: "0.00",
    receivable_status: "paid",
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
