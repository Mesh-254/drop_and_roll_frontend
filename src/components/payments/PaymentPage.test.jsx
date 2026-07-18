// Behaviour tests for the payment-page hydration fix (spec §A):
//   • happy path: the page hydrates from the transaction passed in
//     navigation state (returned inline by POST /bookings/) and fires NO
//     transaction GET — the 404-refetch race is structurally gone;
//   • guest credentials arriving inline are persisted so any later fetch
//     can authenticate;
//   • deep-link path: no navigation state → ONE retry-capable fetch;
//   • a failed fetch shows a retry screen and NEVER a fabricated £0.00.

import { render, screen } from "@testing-library/react";

const mockNavigate = jest.fn();
let mockLocation = { state: null };
let mockParams = { txId: "tx-1" };
jest.mock("react-router-dom", () => ({
  useParams: () => mockParams,
  useNavigate: () => mockNavigate,
  useSearchParams: () => [new URLSearchParams()],
  useLocation: () => mockLocation,
}));

jest.mock("@stripe/stripe-js", () => ({
  loadStripe: jest.fn(() => Promise.resolve(null)),
}));
jest.mock("@stripe/react-stripe-js", () => ({
  Elements: ({ children }) => <div>{children}</div>,
  CardElement: () => <div data-testid="card-element" />,
  useStripe: () => null,
  useElements: () => null,
}));

const mockGetTransaction = jest.fn();
const mockGetTransactionWithRetry = jest.fn();
jest.mock("../../api/PaymentApi", () => {
  const api = {
    getTransaction: (...a) => mockGetTransaction(...a),
    getTransactionWithRetry: (...a) => mockGetTransactionWithRetry(...a),
    initiateBookingPayment: jest.fn(),
    initiateBulkPayment: jest.fn(),
    capturePaypalOrder: jest.fn(),
    cancelPaypalOrder: jest.fn(),
    confirmPaymentSuccess: jest.fn(),
  };
  return { __esModule: true, default: api, paymentApi: api };
});

jest.mock("../../api/BookingApi", () => {
  const api = { getBooking: jest.fn() };
  return { __esModule: true, default: api, bookingApi: api };
});

import PaymentPage from "./PaymentPage";

const pendingTx = {
  id: "tx-1",
  status: "pending",
  amount: "14.79",
  currency: "GBP",
  booking: "booking-1",
  payment_expires_at: "2026-07-19T14:25:22Z",
  guest_identifier: "guest-abc-123",
};

describe("PaymentPage — inline hydration (spec §A)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.clear();
    mockParams = { txId: "tx-1" };
    mockLocation = { state: null };
  });

  test("hydrates from navigation-state transaction with NO transaction GET", async () => {
    mockLocation = { state: { transaction: pendingTx } };
    render(<PaymentPage />);

    // Amount comes straight from the inline payload
    expect(await screen.findByText(/14\.79/)).toBeInTheDocument();
    expect(mockGetTransaction).not.toHaveBeenCalled();
    expect(mockGetTransactionWithRetry).not.toHaveBeenCalled();
  });

  test("persists the inline guest_identifier for later authenticated fetches", async () => {
    mockLocation = { state: { transaction: pendingTx } };
    render(<PaymentPage />);
    await screen.findByText(/14\.79/);
    expect(localStorage.getItem("guestIdentifier")).toBe("guest-abc-123");
  });

  test("navigation-state transaction for a DIFFERENT tx id is ignored — fetches instead", async () => {
    mockLocation = { state: { transaction: { ...pendingTx, id: "someone-elses-tx" } } };
    mockGetTransactionWithRetry.mockResolvedValue({ success: true, data: pendingTx });
    render(<PaymentPage />);

    await screen.findByText(/14\.79/);
    expect(mockGetTransactionWithRetry).toHaveBeenCalledTimes(1);
  });

  test("deep link (no navigation state) uses the retry-capable fetch exactly once", async () => {
    mockGetTransactionWithRetry.mockResolvedValue({ success: true, data: pendingTx });
    render(<PaymentPage />);

    expect(await screen.findByText(/14\.79/)).toBeInTheDocument();
    expect(mockGetTransactionWithRetry).toHaveBeenCalledTimes(1);
    expect(mockGetTransaction).not.toHaveBeenCalled();
  });

  test("failed fetch shows a retry screen — NEVER a fabricated £0.00", async () => {
    mockGetTransactionWithRetry.mockResolvedValue({
      success: false,
      status: 404,
      message: "No PaymentTransaction matches the given query.",
    });
    render(<PaymentPage />);

    expect(await screen.findByText(/Try Again/i)).toBeInTheDocument();
    expect(screen.queryByText(/0\.00/)).not.toBeInTheDocument();
    // The gateway selection screen must not have rendered without a tx
    expect(screen.queryByText(/Select Payment Method/i)).not.toBeInTheDocument();
  });

  test("non-pending transaction from state is surfaced as unpayable, not a payment screen", async () => {
    mockLocation = { state: { transaction: { ...pendingTx, status: "cancelled" } } };
    render(<PaymentPage />);

    expect(await screen.findByText(/cancelled and cannot be paid/i)).toBeInTheDocument();
    expect(mockGetTransactionWithRetry).not.toHaveBeenCalled();
  });
});
