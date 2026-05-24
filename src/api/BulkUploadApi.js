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

import { ApiBase } from './ApiBase';

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
    formData.append('file', file);
    if (metadata.batchName) formData.append('batch_name', metadata.batchName);
    if (metadata.notes)     formData.append('notes',      metadata.notes);

    // FIX: Use axiosInstance directly — identical to every other method in this class.
    // Previously used this.request() which wraps the result as { data, status }, so
    // response.data was the raw axios response object, NOT the Django payload.
    // That meant uploadResult.id was always undefined, causing the "No upload to submit" error.
    const response = await this.axiosInstance.post(
      '/api/booking/bulk-uploads/validate/',
      formData,
      {
        onUploadProgress: (progressEvent) => {
          if (progressEvent.total) {
            const pct = Math.round((progressEvent.loaded * 100) / progressEvent.total);
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
      { status: 'submitted' },
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
    formData.append('file', file);
    if (metadata.batchName) formData.append('batch_name', metadata.batchName);
    if (metadata.notes)     formData.append('notes',      metadata.notes);

    const config = { headers: { 'Content-Type': 'multipart/form-data' } };
    if (onProgress) {
      config.onUploadProgress = (e) => {
        onProgress(Math.round((e.loaded * 100) / e.total));
      };
    }

    const response = await this.axiosInstance.post(
      '/api/booking/bulk-uploads/',
      formData,
      config,
    );
    return response.data;
  }

  /**
   * LIST — All bulk uploads for the current user (most recent first).
   *
   * @param {Object} params - { page, pageSize, status }
   * @returns {Promise<Array>}
   */
  async listUploads(params = {}) {
    const response = await this.axiosInstance.get(
      '/api/booking/bulk-uploads/',
      { params },
    );
    // Backend returns plain array (not wrapped)
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
   * STATS — Dashboard aggregate statistics + credit info for NET businesses.
   *
   * Response shape:
   *   { total_uploads, total_bookings, success_rate, monthly_uploads,
   *     credit_info: { payment_terms, credit_limit, available_credit, net_days } | null }
   */
  async getStats() {
    const response = await this.axiosInstance.get(
      '/api/booking/bulk-uploads/stats/',
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
      { status: 'cancelled' },
    );
    return response.data;
  }

  /**
   * TEMPLATE — Download the CSV upload template.
   */
  async downloadTemplate() {
    const response = await this.axiosInstance.get(
      '/api/booking/bulk-template/',
      { responseType: 'blob' },
    );
    this._triggerDownload(response.data, 'drop-n-roll-bulk-template.csv');
  }

  /**
   * ERROR REPORT — Download enhanced error CSV for a completed upload.
   *
   * Phase 4 enhanced: includes column_name, error_code, suggested_fix.
   *
   * @param {string} id
   */
  async downloadErrorReport(id) {
    const response = await this.axiosInstance.get(
      `/api/booking/bulk-uploads/${id}/error-report/`,
      { responseType: 'blob' },
    );
    this._triggerDownload(response.data, `bulk-errors-${id}.csv`);
  }

  // ── private ──────────────────────────────────────────────────────────────

  _triggerDownload(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a   = document.createElement('a');
    a.href     = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }
}

export default new BulkUploadApi();