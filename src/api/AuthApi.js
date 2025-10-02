import { ApiBase } from "./ApiBase"

class AuthApi extends ApiBase {
  // In AuthApi.js, update login method:
  async login(email, password) {
    try {
      const response = await this.request("/api/users/auth/login/", {
        method: "POST",
        data: { email: email.toLowerCase(), password },
        includeAuth: false,
      })
      if (response.data.access) {
        this.setTokens(response.data.access, response.data.refresh)
        const userData = await this.getCurrentUser()
        return { success: true, data: { ...response.data, user: userData } }
      }
      // If no access but response is successful (e.g., 200 with error), treat as failure
      return { success: false, code: response.data.code || "LOGIN_ERROR", message: response.data.error || "Login failed" }
    } catch (error) {
      // Extract backend error like in register
      const backendError = error.response?.data || {};
      let code = backendError.code || "LOGIN_ERROR";
      let message = backendError.error || backendError.detail || error.message || "Login failed";
      if (message.toLowerCase().includes('not activated')) {
        code = 'ACCOUNT_NOT_ACTIVATED';
      } else if (message.toLowerCase().includes('no account found')) {
        code = 'EMAIL_NOT_FOUND';
      }
      return {
        success: false,
        code,
        message,
      }
    }
  }

  async register(userData) {
    try {
      const response = await this.request("/api/users/auth/register/", {
        method: "POST",
        data: { ...userData, email: userData.email.toLowerCase() },
        includeAuth: false,
      })
      return { success: true, data: response.data }
    } catch (error) {
      const backendError = error.response?.data || {};
      let code = backendError.code || "REGISTER_ERROR";
      let message = backendError.error || backendError.detail || error.message || "Registration failed";
      if (message.toLowerCase().includes('not activated')) {
        code = 'ACCOUNT_NOT_ACTIVATED';
      } else if (message.toLowerCase().includes('already exists')) {
        code = 'ACCOUNT_ALREADY_EXISTS';
      }
      return {
        success: false,
        code,
        message,
      };
    }
  }

  async confirmEmail(uid, token) {
    try {
      const response = await this.request(`/api/users/auth/confirm/?uid=${uid}&token=${token}`, {
        method: "GET",
        includeAuth: false,
      });
      const { code, detail, error } = response.data;

      // New: Check for error codes even on 200
      if (code === 'ACCOUNT_ALREADY_ACTIVATED' || code === 'INVALID_CONFIRMATION_LINK') {
        return {
          success: false,
          code: code,
          message: error || detail || "Confirmation failed",
        };
      }

      return {
        success: true,
        data: response.data,
        code: code || "CONFIRMATION_SUCCESS"
      };
    } catch (error) {
      const backendError = error.response?.data || {};
      return {
        success: false,
        code: backendError.code || "AUTH_ERROR",
        message: backendError.error || backendError.detail || error.message || "Google authentication failed",
      };
    }
  }

  async resendConfirmation(email) {
    try {
      const response = await this.request("/api/users/auth/resend-confirmation/", {
        method: "POST",
        data: { email: email.toLowerCase() },
        includeAuth: false,
      })
      return { success: true, data: response.data }
    } catch (error) {
      return {
        success: false,
        code: error.code || "RESEND_ERROR",
        message: error.message || "Failed to resend confirmation",
      }
    }
  }

  async getCurrentUser() {
    try {
      const response = await this.request("/api/users/auth/me/")
      return response.data
    } catch (error) {
      throw new Error(error.message || "Failed to fetch user")
    }
  }

  async googleAuth(idToken) {
    try {
      const response = await this.request("/api/users/auth/google/", {
        method: "POST",
        data: { token: idToken },
        includeAuth: false,
      })
      if (response.data.access) {
        this.setTokens(response.data.access, response.data.refresh)
        const userData = await this.getCurrentUser()
        return {
          success: true,
          data: { ...response.data, user: userData },
          code: response.data.code || "AUTH_SUCCESS",
          message: "Google authentication successful",
        }
      }
      return {
        success: false,
        code: response.data.code || "AUTH_FAILED",
        message: response.data.error || "Google authentication failed",
      }
    } catch (error) {
      return {
        success: false,
        code: error.code || "AUTH_ERROR",
        message: error.message || "Google authentication failed",
      }
    }
  }

  async updateProfile(profileData, userType = "customer") {
    try {
      const response = await this.request(`/api/users/profile/${userType}/`, {
        method: "PATCH",
        data: profileData,
      })
      return response.data
    } catch (error) {
      throw new Error(error.message || "Profile update failed")
    }
  }

  async changePassword(oldPassword, newPassword) {
    try {
      const response = await this.request("/api/users/auth/change-password/", {
        method: "POST",
        data: {
          old_password: oldPassword,
          new_password: newPassword,
        },
      })
      return response.data
    } catch (error) {
      throw new Error(error.message || "Password change failed")
    }
  }

  async forgotPassword(email) {
    try {
      const response = await this.request("/api/users/auth/forgot-password/", {
        method: "POST",
        data: { email: email.toLowerCase() },
        includeAuth: false,
      });
      return {
        success: true,
        data: response.data,
        code: response.data.code || "RESET_EMAIL_SENT",
        message: response.data.detail || "Reset email sent",
      };
    } catch (error) {
      const backendError = error.response?.data || {};
      return {
        success: false,
        code: backendError.code || "RESET_ERROR",
        message: backendError.error || backendError.detail || "Failed to send reset email",
      };
    }
  }

  async resetPassword(uid, token, newPassword) {
    try {
      const response = await this.request("/api/users/auth/reset-password/", {
        method: "POST",
        data: { uid, token, new_password: newPassword },
        includeAuth: false,
      });
      return {
        success: true,
        data: response.data,
        code: response.data.code || "PASSWORD_RESET_SUCCESS",
        message: response.data.detail || "Password reset successful",
      };
    } catch (error) {
      const backendError = error.response?.data || {};
      return {
        success: false,
        code: backendError.code || "RESET_ERROR",
        message: backendError.error || backendError.detail || "Failed to reset password",
      };
    }
  }

  isAuthenticated() {
    return !!this.token
  }
}

export const authApi = new AuthApi()
