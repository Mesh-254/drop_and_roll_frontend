/**
 * api/PaymentApi.js
 *
 * FIX-04  All existing methods called endpoints that do not exist:
 *           initiateTransaction      → /transactions/{id}/initiate/     (404)
 *           captureTransaction       → /transactions/{id}/capture/      (404)
 *           initiateStripeTransaction→ /transactions/{id}/initiate-stripe/ (404)
 *         These were leftovers from an older API design.
 *
 * FIX-07  BulkUpload PREPAID payment:
 *         useBulkUpload.handleInitiatePayment called BulkUploadApi.initiatePayment(id)
 *         which hits /api/booking/bulk-uploads/{id}/pay/ — that endpoint returns a
 *         raw PaymentTransactionSerializer with NO client_secret or approval_url.
 *         The PaymentPage then tried to call the nonexistent /initiate-stripe/ to
 *         get creds, which always 404'd. Added initiateBulkPayment() that calls the
 *         correct /api/payments/initiate-bulk/ endpoint and returns gateway creds.
 *
 * FIX-09  PayPal capture was wired through /transactions/{id}/capture/ (nonexistent).
 *         capturePaypalOrder() now calls /api/payments/paypal-return/{txId}/.
 *
 * All methods return { success: true, data } on success
 * or { success: false, code, message } on failure, consistently.
 */

import { ApiBase } from "./ApiBase";

export class PaymentApi extends ApiBase {

  // ── Single booking initiation ──────────────────────────────────────────────

  /**
   * Initiate Stripe or PayPal payment for a single booking.
   *
   * POST /api/payments/initiate/
   *
   * @param {Object} p
   * @param {string} p.bookingId
   * @param {string} [p.guestEmail]     For guest users (unauthenticated)
   * @param {string} [p.idempotencyKey]
   * @param {string} [p.currency]     default "GBP"
   *
   * Stripe response data: { flow, transaction_id, gateway, client_secret, amount, currency }
   * PayPal response data: { flow, transaction_id, gateway, approval_url, order_id, amount, currency }
   */
    async initiateBookingPayment({ bookingId, guestEmail, idempotencyKey, currency = "GBP", gateway = "stripe" }) {
      try {
        const body = {
          booking_id:      bookingId,
          idempotency_key: idempotencyKey || undefined,
          currency,
          gateway: (gateway || "stripe").toLowerCase(),
        };

        // Ensure guestEmail normalized consistently
        if (guestEmail) {
          body.guest_email = guestEmail.trim().toLowerCase();
        }

        const resp = await this.axiosInstance.post("/api/payments/initiate/", body, {
          // includeAuth: false,
        });
        return { success: true, data: resp.data };
      } catch (err) {
        return this._err("INITIATE_BOOKING_ERROR", err);
      }
    }

  // ── Bulk upload initiation (PREPAID or NET) ───────────────────────────────

  /**
   * Initiate payment for a completed BulkUpload.
   *
   * FIX-07: Calls /api/payments/initiate-bulk/ (not the old /bulk-uploads/{id}/pay/).
   *
   * POST /api/payments/initiate-bulk/
   *
   * PREPAID: pass gateway → returns { flow:"prepaid", client_secret | approval_url, ... }
   * NET:     omit gateway → returns { flow:"net", invoice_id, invoice_number, due_date, ... }
   *
   * @param {Object} p
   * @param {string} p.bulkUploadId
   * @param {string} [p.gateway]        "stripe"|"paypal" — required for PREPAID, omit for NET
   * @param {string} [p.idempotencyKey]
   */
  async initiateBulkPayment({ bulkUploadId, gateway, idempotencyKey }) {
    try {
      const body = { bulk_upload_id: bulkUploadId };
      if (gateway)         body.gateway         = gateway;
      if (idempotencyKey)  body.idempotency_key = idempotencyKey;

      const resp = await this.axiosInstance.post("/api/payments/initiate-bulk/", body);
      return { success: true, data: resp.data };
    } catch (err) {
      // 409 = already paid — let callers handle it
      if (err.response?.status === 409) {
        return { success: false, code: "ALREADY_PAID", message: err.response.data?.error || "Already paid." };
      }
      return this._err("INITIATE_BULK_ERROR", err);
    }
  }

  // ── Invoice (NET receivable) gateway payment ──────────────────────────────

  /**
   * Initiate Stripe or PayPal payment against a NET-terms invoice.
   *
   * POST /api/payments/receivables/{id}/pay-via-gateway/
   *
   * @param {string} receivableId
   * @param {string} gateway          "stripe" | "paypal"
   * @param {string} [idempotencyKey]
   *
   * Stripe response data: { gateway, client_secret, transaction_id, amount, currency }
   * PayPal response data: { gateway, approval_url, order_id, transaction_id, amount, currency }
   */
  async initiateInvoicePayment(receivableId, gateway, idempotencyKey) {
    try {
      const resp = await this.axiosInstance.post(
        `/api/payments/receivables/${receivableId}/pay-via-gateway/`,
        { gateway, idempotency_key: idempotencyKey || undefined },
      );
      return { success: true, data: resp.data };
    } catch (err) {
      if (err.response?.status === 409) {
        return { success: false, code: "ALREADY_PAID", message: "Invoice already paid." };
      }
      return this._err("INITIATE_INVOICE_ERROR", err);
    }
  }

