import axios from "axios";
import { markSessionExpired } from "../lib/authSession";

export class ApiBase {
  constructor() {
    this.baseURL = import.meta.env.VITE_NEXT_PUBLIC_BACKEND_URL;
    this.token =
      typeof window !== "undefined"
        ? localStorage.getItem("access_token")
        : null;
    this.axiosInstance = axios.create({
      baseURL: this.baseURL,
      headers: { "Content-Type": "application/json" },
      // BUG-6: PayPal sandbox can take 8-12 s for token + order creation
      // combined.  The old 10 s default was too tight.  Payment endpoints
      // get a longer per-request override applied in the request interceptor.
      timeout: 30000,
    });

    this.axiosInstance.interceptors.request.use(
      (config) => {
        // Refresh token from localStorage to ensure latest value
        this.token =
          typeof window !== "undefined"
            ? localStorage.getItem("access_token")
            : null;

        if (config.includeAuth !== false && this.token) {
          config.headers["Authorization"] = `Bearer ${this.token}`;
        }

        // For FormData (file uploads), DELETE the Content-Type header entirely
        if (config.data instanceof FormData) {
          delete config.headers["Content-Type"];
        } else {
          config.headers["Content-Type"] = "application/json";
        }

        // BUG-6: Payment/PayPal endpoints get a generous 45 s timeout to
        // absorb slow PayPal sandbox responses (token round-trip + order
        // creation can exceed 20 s under load).
        const isPaymentPath =
          config.url?.includes("/payments/") ||
          config.url?.includes("/initiate/") ||
          config.url?.includes("/paypal-return/") ||
          config.url?.includes("/paypal-cancel/");
        if (isPaymentPath && !config._timeoutOverridden) {
          config.timeout = 45000;
          config._timeoutOverridden = true;
        }

        return config;
      },
      (error) => {
        console.error("[ApiBase] Request interceptor error:", error);
        return Promise.reject(error);
      }
    );

    this.axiosInstance.interceptors.response.use(
      (response) => response,
      async (error) => {
        const originalRequest = error.config;
        const isPaymentPath = originalRequest?.url?.includes("/payments/") ||
                              originalRequest?.url?.includes("/transactions/") ||
                              originalRequest?.url?.includes("/initiate/") ||
                              originalRequest?.url?.includes("/paypal-return/");

        if (
          error.response?.status === 401 &&
          !originalRequest._retry &&
          originalRequest.url !== "/api/auth/jwt/refresh/" &&
          !isPaymentPath &&
          originalRequest.includeAuth !== false
        ) {
          originalRequest._retry = true;
          try {
            // Single-flight: many requests can 401 at the same instant. They all
            // await ONE refresh so the rotating refresh token is spent exactly
            // once — sending it twice would hit a blacklisted token (rotation +
            // BLACKLIST_AFTER_ROTATION) and log the user out spuriously.
            const newToken = await this._refreshTokenOnce();
            originalRequest.headers["Authorization"] = `Bearer ${newToken}`;
            return this.axiosInstance(originalRequest);
          } catch (refreshError) {
            // Distinguish "refresh token is dead" (2h sliding window closed →
            // real expiry) from a transient network/5xx blip (keep tokens, let
            // the user retry). The old code checked refreshError.status, which
            // is undefined on axios errors, so this branch never fired.
            const status = refreshError?.response?.status;
            const noRefreshToken =
              refreshError?.message === "No refresh token available";
            if (status === 401 || status === 400 || noRefreshToken) {
              // Centralized expiry: clear tokens atomically, then signal the
              // React layer + other tabs. markSessionExpired() debounces, so
              // concurrent 401s produce a single logout/redirect cycle.
              this.logout();
              markSessionExpired();
              return Promise.reject(
                new Error("Session expired, please log in again")
              );
            }
            // Transient failure — do NOT log out.
            return Promise.reject(refreshError);
          }
        }

        const isSilent404 =
          error?.response?.status === 404 &&
          originalRequest?.url?.includes("/api/business/profiles/current/");

        if (!isSilent404) {
          console.error("[ApiBase] Response error:", {
            status: error.response?.status,
            message: error.message,
            url: originalRequest?.url,
          });
        }
        return Promise.reject(error);
      }
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
        status: error.response?.status,
        data: error.response?.data,
      };
      console.error("[ApiBase] Request failed:", errorResponse);
      throw errorResponse;
    }
  }

  /**
   * De-duplicated refresh. Concurrent callers share the in-flight promise, so
   * the rotating refresh token is exchanged exactly once. Resolves to the new
   * access token; persists BOTH the new access and the rotated refresh token.
   */
  _refreshTokenOnce() {
    if (!this._refreshInFlight) {
      this._refreshInFlight = this.refreshToken()
        .then(({ access, refresh }) => {
          // Persist the rotated refresh token too — the previous one is
          // blacklisted the moment this refresh succeeds.
          this.setTokens(access, refresh);
          return access;
        })
        .finally(() => {
          this._refreshInFlight = null;
        });
    }
    return this._refreshInFlight;
  }

  async refreshToken() {
    const refreshToken =
      typeof window !== "undefined"
        ? localStorage.getItem("refresh_token")
        : null;
    if (!refreshToken) {
      throw new Error("No refresh token available");
    }
    const response = await this.axiosInstance.post("/api/auth/jwt/refresh/", {
      refresh: refreshToken,
    });
    // ROTATE_REFRESH_TOKENS is on, so the response carries a NEW refresh token.
    // Return both — the caller MUST store the rotated refresh token or the next
    // refresh will fail against the now-blacklisted old one.
    return { access: response.data.access, refresh: response.data.refresh };
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
    console.log("[ApiBase] Logged out");
  }
}