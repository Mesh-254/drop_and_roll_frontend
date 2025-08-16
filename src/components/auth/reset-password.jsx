"use client";

import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";

// eslint-disable-next-line no-unused-vars
import { motion } from "framer-motion";

import { Lock, Eye, EyeOff, Loader2, CheckCircle, XCircle } from "lucide-react";

export default function ResetPassword() {
  const [formData, setFormData] = useState({
    password: "",
    confirmPassword: "",
  });
  const [errors, setErrors] = useState({});
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [status, setStatus] = useState(""); // 'success', 'error', 'invalid'
  const [countdown, setCountdown] = useState(3);

  const navigate = useNavigate();
  const { token } = useParams();

  // Auto-focus password input
  useEffect(() => {
    const passwordInput = document.getElementById("password");
    if (passwordInput) passwordInput.focus();
  }, []);

  // Countdown for redirect
  useEffect(() => {
    if (status === "success" && countdown > 0) {
      const timer = setTimeout(() => {
        setCountdown((prev) => prev - 1);
      }, 1000);
      return () => clearTimeout(timer);
    } else if (status === "success" && countdown === 0) {
      navigate("/home");
    }
  }, [status, countdown, navigate]);

  // Password validation
  const validatePassword = (password) => {
    if (!password) return "Password is required";
    if (password.length < 8) return "Password must be at least 8 characters";
    return "";
  };

  // Confirm password validation
  const validateConfirmPassword = (confirmPassword, password) => {
    if (!confirmPassword) return "Please confirm your password";
    if (confirmPassword !== password) return "Passwords do not match";
    return "";
  };

  // Handle input changes with real-time validation
  const handleInputChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));

    let error = "";
    if (field === "password") {
      error = validatePassword(value);
      // Also revalidate confirm password if it exists
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

  // Handle form submission
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

    setIsLoading(true);

    try {
      console.log("[v0] Resetting password with token:", token);
      console.log("[v0] New password:", formData.password);

      // Simulate API delay
      await new Promise((resolve) => setTimeout(resolve, 2000));

      // Mock token validation
      if (token === "valid-token") {
        setStatus("success");
        setCountdown(3);
        // Clear session storage
        sessionStorage.removeItem("resetEmail");
      } else if (token !== "valid-token") {
        setStatus("invalid");
      } else {
        setStatus("error");
      }
    } catch (error) {
      console.error("[v0] Error resetting password:", error);
      setStatus("error");
    } finally {
      setIsLoading(false);
    }
  };

  const isFormValid =
    formData.password &&
    formData.confirmPassword &&
    !errors.password &&
    !errors.confirmPassword;

  // Success state
  if (status === "success") {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5 }}
          className="w-full max-w-md bg-white dark:bg-gray-800 rounded-2xl shadow-xl border border-gray-200 dark:border-gray-700 p-8 text-center"
        >
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{
              duration: 0.5,
              delay: 0.2,
              type: "spring",
              stiffness: 200,
            }}
            className="w-20 h-20 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto mb-6"
          >
            <CheckCircle className="w-10 h-10 text-green-600 dark:text-green-400" />
          </motion.div>

          <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
            Password Changed Successfully!
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mb-6">
            Your password has been updated. Redirecting to home page in{" "}
            {countdown} seconds...
          </p>

          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => navigate("/home")}
            className="w-full py-3 px-4 bg-orange-600 hover:bg-orange-700 text-white rounded-lg font-medium transition-colors"
          >
            Go to Home Now
          </motion.button>
        </motion.div>
      </div>
    );
  }

  // Error states
  if (status === "invalid" || status === "error") {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5 }}
          className="w-full max-w-md bg-white dark:bg-gray-800 rounded-2xl shadow-xl border border-gray-200 dark:border-gray-700 p-8 text-center"
        >
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{
              duration: 0.5,
              delay: 0.2,
              type: "spring",
              stiffness: 200,
            }}
            className="w-20 h-20 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center mx-auto mb-6"
          >
            <XCircle className="w-10 h-10 text-red-600 dark:text-red-400" />
          </motion.div>

          <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
            {status === "invalid" ? "Invalid Link" : "Something Went Wrong"}
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mb-6">
            {status === "invalid"
              ? "Invalid or expired link. Please try again."
              : "Something went wrong. Please try again."}
          </p>

          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => navigate("/forgot-password")}
            className="w-full py-3 px-4 bg-orange-600 hover:bg-orange-700 text-white rounded-lg font-medium transition-colors"
          >
            Resend Link
          </motion.button>
        </motion.div>
      </div>
    );
  }

  // Main form
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-md"
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl border border-gray-200 dark:border-gray-700 p-8"
        >
          {/* Header */}
          <div className="text-center mb-8">
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ duration: 0.5, delay: 0.2 }}
              className="w-16 h-16 bg-orange-100 dark:bg-orange-900/30 rounded-full flex items-center justify-center mx-auto mb-4"
            >
              <Lock className="w-8 h-8 text-orange-600 dark:text-orange-400" />
            </motion.div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
              Set New Password
            </h1>
            <p className="text-gray-600 dark:text-gray-400">
              Enter your new password below
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* New Password */}
            <div>
              <label
                htmlFor="password"
                className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
              >
                New Password
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Lock className="w-5 h-5 text-gray-400" />
                </div>
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  value={formData.password}
                  onChange={(e) =>
                    handleInputChange("password", e.target.value)
                  }
                  placeholder="Enter new password"
                  className={`w-full pl-10 pr-12 py-3 border rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-colors bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 ${
                    errors.password
                      ? "border-red-500 focus:ring-red-500 focus:border-red-500"
                      : "border-gray-300 dark:border-gray-600"
                  }`}
                  disabled={isLoading}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
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
                  className="mt-2 text-sm text-red-600 dark:text-red-400"
                >
                  {errors.password}
                </motion.p>
              )}
            </div>

            {/* Confirm Password */}
            <div>
              <label
                htmlFor="confirmPassword"
                className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
              >
                Confirm New Password
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Lock className="w-5 h-5 text-gray-400" />
                </div>
                <input
                  id="confirmPassword"
                  type={showConfirmPassword ? "text" : "password"}
                  value={formData.confirmPassword}
                  onChange={(e) =>
                    handleInputChange("confirmPassword", e.target.value)
                  }
                  placeholder="Confirm new password"
                  className={`w-full pl-10 pr-12 py-3 border rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-colors bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 ${
                    errors.confirmPassword
                      ? "border-red-500 focus:ring-red-500 focus:border-red-500"
                      : "border-gray-300 dark:border-gray-600"
                  }`}
                  disabled={isLoading}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
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
                  className="mt-2 text-sm text-red-600 dark:text-red-400"
                >
                  {errors.confirmPassword}
                </motion.p>
              )}
            </div>

            {/* Submit Button */}
            <motion.button
              whileHover={{ scale: isFormValid && !isLoading ? 1.02 : 1 }}
              whileTap={{ scale: isFormValid && !isLoading ? 0.98 : 1 }}
              type="submit"
              disabled={!isFormValid || isLoading}
              className={`w-full py-3 px-4 rounded-lg font-medium transition-all duration-200 flex items-center justify-center gap-2 ${
                isFormValid && !isLoading
                  ? "bg-orange-600 hover:bg-orange-700 text-white shadow-lg hover:shadow-xl"
                  : "bg-gray-300 dark:bg-gray-600 text-gray-500 dark:text-gray-400 cursor-not-allowed"
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
        </motion.div>
      </motion.div>
    </div>
  );
}
