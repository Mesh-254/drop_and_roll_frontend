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
  },
}));

import BulkUploadApi from "../../api/BulkUploadApi";
import PaymentApi from "../../api/PaymentApi";
import BulkPaymentPage from "./BulkPaymentPage";

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

test("a missing client secret is surfaced, not swallowed", async () => {
  PaymentApi.getOrCreateBulkIntent.mockResolvedValue({ transaction_id: "tx1" });

  render(<BulkPaymentPage />);

  expect(await screen.findByText(/could not start the secure checkout/i)).toBeInTheDocument();
  expect(screen.queryByTestId("embedded-checkout")).not.toBeInTheDocument();
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
