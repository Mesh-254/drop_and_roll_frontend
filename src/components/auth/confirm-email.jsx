"use client"

import { useEffect, useState } from "react"
import { useNavigate, useLocation } from "react-router-dom"
import { motion } from "framer-motion"
import { CheckCircle, XCircle, Loader2 } from "lucide-react"


export default function CheckEmail() {
  const [status, setStatus] = useState("loading") // 'loading', 'success', 'error'
  const [message, setMessage] = useState("")
  const navigate = useNavigate()
  const location = useLocation()


  useEffect(() => {
    // Parse query params from location.search
    const params = new URLSearchParams(location.search)
    const uid = params.get("uid")
    const token = params.get("token")

    if (!uid || !token) {
      setStatus("error")
      setMessage("Invalid confirmation link")
      return
    }

    const handleConfirmation = async () => {
      try {
        const response = await confirmEmail(uid, token)
        setStatus("success")
        setMessage(response.detail || "Account confirmed successfully")

        // Redirect to login after 3 seconds
        setTimeout(() => {
          navigate("/login")
        }, 3000)
      } catch (error) {
        setStatus("error")
        setMessage(error.message || "Email confirmation failed")
      }
    }

    handleConfirmation()
  }, [location.search, confirmEmail, navigate])

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-md"
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl border border-gray-200 dark:border-gray-700 p-8 text-center"
        >
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{
              duration: 0.5,
              delay: 0.2,
              type: "spring",
              stiffness: 200,
            }}
            className={`w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6 ${
              status === "loading"
                ? "bg-blue-100 dark:bg-blue-900/30"
                : status === "success"
                ? "bg-green-100 dark:bg-green-900/30"
                : "bg-red-100 dark:bg-red-900/30"
            }`}
          >
            {status === "loading" && <Loader2 className="w-10 h-10 text-blue-600 dark:text-blue-400 animate-spin" />}
            {status === "success" && <CheckCircle className="w-10 h-10 text-green-600 dark:text-green-400" />}
            {status === "error" && <XCircle className="w-10 h-10 text-red-600 dark:text-red-400" />}
          </motion.div>

          <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
            {status === "loading" && "Confirming Email..."}
            {status === "success" && "Email Confirmed!"}
            {status === "error" && "Confirmation Failed"}
          </h1>

          <p className="text-gray-600 dark:text-gray-400 mb-8">{message}</p>

          {status === "success" && (
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
              Redirecting to login page in 3 seconds...
            </p>
          )}

          {status !== "loading" && (
            <motion.button
              onClick={() => navigate("/login")}
              className="w-full py-3 px-4 bg-orange-500 hover:bg-orange-600 text-white rounded-lg font-medium transition-colors"
            >
              Go to Login
            </motion.button>
          )}
        </motion.div>
      </motion.div>
    </div>
  )
}
