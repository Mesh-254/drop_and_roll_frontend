/* eslint-env jest */
// The Results Review step — the one the brief called out as missing.
//
// Before it existed, a batch where 30 of 43 rows failed took the customer
// straight to a payment prompt (prepaid) or showed them an invoice already
// raised (NET). The first thing they learned about a mostly-broken upload was
// the bill.
//
// Pinned here:
//   1. The failures are what you land on when there are failures.
//   2. The money position is stated, and stated as NOT YET CHARGED.
//   3. Every skipped row names the booking it matched. Skipping is invisible by
//      nature, so without the evidence a correct skip and a bug look identical.
//   4. NET shows the auto-effect deadline BEFORE it passes.
//   5. Continue calls the continue endpoint — the only route to money.
//   6. A batch where nothing succeeded offers no way to pay for nothing.

import { render, screen, waitFor, fireEvent, act } from "@testing-library/react";

const mockNavigate = jest.fn();
jest.mock("react-router-dom", () => ({
  __esModule: true,
  useNavigate: () => mockNavigate,
  useParams: () => ({ id: "u1" }),
}));

jest.mock("framer-motion", () => ({
  __esModule: true,
  AnimatePresence: ({ children }) => children,
  motion: new Proxy(
    {},
    {
      get:
        (_t, tag) =>
        ({ children, ...props }) => {
          const React = require("react");
          for (const k of ["whileHover", "whileTap", "initial", "animate", "transition", "exit", "variants", "layout"]) {
            delete props[k];
          }
          return React.createElement(String(tag), props, children);
        },
    },
  ),
}));

jest.mock("react-hot-toast", () => ({
  __esModule: true,
  default: { success: jest.fn(), error: jest.fn() },
}));

jest.mock("../../api/BulkUploadApi", () => ({
  __esModule: true,
  default: {
    getUpload: jest.fn(),
    getErrors: jest.fn(),
    getSuccessful: jest.fn(),
    getSkipped: jest.fn(),
    continueToPayment: jest.fn(),
    downloadErrorReport: jest.fn(),
    uploadCorrections: jest.fn(),
  },
}));

import BulkUploadApi from "../../api/BulkUploadApi";
import BulkUploadReviewPage from "./BulkUploadReviewPage";

const UPLOAD = {
  id: "u1",
  batch_name: "March Week 2",
  status: "awaiting_review",
  payment_path: "prepaid",
  total_rows: 43,
  successful: 13,
  failed: 30,
  skipped: 0,
  effective_total: "423.43",
  auto_effect_at: null,
};

function setup(upload = {}, rows = {}) {
  BulkUploadApi.getUpload.mockResolvedValue({ ...UPLOAD, ...upload });
  BulkUploadApi.getErrors.mockResolvedValue({ results: rows.failed || [] });
  BulkUploadApi.getSuccessful.mockResolvedValue({ results: rows.successful || [] });
  BulkUploadApi.getSkipped.mockResolvedValue({ results: rows.skipped || [] });
  BulkUploadApi.continueToPayment.mockResolvedValue({ id: "u1" });
  BulkUploadApi.uploadCorrections.mockResolvedValue({ id: "child-1" });
  BulkUploadApi.downloadErrorReport.mockResolvedValue(undefined);
  return render(<BulkUploadReviewPage />);
}

beforeEach(() => jest.clearAllMocks());

test("lands on the failures when there are failures", async () => {
  setup();
  const tab = await screen.findByRole("tab", { name: /failed \(30\)/i });
  expect(tab).toHaveAttribute("aria-selected", "true");
});

test("lands on the booked rows when nothing failed", async () => {
  setup({ failed: 0, successful: 43 });
  const tab = await screen.findByRole("tab", { name: /booked \(43\)/i });
  expect(tab).toHaveAttribute("aria-selected", "true");
});

test("states the money position and that nothing has been charged", async () => {
  setup();
  // The amount appears twice by design: once in the summary and once on the
  // button, so the customer sees what they are agreeing to at the moment they
  // agree to it.
  expect(await screen.findAllByText(/£423.43/)).toHaveLength(2);
  expect(screen.getByText(/nothing has been charged yet/i)).toBeInTheDocument();
});

test("a failed row shows its specific error, not a generic one", async () => {
  setup({}, { failed: [{ row_number: 7, reference: "R-7", error_message: "Weight must be a positive number" }] });
  expect(await screen.findByText(/Weight must be a positive number/)).toBeInTheDocument();
});

