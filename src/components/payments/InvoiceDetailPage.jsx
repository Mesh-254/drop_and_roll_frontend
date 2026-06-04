/**
 * InvoiceDetailPage
 * ═══════════════════════════════════════════════════════════════
 * Route: /invoices/:id
 *
 * Shows a single NET-terms invoice (Receivable) in full detail.
 * Business owners see their own; admins see all.
 *
 * Features:
 *   - Full invoice metadata (number, dates, payment terms, amounts)
 *   - Booking list (how many, total value)
 *   - Download PDF button
 *   - Pay via Stripe card (for ISSUED / PARTIAL / OVERDUE)
 *   - Status history / notes
 *
 * ?action=pay — auto-opens the payment panel (navigated from BillingPage "Pay Now")
 */

import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { loadStripe } from "@stripe/stripe-js";
import {
  Elements,
  CardElement,
  useStripe,
  useElements,
} from "@stripe/react-stripe-js";
import paymentApi from "../../api/PaymentApi";
import receivableApi from "../../api/ReceivableApi";
import {
  ArrowLeft,
  FileText,
  Download,
  CreditCard,
  CheckCircle,
  AlertTriangle,
  Loader2,
  Shield,
  Calendar,
  Package,
  DollarSign,
  Clock,
  Info,
} from "lucide-react";

const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY);

// ─── Status helpers ──────────────────────────────────────────────────────────

const STATUS_STYLES = {
  draft:     "bg-slate-700 text-slate-300 border-slate-600",
  issued:    "bg-blue-900/50 text-blue-300 border-blue-700",
  partial:   "bg-yellow-900/50 text-yellow-300 border-yellow-700",
  paid:      "bg-green-900/50 text-green-300 border-green-700",
  overdue:   "bg-red-900/50 text-red-300 border-red-700",
  cancelled: "bg-slate-800 text-slate-500 border-slate-700",
};

// ─── Stripe inner form ───────────────────────────────────────────────────────

