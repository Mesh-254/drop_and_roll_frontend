// PaymentCancel.jsx (Added localStorage clear for guestEmail after cancel)
"use client";

import { useNavigate, useLocation } from "react-router-dom";
import { XCircle, ArrowLeft, RefreshCw } from "lucide-react";
import { useEffect } from "react";
import { useAuth } from "../../contexts/AuthContext";

export default function PaymentCancel() {
  const navigate = useNavigate();
  const location = useLocation();
  const { isAuthenticated } = useAuth();
  const transaction = location.state?.transaction;

  useEffect(() => {
    if (!isAuthenticated) {
      localStorage.removeItem("guestEmail");
    }
  }, [isAuthenticated]);

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-2xl mx-auto px-4">
        {/* Cancel Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-red-100 rounded-full mb-4">
            <XCircle className="h-12 w-12 text-red-500" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Payment Cancelled
          </h1>
          <p className="text-gray-600">
            Your payment was cancelled and no charges were made.
          </p>
        </div>

        {/* Transaction Details */}
        {transaction && (
          <div className="bg-white rounded-2xl shadow-lg p-6 mb-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">
              Transaction Details
            </h2>

            <div className="space-y-3">
              <div className="flex justify-between items-center py-2 border-b border-gray-100">
                <span className="text-gray-600">Transaction ID:</span>
                <span className="font-mono text-sm text-gray-900">
                  {transaction.reference}
                </span>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-gray-100">
                <span className="text-gray-600">Amount:</span>
                <span className="text-2xl font-bold text-gray-900">
                  KSh {Number.parseFloat(transaction.amount).toFixed(2)}
                </span>
              </div>
              <div className="flex justify-between items-center py-2">
                <span className="text-gray-600">Status:</span>
                <span className="px-3 py-1 bg-red-100 text-red-800 rounded-full text-sm font-medium">
                  Cancelled
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Information Box */}
        <div className="bg-blue-50 rounded-2xl p-6 mb-6">
          <h3 className="text-lg font-bold text-gray-900 mb-3">
            What Happened?
          </h3>
          <p className="text-gray-700 mb-4">
            Your payment was cancelled before completion. This could happen if:
          </p>
          <ul className="space-y-2 text-gray-700">
            <li className="flex items-start">
              <span className="inline-block w-2 h-2 bg-blue-500 rounded-full mt-2 mr-3 flex-shrink-0"></span>
              You clicked "Cancel" during the payment process
            </li>
            <li className="flex items-start">
              <span className="inline-block w-2 h-2 bg-blue-500 rounded-full mt-2 mr-3 flex-shrink-0"></span>
              You closed the payment window before completing
            </li>
            <li className="flex items-start">
              <span className="inline-block w-2 h-2 bg-blue-500 rounded-full mt-2 mr-3 flex-shrink-0"></span>
              There was a technical issue with the payment provider
            </li>
          </ul>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-4">
          {transaction && (
            <button
              onClick={() => navigate(`/pay/${transaction.id}`)}
              className="flex-1 bg-orange-500 hover:bg-orange-600 text-white font-bold py-3 px-6 rounded-lg transition-colors flex items-center justify-center"
            >
              <RefreshCw className="h-5 w-5 mr-2" />
              Try Payment Again
            </button>
          )}

          <button
            onClick={() => navigate("/history")}
            className="flex-1 bg-white hover:bg-gray-50 text-gray-700 font-bold py-3 px-6 rounded-lg border border-gray-300 transition-colors flex items-center justify-center"
          >
            <ArrowLeft className="h-5 w-5 mr-2" />
            Back to Bookings
          </button>
        </div>

        {/* Support Information */}
        <div className="bg-gray-100 rounded-2xl p-6 mt-6">
          <h3 className="text-lg font-bold text-gray-900 mb-3">Need Help?</h3>
          <p className="text-gray-700 mb-4">
            If you're experiencing issues with payment, our support team is here
            to help.
          </p>
          <div className="flex flex-col sm:flex-row gap-4">
            <a
              href="mailto:support@example.com"
              className="flex-1 bg-gray-800 hover:bg-gray-900 text-white font-bold py-2 px-4 rounded-lg transition-colors text-center"
            >
              Contact Support
            </a>
            <a
              href="tel:+1234567890"
              className="flex-1 bg-white hover:bg-gray-50 text-gray-700 font-bold py-2 px-4 rounded-lg border border-gray-300 transition-colors text-center"
            >
              Call Us
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
