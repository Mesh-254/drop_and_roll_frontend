/**
 * src/components/business/BulkUploadDashboard.jsx
 * ══════════════════════════════════════════════════════════════════════════════
 * FULL REPLACEMENT of the previous "patch-comment" file.
 *
 * This is a complete, working React component.
 *
 * Key additions vs. original:
 *   • "payment_pending" status badge (amber) in UploadHistoryRow
 *   • "Make Payment (£X.XX)" CTA button for payment_pending + prepaid rows
 *   • Clicking navigates to /pay/bulk/:uploadId (BulkPaymentPage)
 * ══════════════════════════════════════════════════════════════════════════════
 */

import React, { useEffect, useCallback } from "react";
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
  Receipt,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { useAuth } from "../../contexts/AuthContext";
import BulkUploadApi from "../../api/BulkUploadApi";
import BulkUploadWizard from "./BulkUploadWizard";
import { useBulkUpload } from "../../hooks/useBulkUpload";

/**
 * BulkUploadDashboard — main dashboard for bulk uploads.
 *
 * Shows:
 *  - 4-card stats (Total Uploads, Bookings Created, Success Rate, Total Spend)
 *  - Recent uploads history with status filtering
 *  - "Make Payment" prompt for payment_pending prepaid uploads
 *  - Modal-based upload flow via BulkUploadWizard
 */
