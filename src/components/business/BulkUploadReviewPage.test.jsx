/* eslint-env jest */
// The Results Review step — the one the brief called out as missing.
//
// Before it existed, a batch where 30 of 43 rows failed took the customer
// straight to a payment prompt (prepaid) or showed them an invoice already
// raised (NET). The first thing they learned about a mostly-broken upload was
// the bill.
//
// Pinned here:
//   1. The rows are COLLAPSED on arrival and fetched only when opened. This
//      page used to render every row of the selected tab immediately and fire
//      three list requests on mount for tabs nobody had asked for.
//   2. The money position is stated, and stated as NOT YET CHARGED.
//   3. Every skipped row names the booking it matched. Skipping is invisible by
//      nature, so without the evidence a correct skip and a bug look identical.
//   4. NET shows the auto-effect deadline BEFORE it passes.
//   5. Continue calls the continue endpoint — the only route to money.
//   6. A batch where nothing succeeded offers no way to pay for nothing.
//   7. The error download carries the diagnostic columns, not the bare template.
//   8. There is NO corrections entry point here: corrections are a new upload,
//      declared at Review & Confirm, and a second door competed with the two
//      actions this screen exists for.

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
  },
}));

import BulkUploadApi from "../../api/BulkUploadApi";
import BulkUploadReviewPage from "./BulkUploadReviewPage";
import { normaliseFailedRow, resolveDone } from "../../utils/bulkReview";

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
  BulkUploadApi.downloadErrorReport.mockResolvedValue(undefined);
  return render(<BulkUploadReviewPage />);
}

/** The section headers are buttons: "Failed (30)", "Booked (13)", "Skipped (0)". */
const section = (name) => screen.getByRole("button", { name: new RegExp(name, "i") });

async function open(name) {
  const btn = await screen.findByRole("button", { name: new RegExp(name, "i") });
  await act(async () => {
    fireEvent.click(btn);
  });
}

beforeEach(() => jest.clearAllMocks());

// ── collapsed by default ─────────────────────────────────────────────────────

test("every section starts collapsed", async () => {
  setup();
  await screen.findByRole("button", { name: /failed \(30\)/i });

  for (const name of [/failed \(30\)/i, /booked \(13\)/i, /skipped \(0\)/i]) {
    expect(screen.getByRole("button", { name })).toHaveAttribute("aria-expanded", "false");
  }
  expect(screen.queryByRole("region")).not.toBeInTheDocument();
});

test("no rows are fetched until a section is opened", async () => {
  // Three requests used to fire on mount — six under StrictMode — to fill tabs
  // the customer may never look at.
  setup();
  await screen.findByRole("button", { name: /failed \(30\)/i });

  expect(BulkUploadApi.getErrors).not.toHaveBeenCalled();
  expect(BulkUploadApi.getSuccessful).not.toHaveBeenCalled();
  expect(BulkUploadApi.getSkipped).not.toHaveBeenCalled();
});

test("opening a section fetches exactly that section", async () => {
  setup();
  await open(/failed \(30\)/i);

  expect(BulkUploadApi.getErrors).toHaveBeenCalledWith("u1");
  expect(BulkUploadApi.getSuccessful).not.toHaveBeenCalled();
  expect(BulkUploadApi.getSkipped).not.toHaveBeenCalled();
});

test("reopening a section does not refetch it", async () => {
  // The batch is finished; its rows cannot change while this page is open.
  setup();
  await open(/failed \(30\)/i);
  await open(/failed \(30\)/i); // close
  await open(/failed \(30\)/i); // open again

  expect(BulkUploadApi.getErrors).toHaveBeenCalledTimes(1);
});

test("a section closes again when its header is pressed", async () => {
  setup();
  await open(/failed \(30\)/i);
  expect(section("failed \\(30\\)")).toHaveAttribute("aria-expanded", "true");

  await open(/failed \(30\)/i);
  expect(section("failed \\(30\\)")).toHaveAttribute("aria-expanded", "false");
});

test("the counts are readable while everything is shut", async () => {
  setup({ failed: 30, successful: 13, skipped: 1 });
  expect(await screen.findByRole("button", { name: /failed \(30\)/i })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: /booked \(13\)/i })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: /skipped \(1\)/i })).toBeInTheDocument();
});

// ── the rows themselves ──────────────────────────────────────────────────────

// ── the failed rows, in the shape the API actually serves ────────────────────
//
// GET /api/booking/bulk-uploads/{id}/errors/ returns, per row:
//   { id, row_number, row_reference, error_reason, raw_data,
//     errors: [{ column_name, error_message, error_code, suggested_fix,
//                raw_value }] }
//
// These tests used to mock `{ reference, error_message }` — a shape this
// component invented and the backend never sends. The component read those
// fields, got undefined for both, and rendered every failed row as a bare "Row
// 12" with an empty reason line. The mock and the bug agreed with each other,
// so the suite stayed green while the screen was blank in production.

