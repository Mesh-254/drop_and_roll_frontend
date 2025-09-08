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

  async createQuote(quoteData) {
    try {
      const backendData = {
        shipping_type_id: quoteData.shipmentType?.id,
        service_type_id: quoteData.service?.id,
        weight_kg: Number.parseFloat(quoteData.weightKg),
        distance_km: Number.parseFloat(quoteData.distanceKm),
        fragile: quoteData.fragile || false,
        insurance_amount: Number.parseFloat(quoteData.insuranceAmount) || 0,
        dimensions: quoteData.dimensions || {},
        surge: Number.parseFloat(quoteData.surge) || 1.0,
        discount: Number.parseFloat(quoteData.discount) || 0.0,
      };
      console.log("Quote payload:", backendData);
      const response = await this.request("/api/booking/quotes/compute/", {
        method: "POST",
        data: backendData,
        includeAuth: false,
      });
      return { success: true, data: response.data };
    } catch (error) {
      return {
        success: false,
        code: error.code || "QUOTE_ERROR",
        message: error.message || "Failed to compute quote",
      };
    }
  }

  async createBooking(bookingData) {
    try {
      const backendData = {
        pickup_address: {
          line1:
            bookingData.pickupAddress?.line1 ||
            bookingData.pickupAddress?.street ||
            "Default Pickup Street",
          line2: bookingData.pickupAddress?.line2 || "",
          city: bookingData.pickupAddress?.city || "Default City",
          region: bookingData.pickupAddress?.region || "",
          postal_code:
            bookingData.pickupAddress?.postalCode ||
            bookingData.pickupAddress?.postal_code,
          country: "GB",
          latitude: bookingData.pickupAddress?.latitude
            ? Number.parseFloat(bookingData.pickupAddress.latitude)
            : 123,
          longitude: bookingData.pickupAddress?.longitude
            ? Number.parseFloat(bookingData.pickupAddress.longitude)
            : 123,
        },
        dropoff_address: {
          line1:
            bookingData.dropoffAddress?.line1 ||
            bookingData.dropoffAddress?.street ||
            "Default dropoff Street",
          line2: bookingData.dropoffAddress?.line2 || "",
          city: bookingData.dropoffAddress?.city || "Default City",
          region: bookingData.dropoffAddress?.region || "",
          postal_code:
            bookingData.dropoffAddress?.postalCode ||
            bookingData.dropoffAddress?.postal_code,
          country: "GB",
          latitude: bookingData.dropoffAddress?.latitude
            ? Number.parseFloat(bookingData.dropoffAddress.latitude)
            : 123,
          longitude: bookingData.dropoffAddress?.longitude
            ? Number.parseFloat(bookingData.dropoffAddress.longitude)
            : 123,
        },
        quote_id: bookingData.quoteId,
        scheduled_pickup_at: bookingData.scheduledPickupAt,
        scheduled_dropoff_at: bookingData.scheduledDropoffAt || null,
        promo_code: bookingData.promoCode || null,
        notes: bookingData.notes || null,
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
      console.log(error)
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
      const response = await this.request(`/api/booking/bookings/${bookingId}/`);  // Fixed URL
      return { success: true, data: response.data };
    } catch (error) {
      return {
        success: false,
        code: error.code || "FETCH_ERROR",
        message: error.message || "Failed to fetch booking",
      };
    }
  }

  async calculateDistance(pickupAddress, dropoffAddress) {
    try {
      const lat1 = Number.parseFloat(pickupAddress.latitude);
      const lon1 = Number.parseFloat(pickupAddress.longitude);
      const lat2 = Number.parseFloat(dropoffAddress.latitude);
      const lon2 = Number.parseFloat(dropoffAddress.longitude);

      if (!lat1 || !lon1 || !lat2 || !lon2) {
        const pickupCity = pickupAddress.city?.toLowerCase();
        const dropoffCity = dropoffAddress.city?.toLowerCase();

        if (
          pickupCity?.includes("milton keynes") &&
          dropoffCity?.includes("oxford")
        ) {
          return 35;
        } else if (
          pickupCity?.includes("oxford") &&
          dropoffCity?.includes("milton keynes")
        ) {
          return 35;
        } else {
          return 15;
        }
      }

      const R = 6371;
      const dLat = this.deg2rad(lat2 - lat1);
      const dLon = this.deg2rad(lon2 - lon1);
      const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(this.deg2rad(lat1)) *
        Math.cos(this.deg2rad(lat2)) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      const distance = R * c;
      return Math.round(distance * 100) / 100;
    } catch (error) {
      console.error("Distance calculation failed:", error);
      return 15;
    }
  }

  deg2rad(deg) {
    return deg * (Math.PI / 180);
  }

  async updateBookingStatus(bookingId, status) {
    try {
      const response = await this.request(
        `/api/booking/bookings/${bookingId}/set-status/`,  // Fixed URL
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
}

export const bookingApi = new BookingApi();