/**
 * PaymentPage.jsx  ── COMPLETE UNIFIED IMPLEMENTATION  (FIXED)
 * ══════════════════════════════════════════════════════════════════════════════
 * Route: /pay/:txId   (single booking & bulk prepaid)
 *
 * Handles:
 *  • Single booking — Stripe card payment
 *  • Single booking — PayPal redirect + capture
 *  • Bulk upload PREPAID — Stripe card payment
 *  • Bulk upload PREPAID — PayPal redirect + capture
 *
 * Flow
 * ────
 *  1. Mount: load tx via GET /api/payments/transactions/:txId/
 *     Determine: gateway from tx.gateway, flow from tx.metadata.source
 *  2. Stripe: render <Elements> + card form → confirmCardPayment → show success
 *  3. PayPal: show "Pay with PayPal" button → redirect to approval_url
 *             On return: /pay/:txId?paypal_return=1&token=ORDER_ID
 *             capturePaypalOrder → show success
 *  4. NET terms: this page is NOT used (redirect to /invoices/:invoiceId)
 *
 * The webhook is the source of truth for booking status.
 * This page only shows the user confirmation — it does NOT mark the tx.
 *
 * ── Fix changelog ────────────────────────────────────────────────────────────
 * FIX-1  JSX parse error: inline comment after a prop value is illegal in
 *        JSX — Babel treats it as a second attribute. Moved all inline
 *        comments to their own line inside the element or above the prop.
 *
 * FIX-2  useCallback hoisting: handleConfirmSuccess referenced
 *        handlePaymentSucceeded in its body AND dependency array before
 *        handlePaymentSucceeded was declared. useCallback is NOT hoisted
 *        like function declarations — this caused a ReferenceError on every
 *        Stripe payment. Fixed by declaring handlePaymentSucceeded FIRST.
 *
 * FIX-3  PayPal capture: onSuccess={handleSuccess} was an undefined reference.
 *        Now correctly passes onSuccess={handlePaymentSucceeded}.
 *
 * FIX-B1 (INFINITE RELOAD) navState.gateway was never seeded into
 *        state.selectedGateway. When useBulkUpload navigates with
 *        { state: { gateway, clientSecret, approvalUrl } }, the render
 *        branches (activeGateway === "stripe/paypal") evaluated to false
 *        because activeGateway was always null. The component fell through
 *        to the fallback ErrorScreen → user clicked "Go Back" → BulkUploadFlow
 *        re-fired pendingAutoInit → re-navigated → same broken render → loop.
 *        Fix: seed selectedGateway from navState inside the loading useEffect.
 *
 * FIX-B2 (PAYPAL REDIRECT NEVER FIRES) The PayPal auto-redirect useEffect
 *        guarded on state.selectedGateway === "paypal" — which was always null
 *        for the navState path (see FIX-B1). Even after FIX-B1, if a caller
 *        provides approvalUrl without going through handleSelectGateway, the
 *        guard would still block. Fix: fire whenever approvalUrl is set,
 *        regardless of selectedGateway value.
 *
 * FIX-B3 (STALE CLOSURE) handleConfirmSuccess captured state.tx at
 *        callback-creation time, not at call time. On first payment state.tx
 *        was still null — the fallback was always null. Fix: functional
 *        setState (s.tx) instead of closed-over state.tx.
 *
 * FIX-B4 (NULL TX ON GATEWAY SELECT) handleSelectGateway read state.tx which
 *        could be null if called before getTransaction completes. Fix: guard
 *        at function entry and surface a recoverable error.
 *
 * FIX-B5 (PAYPAL RETURN isBulk HARDCODED) SuccessScreen inside the PayPal
 *        return branch passed isBulk={false} — bulk PayPal success always
 *        showed the single-booking message. Fix: derive from tx + navState.
 *
 * FIX-B6 (GUEST EMAIL STALE CLOSURE) state.guestEmail was initialised to null
 *        and only populated in the loading useEffect. handleSelectGateway
 *        read state.guestEmail (always null during initiation) rather than
 *        the closure variable. Fix: seed guestEmail directly into initial state
 *        so state.guestEmail and the closure variable are always in sync.
 *
 * FIX-B7 (ERROR RENDER ORDER) The state.error check appeared after the gateway
 *        render branches — a gateway error could be masked by the fallback
 *        ErrorScreen. Fix: the state.error early-return now comes BEFORE the
 *        gateway selection / initiation guards.
 */

import { useEffect, useState, useCallback, useRef } from "react";
import {
  useParams,
  useNavigate,
  useSearchParams,
  useLocation,
} from "react-router-dom";
import { loadStripe } from "@stripe/stripe-js";
import {
  Elements,
  CardElement,
  useStripe,
  useElements,
} from "@stripe/react-stripe-js";
import paymentApi from "../../api/PaymentApi";
import bookingApi from "../../api/BookingApi";
import {
  Loader2,
  CreditCard,
  CheckCircle,
  AlertCircle,
  ArrowLeft,
  Shield,
  Package,
  ExternalLink,
  Lock,
  Zap,
} from "lucide-react";

const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY);

// ─── Card element styles ─────────────────────────────────────────────────────

const CARD_STYLE = {
  style: {
    base: {
      color: "#f1f5f9",
      fontFamily: "Inter, system-ui, sans-serif",
      fontSize: "16px",
      "::placeholder": { color: "#94a3b8" },
      iconColor: "#94a3b8",
    },
    invalid: { color: "#f87171" },
  },
};

