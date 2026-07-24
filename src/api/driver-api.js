import { ApiBase } from "./ApiBase";
import { isOnline } from "../offline/network";
import { workOfflineMode } from "../offline/workOfflineMode";
import {
  ACTION_TYPES,
  enqueueAction,
  bufferLocationPing,
} from "../offline/offlineQueueManager";
import { db } from "../offline/db";

// Refresh-survival flag: set when the driver has EXPLICITLY gone live, so a page
// refresh (which tears the component down and back up) can auto-resume tracking
// without the driver re-tapping. Short TTL so a stale flag from a day-old tab
// doesn't silently start tracking.
const LIVE_TRACKING_FLAG = "dnr_live_tracking_active";
const LIVE_TRACKING_TTL_MS = 5 * 60 * 1000; // 5 min

class DriverAPI extends ApiBase {
  constructor() {
    super(); // Initialize ApiBase
  }

  // ── Live-tracking refresh-survival flag ────────────────────────────────────
  /** Mark that live tracking is active (persists across a refresh). */
  markLiveTrackingActive() {
    if (typeof window !== "undefined") {
      localStorage.setItem(LIVE_TRACKING_FLAG, String(Date.now()));
    }
  }

  /** Clear the flag — call on EXPLICIT stop / logout, never on unmount. */
  clearLiveTrackingActive() {
    if (typeof window !== "undefined") {
      localStorage.removeItem(LIVE_TRACKING_FLAG);
    }
  }

  /** True if tracking was live and the flag isn't stale (survives a refresh). */
  isLiveTrackingActive() {
    if (typeof window === "undefined") return false;
    const raw = localStorage.getItem(LIVE_TRACKING_FLAG);
    if (!raw) return false;
    const ts = Number(raw);
    if (Number.isNaN(ts) || Date.now() - ts > LIVE_TRACKING_TTL_MS) {
      localStorage.removeItem(LIVE_TRACKING_FLAG);
      return false;
    }
    return true;
  }

  /**
   * De-duplicated access-token refresh, shared with the axios interceptor's
   * rotating-refresh logic (ApiBase._refreshTokenOnce). Await this before opening
   * a WebSocket so the socket never handshakes with an already-expired token —
   * without duplicating any refresh code in the WS layer.
   */
  async refreshAccessTokenOnce() {
    return this._refreshTokenOnce();
  }

  /** Build the per-driver WS URL from the backend env (http→ws, https→wss). */
  driverWsUrl(driverId) {
    const base =
      import.meta.env.VITE_NEXT_PUBLIC_BACKEND_URL || "http://127.0.0.1:8000";
    const wsBase = base.replace(/^http/i, "ws"); // http→ws, https→wss
    const token =
      typeof window !== "undefined" ? localStorage.getItem("access_token") : "";
    return `${wsBase}/ws/driver/${driverId}/?token=${token}`;
  }

  /**
   * Should this mutating call be queued locally instead of sent now?
   * True when manual "Work Offline" mode is on, or a real connectivity
   * check says we're offline.
   */
  async _shouldQueue() {
    if (workOfflineMode.isActive()) return true;
    return !(await isOnline());
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
  /**
   * Read-through cache helpers for GET endpoints the driver relies on to
   * see their work (job list / route). On success we stash the latest
   * good response; on failure we serve that stashed copy instead of a
   * blank/error screen, tagged so the UI can show a "last updated Xm
   * ago — offline" banner rather than pretending it's live data.
   */
  async _cacheRead(key, value) {
    await db.cachedReads.put({ key, value, cachedAt: Date.now() });
  }

  async _readCache(key) {
    const row = await db.cachedReads.get(key);
    if (!row) return null;
    return { ...row.value, _stale: true, _cachedAt: row.cachedAt };
  }

  async getAssignedJobs(page = 1, pageSize = 10, status = "") {
    const cacheKey = `assigned-jobs:${page}:${pageSize}:${status}`;
    try {
      let url = `/api/driver/driver-routes/current-route/?page=${page}&page_size=${pageSize}`;
      if (status) url += `&status=${status}`;
      const response = await super.request(url);
      console.log("[DriverAPI] Assigned jobs response:", response.data);
      await this._cacheRead(cacheKey, response.data);
      return response.data;
    } catch (error) {
      console.error("[DriverAPI] Error fetching assigned jobs:", error);
      const cached = await this._readCache(cacheKey);
      if (cached) {
        console.warn("[DriverAPI] Serving cached assigned jobs (offline)");
        return cached;
      }
      throw error; // Let the caller handle the error
    }
  }
  // load job statuses
  // async getJobStatuses(){
  //   const response = await super.request(`/api/booking/booking-statuses/`);
  //   return response.data;driverApi
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

    const cacheKey = `job:${jobId}`;
    try {
      console.log(
        `[DriverAPI] Fetching job details for ID: ${jobId} from /api/bookings/bookings/${jobId}/`,
      );
      const response = await super.request(`/api/booking/bookings/${jobId}/`, {
        method: "GET",
      });
      // Read-through cache so the detail page opens offline for any job the
      // driver has already viewed (mirrors getAssignedJobs for the list).
      await this._cacheRead(cacheKey, response.data);
      return { success: true, data: response.data };
    } catch (error) {
      console.error(`[DriverAPI] Error fetching job ${jobId}:`, error);
      const cached = await this._readCache(cacheKey);
      if (cached) {
        console.warn(`[DriverAPI] Serving cached job ${jobId} (offline)`);
        return { success: true, data: cached, stale: true };
      }
      return {
        success: false,
        code: error.code || "FETCH_ERROR",
        message:
          error.message || `Failed to fetch job details for ID: ${jobId}`,
        status: error.status,
      };
    }
  }

