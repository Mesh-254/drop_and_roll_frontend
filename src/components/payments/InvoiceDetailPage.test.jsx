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
