"use client";

import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Mail, ArrowLeft, RefreshCw, Loader2 } from "lucide-react";
import { authApi } from "../../api/AuthApi";

export default function CheckEmail() {
  const [email, setEmail] = useState("");
  const [countdown, setCountdown] = useState(30);
  const [isResending, setIsResending] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const storedEmail = sessionStorage.getItem("resetEmail");
    if (storedEmail) {
      setEmail(storedEmail);
    } else {
      navigate("/forgot-password");
    }
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [countdown, navigate]);

  const handleResend = async () => {
    if (!email || countdown > 0) return;
    setIsResending(true);
    try {
      const result = await authApi.forgotPassword(email);
      if (result.success) {
        setCountdown(30);
      } else {
        // Show error toast or console
        console.error("Resend failed:", result.message);
      }
    } catch (error) {
      console.error("Resend error:", error);
    } finally {
      setIsResending(false);
    }
  };

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
          onClick={() => navigate("/forgot-password")}
          className="flex items-center gap-2 text-muted-foreground hover:text-foreground mb-8 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back
        </motion.button>
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="bg-card dark:bg-surface rounded-2xl shadow-xl border border-border p-8 text-center"
        >
          <div className="w-16 h-16 bg-brand-surface rounded-full flex items-center justify-center mx-auto mb-6">
            <Mail className="w-8 h-8 text-brand-text" />
          </div>
          <h1 className="text-2xl font-bold text-foreground mb-4">
            Check Your Email
          </h1>
          <p className="text-muted-foreground mb-2">
            We've sent a password reset link to
          </p>
          <p className="font-medium text-brand-text mb-6">
            {email}
          </p>
          <div className="bg-info-surface border border-info/30 rounded-lg p-4 mb-6">
            <p className="text-info text-sm">
              Check your inbox (including spam/junk folder) for the reset link.
              It expires in 1 hour.
            </p>
          </div>
          <motion.button
            whileHover={{ scale: countdown === 0 ? 1.02 : 1 }}
            onClick={handleResend}
            disabled={isResending || countdown > 0}
            className="w-full  text-foreground py-3 px-4 border rounded-lg font-medium transition-all duration-200 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isResending ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : countdown > 0 ? (
              <>
                <RefreshCw className="w-5 h-5" />
                Resend in {countdown}s
              </>
            ) : (
              <>
                <RefreshCw className="w-5 h-5" />
                Resend Email
              </>
            )}
          </motion.button>
          <div className="mt-6 text-center">
            <p className="text-sm text-muted-foreground">
              Didn't receive it? Check spam or{" "}
              <button
                onClick={() => navigate("/login")}
                className="text-brand-text hover:text-brand-text font-medium"
              >
                return to login
              </button>
            </p>
          </div>
        </motion.div>
      </motion.div>
    </div>
  );
}
