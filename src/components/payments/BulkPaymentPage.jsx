/**
 * BulkPaymentPage.jsx
 *
 * Route: /pay/bulk/:uploadId
 *
 * Reached via:
 *   A) Auto-navigation from useBulkUpload hook after upload processing
 *   B) Email payment link: http://app.dropnroll.co.uk/pay/bulk/:uploadId
 *   C) Stripe success_url redirect: /pay/bulk/:uploadId?session_id=cs_xxx
 *      (Stripe appends session_id when redirecting back after payment)
 *
 * ── Payment Flow ─────────────────────────────────────────────────────────────
 * PREPAID (Stripe Checkout Session):
 *   1. Mount → fetch upload detail → call initiate-bulk → get checkout_url
 *   2. Redirect user to Stripe: window.location.href = checkout_url
 *   3. After payment Stripe redirects back here with ?session_id=cs_xxx
 *   4. We POST /api/payments/confirm-success/ {transaction_id, session_id}
 *   5. Navigate to /bulk-uploads/:id/success
 *
 * NET Terms:
 *   After upload processing, bookings are already scheduled. This page
 *   shows a summary and links to the invoice.
 *
 * ── Bug Fixes vs Previous Version ────────────────────────────────────────────
 * FIX-1  400 on /confirm-success/: old code passed paymentIntent.id which was
 *        `undefined` (initiate-bulk returns transaction_id + checkout_url, not
 *        a PaymentIntent ID). Now we send {transaction_id, session_id} instead.
 *
 * FIX-2  "Pay £undefined": old code read upload.total_amount — field doesn't
 *        exist in the raw API response until the serializer is fixed. We also
 *        guard with formatAmount() so the UI never shows undefined.
 *
 * FIX-3  Wrong UX model: previous version rendered a local payment form for a
 *        Checkout Session flow. Checkout Sessions are handled entirely by
 *        Stripe's hosted page — the frontend's job is redirect + return.
 */

import React, { useState, useEffect, useCallback, useRef } from "react";
import { useParams, useLocation, useNavigate } from "react-router-dom";
import BulkUploadApi from "../../api/BulkUploadApi";
import PaymentApi from "../../api/PaymentApi";
import { loadStripe } from "@stripe/stripe-js";
import {
  EmbeddedCheckout,
  EmbeddedCheckoutProvider,
} from "@stripe/react-stripe-js";

// Module scope, deliberately. loadStripe() inside the component would fire a
// fresh network load on every render and hand the provider a new promise each
// time, which remounts the iframe underneath a customer mid-payment.
const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY);

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Safely format a monetary amount, returning "0.00" if falsy. */
function formatAmount(value) {
  const n = parseFloat(value);
  return isNaN(n) ? "0.00" : n.toFixed(2);
}

