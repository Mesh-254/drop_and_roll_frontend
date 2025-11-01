"use client";

import { createContext, useContext, useState, useEffect } from "react";
import { authApi } from "../api/AuthApi";

const AuthContext = createContext();

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    checkAuthStatus();
  }, []);

  const checkAuthStatus = async () => {
    setLoading(true);
    try {
      if (authApi.isAuthenticated()) {
        const userData = await authApi.getCurrentUser();
        setUser(userData);
        setIsAuthenticated(true);
      } else {
        setUser(null);
        setIsAuthenticated(false);
      }
    } catch (error) {
      console.error("Auth check failed:", error);
      // Fixed: Only logout on auth-specific failures (e.g., 401 after refresh attempt)
      // This prevents logout on transient errors like network issues
      const isAuthError =
        error.status === 401 ||
        error.code === "INVALID_TOKEN" ||
        error.code === "SESSION_EXPIRED" || // Add backend-specific codes as needed
        error.message?.includes("Session expired") ||
        error.message?.includes("Token invalid");

      if (isAuthError) {
        console.log("Detected invalid session, logging out");
        authApi.logout();
      } else {
        console.log(
          "Transient error during auth check, keeping tokens for retry"
        );
        // Don't logout—tokens may still be valid; retry on next action
      }
      setUser(null);
      setIsAuthenticated(false);
    } finally {
      setLoading(false);
    }
  };

  const login = async (email, password, rememberMe = false) => {
    try {
      const response = await authApi.login(email, password);
      localStorage.removeItem("guestEmail"); // Clear guest email
      if (response.success) {
        if (rememberMe) {
          localStorage.setItem("remember_me", "true");
          localStorage.setItem("user_data", JSON.stringify(response.data));
        } else {
          localStorage.removeItem("remember_me");
        }
        if (response.data.user) {
          setUser(response.data.user);
          setIsAuthenticated(true);
        } else {
          await checkAuthStatus(); // Fallback to refresh user data
        }
        return { success: true, data: response.data };
      }
      return {
        success: false,
        code: response.code,
        message: response.message,
      };
    } catch (error) {
      return {
        success: false,
        code: "NETWORK_ERROR",
        message: error.message || "Login failed. Please try again.",
      };
    }
  };

  const register = async (userData) => {
    try {
      const response = await authApi.register(userData);
      if (response.success) {
        // Don't auto-login after register—user must confirm email
        return { success: true, data: response.data };
      }
      return {
        success: false,
        code: response.code,
        message: response.message,
      };
    } catch (error) {
      return {
        success: false,
        code: error.data?.code || "REGISTER_ERROR",
        message: error.data?.error || "Registration failed. Please try again.",
      };
    }
  };

  const confirmEmail = async (uid, token) => {
    try {
      const response = await authApi.confirmEmail(uid, token);
      return { success: true, data: response.data };
    } catch (error) {
      return {
        success: false,
        code: error.data?.code,
        message: error.data?.error || error.message,
      };
    }
  };

  const googleAuth = async (idToken) => {
    const result = await authApi.googleAuth(idToken);
    localStorage.removeItem("guestEmail"); // Clear guest email

    if (result.success) {
      if (result.data.user) {
        setUser(result.data.user);
        setIsAuthenticated(true);
      } else {
        const userData = await authApi.getCurrentUser();
        setUser(userData);
        setIsAuthenticated(true);
      }
    }
    return result;
  };

  const logout = () => {
    authApi.logout();
    setUser(null);
    setIsAuthenticated(false);
    localStorage.removeItem("remember_me");
    localStorage.removeItem("user_data");
    localStorage.removeItem("guestEmail"); // Clear guest email
  };

  const isCustomer = () => user?.role === "customer";
  const isDriver = () => user?.role === "driver";
  const isAdmin = () => user?.role === "admin";

  const getRedirectPath = (userRole) => {
    switch (userRole) {
      case "driver":
        return "/driver-dashboard";
      case "customer":
        return "/";
      default:
        return "/";
    }
  };

  const value = {
    user,
    loading,
    isAuthenticated,
    login,
    register,
    confirmEmail,
    googleAuth,
    logout,
    checkAuthStatus,
    isCustomer,
    isDriver,
    isAdmin,
    getRedirectPath,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
