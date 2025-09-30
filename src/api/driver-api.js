import { ApiBase } from "./ApiBase";

class DriverAPI extends ApiBase {
  constructor() {
    super(); // Initialize ApiBase
  }

  // Profile Management
  async getProfile() {
    try {
      const response = await super.request("/api/users/auth/me/");
      return { success: true, data: response.data };
    } catch (error) {
      return {
        success: false,
        code: error.code || "FETCH_ERROR",
        message: error.message || "Failed to fetch profile",
        status: error.status,
      };
    }
  }
  async updateProfile(data) {
    const response = await super.request("/api/users/auth/me/", {
      method: "PATCH",
      data: data, // Axios uses `data` instead of `body`
    });
    return response.data;
  }

  // Job Management
  async getAssignedJobs(page = 1, pageSize = 10, status = "") {
    try {
      let url = `/api/driver/assigned-bookings/?page=${page}&page_size=${pageSize}`;
      if (status) url += `&status=${status}`;
      const response = await super.request(url);
      return response.data;
    } catch (error) {
      console.error("[DriverAPI] Error fetching assigned jobs:", error);
      throw error; // Let the caller handle the error
    }
  }
  // load job statuses
  // async getJobStatuses(){
  //   const response = await super.request(`/api/booking/booking-statuses/`);
  //   return response.data;
  // }


  async getJob(jobId) {
    /**
     * Fetches details for a specific job by its ID.
     * @param {string} jobId - The UUID of the job (e.g., '8ce4b5a2-904f-4ab2-960f-76a5837ea58a')
     * @returns {Promise<Object>} - { success: boolean, data: Object | null, code?: string, message?: string, status?: number }
     */
    if (!jobId || typeof jobId !== "string") {
      console.error("[DriverAPI] Invalid jobId provided:", jobId);
      return {
        success: false,
        code: "INVALID_INPUT",
        message: "Job ID must be a non-empty string",
      };
    }

    try {
      console.log(`[DriverAPI] Fetching job details for ID: ${jobId} from /api/bookings/bookings/${jobId}/`);
      const response = await super.request(`/api/booking/bookings/${jobId}/`, {
        method: "GET",
      });
      return { success: true, data: response.data };
    } catch (error) {
      console.error(`[DriverAPI] Error fetching job ${jobId}:`, error);
      return {
        success: false,
        code: error.code || "FETCH_ERROR",
        message: error.message || `Failed to fetch job details for ID: ${jobId}`,
        status: error.status,
      };
    }
  }

  async updateJobStatus(jobId, status, location = null) {

    const response = await super.request(`/api/booking/bookings/${jobId}/set-status/`, {
      method: "POST",
      data: {
        status,
        driver_location: location,
      },
    });
    return response.data;
  }