/** Extract ?session_id from the current URL (set by Stripe on redirect-back). */
function getSessionIdFromUrl() {
  const params = new URLSearchParams(window.location.search);
  return params.get("session_id") || null;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function LoadingSkeleton({ message = "Loading payment details…" }) {
  return (
    <div style={styles.page}>
      <div style={styles.card}>
        <div style={styles.skeletonHeader} />
        <div style={{ padding: "32px" }}>
          <div style={styles.skeletonLine} />
          <div style={{ ...styles.skeletonLine, width: "60%" }} />
          <div style={{ ...styles.skeletonLine, width: "80%", marginTop: "24px" }} />
          <div style={{ ...styles.skeletonBlock }} />
        </div>
        <p style={styles.loadingHint}>{message}</p>
      </div>
    </div>
  );
}

function ErrorCard({ title = "Payment Unavailable", message, onRetry }) {
  return (
    <div style={styles.page}>
      <div style={{ ...styles.card, maxWidth: 480 }}>
        <div style={styles.errorHeader}>
          <div style={styles.errorIcon}>✕</div>
          <h2 style={styles.errorTitle}>{title}</h2>
        </div>
        <div style={{ padding: "24px 32px 32px" }}>
          <p style={styles.bodyText}>{message}</p>
          {onRetry && (
            <button style={styles.btnSecondary} onClick={onRetry}>
              Try again
            </button>
          )}
          <p style={{ ...styles.hint, marginTop: "16px" }}>
            Need help?{" "}
            <a href="mailto:support@dropnroll.co.uk" style={styles.link}>
              support@dropnroll.co.uk
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}

function AlreadyPaidCard({ uploadId, onNavigate }) {
  return (
    <div style={styles.page}>
      <div style={{ ...styles.card, maxWidth: 480 }}>
        <div style={styles.successHeader}>
          <div style={styles.successIcon}>✓</div>
          <h2 style={styles.successTitle}>Already Paid</h2>
        </div>
        <div style={{ padding: "24px 32px 32px", textAlign: "center" }}>
          <p style={styles.bodyText}>
            This batch has already been paid and your bookings are confirmed.
          </p>
          <button style={styles.btnPrimary} onClick={onNavigate}>
            Go to Dashboard
          </button>
        </div>
      </div>
    </div>
  );
}

function OrderSummary({ upload, amount }) {
  return (
    <div style={styles.summaryBox}>
      <h3 style={styles.summaryTitle}>Order Summary</h3>
      <div style={styles.summaryRow}>
        <span style={styles.summaryLabel}>Batch file</span>
        <span style={styles.summaryValue}>{upload.original_filename || "—"}</span>
      </div>
      <div style={styles.summaryRow}>
        <span style={styles.summaryLabel}>Bookings created</span>
        <span style={styles.summaryValue}>{upload.success_count ?? upload.successful ?? "—"}</span>
      </div>
      {(upload.failed_count ?? upload.failed) > 0 && (
        <div style={styles.summaryRow}>
          <span style={styles.summaryLabel}>Failed rows</span>
          <span style={{ ...styles.summaryValue, color: "#dc2626" }}>
            {upload.failed_count ?? upload.failed}
          </span>
        </div>
      )}
      <div style={{ ...styles.summaryRow, ...styles.summaryTotal }}>
        <span style={styles.totalLabel}>Amount due</span>
        <span style={styles.totalAmount}>£{amount}</span>
      </div>
    </div>
  );
}

function SecurityBadge() {
  return (
    <div style={styles.securityBadge}>
      <span style={{ marginRight: "8px" }}>🔒</span>
      <span>
        <strong>Secure Stripe checkout.</strong> Your bookings are reserved — confirmed
        instantly after payment. Drop 'n Roll never stores card details.
      </span>
    </div>
  );
}

// ─── Main component ────────────────────────────────────────────────────────────

export default function BulkPaymentPage() {
  const { uploadId } = useParams();
  const { state: routerState } = useLocation();
  const navigate = useNavigate();

  // Detect Stripe redirect-back (path C)
  const returnSessionId = getSessionIdFromUrl();
  const isStripeReturn = Boolean(returnSessionId);

  // ── State ──────────────────────────────────────────────────────────────────
  const [upload, setUpload] = useState(routerState?.uploadSnapshot ?? null);
  const [loadError, setLoadError] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isPaid, setIsPaid] = useState(false);
  const [clientSecret, setClientSecret] = useState(null);
  const [confirmError, setConfirmError] = useState(null);

  // Store transaction_id from initiate-bulk so we can pass it to confirm-success
  const transactionIdRef = useRef(routerState?.transactionId ?? null);

  // ── On mount: either confirm a Stripe return, or load + redirect ──────────
  const loadAndPay = useCallback(async () => {
    if (!uploadId) {
      setLoadError("Invalid payment link — no upload ID found.");
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setLoadError(null);
    setConfirmError(null);

    try {
      // 1. Always fetch latest upload detail
      const uploadData = await BulkUploadApi.getDetail(uploadId);
      setUpload(uploadData);

      const statusLower = (uploadData.status || "").toLowerCase();

      // ── Path C: Stripe redirect-back ──────────────────────────────────────
      if (isStripeReturn && returnSessionId) {
        // Confirm server-side (closes race window with webhook)
        try {
          await PaymentApi.confirmBulkPayment({
            uploadId,
            paymentIntentId: returnSessionId,        // backend now accepts cs_xxx
            transactionId: transactionIdRef.current, // best-effort
          });
        } catch (confirmErr) {
          // Non-fatal: webhook may have already processed this
          console.warn("[BulkPaymentPage] confirm-success call failed (webhook may have handled):", confirmErr);
        }
        setIsLoading(false);
        navigate(`/bulk-uploads/${uploadId}/success`, { replace: true });
        return;
      }

      // ── Already paid ──────────────────────────────────────────────────────
      if (statusLower === "paid" || statusLower === "payment_confirmed" || statusLower === "completed") {
        // Completed = NET Terms path where bookings are already scheduled
        if (uploadData.payment_path === "net" || uploadData.customer_type === "NET") {
          setIsLoading(false);
          navigate(`/bulk-uploads/${uploadId}/success`, { replace: true });
          return;
        }
        setIsPaid(true);
        setIsLoading(false);
        return;
      }

      if (statusLower === "failed") {
        setLoadError("This upload failed processing and cannot be paid.");
        setIsLoading(false);
        return;
      }

      if (statusLower !== "payment_pending") {
        setLoadError(
          `This upload is in status "${uploadData.status}" and is not ready for payment.`
        );
        setIsLoading(false);
        return;
      }

      // ── Initiate / retrieve Stripe Checkout Session ───────────────────────
      const intent = await PaymentApi.getOrCreateBulkIntent(uploadId, "stripe");

      // Store transaction_id for the return leg
      if (intent?.transaction_id) {
        transactionIdRef.current = intent.transaction_id;
      }

      if (intent?.already_paid) {
        setIsPaid(true);
        setIsLoading(false);
        return;
      }

      // ── Mount Stripe Embedded Checkout ────────────────────────────────────
      // The customer stays here. Previously this redirected to
      // checkout.stripe.com, which is where "do not close this tab" came from.
      const secret = intent?.client_secret;
      if (!secret) {
        setLoadError(
          "Could not start the secure checkout. Please refresh, or contact support if it keeps happening.",
        );
        setIsLoading(false);
        return;
      }
      setClientSecret(secret);
      setIsLoading(false);

    } catch (err) {
      const detail =
        err?.response?.data?.detail ||
        err?.response?.data?.error ||
        err?.message ||
        "Could not load payment data. Please try refreshing or contact support.";
      setLoadError(detail);
      setIsLoading(false);
    }
  }, [uploadId, isStripeReturn, returnSessionId, navigate]);

  useEffect(() => {
    loadAndPay();
  }, [loadAndPay]);

  // ── Derived display values ─────────────────────────────────────────────────
  const amount = formatAmount(upload?.total_amount);

  // ── Render ─────────────────────────────────────────────────────────────────

  if (isLoading) {
    return <LoadingSkeleton message={isStripeReturn ? "Confirming your payment…" : "Loading payment details…"} />;
  }

  if (loadError) {
    return <ErrorCard message={loadError} onRetry={loadAndPay} />;
  }

  if (confirmError) {
    return (
      <ErrorCard
        title="Confirmation Failed"
        message={confirmError}
        onRetry={loadAndPay}
      />
    );
  }

  if (isPaid) {
    return (
      <AlreadyPaidCard
        uploadId={uploadId}
        onNavigate={() => navigate("/dashboard")}
      />
    );
  }

  // ── Redirecting to Stripe ──────────────────────────────────────────────────
  return (
    <div style={styles.page}>
      <div style={styles.card}>

        {/* Header */}
        <div style={styles.pageHeader}>
          <div style={styles.logoMark}>Drop 'n Roll</div>
          <h1 style={styles.pageTitle}>Complete Payment</h1>
          <p style={styles.pageSubtitle}>
            Batch upload · {upload?.original_filename || uploadId}
          </p>
        </div>

        <div style={styles.cardBody}>

          {/* Order summary */}
          {upload && <OrderSummary upload={upload} amount={amount} />}

          {/* Payment. Rendered in place -- the customer never leaves. */}
          <div style={styles.redirectBox} data-testid="checkout-area">
            {clientSecret ? (
              <EmbeddedCheckoutProvider
                stripe={stripePromise}
                options={{ clientSecret }}
              >
                <div data-testid="embedded-checkout">
                  <EmbeddedCheckout />
                </div>
              </EmbeddedCheckoutProvider>
            ) : (
              <>
                <p style={styles.bodyText}>
                  Preparing your secure checkout…
                </p>
                <button style={styles.btnPrimary} onClick={loadAndPay}>
                  Pay £{amount} securely
                </button>
              </>
            )}
          </div>

          <SecurityBadge />

          <p style={styles.hint}>
            Already paid? Your bookings will be confirmed automatically — you may
            safely close this page. Ref: {uploadId?.slice(0, 8)}
          </p>
        </div>

        <div style={styles.cardFooter}>
          <p>
            Questions?{" "}
            <a href="mailto:support@dropnroll.co.uk" style={styles.link}>
              support@dropnroll.co.uk
            </a>{" "}
            · Drop 'n Roll Logistics Ltd
          </p>
        </div>
      </div>
    </div>
  );
}

// ─── Inline styles ─────────────────────────────────────────────────────────────
// Using plain objects so the component is self-contained (no CSS file dependency).
// Replace with your Tailwind classes or CSS modules as preferred.

const styles = {
  page: {
    minHeight: "100vh",
    background: "#f1f5f9",
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "center",
    padding: "48px 16px",
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
  },
  card: {
    background: "#ffffff",
    borderRadius: "16px",
    boxShadow: "0 4px 32px rgba(0,0,0,0.10)",
    width: "100%",
    maxWidth: "560px",
    overflow: "hidden",
  },
  pageHeader: {
    background: "#0f172a",
    padding: "28px 32px 24px",
    borderBottom: "3px solid #f97316",
  },
  logoMark: {
    fontSize: "12px",
    fontWeight: "700",
    color: "#f97316",
    letterSpacing: "1px",
    textTransform: "uppercase",
    marginBottom: "8px",
  },
  pageTitle: {
    fontSize: "24px",
    fontWeight: "800",
    color: "#ffffff",
    margin: "0 0 4px",
    letterSpacing: "-0.5px",
  },
  pageSubtitle: {
    fontSize: "13px",
    color: "#94a3b8",
    margin: 0,
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
  },
  cardBody: {
    padding: "28px 32px",
  },
  cardFooter: {
    background: "#f8fafc",
    borderTop: "1px solid #e2e8f0",
    padding: "16px 32px",
    textAlign: "center",
    fontSize: "12px",
    color: "#94a3b8",
  },
  // Summary box
  summaryBox: {
    background: "#f8fafc",
    border: "1px solid #e2e8f0",
    borderRadius: "12px",
    padding: "20px 24px",
    marginBottom: "24px",
  },
  summaryTitle: {
    fontSize: "14px",
    fontWeight: "700",
    color: "#0f172a",
    margin: "0 0 14px",
    textTransform: "uppercase",
    letterSpacing: "0.5px",
  },
  summaryRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "5px 0",
    fontSize: "14px",
  },
  summaryLabel: { color: "#64748b" },
  summaryValue: { color: "#1e293b", fontWeight: "500" },
  summaryTotal: {
    borderTop: "2px solid #e2e8f0",
    marginTop: "10px",
    paddingTop: "14px",
  },
  totalLabel: {
    fontSize: "16px",
    fontWeight: "700",
    color: "#0f172a",
  },
  totalAmount: {
    fontSize: "22px",
    fontWeight: "800",
    color: "#f97316",
    letterSpacing: "-0.5px",
  },
  // Redirect box
  redirectBox: {
    textAlign: "center",
    padding: "20px 0 8px",
    marginBottom: "20px",
  },
  redirectTitle: {
    fontSize: "16px",
    fontWeight: "700",
    color: "#0f172a",
    margin: "12px 0 6px",
  },
  redirectHint: {
    fontSize: "13px",
    color: "#64748b",
    margin: 0,
  },
  // Security badge
  securityBadge: {
    display: "flex",
    alignItems: "flex-start",
    background: "#f0fdf4",
    border: "1px solid #bbf7d0",
    borderRadius: "10px",
    padding: "12px 16px",
    marginBottom: "20px",
    fontSize: "13px",
    color: "#166534",
    lineHeight: 1.5,
  },
  // Buttons
  btnPrimary: {
    display: "inline-block",
    background: "#f97316",
    color: "#ffffff",
    border: "none",
    borderRadius: "10px",
    padding: "14px 36px",
    fontSize: "15px",
    fontWeight: "700",
    cursor: "pointer",
    boxShadow: "0 4px 16px rgba(249,115,22,0.35)",
    marginTop: "8px",
    transition: "opacity 0.15s",
  },
  btnSecondary: {
    display: "inline-block",
    background: "#f1f5f9",
    color: "#0f172a",
    border: "1px solid #e2e8f0",
    borderRadius: "10px",
    padding: "12px 28px",
    fontSize: "14px",
    fontWeight: "600",
    cursor: "pointer",
    marginTop: "12px",
  },
  // Typography
  bodyText: {
    fontSize: "15px",
    color: "#475569",
    lineHeight: 1.6,
    margin: "0 0 12px",
  },
  hint: {
    fontSize: "12px",
    color: "#94a3b8",
    lineHeight: 1.5,
    margin: 0,
    textAlign: "center",
  },
  link: { color: "#f97316", textDecoration: "none" },
  // Error/success headers
  errorHeader: {
    background: "#fef2f2",
    borderBottom: "1px solid #fecaca",
    padding: "28px 32px 20px",
    textAlign: "center",
  },
  errorIcon: {
    width: "48px",
    height: "48px",
    borderRadius: "50%",
    background: "#fee2e2",
    color: "#dc2626",
    fontSize: "20px",
    fontWeight: "700",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    margin: "0 auto 12px",
  },
  errorTitle: { fontSize: "20px", fontWeight: "700", color: "#991b1b", margin: 0 },
  successHeader: {
    background: "#f0fdf4",
    borderBottom: "1px solid #bbf7d0",
    padding: "28px 32px 20px",
    textAlign: "center",
  },
  successIcon: {
    width: "48px",
    height: "48px",
    borderRadius: "50%",
    background: "#dcfce7",
    color: "#16a34a",
    fontSize: "24px",
    fontWeight: "700",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    margin: "0 auto 12px",
  },
  successTitle: { fontSize: "20px", fontWeight: "700", color: "#166534", margin: 0 },
  // Loading skeleton
  skeletonHeader: {
    height: "100px",
    background: "linear-gradient(90deg, #e2e8f0 25%, #f1f5f9 50%, #e2e8f0 75%)",
    backgroundSize: "200% 100%",
    animation: "shimmer 1.4s infinite",
  },
  skeletonLine: {
    height: "16px",
    borderRadius: "8px",
    background: "#e2e8f0",
    marginBottom: "12px",
  },
  skeletonBlock: {
    height: "80px",
    borderRadius: "8px",
    background: "#e2e8f0",
    marginTop: "20px",
  },
  loadingHint: {
    textAlign: "center",
    fontSize: "13px",
    color: "#94a3b8",
    padding: "0 0 24px",
  },
  // Spinner
  spinner: {
    width: "36px",
    height: "36px",
    border: "3px solid #e2e8f0",
    borderTop: "3px solid #f97316",
    borderRadius: "50%",
    animation: "spin 0.8s linear infinite",
    margin: "0 auto 8px",
  },
};
