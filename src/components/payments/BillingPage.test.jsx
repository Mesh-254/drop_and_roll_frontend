// Behaviour tests for /billing — the page that told a customer they owed £16.00
// and gave them no way to pay it.
//
// Production, 2026-07-30, one business account, one DRAFT invoice worth £16.00:
//   • "All" tab          → the invoice listed, "Outstanding: GBP 16.00", NO Pay button
//   • "Outstanding" tab  → "No invoices found. No issued invoices."
//                          with the Outstanding tile still reading £16.00
//
// Causes, both of them "the rule is written here as well as on the server":
//   1. The row decided payability from a local ["issued","partial","overdue"]
//      whitelist, which excluded DRAFT after the backend started accepting it.
//   2. The "Outstanding" tab requested status=issued, and the tiles were summed
//      in JavaScript over the loaded rows, so the tile and the list answered
//      different questions.
//
// This file pins the fixed contract: the row renders `is_payable`, the tabs send
// `view`, and the tiles render the server's `summary`.

import { render, screen, fireEvent, waitFor } from "@testing-library/react";

const mockNavigate = jest.fn();
jest.mock("react-router-dom", () => ({
  useNavigate: () => mockNavigate,
}));

const mockList = jest.fn();
const mockDownloadPdf = jest.fn();
jest.mock("../../api/ReceivableApi", () => {
  const api = {
    list: (...a) => mockList(...a),
    downloadPdf: (...a) => mockDownloadPdf(...a),
  };
  return { __esModule: true, default: api };
});

import BillingPage from "./BillingPage";

// The exact production invoice.
const DRAFT_OWING = {
  id: "rec-16",
  invoice_number: "INV-2026-0001",
  business_name: "Acme ltd Company",
  booking_count: 1,
  payment_terms: "net_30",
  payment_terms_display: "NET 30",
  currency: "GBP",
  amount: "16.00",
  outstanding: "16.00",
  status: "draft",
  status_display: "Draft",
  due_date: "2026-08-28",
  is_overdue: false,
  days_overdue: 0,
  is_payable: true,
  is_outstanding: true,
  pdf_url: null,
};

const PAID = {
  ...DRAFT_OWING,
  id: "rec-paid",
  invoice_number: "INV-2026-0002",
  amount: "100.00",
  outstanding: "0.00",
  status: "paid",
  status_display: "Paid in Full",
  is_payable: false,
  is_outstanding: false,
};

const summaryFor = (overrides = {}) => ({
  total_invoiced: "16.00",
  total_paid: "0.00",
  outstanding: "16.00",
  overdue: "0.00",
  counts: { all: 1, outstanding: 1, overdue: 0, paid: 0, payable: 1 },
  ...overrides,
});

const response = (results, summary = summaryFor()) => ({
  count: results.length,
  page: 1,
  view: "all",
  summary,
  results,
});

beforeEach(() => {
  mockNavigate.mockClear();
  mockList.mockReset();
  mockList.mockResolvedValue(response([DRAFT_OWING]));
});

// ── The regression ──────────────────────────────────────────────────────────

test("DRAFT invoice with a balance renders Pay Now (the prod bug)", async () => {
  render(<BillingPage />);
  const btn = await screen.findByRole("button", { name: /Pay Now/i });
  fireEvent.click(btn);
  expect(mockNavigate).toHaveBeenCalledWith("/invoices/rec-16?action=pay");
});

test("the Outstanding tab asks the server for view=outstanding, never status=issued", async () => {
  render(<BillingPage />);
  await screen.findByText("INV-2026-0001");

  fireEvent.click(screen.getByRole("button", { name: /^Outstanding$/i }));

  await waitFor(() => {
    expect(mockList).toHaveBeenLastCalledWith(
      expect.objectContaining({ view: "outstanding" }),
    );
  });
  // status=issued is what hid the DRAFT invoice from its own tab.
  for (const call of mockList.mock.calls) {
    expect(call[0].status).toBeUndefined();
  }
});

