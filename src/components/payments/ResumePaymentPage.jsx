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
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { AlertCircle, CheckCircle, Clock, Loader2, Lock, UserX } from "lucide-react";
import bookingApi from "../../api/BookingApi";
import { useAuth } from "../../contexts/AuthContext";

export default function ResumePaymentPage() {
  const { resumeToken } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { isAuthenticated } = useAuth();
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

      // §1/§2: the booking belongs to a REAL account and the caller is logged
      // out — send them through login, preserving THIS page as `next`. After
      // auth they return here and the re-fetch (now carrying the token) resolves
      // to the owner's payment page. Only redirect once: if we come back still
      // authenticated but blocked, fall through to a clear error instead of
      // looping.
      if (data.state === "auth_required" && !isAuthenticated) {
        const next = encodeURIComponent(location.pathname);
        navigate(`/login?next=${next}`, { replace: true });
        return;
      }

      setStatus({ loading: false, error: null, result: data });
    })();
    return () => {
      mounted = false;
    };
  }, [resumeToken, navigate, isAuthenticated, location.pathname]);

  if (status.loading) {
    return (
      <Shell>
        <Loader2 className="w-10 h-10 animate-spin text-brand-text mx-auto" />
        <p className="text-muted-foreground text-center mt-4">Loading your booking…</p>
      </Shell>
    );
  }

  if (status.error) {
    return (
      <Shell>
        <AlertCircle className="w-12 h-12 text-destructive mx-auto mb-4" />
        <h2 className="text-xl font-semibold text-foreground text-center mb-2">
          Payment Link Problem
        </h2>
        <p className="text-muted-foreground text-center mb-6">{status.error}</p>
        <CenteredButton onClick={() => navigate("/quote")}>
          Start a New Quote
        </CenteredButton>
      </Shell>
    );
  }

  const { state, final_price: finalPrice, pickup, dropoff, owner_hint: ownerHint } = status.result || {};

  if (state === "forbidden_owner") {
    return (
      <Shell>
        <UserX className="w-12 h-12 text-destructive mx-auto mb-4" />
        <h2 className="text-xl font-semibold text-foreground text-center mb-2">
          This Booking Belongs to a Different Account
        </h2>
        <p className="text-muted-foreground text-center mb-2">
          You're signed in as a different account than the one that created this
          booking{ownerHint ? <>, which is registered to <span className="text-foreground">{ownerHint}</span></> : null}.
        </p>
        <p className="text-muted-foreground text-center mb-6">
          Sign in with that account to complete the payment.
        </p>
        <CenteredButton onClick={() => navigate(`/login?next=${encodeURIComponent(location.pathname)}`)}>
          Switch Account
        </CenteredButton>
      </Shell>
    );
  }

  if (state === "auth_required") {
    // Reached only if we returned here still unable to resolve ownership.
    return (
      <Shell>
        <Lock className="w-12 h-12 text-brand-text mx-auto mb-4" />
        <h2 className="text-xl font-semibold text-foreground text-center mb-2">
          Sign In to Continue
        </h2>
        <p className="text-muted-foreground text-center mb-6">
          This booking is tied to a registered account. Please sign in to view
          and complete its payment.
        </p>
        <CenteredButton onClick={() => navigate(`/login?next=${encodeURIComponent(location.pathname)}`)}>
          Sign In
        </CenteredButton>
      </Shell>
    );
  }

  if (state === "completed") {
    return (
      <Shell>
        <CheckCircle className="w-12 h-12 text-success mx-auto mb-4" />
        <h2 className="text-xl font-semibold text-foreground text-center mb-2">
          This Booking Is Already Paid
        </h2>
        <p className="text-muted-foreground text-center mb-6">
          Nothing left to do — your booking is confirmed and in progress.
        </p>
        <CenteredButton onClick={() => navigate("/")}>Home</CenteredButton>
      </Shell>
    );
  }

  // expired or cancelled
  return (
    <Shell>
      <Clock className="w-12 h-12 text-warning mx-auto mb-4" />
      <h2 className="text-xl font-semibold text-foreground text-center mb-2">
        {state === "cancelled" ? "This Booking Was Cancelled" : "This Booking Has Expired"}
      </h2>
      <p className="text-muted-foreground text-center mb-2">
        {state === "cancelled"
          ? "This booking was cancelled, so its payment link is no longer active."
          : "The payment window for this booking has closed, so it can no longer be paid at the original price."}
      </p>
      {pickup && dropoff && (
        <p className="text-subtle-foreground text-sm text-center mb-6">
          {pickup} → {dropoff}
          {finalPrice ? ` · £${finalPrice}` : ""}
        </p>
      )}
      <p className="text-muted-foreground text-center mb-6">
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
    <div className="min-h-screen bg-card py-16 px-4">
      <div className="max-w-lg mx-auto bg-surface border border-border rounded-2xl p-8 shadow-xl">
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
        className="bg-primary hover:bg-primary-hover text-primary-foreground font-semibold
                   rounded-xl px-6 py-3 transition-colors"
      >
        {children}
      </button>
    </div>
  );
}
