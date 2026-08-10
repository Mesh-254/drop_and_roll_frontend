/**
 * BulkUploadApi — bulk upload operations for business bookings.
 *
 * TWO-STEP BROWSER FLOW (production path):
 *   Step 1: validateFile(file, metadata)
 *           → POST /api/booking/bulk-uploads/validate/
 *           Creates BulkUpload in PENDING status, NO Celery yet.
 *           Returns { id, payment_path, payment_terms, net_days, available_credit }
 *
 *   Step 2: submitBulkUpload(id)
 *           → PATCH /api/booking/bulk-uploads/{id}/  { status: "submitted" }
 *           Queues Celery. Returns { id, payment_path, ... }
 *
 *   Then poll: getUploadStatus(id) every 2s until status in [completed|partial|failed]
 *
 *   PREPAID path after completion:
 *     initiatePayment(id) → POST /api/booking/bulk-uploads/{id}/pay/
 *     → returns PaymentTransaction; redirect to /payment/:txId
 *
 *   NET path after completion:
 *     No payment needed. Response from getUploadStatus includes receivable_id,
 *     invoice_number, invoice_due_date. Redirect to /invoices/:receivableId
 *
 * ONE-SHOT (admin/API only):
 *   uploadAndCreate(file, metadata) → POST /api/booking/bulk-uploads/
 */

import { ApiBase } from "./ApiBase";

class BulkUploadApi extends ApiBase {
  /**
   * STEP 1 — Validate file structure & create PENDING BulkUpload record.
   *
   * Does NOT queue Celery. Returns immediately with the created BulkUpload
   * including payment path hints.
   *
   * @param {File}     file
   * @param {Object}   metadata  - { batchName, notes }
   * @param {Function} onProgress - optional(pct: 0-100)
   * @returns {Promise<Object>} BulkUpload with payment_path, net_days, available_credit
   */
  async validateFile(file, metadata, onProgress) {
    const formData = new FormData();
    formData.append("file", file);
    if (metadata.batchName) formData.append("batch_name", metadata.batchName);
    if (metadata.notes) formData.append("notes", metadata.notes);

    // FIX: Use axiosInstance directly — identical to every other method in this class.
    // Previously used this.request() which wraps the result as { data, status }, so
    // response.data was the raw axios response object, NOT the Django payload.
    // That meant uploadResult.id was always undefined, causing the "No upload to submit" error.
    const response = await this.axiosInstance.post(
      "/api/booking/bulk-uploads/validate/",
      formData,
      {
        onUploadProgress: (progressEvent) => {
          if (progressEvent.total) {
            const pct = Math.round(
              (progressEvent.loaded * 100) / progressEvent.total,
            );
            onProgress?.(pct);
          }
        },
      },
    );

    // response.data is now the raw Django BulkUpload payload (with .id, .payment_path, etc.)
    return response.data;
  }
  /**
   * STEP 2 — Submit a validated upload for processing (queues Celery).
   *
   * @param {string} id  - BulkUpload UUID (from step 1)
   * @returns {Promise<Object>} Updated BulkUpload with payment_path hint
   */
  async submitBulkUpload(id) {
    const response = await this.axiosInstance.patch(
      `/api/booking/bulk-uploads/${id}/`,
      { status: "submitted" },
    );
    return response.data;
  }

  /**
   * POLL — Get current status of a BulkUpload (use every 2s while processing).
   *
   * For NET-terms uploads after completion, response includes:
   *   receivable_id, invoice_number, invoice_status, invoice_amount, invoice_due_date
   *
   * @param {string} id
   * @returns {Promise<Object>} BulkUpload with optional receivable fields
   */
  async getUploadStatus(id) {
    const response = await this.axiosInstance.get(
      `/api/booking/bulk-uploads/${id}/status/`,
    );
    return response.data;
  }

  /**
   * PREPAID PATH — Initiate batch payment after processing completes.
   *
   * Returns a PENDING PaymentTransaction. Feed its id to the existing
   * PayPal/Stripe payment flow.
   *
   * @param {string} id  - BulkUpload UUID
   * @returns {Promise<Object>} PaymentTransaction
   */
  async initiatePayment(id) {
    const response = await this.axiosInstance.post(
      `/api/booking/bulk-uploads/${id}/pay/`,
      {},
    );
    return response.data;
  }

  /**
   * ONE-SHOT (admin/API) — Validate + create + immediately queue Celery.
   *
   * @param {File}     file
   * @param {Object}   metadata  - { batchName, notes }
   * @param {Function} onProgress
   * @returns {Promise<Object>} BulkUpload
   */
  async uploadAndCreate(file, metadata = {}, onProgress = null) {
    const formData = new FormData();
    formData.append("file", file);
    if (metadata.batchName) formData.append("batch_name", metadata.batchName);
    if (metadata.notes) formData.append("notes", metadata.notes);

    const config = { headers: { "Content-Type": "multipart/form-data" } };
    if (onProgress) {
      config.onUploadProgress = (e) => {
        onProgress(Math.round((e.loaded * 100) / e.total));
      };
    }

    const response = await this.axiosInstance.post(
      "/api/booking/bulk-uploads/",
      formData,
      config,
    );
    return response.data;
  }

