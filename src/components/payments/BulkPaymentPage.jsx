/**
 * BulkPaymentPage
 * ═══════════════════════════════════════════════════════════════
 * Route: /pay/bulk/:uploadId
 *
 * Handles Stripe card payment for a completed PREPAID bulk upload.
 *
 * Flow:
 *   1. Mount → call POST /api/payments/initiate-bulkupload/
 *              { bulk_upload_id, gateway: "stripe" }
 *      → receive { flow:"prepaid", client_secret, transaction_id, amount }
 *   2. Render <Elements> with client_secret
 *   3. User pays → stripe.confirmCardPayment(client_secret, …)
 *   4. Success → show confirmation → navigate to /bulk-upload
 *
 * The Stripe webhook (stripe_webhook_v2) fires on success and calls
 * _schedule_bulk_bookings, transitioning all PENDING bookings → SCHEDULED.
 * We do NOT manually mark the tx here — the webhook is the source of truth.
 */

import { useEffect, useState, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { loadStripe } from "@stripe/stripe-js";
import {
  Elements,
  CardElement,
  useStripe,
  useElements,
} from "@stripe/react-stripe-js";
import paymentApi from "../../api/PaymentApi";
import { useAuth } from "../../contexts/AuthContext";
import {
  Loader2,
  CreditCard,
  CheckCircle,
  AlertCircle,
  ArrowLeft,
  Shield,
  Package,
} from "lucide-react";

const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY);

// ─── Inner Stripe form (must live inside <Elements>) ────────────────────────

function StripeCheckoutForm({
  clientSecret,
  amount,
  currency,
  invoiceRef,
  batchName,
  onSuccess,
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
          payment_method: {
            card: elements.getElement(CardElement),
          },
        }
      );

      if (error) {
        setCardError(error.message);
        onError(error.message);
      } else if (paymentIntent.status === "succeeded") {
        onSuccess();
      } else {
        setCardError("Payment did not succeed. Please try again.");
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
      {/* Order summary */}
      <div className="bg-slate-700/50 border border-slate-600 rounded-xl p-5">
        <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-3">
          Order Summary
        </h3>
        <div className="space-y-2 text-sm">
          {batchName && (
            <div className="flex justify-between">
              <span className="text-slate-400">Batch</span>
              <span className="text-white font-medium">{batchName}</span>
            </div>
          )}
          {invoiceRef && (
            <div className="flex justify-between">
              <span className="text-slate-400">Reference</span>
              <span className="text-white font-mono">{invoiceRef}</span>
            </div>
          )}
          <div className="border-t border-slate-600 pt-2 mt-2 flex justify-between">
            <span className="text-slate-300 font-semibold">Total</span>
            <span className="text-orange-400 font-bold text-lg">
              {currency} {parseFloat(amount).toFixed(2)}
            </span>
          </div>
        </div>
      </div>

      {/* Card input */}
      <div>
        <label className="block text-sm font-medium text-slate-300 mb-2">
          Card Details
        </label>
        <div className="bg-slate-700 border border-slate-600 rounded-xl p-4 focus-within:border-orange-500 transition-colors">
          <CardElement
            options={{
              style: {
                base: {
                  fontSize: "16px",
                  color: "#F8FAFC",
                  fontFamily: '"Inter", sans-serif',
                  "::placeholder": { color: "#64748B" },
                  iconColor: "#F97316",
                },
                invalid: { color: "#F87171" },
              },
            }}
          />
        </div>
        {cardError && (
          <p className="mt-2 text-sm text-red-400 flex items-center gap-1.5">
            <AlertCircle className="w-4 h-4 shrink-0" />
            {cardError}
          </p>
        )}
      </div>

      {/* Security badge */}
      <div className="flex items-center gap-2 text-xs text-slate-500">
        <Shield className="w-3.5 h-3.5" />
        <span>Secured by Stripe — PCI DSS compliant, 256-bit TLS encryption</span>
      </div>

      <button
        type="submit"
        disabled={!stripe || processing}
        className={`w-full py-3.5 rounded-xl font-semibold text-white transition-all duration-200 flex items-center justify-center gap-2 ${
          processing
            ? "bg-orange-600/50 cursor-not-allowed"
            : "bg-orange-500 hover:bg-orange-600 active:scale-[0.98] shadow-lg shadow-orange-500/20"
        }`}
      >
        {processing ? (
          <>
            <Loader2 className="w-5 h-5 animate-spin" />
            Processing payment…
          </>
        ) : (
          <>
            <CreditCard className="w-5 h-5" />
            Pay {currency} {parseFloat(amount).toFixed(2)}
          </>
        )}
      </button>
    </form>
  );
}

// ─── Page shell ──────────────────────────────────────────────────────────────

