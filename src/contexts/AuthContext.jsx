"use client";

import { createContext, useContext, useState, useEffect } from "react";
import apiConnection from "../api/apiConnection";

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
    try {
      if (apiConnection.isAuthenticated()) {
        const userData = await apiConnection.getCurrentUser();
        setUser(userData);
        setIsAuthenticated(true);
      }
    } catch (error) {
      console.error("Auth check failed:", error);
      logout();
    } finally {
      setLoading(false);
    }
  };

  const login = async (email, password, rememberMe = false) => {
    try {
      const response = await apiConnection.login(email, password);
      if (response.success) {
        if (rememberMe) {
          localStorage.setItem("remember_me", "true");
          localStorage.setItem("user_data", JSON.stringify(response.data));
        } else {
          localStorage.removeItem("remember_me");
        }
        const userData = await apiConnection.getCurrentUser();
        setUser(userData);
        setIsAuthenticated(true);
        return { success: true, data: response.data };
      } else {
        return {
          success: false,
          code: response.code,
          message: response.message,
        };
      }
    } catch (error) {
      return {
        success: false,
        code: "NETWORK_ERROR",
        message: "Network error occurred. Please try again.",
      };
    }
  };

  const register = async (userData) => {
    try {
      const response = await apiConnection.register(userData);
      if (response.success) {
        return { success: true, data: response.data };
      } else {
        return {
          success: false,
          code: response.code,
          message: response.message,
        };
      }
    } catch (error) {
      return {
        success: false,
        code: error.data?.code || "NETWORK_ERROR",
        message:
          error.data?.error || "Network error occurred. Please try again.",
      };
    }
  };

  const confirmEmail = async (uid, token) => {
    try {
      const response = await apiConnection.confirmEmail(uid, token);
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
    const result = await apiConnection.googleAuth(idToken)
    if (result.success) {
      const userData = await apiConnection.getCurrentUser()
      setUser(userData)
    }
    return result
  }


  const logout = () => {
    apiConnection.logout();
    setUser(null);
    setIsAuthenticated(false);
    localStorage.removeItem("remember_me");
    localStorage.removeItem("user_data");
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
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
