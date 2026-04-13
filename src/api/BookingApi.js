// BookingApi.js (Fixed inconsistent URLs: use "/api/booking/bookings/" consistently for bookings)
import { ApiBase } from "./ApiBase";

export class BookingApi extends ApiBase {
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
 * Validate address is within service area (MK or OX postcodes)
 * and geographic bounds
 */
validateAddressInServiceArea(address) {
  const SERVICE_AREAS = ["MK", "OX"];
  const BOUNDS = {
    southWest: { lat: 51.65, lng: -1.35 },
    northEast: { lat: 52.1, lng: -0.65 },
  };

  // Check postcode
  const postcodeTrimmed = (address.postal_code || "")
    .replace(/\s+/g, "")
    .toUpperCase();
  const isInServiceArea = SERVICE_AREAS.some((area) =>
    postcodeTrimmed.startsWith(area)
  );

  if (!isInServiceArea) {
    return {
      valid: false,
      message: "We only deliver in Milton Keynes (MK) and Oxford (OX) areas",
    };
  }

  // Check bounds
  const lat = address.latitude;
  const lng = address.longitude;

  if (
    !lat ||
    !lng ||
    lat < BOUNDS.southWest.lat ||
    lat > BOUNDS.northEast.lat ||
    lng < BOUNDS.southWest.lng ||
    lng > BOUNDS.northEast.lng
  ) {
    return {
      valid: false,
      message: "Address is outside our service area",
    };
  }

  return { valid: true };
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
        scheduled_pickup_at: bookingData.scheduledPickupAt,
        scheduled_dropoff_at: bookingData.scheduledDropoffAt || null,
        promo_code: bookingData.promoCode || null,
        notes: bookingData.notes || null,
        receiver_email: bookingData.receiverEmail || null,
        receiver_phone: bookingData.receiverPhone || null,
      };

      if (bookingData.guestEmail) {
        backendData.guest_email = bookingData.guestEmail.trim();
      }

      console.log("Booking payload:", backendData);

      const response = await this.request("/api/booking/bookings/", {
        method: "POST",
        data: backendData,
        includeAuth: true,
      });
      return { success: true, data: response.data };
    } catch (error) {
      console.log(error);
      return {
        success: false,
        code: error.code || "BOOKING_ERROR",
        message: error.message || "Failed to create booking",
      };
    }
  }

  async getBookings() {
    try {
      const response = await this.request("/api/booking/bookings/", {
        method: "GET",
        includeAuth: true,
      });
      return { success: true, data: response.data };
    } catch (error) {
      return {
        success: false,
        code: error.code || "FETCH_ERROR",
        message: error.message || "Failed to fetch bookings",
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

  async getBooking(bookingId) {
    try {
      const response = await this.request(
        `/api/booking/bookings/${bookingId}/`,
      ); // Fixed URL
      return { success: true, data: response.data };
    } catch (error) {
      return {
        success: false,
        code: error.code || "FETCH_ERROR",
        message: error.message || "Failed to fetch booking",
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
