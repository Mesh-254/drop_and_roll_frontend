/**
 * ReceivableApi — invoice / NET-terms receivable operations.
 *
 * Base URL: /api/payments/receivables/
 *
 * Business owner endpoints:
 *   list()              → GET  /                  (own receivables only)
 *   get(id)             → GET  /{id}/
 *   downloadPdf(id)     → GET  /{id}/download/    (triggers browser download)
 *
 * Admin-only endpoints:
 *   recordPayment(id, amount, notes)  → POST /{id}/pay/
 *   getAgingReport()                  → GET  /aging/
 */

import { ApiBase } from "./ApiBase";

class ReceivableApi extends ApiBase {
  /**
   * List receivables for the current user.
   *
   * Business owners see only their own.
   * Admins see all (filterable by status).
   *
   * `view` is the semantic filter and is what the UI tabs use:
   *   all | outstanding | overdue | partial | paid | cancelled | payable
   * It asks the server the question the tab label promises. `status` is an exact
   * match on one status value and stays for admin tooling.
   *
   * Do not send `status: "issued"` to mean "outstanding". That is exactly what
   * this page used to do, and a DRAFT invoice with £16.00 owed was then missing
   * from the Outstanding tab while the Outstanding total above it said £16.00.
   *
   * The response's `summary` block carries the ledger totals; never re-total the
   * returned rows client-side, they are one page of one filter.
   *
   * @param {Object} params - { page, pageSize, view, status }
   * @returns {Promise<{ count, page, view, summary, results: Receivable[] }>}
   */
  async list(params = {}) {
    const mapped = {};
    if (params.page) mapped.page = params.page;
    if (params.pageSize) mapped.page_size = params.pageSize;
    if (params.view) mapped.view = params.view;
    if (params.status) mapped.status = params.status;

    const response = await this.axiosInstance.get(
      "/api/payments/receivables/",
      { params: mapped },
    );
    return response.data;
  }

  /**
   * Get a single receivable by UUID.
   * Wraps response in { success, data } format for consistency.
   *
   * @param {string} id
   * @returns {Promise<{ success: boolean, data: Receivable }>}
   */
  async getReceivable(id) {
    try {
      const resp = await this.axiosInstance.get(
        `/api/payments/receivables/${id}/`,
      );
      return { success: true, data: resp.data };
    } catch (err) {
      return this._err("GET_RECEIVABLE_ERROR", err);
    }
  }

  /**
   * Alias for backward compatibility — raw response (no wrapping).
   * @deprecated Use getReceivable() instead
   */
  async get(id) {
    const response = await this.axiosInstance.get(
      `/api/payments/receivables/${id}/`,
    );
    return response.data;
  }

  /**
   * List receivables (wrapped response for consistency).
   *
   * @param {Object} params - { page, pageSize, status }
   * @returns {Promise<{ success: boolean, data: { count, page, results } }>}
   */
  async listReceivables(params = {}) {
    try {
      const mapped = {};
      if (params.page) mapped.page = params.page;
      if (params.pageSize) mapped.page_size = params.pageSize;
      if (params.view) mapped.view = params.view;
      if (params.status) mapped.status = params.status;

      const response = await this.axiosInstance.get(
        "/api/payments/receivables/",
        { params: mapped },
      );
      return { success: true, data: response.data };
    } catch (err) {
      return this._err("LIST_RECEIVABLES_ERROR", err);
    }
  }

  /**
   * Download the PDF invoice for a receivable.
   * Triggers browser download automatically.
   *
   * @param {string} id
   * @param {string} invoiceNumber  - used as filename
   */
  async downloadPdf(id, invoiceNumber = "invoice") {
    const response = await this.axiosInstance.get(
      `/api/payments/receivables/${id}/download/`,
      { responseType: "blob" },
    );
    const url = URL.createObjectURL(response.data);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${invoiceNumber}.pdf`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  /**
   * Record a partial or full payment against a receivable.
   * ADMIN ONLY.
   *
   * @param {string} id
   * @param {number} amount
   * @param {string} notes
   * @returns {Promise<Receivable>} updated receivable
   */
  async recordPayment(id, amount, notes = "") {
    const response = await this.axiosInstance.post(
      `/api/payments/receivables/${id}/pay/`,
      { amount, notes },
    );
    return response.data;
  }

  /**
   * Get the aging report (admin only).
   *
   * Returns outstanding amounts bucketed by age across all businesses.
   *
   * @returns {Promise<{ as_of: string, results: AgingRow[] }>}
   */
  async getAgingReport() {
    const response = await this.axiosInstance.get(
      "/api/payments/receivables/aging/",
    );
    return response.data;
  }

  // ── Error handler ─────────────────────────────────────────────────────────

  _err(code, error) {
    const message =
      error.response?.data?.error ||
      error.response?.data?.detail ||
      error.message ||
      "An unexpected error occurred.";
    console.error(`[ReceivableApi] ${code}:`, error.response?.data || error.message);
    return { success: false, code, message };
  }
}

export default new ReceivableApi();
