/* eslint-env jest */
// Bulk checkout, embedded rather than redirected.
//
// The customer used to be sent to checkout.stripe.com and back, which is where
// "Redirecting to secure checkout — do not close this tab" came from. They now
// pay in place.
//
// HONEST LIMIT OF THIS SUITE: it proves the wiring — that the client secret is
// fetched and handed to the provider, that we no longer navigate away, and that
// a failure to obtain one is surfaced rather than swallowed. It does NOT prove a
// real card clears; Stripe's iframe is mocked. Only a sandbox payment proves
// that, and it should be done before this reaches production.

import { render, screen, waitFor } from "@testing-library/react";

const mockNavigate = jest.fn();
jest.mock("react-router-dom", () => ({
  __esModule: true,
  useNavigate: () => mockNavigate,
  useParams: () => ({ uploadId: "u1" }),
  useLocation: () => ({ search: "", pathname: "/pay/bulk/u1" }),
}));

// The real provider mounts an iframe; assert it is given the right secret.
const providerProps = { current: null };
jest.mock("@stripe/react-stripe-js", () => ({
  __esModule: true,
  EmbeddedCheckoutProvider: ({ children, options }) => {
    providerProps.current = options;
    return children;
  },
  EmbeddedCheckout: () => {
    const React = require("react");
    return React.createElement("div", { "data-testid": "stripe-iframe" });
  },
}));

jest.mock("@stripe/stripe-js", () => ({
  __esModule: true,
  loadStripe: jest.fn(() => Promise.resolve({})),
}));

jest.mock("../../api/BulkUploadApi", () => ({
  __esModule: true,
  default: { getDetail: jest.fn() },
}));

jest.mock("../../api/PaymentApi", () => ({
  __esModule: true,
  default: {
    getOrCreateBulkIntent: jest.fn(),
    confirmBulkPayment: jest.fn(),
    capturePaypalOrder: jest.fn(),
  },
}));

// The SDK is a network script; this asserts the component is mounted and wired,
// not that PayPal itself works.
jest.mock("./PayPalButtons", () => ({
  __esModule: true,
  default: () => {
    const React = require("react");
    return React.createElement("div", { "data-testid": "paypal-buttons" });
  },
  loadPayPalSdk: jest.fn(),
}));

import BulkUploadApi from "../../api/BulkUploadApi";
import PaymentApi from "../../api/PaymentApi";
import BulkPaymentPage from "./BulkPaymentPage";
import { chooseCheckoutStrategy } from "../../utils/checkoutStrategy";

const UPLOAD = {
  id: "u1",
  status: "payment_pending",
  original_filename: "march.csv",
  total_amount: "423.43",
};

beforeEach(() => {
  jest.clearAllMocks();
  providerProps.current = null;
  BulkUploadApi.getDetail.mockResolvedValue(UPLOAD);
  PaymentApi.getOrCreateBulkIntent.mockResolvedValue({
    transaction_id: "tx1",
    client_secret: "cs_secret_123",
    checkout_url: "https://checkout.test/x",
  });
});

test("pays in place instead of navigating away", async () => {
  // jsdom will not let location be stubbed, so compare it either side. The
  // server still returns checkout_url for older clients; what matters is that
  // this page no longer sends the customer to it.
  const before = window.location.href;

  render(<BulkPaymentPage />);

  expect(await screen.findByTestId("embedded-checkout")).toBeInTheDocument();
  expect(window.location.href).toBe(before);
  expect(mockNavigate).not.toHaveBeenCalled();
});

test("the provider receives the client secret from the server", async () => {
  render(<BulkPaymentPage />);
  await screen.findByTestId("embedded-checkout");
  expect(providerProps.current).toEqual({ clientSecret: "cs_secret_123" });
});

test("the old redirect copy is gone", async () => {
  render(<BulkPaymentPage />);
  await screen.findByTestId("embedded-checkout");
  expect(screen.queryByText(/do not close this tab/i)).not.toBeInTheDocument();
  expect(screen.queryByText(/redirecting to secure checkout/i)).not.toBeInTheDocument();
});

