// PaymentSuccess.jsx (Handle possibly nested booking field; optimized to prevent duplicates)
import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { paymentApi } from "../../api/PaymentApi";
import { useAuth } from "../../contexts/AuthContext";
import { Loader2, CheckCircle, MapPin, Calendar, Package } from "lucide-react";

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
    const loadBookingDetails = async () => {
      try {
        // Handle possibly nested booking field
        const bookingId = transaction?.booking?.id || transaction?.booking;

        if (!bookingId) {
          setError("No booking associated with this transaction");
          setLoading(false);
          return;
        }

        let effectiveGuestEmail = guestEmail.toLowerCase();

        if (!isAuthenticated && !effectiveGuestEmail) {
          effectiveGuestEmail =
            transaction?.guest_email?.toLowerCase() ||
            localStorage.getItem("guestEmail")?.toLowerCase() ||
            "";
        }

        if (!isAuthenticated && !effectiveGuestEmail) {
          setError("Guest email not available. Please provide your email.");
          setLoading(false);
          return;
        }

        const result = await paymentApi.getBooking(
          bookingId,
          isAuthenticated,
          effectiveGuestEmail
        );

        if (result.success) {
          setBooking(result.data);
        } else {
          console.log("getBooking failed:", result);
          setError(result.message || "Failed to load booking details");
        }
      } catch (err) {
        console.log("loadBookingDetails error:", err, err.response?.data);
        setError(
          "Failed to load booking details: " +
            (err.response?.data?.detail || err.message)
        );
      } finally {
        setLoading(false);
        if (!isAuthenticated) {
          localStorage.removeItem("guestEmail");
        }
      }
    };

    loadBookingDetails();
  }, [transaction, isAuthenticated, navigate]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-12 w-12 text-orange-500 animate-spin mx-auto mb-4" />
          <p className="text-gray-600 font-medium">
            Loading payment confirmation...
          </p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full text-center">
          <CheckCircle className="h-16 w-16 text-red-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Error</h1>
          <p className="text-gray-600 mb-6">{error}</p>
          <button
            onClick={() => navigate("/history")}
            className="w-full bg-orange-500 hover:bg-orange-600 text-white font-bold py-3 px-6 rounded-lg transition-colors"
          >
            Return to Bookings
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-2xl mx-auto px-4">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Payment Successful
          </h1>
          <p className="text-gray-600">Your booking is confirmed!</p>
        </div>

        <div className="bg-white rounded-2xl shadow-lg p-6 mb-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center">
            <CheckCircle className="h-6 w-6 text-green-500 mr-2" />
            Transaction Details
          </h2>
          <div className="space-y-3">
            <div className="flex justify-between items-center py-2 border-b border-gray-100">
              <span className="text-gray-600">Transaction ID:</span>
              <span className="font-mono text-sm text-gray-900">
                {transaction?.reference}
              </span>
            </div>
            <div className="flex justify-between items-center py-2 border-b border-gray-100">
              <span className="text-gray-600">Amount:</span>
              <span className="text-xl font-bold text-gray-900">
                KSh {Number.parseFloat(transaction?.amount || 0).toFixed(2)}
              </span>
            </div>
            <div className="flex justify-between items-center py-2 border-b border-gray-100">
              <span className="text-gray-600">Status:</span>
              <span className="px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm font-medium capitalize">
                {transaction?.status}
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
