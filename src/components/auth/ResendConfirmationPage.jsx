"use client"

import { useState, useEffect } from "react"
import { motion } from "framer-motion"
import {
  Mail,
  Loader2,
  CheckCircle,
  AlertCircle,
  ArrowLeft,
} from "lucide-react"
import { Link, useLocation, useNavigate } from "react-router-dom"
import {authApi} from "../../api/AuthApi"

const ResendConfirmationPage = () => {
  const [email, setEmail] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [status, setStatus] = useState("idle") // 'idle', 'success', 'error'
  const [message, setMessage] = useState("")
  const [countdown, setCountdown] = useState(0)

  const location = useLocation()
  const navigate = useNavigate()

  useEffect(() => {
    if (location.state?.email) {
      setEmail(location.state.email)
    }
  }, [location.state])

  useEffect(() => {
    if (status === "success" && countdown > 0) {
      const timer = setTimeout(() => {
        setCountdown(countdown - 1)
      }, 1000)
      return () => clearTimeout(timer)
    }
  }, [status, countdown])

  const handleResendConfirmation = async (e) => {
    e.preventDefault()
    if (!email) {
      setStatus("error")
      setMessage("Please enter your email address")
      return
    }
    setIsLoading(true)
    const result = await authApi.resendConfirmation(email)
    setIsLoading(false)
    if (result.success) {
      setStatus("success")
      setMessage("Confirmation email sent! Check your inbox/spam.")
      setCountdown(30)
    } else {
      setStatus("error")
      switch (result.code) {
        case "ACCOUNT_ALREADY_ACTIVATED":
          setMessage("Account is already activated. Redirecting to sign in...")
          setTimeout(() => {
            navigate("/login")
          }, 4000)
          break
        case "EMAIL_NOT_FOUND":
          setMessage("No account found with this email. Redirecting to register...")
          setTimeout(() => {
            navigate("/register")
          }, 4000)
          break
        default:
          setMessage(result.message || "Failed to send email. Try again.")
      }
    }
  }

  const handleEmailChange = (e) => {
    setEmail(e.target.value)
    if (status === "error") {
      setStatus("idle")
      setMessage("")
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-orange-50 via-white to-orange-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-md w-full p-8"
      >
        <div className="text-center mb-8">
          <div className="w-20 h-20 bg-orange-100 dark:bg-orange-900/30 rounded-full flex items-center justify-center mx-auto mb-6">
            <Mail className="w-10 h-10 text-orange-500" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
            Resend Confirmation Email
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Enter your email address to receive a new account confirmation link
          </p>
        </div>

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

        <form onSubmit={handleResendConfirmation} className="space-y-6">
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="email"
              value={email}
              onChange={handleEmailChange}
              placeholder="Enter your email address"
              className="w-full py-3 pl-12 pr-4 border border-gray-300 dark:border-gray-600 rounded-full focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-all duration-200 bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400"
              required
              disabled={isLoading || (status === "success" && countdown > 0)}
            />
          </div>

          <button
            type="submit"
            disabled={isLoading || (status === "success" && countdown > 0)}
            className="w-full py-3 bg-orange-500 text-white rounded-full hover:bg-orange-600 transition-all duration-200 shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
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
              className="inline-flex items-center text-orange-500 hover:text-orange-600 font-medium transition-colors text-sm"
            >
              <ArrowLeft className="w-4 h-4 mr-1" />
              Back to Sign In
            </Link>
          </div>

          <div className="text-center">
            <p className="text-gray-500 dark:text-gray-400 text-xs">
              Still having trouble?{" "}
              <Link
                to="/contact"
                className="text-orange-500 hover:text-orange-600"
              >
                Contact Support
              </Link>
            </p>
          </div>
        </div>
      </motion.div>
    </div>
  )
}

export default ResendConfirmationPage