export default function BulkPaymentPage() {
  const { uploadId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [phase, setPhase] = useState("loading"); // loading | ready | success | error
  const [paymentData, setPaymentData] = useState(null); // { client_secret, amount, currency, transaction_id }
  const [uploadInfo, setUploadInfo] = useState(null);
  const [pageError, setPageError] = useState(null);

  // ── POST /api/payments/initiate-bulk/ on mount ──────────────────────────

  const initiatePayment = useCallback(async () => {
    if (!uploadId) {
      setPageError("No upload ID provided.");
      setPhase("error");
      return;
    }
    setPhase("loading");

    try {
      // FIX-BUG-03: Use PaymentApi.initiateBulkPayment (correct endpoint: /initiate-bulk/)
      const result = await paymentApi.initiateBulkPayment({
        bulkUploadId: uploadId,
        gateway: "stripe",
        idempotencyKey: `bulk-${uploadId}-${Date.now()}`,
      });

      if (!result.success) {
        if (result.code === "ALREADY_PAID") {
          setPageError("This batch has already been paid. Redirecting…");
          setTimeout(() => navigate("/bulk-upload"), 2500);
          setPhase("error");
          return;
        }
        throw new Error(result.message || "Failed to initiate payment.");
      }

      const data = result.data;

      if (data.flow === "net") {
        // Shouldn't land here for NET terms, but handle gracefully
        navigate(`/invoices/${data.invoice_id}`, { replace: true });
        return;
      }

      if (!data.client_secret) {
        throw new Error("No client_secret received from server.");
      }

      setPaymentData(data);
      setPhase("ready");
    } catch (err) {
      const msg = err.message || "Failed to initiate payment.";
      setPageError(msg);
      setPhase("error");
    }
  }, [uploadId, navigate]);

  useEffect(() => {
    initiatePayment();
  }, [initiatePayment]);

  const handleSuccess = () => {
    setPhase("success");
  };

  const handleError = (msg) => {
    // Error is shown inside the form; don't change phase
    console.error("Payment error:", msg);
  };

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-lg">
        {/* Header */}
        <div className="flex items-center gap-3 mb-8">
          <button
            onClick={() => navigate(-1)}
            className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-2">
            <Package className="w-6 h-6 text-orange-500" />
            <h1 className="text-xl font-bold text-white">Batch Payment</h1>
          </div>
        </div>

        <div className="bg-slate-800 border border-slate-700 rounded-2xl p-8 shadow-2xl">
          {/* ── Loading ───────────────────────────────────────────────── */}
          {phase === "loading" && (
            <div className="text-center py-12">
              <Loader2 className="w-10 h-10 text-orange-500 animate-spin mx-auto mb-4" />
              <p className="text-slate-400">Preparing secure payment…</p>
            </div>
          )}

          {/* ── Error ─────────────────────────────────────────────────── */}
          {phase === "error" && (
            <div className="text-center py-8">
              <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-4" />
              <h2 className="text-xl font-bold text-white mb-2">
                Payment Initialisation Failed
              </h2>
              <p className="text-slate-400 mb-6">{pageError}</p>
              <button
                onClick={initiatePayment}
                className="px-6 py-2.5 bg-orange-500 hover:bg-orange-600 text-white rounded-lg font-semibold transition"
              >
                Try Again
              </button>
            </div>
          )}

          {/* ── Payment form ───────────────────────────────────────────── */}
          {phase === "ready" && paymentData && (
            <>
              <h2 className="text-2xl font-bold text-white mb-1">
                Complete Payment
              </h2>
              <p className="text-slate-400 text-sm mb-6">
                Your bookings will be scheduled immediately after payment.
              </p>

              <Elements
                stripe={stripePromise}
                options={{
                  clientSecret: paymentData.client_secret,
                  appearance: {
                    theme: "night",
                    variables: {
                      colorPrimary: "#F97316",
                      colorBackground: "#1E293B",
                      colorText: "#F8FAFC",
                      fontFamily: '"Inter", sans-serif',
                    },
                  },
                }}
              >
                <StripeCheckoutForm
                  clientSecret={paymentData.client_secret}
                  amount={paymentData.amount}
                  currency={paymentData.currency || "GBP"}
                  invoiceRef={paymentData.transaction_id?.slice(0, 8)}
                  batchName={uploadInfo?.batch_name}
                  onSuccess={handleSuccess}
                  onError={handleError}
                />
              </Elements>
            </>
          )}

          {/* ── Success ───────────────────────────────────────────────── */}
          {phase === "success" && (
            <div className="text-center py-8">
              <div className="w-16 h-16 bg-green-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
                <CheckCircle className="w-10 h-10 text-green-400" />
              </div>
              <h2 className="text-2xl font-bold text-white mb-2">
                Payment Successful! 🎉
              </h2>
              <p className="text-slate-400 mb-2">
                Your payment has been processed.
              </p>
              <p className="text-sm text-slate-500 mb-8">
                Your bookings are being scheduled — you'll receive a confirmation
                email shortly.
              </p>
              <div className="space-y-3">
                <button
                  onClick={() => navigate("/bulk-upload")}
                  className="w-full py-3 bg-orange-500 hover:bg-orange-600 text-white rounded-xl font-semibold transition"
                >
                  Back to Bulk Upload Dashboard
                </button>
                <button
                  onClick={() => navigate("/bookings")}
                  className="w-full py-3 bg-slate-700 hover:bg-slate-600 text-white rounded-xl font-medium transition"
                >
                  View My Bookings
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