export default function BulkUploadDashboard() {
  const navigate   = useNavigate();
  const auth       = useAuth();
  const isApproved = auth?.user?.is_approved ?? true;

  const {
    selectedFile,
    validationResult,
    isValidating,
    validateFile,
    isUploading,
    startUpload,
    latestUpload,
    isPolling,
    isAutoNavQueued,
    isWaitingForReceivable,
    manualContinueToPayment,
    uploadError,
    reset,
  } = useBulkUpload();

  const [showUploadModal, setShowUploadModal] = React.useState(false);
  const [statusFilter,    setStatusFilter]    = React.useState("all");
  const [uploads, setUploads] = React.useState([]);
  const [isFetchingStats, setIsFetchingStats] = React.useState(false);

  // Fetch uploads from API
  const fetchUploads = useCallback(async () => {
    setIsFetchingStats(true);
    try {
      const data = await BulkUploadApi.listUploads();
      setUploads(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("[BulkUploadDashboard] Failed to fetch uploads:", err);
      setUploads([]);
    } finally {
      setIsFetchingStats(false);
    }
  }, []);

  useEffect(() => {
    fetchUploads();
  }, [fetchUploads]);

  // Derive stats from uploads data
  const stats = React.useMemo(() => {
    const total_uploads = uploads.length;
    const total_bookings = uploads.reduce((sum, u) => sum + (u.total_rows || 0), 0);
    const successful = uploads.filter(u => u.status === 'completed').length;
    const success_rate_pct = total_uploads > 0 ? Math.round((successful / total_uploads) * 100) : 0;
    const total_spend_gbp = uploads.reduce((sum, u) => sum + (u.total_spend_gbp || 0), 0);
    
    return {
      total_uploads,
      total_bookings,
      success_rate_pct,
      total_spend_gbp,
      bookings_trend_pct: 0, // Placeholder for trend
      success_trend_pct: 0,   // Placeholder for trend
    };
  }, [uploads]);

  const filteredUploads =
    statusFilter === "all"
      ? uploads
      : uploads?.filter?.((u) => u.status === statusFilter) || [];

  if (!isApproved) {
    return (
      <div className="min-h-screen bg-white dark:bg-gray-900 pt-20">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12 text-center">
          <div className="text-6xl mb-4">🔒</div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
            Access Restricted
          </h1>
          <p className="text-gray-600 dark:text-gray-400 max-w-md mx-auto">
            Your account has not yet been approved for bulk uploads. Please
            contact support.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 pt-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">

        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-12"
        >
          <div>
            <h1 className="text-4xl font-bold text-white mb-1">
              Bulk Upload
            </h1>
            <p className="text-slate-400">
              Manage and track your bulk shipments efficiently
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => navigate("/billing")}
              className="px-5 py-3 bg-slate-700/60 hover:bg-slate-600/60 border border-slate-600
                         hover:border-blue-500/50 text-slate-200 hover:text-white rounded-xl
                         font-medium transition-all duration-300 flex items-center gap-2
                         w-full sm:w-auto justify-center"
            >
              <Receipt className="h-5 w-5 text-blue-400" />
              Billing &amp; Invoices
            </motion.button>
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => setShowUploadModal(true)}
              className="px-6 py-3 bg-gradient-to-r from-orange-500 to-orange-600
                         hover:from-orange-600 hover:to-orange-700 text-white rounded-xl
                         font-medium transition-all duration-300 flex items-center gap-2
                         shadow-lg shadow-orange-500/25 w-full sm:w-auto justify-center"
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
          <StatCard
            icon={FileUp}
            label="Total Uploads"
            value={stats?.total_uploads ?? 0}
            isLoading={isFetchingStats}
          />
          <StatCard
            icon={BarChart3}
            label="Bookings Created"
            value={stats?.total_bookings ?? 0}
            trend={stats?.bookings_trend_pct}
            isLoading={isFetchingStats}
          />
          <StatCard
            icon={TrendingUp}
            label="Success Rate"
            value={`${stats?.success_rate_pct ?? 0}%`}
            trend={stats?.success_trend_pct}
            isLoading={isFetchingStats}
          />
          <StatCard
            icon={DollarSign}
            label="Total Spend"
            value={`£${(stats?.total_spend_gbp ?? 0).toFixed(2)}`}
            isLoading={isFetchingStats}
          />
        </motion.div>

        {/* Payment-pending banner (if any uploads need payment) */}
        {uploads?.some?.(
          (u) => u.status === "payment_pending" && u.payment_path === "prepaid"
        ) && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-8 p-4 bg-amber-900/30 border border-amber-700/50 rounded-xl
                       flex flex-col sm:flex-row items-start sm:items-center gap-3"
          >
            <CreditCard className="h-5 w-5 text-amber-400 flex-shrink-0 mt-0.5 sm:mt-0" />
            <div className="flex-1">
              <p className="text-amber-300 font-semibold text-sm">
                You have uploads awaiting payment
              </p>
              <p className="text-amber-400/70 text-xs mt-0.5">
                Complete payment to schedule your deliveries. Bookings are
                reserved and will be confirmed immediately after payment.
              </p>
            </div>
          </motion.div>
        )}

        {/* NET terms billing banner — shown for users who have completed NET uploads */}
        {uploads?.some?.((u) => u.status === "completed" && u.payment_path === "net_terms") && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-8 p-4 bg-blue-900/20 border border-blue-700/40 rounded-xl
                       flex flex-col sm:flex-row items-start sm:items-center gap-3"
          >
            <Receipt className="h-5 w-5 text-blue-400 flex-shrink-0 mt-0.5 sm:mt-0" />
            <div className="flex-1">
              <p className="text-blue-300 font-semibold text-sm">
                NET Terms billing available
              </p>
              <p className="text-blue-400/70 text-xs mt-0.5">
                View your invoices, outstanding balances, and payment history in Billing &amp; Invoices.
              </p>
            </div>
            <button
              onClick={() => navigate("/billing")}
              className="text-blue-300 hover:text-white text-xs font-semibold border border-blue-700/50
                         hover:border-blue-500 px-3 py-1.5 rounded-lg transition-colors shrink-0"
            >
              View Billing →
            </button>
          </motion.div>
        )}

        {/* Upload History */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-slate-800/50 backdrop-blur rounded-2xl border border-slate-700
                     shadow-2xl overflow-hidden"
        >
          {/* Table header + filter */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between
                          gap-4 p-6 border-b border-slate-700">
            <h2 className="text-xl font-bold text-white">Recent Uploads</h2>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-slate-700 border border-slate-600 text-slate-300
                         rounded-lg px-3 py-2 text-sm focus:outline-none
                         focus:border-orange-500 transition"
            >
              <option value="all">All statuses</option>
              <option value="payment_pending">Awaiting Payment</option>
              <option value="completed">Completed</option>
              <option value="processing">Processing</option>
              <option value="partial">Partial</option>
              <option value="failed">Failed</option>
              <option value="pending">Pending</option>
            </select>
          </div>

          <div className="p-6">
            {isFetchingStats ? (
              <div className="flex items-center justify-center py-12 gap-3 text-slate-400">
                <Loader2 className="h-6 w-6 animate-spin" />
                <span>Loading uploads…</span>
              </div>
            ) : filteredUploads.length === 0 ? (
              <div className="text-center py-12 text-slate-400">
                <FileUp className="h-12 w-12 mx-auto mb-3 opacity-30" />
                <p className="font-medium">No uploads found</p>
                <p className="text-sm mt-1 opacity-70">
                  {statusFilter !== "all"
                    ? "Try changing the status filter."
                    : "Click 'New Upload' to get started."}
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredUploads.map((upload) => (
                  <UploadHistoryRow
                    key={upload.id}
                    upload={upload}
                    onViewDetail={() => navigate(`/bulk-upload/${upload.id}`)}
                  />
                ))}
              </div>
            )}
          </div>
        </motion.div>
      </div>

      {/* Upload Modal */}
      {showUploadModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50
                        flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="w-full max-w-2xl max-h-[90vh] overflow-y-auto"
          >
            <BulkUploadWizard
              onSuccess={() => {
                setShowUploadModal(false);
                fetchUploads();
              }}
              onClose={() => setShowUploadModal(false)}
            />
          </motion.div>
        </div>
      )}
    </div>
  );
}

