// Behaviour tests for the profile "Pending Payments" section (spec §E):
//   • deterministic time-remaining formatting (no latent-space date math);
//   • rows render route, total and countdown, soonest-to-expire first
//     (ordering is the backend's job — we render in given order);
//   • "Complete payment" routes into /pay/:txId pre-hydrated with the
//     inline transaction (same contract as BookingModal → PaymentPage);
//   • empty list renders nothing at all.

import { render, screen, fireEvent } from "@testing-library/react";

const mockNavigate = jest.fn();
jest.mock("react-router-dom", () => ({
  useNavigate: () => mockNavigate,
}));

const mockGetPendingBookings = jest.fn();
jest.mock("../../api/BookingApi", () => {
  const api = { getPendingBookings: (...a) => mockGetPendingBookings(...a) };
  return { __esModule: true, default: api, bookingApi: api };
});

jest.mock("framer-motion", () => {
  const React = require("react");
  const MOTION_PROPS = ["initial", "animate", "transition", "whileHover", "whileTap"];
  const passthrough = (tag) =>
    function MotionMock(props) {
      const rest = Object.fromEntries(
        Object.entries(props).filter(([key]) => !MOTION_PROPS.includes(key)),
      );
      return React.createElement(tag, rest);
    };
  return { motion: { div: passthrough("div"), button: passthrough("button") } };
});

import PendingBookingsSection from "./PendingBookingsSection";
import { formatTimeRemaining } from "../../utils/timeRemaining";

const row = {
  booking_id: "booking-1",
  created_at: "2026-07-18T10:00:00Z",
  payment_expires_at: "2026-07-19T10:00:00Z",
  final_price: "14.79",
  pickup: "1 Midsummer Blvd, Milton Keynes MK9 1AA",
  dropoff: "2 High St, Oxford OX1 2JD",
  transaction: { id: "tx-9", amount: "14.79", currency: "GBP", status: "pending" },
};

describe("formatTimeRemaining", () => {
  const now = new Date("2026-07-18T12:00:00Z").getTime();

  test.each([
    ["2026-07-20T14:30:00Z", "2d 2h left"],
    ["2026-07-18T15:12:00Z", "3h 12m left"],
    ["2026-07-18T12:25:00Z", "25m left"],
    ["2026-07-18T12:00:30Z", "under a minute left"],
    ["2026-07-18T11:59:00Z", "expired"],
  ])("%s → %s", (iso, expected) => {
    expect(formatTimeRemaining(iso, now)).toBe(expected);
  });

  test("null input returns null", () => {
    expect(formatTimeRemaining(null, now)).toBeNull();
  });
});

describe("PendingBookingsSection", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("renders route, total and a Complete payment button per row", async () => {
    mockGetPendingBookings.mockResolvedValue({
      success: true,
      data: { count: 1, results: [row] },
    });
    render(<PendingBookingsSection />);

    expect(await screen.findByText(/Pending Payments/)).toBeInTheDocument();
    expect(screen.getByText(/Midsummer Blvd.*Oxford/s)).toBeInTheDocument();
    expect(screen.getByText(/£14\.79/)).toBeInTheDocument();
  });

  test("Complete payment navigates pre-hydrated with the inline transaction", async () => {
    mockGetPendingBookings.mockResolvedValue({
      success: true,
      data: { count: 1, results: [row] },
    });
    render(<PendingBookingsSection />);
    fireEvent.click(await screen.findByRole("button", { name: /Complete payment/i }));

    expect(mockNavigate).toHaveBeenCalledWith("/pay/tx-9", {
      state: { transaction: row.transaction },
    });
  });

  test("renders nothing when there are no pending bookings", async () => {
    mockGetPendingBookings.mockResolvedValue({
      success: true,
      data: { count: 0, results: [] },
    });
    const { container } = render(<PendingBookingsSection />);
    await Promise.resolve();
    // After loading resolves with an empty list, the section vanishes
    await screen.findByText(/Checking for pending payments/i).catch(() => {});
    await new Promise((r) => setTimeout(r, 0));
    expect(container.querySelector('[data-testid="pending-bookings-section"]')).toBeNull();
  });
});