  // ── PayPal capture ────────────────────────────────────────────────────────

  /**
   * Capture a PayPal order after the customer returns from PayPal approval.
   *
   * FIX-09: was calling /transactions/{id}/capture/ (nonexistent).
   *          Now calls /api/payments/paypal-return/{txId}/.
   *
   * POST /api/payments/paypal-return/{txId}/
   * Body: { token: "<PAYPAL_ORDER_ID>" }
   *
   * @param {string} transactionId
   * @param {string} paypalToken   The ?token= query param from PayPal's redirect
   */
  async capturePaypalOrder(transactionId, paypalToken) {
    try {
      const resp = await this.axiosInstance.post(
        `/api/payments/paypal-return/${transactionId}/`,
        { token: paypalToken },
      );
      return { success: resp.data.success ?? true, data: resp.data };
    } catch (err) {
      return this._err("PAYPAL_CAPTURE_ERROR", err);
    }
  }

  /**
   * Notify backend that the customer cancelled on PayPal.
   * POST /api/payments/paypal-cancel/{txId}/
   */
  async cancelPaypalOrder(transactionId) {
    try {
      await this.axiosInstance.post(`/api/payments/paypal-cancel/${transactionId}/`, {});
      return { success: true };
    } catch (err) {
      return this._err("PAYPAL_CANCEL_ERROR", err);
    }
  }

  // ── Safety net: confirm payment after Stripe JS confirms ──────────────────

  /**
   * POST /api/payments/confirm-success/
   *
   * Call this immediately after stripe.confirmCardPayment() returns
   * paymentIntent.status === "succeeded".
   *
   * WHY: The webhook can be delayed seconds to minutes. During that window the
   * booking stays PENDING even though Stripe has confirmed the payment. This
   * endpoint re-verifies the PI server-to-server (never trusting the client)
   * and finalises the booking immediately.
   *
   * Idempotent — if the webhook already ran, returns { status: "already_success" }
   * without double-processing anything.
   *
   * On any failure, the caller MUST still show the success screen — the webhook
   * will handle finalisation in the background.
   *
   * @param {Object} p
   * @param {string} p.paymentIntentId  e.g. "pi_3TdsPNLPqmtwF5Tu0x2Nb3nH"
   * @param {string} p.transactionId    Internal UUID from the initiate response
   */
  async confirmPaymentSuccess({ paymentIntentId, transactionId }) {
    try {
      const resp = await this.axiosInstance.post(
        "/api/payments/confirm-success/",
        {
          payment_intent_id: paymentIntentId,
          transaction_id:    transactionId,
        },
        // { includeAuth: false },
      );
      return { success: true, data: resp.data };
    } catch (err) {
      // Never block the UX — the webhook handles finalisation in the background
      console.warn("[PaymentApi] confirmPaymentSuccess failed:", err.response?.data || err.message);
      return this._err("CONFIRM_SUCCESS_ERROR", err);
    }
  }

  // ── Cancel a PENDING transaction ──────────────────────────────────────────

  async cancelTransaction(txId) {
    try {
      const resp = await this.axiosInstance.post(
        `/api/payments/transactions/${txId}/cancel/`, {},
      );
      return { success: true, data: resp.data };
    } catch (err) {
      return this._err("CANCEL_TX_ERROR", err);
    }
  }

  // ── Read transactions ─────────────────────────────────────────────────────

  /**
   * Get transaction details by ID.
   * Supports guest access via guest_email query param.
   * 
   * @param {string} txId
   * @param {string} [guestEmail] Optional email for guest users
   */
  async getTransaction(txId, guestEmail) {
    try {
      let url = `/api/payments/transactions/${txId}/`;
      
      // FIX-BUG-03: Add guest email as query param if provided
      if (guestEmail) {
        url += `?guest_email=${encodeURIComponent(guestEmail)}`;
      }

      const resp = await this.axiosInstance.get(url, {
        // includeAuth: false, // FIX-BUG-02: Guest transaction reads don't require auth
      });
      return { success: true, data: resp.data };
    } catch (err) {
      return this._err("GET_TX_ERROR", err);
    }
  }

  async listTransactions(params = {}) {
    try {
      const resp = await this.axiosInstance.get("/api/payments/transactions/", { params });
      return { success: true, data: resp.data };
    } catch (err) {
      return this._err("LIST_TX_ERROR", err);
    }
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  _err(code, error) {
    const message =
      error.response?.data?.error ||
      error.response?.data?.detail ||
      error.message ||
      "An unexpected error occurred.";
    console.error(`[PaymentApi] ${code}:`, error.response?.data || error.message);
    return { success: false, code, message };
  }
}

export const paymentApi = new PaymentApi();
export default paymentApi;