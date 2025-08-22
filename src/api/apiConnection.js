const API_BASE_URL = import.meta.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000"

class ApiConnection {
  constructor() {
    this.baseURL = API_BASE_URL
    this.token = null

    if (typeof window !== "undefined") {
      this.token = localStorage.getItem("access_token")
    }
  }

  getHeaders(includeAuth = true) {
    const headers = {
      "Content-Type": "application/json",
    }

    if (includeAuth && this.token) {
      headers["Authorization"] = `Bearer ${this.token}`
    }

    return headers
  }

  async request(endpoint, options = {}) {
    const url = `${this.baseURL}${endpoint}`
    const config = {
      headers: this.getHeaders(options.includeAuth !== false),
      ...options,
    }

    try {
      const response = await fetch(url, config)
      const data = await response.json()

      if (!response.ok) {
        const error = new Error(data.error || data.detail || "API request failed")
        error.data = data
        error.status = response.status
        throw error
      }

      return { data, status: response.status }
    } catch (error) {
      console.error("API Request Error:", error)
      throw error
    }
  }

  async login(email, password) {
    try {
      const response = await this.request("/api/users/auth/login/", {
        method: "POST",
        body: JSON.stringify({ email: email.toLowerCase(), password }),
        includeAuth: false,
      })
      if (response.data.access) {
        this.setTokens(response.data.access, response.data.refresh)
      }
      return { success: true, data: response.data }
    } catch (error) {
      return { success: false, code: error.data?.code, message: error.data?.error || error.message }
    }
  }

  async register(userData) {
    try {
      const response = await this.request("/api/users/auth/register/", {
        method: "POST",
        body: JSON.stringify({ ...userData, email: userData.email.toLowerCase() }),
        includeAuth: false,
      })
      return { success: true, data: response.data }
    } catch (error) {
      return { success: false, code: error.data?.code, message: error.data?.error || error.message }
    }
  }

  async confirmEmail(uid, token) {
    try {
      const response = await this.request(`/api/users/auth/confirm/?uid=${uid}&token=${token}`, {
        method: "GET",
        includeAuth: false,
      })
      return { success: true, data: response.data }
    } catch (error) {
      console.log("Confirm Email Error Details:", error.data); // Debug log
      return {
        success: false,
        code: error.data?.code || "UNKNOWN_ERROR",
        message: error.data?.error || error.message || "Email confirmation failed",
      }
    }
  }

  async resendConfirmation(email) {
    try {
      const response = await this.request("/api/users/auth/resend-confirmation/", {
        method: "POST",
        body: JSON.stringify({ email: email.toLowerCase() }),
        includeAuth: false,
      })
      return { success: true, data: response.data }
    } catch (error) {
      return { success: false, code: error.data?.code, message: error.data?.error || error.message }
    }
  }

  async refreshToken() {
    const refreshToken = localStorage.getItem("refresh_token")
    if (!refreshToken) {
      throw new Error("No refresh token available")
    }

    try {
      const response = await this.request("/api/users/auth/jwt/refresh/", {
        method: "POST",
        body: JSON.stringify({ refresh: refreshToken }),
        includeAuth: false,
      })

      if (response.data.access) {
        this.setTokens(response.data.access, refreshToken)
        return response.data.access
      }

      throw new Error("Token refresh failed")
    } catch (error) {
      this.logout()
      throw error
    }
  }

  async getCurrentUser() {
    try {
      const response = await this.request("/api/users/auth/me/")
      return response.data
    } catch (error) {
      if (error.status === 401) {
        try {
          await this.refreshToken()
          const retryResponse = await this.request("/api/users/auth/me/")
          return retryResponse.data
        } catch (refreshError) {
          this.logout()
          throw new Error("Session expired")
        }
      }
      throw error
    }
  }

