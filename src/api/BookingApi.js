// BookingApi.js (Fixed inconsistent URLs: use "/api/booking/bookings/" consistently for bookings)
import { ApiBase } from "./ApiBase"

export class BookingApi extends ApiBase {
  async getShippingTypes() {
    try {
      const response = await this.request("/api/booking/shipping-types/", {
        method: "GET",
        includeAuth: false,
      })
      return { success: true, data: response.data }
    } catch (error) {
      return {
        success: false,
        code: error.code || "FETCH_ERROR",
        message: error.message || "Failed to fetch shipping types",
      }
    }
  }

  async getServiceTypes() {
    try {
      const response = await this.request("/api/booking/service-types/", {
        method: "GET",
        includeAuth: false,
      })
      return { success: true, data: response.data }
    } catch (error) {
      return {
        success: false,
        code: error.code || "FETCH_ERROR",
        message: error.message || "Failed to fetch service types",
      }
    }
  }

  async calculateDistance(pickupAddress, dropoffAddress) {
    try {
      const lat1 = Number.parseFloat(pickupAddress.latitude)
      const lon1 = Number.parseFloat(pickupAddress.longitude)
      const lat2 = Number.parseFloat(dropoffAddress.latitude)
      const lon2 = Number.parseFloat(dropoffAddress.longitude)

      if (isNaN(lat1) || isNaN(lon1) || isNaN(lat2) || isNaN(lon2)) {
        console.error("Invalid coordinates:", { lat1, lon1, lat2, lon2 })
        throw new Error("Invalid coordinates")
      }

      const R = 6371 // Earth's radius in km
      const dLat = this.deg2rad(lat2 - lat1)
      const dLon = this.deg2rad(lon2 - lon1)
      let a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(this.deg2rad(lat1)) * Math.cos(this.deg2rad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2)

      // Clamp a to [0, 1] to handle floating-point precision issues
      a = Math.max(0, Math.min(1, a))

      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
      const distance = R * c
      const roundedDistance = Math.round(distance * 100) / 100
      return roundedDistance
    } catch (error) {
      console.error("Distance calculation failed:", error, {
        pickupAddress,
        dropoffAddress
      })
      return 0 // Or throw to handle in UI
    }
  }

  deg2rad(deg) {
    return deg * (Math.PI / 180)
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
      }
      console.log("Quote payload:", backendData)
      const response = await this.request("/api/booking/quotes/compute/", {
        method: "POST",
        data: backendData,
        includeAuth: false,
      })
      return { success: true, data: response.data }
    } catch (error) {
      return {
        success: false,
        code: error.code || "QUOTE_ERROR",
        message: error.message || "Failed to compute quote",
      }
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
          postal_code: bookingData.pickupAddress.postal_code,  // Changed from postalCode to postal_code for consistency with AddressAutocomplete
          country: "GB",
          latitude: Number.parseFloat(bookingData.pickupAddress.latitude.toFixed(6)),
          longitude: Number.parseFloat(bookingData.pickupAddress.longitude.toFixed(6)),
        },
        dropoff_address: {
          line1: bookingData.dropoffAddress.line1,
          line2: bookingData.dropoffAddress.line2 || "",
          city: bookingData.dropoffAddress.city,
          region: bookingData.dropoffAddress?.region || "",
          postal_code: bookingData.dropoffAddress.postal_code,  // Changed from postalCode to postal_code
          country: "GB",
          latitude: Number.parseFloat(bookingData.dropoffAddress.latitude.toFixed(6)),
          longitude: Number.parseFloat(bookingData.dropoffAddress.longitude.toFixed(6)),
        },
        quote_id: bookingData.quoteId,
        scheduled_pickup_at: bookingData.scheduledPickupAt,
        scheduled_dropoff_at: bookingData.scheduledDropoffAt || null,
        promo_code: bookingData.promoCode || null,
        notes: bookingData.notes || null,
        receiver_email: bookingData.receiverEmail,
        receiver_phone: bookingData.receiverPhone,
      }

      if (bookingData.guestEmail) {
        backendData.guest_email = bookingData.guestEmail.trim()
      }

      console.log("Booking payload:", backendData)

      const response = await this.request("/api/booking/bookings/", {
        method: "POST",
        data: backendData,
        includeAuth: true,
      })
      return { success: true, data: response.data }
    } catch (error) {
      console.log(error)
      return {
        success: false,
        code: error.code || "BOOKING_ERROR",
        message: error.message || "Failed to create booking",
      }
    }
  }

  async getBookings() {
    try {
      const response = await this.request("/api/booking/bookings/", {
        method: "GET",
        includeAuth: true,
      })
      return { success: true, data: response.data }
    } catch (error) {
      return {
        success: false,
        code: error.code || "FETCH_ERROR",
        message: error.message || "Failed to fetch bookings",
      }
    }
  }

  async getQuotes() {
    try {
      const response = await this.request("/api/booking/quotes/", {
        method: "GET",
        includeAuth: true,
      })
      return { success: true, data: response.data }
    } catch (error) {
      return {
        success: false,
        code: error.code || "FETCH_ERROR",
        message: error.message || "Failed to fetch quotes",
      }
    }
  }

  async getQuote(quoteId) {
    try {
      const response = await this.request(`/api/booking/quotes/${quoteId}/`)
      return { success: true, data: response.data }
    } catch (error) {
      return {
        success: false,
        code: error.code || "FETCH_ERROR",
        message: error.message || "Failed to fetch quote",
      }
    }
  }

  async getBooking(bookingId) {
    try {
      const response = await this.request(`/api/booking/bookings/${bookingId}/`) // Fixed URL
      return { success: true, data: response.data }
    } catch (error) {
      return {
        success: false,
        code: error.code || "FETCH_ERROR",
        message: error.message || "Failed to fetch booking",
      }
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
      )
      return { success: true, data: response.data }
    } catch (error) {
      return {
        success: false,
        code: error.code || "UPDATE_ERROR",
        message: error.message || "Failed to update booking status",
      }
    }
  }
}

export const bookingApi = new BookingApi()