test("an intent with nothing to pay with is surfaced, not swallowed", async () => {
  PaymentApi.getOrCreateBulkIntent.mockResolvedValue({ transaction_id: "tx1" });

  render(<BulkPaymentPage />);

  expect(await screen.findByText(/could not start the secure checkout/i)).toBeInTheDocument();
  expect(screen.queryByTestId("embedded-checkout")).not.toBeInTheDocument();
});

// ── "Payment Unavailable" ────────────────────────────────────────────────────
//
// The reported fault: the dashboard's Pay button and the "Pay Now to Schedule
// Pickup" link in the payment email both landed here and both showed "Payment
// Unavailable", while the same page reached from the wizard worked.
//
// It was never about those two buttons. The server has a CREATE path (returns
// client_secret) and a CACHED path (returned checkout_url and no client_secret,
// because it predates embedded checkout). The wizard's auto-navigation is the
// FIRST visit and takes create; the dashboard button and the emailed link are
// by definition LATER visits and take cache. So the page worked exactly once
// per batch, and the two entry points that could only ever be second never
// worked at all.
//
// Fixed at the source in PaymentService._bulk_intent_from_cached. These pin the
// client's half: never dead-end on a money screen when there IS something to
// pay with.

describe("chooseCheckoutStrategy", () => {
  test("prefers the embedded secret, so the customer stays on Drop & Roll", () => {
    expect(
      chooseCheckoutStrategy({ client_secret: "cs_x", checkout_url: "https://checkout.test/x" }),
    ).toEqual({ kind: "embedded", value: "cs_x" });
  });

  test("falls back to a hosted URL rather than refusing money", () => {
    // Exactly the shape the cached path used to return.
    expect(chooseCheckoutStrategy({ checkout_url: "https://checkout.test/x" })).toEqual({
      kind: "hosted",
      value: "https://checkout.test/x",
    });
  });

  test("errors only when there is genuinely nothing to pay with", () => {
    expect(chooseCheckoutStrategy({ transaction_id: "tx1" }).kind).toBe("error");
    expect(chooseCheckoutStrategy(null).kind).toBe("error");
  });
});

test("a cached intent carrying only a checkout_url does not show Payment Unavailable", async () => {
  PaymentApi.getOrCreateBulkIntent.mockResolvedValue({
    transaction_id: "tx1",
    checkout_url: "https://checkout.test/cached",
    from_cache: true,
  });

  render(<BulkPaymentPage />);

  await waitFor(() => expect(PaymentApi.getOrCreateBulkIntent).toHaveBeenCalled());
  expect(screen.queryByText(/payment unavailable/i)).not.toBeInTheDocument();
  expect(screen.queryByText(/could not start the secure checkout/i)).not.toBeInTheDocument();
});

test("a batch that is not awaiting payment never reaches checkout", async () => {
  BulkUploadApi.getDetail.mockResolvedValue({ ...UPLOAD, status: "awaiting_review" });

  render(<BulkPaymentPage />);

  await waitFor(() =>
    expect(screen.getByText(/not ready for payment/i)).toBeInTheDocument(),
  );
  expect(PaymentApi.getOrCreateBulkIntent).not.toHaveBeenCalled();
});

test("an already-paid batch does not create a second intent screen", async () => {
  PaymentApi.getOrCreateBulkIntent.mockResolvedValue({ already_paid: true });

  render(<BulkPaymentPage />);

  await waitFor(() => expect(screen.queryByTestId("embedded-checkout")).not.toBeInTheDocument());
});

// ── PayPal on the bulk page ──────────────────────────────────────────────────
// This page offered card or nothing. The order is created by the SERVER, so the
// amount is the same whichever button is used.

test("PayPal is offered alongside the card checkout", async () => {
  render(<BulkPaymentPage />);
  await screen.findByTestId("embedded-checkout");
  expect(screen.getByTestId("paypal-buttons")).toBeInTheDocument();
});