  async googleAuth(idToken) {
    try {
      const response = await this.request("/api/users/auth/google/", {
        method: "POST",
        body: JSON.stringify({ token: idToken }),
        includeAuth: false,
      })

      if (response.data.access) {
        this.setTokens(response.data.access, response.data.refresh)
        return {
          success: true,
          data: response.data,
          code: response.data.code || "AUTH_SUCCESS",
          message: "Google authentication successful"
        }
      }

      return {
        success: false,
        code: response.data.code || "AUTH_FAILED",
        message: response.data.error || "Google authentication failed"
      }
    } catch (error) {
      return {
        success: false,
        code: error.data?.code || "AUTH_ERROR",
        message: error.data?.error || error.message || "Google authentication failed"
      }
    }
  }

  setTokens(accessToken, refreshToken) {
    this.token = accessToken
    if (typeof window !== "undefined") {
      localStorage.setItem("access_token", accessToken)
      if (refreshToken) {
        localStorage.setItem("refresh_token", refreshToken)
      }
    }
  }

  logout() {
    this.token = null
    if (typeof window !== "undefined") {
      localStorage.removeItem("access_token")
      localStorage.removeItem("refresh_token")
      localStorage.removeItem("user_data")
    }
  }

  isAuthenticated() {
    return !!this.token
  }

  async updateProfile(profileData, userType = "customer") {
    try {
      const response = await this.request(`/api/users/profile/${userType}/`, {
        method: "PATCH",
        body: JSON.stringify(profileData),
      })
      return response.data
    } catch (error) {
      throw new Error(error.data?.error || error.message || "Profile update failed")
    }
  }

  async changePassword(oldPassword, newPassword) {
    try {
      const response = await this.request("/api/users/auth/change-password/", {
        method: "POST",
        body: JSON.stringify({
          old_password: oldPassword,
          new_password: newPassword,
        }),
      })
      return response.data
    } catch (error) {
      throw new Error(error.data?.error || error.message || "Password change failed")
    }
  }

  // QUOTE AND BOOKING API CONNECTIONS 



  async createQuote(quoteData) {
    try {
      // Transform frontend data to match backend QuoteRequestSerializer
      const backendData = {
        shipment_type: quoteData.shipmentType,
        service_tier: quoteData.serviceTier,
        weight_kg: Number.parseFloat(quoteData.weightKg),
        distance_km: Number.parseFloat(quoteData.distanceKm),
        fragile: quoteData.fragile || false,
        insurance_amount: Number.parseFloat(quoteData.insuranceAmount) || 0,
        dimensions: quoteData.dimensions || {},
        surge: Number.parseFloat(quoteData.surge) || 1.0,
        discount: Number.parseFloat(quoteData.discount) || 0.0,
      }
      console.log("Quote payload:", backendData);  // Add this line for logging
      const response = await this.request("/api/booking/quotes/compute/", {
        method: "POST",
        body: JSON.stringify(backendData),
        includeAuth: false,
      })
      
      return { success: true, data: response.data }
      
    } catch (error) {
      return {
        success: false,
        code: error.data?.code || "QUOTE_ERROR",
        message: error.data?.error || error.message || "Failed to compute quote",
      }
    }
  }

