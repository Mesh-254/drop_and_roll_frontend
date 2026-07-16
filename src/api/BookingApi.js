// BookingApi.js (Fixed inconsistent URLs: use "/api/booking/bookings/" consistently for bookings)
import { ApiBase } from "./ApiBase";

export class BookingApi extends ApiBase {


  /**
   * Download invoice PDF for a specific booking.
   * Triggers a browser download using blob response handling.
   * @param {string} bookingId - The UUID of the booking
   * @returns {Promise<{success: boolean, message?: string}>}
   */
  async downloadInvoice(bookingId) {
    if (!bookingId || typeof bookingId !== "string") {
      console.error("[BookingAPI] Invalid bookingId provided:", bookingId);
      return {
        success: false,
        code: "INVALID_INPUT",
        message: "Booking ID must be a non-empty string",
      };
    }

    try {
      console.log(`[BookingAPI] Downloading invoice for booking: ${bookingId}`);
      
      // Make request with blob response type for PDF download
      const response = await super.request(
        `/api/booking/bookings/${bookingId}/invoice/`,
        {
          method: "GET",
          responseType: "blob", // Specify blob response type for file download
        }
      );

      // Create blob URL and trigger download
      const blob = response.data || response;
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `invoice-${bookingId}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      console.log("[BookingAPI] Invoice downloaded successfully");
      return {
        success: true,
        message: "Invoice downloaded successfully",
      };
    } catch (error) {
      console.error("[BookingAPI] Error downloading invoice:", error);
      return {
        success: false,
        code: error.code || "DOWNLOAD_ERROR",
        message:
          error.response?.data?.detail ||
          error.response?.data?.error ||
          error.message ||
          "Failed to download invoice",
        status: error.response?.status,
      };
    }
  }

  // /**
  //  * Record a failed delivery attempt for a booking.
  //  * Sends reason, notes, and return_to_hub status to backend.
  //  * @param {string} bookingId - The UUID of the booking
  //  * @param {Object} data - Failure data { reason, notes, return_to_hub }
  //  * @returns {Promise<Object>} - { success: boolean, data?: Object, message?: string, status?: number }
  //  */
  // async recordFailure(bookingId, data) {
  //   if (!bookingId || typeof bookingId !== "string") {
  //     console.error("[BookingAPI] Invalid bookingId provided:", bookingId);
  //     return {
  //       success: false,
  //       code: "INVALID_INPUT",
  //       message: "Booking ID must be a non-empty string",
  //     };
  //   }

  //   if (!data || typeof data !== "object") {
  //     console.error("[BookingAPI] Invalid failure data provided:", data);
  //     return {
  //       success: false,
  //       code: "INVALID_INPUT",
  //       message: "Failure data must be a non-empty object",
  //     };
  //   }

  //   try {
  //     console.log(`[BookingAPI] Recording failure for booking: ${bookingId}`, {
  //       reason: data.reason,
  //       notes: data.notes?.substring(0, 50) + "...",
  //       return_to_hub: data.return_to_hub,
  //     });

  //     const response = await super.request(
  //       `/api/booking/bookings/${bookingId}/report-failed/`,
  //       {
  //         method: "POST",
  //         data: {
  //           reason: data.reason,
  //           notes: data.notes || "",
  //           return_to_hub: data.return_to_hub !== false, // Default to true
  //         },
  //       }
  //     );

  //     console.log("[BookingAPI] Failure recorded successfully:", response.data);
  //     return {
  //       success: true,
  //       data: response.data,
  //       message: "Failure recorded successfully",
  //     };
  //   } catch (error) {
  //     console.error("[BookingAPI] Error recording failure:", error);
  //     return {
  //       success: false,
  //       code: error.code || "REQUEST_ERROR",
  //       message:
  //         error.response?.data?.detail ||
  //         error.response?.data?.error ||
  //         error.message ||
  //         "Failed to record failure",
  //       status: error.response?.status,
  //       details: error.response?.data,
  //     };
  //   }
  // }

  // Fetch shipping types and service types for quote creation form

  async getShippingTypes() {
    try {
      const response = await this.request("/api/booking/shipping-types/", {
        method: "GET",
        includeAuth: false,
      });
      return { success: true, data: response.data };
    } catch (error) {
      return {
        success: false,
        code: error.code || "FETCH_ERROR",
        message: error.message || "Failed to fetch shipping types",
      };
    }
  }

  async getServiceTypes() {
    try {
      const response = await this.request("/api/booking/service-types/", {
        method: "GET",
        includeAuth: false,
      });
      return { success: true, data: response.data };
    } catch (error) {
      return {
        success: false,
        code: error.code || "FETCH_ERROR",
        message: error.message || "Failed to fetch service types",
      };
    }
  }

  async calculateDistance(pickupAddress, dropoffAddress) {
    try {
      const lat1 = Number.parseFloat(pickupAddress.latitude);
      const lon1 = Number.parseFloat(pickupAddress.longitude);
      const lat2 = Number.parseFloat(dropoffAddress.latitude);
      const lon2 = Number.parseFloat(dropoffAddress.longitude);

      if (isNaN(lat1) || isNaN(lon1) || isNaN(lat2) || isNaN(lon2)) {
        console.error("Invalid coordinates:", { lat1, lon1, lat2, lon2 });
        throw new Error("Invalid coordinates");
      }

      const R = 6371; // Earth's radius in km
      const dLat = this.deg2rad(lat2 - lat1);
      const dLon = this.deg2rad(lon2 - lon1);
      let a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(this.deg2rad(lat1)) *
          Math.cos(this.deg2rad(lat2)) *
          Math.sin(dLon / 2) *
          Math.sin(dLon / 2);

      // Clamp a to [0, 1] to handle floating-point precision issues
      a = Math.max(0, Math.min(1, a));

      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      const distance = R * c;
      const roundedDistance = Math.round(distance * 100) / 100;
      return roundedDistance;
    } catch (error) {
      console.error("Distance calculation failed:", error, {
        pickupAddress,
        dropoffAddress,
      });
      return 0; // Or throw to handle in UI
    }
  }

  deg2rad(deg) {
    return deg * (Math.PI / 180);
  }

/**
 * DEPRECATED: Use Ideal Postcodes API in AddressAutocomplete component instead.
 * This method is retained for backward compatibility only.
 * It returns only postcode centroids, not premise-level addresses.
 *
 * Search postcodes by partial query using postcodes.io
 * Returns basic postcode info (no individual addresses)
 */
async searchPostcodes(query) {
  if (!query || query.trim().length < 2) {
    return { success: true, data: [] };
  }
  try {
    const response = await fetch(
      `https://api.postcodes.io/postcodes?query=${encodeURIComponent(
        query.trim()
      )}&limit=10`
    );
    if (!response.ok) throw new Error("Postcode search failed");
    const json = await response.json();
    return { success: true, data: json.result || [] };
  } catch (error) {
    console.error("[DEPRECATED] Postcodes.io search error:", error);
    return { success: false, message: error.message };
  }
}

/**
 * Search for premise-level addresses using Ideal Postcodes API
 * Returns actual house numbers, street names, and building details
 * This is the recommended method for postcode searches
 */
async searchPostcodeAddresses(query, apiKey) {
  if (!query || query.trim().length < 2) {
    return { success: true, data: [] };
  }
  if (!apiKey) {
    return {
      success: false,
      message: "Ideal Postcodes API key not configured",
    };
  }

  try {
    const normalized = query.trim().toUpperCase().replace(/\s+/g, " ");
    const url = new URL("https://api.idealpostcodes.com/v1/autocomplete/addresses");
    url.searchParams.append("query", normalized);
    url.searchParams.append("api_key", apiKey);
    url.searchParams.append("limit", "8");

    const response = await fetch(url.toString());

    if (!response.ok) {
      if (response.status === 404) {
        return { success: true, data: [] };
      }
      throw new Error(`API error: ${response.status}`);
    }

    const data = await response.json();
    return { success: true, data: data.result || [] };
  } catch (error) {
    console.error("[BookingApi] Ideal Postcodes search error:", error);
    return {
      success: false,
      message: error.message || "Failed to search addresses",
    };
  }
}

/**
 * Search premise-level addresses via OUR backend proxy, which holds the
 * Ideal Postcodes API key server-side (bookings/api_views_address.py).
 *
 * This is the method PostcodeFirstAutocomplete uses — unlike
 * searchPostcodeAddresses() above, no API key ever reaches the browser, so
 * there's nothing for a curious devtools user to lift and abuse against our
 * metered Ideal Postcodes quota.
 *
 * Returns { success, results, reason? }. `reason` is only present on
 * failure ("not_configured" | "rate_limited" | "upstream_error" |
 * "bad_request") so the caller can decide whether to fall back to Google
 * Places or straight to manual entry — see PostcodeFirstAutocomplete's
 * fallback chain.
 */
async autocompleteAddress(query, limit = 10) {
  if (!query || query.trim().length < 2) {
    return { success: true, results: [] };
  }
  try {
    const response = await this.request("/api/booking/address/autocomplete/", {
      method: "GET",
      params: { query: query.trim(), limit },
      includeAuth: false, // public endpoint, used pre-authentication
    });
    // The view always returns 200 (even on upstream failure) so we can
    // branch on `reason` here instead of on HTTP status.
    return response.data;
  } catch (error) {
    console.error("[BookingApi] autocompleteAddress error:", error);
    return {
      success: false,
      reason: "upstream_error",
      message: error.message || "Address search failed",
    };
  }
}

/**
 * Fetch a full premise-level address (line1/line2/city/region/postal_code/
 * lat/lng) for a suggestion returned by autocompleteAddress(), via our
 * backend proxy. Also returns an immediate `in_service_area` / 
 * `service_area_message` preflight so the UI can warn the user before they
 * even reach the booking-create request — the backend AddressSerializer
 * still re-validates this authoritatively at booking time.
 */
async getPostcodeAddressDetails(addressId) {
  if (!addressId) {
    return { success: false, message: "Missing address id" };
  }
  try {
    const response = await this.request(
      `/api/booking/address/lookup/${encodeURIComponent(addressId)}/`,
      { method: "GET", includeAuth: false }
    );
    return response.data;
  } catch (error) {
    console.error("[BookingApi] getPostcodeAddressDetails error:", error);
    return {
      success: false,
      reason: "upstream_error",
      message: error.message || "Address lookup failed",
    };
  }
}

/**
 * DEPRECATED: Use Ideal Postcodes API instead.
 * This method returns only postcode centroid, not individual addresses.
 * Retained for backward compatibility.
 *
 * Lookup postcode by exact code (postcodes.io)
 * Returns centroid lat/lng and area info (not premise-level addresses)
 */
async lookupPostcode(postcode) {
  const clean = postcode.replace(/\s+/g, "").toUpperCase();
  try {
    const response = await fetch(
      `https://api.postcodes.io/postcodes/${encodeURIComponent(clean)}`
    );
    if (!response.ok) {
      if (response.status === 404) {
        throw new Error("Postcode not found");
      }
      throw new Error("Postcode lookup failed");
    }
    const json = await response.json();
    return { success: true, data: json.result };
  } catch (error) {
    console.error("[DEPRECATED] Postcodes.io lookup error:", error);
    return { success: false, message: error.message };
  }
}