test("a skipped row names the booking it matched", async () => {
  setup(
    { failed: 0, skipped: 1 },
    { skipped: [{ row_number: 3, reference: "", matched_by: "contents", matched_booking: "BK-10432", matched_upload: "u0" }] },
  );
  const _el = await screen.findByRole("tab", { name: /skipped/i });
  await act(async () => { fireEvent.click(_el); });
  expect(await screen.findByText(/BK-10432/)).toBeInTheDocument();
  expect(screen.getByText(/not been charged twice/i)).toBeInTheDocument();
});

test("a skipped row matched on content says so rather than naming a reference", async () => {
  setup(
    { failed: 0, skipped: 1 },
    { skipped: [{ row_number: 3, reference: "", matched_by: "contents", matched_booking: "BK-1" }] },
  );
  const _el = await screen.findByRole("tab", { name: /skipped/i });
  await act(async () => { fireEvent.click(_el); });
  expect(await screen.findByText(/matched by contents/i)).toBeInTheDocument();
});

test("NET shows the auto-effect deadline before it passes", async () => {
  setup({
    payment_path: "net",
    auto_effect_at: new Date(Date.now() + 47 * 60000).toISOString(),
  });
  const el = await screen.findByTestId("auto-effect-countdown");
  expect(el.textContent).toMatch(/4[567] minutes/);
});

test("prepaid shows no countdown, because it never auto-effects", async () => {
  setup();
  await screen.findByRole("tab", { name: /failed/i });
  expect(screen.queryByTestId("auto-effect-countdown")).not.toBeInTheDocument();
});

test("continue calls the continue endpoint", async () => {
  setup();
  const _el = await screen.findByRole("button", { name: /continue to payment/i });
  await act(async () => { fireEvent.click(_el); });
  await waitFor(() => expect(BulkUploadApi.continueToPayment).toHaveBeenCalledWith("u1"));
});

test("NET labels the action as invoicing, not paying", async () => {
  setup({ payment_path: "net" });
  expect(await screen.findByRole("button", { name: /confirm and invoice/i })).toBeInTheDocument();
});

test("a batch where nothing succeeded offers no way to pay for nothing", async () => {
  setup({ successful: 0, failed: 43 });
  await screen.findByRole("tab", { name: /failed/i });
  expect(screen.queryByRole("button", { name: /continue to payment/i })).not.toBeInTheDocument();
  expect(screen.getByRole("button", { name: /fix and re-upload/i })).toBeInTheDocument();
});

test("a failed continue leaves the customer on the page with an explanation", async () => {
  const toast = require("react-hot-toast").default;
  setup();
  BulkUploadApi.continueToPayment.mockRejectedValue({
    response: { data: { detail: "This batch is not awaiting review." } },
  });

  const _el = await screen.findByRole("button", { name: /continue to payment/i });
  await act(async () => { fireEvent.click(_el); });

  await waitFor(() => expect(toast.error).toHaveBeenCalledWith("This batch is not awaiting review."));
  expect(mockNavigate).not.toHaveBeenCalled();
});

// ── Task 23: corrections upload ──────────────────────────────────────────────
//
// The path that makes double-booking impossible rather than merely detected.
// Everywhere else the system has to infer whether a repeat is a fix or a genuine
// second batch; here the customer answered by using this control.

test("the failures section offers a template download and a corrections upload", async () => {
  setup();
  expect(await screen.findByRole("button", { name: /download failed rows/i })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: /upload corrections/i })).toBeInTheDocument();
});

test("the download asks for the template shape, not the diagnostic report", async () => {
  setup();
  const btn = await screen.findByRole("button", { name: /download failed rows/i });
  await act(async () => { fireEvent.click(btn); });
  expect(BulkUploadApi.downloadErrorReport).toHaveBeenCalledWith("u1", { as: "template" });
});

test("upload is disabled until a file is chosen", async () => {
  setup();
  expect(await screen.findByRole("button", { name: /upload corrections/i })).toBeDisabled();
});

test("choosing a file and uploading posts it against this batch", async () => {
  setup();
  const input = await screen.findByLabelText(/corrections file/i);
  const file = new File(["reference\nR-1\n"], "fix.csv", { type: "text/csv" });
  await act(async () => { fireEvent.change(input, { target: { files: [file] } }); });

  const btn = screen.getByRole("button", { name: /upload corrections/i });
  await act(async () => { fireEvent.click(btn); });

  await waitFor(() => expect(BulkUploadApi.uploadCorrections).toHaveBeenCalledWith("u1", file));
});

test("a batch with no failures offers no corrections section", async () => {
  setup({ failed: 0, successful: 43 });
  await screen.findByRole("tab", { name: /booked/i });
  expect(screen.queryByRole("button", { name: /upload corrections/i })).not.toBeInTheDocument();
});
