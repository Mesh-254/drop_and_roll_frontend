import axios from "axios";

export class ApiBase {
  constructor() {
    this.baseURL =
      import.meta.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000";
    this.token =
      typeof window !== "undefined"
        ? localStorage.getItem("access_token")
        : null;
    this.axiosInstance = axios.create({
      baseURL: this.baseURL,
      headers: { "Content-Type": "application/json" },
      timeout: 10000,
    });

    this.axiosInstance.interceptors.request.use(
      (config) => {
        if (config.includeAuth !== false && this.token) {
          config.headers["Authorization"] = `Bearer ${this.token}`;
        }
        return config;
      },
      (error) => Promise.reject(error),
    );

    this.axiosInstance.interceptors.response.use(
      (response) => response,
      async (error) => {
        const originalRequest = error.config;
        if (
          error.response?.status === 401 &&
          !originalRequest._retry &&
          originalRequest.url !== "/api/users/auth/jwt/refresh/" &&
          originalRequest.includeAuth !== false // Only retry if auth was included
        ) {
          originalRequest._retry = true;
          try {
            const newToken = await this.refreshToken();
            originalRequest.headers["Authorization"] = `Bearer ${newToken}`;
            return this.axiosInstance(originalRequest);
          } catch (refreshError) {
            this.logout();
            return Promise.reject(new Error("Session expired"));
          }
        }
        return Promise.reject(error);
      },
    );
  }

  async request(endpoint, options = {}) {
    try {
      const response = await this.axiosInstance({
        url: endpoint,
        ...options,
        includeAuth: options.includeAuth !== false,
      });
      return { data: response.data, status: response.status };
    } catch (error) {
      const errorResponse = {
        success: false,
        code: error.response?.data?.code || "REQUEST_ERROR",
        message:
          error.response?.data?.error ||
          error.response?.data?.detail ||
          error.message ||
          "API request failed",
      };
      if (error.response) {
        errorResponse.status = error.response.status;
        errorResponse.data = error.response.data;
      }
      throw errorResponse;
    }
  }

  setTokens(accessToken, refreshToken) {
    this.token = accessToken;
    if (typeof window !== "undefined") {
      localStorage.setItem("access_token", accessToken);
      if (refreshToken) {
        localStorage.setItem("refresh_token", refreshToken);
      }
    }
  }

  logout() {
    this.token = null;
    if (typeof window !== "undefined") {
      localStorage.removeItem("access_token");
      localStorage.removeItem("refresh_token");
      localStorage.removeItem("user_data");
    }
  }
}
