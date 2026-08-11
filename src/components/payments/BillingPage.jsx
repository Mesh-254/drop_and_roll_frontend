/**
 * BillingPage
 * ═══════════════════════════════════════════════════════════════
 * Route: /billing  (or /invoices)
 *
 * Shows all NET-terms invoices (Receivables) for the authenticated
 * business user. Admins see all invoices; business users see only theirs.
 *
 * Features:
 *   - Invoice list with status badges, amounts, due dates
 *   - Filter by view (all | outstanding | overdue | partial | paid)
 *   - Download PDF per invoice
 *   - Pay Now button wherever the server says the invoice is payable
 *
 * TWO RULES THIS FILE MUST NOT BREAK AGAIN
 * ────────────────────────────────────────
 * 1. Payability is not computed here. Render `invoice.is_payable`. This file
 *    used to hold its own ["issued","partial","overdue"] whitelist; when the
 *    backend started accepting DRAFT, the copy here was not updated, and a
 *    production invoice with £16.00 owed rendered no Pay button at all — the
 *    customer could not pay a bill we had already sent.
 * 2. Totals are not computed here. Render `summary` from the response. The tiles
 *    used to sum whichever rows were loaded, so the Outstanding tile read
 *    £16.00 while the Outstanding tab beneath it said "No invoices found", and
 *    the headline numbers changed when you switched tabs or paged.
 */

import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import receivableApi from "../../api/ReceivableApi";
import {
  FileText,
  Download,
  CreditCard,
  AlertTriangle,
  CheckCircle,
  Clock,
  XCircle,
  Search,
  RefreshCw,
  ChevronRight,
} from "lucide-react";

// ─── Status badge ────────────────────────────────────────────────────────────

const STATUS_CONFIG = {
  draft:     { label: "Draft",         color: "text-slate-300  bg-slate-700  border-slate-600" },
  issued:    { label: "Issued",         color: "text-blue-300   bg-blue-900/40 border-blue-700" },
  partial:   { label: "Partial",        color: "text-yellow-300 bg-yellow-900/40 border-yellow-700" },
  paid:      { label: "Paid",           color: "text-green-300  bg-green-900/40 border-green-700" },
  overdue:   { label: "Overdue",        color: "text-red-300    bg-red-900/40 border-red-700" },
  cancelled: { label: "Cancelled",      color: "text-slate-400  bg-slate-800   border-slate-700" },
};

// What the DOCUMENT calls itself. The row must use the same word as the PDF it
// links to: a row reading "Issued" over a document headed "Proforma Invoice" is
// two descriptions of one debt, and the customer has to guess which is true.
const DOCUMENT_STATUS_CONFIG = {
  proforma:  { label: "Payment request", color: "text-amber-300  bg-amber-900/40 border-amber-700" },
  unpaid:    { label: "Unpaid",          color: "text-amber-300  bg-amber-900/40 border-amber-700" },
  paid:      { label: "Paid",            color: "text-green-300  bg-green-900/40 border-green-700" },
  cancelled: { label: "Cancelled",       color: "text-slate-400  bg-slate-800   border-slate-700" },
};

