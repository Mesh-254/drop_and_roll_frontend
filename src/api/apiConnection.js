// API Connection Layer for Drop 'n Roll Authentication
const API_BASE_URL = import.meta.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000"

class ApiConnection {
  constructor() {
    this.baseURL = API_BASE_URL
    this.token = null

    // Initialize token from localStorage if available
    if (typeof window !== "undefined") {
      this.token = localStorage.getItem("access_token")
    }
  }

  // Set authorization header
  getHeaders(includeAuth = true) {
    const headers = {
      "Content-Type": "application/json",
    }

    if (includeAuth && this.token) {
      headers["Authorization"] = `Bearer ${this.token}`
    }

    return headers
  }

  // Generic API request method
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
        throw new Error(data.detail || data.message || "API request failed")
      }

      return { data, status: response.status }
    } catch (error) {
      console.error("API Request Error:", error)
      throw error
    }
  }

  // Authentication Methods
  async login(email, password) {
    try {
      const response = await this.request("/api/auth/jwt/create/", {
        method: "POST",
        body: JSON.stringify({ email, password }),
        includeAuth: false,
      })

      if (response.data.access) {
        this.setTokens(response.data.access, response.data.refresh)
        return response.data
      }

      throw new Error("Invalid login response")
    } catch (error) {
      throw new Error(error.message || "Login failed")
    }
  }

  async register(userData) {
    try {
      const response = await this.request("/api/users/auth/register/", {
        method: "POST",
        body: JSON.stringify(userData),
        includeAuth: false,
      })

      return response.data
    } catch (error) {
      throw new Error(error.message || "Registration failed")
    }
  }

  async confirmEmail(uid, token) {
    try {
      const response = await this.request(`/api/users/auth/confirm-email/?uid=${uid}&token=${token}`, {
        method: "GET",
        includeAuth: false,
      })

      return response.data
    } catch (error) {
      throw new Error(error.message || "Email confirmation failed")
    }
  }

  async refreshToken() {
    const refreshToken = localStorage.getItem("refresh_token")
    if (!refreshToken) {
      throw new Error("No refresh token available")
    }

    try {
      const response = await this.request("api/auth/jwt/refresh/", {
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
      if (error.message.includes("401")) {
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

  async googleAuth(googleToken) {
    try {
      const response = await this.request("/api/auth/google/", {
        method: "POST",
        body: JSON.stringify({ token: googleToken }),
        includeAuth: false,
      })

      if (response.data.access) {
        this.setTokens(response.data.access, response.data.refresh)
        return response.data
      }

      throw new Error("Google authentication failed")
    } catch (error) {
      throw new Error(error.message || "Google authentication failed")
    }
  }

  // Token Management
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

  // Profile Methods
  async updateProfile(profileData, userType = "customer") {
    try {
      const response = await this.request(`/api/profile/${userType}/`, {
        method: "PATCH",
        body: JSON.stringify(profileData),
      })

      return response.data
    } catch (error) {
      throw new Error(error.message || "Profile update failed")
    }
  }

  async changePassword(oldPassword, newPassword) {
    try {
      const response = await this.request("/api/auth/change-password/", {
        method: "POST",
        body: JSON.stringify({
          old_password: oldPassword,
          new_password: newPassword,
        }),
      })

      return response.data
    } catch (error) {
      throw new Error(error.message || "Password change failed")
    }
  }
}

// Create singleton instance
const apiConnection = new ApiConnection()

export default apiConnection