// ─── StatCard ────────────────────────────────────────────────────────────────

function StatCard({ icon: Icon, label, value, trend, isLoading }) {
  return (
    <motion.div
      variants={{ hidden: { opacity: 0, y: 20 }, visible: { opacity: 1, y: 0 } }}
      className="relative group bg-slate-800/50 backdrop-blur rounded-2xl p-6
                 border border-slate-700 hover:border-orange-500/50 transition-all
                 duration-300 overflow-hidden"
    >
      <div className="absolute inset-0 bg-gradient-to-br from-orange-500/10 to-transparent
                      opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
      <div className="relative z-10 flex items-start justify-between">
        <div className="flex-1">
          <p className="text-sm text-slate-400 font-medium mb-2">{label}</p>
          <motion.p
            key={value}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-4xl font-bold text-white"
          >
            {isLoading ? "—" : value}
          </motion.p>
          {trend !== undefined && trend !== null && (
            <p
              className={`text-xs mt-3 font-medium flex items-center gap-1 ${
                trend > 0 ? "text-green-400" : "text-slate-500"
              }`}
            >
              {trend > 0 ? "↑" : "��"} {Math.abs(trend)}% from last month
            </p>
          )}
        </div>
        <div className="p-3 bg-orange-500/20 rounded-xl group-hover:bg-orange-500/30
                        transition-all duration-300">
          <Icon className="h-6 w-6 text-orange-400" />
        </div>
      </div>
    </motion.div>
  );
}

// ─── UploadHistoryRow ─────────────────────────────────────────────────────────

