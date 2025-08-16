"use client";

import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

// eslint-disable-next-line no-unused-vars
import { motion } from "framer-motion";
import { Mail, ArrowLeft } from "lucide-react";

export default function CheckEmail() {
  const [email, setEmail] = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    // Get email from session storage
    const resetEmail = sessionStorage.getItem("resetEmail");
    if (resetEmail) {
      setEmail(resetEmail);
    } else {
      // If no email found, redirect to forgot password
      navigate("/forgot-password");
    }
  }, [navigate]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-md"
      >
        {/* Main Card */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl border border-gray-200 dark:border-gray-700 p-8 text-center"
        >
          {/* Success Icon */}
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
            <Mail className="w-10 h-10 text-green-600 dark:text-green-400" />
          </motion.div>

          {/* Header */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.3 }}
          >
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
              Check Your Email
            </h1>
            <div className="space-y-2 mb-8">
              <p className="text-gray-600 dark:text-gray-400">
                We've sent a password reset link to
              </p>
              <p className="font-medium text-orange-600 dark:text-orange-400 break-all">
                {email}
              </p>
              <p className="text-gray-600 dark:text-gray-400">
                Please check your inbox and click the link to reset your
                password.
              </p>
            </div>
          </motion.div>

          {/* Instructions */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.4 }}
            className="bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800 rounded-lg p-4 mb-8"
          >
            <p className="text-sm text-blue-800 dark:text-blue-200">
              <strong>Didn't receive the email?</strong> Check your spam folder
              or try again with a different email address.
            </p>
          </motion.div>

          {/* Back to Login Button */}
          <motion.button
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.5 }}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => navigate("/login")}
            className="w-full py-3 px-4 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Login
          </motion.button>
        </motion.div>
      </motion.div>
    </div>
  );
}