  async reportJobIssue(jobId, issueData) {
    console.log(`[DriverAPI] Calling reportJobIssue() - Reporting issue for job ${jobId} with data:`, issueData);
    const response = await super.request(`/api/bookings/jobs/${jobId}/report-issue/`, {
      method: "POST",
      data: issueData,
    });
    return response.data;
  }
  async getProofOfDelivery(bookingId) {
    if (!bookingId || typeof bookingId !== "string") {
      console.error("[DriverAPI] Invalid bookingId provided:", bookingId);
      return {
        success: false,
        code: "INVALID_INPUT",
        message: "Booking ID must be a non-empty string",
      };
    }

    try {
      console.log(`[DriverAPI] Fetching POD for booking: ${bookingId}`);
      const response = await super.request(`/api/tracking/pod/by-booking/?booking=${bookingId}`, {
        method: "GET",
      });
      console.log("[DriverAPI] POD response:", response.data);
      return { success: true, data: response.data };
    } catch (error) {
      console.error("[DriverAPI] Error fetching POD:", error);
      return {
        success: false,
        code: error.code || "FETCH_ERROR",
        message: error.response?.data?.detail || "Failed to fetch proof of delivery",
        status: error.response?.status,
      };
    }
  }

  
  async submitProofOfDelivery(bookingId, proofData) {
    console.log(`[DriverAPI] Submitting proof for booking ${bookingId} with data:`, {
      hasPhoto: !!proofData.photo,
      hasNotes: !!proofData.notes,
      hasLocation: !!proofData.location,
    });
    const formData = new FormData();
    if (proofData.photo) formData.append("photo", proofData.photo);
    if (proofData.notes) formData.append("notes", proofData.notes);
    if (proofData.location) formData.append("location", JSON.stringify(proofData.location));

    try {
      const response = await super.request(`/api/tracking/pod/?booking=${bookingId}`, {
        method: "POST",
        data: formData,
        headers: { "Content-Type": undefined },
      });
      // Fetch updated job details to ensure status is "delivered"
      const updatedJob = await this.getJob(bookingId);
      return { success: true, data: response.data, updatedJob };
    } catch (error) {
      console.error(`[DriverAPI] Failed to submit proof for booking ${bookingId}:`, error);
      return {
        success: false,
        code: error.code || "REQUEST_ERROR",
        message: error.response?.data?.detail || "Failed to submit proof of delivery",
        status: error.response?.status,
      };
    }
  }

  async getPayouts() {
    console.log("[DriverAPI] Calling getPayouts() - Fetching driver payouts");
    const response = await super.request("/api/driver/payouts/");
    return response.data;
  }

  async getEarnings() {
    console.log("[DriverAPI] Calling getEarnings() - Computing earnings from payouts");
    const payouts = await this.getPayouts();
    console.log("[DriverAPI] Raw payouts data for earnings calculation:", payouts);
    const today = new Date().toDateString();
    const thisWeek = this.getWeekStart();
    const thisMonth = new Date().getMonth();

    const computedEarnings = {
      today: payouts
        .filter((p) => new Date(p.created_at).toDateString() === today)
        .reduce((sum, p) => sum + Number.parseFloat(p.amount || 0), 0),
      weekly: payouts
        .filter((p) => new Date(p.created_at) >= thisWeek)
        .reduce((sum, p) => sum + Number.parseFloat(p.amount || 0), 0),
      monthly: payouts
        .filter((p) => new Date(p.created_at).getMonth() === thisMonth)
        .reduce((sum, p) => sum + Number.parseFloat(p.amount || 0), 0),
      available: payouts
        .filter((p) => p.status === "available")
        .reduce((sum, p) => sum + Number.parseFloat(p.amount || 0), 0),
      pending: payouts
        .filter((p) => p.status === "pending")
        .reduce((sum, p) => sum + Number.parseFloat(p.amount || 0), 0),
    };

    console.log("[DriverAPI] Computed earnings:", computedEarnings);
    return computedEarnings;
  }

  // Availability Management
  async getAvailability() {
    console.log("[DriverAPI] Calling getAvailability() - Fetching driver availability");
    const response = await super.request("/api/driver/availability/");
    return response.data;
  }

  async updateAvailability(availabilityData) {
    console.log("[DriverAPI] Calling updateAvailability() - Updating availability with data:", availabilityData);
    const response = await super.request("/api/driver/availability/", {
      method: "POST",
      data: availabilityData,
    });
    return response.data;
  }

  // Documents Management
  async getDocuments() {
    console.log("[DriverAPI] Calling getDocuments() - Fetching driver documents");
    const response = await super.request("/api/driver/driver-docs/");
    return response.data;
  }