function StripePayForm({ clientSecret, amount, currency, onSuccess, onError }) {
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
        { payment_method: { card: elements.getElement(CardElement) } }
      );
      if (error) {
        setCardError(error.message);
        onError?.(error.message);
      } else if (paymentIntent.status === "succeeded") {
        onSuccess?.();
      } else {
        setCardError("Payment did not complete. Please try again.");
      }
    } catch (err) {
      const msg = err.message || "Unexpected error.";
      setCardError(msg);
      onError?.(msg);
    } finally {
      setProcessing(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 mt-4">
      <div className="bg-slate-700/50 border border-slate-600 rounded-xl p-4 focus-within:border-orange-500 transition-colors">
        <CardElement
          options={{
            style: {
              base: {
                fontSize: "15px",
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
        <p className="text-sm text-red-400 flex items-center gap-1.5">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          {cardError}
        </p>
      )}
      <div className="flex items-center gap-1.5 text-xs text-slate-500">
        <Shield className="w-3.5 h-3.5" />
        Secured by Stripe — PCI DSS compliant
      </div>
      <button
        type="submit"
        disabled={!stripe || processing}
        className={`w-full py-3 rounded-xl font-semibold text-white transition flex items-center justify-center gap-2 ${
          processing
            ? "bg-orange-600/50 cursor-not-allowed"
            : "bg-orange-500 hover:bg-orange-600 shadow-lg shadow-orange-500/20"
        }`}
      >
        {processing ? (
          <><Loader2 className="w-5 h-5 animate-spin" /> Processing…</>
        ) : (
          <><CreditCard className="w-5 h-5" /> Pay {currency} {parseFloat(amount).toFixed(2)}</>
        )}
      </button>
    </form>
  );
}

// ─── Payment panel ───────────────────────────────────────────────────────────

function PaymentPanel({ invoice, onPaid }) {
  const [phase, setPhase] = useState("idle"); // idle | loading | ready | success | error
  const [payData, setPayData] = useState(null);
  const [err, setErr] = useState(null);

  const initiateStripe = async () => {
    setPhase("loading");
    setErr(null);
    try {
      // FIX-BUG-04: Use PaymentApi.initiateInvoicePayment instead of raw axios
      const result = await paymentApi.initiateInvoicePayment(
        invoice.id,
        "stripe",
        `inv-${invoice.id}-${Date.now()}`,
      );

      if (!result.success) {
        if (result.code === "ALREADY_PAID") {
          onPaid?.();
          return;
        }
        throw new Error(result.message || "Could not initiate payment.");
      }

      setPayData(result.data);
      setPhase("ready");
    } catch (e) {
      const msg = e.message || "Could not initiate payment.";
      setErr(msg);
      setPhase("error");
    }
  };

  if (phase === "idle") {
    return (
      <button
        onClick={initiateStripe}
        className="w-full py-3 bg-orange-500 hover:bg-orange-600 text-white rounded-xl font-semibold transition flex items-center justify-center gap-2 shadow-lg shadow-orange-500/20"
      >
        <CreditCard className="w-5 h-5" />
        Pay Outstanding: {invoice.currency} {parseFloat(invoice.outstanding).toFixed(2)}
      </button>
    );
  }

  if (phase === "loading") {
    return (
      <div className="flex items-center gap-2 text-slate-400 py-3">
        <Loader2 className="w-5 h-5 animate-spin text-orange-500" />
        Preparing payment…
      </div>
    );
  }

  if (phase === "error") {
    return (
      <div className="space-y-3">
        <p className="text-sm text-red-400 flex items-center gap-1.5">
          <AlertTriangle className="w-4 h-4" />{err}
        </p>
        <button
          onClick={initiateStripe}
          className="w-full py-2.5 bg-slate-700 hover:bg-slate-600 text-white rounded-xl font-medium text-sm transition"
        >
          Try Again
        </button>
      </div>
    );
  }

  if (phase === "success") {
    return (
      <div className="flex items-center gap-2 text-green-400 py-3">
        <CheckCircle className="w-5 h-5" />
        Payment successful! Invoice has been updated.
      </div>
    );
  }

  // phase === "ready"
  return (
    <Elements
      stripe={stripePromise}
      options={{
        clientSecret: payData.client_secret,
        appearance: {
          theme: "night",
          variables: { colorPrimary: "#F97316", colorBackground: "#1E293B", colorText: "#F8FAFC" },
        },
      }}
    >
      <StripePayForm
        clientSecret={payData.client_secret}
        amount={payData.amount}
        currency={payData.currency || "GBP"}
        onSuccess={() => { setPhase("success"); onPaid?.(); }}
        onError={(msg) => { setErr(msg); }}
      />
    </Elements>
  );
}

// ─── Detail section ──────────────────────────────────────────────────────────

function DetailRow({ label, value, className = "" }) {
  return (
    <div className="flex justify-between items-start py-2.5 border-b border-slate-700/50 last:border-0">
      <span className="text-slate-400 text-sm">{label}</span>
      <span className={`text-sm font-medium text-right ${className || "text-white"}`}>
        {value}
      </span>
    </div>
  );
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function InvoiceDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const autoOpenPay = new URLSearchParams(location.search).get("action") === "pay";

  const [invoice, setInvoice] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showPayPanel, setShowPayPanel] = useState(autoOpenPay);

  const fetchInvoice = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await receivableApi.get(id);
      setInvoice(data);
    } catch (err) {
      console.error("InvoiceDetailPage fetch error:", err);
      setError(err?.response?.status === 404 ? "Invoice not found." : "Failed to load invoice.");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { fetchInvoice(); }, [fetchInvoice]);

  const handleDownload = async () => {
    if (!invoice) return;
    try {
      await receivableApi.downloadPdf(invoice.id, invoice.invoice_number);
    } catch (err) {
      console.error("Download failed:", err);
    }
  };

  // FIX-BUG-04: After payment succeeds, poll for status change to confirm webhook fired
  const handlePaid = useCallback(async () => {
    setShowPayPanel(false);
    
    // Poll for up to 10 attempts (20 seconds)
    const pollStatus = async (maxAttempts = 10) => {
      for (let i = 0; i < maxAttempts; i++) {
        await new Promise(r => setTimeout(r, 2000));
        const res = await receivableApi.getReceivable(id);
        if (res.success && ["paid", "partial"].includes(res.data.status)) {
          setInvoice(res.data);
          return; // status updated successfully
        }
      }
      // Webhook may still be in flight — refresh anyway
      fetchInvoice();
    };

    await pollStatus();
  }, [id, fetchInvoice]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-orange-500 animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center px-4">
        <div className="text-center">
          <AlertTriangle className="w-12 h-12 text-red-400 mx-auto mb-3" />
          <p className="text-red-400 mb-4">{error}</p>
          <button onClick={() => navigate("/billing")} className="px-5 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg">
            Back to Billing
          </button>
        </div>
      </div>
    );
  }

  if (!invoice) return null;

  const isPayable = ["issued", "partial", "overdue"].includes(invoice.status);
  const statusStyle = STATUS_STYLES[invoice.status] || STATUS_STYLES.draft;
  const dueDate = invoice.due_date ? new Date(invoice.due_date) : null;
  const issueDate = invoice.issue_date ? new Date(invoice.issue_date) : null;

  return (
    <div className="min-h-screen bg-slate-900 px-4 py-8 sm:px-6">
      <div className="max-w-3xl mx-auto">
        {/* Back + title */}
        <div className="flex items-center gap-3 mb-8">
          <button
            onClick={() => navigate("/billing")}
            className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-white flex items-center gap-2">
              <FileText className="w-6 h-6 text-orange-500" />
              Invoice {invoice.invoice_number}
            </h1>
            <p className="text-sm text-slate-400 mt-0.5">{invoice.business_name}</p>
          </div>
        </div>

        <div className="grid gap-6">
          {/* Status card */}
          <div className="bg-slate-800 border border-slate-700 rounded-2xl p-6">
            <div className="flex items-start justify-between mb-5">
              <div>
                <span
                  className={`inline-block px-3 py-1 rounded-full text-sm font-semibold border ${statusStyle}`}
                >
                  {invoice.status_display || invoice.status}
                </span>
                {invoice.is_overdue && (
                  <span className="ml-2 text-sm text-red-400">
                    ({invoice.days_overdue} days overdue)
                  </span>
                )}
              </div>
              {invoice.pdf_url && (
                <button
                  onClick={handleDownload}
                  className="flex items-center gap-1.5 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white text-sm rounded-lg transition"
                >
                  <Download className="w-4 h-4" />
                  Download PDF
                </button>
              )}
            </div>

            {/* Amounts */}
            <div className="grid grid-cols-3 gap-4 mb-5">
              <div className="bg-slate-700/50 rounded-xl p-4">
                <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">Invoice Total</p>
                <p className="text-xl font-bold text-white">
                  {invoice.currency} {parseFloat(invoice.amount).toFixed(2)}
                </p>
              </div>
              <div className="bg-slate-700/50 rounded-xl p-4">
                <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">Paid</p>
                <p className="text-xl font-bold text-green-400">
                  {invoice.currency} {parseFloat(invoice.paid_amount || 0).toFixed(2)}
                </p>
              </div>
              <div className={`rounded-xl p-4 ${
                parseFloat(invoice.outstanding) > 0 ? "bg-red-900/20" : "bg-slate-700/50"
              }`}>
                <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">Outstanding</p>
                <p className={`text-xl font-bold ${
                  parseFloat(invoice.outstanding) > 0 ? "text-red-400" : "text-slate-400"
                }`}>
                  {invoice.currency} {parseFloat(invoice.outstanding).toFixed(2)}
                </p>
              </div>
            </div>

            {/* Details */}
            <div className="divide-y divide-slate-700/50">
              <DetailRow label="Invoice Number" value={invoice.invoice_number} />
              <DetailRow
                label="Issue Date"
                value={issueDate?.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}
              />
              <DetailRow
                label="Due Date"
                value={dueDate?.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}
                className={invoice.is_overdue ? "text-red-400 font-semibold" : "text-white"}
              />
              <DetailRow
                label="Payment Terms"
                value={invoice.payment_terms_display || invoice.payment_terms}
              />
              {invoice.bulk_discount_pct > 0 && (
                <DetailRow
                  label="Bulk Discount"
                  value={`${invoice.bulk_discount_pct}%`}
                  className="text-green-400"
                />
              )}
              {invoice.booking_count > 0 && (
                <DetailRow
                  label="Bookings Covered"
                  value={`${invoice.booking_count} booking${invoice.booking_count !== 1 ? "s" : ""}`}
                />
              )}
              {invoice.reminder_count > 0 && (
                <DetailRow
                  label="Reminders Sent"
                  value={invoice.reminder_count.toString()}
                />
              )}
            </div>
          </div>

          {/* Payment panel */}
          {isPayable && (
            <div className="bg-slate-800 border border-orange-500/30 rounded-2xl p-6">
              <h2 className="text-lg font-bold text-white mb-1 flex items-center gap-2">
                <CreditCard className="w-5 h-5 text-orange-500" />
                Pay This Invoice
              </h2>
              <p className="text-sm text-slate-400 mb-4">
                Pay the outstanding balance securely via card.
              </p>
              {showPayPanel ? (
                <PaymentPanel invoice={invoice} onPaid={handlePaid} />
              ) : (
                <button
                  onClick={() => setShowPayPanel(true)}
                  className="w-full py-3 bg-orange-500 hover:bg-orange-600 text-white rounded-xl font-semibold transition flex items-center justify-center gap-2 shadow-lg shadow-orange-500/20"
                >
                  <CreditCard className="w-5 h-5" />
                  Pay Outstanding: {invoice.currency} {parseFloat(invoice.outstanding).toFixed(2)}
                </button>
              )}
            </div>
          )}

          {invoice.status === "paid" && (
            <div className="bg-green-900/20 border border-green-700 rounded-2xl p-5 flex items-center gap-3">
              <CheckCircle className="w-6 h-6 text-green-400 shrink-0" />
              <div>
                <p className="text-green-300 font-semibold">Invoice Paid in Full</p>
                <p className="text-sm text-green-400/70">
                  Thank you. All bookings associated with this invoice are scheduled.
                </p>
              </div>
            </div>
          )}

          {/* Notes */}
          {invoice.notes && (
            <div className="bg-slate-800 border border-slate-700 rounded-2xl p-6">
              <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wide mb-3 flex items-center gap-1.5">
                <Info className="w-4 h-4" /> Notes
              </h3>
              <pre className="text-sm text-slate-300 whitespace-pre-wrap font-sans">
                {invoice.notes}
              </pre>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
