"use client";

import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";

const ProtectedRoute = ({
  children,
  allowedRoles = [],
  redirectTo = "/login",
  requireAuth = true,
}) => {
  const { user, loading, isAuthenticated } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-black">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500"></div>
      </div>
    );
  }

  // Require auth but not logged in
  if (requireAuth && !isAuthenticated) {
    return <Navigate to={redirectTo} state={{ from: location }} replace />;
  }

  // Role-based access
  if (allowedRoles.length > 0 && user) {
    if (!allowedRoles.includes(user.role)) {
      return <Navigate to={getUserRedirectPath(user.role)} replace />;
    }
  }

  return children;
};

// Helper: Only for non-admin users
const getUserRedirectPath = (role) => {
  switch (role) {
    case "driver":
      return "/driver-dashboard";
    case "customer":
      return "/";
    default:
      return "/";
  }
};

export default ProtectedRoute;
