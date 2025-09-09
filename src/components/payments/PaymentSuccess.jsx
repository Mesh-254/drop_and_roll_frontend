"use client";

import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { paymentApi } from "../../api/PaymentApi";
import { useAuth } from "../../contexts/AuthContext";
import { Loader2, CheckCircle, Package } from "lucide-react";

export default function PaymentSuccess() {
  const navigate = useNavigate();
  const location = useLocation();
  const { isAuthenticated } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [transaction, setTransaction] = useState(
    location.state?.transaction || null
  );
  const [booking, setBooking] = useState(null);

  const [guestEmail] = useState(() => {
    if (isAuthenticated) return "";
    return (
      location.state?.guestEmail?.toLowerCase() ||
      location.state?.transaction?.guest_email?.toLowerCase() ||
      localStorage.getItem("guestEmail")?.toLowerCase() ||
      ""
    );
  });

  useEffect(() => {
    const loadDetails = async () => {
      try {
        // Fetch transaction to ensure latest status
        if (!transaction?.id) {
          setError("No transaction data available");
          setLoading(false);
          return;
        }

        console.log("Fetching transaction for txId:", transaction.id);
        const transactionResult = await paymentApi.getTransaction(
          transaction.id,
          isAuthenticated,
          guestEmail
        );

        if (!transactionResult.success) {
          throw new Error(transactionResult.message);
        }

        const updatedTransaction = transactionResult.data;
        setTransaction(updatedTransaction);

        // Handle possibly nested booking field
        const bookingId = updatedTransaction?.booking?.id || updatedTransaction?.booking;

        if (!bookingId) {
          setError("No booking associated with this transaction");
          setLoading(false);
          return;
        }

        let effectiveGuestEmail = guestEmail.toLowerCase();

        if (!isAuthenticated && !effectiveGuestEmail) {
          effectiveGuestEmail =
            updatedTransaction?.guest_email?.toLowerCase() ||
            localStorage.getItem("guestEmail")?.toLowerCase() ||
            "";
        }

        if (!isAuthenticated && !effectiveGuestEmail) {
          setError("Guest email not available. Please provide your email.");
          setLoading(false);
          return;
        }

        console.log("Fetching booking for bookingId:", bookingId);
        const result = await paymentApi.getBooking(
          bookingId,
          isAuthenticated,
          effectiveGuestEmail
        );

        if (result.success) {
          setBooking(result.data);
        } else {
          throw new Error(result.message);
        }
      } catch (err) {
        console.error("Error loading details:", err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    loadDetails();
  }, [transaction?.id, guestEmail, isAuthenticated]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="h-8 w-8 text-orange-500 animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="max-w-2xl mx-auto px-4">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Error</h1>
            <p className="text-red-500">{error}</p>
          </div>
          <button
            onClick={() => navigate("/history")}
            className="bg-white hover:bg-gray-50 text-gray-700 font-bold py-3 px-6 rounded-lg border border-gray-300"
          >
            Back to Bookings
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-2xl mx-auto px-4">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-green-100 rounded-full mb-4">
            <CheckCircle className="h-12 w-12 text-green-500" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Payment Successful
          </h1>
          <p className="text-gray-600">
            Thank you for your payment! Your booking is confirmed.
          </p>
        </div>

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
                <span className="text-gray-900">KSh {transaction.amount}</span>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-gray-100">
                <span className="text-gray-600">Status:</span>
                <span
                  className={`text-gray-900 capitalize ${
                    transaction.status === "success" ? "text-green-500" : ""
                  }`}
                >
                  {transaction.status}
                </span>
              </div>
              {booking && (
                <div className="flex justify-between items-center py-2">
                  <span className="text-gray-600">Booking ID:</span>
                  <span className="font-mono text-sm text-gray-900">
                    {booking.id}
                  </span>
                </div>
              )}
            </div>
          </div>
        )}

        {booking && (
          <div className="bg-white rounded-2xl shadow-lg p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center">
              <Package className="h-6 w-6 text-orange-500 mr-2" />
              Booking Details
            </h2>
            <div className="space-y-3">
              <div className="flex justify-between items-center py-2 border-b border-gray-100">
                <span className="text-gray-600">Tracking Number:</span>
                <span className="font-mono text-sm text-gray-900">
                  {booking.tracking_number}
                </span>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-gray-100">
                <span className="text-gray-600">Pickup Address:</span>
                <span className="text-sm text-gray-900">
                  {booking.pickup_address?.line1},{" "}
                  {booking.pickup_address?.city}
                </span>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-gray-100">
                <span className="text-gray-600">Dropoff Address:</span>
                <span className="text-sm text-gray-900">
                  {booking.dropoff_address?.line1},{" "}
                  {booking.dropoff_address?.city}
                </span>
              </div>
              <div className="flex justify-between items-center py-2">
                <span className="text-gray-600">Scheduled Pickup:</span>
                <span className="text-sm text-gray-900">
                  {new Date(booking.scheduled_pickup_at).toLocaleString()}
                </span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}