  /**
   * LIST — Bulk uploads for the current user (most recent first), paginated.
   *
   * @param {Object} params - { page, page_size, status, search, date_from, date_to }
   * @returns {Promise<{count: number, next: string|null, previous: string|null, results: Array}>}
   */
  async listUploads(params = {}) {
    const response = await this.axiosInstance.get(
      "/api/booking/bulk-uploads/",
      { params },
    );
    // Backend returns the standard DRF paginated envelope: { count, next, previous, results }.
    return response.data;
  }

  /**
   * DETAIL — Single upload.
   *
   * @param {string} id
   */
  async getUpload(id) {
    const response = await this.axiosInstance.get(
      `/api/booking/bulk-uploads/${id}/`,
    );
    return response.data;
  }

  /**
   * ERRORS — Paginated failed rows with column-level detail.
   *
   * @param {string} id
   * @param {Object} params - { page, pageSize }
   */
  async getErrors(id, params = {}) {
    const response = await this.axiosInstance.get(
      `/api/booking/bulk-uploads/${id}/errors/`,
      { params },
    );
    return response.data;
  }

  /**
   * SUCCESSFUL — Paginated successfully processed rows (created bookings).
   *
   * @param {string} id
   * @param {Object} params - { page, pageSize }
   */
  async getSuccessful(id, params = {}) {
    const response = await this.axiosInstance.get(
      `/api/booking/bulk-uploads/${id}/successful/`,
      { params },
    );
    return response.data;
  }

  /**
   * SKIPPED — Rows that matched an already-created booking (duplicate
   * reference). These produced NO new booking, so they are surfaced separately
   * from the created-bookings list. Backed by the generic /rows/ endpoint
   * filtered to status=skipped.
   *
   * @param {string} id
   * @param {Object} params - { page, page_size }
   * @returns {Promise<{count:number, page:number, results:Array}>}
   */
  async getSkipped(id, params = {}) {
    // Repointed from the generic /rows/?status=skipped to the dedicated
    // endpoint: only that one serves WHAT each row matched (booking, batch and
    // whether it matched on a reference or on contents). A skipped row without
    // that evidence is just a row the customer sent that produced no delivery,
    // which is indistinguishable from a bug.
    const response = await this.axiosInstance.get(
      `/api/booking/bulk-uploads/${id}/skipped/`,
      { params },
    );
    return response.data;
  }

  /**
   * CONTINUE — the customer has reviewed the results and chosen to proceed.
   *
   * The only route from a processed batch to money. Prepaid moves to
   * payment_pending with an unpaid invoice raised; NET invoices on terms and
   * dispatches. Paying without calling this returns 409.
   */
  /**
   * CORRECTIONS — send a fixed file back against the batch it corrects.
   *
   * The whole point of this route rather than a fresh upload: the system KNOWS
   * these are corrections because of which action was taken, so it never has to
   * infer whether a repeat is a fix or a genuine second batch. Anything already
   * booked is skipped, always, and no duplicate dialog is shown.
   */
  async uploadCorrections(parentId, file) {
    const body = new FormData();
    body.append("file", file);
    const response = await this.axiosInstance.post(
      `/api/booking/bulk-uploads/${parentId}/corrections/`,
      body,
      { headers: { "Content-Type": "multipart/form-data" } },
    );
    return response.data;
  }

  /**
   * The failed rows in TEMPLATE shape — fix them and send them straight back.
   * `as=`, not `format=`: DRF reserves `format` for content negotiation.
   */
  correctionsTemplateUrl(id) {
    return `/api/booking/bulk-uploads/${id}/error-report/?as=template`;
  }

  async continueToPayment(id) {
    const response = await this.axiosInstance.post(
      `/api/booking/bulk-uploads/${id}/continue/`,
    );
    return response.data;
  }

  /**
   * STATS — Dashboard aggregate statistics + credit info for NET businesses.
   *
   * Response shape:
   *   { total_uploads, total_bookings, success_rate, total_spend, monthly_uploads,
   *     credit_info: { payment_terms, credit_limit, available_credit, net_days } | null }
   */
  async getStats() {
    const response = await this.axiosInstance.get(
      "/api/booking/bulk-uploads/stats/",
    );
    return response.data;
  }

  /**
   * RETRY — Retry failed rows (admin only).
   *
   * NOTE: endpoint is /retry/ (not /retry-failed/)
   *
   * @param {string} id
   */
  async retryFailed(id) {
    const response = await this.axiosInstance.post(
      `/api/booking/bulk-uploads/${id}/retry/`,
      {},
    );
    return response.data;
  }

