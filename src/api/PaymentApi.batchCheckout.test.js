/* eslint-env jest */
// `pay-via-gateway` now returns 409 for TWO different situations, and the
// difference is a statement about the customer's money.
//
//   ALREADY_PAID         the invoice owes nothing.
//   USE_BATCH_CHECKOUT   a prepaid batch's proforma. It is unpaid and payable —
//                        just not HERE. The batch owns one embedded Checkout
//                        Session; this endpoint builds a bare PaymentIntent, and
//                        opening a second gateway object against the same debt
//                        is what put two payment records on one bulk upload.
//
// Collapsing the second into the first tells someone who is trying to pay that
// they have already paid. That is the one wrong answer this file exists to stop.

const mockPost = jest.fn();

jest.mock("./ApiBase", () => {
  class ApiBase {
    constructor() {
      this.axiosInstance = {
        post: (...a) => mockPost(...a),
        get: jest.fn(),
      };
    }
  }
  return { __esModule: true, ApiBase, default: ApiBase };
});

import PaymentApi from "./PaymentApi";

const reject = (status, data) => {
  const err = new Error("request failed");
  err.response = { status, data };
  return Promise.reject(err);
};

beforeEach(() => mockPost.mockReset());

test("a prepaid batch proforma is reported as USE_BATCH_CHECKOUT, not as paid", async () => {
  mockPost.mockReturnValue(
    reject(409, {
      error: "This batch is prepaid — pay it from the batch checkout.",
      code: "USE_BATCH_CHECKOUT",
      bulk_upload_id: "bulk-7",
      pay_url: "https://app.test/pay/bulk/bulk-7",
    }),
  );

  const result = await PaymentApi.initiateInvoicePayment("rec-1", "stripe", "k");

  expect(result.success).toBe(false);
  expect(result.code).toBe("USE_BATCH_CHECKOUT");
  expect(result.message).not.toMatch(/already paid/i);
});

test("it carries the URL that does work, so the caller can route rather than error", async () => {
  mockPost.mockReturnValue(
    reject(409, { code: "USE_BATCH_CHECKOUT", pay_url: "https://app.test/pay/bulk/bulk-7", bulk_upload_id: "bulk-7" }),
  );

  const result = await PaymentApi.initiateInvoicePayment("rec-1", "stripe", "k");

  expect(result.payUrl).toBe("https://app.test/pay/bulk/bulk-7");
  expect(result.bulkUploadId).toBe("bulk-7");
});

test("a genuinely settled invoice is still ALREADY_PAID", async () => {
  mockPost.mockReturnValue(reject(409, { error: "No outstanding balance on this invoice." }));

  const result = await PaymentApi.initiateInvoicePayment("rec-1", "stripe", "k");

  expect(result.code).toBe("ALREADY_PAID");
});

test("a successful initiation is untouched", async () => {
  mockPost.mockResolvedValue({ data: { gateway: "stripe", client_secret: "pi_x_secret" } });

  const result = await PaymentApi.initiateInvoicePayment("rec-1", "stripe", "k");

  expect(result).toEqual({ success: true, data: { gateway: "stripe", client_secret: "pi_x_secret" } });
});