/**
 * Validate address is within service area (MK or OX postcodes, plus any
 * extra approved districts) and geographic bounds.
 *
 * Mirrors the backend's two-tier check (bookings/utils/service_area.py) so
 * the user gets instant feedback without a round trip — but this is a UX
 * convenience only. The backend re-validates authoritatively on booking
 * create and will reject anything that slips past this client check.
 *
 * NOTE: keep SERVICE_AREAS / EXTRA_PREFIXES / ANCHORS in sync with
 * bookings/utils/service_area.py if the service area ever changes.
 */
validateAddressInServiceArea(address) {
  const SERVICE_AREAS = ["MK", "OX"];
  // Extra approved districts outside the MK/OX prefix pattern — keep in
  // sync with settings.SERVICE_AREA_EXTRA_PREFIXES on the backend.
  const EXTRA_PREFIXES = ["CV47", "SP4"];
  const RADIUS_KM = 40;
  // Same anchor points as _SERVICE_AREA_ANCHORS in service_area.py.
  const ANCHORS = [
    { lat: 52.0406, lng: -0.7594, name: "Milton Keynes" },
    { lat: 51.7520, lng: -1.2577, name: "Oxford" },
    { lat: 52.0303, lng: -0.8884, name: "Buckingham" },
    { lat: 51.9974, lng: -0.7426, name: "Newport Pagnell" },
  ];

  const postcodeTrimmed = (address.postal_code || "")
    .replace(/\s+/g, "")
    .toUpperCase();

  const matchesPrefix =
    SERVICE_AREAS.some((area) => postcodeTrimmed.startsWith(area)) ||
    EXTRA_PREFIXES.some((prefix) => postcodeTrimmed.startsWith(prefix.replace(/\s+/g, "")));

  const lat = Number.parseFloat(address.latitude);
  const lng = Number.parseFloat(address.longitude);
  const hasCoords = !Number.isNaN(lat) && !Number.isNaN(lng);

  if (!matchesPrefix) {
    // Tier 1 failed. If we also have coordinates, Tier 2 (radius) might
    // still rescue an edge-of-district postcode that just isn't in our
    // hard-coded prefix list yet — otherwise reject outright.
    if (!hasCoords) {
      return {
        valid: false,
        message: "We only deliver in the Milton Keynes (MK) and Oxford (OX) areas.",
      };
    }
  }

  if (hasCoords) {
    let nearestKm = Infinity;
    let nearestName = "service area";
    for (const anchor of ANCHORS) {
      const dKm = this._haversineKm(lat, lng, anchor.lat, anchor.lng);
      if (dKm < nearestKm) {
        nearestKm = dKm;
        nearestName = anchor.name;
      }
    }
    if (nearestKm > RADIUS_KM) {
      return {
        valid: false,
        message: `This address is ${nearestKm.toFixed(1)}km from ${nearestName}, outside our ${RADIUS_KM}km service radius.`,
      };
    }
  } else if (!matchesPrefix) {
    return {
      valid: false,
      message: "Address is outside our service area",
    };
  }

  return { valid: true };
}

