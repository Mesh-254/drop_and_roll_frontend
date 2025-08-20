"use client"

import { createContext, useContext, useState, useEffect } from "react"
import apiConnection from "../api/apiConnection"

const AuthContext = createContext()

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider")
  }
  return context
}

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [isAuthenticated, setIsAuthenticated] = useState(false)

  useEffect(() => {
    checkAuthStatus()
  }, [])

  const checkAuthStatus = async () => {
    try {
      if (apiConnection.isAuthenticated()) {
        const userData = await apiConnection.getCurrentUser()
        setUser(userData)
        setIsAuthenticated(true)
      }
    } catch (error) {
      console.error("Auth check failed:", error)
      logout()
    } finally {
      setLoading(false)
    }
  }

  const login = async (email, password, rememberMe = false) => {
    try {
      const response = await apiConnection.login(email, password)

      // Handle remember me functionality
      if (rememberMe) {
        localStorage.setItem("remember_me", "true")
      } else {
        localStorage.removeItem("remember_me")
      }

      const userData = await apiConnection.getCurrentUser()
      setUser(userData)
      setIsAuthenticated(true)

      return { success: true, data: response }
    } catch (error) {
      return { success: false, error: error.message }
    }
  }

  const register = async (userData) => {
    try {
      const response = await apiConnection.register(userData)
      console.log(response)
      return { success: true, data: response }
    } catch (error) {
      return { success: false, error: error.message }
    }
  }

  const confirmEmail = async (uid, token) => {
    try {
      const response = await apiConnection.confirmEmail(uid, token)
      return { success: true, data: response }
    } catch (error) {
      return { success: false, error: error.message }
    }
  }

  const logout = () => {
    apiConnection.logout()
    setUser(null)
    setIsAuthenticated(false)
    localStorage.removeItem("remember_me")
  }

  const value = {
    user,
    loading,
    isAuthenticated,
    login,
    register,
    confirmEmail,
    logout,
    checkAuthStatus,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
