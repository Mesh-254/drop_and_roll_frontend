/**
 * src/components/business/BulkUploadDashboard.jsx
 * ════════════════════════════════════════════════════════════════════════════════
 * 
 * SIGNIFICANTLY ENHANCED for business user management
 * ──────────────────────────────────────────────────────
 *
 * Key improvements:
 *   • Paginated table with flexible page size
 *   • Status, date range, and search filters
 *   • Quick stats header showing aggregate metrics
 *   • Payment pending banner with action items
 *   • Loading states and empty states
 *   • Mobile-responsive design
 *   • Action buttons (View Detail, Download Report)
 */

import React, { useEffect, useCallback, useState } from "react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import {
  BarChart3,
  FileUp,
  TrendingUp,
  DollarSign,
  Plus,
  Loader2,
  Eye,
  CreditCard,
  CheckCircle2,
  Receipt,
  Download,
  Search,
  Filter,
  ChevronLeft,
  ChevronRight,
  RotateCcw,
  ArrowRight,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { useAuth } from "../../contexts/AuthContext";
import BulkUploadApi from "../../api/BulkUploadApi";
import BulkUploadWizard from "./BulkUploadWizard";
import { useBulkUpload } from "../../hooks/useBulkUpload";
import { getStatusColors, getStatusLabel } from "../../utils/bulkUploadValidation";
import { bulkMoneyLine, MONEY_TONE_CLASS } from "./bulkMoney";

const PAGE_SIZES = [10, 25, 50];
const STATUSES = [
  { value: "all", label: "All Statuses" },
  { value: "payment_pending", label: "Awaiting Payment" },
  { value: "completed", label: "Completed" },
  { value: "processing", label: "Processing" },
  { value: "partial", label: "Partial" },
  { value: "failed", label: "Failed" },
  { value: "pending", label: "Pending" },
];

