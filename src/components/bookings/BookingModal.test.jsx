// Behaviour tests for the Complete-Your-Booking modal (spec §B/§C/§D):
//   • §D regression: the modal renders and submits WITHOUT api props —
//     BookingPage never passed bookingApi/paymentApi, which crashed
//     "Proceed to Payment" with `undefined.createBooking`;
//   • §B: every parcel mutation triggers a debounced server recompute; the
//     displayed total is the server value and Proceed is disabled while the
//     recompute is in flight or failed;
//   • §C: arriving with a still-pending payment session KEEPS it — parcel
//     edits re-price the same quote in place (quote_id on the recompute) and
//     proceeding reuses the same booking/transaction, never duplicating.

import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";

const mockNavigate = jest.fn();
let mockLocationState = null;
jest.mock("react-router-dom", () => ({
  useNavigate: () => mockNavigate,
  useLocation: () => ({ state: mockLocationState }),
}));

const mockCreateQuote = jest.fn();
const mockCreateBooking = jest.fn();
jest.mock("../../api/BookingApi", () => ({
  bookingApi: {
    createQuote: (...a) => mockCreateQuote(...a),
    createBooking: (...a) => mockCreateBooking(...a),
  },
}));

const mockGetTransaction = jest.fn();
const mockCancelTransaction = jest.fn();
jest.mock("../../api/PaymentApi", () => ({
  paymentApi: {
    getTransaction: (...a) => mockGetTransaction(...a),
    cancelTransaction: (...a) => mockCancelTransaction(...a),
  },
}));

jest.mock("../../contexts/AuthContext", () => ({
  useAuth: () => ({ isAuthenticated: true, user: { email: "test@example.com" } }),
}));

// Parcel editing UI is exercised via onUpdate — render a button that swaps in
// a heavier parcel list so tests can trigger a mutation without driving the
// real form.
jest.mock("./ParcelDetails", () => ({ parcels, onUpdate }) => (
  <button
    data-testid="mutate-parcels"
    onClick={() =>
      onUpdate([
        {
          id: 1,
          weight_kg: "12",
          dimensions: { length: "10", width: "10", height: "10" },
          fragile: false,
        },
      ])
    }
  >
    parcels: {parcels.length}
  </button>
));

import BookingModal from "./BookingModal";

// Wizard-shaped (camelCase) on purpose: the modal must normalize it — the
// §B desync came from wizard parcels failing the modal's snake_case
// validation as "blank".
const validParcel = {
  id: 1,
  weightKg: "5",
  dimensions: { length: "10", width: "10", height: "10" },
  fragile: false,
};

const quote = {
  id: "quote-rev-1",
  final_price: "12.00",
  distance_km: 10,
  insurance_amount: 0,
  discount_amount: 0,
  service_type: { id: "svc-1", name: "Standard" },
  shipping_type: { id: "ship-1", name: "Parcels" },
  meta: { base_price: 12.0, extra_parcels: 0, final_price: 12.0 },
};

const renderModal = (props = {}) =>
  render(
    <BookingModal
      isOpen={true}
      onClose={jest.fn()}
      quote={quote}
      initialFormData={{
        parcels: [validParcel],
        pickupAddress: { line1: "1 A St", city: "MK", postal_code: "MK9 1AA", latitude: 52, longitude: -0.7 },
        dropoffAddress: { line1: "2 B St", city: "OX", postal_code: "OX1 2JD", latitude: 51.7, longitude: -1.2 },
      }}
      {...props}
    />,
  );

