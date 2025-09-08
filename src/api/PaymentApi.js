// PaymentApi.js (Fixed booking URL to match consistent pattern "/api/booking/bookings/")
import { ApiBase } from "./ApiBase";

export class PaymentApi extends ApiBase {
  async getTransaction(txId, includeAuth = true, guestEmail = "") {
    try {
      const params = guestEmail ? { guest_email: guestEmail } : {};
      const response = await this.request(`/api/payments/transactions/${txId}/`, {
        method: "GET",
        includeAuth: includeAuth && !guestEmail,
        params,
      });
      return { success: true, data: response.data };
    } catch (error) {
      console.error("getTransaction error:", error, error.response?.data);
      return {
        success: false,
        code: error.code || "FETCH_ERROR",
        message: error.response?.data?.detail || error.message || "Failed to fetch transaction",
      };
    }
  }

  async initiateTransaction(txId, includeAuth = true, guestEmail = "") {
    try {
      const params = guestEmail ? { guest_email: guestEmail.toLowerCase() } : {};
      console.log("initiateTransaction params:", { txId, params });
      const response = await this.request(`/api/payments/transactions/${txId}/initiate/`, {
        method: "POST",
        includeAuth: includeAuth && !guestEmail,
        params,
      });
      return response.data;
    } catch (error) {
      console.error("initiateTransaction error:", error, error.response?.data);
      return {
        success: false,
        code: error.code || "INITIATE_ERROR",
        message: error.response?.data?.error || error.message || "Failed to initiate payment",
      };
    }
  }

  async captureTransaction(txId, includeAuth = true, guestEmail = "") {
    try {
      const params = guestEmail ? { guest_email: guestEmail } : {};
      const response = await this.request(`/api/payments/transactions/${txId}/capture/`, {
        method: "POST",
        includeAuth: includeAuth && !guestEmail,
        params,
      });
      return { success: true, data: response.data };
    } catch (error) {
      console.error("captureTransaction error:", error, error.response?.data);
      return {
        success: false,
        code: error.code || "CAPTURE_ERROR",
        message: error.response?.data?.error || error.message || "Failed to capture payment",
      };
    }
  }


  async cancelTransaction(txId, includeAuth = true, guestEmail = "") {
    try {
      const params = guestEmail ? { guest_email: guestEmail } : {};
      console.log("cancelTransaction params:", { txId, params });
      const response = await this.request(`/api/payments/transactions/${txId}/cancel/`, {
        method: "POST",
        includeAuth: includeAuth && !guestEmail,
        params,
      });
      return response.data;
    } catch (error) {
      console.error("cancelTransaction error:", error, error.response?.data);
      return {
        success: false,
        code: error.code || "CANCEL_ERROR",
        message: error.response?.data?.error || error.message || "Failed to cancel transaction",
      };
    }
  }

  async getBooking(bookingId, includeAuth = true, guestEmail = "") {
    try {
      const params = guestEmail ? { guest_email: guestEmail.toLowerCase() } : {};
      console.log(`Fetching booking ${bookingId} with params:`, params);
      const response = await this.request(`/api/booking/bookings/${bookingId}/`, {  // Fixed URL
        method: "GET",
        includeAuth: includeAuth && !guestEmail,
        params,
      });
      return { success: true, data: response.data };
    } catch (error) {
      console.error("getBooking error:", error, error.response?.data);
      return {
        success: false,
        code: error.code || "FETCH_ERROR",
        message: error.response?.data?.detail || error.message || "Failed to fetch booking",
      };
    }
  }
}

export const paymentApi = new PaymentApi();