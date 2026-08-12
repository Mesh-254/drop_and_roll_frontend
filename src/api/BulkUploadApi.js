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
   * The failed rows in TEMPLATE shape — fix them and send them straight back.
   * `as=`, not `format=`: DRF reserves `format` for content negotiation.
   */
  /**
   * The batches this customer could upload corrections against.
   *
   * Finished, with failures, inside the dedupe window — the backend narrows it,
   * because the window has to be the same one the skip itself uses. Two
   * independent windows would eventually disagree and the picker would offer a
   * batch whose rows the skip can no longer match.
   */
  async listCorrectable() {
    const response = await this.axiosInstance.get(
      "/api/booking/bulk-uploads/correctable/",
    );
    return response.data;
  }

  /**
   * Everything the Review & Confirm question needs about a DRAFT, in one call.
   *
   * The wizard already holds this from /validate/. A customer who closed the tab
   * and came back through "Continue setup" holds nothing, and the detail page
   * used to submit with no answer at all — which the backend refused, correctly,
   * leaving the batch unsubmittable.
   *
   * Returns { row_count, duplicate_count, duplicate_rows,
   *           duplicate_matched_upload, correctable }.
   */
  async getConfirmContext(id) {
    const response = await this.axiosInstance.get(
      `/api/booking/bulk-uploads/${id}/confirm-context/`,
    );
    return response.data;
  }

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
   * ERROR REPORT — Download the failed rows of a processed upload.
   *
   * @param {string} id
   * @param {object} [opts]
   * @param {"rows"|"enhanced"|"template"} [opts.as]  Shape; see below.
   */
  async downloadErrorReport(id, { as } = {}) {
    // Three shapes, all served by the same endpoint:
    //
    //   default / "rows"  one line per failed ROW. Carries row_number,
    //                     reference, column_name, error_code, error_message and
    //                     suggested_fix alongside the original data columns, so
    //                     the same file is both the diagnosis and the thing you
    //                     fix and send back.
    //   "enhanced"        one line per ERROR. For reading failures one at a
    //                     time; a row with three problems appears three times,
    //                     so re-uploading it would book that parcel three times.
    //   "template"        template columns only, no diagnostics.
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
  async create(uploadId, { duplicatePolicy, correctsUpload } = {}) {
    if (import.meta.env.DEV) {
      console.debug(
        `[BulkUploadApi] create() — submitting upload ${uploadId}` +
          (correctsUpload
            ? ` (corrections to ${correctsUpload})`
            : duplicatePolicy
              ? ` (duplicates: ${duplicatePolicy})`
              : ""),
      );
    }
    const payload = { status: "submitted" };
    // Mutually exclusive, and the declaration wins. Choosing "corrections"
    // already answers skip-or-book-again, and the backend rejects a conflicting
    // policy sent alongside it -- so forwarding a stale duplicatePolicy here
    // would 400 a submit the customer filled in correctly.
    if (correctsUpload) {
      payload.corrects_upload = correctsUpload;
    } else if (duplicatePolicy) {
      payload.duplicate_policy = duplicatePolicy;
    }

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