const API_FAILED_ROW = {
  id: "r7",
  row_number: 7,
  row_reference: "R-7",
  error_reason: "invalid_weight",
  raw_data: { weight_kg: "-3" },
  errors: [
    {
      column_name: "weight_kg",
      error_message: "Weight must be a positive number",
      error_code: "INVALID_WEIGHT",
      suggested_fix: "Enter the parcel weight in kilograms, greater than zero.",
      raw_value: "-3",
    },
  ],
};

test("a failed row shows its specific error, not a generic one", async () => {
  setup({}, { failed: [API_FAILED_ROW] });
  await open(/failed \(30\)/i);
  expect(screen.getByText(/Weight must be a positive number/)).toBeInTheDocument();
});

test("a failed row names the column that caused it", async () => {
  // A message on its own does not say where to look in a 30-column sheet.
  setup({}, { failed: [API_FAILED_ROW] });
  await open(/failed \(30\)/i);
  expect(screen.getByText("weight_kg")).toBeInTheDocument();
});

test("a failed row carries its reference and the suggested fix", async () => {
  setup({}, { failed: [API_FAILED_ROW] });
  await open(/failed \(30\)/i);
  expect(screen.getByText(/Row 7 — R-7/)).toBeInTheDocument();
  expect(screen.getByText(/greater than zero/i)).toBeInTheDocument();
});

test("a row with several bad columns says how many, rather than dropping them", async () => {
  setup({}, {
    failed: [
      {
        row_number: 9,
        row_reference: "",
        errors: [
          { column_name: "postcode", error_message: "Postcode not found", error_code: "GEO", suggested_fix: "" },
          { column_name: "weight_kg", error_message: "Weight must be positive", error_code: "W", suggested_fix: "" },
          { column_name: "email", error_message: "Invalid email", error_code: "E", suggested_fix: "" },
        ],
      },
    ],
  });
  await open(/failed \(30\)/i);
  expect(screen.getByText(/Postcode not found/)).toBeInTheDocument();
  expect(screen.getByText(/and 2 other problems on this row/i)).toBeInTheDocument();
});

test("a failed row with no usable error text still explains itself", async () => {
  // Never a blank reason line. That is the state the whole section exists to
  // avoid, and it is what the customer saw for every row before this fix.
  setup({}, { failed: [{ row_number: 4, row_reference: "", errors: [] }] });
  await open(/failed \(30\)/i);
  expect(screen.getByText(/could not be booked/i)).toBeInTheDocument();
});

describe("normaliseFailedRow", () => {
  test("reads the API's errors list", () => {
    const r = normaliseFailedRow(API_FAILED_ROW);
    expect(r.reference).toBe("R-7");
    expect(r.reason).toBe("Weight must be a positive number");
    expect(r.column).toBe("weight_kg");
    expect(r.extra).toBe(0);
  });

  test("still accepts the flat shape other callers may pass", () => {
    // Two other screens read this endpoint. A row rendering twice is a smaller
    // failure than a row rendering blank.
    const r = normaliseFailedRow({ row_number: 2, reference: "X", error_message: "Bad address" });
    expect(r.reason).toBe("Bad address");
    expect(r.reference).toBe("X");
  });

  test("never returns an empty reason", () => {
    expect(normaliseFailedRow({ row_number: 1 }).reason).toMatch(/could not be booked/i);
  });
});

test("a skipped row names the booking it matched", async () => {
  setup(
    { failed: 0, skipped: 1 },
    { skipped: [{ row_number: 3, reference: "", matched_by: "contents", matched_booking: "BK-10432", matched_upload: "u0" }] },
  );
  await open(/skipped \(1\)/i);
  expect(screen.getByText(/BK-10432/)).toBeInTheDocument();
  expect(screen.getByText(/not been charged twice/i)).toBeInTheDocument();
});

test("a skipped row matched on content says so rather than naming a reference", async () => {
  setup(
    { failed: 0, skipped: 1 },
    { skipped: [{ row_number: 3, reference: "", matched_by: "contents", matched_booking: "BK-1" }] },
  );
  await open(/skipped \(1\)/i);
  expect(screen.getByText(/matched by contents/i)).toBeInTheDocument();
});

test("a section whose rows fail to load says it is empty rather than spinning", async () => {
  setup();
  BulkUploadApi.getErrors.mockRejectedValue(new Error("down"));
  await open(/failed \(30\)/i);
  expect(screen.getByText(/no rows failed/i)).toBeInTheDocument();
});