describe("BookingModal", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    mockNavigate.mockReset();
    mockCreateQuote.mockReset();
    mockCreateBooking.mockReset();
    mockGetTransaction.mockReset();
    mockCancelTransaction.mockReset();
    mockLocationState = null;
  });
  afterEach(() => {
    jest.useRealTimers();
  });

  test("§D: renders and submits without api props (no undefined.createBooking)", async () => {
    mockCreateBooking.mockResolvedValue({ success: true, data: { id: "tx-1", booking: "b-1" } });
    renderModal();

    fireEvent.click(screen.getByText(/Proceed to Payment/));
    await waitFor(() => expect(mockCreateBooking).toHaveBeenCalled());
    expect(mockCreateBooking.mock.calls[0][0].quoteId).toBe("quote-rev-1");
    expect(mockNavigate).toHaveBeenCalledWith("/pay/tx-1", expect.anything());
  });

  test("§B: parcel mutation debounces a server recompute and swaps in the new quote id", async () => {
    mockCreateQuote.mockResolvedValue({
      success: true,
      data: { ...quote, id: "quote-rev-2", final_price: "16.00", meta: { base_price: 16.0 } },
    });
    mockCreateBooking.mockResolvedValue({ success: true, data: { id: "tx-2", booking: "b-1" } });
    renderModal();

    fireEvent.click(screen.getByTestId("mutate-parcels"));

    // In-flight: Proceed shows the updating state and is disabled.
    expect(screen.getByText(/Updating price/)).toBeInTheDocument();
    expect(screen.getByText(/Updating price/).closest("button")).toBeDisabled();
    expect(mockCreateQuote).not.toHaveBeenCalled(); // still inside the debounce window

    await act(async () => {
      jest.advanceTimersByTime(450);
    });
    await waitFor(() => expect(mockCreateQuote).toHaveBeenCalledTimes(1));
    // The recompute targets the EXISTING quote for an in-place update —
    // a stable quote id is what lets the backend reuse the pending booking.
    expect(mockCreateQuote.mock.calls[0][0].quoteId).toBe("quote-rev-1");

    // Server total displayed, Proceed re-enabled, and the NEW revision id is
    // what createBooking submits.
    expect((await screen.findAllByText(/16\.00/)).length).toBeGreaterThan(0);
    fireEvent.click(screen.getByText(/Proceed to Payment/));
    await waitFor(() => expect(mockCreateBooking).toHaveBeenCalled());
    expect(mockCreateBooking.mock.calls[0][0].quoteId).toBe("quote-rev-2");
  });

  test("§B: failed recompute blocks Proceed and shows the error", async () => {
    mockCreateQuote.mockResolvedValue({ success: false, message: "compute down" });
    renderModal();

    fireEvent.click(screen.getByTestId("mutate-parcels"));
    await act(async () => {
      jest.advanceTimersByTime(450);
    });

    expect(await screen.findByText(/compute down/)).toBeInTheDocument();
    fireEvent.click(screen.getByText(/Proceed to Payment/));
    expect(mockCreateBooking).not.toHaveBeenCalled();
  });

  test("§C: a still-pending resumed session is KEPT for reuse — never cancelled", async () => {
    mockGetTransaction.mockResolvedValue({ success: true, data: { status: "pending" } });
    renderModal({ existingBookingId: "b-old", existingTransactionId: "tx-old" });

    expect(
      await screen.findByText(/editing your existing booking/i),
    ).toBeInTheDocument();
    expect(mockCancelTransaction).not.toHaveBeenCalled();
  });

  test("§C: a no-longer-pending resumed session shows the stale notice", async () => {
    mockGetTransaction.mockResolvedValue({ success: true, data: { status: "cancelled" } });
    renderModal({ existingBookingId: "b-old", existingTransactionId: "tx-old" });

    expect(
      await screen.findByText(/no longer available/i),
    ).toBeInTheDocument();
    expect(mockCancelTransaction).not.toHaveBeenCalled();
  });

  test("§B4: Back hands the full draft (parcels + active quote) to onBack", async () => {
    const onBack = jest.fn();
    renderModal({ onBack });

    fireEvent.click(screen.getByText("Back"));
    expect(onBack).toHaveBeenCalledWith(
      expect.objectContaining({
        quote: expect.objectContaining({ id: "quote-rev-1" }),
        parcels: [expect.objectContaining({ weightKg: "5" })], // camelCase back to the wizard
      }),
    );
  });
});
