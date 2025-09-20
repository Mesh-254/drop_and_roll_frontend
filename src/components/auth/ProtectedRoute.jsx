"use client"

import { Navigate, useLocation } from "react-router-dom"
import { useAuth } from "../../contexts/AuthContext"

const ProtectedRoute = ({ children, allowedRoles = [], redirectTo = "/login", requireAuth = true }) => {
  const { user, loading, isAuthenticated } = useAuth()
  const location = useLocation()

  // Show loading spinner while checking authentication
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500"></div>
      </div>
    )
  }

  // If authentication is required but user is not authenticated
  if (requireAuth && !isAuthenticated) {
    return <Navigate to={redirectTo} state={{ from: location }} replace />
  }

  // If specific roles are required, check user role
  if (allowedRoles.length > 0 && user) {
    if (!allowedRoles.includes(user.role)) {
      // Redirect based on user role
      const userRedirectPath = getUserRedirectPath(user.role)
      return <Navigate to={userRedirectPath} replace />
    }
  }

  return children
}

// Helper function to get redirect path based on user role
const getUserRedirectPath = (role) => {
  switch (role) {
    case "driver":
      return "/driver-dashboard"
    case "customer":
      return "/"
    case "admin":
      return "/admin-dashboard"
    default:
      return "/"
  }
}

export default ProtectedRoute