test("Outstanding tile and the list cannot contradict each other", async () => {
  render(<BillingPage />);
  await screen.findByText("INV-2026-0001");

  expect(screen.getByTestId("tile-outstanding")).toHaveTextContent("£16.00");
  // The invoice the tile is counting is visible in the list, not filtered out.
  expect(screen.getByText("INV-2026-0001")).toBeInTheDocument();
  expect(screen.queryByText(/No invoices found/i)).not.toBeInTheDocument();
});

// ── Payability comes from the server, not from status ───────────────────────

test("row renders is_payable and ignores the status string", async () => {
  // A status the old whitelist accepted, with the server saying not payable.
  mockList.mockResolvedValue(
    response([{ ...DRAFT_OWING, status: "issued", is_payable: false, outstanding: "0.00", is_outstanding: false }]),
  );
  render(<BillingPage />);
  await screen.findByText("INV-2026-0001");
  expect(screen.queryByRole("button", { name: /Pay Now/i })).not.toBeInTheDocument();
});

test("missing is_payable (older API) hides the button instead of showing a dead one", async () => {
  const stale = { ...DRAFT_OWING };
  delete stale.is_payable;
  mockList.mockResolvedValue(response([stale]));
  render(<BillingPage />);
  await screen.findByText("INV-2026-0001");
  expect(screen.queryByRole("button", { name: /Pay Now/i })).not.toBeInTheDocument();
});

test("paid invoice shows no Pay Now and no outstanding line", async () => {
  mockList.mockResolvedValue(
    response([PAID], summaryFor({ total_invoiced: "100.00", total_paid: "100.00", outstanding: "0.00" })),
  );
  render(<BillingPage />);
  await screen.findByText("INV-2026-0002");
  expect(screen.queryByRole("button", { name: /Pay Now/i })).not.toBeInTheDocument();
  expect(screen.queryByText(/Outstanding: GBP/i)).not.toBeInTheDocument();
});

// ── Tiles are the server's numbers ─────────────────────────────────────────

test("tiles come from summary, so they do not move when the tab changes", async () => {
  render(<BillingPage />);
  await screen.findByText("INV-2026-0001");
  expect(screen.getByTestId("tile-total")).toHaveTextContent("£16.00");

  // The "paid" tab returns no rows but the SAME ledger summary.
  mockList.mockResolvedValue(response([], summaryFor()));
  fireEvent.click(screen.getByRole("button", { name: /^Paid$/i }));

  await screen.findByText(/No invoices found/i);
  expect(screen.getByTestId("tile-total")).toHaveTextContent("£16.00");
  expect(screen.getByTestId("tile-outstanding")).toHaveTextContent("£16.00");
});

test("tiles are not re-derived from the rows on screen", async () => {
  // Rows sum to £16.00; the ledger says £764.00 across other pages. The tile
  // must show the ledger figure — the old code showed the page's sum.
  mockList.mockResolvedValue(
    response(
      [DRAFT_OWING],
      summaryFor({ total_invoiced: "764.00", outstanding: "764.00" }),
    ),
  );
  render(<BillingPage />);
  await screen.findByText("INV-2026-0001");
  expect(screen.getByTestId("tile-outstanding")).toHaveTextContent("£764.00");
});

test("an empty ledger renders £0.00 tiles rather than crashing on a missing summary", async () => {
  mockList.mockResolvedValue({ count: 0, page: 1, results: [] });
  render(<BillingPage />);
  await screen.findByText(/No invoices found/i);
  expect(screen.getByTestId("tile-outstanding")).toHaveTextContent("£0.00");
  expect(screen.getByTestId("tile-total")).toHaveTextContent("£0.00");
});

test("the first load asks for view=all", async () => {
  render(<BillingPage />);
  await screen.findByText("INV-2026-0001");
  expect(mockList).toHaveBeenCalledWith(expect.objectContaining({ view: "all" }));
});

test("a fetch failure surfaces an error and a retry, not a silent empty ledger", async () => {
  mockList.mockRejectedValue(new Error("boom"));
  render(<BillingPage />);
  expect(await screen.findByText(/Failed to load invoices/i)).toBeInTheDocument();
  expect(screen.getByRole("button", { name: /Retry/i })).toBeInTheDocument();
});