// ─── Stripe checkout form ─────────────────────────────────────────────────────

function StripeCheckoutForm({
  clientSecret,
  txId,
  amount,
  currency,
  onConfirmSuccess,
  onError,
}) {
  const stripe = useStripe();
  const elements = useElements();
  const [processing, setProcessing] = useState(false);
  const [cardError, setCardError] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!stripe || !elements) return;

    setProcessing(true);
    setCardError(null);

    try {
      const { error, paymentIntent } = await stripe.confirmCardPayment(
        clientSecret,
        {
          payment_method: { card: elements.getElement(CardElement) },
        },
      );

      if (error) {
        setCardError(error.message);
        onError(error.message);
      } else if (paymentIntent.status === "succeeded") {
        // Tell the backend to finalise immediately — don't wait for the webhook.
        // onConfirmSuccess shows a "Confirming..." spinner while the call is in flight.
        await onConfirmSuccess(paymentIntent.id);
      } else {
        setCardError(`Unexpected payment state: ${paymentIntent.status}`);
        onError("Unexpected payment state.");
      }
    } catch (err) {
      const msg = err.message || "An unexpected error occurred.";
      setCardError(msg);
      onError(msg);
    } finally {
      setProcessing(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="bg-surface/50 border border-border rounded-xl p-5">
        <p className="text-sm text-muted-foreground mb-1">Amount due</p>
        <p className="text-3xl font-bold text-foreground">
          {currency} {parseFloat(amount).toFixed(2)}
        </p>
      </div>

      <div className="bg-surface/50 border border-border rounded-xl p-4">
        <label className="block text-sm font-medium text-muted-foreground mb-3">
          Card details
        </label>
        <CardElement options={CARD_STYLE} />
      </div>

      {cardError && (
        <div className="flex items-start gap-2 bg-destructive-surface border border-destructive/30 rounded-lg p-3 text-destructive text-sm">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          {cardError}
        </div>
      )}

      <button
        type="submit"
        disabled={!stripe || processing}
        className="w-full flex items-center justify-center gap-2 bg-primary hover:bg-primary-hover
                   disabled:bg-surface-hover disabled:cursor-not-allowed text-primary-foreground font-semibold
                   rounded-xl py-4 px-6 transition-colors"
      >
        {processing ? (
          <>
            <Loader2 className="w-5 h-5 animate-spin" /> Processing…
          </>
        ) : (
          <>
            <CreditCard className="w-5 h-5" /> Pay {currency}{" "}
            {parseFloat(amount).toFixed(2)}
          </>
        )}
      </button>

      <p className="flex items-center justify-center gap-2 text-xs text-subtle-foreground">
        <Shield className="w-4 h-4" /> Secured by Stripe
      </p>
    </form>
  );
}

// ─── Gateway selection screen ─────────────────────────────────────────────────

function GatewaySelectionScreen({
  tx,
  amount,
  currency,
  onSelectGateway,
  loading,
}) {
  const [selectedGateway, setSelectedGateway] = useState("stripe");

  const handleProceed = async () => {
    await onSelectGateway(selectedGateway);
  };

  const isBulk = !!tx?.bulk_upload;
  const bookingRef = tx?.id?.slice(0, 8)?.toUpperCase();

  return (
    <div className="space-y-6">
      {/* Header with progress indicator */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-medium text-muted-foreground">Payment Step</h3>
          <span className="text-xs font-semibold text-brand-text">3 of 3</span>
        </div>
        <h2 className="text-2xl font-bold text-foreground">Select Payment Method</h2>
        <p className="text-sm text-muted-foreground">
          Choose how you'd like to pay for your{" "}
          {isBulk ? "bulk upload" : "booking"}
        </p>
      </div>

      {/* Amount summary card */}
      <div className="bg-gradient-to-br from-surface-hover/50 to-surface/50 border border-border rounded-xl p-5">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">
          Total Amount Due
        </p>
        <p className="text-3xl font-bold text-foreground">
          {currency}
          {parseFloat(amount).toFixed(2)}
        </p>
        {bookingRef && (
          <p className="text-xs text-muted-foreground mt-3">
            Reference:{" "}
            <span className="font-mono text-brand-text">{bookingRef}</span>
          </p>
        )}
      </div>

      {/* Gateway selection cards */}
      <div className="space-y-3">
        {/* Stripe Card */}
        <button
          onClick={() => setSelectedGateway("stripe")}
          className={`w-full text-left p-4 rounded-xl border-2 transition-all ${
            selectedGateway === "stripe"
              ? "border-primary bg-primary/5 shadow-lg shadow-primary/20"
              : "border-border bg-surface/30 hover:border-border-strong"
          }`}
        >
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-2">
                <CreditCard className="w-5 h-5 text-brand-text" />
                <h3 className="font-semibold text-foreground">Pay with Card</h3>
              </div>
              <p className="text-sm text-muted-foreground">
                Visa, Mastercard, American Express • Instant processing
              </p>
            </div>
            <div
              className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                selectedGateway === "stripe"
                  ? "border-primary bg-primary"
                  : "border-border-strong bg-transparent"
              }`}
            >
              {selectedGateway === "stripe" && (
                <div className="w-2 h-2 bg-card rounded-full" />
              )}
            </div>
          </div>
          <div className="flex items-center gap-1 mt-3 text-xs text-muted-foreground">
            <Zap className="w-3 h-3" />
            Powered by Stripe
          </div>
        </button>

        {/* PayPal Card */}
        <button
          onClick={() => setSelectedGateway("paypal")}
          className={`w-full text-left p-4 rounded-xl border-2 transition-all ${
            selectedGateway === "paypal"
              ? "border-info bg-info/5 shadow-lg shadow-info/20"
              : "border-border bg-surface/30 hover:border-border-strong"
          }`}
        >
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-5 h-5 bg-info rounded-full flex items-center justify-center">
                  <span className="text-xs font-bold text-foreground">P</span>
                </div>
                <h3 className="font-semibold text-foreground">Pay with PayPal</h3>
              </div>
              <p className="text-sm text-muted-foreground">
                PayPal balance, linked cards, or bank account
              </p>
            </div>
            <div
              className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                selectedGateway === "paypal"
                  ? "border-info bg-info"
                  : "border-border-strong bg-transparent"
              }`}
            >
              {selectedGateway === "paypal" && (
                <div className="w-2 h-2 bg-card rounded-full" />
              )}
            </div>
          </div>
        </button>
      </div>

      {/* Security info */}
      <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
        <Lock className="w-3.5 h-3.5 text-success" />
        <span>PCI DSS Level 1 Certified • 256-bit SSL Encryption</span>
      </div>

      {/* Action buttons */}
      <div className="pt-2 space-y-2">
        <button
          onClick={handleProceed}
          disabled={loading}
          className="w-full bg-primary hover:bg-primary-hover disabled:bg-surface-hover
                     text-primary-foreground font-semibold rounded-xl py-4 px-6 transition-colors
                     flex items-center justify-center gap-2"
        >
          {loading ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              Preparing {selectedGateway === "stripe" ? "Stripe" : "PayPal"}…
            </>
          ) : (
            <>
              <ExternalLink className="w-5 h-5" />
              Continue to{" "}
              {selectedGateway === "stripe" ? "Secure Checkout" : "PayPal"}
            </>
          )}
        </button>
        <p className="text-center text-xs text-subtle-foreground">
          Your payment information is secure and encrypted
        </p>
      </div>
    </div>
  );
}

