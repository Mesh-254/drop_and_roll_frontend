"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { CheckCircle, Home, ArrowRight, AlertCircle } from "lucide-react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";

const AccountConfirmedPage = () => {
  const [searchParams] = useSearchParams();
  const [confirmationStatus, setConfirmationStatus] = useState("loading"); // 'loading', 'success', 'invalid', 'already_activated'
  const [countdown, setCountdown] = useState(6);
  const [errorMessage, setErrorMessage] = useState("");

  const { confirmEmail } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    const uid = searchParams.get("uid");
    const token = searchParams.get("token");

    if (uid && token) {
      handleEmailConfirmation(uid, token);
    } else {
      console.log("Missing uid or token in URL parameters");
      setConfirmationStatus("invalid");
      setErrorMessage(
        "Invalid confirmation link. Please check your email and try again."
      );
    }
  }, [searchParams]);

  useEffect(() => {
    if (confirmationStatus === "success" && countdown > 0) {
      const timer = setTimeout(() => {
        setCountdown(countdown - 1);
      }, 1000);

      return () => clearTimeout(timer);
    } else if (confirmationStatus === "success" && countdown === 0) {
      navigate("/");
    }
  }, [confirmationStatus, countdown, navigate]);

  const handleEmailConfirmation = async (uid, token) => {
    try {
      const result = await confirmEmail(uid, token);
      console.log("Confirm Email Result:", result); // Debug log

      if (result.success) {
        setConfirmationStatus("success");
      } else {
        if (result.code === "ACCOUNT_ALREADY_ACTIVATED") {
          setConfirmationStatus("already_activated");
          setErrorMessage(
            "This account has already been activated. Please sign in."
          );
        } else if (result.code === "INVALID_CONFIRMATION_LINK") {
          setConfirmationStatus("invalid");
          setErrorMessage(
            "The confirmation link is invalid or expired. Please request a new one."
          );
        } else {
          setConfirmationStatus("invalid");
          setErrorMessage(
            result.message || "Email confirmation failed. Please try again."
          );
        }
      }
    } catch (error) {
      console.error("Unexpected error in handleEmailConfirmation:", error);
      setConfirmationStatus("invalid");
      setErrorMessage(
        "An unexpected error occurred during confirmation. Please try again."
      );
    }
  };

  if (confirmationStatus === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-orange-50 via-white to-orange-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-md w-full p-8 text-center"
        >
          <div className="w-20 h-20 bg-orange-100 dark:bg-orange-900/30 rounded-full flex items-center justify-center mx-auto mb-6">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-orange-500"></div>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
            Confirming your account...
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Please wait while we verify your email address.
          </p>
        </motion.div>
      </div>
    );
  }

  if (
    confirmationStatus === "invalid" ||
    confirmationStatus === "already_activated"
  ) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-orange-50 via-white to-orange-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-md w-full p-8 text-center"
        >
          <div className="w-20 h-20 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center mx-auto mb-6">
            <AlertCircle className="w-12 h-12 text-red-500" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
            {confirmationStatus === "already_activated"
              ? "Account Already Activated"
              : "Confirmation Failed"}
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mb-6">
            {errorMessage}
          </p>
          <div className="space-y-4">
            {confirmationStatus === "already_activated" ? (
              <Link
                to="/login"
                className="w-full py-3 px-4 bg-orange-500 text-white rounded-full hover:bg-orange-600 transition-all duration-200 shadow-lg hover:shadow-xl flex items-center justify-center"
              >
                Sign in
                <ArrowRight className="w-5 h-5 ml-2" />
              </Link>
            ) : (
              <Link
                to="/resend-confirmation"
                className="w-full py-3 px-4 bg-orange-500 text-white rounded-full hover:bg-orange-600 transition-all duration-200 shadow-lg hover:shadow-xl flex items-center justify-center"
              >
                Request new confirmation link
                <ArrowRight className="w-5 h-5 ml-2" />
              </Link>
            )}
            <Link
              to="/"
              className="w-full py-3 px-4 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-full hover:bg-gray-50 dark:hover:bg-gray-700 transition-all duration-200 flex items-center justify-center"
            >
              <Home className="w-5 h-5 mr-2" />
              Go to homepage
            </Link>
          </div>
        </motion.div>
      </div>
    );
  }

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
          className="w-20 h-20 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto mb-6"
        >
          <CheckCircle className="w-12 h-12 text-green-500" />
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="text-2xl font-bold text-gray-900 dark:text-white mb-4"
        >
          Account Confirmed!
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="text-gray-600 dark:text-gray-400 mb-6 leading-relaxed"
        >
          Your email has been successfully verified. Welcome to Drop 'N Roll!
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="bg-orange-50 dark:bg-orange-900/20 rounded-lg p-4 mb-6 border border-orange-200 dark:border-orange-800"
        >
          <p className="text-orange-700 dark:text-orange-300 text-sm">
            Redirecting to homepage in{" "}
            <span className="font-bold text-lg">{countdown}</span> seconds...
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
          className="space-y-4"
        >
          <Link
            to="/login"
            className="w-full py-3 px-4 bg-orange-500 text-white rounded-full hover:bg-orange-600 transition-all duration-200 shadow-lg hover:shadow-xl flex items-center justify-center"
          >
            Sign in now
            <ArrowRight className="w-5 h-5 ml-2" />
          </Link>

          <Link
            to="/"
            className="w-full py-3 px-4 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-full hover:bg-gray-50 dark:hover:bg-gray-700 transition-all duration-200 flex items-center justify-center"
          >
            <Home className="w-5 h-5 mr-2" />
            Go to homepage
          </Link>
        </motion.div>
      </motion.div>
    </div>
  );
};

export default AccountConfirmedPage;
