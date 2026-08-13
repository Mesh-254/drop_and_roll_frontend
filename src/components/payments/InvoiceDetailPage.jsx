/**
 * components/payments/InvoiceDetailPage.jsx
 * ══════════════════════════════════════════════════════════════════════════════
 * Route: /invoices/:id
 *
 * WHAT CHANGED vs. previous version
 * ────────────────────────────────────
 * FIX-INV-1  PayPal support added to PaymentPanel.
 *            Previously the panel only showed a Stripe card form. Business
 *            users who prefer PayPal had no option on the invoice detail page.
 *            Now: a gateway selector (Stripe / PayPal) is shown before the
 *            payment form. Choosing PayPal calls initiateInvoicePayment() with
 *            gateway="paypal" and redirects to PayPal approval URL.
 *            PayPal return hits /pay/:txId?token=... (existing PaymentPage flow).
 *
 * FIX-INV-2  Idempotency key is now stable: `inv-${invoice.id}-${gateway}`
 *            (no Date.now() suffix). This prevents duplicate PaymentTransactions
 *            if the user clicks twice or retries.
 *
 * FIX-INV-3  On ALREADY_PAID response, the panel now shows a success state
 *            immediately and calls onPaid() — instead of throwing and showing
 *            a misleading error message.
 *
 * Everything else in the file is unchanged (DetailRow, page layout, PDF
 * download, booking list, status display).
 * ══════════════════════════════════════════════════════════════════════════════
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
  Layers,
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
  ExternalLink,
  Copy,
  Check,
} from "lucide-react";

const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY);

// ─── Status helpers ───────────────────────────────────────────────────────────

const STATUS_STYLES = {
  draft:     "bg-surface text-muted-foreground border-border",
  issued:    "bg-info-surface text-info border-info/30",
  partial:   "bg-warning-surface text-warning border-warning/30",
  paid:      "bg-success-surface text-success border-success/30",
  overdue:   "bg-destructive-surface text-destructive border-destructive/30",
  cancelled: "bg-surface text-subtle-foreground border-border",
};

// ─── Stripe inner form ────────────────────────────────────────────────────────

function StripePayForm({ clientSecret, transactionId, amount, currency, onSuccess, onError }) {
  const stripe = useStripe();
  const elements = useElements();
  const [processing, setProcessing] = useState(false);
  const [cardError, setCardError] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!stripe || !elements) return;
    setProcessing(true);
    setCardError(null);

    // FIX: confirmCardPayment receives the clientSecret directly here.
    // The <Elements> wrapper must NOT have clientSecret in its options — if it
    // does, Stripe.js initialises in Payment-Element / deferred-intent mode and
    // calls /confirm without the payment_method body, causing a 400.
    // CardElement flow: Elements is a "dumb" UI provider; the secret goes only
    // to confirmCardPayment.
    const { error, paymentIntent } = await stripe.confirmCardPayment(clientSecret, {
      payment_method: { card: elements.getElement(CardElement) },
    });

    if (error) {
      setCardError(error.message);
      onError?.(error.message);
    } else if (paymentIntent?.status === "succeeded") {
      // Fire-and-forget safety-net: tell our backend to finalise immediately in
      // case the webhook is delayed. Idempotent — safe if webhook already ran.
      try {
        await paymentApi.confirmPaymentSuccess({
          paymentIntentId: paymentIntent.id,
          transactionId,
        });
      } catch (_) {
        // Non-fatal: the Stripe webhook handles finalisation independently
      }
      onSuccess?.();
    } else {
      setCardError("Unexpected payment status. Please try again.");
    }
    setProcessing(false);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="bg-surface/50 border border-border rounded-xl p-4">
        <label className="block text-sm font-medium text-muted-foreground mb-3">
          Card details
        </label>
        <CardElement
          options={{
            style: {
              base: {
                color: "#f1f5f9",
                fontFamily: "Inter, system-ui, sans-serif",
                fontSize: "15px",
                "::placeholder": { color: "#94a3b8" },
              },
              invalid: { color: "#f87171" },
            },
          }}
        />
      </div>

      {cardError && (
        <p className="text-sm text-destructive flex items-center gap-1.5">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          {cardError}
        </p>
      )}

      <button
        type="submit"
        disabled={!stripe || processing}
        className={`w-full py-3 text-foreground rounded-xl font-semibold transition flex items-center justify-center gap-2 ${
          processing
            ? "bg-surface-hover cursor-not-allowed"
            : "bg-primary hover:bg-primary-hover"
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

// ─── Copy-to-clipboard field (bank transfer, §5) ────────────────────────────────
// Bank transfers fail reconciliation constantly due to typos, so every field the
// customer must re-key gets a one-tap copy affordance.

function CopyField({ label, value }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(String(value));
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard unavailable (insecure context) — non-fatal, value is visible.
    }
  };

  return (
    <div className="flex items-center justify-between gap-3 py-2.5 border-b border-border/50 last:border-0">
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground uppercase tracking-wide">{label}</p>
        <p className="text-sm font-medium text-foreground truncate">{value}</p>
      </div>
      <button
        type="button"
        onClick={handleCopy}
        aria-label={`Copy ${label}`}
        className="flex-shrink-0 flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-surface hover:bg-surface-hover text-foreground text-xs font-medium transition"
      >
        {copied ? <><Check className="w-3.5 h-3.5 text-success" /> Copied</> : <><Copy className="w-3.5 h-3.5" /> Copy</>}
      </button>
    </div>
  );
}

// ─── Bank transfer panel (§5) ───────────────────────────────────────────────────
// No live charge, so NO "Pay" button — just the receiving-account details plus the
// exact reference (the invoice number) the customer must use, all copyable.

function BankTransferPanel({ invoice, details }) {
  return (
    <div className="space-y-4">
      <div className="bg-surface/40 border border-border rounded-xl p-4">
        <CopyField label="Bank" value={details.bank_name} />
        <CopyField label="Account name" value={details.account_name} />
        <CopyField label="Sort code" value={details.sort_code} />
        <CopyField label="Account number" value={details.account_number} />
        {/* The reference is the invoice number — the single thing reconciliation matches on. */}
        <CopyField label="Payment reference (use this exactly)" value={invoice.invoice_number} />
        <div className="flex items-center justify-between gap-3 pt-2.5">
          <div>
            <p className="text-xs text-muted-foreground uppercase tracking-wide">Amount</p>
            <p className="text-sm font-semibold text-brand-text">
              {invoice.currency} {parseFloat(invoice.outstanding || 0).toFixed(2)}
            </p>
          </div>
        </div>
      </div>
      <p className="text-xs text-muted-foreground flex items-start gap-1.5">
        <Info className="w-4 h-4 shrink-0 mt-0.5" />
        {details.note}
      </p>
    </div>
  );
}