/** Great-circle distance in km — shared by validateAddressInServiceArea. */
_haversineKm(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const dLat = this.deg2rad(lat2 - lat1);
  const dLng = this.deg2rad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(this.deg2rad(lat1)) * Math.cos(this.deg2rad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

//  Create quote and booking methods with improved error handling and validation
async createQuote(quoteData) {
  try {
    if (!quoteData.parcels || quoteData.parcels.length === 0) {
      throw new Error("At least one parcel is required");
    }

    const parcels = quoteData.parcels.map((p, idx) => {
      const weight = Number.parseFloat(p.weightKg);
      if (Number.isNaN(weight) || weight <= 0) {
        throw new Error(`Invalid weight for parcel ${idx + 1}`);
      }

      const dims = p.dimensions || {};
      const length = Number.parseFloat(dims.length) || 0;
      const width = Number.parseFloat(dims.width) || 0;
      const height = Number.parseFloat(dims.height) || 0;

      if (length <= 0 || width <= 0 || height <= 0) {
        throw new Error(`Invalid dimensions for parcel ${idx + 1}`);
      }

      return {
        weight_kg: weight.toFixed(2),
        dimensions: {
          length: length.toFixed(1),
          width: width.toFixed(1),
          height: height.toFixed(1),
        },
        fragile: !!p.fragile,
      };
    });

    const payload = {
      shipping_type_id: quoteData.shipmentType?.id,
      service_type_id: quoteData.service?.id,
      distance_km: Number(quoteData.distanceKm || 0),
      parcels,
      insurance_amount: Number(quoteData.insuranceAmount || 0),
      discount: Number(quoteData.discount || 0),
    };
      console.log("Quote payload:", payload);
      const response = await this.request("/api/booking/quotes/compute/", {
        method: "POST",
        data: payload,
        includeAuth: false,
      });

      return { success: true, data: response.data };
    } catch (error) {
      console.error("[createQuote] failed:", error);
      return {
        success: false,
        code: error.code || "QUOTE_CREATE_FAILED",
        message: error.message || "Failed to create quote",
      };
    }
  }

  async createBooking(bookingData) {
    try {
      const backendData = {
        pickup_address: {
          line1: bookingData.pickupAddress.line1,
          line2: bookingData.pickupAddress.line2 || "",
          city: bookingData.pickupAddress.city,
          region: bookingData.pickupAddress.region || "",
          postal_code: bookingData.pickupAddress.postal_code, // Changed from postalCode to postal_code for consistency with AddressAutocomplete
          country: "GB",
          latitude: Number.parseFloat(
            bookingData.pickupAddress.latitude.toFixed(6),
          ),
          longitude: Number.parseFloat(
            bookingData.pickupAddress.longitude.toFixed(6),
          ),
        },
        dropoff_address: {
          line1: bookingData.dropoffAddress.line1,
          line2: bookingData.dropoffAddress.line2 || "",
          city: bookingData.dropoffAddress.city,
          region: bookingData.dropoffAddress?.region || "",
          postal_code: bookingData.dropoffAddress.postal_code, // Changed from postalCode to postal_code
          country: "GB",
          latitude: Number.parseFloat(
            bookingData.dropoffAddress.latitude.toFixed(6),
          ),
          longitude: Number.parseFloat(
            bookingData.dropoffAddress.longitude.toFixed(6),
          ),
        },
        quote_id: bookingData.quoteId,
        scheduled_pickup_at: bookingData.scheduledPickupAt || null,
        scheduled_dropoff_at: bookingData.scheduledDropoffAt || null,
        promo_code: bookingData.promoCode || null,
        notes: bookingData.notes || null,
        receiver_email: bookingData.receiverEmail || null,
        receiver_phone: bookingData.receiverPhone || null,
      };

      // FIX-BUG-03: Include guest email for unauthenticated users
      if (bookingData.guestEmail) {
        backendData.guest_email = bookingData.guestEmail.trim();
        console.log("[BookingApi] Creating booking with guest email:", bookingData.guestEmail);
        // Store guest email in localStorage for later use in payment flow
        localStorage.setItem("guestEmail", bookingData.guestEmail.trim());
      }

      console.log("[BookingApi] Booking payload:", backendData);

      // includeAuth defaults to true so authenticated users send their JWT.
      // Unauthenticated (guest) users have no token so the header is simply absent.
      // Setting includeAuth: false was WRONG — it stripped the token even for
      // logged-in users, causing the backend to see every booking as anonymous
      // and demand guest_email even from authenticated customers.
      const response = await this.request("/api/booking/bookings/", {
        method: "POST",
        data: backendData,
      });

      // Guest bookings return a guest_identifier - an opaque token that,
      // together with guest_email, is now REQUIRED to look up or pay for
      // this booking later (a bare email match is no longer accepted by
      // the backend). Persist it the same way we persist guestEmail.
      const returnedIdentifier = response.data?.guest_identifier;
      if (returnedIdentifier) {
        localStorage.setItem("guestIdentifier", returnedIdentifier);
      }

      return { success: true, data: response.data };
    } catch (error) {
      console.error("[BookingApi] createBooking error:", error);
      return {
        success: false,
        code: error.code || "BOOKING_ERROR",
        message: error.message || "Failed to create booking",
      };
    }
  }

  /**
   * Get booking history/list for customer
   * @param {number} page - Page number (default 1)
   * @param {number} pageSize - Items per page (default 10)
   * @returns {Promise<Object>}
   */
  async getBookingHistory(page = 1, pageSize = 10) {
    try {
      console.log(`[BookingAPI] Fetching booking history (page: ${page})`);
      const response = await super.request(
        `/api/booking/bookings/?page=${page}&page_size=${pageSize}`,
        {
          method: "GET",
        }
      );
      console.log("[BookingAPI] Booking history fetched successfully:", response.data);
      return { success: true, data: response.data };
    } catch (error) {
      console.error("[BookingAPI] Error fetching booking history:", error);
      return {
        success: false,
        code: error.code || "FETCH_ERROR",
        message:
          error.response?.data?.detail ||
          error.message ||
          "Failed to fetch booking history",
        status: error.response?.status,
      };
    }
  }

  async getQuotes() {
    try {
      const response = await this.request("/api/booking/quotes/", {
        method: "GET",
        includeAuth: true,
      });
      return { success: true, data: response.data };
    } catch (error) {
      return {
        success: false,
        code: error.code || "FETCH_ERROR",
        message: error.message || "Failed to fetch quotes",
      };
    }
  }

  async getQuote(quoteId) {
    try {
      const response = await this.request(`/api/booking/quotes/${quoteId}/`);
      return { success: true, data: response.data };
    } catch (error) {
      return {
        success: false,
        code: error.code || "FETCH_ERROR",
        message: error.message || "Failed to fetch quote",
      };
    }
  }

  /**
   * Get booking details
   * @param {string} bookingId - The UUID of the booking
   * @returns {Promise<Object>}
   */
  async getBooking(bookingId, guestEmail, guestIdentifier) {
    if (!bookingId || typeof bookingId !== "string") {
      console.error("[BookingAPI] Invalid bookingId provided:", bookingId);
      return {
        success: false,
        code: "INVALID_INPUT",
        message: "Booking ID must be a non-empty string",
      };
    }

    try {
      console.log(`[BookingAPI] Fetching booking details: ${bookingId}`);
      // Guests are unauthenticated, so the backend identifies ownership via
      // ?guest_email=&guest_identifier= (mirrors PaymentApi.getTransaction).
      // Both are required — guest_email alone is no longer accepted.
      let url = `/api/booking/bookings/${bookingId}/`;
      const identifier = guestIdentifier || localStorage.getItem("guestIdentifier");
      if (guestEmail && identifier) {
        url += `?guest_email=${encodeURIComponent(guestEmail)}&guest_identifier=${encodeURIComponent(identifier)}`;
      }
      const response = await super.request(url, {
        method: "GET",
      });
      return { success: true, data: response.data };
    } catch (error) {
      console.error("[BookingAPI] Error fetching booking:", error);
      return {
        success: false,
        code: error.code || "FETCH_ERROR",
        message:
          error.response?.data?.detail ||
          error.message ||
          "Failed to fetch booking",
        status: error.response?.status,
      };
    }
  }

  async updateBookingStatus(bookingId, status) {
    try {
      const response = await this.request(
        `/api/booking/bookings/${bookingId}/set-status/`, // Fixed URL
        {
          method: "POST",
          data: { status },
        },
      );
      return { success: true, data: response.data };
    } catch (error) {
      return {
        success: false,
        code: error.code || "UPDATE_ERROR",
        message: error.message || "Failed to update booking status",
      };
    }
  }
  async trackBooking(trackingNumber) {
    try {
      const response = await this.request(
        `/api/booking/track/?tracking_number=${encodeURIComponent(
          trackingNumber,
        )}`,
        {
          method: "GET",
          includeAuth: false, // Public endpoint
        },
      );
      return { success: true, data: response.data };
    } catch (error) {
      return {
        success: false,
        code: error.code || "TRACK_ERROR",
        message: error.message || "Invalid tracking number",
      };
    }
  }
}

export const bookingApi = new BookingApi();
export default bookingApi;