// ─── PayPalRedirectScreen ─────────────────────────────────────────────────────
// Auto-redirect fires in a useEffect in the parent. This screen shows a spinner
// and a fallback button while the browser navigates away.

function PayPalRedirectScreen({ approvalUrl, amount, currency }) {
  return (
    <div className="space-y-6 text-center">
      <div className="flex flex-col items-center gap-3 py-4">
        <Loader2 className="w-8 h-8 animate-spin text-info" />
        <p className="text-muted-foreground font-medium">Redirecting to PayPal…</p>
        <p className="text-subtle-foreground text-sm">
          You will be taken to PayPal to complete your payment securely.
        </p>
      </div>

      <div className="bg-surface/50 border border-border rounded-xl p-5">
        <p className="text-sm text-muted-foreground mb-1">Amount due</p>
        <p className="text-3xl font-bold text-foreground">
          {currency} {parseFloat(amount).toFixed(2)}
        </p>
      </div>

      <div className="space-y-2">
        <p className="text-xs text-subtle-foreground">Not redirected automatically?</p>
        <button
          onClick={() => { window.location.href = approvalUrl; }}
          className="w-full flex items-center justify-center gap-2 bg-[#0070ba] hover:bg-[#005ea6]
                     text-white font-semibold rounded-xl py-4 px-6 transition-colors"
        >
          <ExternalLink className="w-5 h-5" />
          Continue to PayPal
        </button>
      </div>
    </div>
  );
}

// ─── PayPal capture handler ───────────────────────────────────────────────────
// Rendered on the PayPal return URL: /pay/:txId?paypal_return=1&token=ORDER_ID
// Immediately fires capturePaypalOrder and delegates success/failure upward.

function PayPalCapturePage({ txId, token, onSuccess, onError }) {
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const result = await paymentApi.capturePaypalOrder(txId, token);
        if (!mounted) return;
        if (result.success || result.data?.success) {
          onSuccess();
        } else {
          // PayPal capture returned but payment not yet complete (rare edge case)
          const msg =
            result.message ||
            result.data?.message ||
            "Payment could not be confirmed. Please contact support.";
          onError(msg);
        }
      } catch (err) {
        if (mounted) {
          onError(err?.message || "An error occurred confirming your payment.");
        }
      }
    })();
    return () => {
      mounted = false;
    };
  }, [txId, token, onSuccess, onError]);

  return (
    <div className="flex flex-col items-center gap-4 py-12">
      <Loader2 className="w-10 h-10 animate-spin text-brand-text" />
      <p className="text-muted-foreground">Confirming your payment…</p>
    </div>
  );
}

// ─── Success screen ───────────────────────────────────────────────────────────