  /**
   * CANCEL — Cancel a pending/validated upload.
   *
   * @param {string} id
   */
  async cancelUpload(id) {
    const response = await this.axiosInstance.patch(
      `/api/booking/bulk-uploads/${id}/`,
      { status: "cancelled" },
    );
    return response.data;
  }

  /**
   * TEMPLATE — Download the bulk upload template (.xlsx).
   * Calls GET /api/booking/bulk-template/ which returns a live-generated
   * Excel file with dropdowns sourced from the DB.
   */
  async downloadTemplate() {
    const response = await this.axiosInstance.get(
      "/api/booking/bulk-template/",
      { responseType: "blob" },
    );
    // FIX: backend returns .xlsx — was incorrectly named .csv which caused
    // Excel to open it in compatibility mode without dropdown validation.
    this._triggerDownload(response.data, "drop-n-roll-bulk-template.xlsx");
  }

  /**
   * ERROR REPORT — Download enhanced error CSV for a completed upload.
   *
   * Phase 4 enhanced: includes column_name, error_code, suggested_fix.
   *
   * @param {string} id
   */
  async downloadErrorReport(id, { as } = {}) {
    // `as: "template"` returns the failed rows in TEMPLATE shape -- no
    // diagnostic columns -- so the customer can fix them and send the same file
    // straight back. The default report is unchanged for anyone reading errors
    // rather than correcting them.
    const response = await this.axiosInstance.get(
      `/api/booking/bulk-uploads/${id}/error-report/`,
      { responseType: "blob", params: as ? { as } : undefined },
    );
    this._triggerDownload(
      response.data,
      as === "template" ? `corrections-${id}.csv` : `bulk-errors-${id}.csv`,
    );
  }

  // ── Aliases ───────────────────────────────────────────────────────────────
  // useBulkUpload.js and BulkPaymentPage.jsx reference shorter method names.
  // These thin wrappers keep the original implementations intact while
  // satisfying both callers without a global rename.

  /**
   * alias for validateFile() — called by useBulkUpload.validateFile
   * Signature differs: hook passes a FormData directly (not file + metadata),
   * because it builds FormData itself.  The hook passes `(formData)` but
   * our validateFile() expects `(file, metadata)`.
   *
   * Rather than changing the hook, we accept FormData here and forward it
   * directly via axiosInstance (bypassing the file/metadata decomposition).
   */
  async validate(formData) {
    // [observability] Log in dev so we can confirm alias routing is live
    if (import.meta.env.DEV) {
      console.debug("[BulkUploadApi] validate() alias called");
    }
    const response = await this.axiosInstance.post(
      "/api/booking/bulk-uploads/validate/",
      formData,
    );
    return response.data;
  }

  /**
   * create(uploadId) — STEP 2 of the two-step flow.
   *
   * Patches the PENDING BulkUpload to `submitted`, which triggers the
   * Celery task.  The hook must supply the uploadId returned by validate().
   *
   * Previously this alias POSTed to the one-shot endpoint with FormData,
   * which re-validated from scratch and could reject a second upload of the
   * same content.  The correct two-step flow is:
   *   validate()    → creates BulkUpload in PENDING status, returns { id, ... }
   *   create(id)    → PATCH status=submitted → queues Celery
   *
   * @param {string} uploadId  UUID from validate() response
   * @param {object} [opts]
   * @param {"skip"|"book_again"} [opts.duplicatePolicy]
   *        What to do with references this customer already booked in an
   *        earlier upload. Sent only when the caller has one, so the backend
   *        default ("skip") stands for every path that never asks — the admin
   *        one-shot API, and any older client.
   */
  async create(uploadId, { duplicatePolicy } = {}) {
    if (import.meta.env.DEV) {
      console.debug(
        `[BulkUploadApi] create() — submitting upload ${uploadId}` +
          (duplicatePolicy ? ` (duplicates: ${duplicatePolicy})` : ""),
      );
    }
    const payload = { status: "submitted" };
    if (duplicatePolicy) payload.duplicate_policy = duplicatePolicy;

    const response = await this.axiosInstance.patch(
      `/api/booking/bulk-uploads/${uploadId}/`,
      payload,
    );
    return response.data;
  }

  /**
   * alias for getUploadStatus() — called by useBulkUpload polling loop
   */
  async getStatus(id) {
    return this.getUploadStatus(id);
  }

  /**
   * alias for getUpload() — called by BulkPaymentPage.loadPaymentData
   */
  async getDetail(id) {
    return this.getUpload(id);
  }

  /**
   * getReceivable — called by useBulkUpload._pollForReceivable (NET flow)
   * GET /api/booking/bulk-uploads/:id/receivable/
   */
  async getReceivable(id) {
    const response = await this.axiosInstance.get(
      `/api/booking/bulk-uploads/${id}/receivable/`,
    );
    return response.data;
  }

  // ── private ──────────────────────────────────────────────────────────────

  _triggerDownload(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }
}

export default new BulkUploadApi();
