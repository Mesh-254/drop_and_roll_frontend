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
   * @param {Object} params - { page, pageSize, status }
   * @returns {Promise<{ count, page, results: Receivable[] }>}
   */
  async list(params = {}) {
    const mapped = {};
    if (params.page) mapped.page = params.page;
    if (params.pageSize) mapped.page_size = params.pageSize;
    if (params.status) mapped.status = params.status;

    const response = await this.axiosInstance.get(
      "/api/payments/receivables/",
      { params: mapped },
    );
    return response.data;
  }

  /**
   * Get a single receivable by UUID.
   *
   * @param {string} id
   * @returns {Promise<Receivable>}
   */
  async get(id) {
    const response = await this.axiosInstance.get(
      `/api/payments/receivables/${id}/`,
    );
    return response.data;
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
}

export default new ReceivableApi();