function StatusBadge({ status, documentStatus }) {
  // Prefer the document's own vocabulary; fall back to the ledger status so a
  // frontend deployed ahead of the backend degrades instead of blanking.
  const cfg =
    DOCUMENT_STATUS_CONFIG[documentStatus] || STATUS_CONFIG[status] || STATUS_CONFIG.draft;
  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border ${cfg.color}`}
    >
      {cfg.label}
    </span>
  );
}

// ─── Single invoice row ──────────────────────────────────────────────────────

function InvoiceRow({ invoice, onPay, onDownload, onView }) {
  // Served by the API (Receivable.is_payable), never re-derived from status.
  const isPayable = invoice.is_payable === true;
  const dueDate = invoice.due_date ? new Date(invoice.due_date) : null;
  const isOverdue = invoice.is_overdue;

  return (
    <div
      className="group bg-slate-800 border border-slate-700 hover:border-slate-600 rounded-xl p-5 transition-all duration-150 cursor-pointer"
      onClick={() => onView(invoice.id)}
    >
      <div className="flex items-start justify-between gap-4">
        {/* Left: invoice info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 mb-1">
            <span className="font-mono text-base font-bold text-white">
              {invoice.invoice_number}
            </span>
            <StatusBadge status={invoice.status} documentStatus={invoice.document_status} />
            {isOverdue && (
              <span className="flex items-center gap-1 text-xs text-red-400">
                <AlertTriangle className="w-3.5 h-3.5" />
                {invoice.days_overdue}d overdue
              </span>
            )}
          </div>
          <div className="flex flex-wrap gap-x-5 gap-y-1 text-sm text-slate-400">
            {invoice.business_name && (
              <span>{invoice.business_name}</span>
            )}
            {invoice.booking_count > 0 && (
              <span>{invoice.booking_count} booking{invoice.booking_count !== 1 ? "s" : ""}</span>
            )}
            <span>
              {invoice.kind_label || invoice.payment_terms_display || invoice.payment_terms}
            </span>
            {dueDate && (
              <span className={isOverdue ? "text-red-400 font-medium" : ""}>
                Due {dueDate.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
              </span>
            )}
          </div>
        </div>

        {/* Right: amounts + actions */}
        <div className="flex items-center gap-4 shrink-0">
          <div className="text-right">
            <div className="text-lg font-bold text-white">
              {invoice.currency} {parseFloat(invoice.amount).toFixed(2)}
            </div>
            {invoice.is_outstanding && (
              <div className="text-xs text-red-400">
                Outstanding: {invoice.currency} {parseFloat(invoice.outstanding).toFixed(2)}
              </div>
            )}
          </div>

          <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
            {invoice.pdf_url && (
              <button
                onClick={() => onDownload(invoice.id, invoice.invoice_number)}
                title="Download PDF"
                className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700 transition"
              >
                <Download className="w-4 h-4" />
              </button>
            )}

            {isPayable && (
              <button
                onClick={() => onPay(invoice.id)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-orange-500 hover:bg-orange-600 text-white text-sm rounded-lg font-medium transition"
              >
                <CreditCard className="w-3.5 h-3.5" />
                Pay Now
              </button>
            )}

            <ChevronRight className="w-4 h-4 text-slate-500 group-hover:text-slate-300 transition" />
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Filter bar ──────────────────────────────────────────────────────────────

// `key` is the server-side `view`, so each tab asks for exactly what its label
// says. "Outstanding" was previously wired to status=issued — one status value
// standing in for a question about the balance — which hid DRAFT invoices that
// owed money.
const FILTERS = [
  { key: "all",         label: "All" },
  { key: "outstanding", label: "Outstanding" },
  { key: "overdue",     label: "Overdue" },
  { key: "partial",     label: "Partial" },
  { key: "paid",        label: "Paid" },
];

const EMPTY_SUMMARY = {
  total_invoiced: "0.00",
  total_paid: "0.00",
  outstanding: "0.00",
  overdue: "0.00",
  counts: {},
};

const money = (value) => `£${parseFloat(value || 0).toFixed(2)}`;

// ─── Page ────────────────────────────────────────────────────────────────────

export default function BillingPage() {
  const navigate = useNavigate();

  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeFilter, setActiveFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [summary, setSummary] = useState(EMPTY_SUMMARY);

  const PAGE_SIZE = 15;

  const fetchInvoices = useCallback(
    async (viewFilter = activeFilter, pg = page) => {
      setLoading(true);
      setError(null);
      try {
        const data = await receivableApi.list({
          view: viewFilter || "all",
          page: pg,
          pageSize: PAGE_SIZE,
        });
        // Backend may return { count, results, summary } or just an array
        if (Array.isArray(data)) {
          setInvoices(data);
          setTotalCount(data.length);
          setSummary(EMPTY_SUMMARY);
        } else {
          setInvoices(data.results || []);
          setTotalCount(data.count || 0);
          // Ledger totals come from the server so they stay the same whichever
          // tab is open. Falling back to EMPTY_SUMMARY (not to a client-side
          // sum) keeps a stale-API deploy showing £0.00 rather than a number
          // that quietly means something else.
          setSummary(data.summary || EMPTY_SUMMARY);
        }
      } catch (err) {
        console.error("BillingPage: fetch error", err);
        setError("Failed to load invoices. Please try again.");
      } finally {
        setLoading(false);
      }
    },
    [activeFilter, page]
  );

  useEffect(() => {
    fetchInvoices(activeFilter, page);
  }, [activeFilter, page]);

  const handleFilterChange = (key) => {
    setActiveFilter(key);
    setPage(1);
  };

  const handlePay = (invoiceId) => {
    navigate(`/invoices/${invoiceId}?action=pay`);
  };

  const handleDownload = async (id, invoiceNumber) => {
    try {
      await receivableApi.downloadPdf(id, invoiceNumber);
    } catch (err) {
      console.error("Download failed:", err);
    }
  };

  const handleView = (id) => {
    navigate(`/invoices/${id}`);
  };

  // Client-side search filter
  const filtered = search.trim()
    ? invoices.filter(
        (inv) =>
          inv.invoice_number
            ?.toLowerCase()
            .includes(search.toLowerCase()) ||
          inv.business_name?.toLowerCase().includes(search.toLowerCase())
      )
    : invoices;

  const totalPages = Math.ceil(totalCount / PAGE_SIZE);

  return (
    <div className="min-h-screen bg-slate-900 px-4 pt-20 pb-8 sm:px-6 lg:px-8">
        <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <FileText className="w-6 h-6 text-orange-500" />
              <h1 className="text-2xl font-bold text-white">Billing & Invoices</h1>
            </div>
            <p className="text-slate-400 text-sm">
              Manage your NET-terms invoices and payment history.
            </p>
          </div>
          <button
            onClick={() => fetchInvoices()}
            className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
            title="Refresh"
          >
            <RefreshCw className="w-5 h-5" />
          </button>
        </div>

        {/* Stats row — server-computed over the whole ledger, so these do not
            move when the active tab or page changes. */}
        {!loading && (
          <div className="grid grid-cols-3 gap-4 mb-8" data-testid="billing-summary">
            <div className="bg-slate-800 border border-slate-700 rounded-xl p-4">
              <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">
                Total Invoiced
              </p>
              <p className="text-xl font-bold text-white" data-testid="tile-total">
                {money(summary.total_invoiced)}
              </p>
            </div>
            <div className="bg-slate-800 border border-slate-700 rounded-xl p-4">
              <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">
                Outstanding
              </p>
              <p className="text-xl font-bold text-yellow-400" data-testid="tile-outstanding">
                {money(summary.outstanding)}
              </p>
            </div>
            <div className="bg-slate-800 border border-slate-700 rounded-xl p-4">
              <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">
                Overdue
              </p>
              <p
                className={`text-xl font-bold ${
                  parseFloat(summary.overdue || 0) > 0 ? "text-red-400" : "text-slate-400"
                }`}
                data-testid="tile-overdue"
              >
                {money(summary.overdue)}
              </p>
            </div>
          </div>
        )}

        {/* Filter + Search */}
        <div className="flex flex-col sm:flex-row gap-3 mb-5">
          <div className="flex gap-1 bg-slate-800 border border-slate-700 rounded-xl p-1 overflow-x-auto">
            {FILTERS.map((f) => (
              <button
                key={f.key}
                onClick={() => handleFilterChange(f.key)}
                className={`px-4 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap transition ${
                  activeFilter === f.key
                    ? "bg-orange-500 text-white shadow"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search invoice number…"
              className="w-full bg-slate-800 border border-slate-700 rounded-xl pl-9 pr-4 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-orange-500"
            />
          </div>
        </div>

        {/* Content */}
        {loading ? (
          <div className="text-center py-20">
            <RefreshCw className="w-8 h-8 text-orange-500 animate-spin mx-auto mb-3" />
            <p className="text-slate-400">Loading invoices…</p>
          </div>
        ) : error ? (
          <div className="text-center py-20">
            <AlertTriangle className="w-10 h-10 text-red-400 mx-auto mb-3" />
            <p className="text-red-400 mb-4">{error}</p>
            <button
              onClick={() => fetchInvoices()}
              className="px-5 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg text-sm"
            >
              Retry
            </button>
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20">
            <FileText className="w-12 h-12 text-slate-700 mx-auto mb-4" />
            <p className="text-slate-400 text-lg font-medium">No invoices found</p>
            <p className="text-slate-500 text-sm mt-1">
              {activeFilter && activeFilter !== "all"
                ? `No ${activeFilter} invoices.`
                : "Your invoices will appear here after bulk uploads."}
            </p>
          </div>
        ) : (
          <>
            <div className="space-y-3">
              {filtered.map((invoice) => (
                <InvoiceRow
                  key={invoice.id}
                  invoice={invoice}
                  onPay={handlePay}
                  onDownload={handleDownload}
                  onView={handleView}
                />
              ))}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between mt-6 text-sm text-slate-400">
                <span>
                  Showing {(page - 1) * PAGE_SIZE + 1}–
                  {Math.min(page * PAGE_SIZE, totalCount)} of {totalCount}
                </span>
                <div className="flex gap-2">
                  <button
                    disabled={page === 1}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    className="px-3 py-1.5 rounded-lg bg-slate-800 border border-slate-700 disabled:opacity-40 hover:border-slate-600 transition"
                  >
                    ← Prev
                  </button>
                  <button
                    disabled={page === totalPages}
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    className="px-3 py-1.5 rounded-lg bg-slate-800 border border-slate-700 disabled:opacity-40 hover:border-slate-600 transition"
                  >
                    Next →
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}