  async createBooking(bookingData) {
    try {
      // Transform frontend data to match backend BookingCreateSerializer
      const backendData = {
        shipment_type: bookingData.shipmentType,
        service_tier: bookingData.serviceTier,
        weight_kg: Number.parseFloat(bookingData.weightKg),
        distance_km: Number.parseFloat(bookingData.distanceKm),
        fragile: bookingData.fragile || false,
        insurance_amount: Number.parseFloat(bookingData.insuranceAmount) || 0,
        dimensions: bookingData.dimensions || {},
        pickup_address: {
          line1: bookingData.pickupAddress.street || bookingData.pickupAddress.line1,
          line2: bookingData.pickupAddress.line2 || "",
          city: bookingData.pickupAddress.city,
          region: bookingData.pickupAddress.region || "",
          postal_code: bookingData.pickupAddress.postalCode || bookingData.pickupAddress.postal_code,
          country: "GB",
          latitude: bookingData.pickupAddress.latitude || null,
          longitude: bookingData.pickupAddress.longitude || null,
        },
        dropoff_address: {
          line1: bookingData.dropoffAddress.street || bookingData.dropoffAddress.line1,
          line2: bookingData.dropoffAddress.line2 || "",
          city: bookingData.dropoffAddress.city,
          region: bookingData.dropoffAddress.region || "",
          postal_code: bookingData.dropoffAddress.postalCode || bookingData.dropoffAddress.postal_code,
          country: "GB",
          latitude: bookingData.dropoffAddress.latitude || null,
          longitude: bookingData.dropoffAddress.longitude || null,
        },
        quote_id: bookingData.quoteId,
        scheduled_pickup_at: bookingData.scheduledPickupAt,
        scheduled_dropoff_at: bookingData.scheduledDropoffAt || null,
        promo_code: bookingData.promoCode || null,
        notes: bookingData.notes || null,
      }

      const response = await this.request("/api/bookings/", {
        method: "POST",
        body: JSON.stringify(backendData),
        includeAuth: false,
      })
      return { success: true, data: response.data }
    } catch (error) {
      return {
        success: false,
        code: error.data?.code || "BOOKING_ERROR",
        message: error.data?.error || error.message || "Failed to create booking",
      }
    }
  }

  async getQuote(quoteId) {
    try {
      const response = await this.request(`/api/quotes/${quoteId}/`)
      return { success: true, data: response.data }
    } catch (error) {
      return {
        success: false,
        code: error.data?.code || "FETCH_ERROR",
        message: error.data?.error || error.message || "Failed to fetch quote",
      }
    }
  }

  async getBooking(bookingId) {
    try {
      const response = await this.request(`/api/bookings/${bookingId}/`)
      return { success: true, data: response.data }
    } catch (error) {
      return {
        success: false,
        code: error.data?.code || "FETCH_ERROR",
        message: error.data?.error || error.message || "Failed to fetch booking",
      }
    }
  }

  async calculateDistance(pickupAddress, dropoffAddress) {
    try {
      // Simple distance calculation using Haversine formula
      // In production, you might want to use Google Maps Distance Matrix API
      const lat1 = Number.parseFloat(pickupAddress.latitude)
      const lon1 = Number.parseFloat(pickupAddress.longitude)
      const lat2 = Number.parseFloat(dropoffAddress.latitude)
      const lon2 = Number.parseFloat(dropoffAddress.longitude)

      if (!lat1 || !lon1 || !lat2 || !lon2) {
        // Fallback: estimate based on city names
        const pickupCity = pickupAddress.city?.toLowerCase()
        const dropoffCity = dropoffAddress.city?.toLowerCase()

        if (pickupCity?.includes("milton keynes") && dropoffCity?.includes("oxford")) {
          return 35 // Approximate distance between Milton Keynes and Oxford
        } else if (pickupCity?.includes("oxford") && dropoffCity?.includes("milton keynes")) {
          return 35
        } else {
          return 15 // Default within-city distance
        }
      }

      const R = 6371 // Radius of the Earth in kilometers
      const dLat = this.deg2rad(lat2 - lat1)
      const dLon = this.deg2rad(lon2 - lon1)
      const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(this.deg2rad(lat1)) * Math.cos(this.deg2rad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2)
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
      const distance = R * c // Distance in kilometers

      return Math.round(distance * 100) / 100 // Round to 2 decimal places
    } catch (error) {
      console.error("Distance calculation failed:", error)
      return 15 // Default fallback distance
    }
  }

  deg2rad(deg) {
    return deg * (Math.PI / 180)
  }

  async updateBookingStatus(bookingId, status) {
    try {
      const response = await this.request(`/api/bookings/${bookingId}/status/`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      })
      return { success: true, data: response.data }
    } catch (error) {
      return {
        success: false,
        code: error.data?.code || "UPDATE_ERROR",
        message: error.data?.error || error.message || "Failed to update booking status",
      }
    }
  }

}

const apiConnection = new ApiConnection()

export default apiConnection