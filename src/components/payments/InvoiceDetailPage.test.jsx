// §5 — Bank Transfer tab on the invoice page.
//   • the "Bank" tab appears only when the backend reports bank transfer enabled;
//   • selecting it shows the receiving-account details + the exact reference
//     (the invoice number) and NO fake "Pay" button;
//   • when bank transfer is disabled the tab is absent and card/PayPal remain.

import { render, screen, fireEvent, waitFor } from "@testing-library/react";

const mockNavigate = jest.fn();
const mockLocation = { search: "?action=pay", state: null };
jest.mock("react-router-dom", () => ({
  useParams: () => ({ id: "inv-1" }),
  useNavigate: () => mockNavigate,
  useLocation: () => mockLocation,
}));

jest.mock("@stripe/stripe-js", () => ({ loadStripe: jest.fn(() => Promise.resolve(null)) }));
jest.mock("@stripe/react-stripe-js", () => ({
  Elements: ({ children }) => <div>{children}</div>,
  CardElement: () => <div data-testid="card-element" />,
  useStripe: () => null,
  useElements: () => null,
}));

const mockGetBankTransferDetails = jest.fn();
jest.mock("../../api/PaymentApi", () => {
  const api = {
    getBankTransferDetails: (...a) => mockGetBankTransferDetails(...a),
    initiateInvoicePayment: jest.fn(),
  };
  return { __esModule: true, default: api, paymentApi: api };
});

const mockGetInvoice = jest.fn();
jest.mock("../../api/ReceivableApi", () => {
  const api = { get: (...a) => mockGetInvoice(...a) };
  return { __esModule: true, default: api };
});

import InvoiceDetailPage from "./InvoiceDetailPage";

const ISSUED_INVOICE = {
  id: "inv-1",
  invoice_number: "INV-2026-0002",
  business_name: "Bruce limited",
  status: "issued",
  status_display: "Issued",
  amount: "22.00",
  paid_amount: "0.00",
  outstanding: "22.00",
  currency: "GBP",
  issue_date: "2026-07-20",
  due_date: "2026-09-18",
  payment_terms: "net_60",
  bulk_upload: "bulk-1",
  booking_count: 1,
  // Payability is served, not derived from `status`. The page held the third
  // copy of the ["issued","partial","overdue"] whitelist, and it guarded the
  // screen the Pay button navigates to — so a DRAFT invoice would have been
  // refused here even once the other two screens offered to pay it.
  is_payable: true,
  is_outstanding: true,
};

const BANK_DETAILS = {
  enabled: true,
  account_name: "Drop N Roll Ltd",
  sort_code: "12-34-56",
  account_number: "12345678",
  bank_name: "Test Bank",
  note: "Payments typically clear within 1-2 business days.",
};

describe("InvoiceDetailPage — Bank Transfer tab (§5)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetInvoice.mockResolvedValue(ISSUED_INVOICE);
  });

  test("shows the Bank tab and its details + reference when enabled", async () => {
    mockGetBankTransferDetails.mockResolvedValue({ success: true, data: BANK_DETAILS });
    render(<InvoiceDetailPage />);

    // Bank tab appears once details resolve.
    const bankTab = await screen.findByRole("button", { name: /Bank/i });
    fireEvent.click(bankTab);

    // Details + the exact reference (the invoice number) are shown.
    expect(screen.getByText("12345678")).toBeInTheDocument();
    expect(screen.getByText("12-34-56")).toBeInTheDocument();
    // The reference field is the invoice number, labelled unambiguously.
    expect(screen.getByText(/Payment reference/i)).toBeInTheDocument();
    expect(screen.getAllByText("INV-2026-0002").length).toBeGreaterThanOrEqual(1);
    // No live-charge button on the bank panel.
    expect(screen.queryByText(/Pay Outstanding/i)).not.toBeInTheDocument();
  });

  test("hides the Bank tab when disabled", async () => {
    mockGetBankTransferDetails.mockResolvedValue({ success: true, data: { enabled: false } });
    render(<InvoiceDetailPage />);

    // Card/PayPal still render; wait for the pay panel.
    await screen.findByText(/Pay Outstanding/i);
    expect(screen.queryByRole("button", { name: /^🏦 Bank$/ })).not.toBeInTheDocument();
  });
});

// ── Payability comes from the server (2026-07-30) ───────────────────────────
//
// These set `search: ""` rather than the file's default "?action=pay": with the
// pay panel auto-opening, the Stripe Elements subtree renders too and its stubs
// dominate the assertion. What is under test here is only which invoices offer a
// payment control at all.

describe("InvoiceDetailPage — payability is served, not derived", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockLocation.search = "";
    mockGetBankTransferDetails.mockResolvedValue({ success: true, data: { enabled: false } });
  });

  afterEach(() => {
    mockLocation.search = "?action=pay";
  });

  test("a DRAFT invoice with a balance still offers Pay Now here", async () => {
    // The production invoice: INV-2026-0001, DRAFT, £16.00 owed. This page held
    // the third copy of the ["issued","partial","overdue"] whitelist, and it
    // guards the screen the Pay button sends the customer to — so DRAFT was
    // refused here even once /billing offered to pay it.
    mockGetInvoice.mockResolvedValue({
      ...ISSUED_INVOICE,
      status: "draft",
      status_display: "Draft",
      amount: "16.00",
      outstanding: "16.00",
      is_payable: true,
    });
    render(<InvoiceDetailPage />);
    expect(await screen.findByRole("button", { name: /Pay Now/i })).toBeInTheDocument();
  });

  test("an invoice the server calls unpayable offers no payment control, whatever its status", async () => {
    mockGetInvoice.mockResolvedValue({
      ...ISSUED_INVOICE,
      status: "issued",
      outstanding: "0.00",
      is_payable: false,
      is_outstanding: false,
    });
    render(<InvoiceDetailPage />);
    await screen.findByText(/Invoice Details/i);
    expect(screen.queryByRole("button", { name: /Pay Now/i })).not.toBeInTheDocument();
  });

  test("a missing is_payable (older API) hides the control rather than showing a dead one", async () => {
    const stale = { ...ISSUED_INVOICE };
    delete stale.is_payable;
    mockGetInvoice.mockResolvedValue(stale);
    render(<InvoiceDetailPage />);
    await screen.findByText(/Invoice Details/i);
    expect(screen.queryByRole("button", { name: /Pay Now/i })).not.toBeInTheDocument();
  });
});