// ─── Payment panel ────────────────────────────────────────────────────────────
// FIX-INV-1: supports Stripe and PayPal. §5: adds Bank Transfer when configured.

function PaymentPanel({ invoice, onPaid }) {
  // phase: idle | gateway_select | loading | ready_stripe | ready_paypal | success | error
  const [phase, setPhase] = useState("idle");
  const [selectedGateway, setSelectedGateway] = useState("stripe");
  const [payData, setPayData] = useState(null);
  const [err, setErr] = useState(null);
  // §5: bank-transfer details, fetched once. null until loaded; enabled=false hides the tab.
  const [bankDetails, setBankDetails] = useState(null);

  const outstanding = parseFloat(invoice.outstanding);

  useEffect(() => {
    let alive = true;
    paymentApi.getBankTransferDetails().then((res) => {
      if (alive && res.success && res.data?.enabled) setBankDetails(res.data);
    });
    return () => { alive = false; };
  }, []);

  const handleInitiatePayment = async (gateway) => {
    setPhase("loading");
    setErr(null);
    try {
      // FIX-INV-2: stable idempotency key — no Date.now()
      const result = await paymentApi.initiateInvoicePayment(
        invoice.id,
        gateway,
        `inv-${invoice.id}-${gateway}`,
      );

      if (!result.success) {
        // A prepaid batch's proforma. Unpaid, payable, and not payable here:
        // the batch owns one embedded Checkout Session, and building a second
        // gateway object against the same debt is what put two payment records
        // on one bulk upload. Send them to the checkout that works instead of
        // showing an error for money they are trying to pay.
        if (result.code === "USE_BATCH_CHECKOUT" && result.payUrl) {
          window.location.href = result.payUrl;
          return;
        }
        // FIX-INV-3: handle ALREADY_PAID gracefully
        if (result.code === "ALREADY_PAID") {
          setPhase("success");
          onPaid?.();
          return;
        }
        throw new Error(result.message || "Could not initiate payment.");
      }

      const data = result.data;

      if (gateway === "paypal" && data.approval_url) {
        // PayPal: redirect immediately (300ms for UX breathing room)
        setPayData(data);
        setPhase("ready_paypal");
        setTimeout(() => {
          window.location.href = data.approval_url;
        }, 300);
        return;
      }

      if (gateway === "stripe" && data.client_secret) {
        setPayData(data);
        setPhase("ready_stripe");
        return;
      }

      throw new Error("Invalid gateway response from server.");
    } catch (e) {
      setErr(e.message || "Could not initiate payment.");
      setPhase("error");
    }
  };

  // ── idle: show gateway selector
  if (phase === "idle") {
    return (
      <div className="space-y-3">
        {/* Gateway toggle — Bank Transfer appears only when configured (§5) */}
        <div className="flex gap-2">
          {[
            { id: "stripe", label: "💳 Card" },
            { id: "paypal", label: "🔵 PayPal" },
            ...(bankDetails ? [{ id: "bank", label: "🏦 Bank" }] : []),
          ].map(({ id, label }) => (
            <button
              key={id}
              onClick={() => setSelectedGateway(id)}
              className={`flex-1 py-2 rounded-lg border text-sm font-medium transition ${
                selectedGateway === id
                  ? id === "paypal"
                    ? "border-info bg-info/10 text-info"
                    : id === "bank"
                      ? "border-success bg-success/10 text-success"
                      : "border-primary bg-primary/10 text-brand-text"
                  : "border-border text-muted-foreground hover:border-border-strong"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Bank Transfer: no live charge, so show details instead of a pay button */}
        {selectedGateway === "bank" && bankDetails ? (
          <BankTransferPanel invoice={invoice} details={bankDetails} />
        ) : (
        <button
          onClick={() => handleInitiatePayment(selectedGateway)}
          className="w-full py-3 bg-primary hover:bg-primary-hover text-primary-foreground rounded-xl
                     font-semibold transition flex items-center justify-center gap-2
                     shadow-lg shadow-primary/20"
        >
          {selectedGateway === "paypal" ? (
            <><ExternalLink className="w-5 h-5" /> Pay via PayPal</>
          ) : (
            <><CreditCard className="w-5 h-5" /> Pay Outstanding: {invoice.currency} {outstanding.toFixed(2)}</>
          )}
        </button>
        )}
      </div>
    );
  }

  if (phase === "loading") {
    return (
      <div className="flex items-center gap-2 text-muted-foreground py-3">
        <Loader2 className="w-5 h-5 animate-spin text-brand-text" />
        Preparing {selectedGateway === "paypal" ? "PayPal" : "Stripe"}…
      </div>
    );
  }

  if (phase === "error") {
    return (
      <div className="space-y-3">
        <p className="text-sm text-destructive flex items-center gap-1.5">
          <AlertTriangle className="w-4 h-4" />{err}
        </p>
        <button
          onClick={() => setPhase("idle")}
          className="w-full py-2.5 bg-surface hover:bg-surface-hover text-foreground rounded-xl
                     font-medium text-sm transition"
        >
          Try Again
        </button>
      </div>
    );
  }

  if (phase === "success") {
    return (
      <div className="flex items-center gap-2 text-success py-3">
        <CheckCircle className="w-5 h-5" />
        Payment successful! Invoice has been updated.
      </div>
    );
  }

  // FIX-INV-1: PayPal redirect screen
  if (phase === "ready_paypal" && payData?.approval_url) {
    return (
      <div className="space-y-4 text-center">
        <div className="flex flex-col items-center gap-2 py-2">
          <Loader2 className="w-7 h-7 animate-spin text-info" />
          <p className="text-muted-foreground text-sm font-medium">Redirecting to PayPal…</p>
        </div>
        <button
          onClick={() => { window.location.href = payData.approval_url; }}
          className="w-full py-2.5 bg-[#0070ba] hover:bg-[#005ea6] text-white rounded-xl
                     font-semibold text-sm transition flex items-center justify-center gap-2"
        >
          <ExternalLink className="w-4 h-4" /> Open PayPal manually
        </button>
      </div>
    );
  }

  // Stripe card form
  if (phase === "ready_stripe" && payData?.client_secret) {
    return (
      // FIX: Do NOT pass clientSecret to Elements options when using CardElement
      // + confirmCardPayment. Passing clientSecret here triggers Stripe.js's
      // "deferred intent" / Payment-Element mode, which calls /confirm without
      // the payment_method body and causes a 400 Bad Request.
      //
      // In the CardElement flow, Elements is purely a UI component provider.
      // The clientSecret is passed directly to stripe.confirmCardPayment() below.
      // Only add appearance here — no clientSecret.
      <Elements
        stripe={stripePromise}
        options={{
          appearance: {
            theme: "night",
            variables: {
              colorPrimary: "#F97316",
              colorBackground: "#1E293B",
              colorText: "#F8FAFC",
            },
          },
        }}
      >
        <StripePayForm
          clientSecret={payData.client_secret}
          transactionId={payData.transaction_id}
          amount={payData.amount}
          currency={payData.currency || "GBP"}
          onSuccess={() => { setPhase("success"); onPaid?.(); }}
          onError={(msg) => { setErr(msg); setPhase("error"); }}
        />
      </Elements>
    );
  }

  // Shouldn't reach here
  return null;
}

// ─── Detail row ───────────────────────────────────────────────────────────────

function DetailRow({ label, value, className = "" }) {
  return (
    <div className="flex justify-between items-start py-2.5 border-b border-border/50 last:border-0">
      <span className="text-muted-foreground text-sm">{label}</span>
      <span className={`text-sm font-medium text-right ${className || "text-foreground"}`}>
        {value}
      </span>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

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
      setError(
        err?.response?.status === 404
          ? "Invoice not found."
          : "Failed to load invoice.",
      );
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { fetchInvoice(); }, [fetchInvoice]);

  // Auto-open pay panel when ?action=pay is in the URL
  useEffect(() => {
    if (autoOpenPay && invoice && !showPayPanel) {
      setShowPayPanel(true);
    }
  }, [autoOpenPay, invoice, showPayPanel]);

  const handlePaid = useCallback(() => {
    // Reload invoice to show updated PAID status
    fetchInvoice();
    setShowPayPanel(false);
  }, [fetchInvoice]);

  if (loading) {
    return (
      <div className="min-h-screen bg-card flex items-center justify-center  pt-20">
        <Loader2 className="w-8 h-8 animate-spin text-brand-text" />
      </div>
    );
  }

  if (error || !invoice) {
    return (
      <div className="min-h-screen bg-card flex items-center justify-center  pt-20">
        <div className="text-center">
          <AlertTriangle className="w-12 h-12 text-destructive mx-auto mb-4" />
          <p className="text-foreground text-lg font-semibold mb-2">
            {error || "Invoice not found"}
          </p>
          <button
            onClick={() => navigate("/billing")}
            className="mt-4 px-6 py-2.5 bg-surface hover:bg-surface-hover text-foreground rounded-xl font-medium transition"
          >
            Back to Billing
          </button>
        </div>
      </div>
    );
  }

  // Served by the API (Receivable.is_payable), never re-derived from status.
  // This was the third copy of the whitelist and the most damaging one: it
  // guards the page the Pay button navigates TO, so even after /billing and the
  // bulk dashboard offered to pay a DRAFT invoice, this screen would have
  // refused to render the payment form for it.
  const isPayable = invoice.is_payable === true;
  const outstanding = parseFloat(invoice.outstanding || 0);
  const isBulkInvoice = !!invoice.bulk_upload;

  // Back navigation is origin-aware, NOT history.back() — a user can land here
  // from an email/direct link where history has nowhere sensible to go (spec §5).
  // If the caller passed an explicit return route (in-app navigation), honor it;
  // otherwise a bulk invoice returns to its upload, a normal one to billing.
  const handleBack = () => {
    const from = location.state?.from;
    if (from) return navigate(from);
    if (isBulkInvoice) return navigate(`/bulk-upload/${invoice.bulk_upload}`);
    return navigate("/billing");
  };

  return (
    // §1 FIX: the site Header is `fixed top-0` at h-20 (80px) / h-16 scrolled,
    // z-50. `py-10` (40px) let the invoice heading + back arrow render UNDER the
    // nav. Every other full page under this header uses pt-20; the title sits
    // right at the top here so we use pt-24 for breathing room.
    <div className="min-h-screen bg-card px-4 pt-24 pb-10">
      <div className="max-w-2xl mx-auto space-y-6">

        {/* Header — back button gets its own fixed cell so it can never overlap
            the title; the title block is allowed to shrink/truncate; the badges
            wrap onto their own line on narrow viewports (spec §5). */}
        <div className="flex items-start gap-3">
          <button
            onClick={handleBack}
            aria-label="Back"
            className="flex-shrink-0 p-2 rounded-lg bg-surface hover:bg-surface text-muted-foreground transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="min-w-0 flex-1">
            <h1 className="text-2xl font-bold text-foreground truncate">
              Invoice {invoice.invoice_number}
            </h1>
            <p className="text-sm text-muted-foreground truncate">{invoice.business_name}</p>
            {/* Bulk-vs-single distinction (spec §4) */}
            {isBulkInvoice && (
              <span className="mt-2 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-primary/15 text-brand-text border border-primary/40">
                <Layers className="w-3.5 h-3.5" />
                Bulk Payment
                {invoice.booking_count != null && ` · ${invoice.booking_count} booking${invoice.booking_count !== 1 ? "s" : ""}`}
              </span>
            )}
          </div>
          <span
            className={`flex-shrink-0 px-3 py-1 rounded-full text-xs font-semibold border ${
              STATUS_STYLES[invoice.status] || STATUS_STYLES.draft
            }`}
          >
            {invoice.status_display || invoice.status}
          </span>
        </div>

        {/* Amounts card */}
        <div className="bg-surface border border-border rounded-2xl p-6">
          <div className="grid grid-cols-3 gap-4 mb-6">
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Total</p>
              <p className="text-2xl font-bold text-foreground">
                {invoice.currency} {parseFloat(invoice.amount).toFixed(2)}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Paid</p>
              <p className="text-2xl font-bold text-success">
                {invoice.currency} {parseFloat(invoice.paid_amount || 0).toFixed(2)}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Outstanding</p>
              <p className={`text-2xl font-bold ${outstanding > 0 ? "text-brand-text" : "text-muted-foreground"}`}>
                {invoice.currency} {outstanding.toFixed(2)}
              </p>
            </div>
          </div>

          {/* Pay panel */}
          {isPayable && outstanding > 0 && (
            <div>
              {!showPayPanel ? (
                <button
                  onClick={() => setShowPayPanel(true)}
                  className="w-full py-3 bg-primary hover:bg-primary-hover text-primary-foreground rounded-xl
                             font-semibold transition flex items-center justify-center gap-2
                             shadow-lg shadow-primary/20"
                >
                  <CreditCard className="w-5 h-5" />
                  Pay Now — {invoice.currency} {outstanding.toFixed(2)}
                </button>
              ) : (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold text-foreground">Online Payment</p>
                    <button
                      onClick={() => setShowPayPanel(false)}
                      className="text-xs text-muted-foreground hover:text-foreground transition"
                    >
                      Cancel
                    </button>
                  </div>
                  <PaymentPanel invoice={invoice} onPaid={handlePaid} />
                </div>
              )}
            </div>
          )}

          {invoice.status === "paid" && (
            <div className="flex items-center gap-2 text-success py-2">
              <CheckCircle className="w-5 h-5" />
              <span className="font-medium">Invoice Paid</span>
            </div>
          )}
        </div>

        {/* Invoice details */}
        <div className="bg-surface border border-border rounded-2xl p-6">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-4">
            Invoice Details
          </h2>
          <div className="space-y-0">
            <DetailRow label="Invoice Number"  value={invoice.invoice_number} />
            <DetailRow label="Issue Date"      value={invoice.issue_date} />
            <DetailRow label="Due Date"        value={invoice.due_date}
              className={invoice.is_overdue ? "text-destructive font-semibold" : "text-foreground"} />
            <DetailRow label="Payment Terms"   value={invoice.payment_terms_display || invoice.payment_terms} />
            {invoice.bulk_upload && (
              <DetailRow
                label="Bulk Upload"
                value={
                  <button
                    onClick={() => navigate(`/bulk-upload/${invoice.bulk_upload}`)}
                    className="text-brand-text hover:text-brand-text text-sm transition"
                  >
                    View Upload →
                  </button>
                }
              />
            )}
            {invoice.booking_count != null && (
              <DetailRow label="Bookings" value={`${invoice.booking_count} booking${invoice.booking_count !== 1 ? "s" : ""}`} />
            )}
            {invoice.notes && (
              <DetailRow label="Notes" value={invoice.notes} />
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          {invoice.pdf_url && (
            <a
              href={invoice.pdf_url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 px-4 py-2.5 bg-surface hover:bg-surface-hover
                         text-foreground rounded-xl font-medium text-sm transition"
            >
              <Download className="w-4 h-4" /> Download PDF
            </a>
          )}
          <button
            onClick={() => navigate("/billing")}
            className="flex items-center gap-2 px-4 py-2.5 bg-surface hover:bg-surface-hover
                       text-foreground rounded-xl font-medium text-sm transition"
          >
            <ArrowLeft className="w-4 h-4" /> All Invoices
          </button>
        </div>

      </div>
    </div>
  );
}