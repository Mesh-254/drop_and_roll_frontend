"use client";

import { useEffect } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import { useAuthModal } from "../../contexts/AuthModalContext";

const ProtectedRoute = ({
  children,
  allowedRoles = [],
  requireAuth = true,
}) => {
  const { user, loading, isAuthenticated } = useAuth();
  const { openLogin, isOpen } = useAuthModal();
  const location = useLocation();

  // Open the login modal in place instead of navigating to /login,
  // so the user stays on the current page (dimmed behind the modal).
  // We also store location.state.from via the modal's post-login navigate.
  useEffect(() => {
    if (!loading && requireAuth && !isAuthenticated) {
      openLogin();
    }
  }, [loading, requireAuth, isAuthenticated]); // eslint-disable-line react-hooks/exhaustive-deps

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-black">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500"></div>
      </div>
    );
  }

  // Not authenticated — render nothing (modal is open).
  if (requireAuth && !isAuthenticated) {
    return null;
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