function UploadHistoryRow({ upload, onViewDetail }) {
  const navigate = useNavigate();

  const getStatusStyle = (status) => {
    switch (status) {
      case "completed":
        return { bg: "bg-green-900/30",  text: "text-green-300",  dot: "bg-green-500",  label: "Completed" };
      case "processing":
        return { bg: "bg-blue-900/30",   text: "text-blue-300",   dot: "bg-blue-500",   label: "Processing" };
      case "payment_pending":
        return { bg: "bg-amber-900/30",  text: "text-amber-300",  dot: "bg-amber-500",  label: "Awaiting Payment" };
      case "failed":
        return { bg: "bg-red-900/30",    text: "text-red-300",    dot: "bg-red-500",    label: "Failed" };
      case "partial":
        return { bg: "bg-yellow-900/30", text: "text-yellow-300", dot: "bg-yellow-500", label: "Partial" };
      case "pending":
        return { bg: "bg-yellow-900/30", text: "text-yellow-300", dot: "bg-yellow-500", label: "Pending" };
      default:
        return { bg: "bg-slate-700/30",  text: "text-slate-300",  dot: "bg-slate-500",  label: "Unknown" };
    }
  };

  const isPaymentPending =
    upload.status === "payment_pending" && upload.payment_path === "prepaid";

  const style       = getStatusStyle(upload.status);
  const successRate =
    upload.total_rows > 0
      ? Math.round((upload.successful / upload.total_rows) * 100)
      : 0;

  const amount = upload.computed_total
    ? parseFloat(upload.computed_total).toFixed(2)
    : upload.effective_total
    ? parseFloat(upload.effective_total).toFixed(2)
    : null;

  return (
    <motion.div
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      className={`group rounded-xl border p-4 transition-all duration-300 cursor-pointer ${
        isPaymentPending
          ? "bg-amber-950/20 hover:bg-amber-900/25 border-amber-800/50"
          : "bg-slate-700/30 hover:bg-slate-700/50 border-slate-700"
      }`}
      onClick={onViewDetail}
    >
      <div className="flex items-center justify-between gap-4 flex-wrap">
        {/* Left: name, status, metrics */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 mb-2">
            <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${style.dot}`} />
            <h4 className="text-white font-semibold truncate">
              {upload.batch_name || "Unnamed Batch"}
            </h4>
            <span
              className={`text-xs px-2.5 py-1 rounded-full font-medium whitespace-nowrap
                          ${style.bg} ${style.text}`}
            >
              {style.label}
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-4 text-xs text-slate-400 mb-2">
            <span>{upload.total_rows} rows</span>
            <span>•</span>
            <span className="text-green-400">{upload.successful} ok</span>
            {upload.failed > 0 && (
              <>
                <span>•</span>
                <span className="text-red-400">{upload.failed} failed</span>
              </>
            )}
            {amount && (
              <>
                <span>•</span>
                <span className={isPaymentPending ? "text-amber-400 font-semibold" : "text-slate-400"}>
                  £{amount}
                </span>
              </>
            )}
          </div>

          <div className="w-full bg-slate-600 rounded-full h-1.5 overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${successRate}%` }}
              transition={{ duration: 0.8, ease: "easeOut" }}
              className="h-full bg-gradient-to-r from-orange-500 to-orange-600"
            />
          </div>
        </div>

        {/* Right: date + buttons */}
        <div className="flex flex-col items-end gap-2">
          <span className="text-xs text-slate-500 whitespace-nowrap">
            {formatDistanceToNow(new Date(upload.created_at), { addSuffix: true })}
          </span>

          <div className="flex items-center gap-2">
            {/* Make Payment CTA — only for payment_pending prepaid */}
            {isPaymentPending && (
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={(e) => {
                  e.stopPropagation();
                  navigate(`/pay/bulk/${upload.id}`);
                }}
                className="px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-white
                           rounded-lg text-xs font-semibold transition-all
                           flex items-center gap-1.5 shadow-md shadow-amber-500/20"
              >
                <CreditCard className="h-3 w-3" />
                {amount ? `Pay £${amount}` : "Make Payment"}
              </motion.button>
            )}

            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={(e) => { e.stopPropagation(); onViewDetail(); }}
              className="px-3 py-1.5 bg-orange-500/20 hover:bg-orange-500/30
                         text-orange-300 rounded-lg text-xs font-medium
                         transition-all flex items-center gap-1"
            >
              <Eye className="h-3 w-3" />
              View
            </motion.button>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
