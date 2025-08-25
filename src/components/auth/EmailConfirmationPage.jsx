"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Mail, ArrowRight, RefreshCw, CheckCircle, AlertCircle, Loader2 } from "lucide-react";
import { Link, useLocation } from "react-router-dom";
import {authApi} from "../../api/AuthApi";

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
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-orange-50 via-white to-orange-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-md w-full p-8 text-center"
      >
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
          className="w-20 h-20 bg-orange-100 dark:bg-orange-900/30 rounded-full flex items-center justify-center mx-auto mb-6"
        >
          <Mail className="w-10 h-10 text-orange-500" />
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="text-2xl font-bold text-gray-900 dark:text-white mb-4"
        >
          Check your email
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="text-gray-600 dark:text-gray-400 mb-6 leading-relaxed"
        >
          We've sent a confirmation link to{" "}
          <span className="font-medium text-orange-500">{email || "your email"}</span>
        </motion.p>

        {status === "success" && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4 mb-6 flex items-start gap-3"
          >
            <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-green-600 dark:text-green-400 text-sm mb-2">
                {message}
              </p>
              {countdown > 0 && (
                <p className="text-green-600 dark:text-green-400 text-xs">
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
            className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3 mb-6 flex items-start gap-2"
          >
            <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
            <p className="text-red-600 dark:text-red-400 text-sm">{message}</p>
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
            className="w-full py-3 px-4 bg-orange-500 text-white rounded-full hover:bg-orange-600 transition-all duration-200 shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
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
            className="w-full py-3 px-4 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-full hover:bg-gray-50 dark:hover:bg-gray-700 transition-all duration-200 flex items-center justify-center"
          >
            Back to login
            <ArrowRight className="w-5 h-5 ml-2" />
          </Link>
        </motion.div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.7 }}
          className="mt-8 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800"
        >
          <p className="text-blue-700 dark:text-blue-300 text-sm">
            <strong>Didn't receive the email?</strong> Check your spam folder or
            try resending the confirmation email.
          </p>
        </motion.div>
      </motion.div>
    </div>
  );
};

export default EmailConfirmationPage;