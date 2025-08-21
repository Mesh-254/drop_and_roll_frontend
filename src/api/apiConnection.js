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
}

const apiConnection = new ApiConnection()

export default apiConnection