// ── the money position ───────────────────────────────────────────────────────

test("states the money position and that nothing has been charged", async () => {
  setup();
  // The amount appears twice by design: once in the summary and once on the
  // button, so the customer sees what they are agreeing to at the moment they
  // agree to it.
  expect(await screen.findAllByText(/£423.43/)).toHaveLength(2);
  expect(screen.getByText(/nothing has been charged yet/i)).toBeInTheDocument();
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
  await screen.findByRole("button", { name: /failed \(30\)/i });
  expect(screen.queryByTestId("auto-effect-countdown")).not.toBeInTheDocument();
});

test("continue calls the continue endpoint", async () => {
  setup();
  const btn = await screen.findByRole("button", { name: /continue to payment/i });
  await act(async () => {
    fireEvent.click(btn);
  });
  await waitFor(() => expect(BulkUploadApi.continueToPayment).toHaveBeenCalledWith("u1"));
});

test("NET labels the action as invoicing, not paying", async () => {
  setup({ payment_path: "net" });
  expect(await screen.findByRole("button", { name: /confirm and invoice/i })).toBeInTheDocument();
});

test("a genuinely failed continue leaves the customer on the page with an explanation", async () => {
  const toast = require("react-hot-toast").default;
  setup();
  BulkUploadApi.continueToPayment.mockRejectedValue({
    response: { status: 503, data: { detail: "We could not raise the invoice for this batch." } },
  });

  const btn = await screen.findByRole("button", { name: /continue to payment/i });
  await act(async () => {
    fireEvent.click(btn);
  });

  await waitFor(() =>
    expect(toast.error).toHaveBeenCalledWith("We could not raise the invoice for this batch."),
  );
  expect(mockNavigate).not.toHaveBeenCalled();
});

// ── already continued ────────────────────────────────────────────────────────
//
// `POST /continue/` 409s any batch that is not awaiting_review. A customer
// reaches that by opening a bookmark, using the back button, or having the
// wizard already continue in another tab — none of which is an error, and all
// of which used to produce a red toast reading "This batch is not awaiting
// review." on a screen with nothing else to do.

test("a batch that has already continued shows where it went instead of a Continue button", async () => {
  setup({ status: "payment_pending" });
  await screen.findByTestId("already-done");

  expect(screen.queryByRole("button", { name: /continue to payment/i })).not.toBeInTheDocument();
  expect(screen.getByText(/waiting on payment/i)).toBeInTheDocument();
  expect(screen.getByRole("button", { name: /complete payment/i })).toBeInTheDocument();
});

test("the already-continued prepaid batch links to its checkout", async () => {
  setup({ status: "payment_pending" });
  const btn = await screen.findByRole("button", { name: /complete payment/i });
  await act(async () => {
    fireEvent.click(btn);
  });
  expect(mockNavigate).toHaveBeenCalledWith("/pay/bulk/u1");
});

test("a settled batch says nothing further is needed", async () => {
  setup({ status: "completed" });
  expect(await screen.findByText(/paid and scheduled/i)).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: /continue to payment/i })).not.toBeInTheDocument();
});

test("an already-continued NET batch points at billing, not at a card form", async () => {
  setup({ status: "completed", payment_path: "net" });
  const btn = await screen.findByRole("button", { name: /view invoice/i });
  await act(async () => {
    fireEvent.click(btn);
  });
  expect(mockNavigate).toHaveBeenCalledWith("/billing");
});

test("an already-continued batch does not claim nothing has been charged", async () => {
  // It may well have been. Repeating the review screen's reassurance after the
  // fact is a false statement about the customer's money.
  setup({ status: "completed" });
  await screen.findByTestId("already-done");
  expect(screen.queryByText(/nothing has been charged yet/i)).not.toBeInTheDocument();
});

test("a 409 on continue re-reads the batch and routes instead of erroring", async () => {
  const toast = require("react-hot-toast").default;
  setup();
  BulkUploadApi.continueToPayment.mockRejectedValue({
    response: { status: 409, data: { detail: "This batch is not awaiting review." } },
  });
  // The re-read that the 409 handler performs.
  BulkUploadApi.getUpload.mockResolvedValue({ ...UPLOAD, status: "payment_pending" });

  const btn = await screen.findByRole("button", { name: /continue to payment/i });
  await act(async () => {
    fireEvent.click(btn);
  });

  await waitFor(() => expect(screen.getByTestId("already-done")).toBeInTheDocument());
  expect(toast.error).not.toHaveBeenCalled();
  expect(screen.getByRole("button", { name: /complete payment/i })).toBeInTheDocument();
});