function SuccessScreen({ isBulk, guestEmail, tx }) {
  const navigate = useNavigate();
  const trackingNumber = tx?.booking?.tracking_number;

  return (
    <div className="flex flex-col items-center gap-6 py-12 text-center max-w-md mx-auto">
      <div
        className="w-20 h-20 bg-success-surface border-2 border-success rounded-full
                      flex items-center justify-center"
      >
        <CheckCircle className="w-10 h-10 text-success" />
      </div>
      <div>
        <h2 className="text-2xl font-bold text-foreground mb-2">
          Payment Successful!
        </h2>

        {guestEmail ? (
          <div className="space-y-2">
            <p className="text-muted-foreground">
              Your booking has been confirmed. A confirmation email has been
              sent to:
            </p>
            <p className="text-brand-text font-semibold">{guestEmail}</p>
            {trackingNumber && (
              <div className="mt-4 p-3 bg-surface/50 rounded-lg border border-border">
                <p className="text-xs text-muted-foreground mb-1">Tracking Number</p>
                <p className="text-lg font-mono text-brand-text">
                  {trackingNumber}
                </p>
              </div>
            )}
          </div>
        ) : (
          <p className="text-muted-foreground">
            {isBulk
              ? "Your bookings have been confirmed and will be scheduled shortly."
              : "Your booking is confirmed. You'll receive a confirmation email."}
          </p>
        )}
      </div>

      <div className="flex gap-3">
        {!guestEmail && (
          <button
            onClick={() => navigate(isBulk ? "/bulk-upload" : "/bookings")}
            className="bg-surface hover:bg-surface-hover text-foreground font-medium rounded-xl
                       px-6 py-3 transition-colors"
          >
            {isBulk ? "View Uploads" : "My Bookings"}
          </button>
        )}
        <button
          onClick={() => navigate("/")}
          className="bg-primary hover:bg-primary-hover text-primary-foreground font-semibold rounded-xl
                     px-6 py-3 transition-colors"
        >
          Home
        </button>
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function PaymentPage() {
  const { txId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();

  // ── FIX-B6: Derive guestEmail once, outside state, so every callback and
  // effect always reads the same value without needing it in state.
  // State used to initialise state.guestEmail so both are always in sync.
  const guestEmail =
    location.state?.guestEmail ||
    localStorage.getItem("guestEmail") ||
    null;

  const [state, setState] = useState({
    loading: true,
    error: null,
    succeeded: false,
    // true while POST /confirm-success/ is in flight
    confirming: false,
    tx: null,
    clientSecret: null,
    approvalUrl: null,
    // FIX-B6: seed guestEmail into state immediately — prevents null reads
    // inside handleSelectGateway which accesses state.guestEmail.
    guestEmail,
    // set when user clicks "Continue" OR seeded from navState (FIX-B1)
    selectedGateway: null,
    // loading during /initiate/ call
    initiatingPayment: false,
    // true while re-fetching booking details for the "Back to booking" flow
    backNavigating: false,
  });

  // PayPal return flow detection.
  // PayPal redirects to PAYPAL_RETURN_URL/{tx_id}?token=ORDER_ID&PayerID=XYZ
  // It does NOT add ?paypal_return=1 — we detect by the presence of ?token=
  // and the absence of a paypal_cancelled flag.
  // The old ?paypal_return=1 check is kept as a backwards-compat fallback.
  const paypalToken = searchParams.get("token");
  const isPaypalCancelled = searchParams.get("cancelled") === "true";
  const isPaypalReturn =
    (searchParams.get("paypal_return") === "1" || !!paypalToken) &&
    !isPaypalCancelled;

  // ── FIX-2: declare handlePaymentSucceeded FIRST ───────────────────────────
  // handleConfirmSuccess depends on this via its body and dependency array.
  // useCallback is NOT hoisted — declaring it after the dependent function
  // caused a ReferenceError on every Stripe payment completion.

  /**
   * Shared terminal success handler for BOTH payment paths.
   *   • Stripe:  called at the end of handleConfirmSuccess (after safety-net POST)
   *   • PayPal:  called directly by PayPalCapturePage via onSuccess prop
   *
   * FIX-3: PayPalCapturePage was receiving onSuccess={handleSuccess} which was
   * never defined anywhere — an immediate ReferenceError on every PayPal return.
   * Now correctly wired to handlePaymentSucceeded.
   */
  const handlePaymentSucceeded = useCallback(() => {
    setState((s) => ({ ...s, confirming: false, succeeded: true }));
  }, []);

  const handleError = useCallback((msg) => {
    setState((s) => ({ ...s, confirming: false, error: msg }));
  }, []);

  /**
   * Called after stripe.confirmCardPayment() succeeds.
   * Calls POST /api/payments/confirm-success/ to finalise the booking
   * immediately without waiting for the Stripe webhook.
   * Always shows success screen even if the call fails (webhook handles it).
   */
  const handleConfirmSuccess = useCallback(
    async (paymentIntentId) => {
      setState((s) => ({ ...s, confirming: true, error: null }));
      try {
        const result = await paymentApi.confirmPaymentSuccess({
          paymentIntentId,
          transactionId: txId,
        });
        if (result.success) {
          // Refresh tx so success screen shows updated booking / tracking data
          const txResult = await paymentApi.getTransaction(txId, guestEmail);
          // FIX-B3: use functional setState (s.tx) instead of closed-over
          // state.tx — state.tx was always null on first payment because the
          // useCallback was created before getTransaction completed.
          setState((s) => ({
            ...s,
            tx: txResult.success ? txResult.data : s.tx,
          }));
        } else {
          // confirm-success failed — the webhook handles finalisation.
          // Never block the user from seeing the success screen.
          console.warn(
            "[PaymentPage] confirm-success failed (webhook will handle):",
            result.message,
          );
        }
      } catch (err) {
        console.warn("[PaymentPage] confirm-success network error:", err);
      } finally {
        // Always mark succeeded — Stripe JS already confirmed the payment.
        handlePaymentSucceeded();
      }
    },
    // FIX-2: handlePaymentSucceeded is now declared above, so this dep is valid.
    // FIX-B3: state.tx removed from deps — functional setState uses s.tx instead.
    [txId, guestEmail, handlePaymentSucceeded],
  );

  // Notify backend when PayPal cancelled
  useEffect(() => {
    if (isPaypalCancelled && txId) {
      paymentApi.cancelPaypalOrder(txId).catch(() => {});
    }
  }, [isPaypalCancelled, txId]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Single owner of the transaction fetch (FIX-RACE) ────────────────────────
  // txPromiseRef caches the in-flight request so React 18 StrictMode's
  // double-mount (the "two GETs for the same tx id at the same millisecond"
  // in the server logs) reuses ONE network call instead of firing twice.
  // reloadTick lets handleRetry force a genuine re-fetch.
  const txPromiseRef = useRef(null);
  const [reloadTick, setReloadTick] = useState(0);

  // Load transaction details on mount
  useEffect(() => {
    if (isPaypalReturn || isPaypalCancelled) return; // handled separately

    // Shared state-transition for a loaded transaction, whether it came from
    // navigation state (happy path) or the network (resume/deep-link path).
    const navState = location.state || {};
    const applyTx = (tx) => {
      if (tx.status === "success") {
        setState((s) => ({ ...s, loading: false, tx, succeeded: true }));
        return;
      }
      if (tx.status !== "pending") {
        setState((s) => ({
          ...s,
          loading: false,
          error: `This transaction is ${tx.status} and cannot be paid.`,
        }));
        return;
      }
      setState((s) => ({
        ...s,
        loading: false,
        tx,
        // Gateway credentials arrive via location.state when navigated here
        // from useBulkUpload / BookingModal. If absent, the gateway selection
        // screen lets the user initiate.
        clientSecret: navState.clientSecret || null,
        approvalUrl: navState.approvalUrl || null,
        // FIX-B1: persist the gateway from navState into component state
        selectedGateway: navState.gateway || null,
        // guestEmail was already seeded into initial state (FIX-B6); keep it.
        guestEmail: s.guestEmail,
      }));
    };

    // FIX-RACE (spec §A): hydrate INLINE from the transaction the booking-create
    // response returned (BookingModal passes it via navigation state). No
    // follow-up GET on the happy path — the GET below is reserved for the
    // resume/deep-link case (email link, refresh, direct URL).
    const navTx = navState.transaction;
    if (navTx?.id && String(navTx.id) === String(txId)) {
      // Persist guest credentials from the inline payload so any LATER fetch
      // (success-screen refresh, retry) can authenticate the guest lookup.
      if (navTx.guest_identifier) {
        localStorage.setItem("guestIdentifier", navTx.guest_identifier);
      }
      applyTx(navTx);
      return;
    }

    let mounted = true;
    if (!txPromiseRef.current) {
      // Resume path: tolerate momentary 404s (e.g. replica lag) with
      // 3 backoff retries before surfacing an error.
      txPromiseRef.current = paymentApi.getTransactionWithRetry(txId, guestEmail);
    }
    (async () => {
      const result = await txPromiseRef.current;
      if (!mounted) return;

      if (!result.success) {
        // NEVER fabricate a £0.00 amount from a failed fetch — surface the
        // error state; handleRetry re-runs this effect via reloadTick.
        setState((s) => ({ ...s, loading: false, error: result.message }));
        return;
      }
      applyTx(result.data);
    })();
    return () => {
      mounted = false;
    };
  }, [txId, isPaypalReturn, reloadTick]); // eslint-disable-line react-hooks/exhaustive-deps

  // Handle gateway selection and payment initiation
  const handleSelectGateway = useCallback(
    async (gateway) => {
      // FIX-B4: guard against tx being null (can happen if user somehow triggers
      // this before getTransaction completes — defensive, but avoids silent crash).
      if (!state.tx) {
        setState((s) => ({
          ...s,
          error:
            "Payment details are still loading. Please wait a moment and try again.",
        }));
        return;
      }

      setState((s) => ({
        ...s,
        initiatingPayment: true,
        error: null,
        selectedGateway: gateway,
      }));

      let result;
      try {
        if (state.tx?.bulk_upload) {
          result = await paymentApi.initiateBulkPayment({
            bulkUploadId: state.tx.bulk_upload,
            gateway,
            // Stable idempotency key — no Date.now() to avoid duplicate transactions on retry
            idempotencyKey: `payment-${state.tx.id}-${gateway}`,
          });
        } else if (state.tx?.booking) {
          result = await paymentApi.initiateBookingPayment({
            bookingId: state.tx.booking,
            // FIX-B6: state.guestEmail is now always correct (seeded in initial state)
            guestEmail: state.guestEmail,
            gateway,
            idempotencyKey: `payment-${state.tx.id}-${gateway}`,
          });
        } else {
          setState((s) => ({
            ...s,
            initiatingPayment: false,
            selectedGateway: null,
            error: "No valid transaction to initiate payment for.",
          }));
          return;
        }

        if (!result.success) {
          setState((s) => ({
            ...s,
            initiatingPayment: false,
            selectedGateway: null,
            error: result.message || "Failed to initiate payment.",
          }));
          return;
        }

        setState((s) => ({
          ...s,
          initiatingPayment: false,
          clientSecret: result.data.client_secret || null,
          approvalUrl: result.data.approval_url || null,
        }));
      } catch (err) {
        setState((s) => ({
          ...s,
          initiatingPayment: false,
          selectedGateway: null,
          error: err.message || "Failed to initiate payment.",
        }));
      }
    },
    [state.tx, state.guestEmail],
  );

  const handleRetry = useCallback(() => {
    setState((s) => ({
      ...s,
      selectedGateway: null,
      clientSecret: null,
      approvalUrl: null,
      error: null,
      // If the transaction never loaded, go back into the loading state and
      // genuinely re-fetch — clearing the error alone used to drop the user
      // on the gateway screen with a fabricated £0.00 total.
      loading: s.tx ? s.loading : true,
    }));
    txPromiseRef.current = null;
    setReloadTick((t) => t + 1);
  }, []);

  /**
   * "Back to booking" — navigates the user to the booking form (BookingPage /
   * BookingModal) with their original booking details pre-populated, and
   * links the still-pending transaction/booking so the same one is reused
   * on resubmission instead of creating a duplicate.
   *
   * Only meaningful for single-booking (non-bulk) PENDING transactions —
   * bulk uploads and already-finalised transactions fall back to normal
   * browser history navigation.
   */
  const handleBackToBooking = useCallback(async () => {
    const tx = state.tx;

    // Bulk uploads have their own wizard/back flow — not handled here.
    // A finished (non-pending) transaction has nothing left to edit.
    if (!tx || tx.bulk_upload || !tx.booking || tx.status !== "pending") {
      navigate(-1);
      return;
    }

    setState((s) => ({ ...s, backNavigating: true }));
    try {
      const result = await bookingApi.getBooking(tx.booking, guestEmail);
      if (!result.success || !result.data) {
        // Fall back to plain history navigation — better than a dead end.
        navigate(-1);
        return;
      }

      const booking = result.data;
      const toNumber = (v) => (v === null || v === undefined ? v : Number(v));

      navigate("/booking", {
        state: {
          quote: booking.quote,
          formData: {
            pickupAddress: booking.pickup_address
              ? {
                  ...booking.pickup_address,
                  latitude: toNumber(booking.pickup_address.latitude),
                  longitude: toNumber(booking.pickup_address.longitude),
                }
              : {},
            dropoffAddress: booking.dropoff_address
              ? {
                  ...booking.dropoff_address,
                  latitude: toNumber(booking.dropoff_address.latitude),
                  longitude: toNumber(booking.dropoff_address.longitude),
                }
              : {},
            promoCode: booking.promo_code || "",
            notes: booking.notes || "",
            guestEmail: booking.guest_email || guestEmail || "",
            receiverEmail: booking.receiver_email || "",
            receiverPhone: booking.receiver_phone || "",
            scheduledPickupAt: booking.scheduled_pickup_at || null,
            scheduledDropoffAt: booking.scheduled_dropoff_at || null,
          },
          // Lets BookingModal detect and reuse the still-pending transaction
          // instead of blindly creating a new booking + transaction.
          existingBookingId: booking.id,
          existingTransactionId: tx.id,
          guestEmail: booking.guest_email || guestEmail || null,
        },
      });
    } catch (err) {
      console.warn("[PaymentPage] handleBackToBooking failed:", err);
      navigate(-1);
    } finally {
      setState((s) => ({ ...s, backNavigating: false }));
    }
  }, [state.tx, guestEmail, navigate]);

  // Auto-redirect to PayPal approval URL (300 ms delay gives React time to
  // render the redirect spinner before the browser navigates away).
  //
  // FIX-B2: removed the `state.selectedGateway === "paypal"` guard.
  // That guard prevented redirects for the navState path where approvalUrl
  // arrives from useBulkUpload before handleSelectGateway is called.
  // If approvalUrl is set, we have an approval URL to redirect to — the
  // gateway is already determined by the backend; no additional guard needed.
  useEffect(() => {
    if (state.approvalUrl) {
      const timer = setTimeout(() => {
        window.location.href = state.approvalUrl;
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [state.approvalUrl]);

  // ── PayPal return flow ──────────────────────────────────────────────────────
  if (isPaypalReturn && paypalToken) {
    if (state.succeeded) {
      // FIX-B5: derive isBulk from the loaded tx OR navState.isBulk (which
      // useBulkUpload always passes). The old hardcoded isBulk={false} caused
      // bulk PayPal payments to always show the single-booking success message.
      const isBulkReturn = !!(state.tx?.bulk_upload || location.state?.isBulk);
      return (
        <Layout>
          <SuccessScreen
            isBulk={isBulkReturn}
            guestEmail={guestEmail}
            tx={state.tx}
          />
        </Layout>
      );
    }
    if (state.error) {
      return (
        <Layout>
          <ErrorScreen message={state.error} navigate={navigate} />
        </Layout>
      );
    }
    return (
      <Layout>
        {/* FIX-3: was onSuccess={handleSuccess} (undefined ref) */}
        <PayPalCapturePage
          txId={txId}
          token={paypalToken}
          onSuccess={handlePaymentSucceeded}
          onError={handleError}
        />
      </Layout>
    );
  }

  // ── PayPal cancelled ───────────────────────────────────────────────────────
  if (isPaypalCancelled) {
    return (
      <Layout>
        <div className="text-center py-8">
          <AlertCircle className="w-12 h-12 text-warning mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-foreground mb-2">
            Payment Cancelled
          </h2>
          <p className="text-muted-foreground mb-6">
            You cancelled the PayPal payment. No money has been taken.
          </p>
          <button
            onClick={() => navigate(-1)}
            className="bg-primary hover:bg-primary-hover text-primary-foreground font-semibold
                       rounded-xl px-6 py-3 transition-colors"
          >
            Try Again
          </button>
        </div>
      </Layout>
    );
  }

  // ── Confirming — safety-net POST /confirm-success/ in flight ───────────────
  if (state.confirming) {
    return (
      <Layout>
        <div className="flex flex-col items-center gap-4 py-16">
          <Loader2 className="w-10 h-10 animate-spin text-success" />
          <p className="text-muted-foreground font-medium">Confirming your booking…</p>
          <p className="text-subtle-foreground text-sm">This takes just a moment</p>
        </div>
      </Layout>
    );
  }

  // ── Loading ─────────────────────────────────────────────────────────────────
  if (state.loading) {
    return (
      <Layout>
        <div className="flex flex-col items-center gap-4 py-16">
          <Loader2 className="w-10 h-10 animate-spin text-brand-text" />
          <p className="text-muted-foreground">Loading payment details…</p>
        </div>
      </Layout>
    );
  }

  // ── Success ─────────────────────────────────────────────────────────────────
  if (state.succeeded) {
    const isBulk = !!state.tx?.bulk_upload;
    return (
      <Layout>
        <SuccessScreen
          isBulk={isBulk}
          guestEmail={state.guestEmail}
          tx={state.tx}
        />
      </Layout>
    );
  }

  const { tx, clientSecret, approvalUrl } = state;
  const isBulk = !!tx?.bulk_upload;
  // NEVER default the amount to 0 — a fabricated £0.00 is worse than no
  // amount. When tx hasn't loaded, the guards below render loading/error
  // screens instead of a payment screen.
  const amount = tx?.amount ?? null;
  const currency = tx?.currency || "GBP";
  // Use state.selectedGateway (user-chosen or navState-seeded), NOT tx.gateway
  // (stale placeholder that defaults to "stripe" on the backend).
  const activeGateway = state.selectedGateway;

  // ── FIX-B7: Error check BEFORE gateway guards ───────────────────────────────
  // In the old code, the state.error check appeared below the gateway selection
  // guards. A gateway error with no credentials would silently fall through to
  // the "Unable to determine payment method" fallback instead of showing the
  // actual error. Moved here so every error surface comes through one path.
  if (state.error && !state.initiatingPayment) {
    // If we have credentials too, let the gateway screens render; the inline
    // error display within those flows will handle it. Only short-circuit when
    // there's genuinely nothing to show.
    if (!clientSecret && !approvalUrl) {
      return (
        <Layout onBack={handleBackToBooking} backLoading={state.backNavigating}>
          <div className="space-y-4">
            <div className="text-center">
              <AlertCircle className="w-12 h-12 text-destructive mx-auto mb-4" />
              <h2 className="text-xl font-semibold text-foreground mb-2">
                Payment Setup Failed
              </h2>
              <p className="text-muted-foreground mb-6">{state.error}</p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={handleRetry}
                className="flex-1 bg-primary hover:bg-primary-hover text-primary-foreground font-semibold
                           rounded-xl px-6 py-3 transition-colors"
              >
                Try Again
              </button>
              <button
                onClick={() => navigate(isBulk ? "/bulk-upload" : "/bookings")}
                className="flex-1 bg-surface hover:bg-surface-hover text-foreground font-semibold
                           rounded-xl px-6 py-3 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </Layout>
      );
    }
  }

  // ── No transaction loaded — cannot show a real amount ───────────────────────
  // Reaching here without a tx (fetch failed but error was cleared, or an
  // unexpected state) used to render the gateway screen with £0.00. Force a
  // retry path instead — the retry re-fetches the transaction.
  if (!tx) {
    return (
      <Layout>
        <div className="space-y-4 text-center">
          <AlertCircle className="w-12 h-12 text-destructive mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-foreground mb-2">
            Payment Details Unavailable
          </h2>
          <p className="text-muted-foreground mb-6">
            We couldn't load your payment details. Your booking is saved — no
            payment has been taken.
          </p>
          <button
            onClick={handleRetry}
            className="bg-primary hover:bg-primary-hover text-primary-foreground font-semibold
                       rounded-xl px-6 py-3 transition-colors"
          >
            Try Again
          </button>
        </div>
      </Layout>
    );
  }

  // ── Gateway selection — shown until credentials arrive ──────────────────────
  // Guard: show selection when credentials are absent AND initiation is not in
  // flight. handleSelectGateway resets selectedGateway to null on failure, so
  // the screen reappears correctly after an error.
  if (!clientSecret && !approvalUrl && !state.initiatingPayment) {
    return (
      <Layout
        heading="Secure Payment"
        guestEmail={state.guestEmail}
        isBulk={isBulk}
        onBack={handleBackToBooking}
        backLoading={state.backNavigating}
      >
        <GatewaySelectionScreen
          tx={tx}
          amount={amount}
          currency={currency}
          onSelectGateway={handleSelectGateway}
          loading={state.initiatingPayment}
        />
      </Layout>
    );
  }

  // ── Initiation in progress ──────────────────────────────────────────────────
  if (state.initiatingPayment) {
    return (
      <Layout onBack={handleBackToBooking} backLoading={state.backNavigating}>
        <div className="flex flex-col items-center gap-4 py-16">
          <Loader2 className="w-10 h-10 animate-spin text-brand-text" />
          <p className="text-muted-foreground">
            Setting up{" "}
            {state.selectedGateway === "stripe" ? "Stripe" : "PayPal"} payment…
          </p>
        </div>
      </Layout>
    );
  }

  // ── Stripe ─────────────────────────────────────────────────────────────────
  if (activeGateway === "stripe" && clientSecret) {
    return (
      <Layout
        heading="Complete Payment"
        guestEmail={state.guestEmail}
        onBack={handleBackToBooking}
        backLoading={state.backNavigating}
      >
        <Elements stripe={stripePromise} options={{ clientSecret }}>
          <StripeCheckoutForm
            clientSecret={clientSecret}
            txId={txId}
            amount={amount}
            currency={currency}
            onConfirmSuccess={handleConfirmSuccess}
            onError={handleError}
          />
        </Elements>
      </Layout>
    );
  }

  // ── PayPal — auto-redirect fires in useEffect (FIX-B2); this renders the
  // spinner. Guard: approvalUrl is set (we have somewhere to redirect to).
  if (approvalUrl) {
    return (
      <Layout
        heading="Redirecting to PayPal…"
        guestEmail={state.guestEmail}
        onBack={handleBackToBooking}
        backLoading={state.backNavigating}
      >
        <PayPalRedirectScreen
          approvalUrl={approvalUrl}
          amount={amount}
          currency={currency}
        />
      </Layout>
    );
  }

  // Fallback — should not normally be reached after all fixes above.
  // If we arrive here it means we have credentials but activeGateway is an
  // unrecognised value. Surface it as a retryable error rather than a blank
  // "Unable to determine payment method" that sends the user into a loop.
  return (
    <Layout>
      <div className="space-y-4 text-center">
        <AlertCircle className="w-12 h-12 text-destructive mx-auto mb-4" />
        <h2 className="text-xl font-semibold text-foreground mb-2">
          Payment Setup Error
        </h2>
        <p className="text-muted-foreground mb-6">
          Unable to determine payment method. Please go back and try again.
        </p>
        <button
          onClick={handleRetry}
          className="bg-primary hover:bg-primary-hover text-primary-foreground font-semibold
                     rounded-xl px-6 py-3 transition-colors"
        >
          Try Again
        </button>
      </div>
    </Layout>
  );
}

// ─── Layout wrapper ───────────────────────────────────────────────────────────

function Layout({
  heading = "Complete Your Payment",
  guestEmail,
  isBulk = false,
  onBack,
  backLoading = false,
  children,
}) {
  const navigate = useNavigate();
  const handleBackClick = () => {
    if (backLoading) return;
    if (onBack) {
      onBack();
    } else {
      navigate(-1);
    }
  };
  return (
    <div className="min-h-screen bg-card py-12 px-4">
      <div className="max-w-lg mx-auto">
        {/* Guest context badge */}
        {guestEmail && (
          <div className="mb-6 p-3 bg-surface/50 border border-border rounded-lg text-sm text-muted-foreground">
            Paying as guest:{" "}
            <span className="text-brand-text font-semibold">{guestEmail}</span>
          </div>
        )}

        {/* Header with back button */}
        <div className="flex items-center gap-3 mb-8">
          <button
            type="button"
            onClick={handleBackClick}
            disabled={backLoading}
            aria-label={onBack ? "Back to booking details" : "Go back"}
            title={onBack ? "Back to booking details" : "Go back"}
            className="p-2 rounded-lg bg-surface hover:bg-surface text-muted-foreground
                       transition-colors disabled:opacity-60 disabled:cursor-wait
                       focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {backLoading ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <ArrowLeft className="w-5 h-5" />
            )}
          </button>
          <div className="flex items-center gap-2">
            <Package className="w-6 h-6 text-brand-text" />
            <div>
              <span className="text-lg font-semibold text-foreground block">
                {heading}
              </span>
              <p className="text-xs text-subtle-foreground">
                {isBulk ? "Bulk Upload" : "Booking"} Payment
              </p>
            </div>
          </div>
        </div>

        {/* Main content card */}
        <div className="bg-surface border border-border rounded-2xl p-6 shadow-xl">
          {children}
        </div>

        {/* Help text footer */}
        <div className="mt-6 text-center">
          <p className="text-xs text-subtle-foreground mb-2">Need help?</p>
          <a
            href="mailto:support@dropnroll.com"
            className="text-brand-text hover:text-brand-text text-xs font-medium transition-colors"
          >
            Contact our support team
          </a>
        </div>
      </div>
    </div>
  );
}

function ErrorScreen({ message, navigate }) {
  return (
    <div className="text-center py-8">
      <AlertCircle className="w-12 h-12 text-destructive mx-auto mb-4" />
      <h2 className="text-xl font-semibold text-foreground mb-2">Payment Error</h2>
      <p className="text-muted-foreground mb-6">{message}</p>
      <button
        onClick={() => navigate(-1)}
        className="bg-surface hover:bg-surface-hover text-foreground font-medium
                   rounded-xl px-6 py-3 transition-colors"
      >
        Go Back
      </button>
    </div>
  );
}
