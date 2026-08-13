"use client";

import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { motion } from "framer-motion";
import {
  Lock,
  Eye,
  EyeOff,
  Loader2,
  CheckCircle,
  AlertCircle,
  ArrowLeft,
} from "lucide-react";
import { authApi } from "../../api/AuthApi";
import { getFailedRules } from "../../utils/passwordValidation";

export default function ResetPassword() {
  const [formData, setFormData] = useState({
    password: "",
    confirmPassword: "",
  });
  const [errors, setErrors] = useState({});
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [status, setStatus] = useState(""); // 'idle', 'success', 'error', 'invalid'
  const [isInvalidLink, setIsInvalidLink] = useState(false);
  const [countdown, setCountdown] = useState(3);
  const navigate = useNavigate();
  const { uid, token } = useParams();

  useEffect(() => {
    if (!uid || !token) {
      setStatus("invalid");
      setErrors({ submit: "Invalid reset link. Please request a new one." });
    }
  }, [uid, token]);

  useEffect(() => {
    const passwordInput = document.getElementById("password");
    if (passwordInput) passwordInput.focus();
  }, []);

  useEffect(() => {
    if (status === "success" && countdown > 0) {
      const timer = setTimeout(() => setCountdown((prev) => prev - 1), 1000);
      return () => clearTimeout(timer);
    } else if (status === "success" && countdown === 0) {
      navigate("/login");
    }
  }, [status, countdown, navigate]);

  const validatePassword = (password) => {
    if (!password) return "Password is required";
    const failed = getFailedRules(password);
    if (failed.length > 0) return failed.map((r) => r.label).join(", ");
    return "";
  };

  const validateConfirmPassword = (confirmPassword, password) => {
    if (!confirmPassword) return "Please confirm your password";
    if (confirmPassword !== password) return "Passwords do not match";
    return "";
  };

  const handleInputChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    let error = "";
    if (field === "password") {
      error = validatePassword(value);
      if (formData.confirmPassword) {
        const confirmError = validateConfirmPassword(
          formData.confirmPassword,
          value
        );
        setErrors((prev) => ({ ...prev, confirmPassword: confirmError }));
      }
    } else if (field === "confirmPassword") {
      error = validateConfirmPassword(value, formData.password);
    }
    setErrors((prev) => ({ ...prev, [field]: error }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const passwordError = validatePassword(formData.password);
    const confirmPasswordError = validateConfirmPassword(
      formData.confirmPassword,
      formData.password
    );
    if (passwordError || confirmPasswordError) {
      setErrors({
        password: passwordError,
        confirmPassword: confirmPasswordError,
      });
      return;
    }
    if (!uid || !token) {
      setStatus("invalid");
      return;
    }
    setIsLoading(true);
    setErrors({});
    setStatus("idle");
    try {
      const result = await authApi.resetPassword(uid, token, formData.password);
      if (result.success) {
        setStatus("success");
        setCountdown(3);
        sessionStorage.removeItem("resetEmail");
      } else {
        setStatus("error");
        let msg = result.message || "Failed to reset password.";
        if (result.code === "INVALID_RESET_LINK") {
          msg = "Invalid or expired reset link. Please request a new one.";
          setIsInvalidLink(true);
        }
        setErrors({ submit: msg });
      }
    } catch (error) {
      console.error("Error resetting password:", error);
      setStatus("error");
      setErrors({ submit: "An unexpected error occurred. Please try again." });
    } finally {
      setIsLoading(false);
    }
  };

  const isFormValid =
    formData.password &&
    formData.confirmPassword &&
    !errors.password &&
    !errors.confirmPassword;

  if (status === "invalid") {
    return (
      <div className="min-h-screen bg-gradient-to-br from-muted to-muted dark:from-card dark:to-surface flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-card dark:bg-surface rounded-2xl shadow-xl border border-border p-8 text-center max-w-md w-full"
        >
          <div className="w-16 h-16 bg-destructive-surface rounded-full flex items-center justify-center mx-auto mb-6">
            <AlertCircle className="w-8 h-8 text-destructive" />
          </div>
          <h1 className="text-2xl font-bold text-foreground mb-4">
            Invalid Reset Link
          </h1>
          <p className="text-muted-foreground mb-6">
            {errors.submit}
          </p>
          <button
            onClick={() => navigate("/forgot-password")}
            className="w-full py-3 px-4 bg-primary-hover text-primary-foreground rounded-lg hover:bg-primary-hover transition-colors"
          >
            Request New Link
          </button>
        </motion.div>
      </div>
    );
  }

  if (status === "success") {
    return (
      <div className="min-h-screen bg-gradient-to-br from-muted to-muted dark:from-card dark:to-surface flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-card dark:bg-surface rounded-2xl shadow-xl border border-border p-8 text-center max-w-md w-full"
        >
          <div className="w-16 h-16 bg-success-surface rounded-full flex items-center justify-center mx-auto mb-6">
            <CheckCircle className="w-8 h-8 text-success" />
          </div>
          <h1 className="text-2xl font-bold text-foreground mb-4">
            Password Reset Successful!
          </h1>
          <p className="text-muted-foreground mb-6">
            You can now sign in with your new password.
          </p>
          <div className="bg-info-surface border border-info/30 rounded-lg p-3 mb-6">
            <p className="text-info text-sm">
              Redirecting to login in {countdown} seconds...
            </p>
          </div>
          <button
            onClick={() => navigate("/login")}
            className="w-full py-3 px-4 bg-primary-hover text-primary-foreground rounded-lg hover:bg-primary-hover transition-colors"
          >
            Go to Login
          </button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-muted to-muted dark:from-card dark:to-surface flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-md"
      >
        <motion.button
          whileHover={{ x: -2 }}
          onClick={() => navigate("/check-email")}
          className="flex items-center gap-2 text-muted-foreground hover:text-foreground mb-8 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back
        </motion.button>
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="bg-card dark:bg-surface rounded-2xl shadow-xl border border-border p-8"
        >
          <div className="text-center mb-8">
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ duration: 0.5, delay: 0.2 }}
              className="w-16 h-16 bg-brand-surface rounded-full flex items-center justify-center mx-auto mb-4"
            >
              <Lock className="w-8 h-8 text-brand-text" />
            </motion.div>
            <h1 className="text-2xl font-bold text-foreground mb-2">
              Reset Your Password
            </h1>
            <p className="text-muted-foreground">
              Enter your new password below.
            </p>
          </div>
          {status === "error" && errors.submit && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-6 p-3 bg-destructive-surface border border-destructive/30 rounded-lg flex items-start gap-2"
            >
              <AlertCircle className="w-5 h-5 text-destructive flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-destructive text-sm">
                  {errors.submit}
                </p>
                {isInvalidLink && (
                  <button
                    type="button"
                    onClick={() => navigate("/forgot-password")}
                    className="mt-2 text-sm text-brand-text hover:text-brand-text font-medium underline"
                  >
                    Request a new reset link
                  </button>
                )}
              </div>
            </motion.div>
          )}
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label
                htmlFor="password"
                className="block text-sm font-medium text-muted-foreground mb-2"
              >
                New Password
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Lock className="w-5 h-5 text-muted-foreground" />
                </div>
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  value={formData.password}
                  onChange={(e) =>
                    handleInputChange("password", e.target.value)
                  }
                  placeholder="Enter new password"
                  className={`w-full pl-10 pr-12 py-3 border rounded-lg focus:ring-2 focus:ring-ring focus:border-primary transition-colors bg-card dark:bg-surface-hover text-foreground placeholder-subtle-foreground ${
                    errors.password
                      ? "border-destructive focus:ring-destructive focus:border-destructive"
                      : "border-border-strong"
                  }`}
                  disabled={isLoading}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-muted-foreground hover:text-muted-foreground"
                >
                  {showPassword ? (
                    <EyeOff className="w-5 h-5" />
                  ) : (
                    <Eye className="w-5 h-5" />
                  )}
                </button>
              </div>
              {errors.password && (
                <motion.p
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mt-2 text-sm text-destructive"
                >
                  {errors.password}
                </motion.p>
              )}
            </div>
            <div>
              <label
                htmlFor="confirmPassword"
                className="block text-sm font-medium text-muted-foreground mb-2"
              >
                Confirm New Password
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Lock className="w-5 h-5 text-muted-foreground" />
                </div>
                <input
                  id="confirmPassword"
                  type={showConfirmPassword ? "text" : "password"}
                  value={formData.confirmPassword}
                  onChange={(e) =>
                    handleInputChange("confirmPassword", e.target.value)
                  }
                  placeholder="Confirm new password"
                  className={`w-full pl-10 pr-12 py-3 border rounded-lg focus:ring-2 focus:ring-ring focus:border-primary transition-colors bg-card dark:bg-surface-hover text-foreground placeholder-subtle-foreground ${
                    errors.confirmPassword
                      ? "border-destructive focus:ring-destructive focus:border-destructive"
                      : "border-border-strong"
                  }`}
                  disabled={isLoading}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-muted-foreground hover:text-muted-foreground"
                >
                  {showConfirmPassword ? (
                    <EyeOff className="w-5 h-5" />
                  ) : (
                    <Eye className="w-5 h-5" />
                  )}
                </button>
              </div>
              {errors.confirmPassword && (
                <motion.p
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mt-2 text-sm text-destructive"
                >
                  {errors.confirmPassword}
                </motion.p>
              )}
            </div>
            <motion.button
              whileHover={{ scale: isFormValid && !isLoading ? 1.02 : 1 }}
              whileTap={{ scale: isFormValid && !isLoading ? 0.98 : 1 }}
              type="submit"
              disabled={!isFormValid || isLoading || status === "invalid"}
              className={`w-full py-3 px-4 rounded-lg font-medium transition-all duration-200 flex items-center justify-center gap-2 ${
                isFormValid && !isLoading && status !== "invalid"
                  ? "bg-primary-hover hover:bg-primary-hover text-primary-foreground shadow-lg hover:shadow-xl"
                  : "bg-surface-hover text-subtle-foreground dark:text-muted-foreground cursor-not-allowed"
              }`}
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Changing Password...
                </>
              ) : (
                "Change Password"
              )}
            </motion.button>
          </form>
          <div className="mt-6 text-center">
            <p className="text-sm text-muted-foreground">
              Remember your password?{" "}
              <button
                onClick={() => navigate("/login")}
                className="text-brand-text hover:text-brand-text font-medium transition-colors"
              >
                Sign in
              </button>
            </p>
          </div>
        </motion.div>
      </motion.div>
    </div>
  );
}
