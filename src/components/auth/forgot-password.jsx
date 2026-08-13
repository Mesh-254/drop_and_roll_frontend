"use client";

import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  Mail,
  Loader2,
  ArrowLeft,
  CheckCircle,
  AlertCircle,
} from "lucide-react";
import { authApi } from "../../api/AuthApi"; // Adjust path
import TurnstileWidget, { TURNSTILE_ENABLED } from "./TurnstileWidget";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [errors, setErrors] = useState({});
  const [status, setStatus] = useState(""); // 'idle', 'success', 'error'
  const [isLoading, setIsLoading] = useState(false);
  // Phase 3, Task 3.5: bot verification is unconditional on forgot-password.
  const [turnstileToken, setTurnstileToken] = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    const emailInput = document.getElementById("email");
    if (emailInput) emailInput.focus();
  }, []);

  const validateEmail = (email) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email) return "Email is required";
    if (!emailRegex.test(email)) return "Please enter a valid email address";
    return "";
  };

  const handleEmailChange = (e) => {
    const value = e.target.value;
    setEmail(value);
    const error = validateEmail(value);
    setErrors((prev) => ({ ...prev, email: error }));
    if (status !== "idle") setStatus("idle");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const emailError = validateEmail(email);
    if (emailError) {
      setErrors({ email: emailError });
      return;
    }
    // Phase 3, Task 3.5: require a solved challenge before submitting when Turnstile is on.
    if (TURNSTILE_ENABLED && !turnstileToken) {
      setErrors({ submit: "Please complete the verification challenge below." });
      return;
    }
    setIsLoading(true);
    setErrors({});
    setStatus("idle");
    try {
      const result = await authApi.forgotPassword(email, turnstileToken);
      if (result.success) {
        setStatus("success");
        sessionStorage.setItem("resetEmail", email);
        setTimeout(() => navigate("/check-email"), 3000);
      } else {
        setStatus("error");
        setErrors({ submit: result.message });
      }
    } catch (error) {
      console.error("Error sending reset email:", error);
      setStatus("error");
      setErrors({ submit: "An unexpected error occurred. Please try again." });
    } finally {
      setIsLoading(false);
    }
  };

  const isFormValid = email && !errors.email;

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
          onClick={() => navigate("/login")}
          className="flex items-center gap-2 text-muted-foreground hover:text-foreground mb-8 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Login
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
              <Mail className="w-8 h-8 text-brand-text" />
            </motion.div>
            <h1 className="text-2xl font-bold text-foreground mb-2">
              Reset Password
            </h1>
            <p className="text-muted-foreground">
              Enter your email address and we'll send you a link to reset your
              password.
            </p>
          </div>
          {status === "success" && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-6 p-4 bg-success-surface border border-success/30 rounded-lg flex items-start gap-3"
            >
              <CheckCircle className="w-5 h-5 text-success flex-shrink-0 mt-0.5" />
              <p className="text-success text-sm">
                Reset link sent to {email}! Check your inbox (and spam folder).
              </p>
            </motion.div>
          )}
          {status === "error" && errors.submit && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-6 p-3 bg-destructive-surface border border-destructive/30 rounded-lg flex items-start gap-2"
            >
              <AlertCircle className="w-5 h-5 text-destructive flex-shrink-0 mt-0.5" />
              <p className="text-destructive text-sm">
                {errors.submit}
              </p>
            </motion.div>
          )}
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label
                htmlFor="email"
                className="block text-sm font-medium text-muted-foreground mb-2"
              >
                Email Address
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Mail className="w-5 h-5 text-muted-foreground" />
                </div>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={handleEmailChange}
                  placeholder="Enter your email"
                  className={`w-full pl-10 pr-4 py-3 border rounded-lg focus:ring-2 focus:ring-ring focus:border-primary transition-colors bg-card dark:bg-surface-hover text-foreground placeholder-subtle-foreground ${
                    errors.email
                      ? "border-destructive focus:ring-destructive focus:border-destructive"
                      : "border-border-strong"
                  }`}
                  disabled={isLoading}
                />
              </div>
              {errors.email && (
                <motion.p
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mt-2 text-sm text-destructive"
                >
                  {errors.email}
                </motion.p>
              )}
            </div>
            {/* Phase 3, Task 3.5: Cloudflare Turnstile — renders only when a site key is set */}
            <TurnstileWidget
              className="flex justify-center"
              onVerify={setTurnstileToken}
              onExpire={() => setTurnstileToken("")}
              onError={() => setTurnstileToken("")}
            />
            {errors.submit && (
              <p className="text-destructive text-sm text-center">{errors.submit}</p>
            )}
            <motion.button
              whileHover={{ scale: isFormValid && !isLoading ? 1.02 : 1 }}
              whileTap={{ scale: isFormValid && !isLoading ? 0.98 : 1 }}
              type="submit"
              disabled={!isFormValid || isLoading}
              className={`w-full py-3 px-4 rounded-lg font-medium transition-all duration-200 flex items-center justify-center gap-2 ${
                isFormValid && !isLoading
                  ? "bg-primary-hover hover:bg-primary-hover text-primary-foreground shadow-lg hover:shadow-xl"
                  : "bg-surface-hover text-subtle-foreground dark:text-muted-foreground cursor-not-allowed"
              }`}
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Sending Reset Link...
                </>
              ) : (
                "Send Reset Link"
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
