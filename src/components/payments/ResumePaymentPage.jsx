/**
 * ResumePaymentPage.jsx
 * ══════════════════════════════════════════════════════════════════════════════
 * Route: /pay/resume/:resumeToken
 *
 * Deep-link target for the "complete your payment" reminder email. The token
 * is an opaque capability token stored on the booking (never the booking or
 * transaction PK), so nothing enumerable ever appears in an email link.
 *
 * Flow:
 *   1. GET /api/booking/bookings/resume/:token/ — the backend re-derives the
 *      LIVE payable state server-side (never trusts anything cached in the
 *      email, so a stale amount can't be paid).
 *   2. state === "payable"  → redirect into /pay/:txId pre-hydrated with the
 *      inline transaction (same hydration path as booking creation — no
 *      follow-up transaction GET).
 *      state === "expired" / "completed" / "cancelled" → explain, offer the
 *      sensible next step (new quote / home).
 *
 * bookingApi.resumeBooking() also persists guestEmail + guestIdentifier to
 * localStorage, which the payment-initiation endpoints require for guests.
 */

import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { AlertCircle, CheckCircle, Clock, Loader2 } from "lucide-react";
import bookingApi from "../../api/BookingApi";

export default function ResumePaymentPage() {
  const { resumeToken } = useParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState({ loading: true, error: null, result: null });
  // One owner for the fetch — StrictMode double-mount must not fire it twice.
  const requestRef = useRef(null);

  useEffect(() => {
    let mounted = true;
    if (!requestRef.current) {
      requestRef.current = bookingApi.resumeBooking(resumeToken);
    }
    (async () => {
      const res = await requestRef.current;
      if (!mounted) return;

      if (!res.success) {
        setStatus({ loading: false, error: res.message, result: null });
        return;
      }

      const data = res.data;
      if (data.state === "payable" && data.transaction?.id) {
        // Same inline-hydration contract as BookingModal → PaymentPage.
        navigate(`/pay/${data.transaction.id}`, {
          replace: true,
          state: {
            transaction: data.transaction,
            guestEmail: data.guest_email || null,
          },
        });
        return;
      }
      setStatus({ loading: false, error: null, result: data });
    })();
    return () => {
      mounted = false;
    };
  }, [resumeToken, navigate]);

  if (status.loading) {
    return (
      <Shell>
        <Loader2 className="w-10 h-10 animate-spin text-orange-400 mx-auto" />
        <p className="text-slate-400 text-center mt-4">Loading your booking…</p>
      </Shell>
    );
  }

  if (status.error) {
    return (
      <Shell>
        <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-4" />
        <h2 className="text-xl font-semibold text-white text-center mb-2">
          Payment Link Problem
        </h2>
        <p className="text-slate-400 text-center mb-6">{status.error}</p>
        <CenteredButton onClick={() => navigate("/quote")}>
          Start a New Quote
        </CenteredButton>
      </Shell>
    );
  }

  const { state, final_price: finalPrice, pickup, dropoff } = status.result || {};

  if (state === "completed") {
    return (
      <Shell>
        <CheckCircle className="w-12 h-12 text-green-400 mx-auto mb-4" />
        <h2 className="text-xl font-semibold text-white text-center mb-2">
          This Booking Is Already Paid
        </h2>
        <p className="text-slate-400 text-center mb-6">
          Nothing left to do — your booking is confirmed and in progress.
        </p>
        <CenteredButton onClick={() => navigate("/")}>Home</CenteredButton>
      </Shell>
    );
  }

  // expired or cancelled
  return (
    <Shell>
      <Clock className="w-12 h-12 text-yellow-400 mx-auto mb-4" />
      <h2 className="text-xl font-semibold text-white text-center mb-2">
        {state === "cancelled" ? "This Booking Was Cancelled" : "This Booking Has Expired"}
      </h2>
      <p className="text-slate-400 text-center mb-2">
        {state === "cancelled"
          ? "This booking was cancelled, so its payment link is no longer active."
          : "The payment window for this booking has closed, so it can no longer be paid at the original price."}
      </p>
      {pickup && dropoff && (
        <p className="text-slate-500 text-sm text-center mb-6">
          {pickup} → {dropoff}
          {finalPrice ? ` · £${finalPrice}` : ""}
        </p>
      )}
      <p className="text-slate-400 text-center mb-6">
        You can get a fresh quote for the same route in under a minute.
      </p>
      <CenteredButton onClick={() => navigate("/quote")}>
        Get a New Quote
      </CenteredButton>
    </Shell>
  );
}

function Shell({ children }) {
  return (
    <div className="min-h-screen bg-slate-900 py-16 px-4">
      <div className="max-w-lg mx-auto bg-slate-800 border border-slate-700 rounded-2xl p-8 shadow-xl">
        {children}
      </div>
    </div>
  );
}

function CenteredButton({ onClick, children }) {
  return (
    <div className="text-center">
      <button
        onClick={onClick}
        className="bg-orange-500 hover:bg-orange-600 text-white font-semibold
                   rounded-xl px-6 py-3 transition-colors"
      >
        {children}
      </button>
    </div>
  );
}