  // ── RAW: actual HTTP call, used both for the online path here and by
  // the sync engine when flushing a queued action. Never calls back into
  // the queue-aware wrapper — that would create an infinite loop.
  async _updateJobStatusRaw(jobId, status, location = null, clientActionId = null) {
    const response = await super.request(
      `/api/booking/bookings/${jobId}/set-status/`,
      {
        method: "POST",
        data: {
          status,
          driver_location: location,
          ...(clientActionId ? { client_action_id: clientActionId } : {}),
        },
      },
    );
    return response.data;
  }

  async updateJobStatus(jobId, status, location = null) {
    if (await this._shouldQueue()) {
      const { clientActionId } = await enqueueAction({
        type: ACTION_TYPES.STATUS_UPDATE,
        bookingId: jobId,
        payload: { status, driver_location: location },
      });
      console.log(
        `[DriverAPI] Offline — queued status update for ${jobId} → ${status} (${clientActionId})`,
      );
      // Optimistic result: the UI updates immediately, the real sync
      // happens later. If the server ultimately rejects it (e.g. the
      // booking became immutable in the meantime), the Sync Issues panel
      // will surface that — better than blocking the driver's workflow
      // now on a connection they don't have.
      return { id: jobId, status, queued: true, clientActionId };
    }

    try {
      return await this._updateJobStatusRaw(jobId, status, location);
    } catch (error) {
      // A request that started online can still fail mid-flight (signal
      // dropped while in transit). Network-level failures (no `status` on
      // the error, i.e. it never reached the server) fall back to the
      // queue instead of surfacing an error the driver can't do anything
      // about right now.
      if (!error?.response) {
        const { clientActionId } = await enqueueAction({
          type: ACTION_TYPES.STATUS_UPDATE,
          bookingId: jobId,
          payload: { status, driver_location: location },
        });
        console.warn(
          `[DriverAPI] Request failed mid-flight — queued status update for ${jobId} (${clientActionId})`,
        );
        return { id: jobId, status, queued: true, clientActionId };
      }
      throw error;
    }
  }

  async _reportJobIssueRaw(jobId, issueData, clientActionId = null) {
    const response = await super.request(
      `/api/bookings/jobs/${jobId}/report-issue/`,
      {
        method: "POST",
        data: {
          ...issueData,
          ...(clientActionId ? { client_action_id: clientActionId } : {}),
        },
      },
    );
    return response.data;
  }

  async reportJobIssue(jobId, issueData) {
    console.log(
      `[DriverAPI] Calling reportJobIssue() - Reporting issue for job ${jobId} with data:`,
      issueData,
    );

    if (await this._shouldQueue()) {
      const { clientActionId } = await enqueueAction({
        type: ACTION_TYPES.REPORT_ISSUE,
        bookingId: jobId,
        payload: issueData,
      });
      return { queued: true, clientActionId };
    }

    try {
      return await this._reportJobIssueRaw(jobId, issueData);
    } catch (error) {
      if (!error?.response) {
        const { clientActionId } = await enqueueAction({
          type: ACTION_TYPES.REPORT_ISSUE,
          bookingId: jobId,
          payload: issueData,
        });
        return { queued: true, clientActionId };
      }
      throw error;
    }
  }

