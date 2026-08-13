/**
 * PaymentSuccess.jsx
 *
 * Shown at /pay/success — a dedicated success landing page kept for backwards
 * compatibility with any redirect-based flow that navigates here with
 * location.state.transaction.
 *
 * NOTE: The primary post-payment success UI is now the SuccessScreen component
 * inside PaymentPage.jsx (shown inline after Stripe/PayPal confirmation).
 * This page is only reached if something explicitly navigates to /pay/success.
 *
 * ── Fix changelog ────────────────────────────────────────────────────────────
 * FIX-A  paymentApi.getTransaction(txId, isAuthenticated, guestEmail) was called
 *        with 3 arguments. The method signature is getTransaction(txId, guestEmail).
 *        Passing isAuthenticated as guestEmail caused every guest transaction fetch
 *        to send "true"/"false" as the guest email query param.
 *
 * FIX-B  paymentApi.getBooking() does not exist on PaymentApi. Booking details
 *        should be fetched via bookingApi.getBooking() from BookingApi.
 *        Added import and corrected the call.
 */

import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { paymentApi } from "../../api/PaymentApi";
import { bookingApi } from "../../api/BookingApi";   // FIX-B: import bookingApi
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
        // FIX-E: If this page was reached via a Stripe bulk Checkout return
        // (e.g. ?session_id=cs_xxx without a transaction in location.state),
        // redirect gracefully instead of showing "No transaction data available".
        // Bulk payments are handled by BulkPaymentPage → BulkPaymentSuccessPage.
        const params = new URLSearchParams(window.location.search);
        const sessionId = params.get("session_id");
        if (!transaction?.id && sessionId) {
          // We don't have the uploadId here, so just send to the dashboard
          navigate("/bulk-upload", { replace: true });
          return;
        }

        if (!transaction?.id) {
          setError("No transaction data available");
          setLoading(false);
          return;
        }

        // FIX-A: getTransaction(txId, guestEmail) — only 2 args.
        // Previously passed isAuthenticated as the second arg (guestEmail slot).
        const transactionResult = await paymentApi.getTransaction(
          transaction.id,
          isAuthenticated ? null : guestEmail  // pass guestEmail only for guests
        );

        if (!transactionResult.success) {
          throw new Error(transactionResult.message);
        }

        const updatedTransaction = transactionResult.data;
        setTransaction(updatedTransaction);

        const bookingId =
          updatedTransaction?.booking?.id || updatedTransaction?.booking;

        if (!bookingId) {
          // Bulk upload transactions don't have a booking — show generic success
          setLoading(false);
          return;
        }

        let effectiveGuestEmail = guestEmail;

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

        // FIX-B: use bookingApi.getBooking — paymentApi has no getBooking method.
        const result = await bookingApi.getBooking(bookingId);

        if (result.success) {
          setBooking(result.data);
        } else {
          throw new Error(result.message);
        }
      } catch (err) {
        console.error("PaymentSuccess: error loading details:", err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    loadDetails();
  }, [transaction?.id, guestEmail, isAuthenticated]);

  if (loading) {
    return (
      <div className="min-h-screen bg-muted flex items-center justify-center">
        <Loader2 className="h-8 w-8 text-brand-text animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-muted py-8">
        <div className="max-w-2xl mx-auto px-4">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-foreground mb-2">Error</h1>
            <p className="text-destructive">{error}</p>
          </div>
          <button
            onClick={() => navigate("/history")}
            className="bg-card hover:bg-muted text-muted-foreground font-bold py-3 px-6 rounded-lg border border-border-strong"
          >
            Back to Bookings
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background py-25">
      <div className="max-w-2xl mx-auto px-4">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-success-surface rounded-full mb-4">
            <CheckCircle className="h-12 w-12 text-success" />
          </div>
          <h1 className="text-3xl font-bold text-success mb-2">
            Payment Successful
          </h1>
          <p className="text-foreground">
            Thank you for your payment! Your booking is confirmed.
          </p>
        </div>

        {transaction && (
          <div className="bg-card rounded-2xl shadow-lg p-6 mb-6">
            <h2 className="text-xl font-bold text-foreground mb-4">
              Transaction Details
            </h2>
            <div className="space-y-3">
              <div className="flex justify-between items-center py-2 border-b border-border">
                <span className="text-muted-foreground">Transaction ID:</span>
                <span className="font-mono text-sm text-foreground">
                  {transaction.reference}
                </span>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-border">
                <span className="text-muted-foreground">Amount:</span>
                <span className="text-foreground">GBP {transaction.amount}</span>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-border">
                <span className="text-muted-foreground">Status:</span>
                <span
                  className={`text-foreground capitalize ${
                    transaction.status === "success" ? "text-success" : ""
                  }`}
                >
                  {transaction.status}
                </span>
              </div>
              {booking && (
                <div className="flex justify-between items-center py-2">
                  <span className="text-muted-foreground">Booking ID:</span>
                  <span className="font-mono text-sm text-foreground">
                    {booking.id}
                  </span>
                </div>
              )}
            </div>
          </div>
        )}

        {booking && (
          <div className="bg-card rounded-2xl shadow-lg p-6">
            <h2 className="text-xl font-bold text-foreground mb-4 flex items-center">
              <Package className="h-6 w-6 text-brand-text mr-2" />
              Booking Details
            </h2>
            <div className="space-y-3">
              <div className="flex justify-between items-center py-2 border-b border-border">
                <span className="text-muted-foreground">Tracking Number:</span>
                <span className="font-mono text-sm text-foreground">
                  {booking.tracking_number}
                </span>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-border">
                <span className="text-muted-foreground">Pickup Address:</span>
                <span className="text-sm text-foreground">
                  {booking.pickup_address?.line1},{" "}
                  {booking.pickup_address?.city}
                </span>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-border">
                <span className="text-muted-foreground">Dropoff Address:</span>
                <span className="text-sm text-foreground">
                  {booking.dropoff_address?.line1},{" "}
                  {booking.dropoff_address?.city}
                </span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
