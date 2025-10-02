"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  CheckCircle,
  Home,
  ArrowRight,
  AlertCircle,
  LogOut,
  UserCheck,  // New: For already activated
} from "lucide-react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";

const AccountConfirmedPage = () => {
  const [searchParams] = useSearchParams();
  const [confirmationStatus, setConfirmationStatus] = useState("loading"); // 'loading', 'success', 'invalid', 'already_activated'
  const [countdown, setCountdown] = useState(6);
  const [errorMessage, setErrorMessage] = useState("");
  const [successDetail, setSuccessDetail] = useState("");
  const [redirectCountdown, setRedirectCountdown] = useState(5);

  const { confirmEmail } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    const uid = searchParams.get("uid");
    const token = searchParams.get("token");

    console.log("Params extracted:", { uid, token }); // Debug: Verify params

    if (!uid || !token) {
      console.warn("Missing uid or token");
      setConfirmationStatus("invalid");
      setErrorMessage("Invalid confirmation link. Please request a new one.");
      return;
    }

    // Await here to ensure sequential
    handleEmailConfirmation(uid, token);
  }, [searchParams]);

  useEffect(() => {
    console.log("Status changed to:", confirmationStatus); // Debug: Track status updates

    if (confirmationStatus === "success" && countdown > 0) {
      const timer = setTimeout(() => setCountdown((prev) => prev - 1), 1000);
      return () => clearTimeout(timer);
    } else if (confirmationStatus === "success" && countdown === 0) {
      navigate("/");
    }

    if (
      (confirmationStatus === "invalid" || confirmationStatus === "already_activated") &&
      redirectCountdown > 0
    ) {
      const timer = setTimeout(() => setRedirectCountdown((prev) => prev - 1), 1000);
      return () => clearTimeout(timer);
    } else if (redirectCountdown === 0) {
      if (confirmationStatus === "already_activated") {
        navigate("/login");
      } else {
        navigate("/resend-confirmation");
      }
    }
  }, [confirmationStatus, countdown, redirectCountdown, navigate]);

  const handleEmailConfirmation = async (uid, token) => {
    try {
      console.log("Calling confirmEmail with:", { uid, token }); // Debug
      const result = await confirmEmail(uid, token); // Ensure await
      console.log("Confirm Email Result:", result); // This should show success: false

      if (result?.success) {
        console.log("Setting success status");
        setConfirmationStatus("success");
        setSuccessDetail(result.data?.detail || "Your account is now active!");
      } else {
        console.log("Setting error status for code:", result?.code);
        switch (result?.code) {
          case "ACCOUNT_ALREADY_ACTIVATED":
            setConfirmationStatus("already_activated");
            setErrorMessage(result.message || "This account has already been activated. You can sign in now.");
            break;
          case "INVALID_CONFIRMATION_LINK":
            setConfirmationStatus("invalid");
            setErrorMessage(result.message || "Invalid or expired confirmation link. Please request a new one.");
            break;
          default:
            setConfirmationStatus("invalid");
            setErrorMessage(result.message || "Confirmation failed. Please try again.");
        }
      }
    } catch (error) {
      console.error("Confirmation error:", error);
      setConfirmationStatus("invalid");
      setErrorMessage("An unexpected error occurred. Please try again.");
    }
  };

  if (confirmationStatus === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-orange-50 via-white to-orange-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500 mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">Confirming your email...</p>
        </div>
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
        {confirmationStatus === "success" ? (
          <>
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
              {successDetail}
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
                Sign in now <ArrowRight className="w-5 h-5 ml-2" />
              </Link>
              <Link
                to="/"
                className="w-full py-3 px-4 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-full hover:bg-gray-50 dark:hover:bg-gray-700 transition-all duration-200 flex items-center justify-center"
              >
                <Home className="w-5 h-5 mr-2" /> Go to homepage
              </Link>
            </motion.div>
          </>
        ) : confirmationStatus === "already_activated" ? (
          <>
            {/* New: Distinct blue UI for already activated - positive but not "new success" */}
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
              className="w-20 h-20 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center mx-auto mb-6"
            >
              <UserCheck className="w-12 h-12 text-blue-500" />
            </motion.div>
            <motion.h1
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="text-2xl font-bold text-gray-900 dark:text-white mb-4"
            >
              Account Already Active!
            </motion.h1>
            <motion.p
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              className="text-gray-600 dark:text-gray-400 mb-6 leading-relaxed"
            >
              {errorMessage} {/* Backend message: "This account... Please sign in." */}
            </motion.p>
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
              className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4 mb-6 border border-blue-200 dark:border-blue-800"
            >
              <p className="text-blue-700 dark:text-blue-300 text-sm">
                Redirecting to sign in in{" "}
                <span className="font-bold text-lg">{redirectCountdown}</span> seconds...
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
                <LogOut className="w-5 h-5 mr-2" /> Sign in now
              </Link>
              <Link
                to="/"
                className="w-full py-3 px-4 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-full hover:bg-gray-50 dark:hover:bg-gray-700 transition-all duration-200 flex items-center justify-center"
              >
                <Home className="w-5 h-5 mr-2" /> Go to homepage
              </Link>
            </motion.div>
          </>
        ) : (
          <>
            {/* True error: Invalid/expired */}
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
              className="w-20 h-20 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center mx-auto mb-6"
            >
              <AlertCircle className="w-12 h-12 text-red-500" />
            </motion.div>
            <motion.h1
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="text-2xl font-bold text-gray-900 dark:text-white mb-4"
            >
              Confirmation Failed
            </motion.h1>
            <motion.p
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              className="text-gray-600 dark:text-gray-400 mb-6 leading-relaxed"
            >
              We couldn't confirm your email this time.
            </motion.p>
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
              className="bg-red-50 dark:bg-red-900/20 rounded-lg p-4 mb-6 border border-red-200 dark:border-red-800"
            >
              <p className="text-red-700 dark:text-red-300 text-sm">{errorMessage}</p>
              <p className="text-red-700 dark:text-red-300 text-sm mt-2">
                Redirecting to resend in{" "}
                <span className="font-bold text-lg">{redirectCountdown}</span> seconds...
              </p>
            </motion.div>
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.6 }}
              className="space-y-4"
            >
              <Link
                to="/resend-confirmation"
                className="w-full py-3 px-4 bg-orange-500 text-white rounded-full hover:bg-orange-600 transition-all duration-200 shadow-lg hover:shadow-xl flex items-center justify-center"
              >
                Resend confirmation email <ArrowRight className="w-5 h-5 ml-2" />
              </Link>
              <Link
                to="/register"
                className="w-full py-3 px-4 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-full hover:bg-gray-50 dark:hover:bg-gray-700 transition-all duration-200 flex items-center justify-center"
              >
                Back to registration
              </Link>
            </motion.div>
          </>
        )}
      </motion.div>
    </div>
  );
};

export default AccountConfirmedPage;