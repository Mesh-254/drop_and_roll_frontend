"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
  Mail,
  Loader2,
  CheckCircle,
  AlertCircle,
  ArrowLeft,
} from "lucide-react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { authApi } from "../../api/AuthApi";

const ResendConfirmationPage = () => {
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [status, setStatus] = useState("idle"); // 'idle', 'success', 'error'
  const [message, setMessage] = useState("");
  const [countdown, setCountdown] = useState(0);

  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    if (location.state?.email) {
      setEmail(location.state.email);
    }
  }, [location.state]);

  useEffect(() => {
    if (status === "success" && countdown > 0) {
      const timer = setTimeout(() => {
        setCountdown(countdown - 1);
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [status, countdown]);

  const handleResendConfirmation = async (e) => {
    e.preventDefault();
    if (!email) {
      setStatus("error");
      setMessage("Please enter your email address");
      return;
    }
    setIsLoading(true);
    const result = await authApi.resendConfirmation(email);
    setIsLoading(false);
    if (result.success) {
      setStatus("success");
      setMessage("Confirmation email sent! Check your inbox/spam.");
      setCountdown(30);
    } else {
      setStatus("error");
      switch (result.code) {
        case "ACCOUNT_ALREADY_ACTIVATED":
          setMessage("Account is already activated. Redirecting to sign in...");
          setTimeout(() => {
            navigate("/login");
          }, 4000);
          break;
        // Finding A: the backend no longer returns EMAIL_NOT_FOUND for resend — an unknown
        // email now gets the same generic CONFIRMATION_SENT (200) as a real unconfirmed one
        // and lands in the success branch above ("check your inbox"). Nothing to branch on
        // here, so we no longer leak "no account found" / redirect to register.
        default:
          setMessage(result.message || "Failed to send email. Try again.");
      }
    }
  };

  const handleEmailChange = (e) => {
    setEmail(e.target.value);
    if (status === "error") {
      setStatus("idle");
      setMessage("");
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-brand-surface via-card to-brand-surface dark:from-card dark:via-surface dark:to-card">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-card dark:bg-surface rounded-2xl shadow-2xl max-w-md w-full p-8"
      >
        <div className="text-center mb-8">
          <div className="w-20 h-20 bg-brand-surface rounded-full flex items-center justify-center mx-auto mb-6">
            <Mail className="w-10 h-10 text-brand-text" />
          </div>
          <h1 className="text-2xl font-bold text-foreground mb-2">
            Resend Confirmation Email
          </h1>
          <p className="text-muted-foreground">
            Enter your email address to receive a new account confirmation link
          </p>
        </div>

        {status === "success" && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-success-surface border border-success/30 rounded-lg p-4 mb-6 flex items-start gap-3"
          >
            <CheckCircle className="w-5 h-5 text-success flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-success text-sm mb-2">
                {message}
              </p>
              {countdown > 0 && (
                <p className="text-success text-xs">
                  You can request another email in {countdown} seconds
                </p>
              )}
            </div>
          </motion.div>
        )}

        {status === "error" && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-destructive-surface border border-destructive/30 rounded-lg p-3 mb-6 flex items-start gap-2"
          >
            <AlertCircle className="w-5 h-5 text-destructive flex-shrink-0 mt-0.5" />
            <p className="text-destructive text-sm">{message}</p>
          </motion.div>
        )}

        <form onSubmit={handleResendConfirmation} className="space-y-6">
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-5 h-5" />
            <input
              type="email"
              value={email}
              onChange={handleEmailChange}
              placeholder="Enter your email address"
              className="w-full py-3 pl-12 pr-4 border border-border-strong rounded-full focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent transition-all duration-200 bg-card dark:bg-surface-hover text-foreground placeholder-subtle-foreground"
              required
              disabled={isLoading || (status === "success" && countdown > 0)}
            />
          </div>

          <button
            type="submit"
            disabled={isLoading || (status === "success" && countdown > 0)}
            className="w-full py-3 bg-primary text-primary-foreground rounded-full hover:bg-primary-hover transition-all duration-200 shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
          >
            {isLoading ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : status === "success" && countdown > 0 ? (
              `Resend in ${countdown}s`
            ) : (
              "Send Confirmation Email"
            )}
          </button>
        </form>

        <div className="mt-8 space-y-4">
          <div className="text-center">
            <Link
              to="/login"
              className="inline-flex items-center text-brand-text hover:text-brand-text font-medium transition-colors text-sm"
            >
              <ArrowLeft className="w-4 h-4 mr-1" />
              Back to Sign In
            </Link>
          </div>

          <div className="text-center">
            <p className="text-subtle-foreground dark:text-muted-foreground text-xs">
              Still having trouble?{" "}
              <Link
                to="/contact"
                className="text-brand-text hover:text-brand-text"
              >
                Contact Support
              </Link>
            </p>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export default ResendConfirmationPage;