  async uploadDocument(documentData) {
    console.log(
      `[DriverAPI] Calling uploadDocument() - Uploading document of type: ${documentData.type}, file name: ${documentData.file?.name}`,
    );
    if (!(documentData.file instanceof File)) {
      console.error("[DriverAPI] Invalid file object:", documentData.file);
      return {
        success: false,
        code: "INVALID_FILE",
        message: "Provided file is not a valid File object",
      };
    }

    const formData = new FormData();
    formData.append("file", documentData.file);
    formData.append("doc_type", documentData.type);
    console.log("FormData contents:");
    for (let [key, value] of formData.entries()) {
      console.log(`${key}: ${value.name || value}`);
    }

    try {
      const response = await super.request("/api/driver/driver-docs/", {
        method: "POST",
        data: formData,
        headers: { "Content-Type": undefined }, // overwrites the default headers(Content-Type: multipart/form-data)
      });
      console.log("docs response", response.data);
      return response.data;
    } catch (error) {
      console.error("[DriverAPI] Upload document error:", {
        status: error.response?.status,
        data: error.response?.data,
        message: error.message,
      });
      return {
        success: false,
        code: error.code || "REQUEST_ERROR",
        message: error.response?.data?.detail || error.response?.data?.file?.[0] || error.message || "Failed to upload document",
        status: error.response?.status,
        data: error.response?.data,
      };
    }
  }
  async deleteDocument(docId) {
    console.log(`[DriverAPI] Calling deleteDocument() - Deleting document ID: ${docId}`);
    const response = await super.request(`/api/driver/driver-docs/${docId}/`, {
      method: "DELETE",
    });
    return response.data;
  }

  // Ratings & Performance
  async getRatings() {
    console.log("[DriverAPI] Calling getRatings() - Fetching driver ratings");
    const response = await super.request("/api/driver/ratings/");
    return response.data;
  }

  // New: Fetch Driver Metrics (added)
  async getMetrics() {
    try {
      const response = await super.request("/api/driver/driver-metrics/");
      return { success: true, data: response.data };
    } catch (error) {
      return {
        success: false,
        code: error.code || "FETCH_ERROR",
        message: error.message || "Failed to fetch metrics",
        status: error.status,
      };
    }
  }

  // Utility Methods
  async getCurrentLocation() {
    console.log("[DriverAPI] Calling getCurrentLocation() - Requesting geolocation");
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        const error = new Error("Geolocation not supported");
        console.error("[DriverAPI] Geolocation error:", error);
        reject(error);
        return;
      }

      const watchId = navigator.geolocation.getCurrentPosition(
        (position) => {
          const locationData = {
            lat: position.coords.latitude,
            lng: position.coords.longitude,
            accuracy: position.coords.accuracy,
            timestamp: new Date().toISOString(),
          };
          console.log("[DriverAPI] Geolocation success:", locationData);
          resolve(locationData);
        },
        (error) => {
          console.error("[DriverAPI] Geolocation error:", error);
          reject(error);
        },
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 60000,
        },
      );
      console.log("[DriverAPI] Geolocation watch ID:", watchId);
    });
  }


  getWeekStart() {
    const now = new Date();
    const dayOfWeek = now.getDay();
    const diff = now.getDate() - dayOfWeek;
    const weekStart = new Date(now.setDate(diff));
    console.log("[DriverAPI] Computed week start:", weekStart.toISOString());
    return weekStart;
  }

  // WebSocket connection for real-time updates
  connectWebSocket() {
    const wsUrl = `${this.baseURL.replace("http", "ws")}/driver/ws/`;
    console.log(`[DriverAPI] Connecting WebSocket to: ${wsUrl}`);
    const ws = new WebSocket(wsUrl);

    ws.onopen = () => console.log("[DriverAPI] WebSocket connected successfully");
    ws.onclose = (event) =>
      console.log("[DriverAPI] WebSocket disconnected:", {
        code: event.code,
        reason: event.reason,
        wasClean: event.wasClean,
      });
    ws.onerror = (error) => console.error("[DriverAPI] WebSocket error:", error);
    ws.onmessage = (event) => console.log("[DriverAPI] WebSocket message received:", event.data);

    return ws;
  }
}

export const driverApi = new DriverAPI();
export default driverApi;