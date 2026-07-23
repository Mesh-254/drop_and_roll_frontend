/* eslint-env jest */
// Behaviour test for the homepage instant-quote widget (Hero.jsx). Also serves
// as the compile check for Hero under the real babel-jest pipeline.
//
// Verifies:
//   • the five widget inputs render (postcodes, parcels, weight, service);
//   • submitting valid inputs calls bookingApi.getInstantQuote with cleaned,
//     snake-cased values and renders the returned price + "Continue to Booking";
//   • an out-of-area result renders the "not currently serviceable" panel and
//     NO price / continue button.

import { render, screen, fireEvent, waitFor } from "@testing-library/react";

const mockGetInstantQuote = jest.fn();
const mockGetServiceTypes = jest.fn();

jest.mock("../../api/BookingApi", () => ({
  __esModule: true,
  default: {
    getServiceTypes: (...a) => mockGetServiceTypes(...a),
    getInstantQuote: (...a) => mockGetInstantQuote(...a),
  },
}));

jest.mock("../../contexts/QuoteContext", () => ({
  useQuoteContext: () => ({ setQuickQuotePostcodes: jest.fn() }),
}));
jest.mock("../../contexts/AuthContext", () => ({
  useAuth: () => ({ isAuthenticated: false }),
}));
jest.mock("../quote/GetQuoteBook", () => ({ isOpen }) => (isOpen ? <div data-testid="wizard" /> : null));
jest.mock("../track/TrackParcelModal", () => () => null);

// lucide icons → inert spans
jest.mock("lucide-react", () => new Proxy({}, { get: () => () => null }));

// framer-motion mock that keeps the real DOM tag + passes through DOM props
// (onClick, type, disabled) so the form actually submits and buttons click.
jest.mock("framer-motion", () => {
  const React = require("react");
  const strip = new Set([
    "whileHover", "whileTap", "initial", "animate", "transition", "variants", "exit",
  ]);
  const motion = new Proxy(
    {},
    {
      get: (_t, tag) =>
        React.forwardRef(({ children, ...rest }, ref) => {
          const domProps = {};
          for (const k of Object.keys(rest)) if (!strip.has(k)) domProps[k] = rest[k];
          return React.createElement(typeof tag === "string" ? tag : "div", { ref, ...domProps }, children);
        }),
    },
  );
  return { __esModule: true, motion, AnimatePresence: ({ children }) => children };
});

import Hero from "./Hero";

beforeEach(() => {
  mockGetInstantQuote.mockReset();
  mockGetServiceTypes.mockReset();
  mockGetServiceTypes.mockResolvedValue({
    success: true,
    data: [{ id: "svc-1", name: "Standard" }, { id: "svc-2", name: "Express" }],
  });
});

async function fillValidInputs() {
  render(<Hero />);
  // service types load async → wait for the dropdown to populate
  await screen.findByText("Standard");
  fireEvent.change(screen.getByPlaceholderText("MK9 1AA"), { target: { value: "mk9 1aa" } });
  fireEvent.change(screen.getByPlaceholderText("OX1 1AA"), { target: { value: "ox1 1aa" } });
  fireEvent.change(screen.getByPlaceholderText("5"), { target: { value: "5" } });
}

test("renders the five widget inputs", async () => {
  render(<Hero />);
  await screen.findByText("Standard");
  expect(screen.getByText(/Collection Postcode/i)).toBeTruthy();
  expect(screen.getByText(/Delivery Postcode/i)).toBeTruthy();
  expect(screen.getByText(/Parcels/i)).toBeTruthy();
  expect(screen.getByText(/Total weight/i)).toBeTruthy();
  expect(screen.getByText(/^Service$/i)).toBeTruthy();
  expect(screen.getByRole("button", { name: /Get Instant Quote/i })).toBeTruthy();
});

test("submitting valid inputs calls getInstantQuote with cleaned values and shows the price", async () => {
  mockGetInstantQuote.mockResolvedValue({
    success: true,
    data: { in_service_area: true, currency: "GBP", price: 22, distance_km: 47.1 },
  });

  await fillValidInputs();
  fireEvent.click(screen.getByRole("button", { name: /Get Instant Quote/i }));

  await waitFor(() => expect(mockGetInstantQuote).toHaveBeenCalledTimes(1));
  expect(mockGetInstantQuote).toHaveBeenCalledWith(
    expect.objectContaining({
      pickupPostalCode: "MK91AA",
      dropoffPostalCode: "OX11AA",
      weightKg: "5",
      serviceTypeId: "svc-1",
      parcelCount: 1,
    }),
  );

  expect(await screen.findByText(/GBP 22\.00/)).toBeTruthy();
  expect(screen.getByRole("button", { name: /Continue to Booking/i })).toBeTruthy();
});

test("out-of-area result shows the serviceable-area notice, not a price", async () => {
  mockGetInstantQuote.mockResolvedValue({
    success: false,
    outOfArea: true,
    message: "Delivery postcode is outside our service area.",
  });

  await fillValidInputs();
  fireEvent.click(screen.getByRole("button", { name: /Get Instant Quote/i }));

  expect(await screen.findByText(/Not currently serviceable/i)).toBeTruthy();
  expect(screen.queryByRole("button", { name: /Continue to Booking/i })).toBeNull();
});