describe("resolveDone", () => {
  test("returns null while the batch is still awaiting review", () => {
    expect(resolveDone({ status: "awaiting_review", payment_path: "prepaid" })).toBeNull();
  });

  test("sends an unpaid prepaid batch to its checkout", () => {
    const d = resolveDone({ id: "u9", status: "payment_pending", payment_path: "prepaid" });
    expect(d.to).toBe("/pay/bulk/u9");
    expect(d.money).toBe(true);
  });

  test("sends a NET batch to billing", () => {
    expect(resolveDone({ id: "u9", status: "payment_pending", payment_path: "net" }).to).toBe("/billing");
  });

  test("a failed batch is told nothing was booked or charged", () => {
    expect(resolveDone({ id: "u9", status: "failed", payment_path: "prepaid" }).headline).toMatch(
      /nothing was booked or charged/i,
    );
  });
});

// ── the outcome meter ────────────────────────────────────────────────────────

test("the outcome is shown as a proportion, not only as two integers", async () => {
  setup({ successful: 13, failed: 30, skipped: 0, total_rows: 43 });
  const meter = await screen.findByTestId("outcome-meter");
  expect(meter).toHaveAttribute("aria-label", expect.stringMatching(/13 booked/));
  expect(meter).toHaveAttribute("aria-label", expect.stringMatching(/30 failed/));
});

test("a count of zero renders no segment", async () => {
  setup({ successful: 43, failed: 0, skipped: 0, total_rows: 43 });
  const meter = await screen.findByTestId("outcome-meter");
  expect(meter.getAttribute("aria-label")).toBe("43 booked");
});

// ── nothing booked ───────────────────────────────────────────────────────────

test("a batch where nothing succeeded offers no way to pay for nothing", async () => {
  setup({ successful: 0, failed: 43 });
  await screen.findByRole("button", { name: /failed \(43\)/i });

  expect(screen.queryByRole("button", { name: /continue to payment/i })).not.toBeInTheDocument();
  expect(screen.getByText(/nothing to pay for/i)).toBeInTheDocument();
  expect(screen.getByRole("button", { name: /back to uploads/i })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: /download error report/i })).toBeInTheDocument();
});

test("an all-skipped batch is framed as already booked, not as a failure", async () => {
  // Every row of it has a delivery against it already. "No rows could be
  // booked" reads as an outage to the customer who is looking at 43 parcels
  // that are on their way.
  setup({ successful: 0, failed: 0, skipped: 43 });
  await screen.findByRole("button", { name: /skipped \(43\)/i });

  expect(screen.getByText(/already booked in an earlier batch/i)).toBeInTheDocument();
  expect(screen.queryByText(/no rows could be booked/i)).not.toBeInTheDocument();
});

test("back to uploads goes to the dashboard", async () => {
  setup({ successful: 0, failed: 43 });
  const btn = await screen.findByRole("button", { name: /back to uploads/i });
  await act(async () => {
    fireEvent.click(btn);
  });
  expect(mockNavigate).toHaveBeenCalledWith("/bulk-upload");
});

// ── the download ─────────────────────────────────────────────────────────────

test("the download asks for the default shape, which carries the diagnostics", async () => {
  // row_number / reference / column_name / error_code / error_message, the same
  // fields the batch detail page shows — and one line per row, so the file is
  // still safe to fix and send straight back.
  setup();
  const btn = await screen.findByRole("button", { name: /download error report/i });
  await act(async () => {
    fireEvent.click(btn);
  });
  expect(BulkUploadApi.downloadErrorReport).toHaveBeenCalledWith("u1");
});

test("a batch with no failures offers no download", async () => {
  setup({ failed: 0, successful: 43 });
  await screen.findByRole("button", { name: /booked \(43\)/i });
  expect(screen.queryByRole("button", { name: /download error report/i })).not.toBeInTheDocument();
});

// ── corrections do not start here ────────────────────────────────────────────

test("the review screen never accepts a file", async () => {
  const { container } = setup();
  await screen.findByRole("button", { name: /download error report/i });
  expect(container.querySelector('input[type="file"]')).toBeNull();
});

test("there is no corrections entry point on this screen", async () => {
  // Corrections are a NEW upload, declared at Review & Confirm. A second door
  // here competed with the two actions the screen exists for.
  setup();
  await screen.findByRole("button", { name: /download error report/i });
  expect(screen.queryByRole("button", { name: /corrections/i })).not.toBeInTheDocument();
  expect(screen.queryByRole("button", { name: /fix and re-upload/i })).not.toBeInTheDocument();
});
