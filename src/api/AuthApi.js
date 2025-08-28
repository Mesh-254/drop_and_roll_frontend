import { ApiBase } from "./ApiBase";

class AuthApi extends ApiBase {
  async login(email, password) {
    try {
      const response = await this.request("/api/users/auth/login/", {
        method: "POST",
        data: { email: email.toLowerCase(), password },
        includeAuth: false,
      });
      if (response.data.access) {
        this.setTokens(response.data.access, response.data.refresh);
      }
      return { success: true, data: response.data };
    } catch (error) {
      return {
        success: false,
        code: error.code || "LOGIN_ERROR",
        message: error.message || "Login failed",
      };
    }
  }

  async register(userData) {
    try {
      const response = await this.request("/api/users/auth/register/", {
        method: "POST",
        data: { ...userData, email: userData.email.toLowerCase() },
        includeAuth: false,
      });
      return { success: true, data: response.data };
    } catch (error) {
      return {
        success: false,
        code: error.code || "REGISTER_ERROR",
        message: error.message || "Registration failed",
      };
    }
  }

  async confirmEmail(uid, token) {
    try {
      const response = await this.request(
        `/api/users/auth/confirm/?uid=${uid}&token=${token}`,
        {
          method: "GET",
          includeAuth: false,
        },
      );
      return { success: true, data: response.data };
    } catch (error) {
      console.log("Confirm Email Error Details:", error.data);
      return {
        success: false,
        code: error.code || "UNKNOWN_ERROR",
        message: error.message || "Email confirmation failed",
      };
    }
  }

  async resendConfirmation(email) {
    try {
      const response = await this.request(
        "/api/users/auth/resend-confirmation/",
        {
          method: "POST",
          data: { email: email.toLowerCase() },
          includeAuth: false,
        },
      );
      return { success: true, data: response.data };
    } catch (error) {
      return {
        success: false,
        code: error.code || "RESEND_ERROR",
        message: error.message || "Failed to resend confirmation",
      };
    }
  }

  async getCurrentUser() {
    try {
      const response = await this.request("/api/users/auth/me/");
      return response.data;
    } catch (error) {
      throw new Error(error.message || "Failed to fetch user");
    }
  }

  async googleAuth(idToken) {
    try {
      const response = await this.request("/api/users/auth/google/", {
        method: "POST",
        data: { token: idToken },
        includeAuth: false,
      });
      if (response.data.access) {
        this.setTokens(response.data.access, response.data.refresh);
        return {
          success: true,
          data: response.data,
          code: response.data.code || "AUTH_SUCCESS",
          message: "Google authentication successful",
        };
      }
      return {
        success: false,
        code: response.data.code || "AUTH_FAILED",
        message: response.data.error || "Google authentication failed",
      };
    } catch (error) {
      return {
        success: false,
        code: error.code || "AUTH_ERROR",
        message: error.message || "Google authentication failed",
      };
    }
  }

  async updateProfile(profileData, userType = "customer") {
    try {
      const response = await this.request(`/api/users/profile/${userType}/`, {
        method: "PATCH",
        data: profileData,
      });
      return response.data;
    } catch (error) {
      throw new Error(error.message || "Profile update failed");
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
      });
      return response.data;
    } catch (error) {
      throw new Error(error.message || "Password change failed");
    }
  }

  isAuthenticated() {
    return !!this.token;
  }
}

export const authApi = new AuthApi();