export default function BulkUploadDashboard() {
  const navigate = useNavigate();
  const auth = useAuth();
  const isApproved = auth?.user?.is_approved ?? true;

  const { reset } = useBulkUpload();

  // State
  const [uploads, setUploads] = useState([]);
  const [isFetching, setIsFetching] = useState(true);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [statusFilter, setStatusFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [dateRangeStart, setDateRangeStart] = useState("");
  const [dateRangeEnd, setDateRangeEnd] = useState("");
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [totalCount, setTotalCount] = useState(0);
  const [showFilters, setShowFilters] = useState(false);

  // Fetch uploads with filters
  const fetchUploads = useCallback(async () => {
    setIsFetching(true);
    try {
      const params = {
        page,
        page_size: pageSize,
      };

      if (statusFilter !== "all") params.status = statusFilter;
      if (searchQuery) params.search = searchQuery;
      if (dateRangeStart) params.date_from = dateRangeStart;
      if (dateRangeEnd) params.date_to = dateRangeEnd;

      const response = await BulkUploadApi.listUploads(params);
      
      // Handle paginated response format { results: [], count: N } or plain array
      if (response.results) {
        setUploads(response.results);
        setTotalCount(response.count || 0);
      } else if (Array.isArray(response)) {
        setUploads(response);
        setTotalCount(response.length);
      } else {
        setUploads([]);
        setTotalCount(0);
      }
    } catch (err) {
      console.error("[BulkUploadDashboard] Failed to fetch uploads:", err);
      setUploads([]);
      setTotalCount(0);
    } finally {
      setIsFetching(false);
    }
  }, [page, pageSize, statusFilter, searchQuery, dateRangeStart, dateRangeEnd]);

  // Overall stats for the header — deliberately independent of the current
  // filter/pagination state. FIX: the previous implementation derived
  // "success rate" and "total spend" from `uploads` (the current page of up
  // to `pageSize` rows), which under- or over-counts for any account with
  // more than one page of uploads. The backend already exposes a proper
  // DB-aggregated /stats/ endpoint (BulkUploadApi.getStats) that was never
  // wired up — use it instead of re-deriving inaccurate numbers client-side.
  const [overallStats, setOverallStats] = useState({
    total_uploads: 0,
    total_bookings: 0,
    success_rate: 0,
    total_spend: 0,
  });

  const fetchOverallStats = useCallback(async () => {
    try {
      const data = await BulkUploadApi.getStats();
      setOverallStats({
        total_uploads: data?.total_uploads ?? 0,
        total_bookings: data?.total_bookings ?? 0,
        success_rate: data?.success_rate ?? 0,
        total_spend: data?.total_spend ? parseFloat(data.total_spend) : 0,
      });
    } catch (err) {
      console.error("[BulkUploadDashboard] Failed to fetch overall stats:", err);
    }
  }, []);

  // Reset to page 1 when filters change
  const handleFilterChange = useCallback((callback) => {
    setPage(1);
    callback();
  }, []);

  useEffect(() => {
    fetchUploads();
  }, [fetchUploads]);

  useEffect(() => {
    fetchOverallStats();
  }, [fetchOverallStats]);

  // Derived stats
  const stats = React.useMemo(() => ({
    total_uploads: overallStats.total_uploads,
    total_bookings: overallStats.total_bookings,
    success_rate_pct: overallStats.success_rate,
    total_spend_gbp: overallStats.total_spend,
  }), [overallStats]);

  // Pagination
  const totalPages = Math.ceil(totalCount / pageSize);
  const hasPaymentPending = uploads.some(u => u.status === "payment_pending" && u.payment_path === "prepaid");

  if (!isApproved) {
    return (
      <div className="min-h-screen bg-card pt-20">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12 text-center">
          <div className="text-6xl mb-4">🔒</div>
          <h1 className="text-3xl font-bold text-foreground mb-2">
            Access Restricted
          </h1>
          <p className="text-muted-foreground max-w-md mx-auto">
            Your account has not yet been approved for bulk uploads. Contact support for more information.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-card via-surface to-card pt-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-12"
        >
          <div>
            <h1 className="text-4xl font-bold text-foreground mb-1">Bulk Uploads</h1>
            <p className="text-muted-foreground">Manage and track your shipment batches</p>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => navigate("/billing")}
              className="px-5 py-3 bg-surface/60 hover:bg-surface-hover/60 border border-border
                         hover:border-info/50 text-foreground hover:text-foreground rounded-xl
                         font-medium transition-all duration-300 flex items-center gap-2
                         w-full sm:w-auto justify-center"
            >
              <Receipt className="h-5 w-5 text-info" />
              Billing
            </motion.button>
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => {
                reset();
                setShowUploadModal(true);
              }}
              className="px-6 py-3 bg-gradient-to-r from-primary to-primary-hover
                         hover:from-primary-hover hover:to-primary-hover text-primary-foreground rounded-xl
                         font-medium transition-all duration-300 flex items-center gap-2
                         shadow-lg shadow-primary/25 w-full sm:w-auto justify-center"
            >
              <Plus className="h-5 w-5" />
              New Upload
            </motion.button>
          </div>
        </motion.div>

        {/* Stats Grid */}
        <motion.div
          variants={{ hidden: { opacity: 0 }, visible: { opacity: 1 } }}
          initial="hidden"
          animate="visible"
          transition={{ staggerChildren: 0.1 }}
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12"
        >
          <StatCard icon={FileUp} label="Total Uploads" value={stats.total_uploads} isLoading={isFetching} />
          <StatCard icon={BarChart3} label="Bookings Created" value={stats.total_bookings} isLoading={isFetching} />
          <StatCard icon={TrendingUp} label="Success Rate" value={`${stats.success_rate_pct}%`} isLoading={isFetching} />
          <StatCard icon={DollarSign} label="Total Spend" value={`£${stats.total_spend_gbp.toFixed(2)}`} isLoading={isFetching} />
        </motion.div>

        {/* Payment Pending Banner */}
        {hasPaymentPending && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-8 p-4 bg-warning-surface border border-warning/30 rounded-xl flex flex-col sm:flex-row items-start sm:items-center gap-3"
          >
            <CreditCard className="h-5 w-5 text-warning flex-shrink-0 mt-0.5 sm:mt-0" />
            <div className="flex-1">
              <p className="text-warning font-semibold text-sm">Uploads Awaiting Payment</p>
              <p className="text-warning/70 text-xs mt-0.5">Complete payment to schedule your deliveries. Bookings are reserved.</p>
            </div>
          </motion.div>
        )}

        {/* Filters & Search */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8 p-6 bg-surface/50 backdrop-blur rounded-2xl border border-border"
        >
          {/* Main filter row */}
          <div className="flex flex-col sm:flex-row gap-3 mb-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-3 h-5 w-5 text-subtle-foreground pointer-events-none" />
              <input
                type="text"
                placeholder="Search batch name..."
                value={searchQuery}
                onChange={(e) => handleFilterChange(() => setSearchQuery(e.target.value))}
                className="w-full pl-10 pr-4 py-2.5 bg-surface border border-border rounded-lg text-foreground placeholder-subtle-foreground focus:outline-none focus:border-primary transition"
              />
            </div>

            <select
              value={statusFilter}
              onChange={(e) => handleFilterChange(() => setStatusFilter(e.target.value))}
              className="px-4 py-2.5 bg-surface border border-border text-muted-foreground rounded-lg focus:outline-none focus:border-primary transition"
            >
              {STATUSES.map(s => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </select>

            <button
              onClick={() => setShowFilters(!showFilters)}
              className="px-4 py-2.5 bg-surface hover:bg-surface-hover border border-border text-muted-foreground rounded-lg transition flex items-center gap-2"
            >
              <Filter className="h-5 w-5" />
              <span className="hidden sm:inline">More Filters</span>
            </button>
          </div>

          {/* Advanced filters */}
          {showFilters && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="border-t border-border pt-4 space-y-3"
            >
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-muted-foreground font-medium mb-1 block">From Date</label>
                  <input
                    type="date"
                    value={dateRangeStart}
                    onChange={(e) => handleFilterChange(() => setDateRangeStart(e.target.value))}
                    className="w-full px-3 py-2 bg-surface border border-border rounded text-muted-foreground focus:outline-none focus:border-primary transition"
                  />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground font-medium mb-1 block">To Date</label>
                  <input
                    type="date"
                    value={dateRangeEnd}
                    onChange={(e) => handleFilterChange(() => setDateRangeEnd(e.target.value))}
                    className="w-full px-3 py-2 bg-surface border border-border rounded text-muted-foreground focus:outline-none focus:border-primary transition"
                  />
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    setDateRangeStart("");
                    setDateRangeEnd("");
                  }}
                  className="text-xs text-muted-foreground hover:text-foreground transition"
                >
                  Clear Date Range
                </button>
              </div>
            </motion.div>
          )}
        </motion.div>

        {/* Table */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-surface/50 backdrop-blur rounded-2xl border border-border shadow-2xl overflow-hidden"
        >
          {/* Table Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-6 border-b border-border">
            <h2 className="text-xl font-bold text-foreground">Uploads</h2>
            <div className="flex items-center gap-3 text-sm text-muted-foreground">
              <span>
                {isFetching ? "Loading..." : `Showing ${(page - 1) * pageSize + 1}–${Math.min(page * pageSize, totalCount)} of ${totalCount}`}
              </span>
              <select
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value));
                  setPage(1);
                }}
                className="bg-surface border border-border text-muted-foreground rounded px-2 py-1 text-xs focus:outline-none focus:border-primary"
              >
                {PAGE_SIZES.map(size => (
                  <option key={size} value={size}>{size} per page</option>
                ))}
              </select>
            </div>
          </div>

          {/* Table Content */}
          <div className="p-6">
            {isFetching ? (
              <div className="flex items-center justify-center py-12 gap-3 text-muted-foreground">
                <Loader2 className="h-6 w-6 animate-spin" />
                <span>Loading uploads…</span>
              </div>
            ) : uploads.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <FileUp className="h-12 w-12 mx-auto mb-3 opacity-30" />
                <p className="font-medium">No uploads found</p>
                <p className="text-sm mt-1 opacity-70">
                  {searchQuery || statusFilter !== "all" ? "Try adjusting your filters." : "Click 'New Upload' to get started."}
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {uploads.map((upload) => (
                  <UploadRow
                    key={upload.id}
                    upload={upload}
                    onViewDetail={() => navigate(`/bulk-upload/${upload.id}`)}
                    onReupload={() => {
                      // Reuse the exact "New Upload" behaviour so a failed /
                      // cancelled upload has a one-click path back into the wizard.
                      reset();
                      setShowUploadModal(true);
                    }}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Pagination */}
          {totalPages > 1 && !isFetching && (
            <div className="flex items-center justify-between gap-2 p-6 border-t border-border bg-card/30">
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => setPage(Math.max(1, page - 1))}
                disabled={page === 1}
                className="px-3 py-2 rounded border border-border text-muted-foreground hover:bg-surface disabled:opacity-50 disabled:cursor-not-allowed transition"
              >
                <ChevronLeft className="h-5 w-5" />
              </motion.button>

              <div className="flex items-center gap-1">
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  let pageNum;
                  if (totalPages <= 5) {
                    pageNum = i + 1;
                  } else if (page <= 3) {
                    pageNum = i + 1;
                  } else if (page >= totalPages - 2) {
                    pageNum = totalPages - 4 + i;
                  } else {
                    pageNum = page - 2 + i;
                  }
                  return (
                    <motion.button
                      key={pageNum}
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => setPage(pageNum)}
                      className={`px-3 py-1.5 rounded text-sm font-medium transition ${
                        page === pageNum
                          ? "bg-primary text-foreground"
                          : "border border-border text-muted-foreground hover:bg-surface"
                      }`}
                    >
                      {pageNum}
                    </motion.button>
                  );
                })}
              </div>

              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => setPage(Math.min(totalPages, page + 1))}
                disabled={page === totalPages}
                className="px-3 py-2 rounded border border-border text-muted-foreground hover:bg-surface disabled:opacity-50 disabled:cursor-not-allowed transition"
              >
                <ChevronRight className="h-5 w-5" />
              </motion.button>
            </div>
          )}
        </motion.div>
      </div>

      {/* Upload Modal */}
      {showUploadModal && (
        <div className="fixed inset-0 bg-overlay backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="w-full max-w-2xl max-h-[90vh] overflow-y-auto"
          >
            <BulkUploadWizard
              onSuccess={() => {
                setShowUploadModal(false);
                setPage(1);
                fetchUploads();
                fetchOverallStats();
              }}
              onClose={() => setShowUploadModal(false)}
            />
          </motion.div>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// Sub-components
// ═══════════════════════════════════════════════════════════════════════════

function StatCard({ icon: Icon, label, value, isLoading }) {
  return (
    <motion.div
      variants={{ hidden: { opacity: 0, y: 20 }, visible: { opacity: 1, y: 0 } }}
      className="relative group bg-surface/50 backdrop-blur rounded-2xl p-6
                 border border-border hover:border-primary/50 transition-all
                 duration-300 overflow-hidden"
    >
      <div className="absolute inset-0 bg-gradient-to-br from-primary/10 to-transparent
                      opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
      <div className="relative z-10 flex items-start justify-between">
        <div className="flex-1">
          <p className="text-sm text-muted-foreground font-medium mb-2">{label}</p>
          <p className="text-4xl font-bold text-foreground">{isLoading ? "—" : value}</p>
        </div>
        <div className="p-3 bg-primary/20 rounded-xl group-hover:bg-primary/30 transition-all duration-300">
          <Icon className="h-6 w-6 text-brand-text" />
        </div>
      </div>
    </motion.div>
  );
}

export function UploadRow({ upload, onViewDetail, onReupload }) {
  const navigate = useNavigate();

  // A failed/cancelled upload is TERMINAL. Never leave the "X% complete" bar or
  // an indefinite spinner sitting on it — that reads as still-in-progress to the
  // business user. Show a static state line + a one-click re-upload instead.
  const isTerminalFailure = upload.status === "failed" || upload.status === "cancelled";

  // ── ONE debt, ONE button ──────────────────────────────────────────────────
  //
  // `pay_action` is computed by the serializer and is either "prepaid",
  // "invoice" or null. This row used to decide for itself, from two booleans
  // that were each individually correct:
  //
  //   isPaymentPending = status === payment_pending && payment_path === prepaid
  //   isNetUnpaid      = receivable_is_payable
  //
  // The second one is not a NET test — it never was. It asks "does this batch
  // have a payable invoice", and prepaid batches acquired one the moment
  // `ensure_prepaid_receivable` started raising a proforma at the review gate.
  // So a prepaid batch matched BOTH, rendered "Pay" and "Pay now" side by side,
  // and the two buttons led to two different checkouts that opened two
  // PaymentTransactions against one £392.97.
  //
  // The server answers it now, and `pay_via_gateway` refuses a prepaid batch
  // with USE_BATCH_CHECKOUT, so the button and the endpoint cannot disagree.
  // The `??` branch keeps an older API response working: the field is new, and
  // a dashboard that renders no pay button at all is a worse failure than one
  // that renders the pre-existing pair.
  const payAction =
    upload.pay_action !== undefined
      ? upload.pay_action
      : upload.status === "payment_pending" && upload.payment_path === "prepaid"
        ? "prepaid"
        : upload.receivable_is_payable === true
          ? "invoice"
          : null;

  const isPaymentPending = payAction === "prepaid";
  const isNetUnpaid = payAction === "invoice";

  // Default 0 rather than null: `is_payable` already guarantees a positive
  // balance server-side, and the two fields ship in the same serializer, so this
  // only removes a `null.toFixed()` crash path from the render below.
  const outstanding = upload.outstanding != null ? parseFloat(upload.outstanding) : 0;

  // Settled = a NET invoice paid in full, or a prepaid upload that has cleared
  // payment (prepaid completes only after the charge succeeds).
  const isSettled =
    upload.receivable_status === "paid" ||
    (upload.payment_path === "prepaid" && upload.status === "completed");

  // The batch has processed but nobody has looked at it. Review is the ONLY way
  // forward: offering Pay here would be the payment-before-errors flow the
  // review gate exists to remove.
  const isAwaitingReview = upload.status === "awaiting_review";

  // Still moving. Its bar must show lifecycle progress; every other state shows
  // the outcome. Conflating the two is how a finished 43-row batch with 13
  // successes read "30% complete" forever.
  const isProcessing = ["pending", "processing"].includes(upload.status);

  // `pending` splits in two, and the split is the whole point. A DRAFT was
  // never submitted and needs a human; a QUEUED batch is waiting on a worker and
  // needs nothing. They rendered identically, and that ambiguity was already
  // misdiagnosed once as a dead Celery worker when the truth was that nobody had
  // pressed submit.
  const isDraft = upload.is_draft === true;
  const isQueued = upload.status === "pending" && !isDraft;
  const isRunning = upload.status === "processing";

  // Retry is offered exactly when processing did not finish or produced
  // failures, and never next to a Pay button: the two describe different
  // problems, and showing both asks the customer to diagnose their own batch.
  const canRetry = isTerminalFailure;

  const awaitingPayment = isPaymentPending || isNetUnpaid;
  const style = getStatusColors(upload.status);
  const statusLabel = getStatusLabel(upload.status);
  const successRate = upload.total_rows > 0 ? Math.round((upload.successful / upload.total_rows) * 100) : 0;

  // Owed vs paid, decided in bulkMoney.js. This used to be a bare
  // `computed_total`, which told the customer what the batch cost and never
  // whether any of it had been paid — a settled batch and an unpaid one
  // rendered the same figure in the same colour.
  const moneyLine = bulkMoneyLine(upload);

  return (
    <motion.div
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      className={`group rounded-xl border p-4 transition-all duration-300 cursor-pointer ${
        awaitingPayment
          ? "bg-warning-surface hover:bg-warning-surface border-warning/30"
          : "bg-surface/30 hover:bg-surface/50 border-border"
      }`}
      onClick={onViewDetail}
    >
      {/* ── Layout ────────────────────────────────────────────────────────────
          Desktop keeps the 12-column table row: aligned columns are what make a
          page of batches scannable, and that is the whole job of this screen.

          Mobile is NOT that row stacked. It used to be — five full-width cells
          in source order, so a phone got a ~300px-tall block per batch, and the
          counts (`flex justify-between`) threw their label to the left edge and
          their value to the right edge of a 343px card with nothing between.
          `order-*` puts the two things you actually scan for — the name and the
          money — at the top, and the counts collapse to one line. */}
      <div className="grid grid-cols-1 sm:grid-cols-12 gap-x-4 gap-y-3 sm:items-center">
        {/* Status & Name */}
        <div className="sm:col-span-3 min-w-0 order-1">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${style.dot}`} />
            <h4 className="text-foreground font-semibold truncate">{upload.batch_name || "Unnamed"}</h4>
          </div>
          {/* Two batches for one job are only legible if the second says what
              it continues. Display only -- no query depends on it.
              On its own line: it used to sit beside the name inside one flex
              row, so two truncating siblings competed for the same width and
              both lost. */}
          {upload.corrects_upload && (
            <p className="text-xs text-muted-foreground truncate mt-1 pl-5">
              continues &ldquo;{upload.corrects_upload_name || "an earlier batch"}&rdquo;
            </p>
          )}
          <span
            className={`inline-block mt-2 text-xs px-2.5 py-1 rounded-full font-medium whitespace-nowrap ${style.bg} ${style.text}`}
          >
            {statusLabel}
          </span>
        </div>

        {/* Metrics — one line, not three stretched rows.
            "43 rows · 12 booked · 30 failed" is the same three facts in a
            quarter of the vertical space and reads identically at 343px and at
            1400px, which the justify-between version did not. */}
        <div className="sm:col-span-3 min-w-0 order-3 sm:order-2">
          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 text-xs text-muted-foreground">
            <span>
              <span className="text-foreground font-semibold tabular-nums">{upload.total_rows}</span> rows
            </span>
            <span aria-hidden="true" className="text-muted-foreground">
              ·
            </span>
            <span>
              <span className="text-success font-semibold tabular-nums">{upload.successful || 0}</span> booked
            </span>
            {upload.failed > 0 && (
              <>
                <span aria-hidden="true" className="text-muted-foreground">
                  ·
                </span>
                <span>
                  <span className="text-destructive font-semibold tabular-nums">{upload.failed}</span> failed
                </span>
              </>
            )}
          </div>
        </div>

        {/* Progress Bar (or static terminal-failure state) */}
        <div className="sm:col-span-2 min-w-0 order-4 sm:order-3">
          {isTerminalFailure ? (
            <p
              className={`text-xs font-medium ${
                upload.status === "failed" ? "text-destructive" : "text-muted-foreground"
              }`}
            >
              {upload.status === "failed" ? "Didn't finish processing" : "Never submitted"}
            </p>
          ) : (
            <>
              <div className="w-full bg-surface-hover rounded-full h-1.5 overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${isProcessing ? (upload.progress_pct ?? 0) : successRate}%` }}
                  transition={{ duration: 0.8, ease: "easeOut" }}
                  className="h-full bg-gradient-to-r from-primary to-primary-hover"
                />
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {isDraft
                  ? "Draft — not submitted"
                  : isQueued
                    ? "Queued — waiting for a worker"
                    : isRunning
                      ? `${upload.progress_pct ?? 0}% processed`
                      : `${upload.successful || 0} of ${upload.total_rows || 0} succeeded`}
              </p>
            </>
          )}
        </div>

        {/* Amount & Date. Second in the mobile order, because "what does this
            batch owe" is the question this screen gets opened for. */}
        <div className="sm:col-span-2 min-w-0 order-2 sm:order-4">
          {moneyLine && (
            <div
              className={`text-sm font-semibold ${MONEY_TONE_CLASS[moneyLine.tone]}`}
              data-testid="upload-money-primary"
            >
              {moneyLine.primary}
            </div>
          )}
          {moneyLine?.secondary && (
            <div className="text-xs text-warning/90 mt-0.5" data-testid="upload-money-secondary">
              {moneyLine.secondary}
            </div>
          )}
          <p className="text-xs text-subtle-foreground mt-0.5">
            {formatDistanceToNow(new Date(upload.created_at), { addSuffix: true })}
          </p>
        </div>

        {/* Actions. Wraps rather than overflowing — a payment_pending batch can
            show Pay + View, and a NET one Pay now + View, inside two columns.
            Taller targets on mobile: py-1.5 is a 28px tap target. */}
        <div className="sm:col-span-2 order-5 flex flex-wrap gap-2 sm:justify-end pt-1 sm:pt-0">
          {isDraft && (
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={(e) => {
                e.stopPropagation();
                navigate(`/bulk-upload/${upload.id}`);
              }}
              className="px-3 py-2 sm:py-1.5 whitespace-nowrap bg-primary hover:bg-primary-hover text-primary-foreground rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5"
            >
              <ArrowRight className="h-3.5 w-3.5" />
              Continue setup
            </motion.button>
          )}
          {(isRunning || isQueued) && (
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={(e) => {
                e.stopPropagation();
                navigate(`/bulk-upload/${upload.id}?step=processing`);
              }}
              className="px-3 py-2 sm:py-1.5 whitespace-nowrap bg-surface-hover hover:bg-surface-hover text-foreground rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5"
            >
              <Eye className="h-3.5 w-3.5" />
              View progress
            </motion.button>
          )}
          {isAwaitingReview && (
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={(e) => {
                e.stopPropagation();
                navigate(`/bulk-upload/${upload.id}/review`);
              }}
              className="px-3 py-2 sm:py-1.5 whitespace-nowrap bg-primary hover:bg-primary-hover text-primary-foreground rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5"
            >
              <Eye className="h-3.5 w-3.5" />
              Review
            </motion.button>
          )}
          {isPaymentPending && (
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={(e) => {
                e.stopPropagation();
                navigate(`/pay/bulk/${upload.id}`);
              }}
              className="px-3 py-2 sm:py-1.5 whitespace-nowrap bg-warning hover:bg-warning text-warning-foreground rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5"
            >
              <CreditCard className="h-3.5 w-3.5" />
              Pay
            </motion.button>
          )}
          {isNetUnpaid && (
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={(e) => {
                e.stopPropagation();
                navigate(`/invoices/${upload.receivable_id}?action=pay`);
              }}
              className="px-3 py-2 sm:py-1.5 whitespace-nowrap bg-warning hover:bg-warning text-warning-foreground rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5"
              title={`Pay outstanding balance of £${outstanding.toFixed(2)}`}
            >
              <CreditCard className="h-3.5 w-3.5" />
              Pay now
            </motion.button>
          )}
          {isSettled && !awaitingPayment && (
            <span className="px-3 py-2 sm:py-1.5 whitespace-nowrap bg-success/15 text-success rounded-lg text-xs font-semibold flex items-center gap-1.5">
              <CheckCircle2 className="h-3.5 w-3.5" />
              Settled
            </span>
          )}
          {canRetry && (
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={(e) => {
                e.stopPropagation();
                if (onReupload) onReupload();
                else navigate(`/bulk-upload/${upload.id}`);
              }}
              className="px-3 py-2 sm:py-1.5 whitespace-nowrap bg-destructive/15 hover:bg-destructive/25 text-destructive rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Retry
            </motion.button>
          )}
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={(e) => {
              e.stopPropagation();
              onViewDetail();
            }}
            className="px-3 py-2 sm:py-1.5 whitespace-nowrap bg-primary/20 hover:bg-primary/30 text-brand-text rounded-lg text-xs font-medium transition-all flex items-center gap-1"
          >
            <Eye className="h-3.5 w-3.5" />
            View
          </motion.button>
        </div>
      </div>
    </motion.div>
  );
}
