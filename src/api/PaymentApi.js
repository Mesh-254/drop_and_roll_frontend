/**
 * api/PaymentApi.js
 *
 * FIX-04  All existing methods called endpoints that do not exist — corrected.
 *
 * FIX-07  BulkUpload PREPAID payment:
 *         initiateBulkPayment() calls /api/payments/initiate-bulk/ which is
 *         the correct backend endpoint (registered in payments/urls.py).
 *
 * FIX-09  PayPal capture now calls /api/payments/paypal-return/{txId}/.
 *
 * FIX-STATIC  getOrCreateBulkIntent and confirmBulkPayment previously called
 *             ApiBase.post(...) as a *static* method, but ApiBase has no static
 *             `post` — it's an instance-based class.  Both methods now use
 *             `this.axiosInstance.post(...)` (the same pattern as every other
 *             method in this class).  The old call would throw:
 *               TypeError: ApiBase.post is not a function
 *             causing the "No transaction data available" error in BulkPaymentPage.
 *
 *             Additionally, the endpoint `/api/payments/bulk/intent/:id/` does not
 *             exist in the backend.  getOrCreateBulkIntent now calls the real
 *             idempotent endpoint: POST /api/payments/initiate-bulk/  (same as
 *             initiateBulkPayment but without a gateway, which is valid for
 *             re-fetching an existing intent).
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
   * @param {string} [p.guestIdentifier] Required alongside guestEmail for guest users
   * @param {string} [p.idempotencyKey]
   * @param {string} [p.currency]       default "GBP"
   * @param {string} [p.gateway]        "stripe" | "paypal"
   *
   * Stripe response data: { flow, transaction_id, gateway, client_secret, amount, currency }
   * PayPal response data: { flow, transaction_id, gateway, approval_url, order_id, amount, currency }
   */
  async initiateBookingPayment({ bookingId, guestEmail, guestIdentifier, idempotencyKey, currency = "GBP", gateway = "stripe" }) {
    try {
      const body = {
        booking_id:      bookingId,
        idempotency_key: idempotencyKey || undefined,
        currency,
        gateway: (gateway || "stripe").toLowerCase(),
      };

      if (guestEmail) {
        body.guest_email = guestEmail.trim().toLowerCase();
        body.guest_identifier = guestIdentifier || localStorage.getItem("guestIdentifier") || undefined;
      }

      const resp = await this.axiosInstance.post("/api/payments/initiate/", body);
      return { success: true, data: resp.data };
    } catch (err) {
      return this._err("INITIATE_BOOKING_ERROR", err);
    }
  }

  // ── Bulk upload initiation (PREPAID or NET) ───────────────────────────────

  /**
   * Initiate payment for a completed BulkUpload.
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
      if (gateway)        body.gateway         = gateway;
      if (idempotencyKey) body.idempotency_key = idempotencyKey;

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
   * POST /api/payments/paypal-return/{txId}/
   * Body: { token: "<PAYPAL_ORDER_ID>" }
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
   * Call after stripe.confirmCardPayment() returns status === "succeeded".
   * Idempotent — safe to call even if webhook already ran.
   */
  async confirmPaymentSuccess({ paymentIntentId, transactionId }) {
    try {
      const resp = await this.axiosInstance.post(
        "/api/payments/confirm-success/",
        {
          payment_intent_id: paymentIntentId,
          transaction_id:    transactionId,
        },
      );
      return { success: true, data: resp.data };
    } catch (err) {
      // Never block the UX — the webhook handles finalisation in the background
      console.warn("[PaymentApi] confirmPaymentSuccess failed:", err.response?.data || err.message);
      return this._err("CONFIRM_SUCCESS_ERROR", err);
    }
  }

  // ── Cancel a PENDING transaction ──────────────────────────────────────────

  async cancelTransaction(txId, guestEmail, guestIdentifier) {
    try {
      // Guest transactions are only visible to the cancel endpoint with BOTH
      // guest credentials (the viewset's queryset scoping) — mirror
      // getTransaction()'s param handling or a guest cancel 404s.
      let url = `/api/payments/transactions/${txId}/cancel/`;
      const email = guestEmail || localStorage.getItem("guestEmail");
      const identifier = guestIdentifier || localStorage.getItem("guestIdentifier");
      if (email && identifier) {
        url += `?guest_email=${encodeURIComponent(email)}&guest_identifier=${encodeURIComponent(identifier)}`;
      }
      const resp = await this.axiosInstance.post(url, {});
      return { success: true, data: resp.data };
    } catch (err) {
      return this._err("CANCEL_TX_ERROR", err);
    }
  }

  // ── Bulk payment intent (idempotent, used by BulkPaymentPage) ────────────

  /**
   * getOrCreateBulkIntent
   *
   * POST /api/payments/initiate-bulk/
   *
   * Idempotent — safe to call on every page mount (including email-link
   * refreshes).  The backend reuses an existing PaymentIntent for this
   * upload if one was already created, so the user is never double-charged.
   *
   * FIX-STATIC: Previously called `ApiBase.post(...)` as a static method —
   * ApiBase has NO static methods; all calls go through `this.axiosInstance`.
   * The old call threw: TypeError: ApiBase.post is not a function
   *
   * FIX-ENDPOINT: The old endpoint `/api/payments/bulk/intent/:id/` does not
   * exist in payments/urls.py.  The correct idempotent endpoint is
   * POST /api/payments/initiate-bulk/ (omit gateway to re-fetch existing intent).
   *
   * @param {string} uploadId  UUID of the BulkUpload
   * @returns {Promise<{ flow, client_secret, amount, currency, transaction_id, ... }>}
   */
  /**
   * getOrCreateBulkIntent
   *
   * POST /api/payments/initiate-bulk/
   *
   * Idempotent — safe to call on every page mount (including email-link
   * refreshes).  The backend reuses an existing PaymentIntent for this
   * upload if one was already created, so the user is never double-charged.
   *
   * FIX-STATIC: Previously called `ApiBase.post(...)` as a static method —
   * ApiBase has NO static methods; all calls go through `this.axiosInstance`.
   *
   * FIX-ENDPOINT: The old endpoint `/api/payments/bulk/intent/:id/` does not
   * exist in payments/urls.py.  The correct idempotent endpoint is
   * POST /api/payments/initiate-bulk/.
   *
   * FIX-F5: gateway is now a required parameter for PREPAID uploads.
   * Omitting it caused the backend to take the NET-terms invoice path even
   * for PREPAID customers.  Pass "stripe" or "paypal"; omit only for NET.
   *
   * @param {string} uploadId
   * @param {string} [gateway="stripe"]  Required for PREPAID — omit only for NET.
   * @returns {Promise<{ flow, client_secret, amount, currency, transaction_id, ... }>}
   */
  async getOrCreateBulkIntent(uploadId, gateway = "stripe") {
    if (import.meta.env.NODE_ENV === "development") {
      console.debug(`[PaymentApi] getOrCreateBulkIntent | uploadId=${uploadId} | gateway=${gateway}`);
    }
    try {
      const resp = await this.axiosInstance.post(
        "/api/payments/initiate-bulk/",
        {
          bulk_upload_id: uploadId,
          // Include gateway for PREPAID; backend ignores it for NET-terms uploads.
          ...(gateway && { gateway }),
        },
      );
      return resp.data;
    } catch (err) {
      // Re-throw so BulkPaymentPage can catch and display the error
      throw err;
    }
  }

  /**
   * confirmBulkPayment
   *
   * POST /api/payments/confirm-success/
   *
   * Called by BulkPaymentPage after Stripe redirects back from the Checkout
   * Session success_url.  The backend verifies the session and finalises the
   * transaction (idempotent — safe if webhook already ran).
   *
   * FIX: Old implementation passed { payment_intent_id, upload_id } but the
   * Checkout Session flow never gives the frontend a PaymentIntent ID.
   * The backend now accepts { session_id, transaction_id } as the primary
   * identifiers for the Checkout Session path.
   *
   * @param {{ uploadId: string, paymentIntentId?: string, transactionId?: string }} params
   *   paymentIntentId — pass the cs_xxx session ID here (or a pi_xxx for legacy flows)
   *   transactionId   — our internal UUID (best-effort; backend falls back to session lookup)
   */
  async confirmBulkPayment({ uploadId, paymentIntentId, transactionId }) {
    if (import.meta.env.NODE_ENV === "development") {
      console.debug(
        `[PaymentApi] confirmBulkPayment | uploadId=${uploadId} | ref=${paymentIntentId} | tx=${transactionId}`
      );
    }
    try {
      // Determine the right field name for the backend based on the ID prefix
      const isSessionId = (paymentIntentId || "").startsWith("cs_");
      const body = {};
      if (isSessionId) {
        body.session_id      = paymentIntentId;
      } else if (paymentIntentId) {
        body.payment_intent_id = paymentIntentId;
      }
      if (transactionId) body.transaction_id = transactionId;
      // upload_id as ultimate fallback so the backend can locate the tx
      if (uploadId)      body.upload_id      = uploadId;

      const resp = await this.axiosInstance.post("/api/payments/confirm-success/", body);
      return resp.data;
    } catch (err) {
      throw err;
    }
  }

  // ── Read transactions ─────────────────────────────────────────────────────

  /**
   * Get transaction details by ID.
   * Supports guest access via guest_email + guest_identifier query params
   * (both required - see CODE_REVIEW.md finding #4).
   */
  async getTransaction(txId, guestEmail, guestIdentifier) {
    try {
      let url = `/api/payments/transactions/${txId}/`;
      const identifier = guestIdentifier || localStorage.getItem("guestIdentifier");
      if (guestEmail && identifier) {
        url += `?guest_email=${encodeURIComponent(guestEmail)}&guest_identifier=${encodeURIComponent(identifier)}`;
      }
      const resp = await this.axiosInstance.get(url);
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