  // STEP: Scan QR method
  async scanQr(qrContent) {
    if (!qrContent || typeof qrContent !== "string" || !qrContent.trim()) {
      console.error("[DriverAPI] scanQr called with invalid qrContent");
      return {
        success: false,
        code: "INVALID_INPUT",
        message: "qr_content is required and must be a non-empty string",
      };
    }

    try {
      console.log(`[DriverAPI] Scanning QR: ${qrContent.substring(0, 80)}...`);
      
      const response = await super.request("/api/booking/scan-qr/", {
        method: "POST",
        data: { qr_content: qrContent.trim() },
      });

      console.log("[DriverAPI] QR scan successful:", response.data);
      return { success: true, data: response.data };
    } catch (error) {
      console.error("[DriverAPI] QR scan failed:", {
        status: error.response?.status,
        data: error.response?.data,
        message: error.message,
      });

      return {
        success: false,
        code: error.code || "SCAN_ERROR",
        message:
          error.response?.data?.error ||
          error.response?.data?.detail ||
          error.message ||
          "Failed to scan QR code",
        status: error.response?.status,
      };
    }
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
      const response = await super.request(
        `/api/tracking/pod/by-booking/?booking=${bookingId}`,
        {
          method: "GET",
        },
      );
      console.log("[DriverAPI] POD response:", response.data);
      return { success: true, data: response.data };
    } catch (error) {
      console.error("[DriverAPI] Error fetching POD:", error);
      return {
        success: false,
        code: error.code || "FETCH_ERROR",
        message:
          error.response?.data?.detail || "Failed to fetch proof of delivery",
        status: error.response?.status,
      };
    }
  }

  // ── RAW: builds the multipart request from either a live File (online
  // path) or a Blob pulled back out of IndexedDB (sync engine flush path)
  // — FormData.append() accepts either transparently.
  async _submitProofOfDeliveryRaw(bookingId, proofData, clientActionId = null) {
    const formData = new FormData();
    if (proofData.photo) formData.append("photo", proofData.photo);
    if (proofData.notes) formData.append("notes", proofData.notes);
    if (proofData.location) {
      formData.append("location", JSON.stringify(proofData.location));
    }
    // Device capture time — preserves delivery chronology when the POD syncs
    // later (see ProofOfDelivery.recorded_at). Falls back to now for a live post.
    formData.append("recorded_at", proofData.recorded_at || new Date().toISOString());
    if (clientActionId) formData.append("client_action_id", clientActionId);

    const response = await super.request(
      `/api/tracking/pod/?booking=${bookingId}`,
      {
        method: "POST",
        data: formData,
        headers: { "Content-Type": undefined },
      }
    );
    return response.data;
  }

  async submitProofOfDelivery(bookingId, proofData) {
    // Stamp the capture time NOW (not at sync time) so a POD queued offline
    // keeps its true delivery chronology when it eventually syncs.
    proofData = { ...proofData, recorded_at: proofData.recorded_at || new Date().toISOString() };
    console.log(
      `[DriverAPI] Submitting proof for booking ${bookingId}`,
      {
        hasPhoto: !!proofData.photo,
        hasNotes: !!proofData.notes,
        hasLocation: !!proofData.location,
        recordedAt: proofData.recorded_at,
      }
    );

    if (await this._shouldQueue()) {
      // The photo (a File from an <input type="file">/camera capture) is
      // itself a Blob, so it's stored as-is in the podPhotos table and
      // reconstructed into FormData at flush time.
      const { clientActionId } = await enqueueAction({
        type: ACTION_TYPES.POD_SUBMIT,
        bookingId,
        payload: { notes: proofData.notes, location: proofData.location, recorded_at: proofData.recorded_at },
        photoBlob: proofData.photo || null,
      });
      console.log(
        `[DriverAPI] Offline — queued POD for booking ${bookingId} (${clientActionId})`,
      );
      return {
        success: true,
        queued: true,
        clientActionId,
        data: { booking: bookingId, notes: proofData.notes },
        statusUpdated: true,
      };
    }

    try {
      const data = await this._submitProofOfDeliveryRaw(bookingId, proofData);
      console.log("[DriverAPI] Proof of Delivery submitted successfully:", data);
      const updatedJob = await this.getJob(bookingId);
      return { success: true, data, updatedJob, statusUpdated: true };
    } catch (error) {
      if (!error?.response) {
        const { clientActionId } = await enqueueAction({
          type: ACTION_TYPES.POD_SUBMIT,
          bookingId,
          payload: { notes: proofData.notes, location: proofData.location, recorded_at: proofData.recorded_at },
          photoBlob: proofData.photo || null,
        });
        console.warn(
          `[DriverAPI] POD request failed mid-flight — queued for booking ${bookingId} (${clientActionId})`,
        );
        return {
          success: true,
          queued: true,
          clientActionId,
          data: { booking: bookingId, notes: proofData.notes },
          statusUpdated: true,
        };
      }
      console.error(
        `[DriverAPI] Failed to submit proof for booking ${bookingId}:`,
        error
      );
      return {
        success: false,
        code: error.code || "REQUEST_ERROR",
        message:
          error.response?.data?.detail ||
          error.response?.data?.error ||
          "Failed to submit proof of delivery",
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
    console.log(
      "[DriverAPI] Calling getEarnings() - Computing earnings from payouts",
    );
    const payouts = await this.getPayouts();
    console.log(
      "[DriverAPI] Raw payouts data for earnings calculation:",
      payouts,
    );
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
    console.log(
      "[DriverAPI] Calling getAvailability() - Fetching driver availability",
    );
    const response = await super.request("/api/driver/availability/");
    return response.data;
  }

  async updateAvailability(data) {
    console.log("[DriverAPI] Updating availability with data:", data);
    try {
      const response = await this.request("/api/driver/availability/me/", {
        method: "PATCH",
        data: data,
      });
      return { success: true, data: response.data };
    } catch (error) {
      console.error("[DriverAPI] Availability update failed:", error);
      return {
        success: false,
        code: error.code || "UPDATE_ERROR",
        message: error.message || "Failed to update availability",
        status: error.response?.status,
        details: error.response?.data, // Capture backend error details
      };
    }
  }

  // Documents Management
  async getDocuments() {
    console.log(
      "[DriverAPI] Calling getDocuments() - Fetching driver documents",
    );
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
        message:
          error.response?.data?.detail ||
          error.response?.data?.file?.[0] ||
          error.message ||
          "Failed to upload document",
        status: error.response?.status,
        data: error.response?.data,
      };
    }
  }
  async deleteDocument(docId) {
    console.log(
      `[DriverAPI] Calling deleteDocument() - Deleting document ID: ${docId}`,
    );
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
    console.log(
      "[DriverAPI] Calling getCurrentLocation() - Requesting geolocation",
    );
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

  // Add to DriverAPI class to prevent delivered booking update
  async bulkUpdateStatus(updates, newStatus) {
    return super
      .request("/api/booking/bookings/bulk-update-status/", {
        method: "POST",
        data: {
          updates: updates.map((id) => ({
            booking_id: id,
            new_status: newStatus,
          })),
        },
      })
      .then((res) => res.data)
      .catch((err) => {
        throw err;
      });
  }

  // UPDATED: checkImmutable (now calls the new backend endpoint)
  async checkImmutable(jobId) {
    try {
      const response = await super.request(
        `/api/booking/bookings/${jobId}/check-immutable/`,
      );
      return {
        success: true,
        immutable: response.data.immutable,
        reason: response.data.reason,
      };
    } catch (error) {
      console.error("[DriverAPI] checkImmutable error:", error);
      return { success: false, immutable: false, reason: null };
    }
  }

  async batchCheckImmutable(jobIds) {
    try {
      const response = await super.request(
        "/api/booking/bookings/bulk-check-immutable/",
        {
          method: "POST",
          data: { ids: jobIds },
        },
      );
      return { success: true, data: response.data };
    } catch (error) {
      console.error("[DriverAPI] Batch check error:", error);
      throw error;
    }
  }

  // Get current route for the driver (requires driver_id parameter)
  async getCurrentRoute(driver_id = null) {
    /**
     * Fetches the driver's current active route, including bookings/stops.
     * @param {string} driver_id - Optional. If not provided, will fetch from profile first.
     * @returns {Promise<Object>} - { success: boolean, data: Object | null, error?: string }
     */
    const cacheKey = `current-route:${driver_id || "self"}`;

    // If we already know we're offline, skip straight to cache rather than
    // failing on the getProfile() call this function would otherwise make
    // first (that GET would just fail too, wasting a heartbeat round trip).
    if (await this._shouldQueue()) {
      const cached = await this._readCache(cacheKey);
      if (cached) {
        console.warn("[DriverAPI] Serving cached current route (offline)");
        return { success: true, data: cached, _stale: true, _cachedAt: cached._cachedAt };
      }
      return { success: false, error: "Offline and no cached route available" };
    }

    try {
      // If driver_id not provided, fetch from profile
      let id = driver_id;
      if (!id) {
        const profileResult = await this.getProfile();
        if (!profileResult.success || !profileResult.data?.driver_profile) {
          console.error("[DriverAPI] Could not fetch driver profile");
          return { success: false, error: "Failed to fetch driver profile" };
        }
        id = profileResult.data.driver_profile;
      }

      const url = `/api/driver/live-tracking/current-route/?driver_id=${id}`;
      console.log(`[DriverAPI] Fetching current route for driver: ${id}`);
      const response = await this.request(url);
      await this._cacheRead(cacheKey, response.data);
      return { success: true, data: response.data };
    } catch (error) {
      if (error.response?.status === 404) {
        console.log("[DriverAPI] No active route found (404)");
        return { success: true, data: null }; // No route is valid
      }
      console.error("[DriverAPI] Get current route failed:", error);
      const cached = await this._readCache(cacheKey);
      if (cached) {
        console.warn("[DriverAPI] Serving cached current route after fetch failure");
        return { success: true, data: cached, _stale: true, _cachedAt: cached._cachedAt };
      }
      return { success: false, error: error.message };
    }
  }
  async toggleTracking() {
    try {
      const response = await super.request(
        "/api/driver/live-driver/toggle-tracking/",
        {
          method: "POST",
        },
      );

      const { is_tracking_enabled } = response.data;

      // Update local state if you keep it
      if (this.isTrackingEnabled !== undefined) {
        this.isTrackingEnabled = is_tracking_enabled;
      }

      return {
        success: true,
        isEnabled: is_tracking_enabled,
      };
    } catch (error) {
      console.error("[DriverAPI] Toggle tracking failed:", error);
      return {
        success: false,
        message: error.response?.data?.message || "Failed to toggle tracking",
        status: error.response?.status,
      };
    }
  }

  // Get current tracking status from profile
  async getTrackingStatus() {
    /**
     * Fetches the current tracking status for the authenticated driver.
     * @returns {Promise<Object>} - { success: boolean, isEnabled: boolean }
     */
    try {
      const profileResult = await this.getProfile();
      if (profileResult.success && profileResult.data) {
        const driverProfile = profileResult.data.driver_profile;
        return {
          success: true,
          isEnabled: driverProfile?.is_tracking_enabled || false,
        };
      }
      return { success: false, isEnabled: false };
    } catch (error) {
      console.error("[DriverAPI] getTrackingStatus error:", error);
      return { success: false, isEnabled: false };
    }
  }

  // Send current location to backend via HTTP POST (kept for any direct
  // callers, e.g. a manual "send now" action). Routine tracking pings go
  // through bufferLocation() below instead, which is offline-safe.
  async sendLocationUpdate(locationData) {
    console.log("[DriverAPI] Sending location update:", locationData);
    try {
      const response = await this.request(
        "/api/driver/live-tracking/update-location/",
        {
          method: "POST",
          data: locationData,
        },
      );
      return { success: true, data: response.data };
    } catch (error) {
      console.error("[DriverAPI] Location update failed:", error);
      return {
        success: false,
        error: error.message,
        status: error.response?.status,
        details: error.response?.data, // Log validation errors
      };
    }
  }

  // RAW: batch endpoint used by the sync engine to flush buffered pings.
  async _sendLocationBatchRaw(locations) {
    const response = await this.request(
      "/api/driver/live-tracking/update-location/batch/",
      {
        method: "POST",
        data: { locations },
      },
    );
    return response.data;
  }

  // Flush a batch of queued offline STATUS transitions in one request. The
  // server applies each event independently + atomically and returns a
  // per-event result (applied | duplicate_ignored | conflict) — never a
  // batch-level pass/fail — so the sync engine reconciles the local queue
  // item-by-item. Events for the same booking carry a client sequence number
  // so the server can apply them in the order the driver performed them,
  // regardless of array/network arrival order.
  async _syncStatusBatchRaw(events) {
    const response = await this.request("/api/driver/sync/", {
      method: "POST",
      data: { events },
    });
    return response.data;
  }

  // Buffers a GPS ping locally rather than sending it immediately. The
  // sync engine flushes buffered pings in batches (on reconnect, and on a
  // ~45s safety timer) — this cuts network chatter even while online, and
  // means a dropped signal mid-shift never loses breadcrumb data.
  async bufferLocation(locationData) {
    await bufferLocationPing(locationData);
  }

  async fetchLiveLocations(filters = {}) {
    /**
     * Fetches live locations for all active drivers (admin only).
     * @param {Object} filters - { hub_id, only_available, minutes_since_update }
     * @returns {Promise<Object>} - { success: boolean, data: Array, error?: string }
     */
    try {
      let url = "/api/driver/live-tracking/live/";
      const params = new URLSearchParams();

      if (filters.hub_id) params.append("hub_id", filters.hub_id);
      if (filters.only_available) params.append("only_available", "true");
      if (filters.minutes_since_update)
        params.append("minutes_since_update", filters.minutes_since_update);

      if (params.toString()) url += "?" + params.toString();

      const response = await this.request(url);
      return { success: true, data: response.data };
    } catch (error) {
      console.error("[DriverAPI] Fetch live locations failed:", error);
      return { success: false, error: error.message };
    }
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
  // This is optional for drivers; mainly for admins. But if drivers need real-time updates (e.g., new assignments), use it.
  connectWebSocket(onMessageCallback) {
    let baseUrl = this.baseURL.trim(); // Trim any whitespace
    console.log(`[DriverAPI] Raw baseURL from config: "${baseUrl}"`); // Debug log to check source issue

    // Normalize: If no protocol, assume http://; fix common malformations like 'http//'
    if (!baseUrl.startsWith("http://") && !baseUrl.startsWith("https://")) {
      if (baseUrl.startsWith("//")) {
        baseUrl = `http:${baseUrl}`; // Handle '//127.0.0.1:8000' → 'http://127.0.0.1:8000'
      } else if (baseUrl.startsWith("http//")) {
        baseUrl = baseUrl.replace("http//", "http://"); // Fix 'http//127.0.0.1:8000'
      } else {
        baseUrl = `http://${baseUrl}`; // Relative → full
      }
    }

    let urlObj;
    try {
      urlObj = new URL(baseUrl);
    } catch (err) {
      console.error(
        `[DriverAPI] Invalid baseURL: ${baseUrl}. Error: ${err.message}. Falling back to localhost.`,
      );
      urlObj = new URL("http://127.0.0.1:8000"); // Hard fallback to prevent crashes
    }

    const protocol = urlObj.protocol === "https:" ? "wss" : "ws";
    const host = urlObj.host; // Correct host without protocol
    const wsUrl = `${protocol}://${host}/ws/tracking/`;
    console.log(`[DriverAPI] Connecting WebSocket to: ${wsUrl}`);

    const token = localStorage.getItem("access_token");
    if (!token) {
      console.warn(
        "[DriverAPI] No access_token in localStorage. Connection may fail.",
      );
    }

    const fullWsUrl = `${wsUrl}?token=${token}`;
    const ws = new WebSocket(fullWsUrl);
    let pingInterval;

    ws.onopen = () => {
      console.log("[DriverAPI] WebSocket connected successfully");
      // setWsConnected(true); // Assuming you pass this from dashboard
      if (this.reconnectTimeout) clearTimeout(this.reconnectTimeout);
      // Ping every 30s to keep alive
      pingInterval = setInterval(
        () => ws.send(JSON.stringify({ type: "ping" })),
        30000,
      );
    };

    ws.onclose = (event) => {
      console.log("[DriverAPI] WebSocket disconnected:", event);
      if (pingInterval) clearInterval(pingInterval);
      if (![4001, 4003].includes(event.code) && event.code !== 1000) {
        const delay = Math.min(
          1000 * Math.pow(2, this.reconnectAttempts || 0),
          10000,
        );
        this.reconnectAttempts = (this.reconnectAttempts || 0) + 1;
        this.reconnectTimeout = setTimeout(
          () => this.connectWebSocket(onMessageCallback),
          delay,
        );
      }
    };
    ws.onerror = (error) =>
      console.error("[DriverAPI] WebSocket error:", error);
    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      console.log("[DriverAPI] WebSocket message:", data);
      if (onMessageCallback) onMessageCallback(data);
    };

    return ws;
  }

  // NEW: Start periodic location updates (call when driver has active jobs)
  startLocationTracking(intervalMs = 30000) {
    // Default: every 30 seconds
    if (this.locationWatcher) {
      console.log(
        "[DriverAPI] Location tracking already active - not starting duplicate watcher",
      );
      return; // Prevent multiple watchers
    }

    // Tracking is going live — persist the flag so a refresh auto-resumes it.
    // NOTE: stopLocationTracking() does NOT clear this (it runs on unmount too);
    // only an explicit driver-off / logout clears it via clearLiveTrackingActive().
    this.markLiveTrackingActive();

    // Shared success handler
    const handlePosition = async (position) => {
      const locationData = {
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        speed_kmh: position.coords.speed ? position.coords.speed * 3.6 : null, // m/s → km/h
        heading_degrees: position.coords.heading ?? null,
        accuracy_meters: position.coords.accuracy ?? null,
      };

      // Buffer locally rather than posting immediately — the sync engine
      // flushes buffered pings in a batch on reconnect and on a periodic
      // safety timer. This is safe whether online or offline: online, it
      // just trades "one request per ping" for "one request per batch";
      // offline, it means breadcrumb data survives a dropped signal
      // instead of being silently lost.
      try {
        await this.bufferLocation(locationData);
      } catch (err) {
        console.error("[DriverAPI] Failed to buffer location update:", err);
      }
    };

    const handleError = (error) => {
      console.error("[DriverAPI] Geolocation error:", error);

      if (error.code === error.TIMEOUT) {
        console.warn(
          "[DriverAPI] High-accuracy timeout occurred → falling back to low accuracy mode",
        );

        // Start low-accuracy watcher as fallback
        this.locationWatcherLowAccuracy = navigator.geolocation.watchPosition(
          handlePosition,
          (lowErr) => {
            console.error(
              "[DriverAPI] Low-accuracy geolocation also failed:",
              lowErr,
            );
            // You could add retry logic or notify user here
          },
          {
            enableHighAccuracy: false,
            timeout: 45000, // 45 seconds for low-accuracy
            maximumAge: 10000, // Allow 10s old position
          },
        );
      } else if (error.code === error.PERMISSION_DENIED) {
        console.warn("[DriverAPI] Location permission denied");
        // Optionally: this.stopLocationTracking();
      }
    };

    // High-accuracy primary watcher
    const highAccuracyOptions = {
      enableHighAccuracy: true,
      timeout: 60000, // 60 seconds
      maximumAge: 0, // No cache — always fresh
    };

    this.locationWatcher = navigator.geolocation.watchPosition(
      handlePosition,
      handleError,
      highAccuracyOptions,
    );

    console.log("[DriverAPI] Started high-accuracy location watcher");

    // Fallback polling interval (runs in parallel as safety net)
    this.locationInterval = setInterval(async () => {
      try {
        const position = await new Promise((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(
            resolve,
            reject,
            highAccuracyOptions,
          );
        });

        await handlePosition(position); // Reuse same handler
      } catch (error) {
        console.error(
          "[DriverAPI] Interval high-accuracy getCurrentPosition failed:",
          error,
        );

        if (error.code === error.TIMEOUT) {
          console.warn(
            "[DriverAPI] Interval timeout → trying low-accuracy fallback",
          );

          try {
            const position = await new Promise((resolve, reject) => {
              navigator.geolocation.getCurrentPosition(resolve, reject, {
                enableHighAccuracy: false,
                timeout: 45000,
                maximumAge: 10000,
              });
            });

            await handlePosition(position);
          } catch (lowErr) {
            console.error(
              "[DriverAPI] Low-accuracy interval fallback also failed:",
              lowErr,
            );
          }
        }
      }
    }, intervalMs);
  }


   // { success: boolean, data?: object, message?: string }
  async _recordFailureRaw(jobId, normalizedPayload, clientActionId = null) {
    const response = await super.request(
      `/api/booking/bookings/${jobId}/report-failed/`,
      {
        method: "POST",
        data: {
          ...normalizedPayload,
          ...(clientActionId ? { client_action_id: clientActionId } : {}),
        },
      },
    );
    return response.data;
  }

  async recordFailure(jobId, payload) {
    if (!jobId || typeof jobId !== "string") {
      console.error("[DriverAPI] recordFailure: invalid jobId", jobId);
      return {
        success: false,
        code: "INVALID_INPUT",
        message: "Job ID must be a non-empty string.",
      };
    }
 
    const { failure_type = "delivery", reason, notes = "", return_to_hub = true } = payload;
 
    // Translate failure_type → is_pickup_failure bool for the backend
    const is_pickup_failure = failure_type === "pickup";
 
    // Map any frontend-only reason values to their backend canonical equivalents.
    // The backend FailedDeliveryReason now includes ALL these values (migration
    // 0022), so this mapping is belt-and-suspenders for older deployments.
    const REASON_MAP = {
      customer_not_available: "customer_not_available",
      refused_by_recipient: "refused_by_recipient",
      incorrect_address: "incorrect_address",
      business_closed: "business_closed",
      items_not_ready: "items_not_ready",
      unable_to_locate: "unable_to_locate",
      vehicle_size_mismatch: "vehicle_size_mismatch",
      // pass-through (already canonical)
      recipient_unavailable: "recipient_unavailable",
      wrong_address: "wrong_address",
      access_denied: "access_denied",
      refused: "refused",
      other: "other",
    };
    const mappedReason = REASON_MAP[reason] ?? "other";
 
    console.log(
      `[DriverAPI] recordFailure — job=${jobId} failure_type=${failure_type}`,
      `is_pickup_failure=${is_pickup_failure} reason=${mappedReason}`,
    );

    const normalizedPayload = {
      reason: mappedReason,
      notes,
      return_to_hub,
      is_pickup_failure,
    };

    if (await this._shouldQueue()) {
      const { clientActionId } = await enqueueAction({
        type: ACTION_TYPES.REPORT_FAILURE,
        bookingId: jobId,
        payload: normalizedPayload,
      });
      console.log(`[DriverAPI] Offline — queued failure report for ${jobId} (${clientActionId})`);
      return { success: true, queued: true, clientActionId };
    }
 
    try {
      const data = await this._recordFailureRaw(jobId, normalizedPayload);
      console.log("[DriverAPI] recordFailure success:", data);
      return { success: true, data };
    } catch (error) {
      if (!error?.response) {
        const { clientActionId } = await enqueueAction({
          type: ACTION_TYPES.REPORT_FAILURE,
          bookingId: jobId,
          payload: normalizedPayload,
        });
        console.warn(`[DriverAPI] Failure report request dropped mid-flight — queued (${clientActionId})`);
        return { success: true, queued: true, clientActionId };
      }
      const msg =
        error.response?.data?.detail ||
        error.response?.data?.message ||
        error.message ||
        "Failed to record failure.";
 
      console.error("[DriverAPI] recordFailure error:", {
        status: error.response?.status,
        data: error.response?.data,
        message: error.message,
      });
 
      return {
        success: false,
        code: error.response?.data?.code || "RECORD_FAILURE_ERROR",
        message: msg,
        status: error.response?.status,
      };
    }
  }
 

  // NEW: Stop location tracking (call when no active jobs)
  stopLocationTracking() {
    if (this.locationWatcher) {
      navigator.geolocation.clearWatch(this.locationWatcher);
      this.locationWatcher = null;
      console.log("[DriverAPI] Stopped primary location watcher");
    }

    if (this.locationWatcherLowAccuracy) {
      navigator.geolocation.clearWatch(this.locationWatcherLowAccuracy);
      this.locationWatcherLowAccuracy = null;
      console.log("[DriverAPI] Stopped low-accuracy fallback watcher");
    }

    if (this.locationInterval) {
      clearInterval(this.locationInterval);
      this.locationInterval = null;
      console.log("[DriverAPI] Cleared location polling interval");
    }
  }
}

export const driverApi = new DriverAPI();
export default driverApi;
