"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
  Mail,
  ArrowRight,
  RefreshCw,
  CheckCircle,
  AlertCircle,
  Loader2,
} from "lucide-react";
import { Link, useLocation } from "react-router-dom";
import { authApi } from "../../api/AuthApi";

const EmailConfirmationPage = () => {
  const location = useLocation();
  const email = location.state?.email || "";
  const [isLoading, setIsLoading] = useState(false);
  const [status, setStatus] = useState("idle"); // 'idle', 'success', 'error'
  const [message, setMessage] = useState("");
  const [countdown, setCountdown] = useState(0);

  useEffect(() => {
    if (status === "success" && countdown > 0) {
      const timer = setTimeout(() => {
        setCountdown(countdown - 1);
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [status, countdown]);

  const handleResendEmail = async () => {
    if (!email) {
      setStatus("error");
      setMessage("No email provided. Please return to registration.");
      return;
    }
    setIsLoading(true);
    setStatus("idle");
    setMessage("");
    try {
      const result = await authApi.resendConfirmation(email);
      setIsLoading(false);
      if (result.success) {
        setStatus("success");
        setMessage("Confirmation email sent! Check your inbox/spam.");
        setCountdown(30); // Throttle for 30 seconds
      } else {
        setStatus("error");
        switch (result.code) {
          case "ACCOUNT_ALREADY_ACTIVATED":
            setMessage("Account is already activated. Please sign in.");
            break;
          case "EMAIL_NOT_FOUND":
            setMessage("No account found with this email. Please register.");
            break;
          default:
            setMessage(result.message || "Failed to send email. Try again.");
        }
      }
    } catch (error) {
      setIsLoading(false);
      setStatus("error");
      setMessage("An unexpected error occurred. Please try again.");
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-brand-surface via-card to-brand-surface dark:from-card dark:via-surface dark:to-card">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-card dark:bg-surface rounded-2xl shadow-2xl max-w-md w-full p-8 text-center"
      >
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
          className="w-20 h-20 bg-brand-surface rounded-full flex items-center justify-center mx-auto mb-6"
        >
          <Mail className="w-10 h-10 text-brand-text" />
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="text-2xl font-bold text-foreground mb-4"
        >
          Check your email
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="text-muted-foreground mb-6 leading-relaxed"
        >
          We've sent a confirmation link to{" "}
          <span className="font-medium text-brand-text">
            {email || "your email"}
          </span>
        </motion.p>

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

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
          className="space-y-4"
        >
          <button
            onClick={handleResendEmail}
            disabled={isLoading || (status === "success" && countdown > 0)}
            className="w-full py-3 px-4 bg-primary text-primary-foreground rounded-full hover:bg-primary-hover transition-all duration-200 shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
          >
            {isLoading ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : status === "success" && countdown > 0 ? (
              <>
                <RefreshCw className="w-5 h-5 mr-2" />
                Resend in {countdown}s
              </>
            ) : (
              <>
                <RefreshCw className="w-5 h-5 mr-2" />
                Resend confirmation email
              </>
            )}
          </button>

          <Link
            to="/login"
            className="w-full py-3 px-4 border border-border-strong text-muted-foreground rounded-full hover:bg-muted dark:hover:bg-surface-hover transition-all duration-200 flex items-center justify-center"
          >
            Back to login
            <ArrowRight className="w-5 h-5 ml-2" />
          </Link>
        </motion.div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.7 }}
          className="mt-8 p-4 bg-info-surface rounded-lg border border-info/30"
        >
          <p className="text-info text-sm">
            <strong>Didn't receive the email?</strong> Check your spam folder or
            try resending the confirmation email.
          </p>
        </motion.div>
      </motion.div>
    </div>
  );
};

export default EmailConfirmationPage;
