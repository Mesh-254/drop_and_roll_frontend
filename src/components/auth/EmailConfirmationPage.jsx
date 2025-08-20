"use client"

import { useEffect } from "react"
import { motion } from "framer-motion"
import { Mail, ArrowRight, RefreshCw } from "lucide-react"
import { Link, useLocation } from "react-router-dom"

const EmailConfirmationPage = () => {
  const location = useLocation()
  const email = location.state?.email || "your email"

  // useEffect(() => {
  //   // Optional: Add analytics or tracking here
  //   console.log("User reached email confirmation page")
  // }, [])

  const handleResendEmail = () => {
    // TODO: Implement resend email functionality
    console.log("Resending confirmation email to:", email)
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
          We've sent a confirmation link to <span className="font-medium text-orange-500">{email}</span>
        </motion.p>

        <motion.p
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="text-gray-500 dark:text-gray-400 text-sm mb-8"
        >
          Click the link in the email to confirm your account and complete your registration.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
          className="space-y-4"
        >
          <button
            onClick={handleResendEmail}
            className="w-full py-3 px-4 bg-orange-500 text-white rounded-full hover:bg-orange-600 transition-all duration-200 shadow-lg hover:shadow-xl flex items-center justify-center"
          >
            <RefreshCw className="w-5 h-5 mr-2" />
            Resend confirmation email
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
            <strong>Didn't receive the email?</strong> Check your spam folder or try resending the confirmation email.
          </p>
        </motion.div>
      </motion.div>
    </div>
  )
}

export default EmailConfirmationPage
