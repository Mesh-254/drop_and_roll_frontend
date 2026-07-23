/**
 * src/components/business/BulkUploadDetail.jsx
 * ════════════════════════════════════════════════════════════════════════════════
 *
 * SIGNIFICANTLY ENHANCED for professional SaaS UX
 * ────────────────────────────────────────────────────────────────
 *
 * Key improvements:
 *   • Tabbed interface (Overview, Errors, Successful)
 *   • Rich KPI cards with a prominent, shared-style status badge
 *   • Payment pending banner with CTA
 *   • Comprehensive loading, empty, and error states (incl. permission/404/network)
 *   • Mobile-friendly responsive design
 *   • Live progress while the upload is still processing
 *   • Paginated Successful tab with links into Booking History
 *
 * FIX (critical): this component previously called `useBulkUpload()` — the
 * wizard-flow hook that only ever holds an upload right after the user
 * submits one in this browser tab. Loading `/bulk-upload/:id` directly (a
 * fresh page load, a bookmark, a shared link, a page refresh) left
 * `latestUpload` permanently `null`, so the page showed an infinite loading
 * spinner. It now uses `useBulkUploadDetail(id)`, which fetches the upload
 * (and its error/successful rows) by id from the API.
 */

import React, { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft,
  Download,
  RotateCcw,
  Loader2,
  AlertCircle,
  CheckCircle2,
  CreditCard,
  Clock,
  BarChart3,
  TrendingUp,
  AlertTriangle,
  ExternalLink,
  ServerCrash,
  Lock,
} from "lucide-react";
import toast from "react-hot-toast";
import bookingApi from "../../api/BookingApi";
import { useBulkUploadDetail } from "../../hooks/useBulkUploadDetail";
import { getStatusColors, getStatusLabel } from "../../utils/bulkUploadValidation";
import BulkUploadProgressBar from "./BulkUploadProgressBar";
import ErrorTable from "./ErrorTable";

const STEPS_PREPAID = ["Uploaded", "Processing", "Awaiting Payment", "Completed"];
const STEPS_NET = ["Uploaded", "Processing", "Completed"];

export default function BulkUploadDetail() {
  const navigate = useNavigate();
  const { id } = useParams();

  const {
    upload,
    isLoadingUpload,
    uploadError,
    refetchUpload,
    errorRows,
    errorMeta,
    errorPage,
    setErrorPage,
    isFetchingErrors,
    successfulRows,
    successfulMeta,
    successfulPage,
    setSuccessfulPage,
    isFetchingSuccessful,
    skippedRows,
    handleRetryFailed,
    handleDownloadErrorReport,
    isRetrying,
  } = useBulkUploadDetail(id);

  const [activeTab, setActiveTab] = useState("overview");

  // ─── Derived state ────────────────────────────────────────────────────────
  const isPrepaid = upload?.payment_path === "prepaid";
  const steps = isPrepaid ? STEPS_PREPAID : STEPS_NET;
  const isPaymentPending = upload?.status === "payment_pending" && isPrepaid;

  const amount = upload?.computed_total
    ? parseFloat(upload.computed_total).toFixed(2)
    : upload?.effective_total
      ? parseFloat(upload.effective_total).toFixed(2)
      : null;

  const statusColors = upload ? getStatusColors(upload.status) : null;
  const statusLabel = upload ? getStatusLabel(upload.status) : "";

  // ─── Step status logic ────────────────────────────────────────────────────
  const getStepStatus = (stepIdx) => {
    if (!upload) return "pending";
    const s = upload.status;

    if (isPrepaid) {
      if (stepIdx === 0) return "done";
      if (stepIdx === 1) {
        if (s === "pending" || s === "processing") return "active";
        return "done";
      }
      if (stepIdx === 2) {
        if (s === "payment_pending") return "active";
        if (s === "completed" || s === "partial") return "done";
        if (s === "failed" || s === "cancelled") return "skipped";
        return "pending";
      }
      if (stepIdx === 3) {
        if (s === "completed" || s === "partial") return "done";
        return "pending";
      }
    } else {
      if (stepIdx === 0) return "done";
      if (stepIdx === 1) {
        if (s === "pending" || s === "processing") return "active";
        return "done";
      }
      if (stepIdx === 2) {
        if (s === "completed" || s === "partial" || s === "failed" || s === "cancelled") return "done";
        return "pending";
      }
    }
    return "pending";
  };

  // ─── Loading state (first load only — the hook itself already avoids
  // re-triggering this once `upload` is populated) ──────────────────────────
  if (isLoadingUpload && !upload) {
    return (
      <div className="min-h-screen bg-white dark:bg-gray-900 pt-20">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="h-4 w-40 bg-gray-200 dark:bg-gray-700 rounded animate-pulse mb-8" />
          <div className="h-10 w-2/3 bg-gray-200 dark:bg-gray-700 rounded animate-pulse mb-3" />
          <div className="h-4 w-1/3 bg-gray-200 dark:bg-gray-700 rounded animate-pulse mb-10" />
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="h-24 bg-gray-200 dark:bg-gray-700 rounded-lg animate-pulse" />
            ))}
          </div>
          <div className="flex justify-center pt-8">
            <Loader2 className="h-8 w-8 text-orange-500 animate-spin" />
          </div>
        </div>
      </div>
    );
  }

  // ─── Error state — 404 / permission denied / network failure ─────────────
  if (uploadError || !upload) {
    const isPermission = /permission|403|forbidden/i.test(uploadError || "");
    const isNotFound = /not found|404/i.test(uploadError || "");
    const Icon = isPermission ? Lock : isNotFound ? AlertCircle : ServerCrash;

    return (
      <div className="min-h-screen bg-white dark:bg-gray-900 pt-20">
        <div className="max-w-2xl mx-auto px-4 py-16 text-center">
          <Icon className="h-14 w-14 text-gray-400 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
            {isPermission
              ? "You don't have access to this upload"
              : isNotFound
                ? "Upload not found"
                : "Couldn't load this upload"}
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mb-8">
            {isPermission
              ? "This bulk upload belongs to a different account."
              : isNotFound
                ? "It may have been deleted, or the link may be incorrect."
                : uploadError ||
                  "Something went wrong while fetching this upload. Check your connection and try again."}
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            {!isPermission && !isNotFound && (
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={refetchUpload}
                className="px-5 py-2.5 bg-orange-500 hover:bg-orange-600 text-white rounded-lg font-medium flex items-center justify-center gap-2"
              >
                <RotateCcw className="h-4 w-4" />
                Try again
              </motion.button>
            )}
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => navigate("/bulk-upload")}
              className="px-5 py-2.5 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg font-medium flex items-center justify-center gap-2"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to uploads
            </motion.button>
          </div>
        </div>
      </div>
    );
  }

  // ─── Main render ──────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-white dark:bg-gray-900 pt-20">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Back button */}
        <motion.button
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          onClick={() => navigate("/bulk-upload")}
          className="flex items-center gap-2 text-gray-500 dark:text-gray-400
                     hover:text-gray-900 dark:hover:text-white transition mb-8"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to uploads
        </motion.button>

        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3"
        >
          <div>
            <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 dark:text-white mb-2">
              {upload.batch_name || "Bulk Upload"}
            </h1>
            <p className="text-gray-600 dark:text-gray-400 text-sm">
              Uploaded {new Date(upload.created_at).toLocaleDateString()} at{" "}
              {new Date(upload.created_at).toLocaleTimeString()}
            </p>
          </div>

          {/* Prominent status badge — shares color/label logic with the
             dashboard list so the two views never disagree. */}
          <span
            className={`inline-flex items-center gap-2 self-start px-4 py-2 rounded-full text-sm font-semibold ${statusColors.bg} ${statusColors.text}`}
          >
            <span className={`w-2 h-2 rounded-full ${statusColors.dot}`} />
            {statusLabel}
          </span>
        </motion.div>

        {/* Stepper */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="mb-8"
        >
          <ol className="flex items-center gap-0 overflow-x-auto pb-2">
            {steps.map((label, idx) => {
              const s = getStepStatus(idx);
              const isDone = s === "done";
              const isActive = s === "active";
              return (
                <React.Fragment key={label}>
                  <li className="flex flex-col items-center min-w-[80px]">
                    <div
                      className={`w-8 h-8 rounded-full flex items-center justify-center
                                  text-sm font-bold transition-all ${
                                    isDone
                                      ? "bg-green-500 text-white"
                                      : isActive
                                        ? "bg-orange-500 text-white ring-4 ring-orange-500/20"
                                        : "bg-gray-200 dark:bg-gray-700 text-gray-500"
                                  }`}
                    >
                      {isDone ? "✓" : idx + 1}
                    </div>
                    <p
                      className={`text-xs mt-2 text-center font-medium line-clamp-2 ${
                        isActive
                          ? "text-orange-500"
                          : isDone
                            ? "text-green-600 dark:text-green-400"
                            : "text-gray-400"
                      }`}
                    >
                      {label}
                    </p>
                  </li>
                  {idx < steps.length - 1 && (
                    <div
                      className={`flex-1 h-0.5 mx-1 rounded hidden sm:block ${
                        getStepStatus(idx) === "done"
                          ? "bg-green-400"
                          : "bg-gray-200 dark:bg-gray-700"
                      }`}
                    />
                  )}
                </React.Fragment>
              );
            })}
          </ol>
        </motion.div>

        {/* Status banners */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="mb-8 space-y-4"
        >
          {/* Payment Pending */}
          {isPaymentPending && (
            <div className="p-6 bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800/40 rounded-xl flex flex-col sm:flex-row gap-4 items-start sm:items-center">
              <div className="w-12 h-12 rounded-full bg-amber-100 dark:bg-amber-800/30 flex items-center justify-center flex-shrink-0">
                <Clock className="h-6 w-6 text-amber-600 dark:text-amber-400" />
              </div>
              <div className="flex-1">
                <h3 className="font-bold text-amber-800 dark:text-amber-300 text-lg">
                  Payment Required
                </h3>
                <p className="text-sm text-amber-700 dark:text-amber-400/80 mt-1">
                  Your {upload.successful} booking{upload.successful !== 1 ? "s are" : " is"} processed
                  and reserved. Complete payment to schedule deliveries.
                </p>
                {amount && (
                  <p className="text-lg font-bold text-amber-800 dark:text-amber-300 mt-2">
                    Amount due: £{amount}
                  </p>
                )}
              </div>
              <motion.button
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
                onClick={() => navigate(`/pay/bulk/${upload.id}`)}
                className="w-full sm:w-auto px-6 py-3 bg-amber-500 hover:bg-amber-600 text-white rounded-xl font-bold flex items-center justify-center gap-2 shadow-lg shadow-amber-500/20 transition-all whitespace-nowrap"
              >
                <CreditCard className="h-5 w-5" />
                Pay £{amount || "amount"}
              </motion.button>
            </div>
          )}

          {/* Completed */}
          {upload.status === "completed" && (
            <div className="p-6 bg-green-50 dark:bg-green-900/10 border border-green-200 dark:border-green-900/30 rounded-lg flex gap-4 items-start">
              <CheckCircle2 className="h-6 w-6 text-green-600 dark:text-green-400 flex-shrink-0 mt-0.5" />
              <div>
                <h3 className="font-bold text-green-700 dark:text-green-400 text-lg">
                  All Bookings Created Successfully
                </h3>
                <p className="text-sm text-green-600 dark:text-green-400/80 mt-1">
                  All {upload.total_rows} rows processed. {upload.successful} bookings created and scheduled.
                </p>
                {amount && (
                  <p className="text-sm text-green-600 dark:text-green-400/80 mt-2 font-semibold">
                    Total: £{amount}
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Partial */}
          {upload.status === "partial" && (
            <div className="p-6 bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-900/30 rounded-lg flex gap-4 items-start">
              <AlertTriangle className="h-6 w-6 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
              <div>
                <h3 className="font-bold text-amber-700 dark:text-amber-400 text-lg">
                  {upload.successful} of {upload.total_rows} Rows Processed
                </h3>
                <p className="text-sm text-amber-600 dark:text-amber-400/80 mt-1">
                  {upload.failed} row{upload.failed !== 1 ? "s had" : " had"} errors. Review and retry below.
                </p>
              </div>
            </div>
          )}

          {/* Failed */}
          {upload.status === "failed" && (
            <div className="p-6 bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-900/30 rounded-lg flex gap-4 items-start">
              <AlertCircle className="h-6 w-6 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
              <div>
                <h3 className="font-bold text-red-700 dark:text-red-400 text-lg">
                  Upload Failed
                </h3>
                <p className="text-sm text-red-600 dark:text-red-400/80 mt-1">
                  {upload.total_rows > 0
                    ? "Every row in this file failed validation. Review the errors below, fix the file, and re-upload."
                    : "The upload encountered errors during processing. Please check the details and try again."}
                </p>
              </div>
            </div>
          )}

          {/* Cancelled */}
          {upload.status === "cancelled" && (
            <div className="p-6 bg-gray-50 dark:bg-gray-800/40 border border-gray-200 dark:border-gray-700 rounded-lg flex gap-4 items-start">
              <AlertCircle className="h-6 w-6 text-gray-500 flex-shrink-0 mt-0.5" />
              <div>
                <h3 className="font-bold text-gray-700 dark:text-gray-300 text-lg">Upload Cancelled</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                  This upload was cancelled before it was processed.
                </p>
              </div>
            </div>
          )}

          {/* Processing — live progress, refreshed automatically by the hook */}
          {["pending", "processing"].includes(upload.status) && (
            <BulkUploadProgressBar
              pct={upload.progress_pct || 0}
              label={`Processing: ${(upload.successful || 0) + (upload.failed || 0) + (upload.skipped || 0)} / ${upload.total_rows} rows`}
              status="processing"
            />
          )}
        </motion.div>

        {/* KPI Cards */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4"
        >
          <KPICard label="TOTAL ROWS" value={upload.total_rows || 0} icon={BarChart3} />
          <KPICard label="SUCCESSFUL" value={upload.successful || 0} icon={CheckCircle2} color="green" />
          <KPICard label="FAILED" value={upload.failed || 0} icon={AlertCircle} color="red" />
          <KPICard
            label="TOTAL VALUE"
            value={amount ? `£${amount}` : "—"}
            icon={TrendingUp}
            color={isPaymentPending ? "amber" : "blue"}
          />
        </motion.div>

        {/* Overview progress indicator — always visible, not just while
           actively processing, so the KPI grid and progress bar agree even
           after a page refresh mid- or post-run. */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.18 }}
          className="mb-8"
        >
          <BulkUploadProgressBar
            pct={upload.progress_pct ?? 0}
            label={statusLabel}
            status={
              upload.status === "completed"
                ? "completed"
                : upload.status === "failed"
                  ? "failed"
                  : "processing"
            }
          />
        </motion.div>

        {/* Discount badge */}
        {(upload.bulk_discount_pct || 0) > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="mb-8 p-4 bg-blue-50 dark:bg-blue-900/10 border border-blue-200 dark:border-blue-900/30 rounded-lg text-center"
          >
            <p className="text-sm font-semibold text-blue-700 dark:text-blue-400">
              {upload.bulk_discount_pct}% bulk discount applied
            </p>
          </motion.div>
        )}

        {/* Tabs */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
          className="mb-8"
        >
          <TabSelector
            activeTab={activeTab}
            onTabChange={setActiveTab}
            failedCount={upload.failed || 0}
            successfulCount={upload.successful || 0}
          />
        </motion.div>

        {/* Tab Content */}
        <AnimatePresence mode="wait">
          {activeTab === "overview" && (
            <motion.div
              key="overview"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
            >
              <OverviewTab upload={upload} amount={amount} />
            </motion.div>
          )}

          {activeTab === "errors" && (
            <motion.div
              key="errors"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
            >
              <ErrorsTab
                upload={upload}
                errorRows={errorRows}
                errorMeta={errorMeta}
                errorPage={errorPage}
                onPageChange={setErrorPage}
                isFetching={isFetchingErrors}
                onDownload={handleDownloadErrorReport}
                onRetry={handleRetryFailed}
                isRetrying={isRetrying}
              />
            </motion.div>
          )}

          {activeTab === "successful" && (
            <motion.div
              key="successful"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
            >
              <SuccessfulTab
                upload={upload}
                amount={amount}
                rows={successfulRows}
                meta={successfulMeta}
                page={successfulPage}
                onPageChange={setSuccessfulPage}
                isFetching={isFetchingSuccessful}
                skippedRows={skippedRows}
                onViewBooking={(url) => navigate(url)}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// Sub-components
// ═══════════════════════════════════════════════════════════════════════════

function TabSelector({ activeTab, onTabChange, failedCount, successfulCount }) {
  const tabs = [
    { id: "overview", label: "Overview" },
    { id: "errors", label: `Errors (${failedCount})`, disabled: failedCount === 0 },
    { id: "successful", label: `Successful (${successfulCount})`, disabled: successfulCount === 0 },
  ];

  return (
    <div className="flex gap-2 border-b border-gray-200 dark:border-gray-700 overflow-x-auto">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          onClick={() => !tab.disabled && onTabChange(tab.id)}
          disabled={tab.disabled}
          className={`px-4 py-3 font-medium text-sm whitespace-nowrap border-b-2 transition-all ${
            activeTab === tab.id
              ? "border-orange-500 text-orange-600 dark:text-orange-400"
              : "border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200"
          } ${tab.disabled ? "opacity-50 cursor-not-allowed" : ""}`}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}

function OverviewTab({ upload, amount }) {
  return (
    <div className="space-y-8">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <InfoCard title="Batch Details" items={[
          { label: "Batch Name", value: upload.batch_name || "Unnamed" },
          { label: "Created At", value: new Date(upload.created_at).toLocaleString() },
          { label: "Status", value: getStatusLabel(upload.status) },
        ]} />

        <InfoCard title="Processing Summary" items={[
          { label: "Total Rows", value: upload.total_rows || 0 },
          {
            label: "Success Rate",
            value: upload.total_rows > 0 ? `${Math.round((upload.successful / upload.total_rows) * 100)}%` : "0%",
          },
          {
            label: "Processed At",
            value: upload.processed_at ? new Date(upload.processed_at).toLocaleString() : "In progress...",
          },
          { label: "Total Value", value: amount ? `£${amount}` : "—" },
        ]} />
      </div>

      {upload.notes && (
        <div className="p-4 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg">
          <p className="text-sm text-gray-600 dark:text-gray-400 font-medium mb-2">Notes</p>
          <p className="text-gray-900 dark:text-gray-100">{upload.notes}</p>
        </div>
      )}
    </div>
  );
}

function ErrorsTab({ upload, errorRows, errorMeta, errorPage, onPageChange, isFetching, onDownload, onRetry, isRetrying }) {
  if (upload.failed === 0) {
    return (
      <div className="text-center py-12">
        <CheckCircle2 className="h-12 w-12 text-green-500 mx-auto mb-4 opacity-50" />
        <p className="text-gray-600 dark:text-gray-400 font-medium">No errors — all rows processed successfully!</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <ErrorTable
        errors={errorRows}
        meta={{ ...errorMeta, page: errorPage }}
        onPageChange={onPageChange}
        isLoading={isFetching}
        onDownloadCSV={onDownload}
        onRetry={onRetry}
        isRetrying={isRetrying}
      />
    </div>
  );
}

function SuccessfulTab({ upload, amount, rows, meta, page, onPageChange, isFetching, skippedRows = [], onViewBooking }) {
  // Per-row label download in flight (by row id), and the bulk "download all".
  const [downloadingRow, setDownloadingRow] = useState(null);
  const [downloadingAll, setDownloadingAll] = useState(false);

  const anyLabelReady = rows.some((r) => r.label_status === "ready");

  const handleRowLabel = async (row) => {
    if (row.label_status !== "ready" || !row.booking_id) return;
    setDownloadingRow(row.id ?? row.row_number);
    const res = await bookingApi.downloadBookingLabel(row.booking_id);
    setDownloadingRow(null);
    if (!res.success) toast.error(res.message || "Could not download label.");
  };

  const handleDownloadAll = async () => {
    setDownloadingAll(true);
    const res = await bookingApi.downloadAllBulkLabels(upload.id);
    setDownloadingAll(false);
    if (!res.success) {
      toast.error(res.message || "Could not download labels.");
    } else if (res.pending) {
      toast.success(`Downloaded ${res.ready} label${res.ready === 1 ? "" : "s"}; ${res.pending} still generating.`);
    }
  };

  if (!upload.successful || upload.successful === 0) {
    return (
      <div className="text-center py-12">
        <AlertCircle className="h-12 w-12 text-gray-400 mx-auto mb-4 opacity-50" />
        <p className="text-gray-600 dark:text-gray-400 font-medium">No successful bookings in this upload.</p>
      </div>
    );
  }

  const pageSize = meta?.page_size || 25;
  const totalPages = meta?.total ? Math.ceil(meta.total / pageSize) : 1;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <InfoCard title="Success Stats" items={[
          { label: "Bookings Created", value: upload.successful },
          {
            label: "Success Rate",
            value: upload.total_rows > 0 ? `${Math.round((upload.successful / upload.total_rows) * 100)}%` : "0%",
          },
          { label: "Total Value", value: amount ? `£${amount}` : "—" },
        ]} />
      </div>

      {/* Download All Labels — appears once at least one label is ready. */}
      {anyLabelReady && (
        <div className="flex justify-end">
          <button
            type="button"
            onClick={handleDownloadAll}
            disabled={downloadingAll}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-orange-600 hover:bg-orange-700 disabled:opacity-60 disabled:cursor-not-allowed text-white text-sm font-semibold transition-colors"
          >
            {downloadingAll ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Download className="h-4 w-4" />
            )}
            Download All Labels
          </button>
        </div>
      )}

      <div className="p-4 bg-green-50 dark:bg-green-900/10 border border-green-200 dark:border-green-900/30 rounded-lg flex items-start gap-3">
        <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400 flex-shrink-0 mt-0.5" />
        <p className="text-sm text-green-700 dark:text-green-400">
          {upload.successful} booking{upload.successful !== 1 ? "s have" : " has"} been created and are ready for
          scheduling. Tap a row below to jump to it in Booking History.
          {(upload.skipped || 0) > 0 && (
            <>
              {" "}
              <span className="text-amber-700 dark:text-amber-400">
                {upload.skipped} row{upload.skipped !== 1 ? "s" : ""} matched an existing booking (duplicate reference)
                and did not create a new one — see below.
              </span>
            </>
          )}
        </p>
      </div>

      {/* Successful rows table */}
      <div className="overflow-x-auto border border-gray-200 dark:border-gray-700 rounded-lg">
        {isFetching && rows.length === 0 ? (
          <div className="space-y-2 p-4">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-12 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
            ))}
          </div>
        ) : rows.length === 0 ? (
          <div className="p-8 text-center text-gray-500 dark:text-gray-400 text-sm">
            No successful rows to show on this page.
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 w-16">Row</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 dark:text-gray-300">Tracking #</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 hidden md:table-cell">Route</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-700 dark:text-gray-300">Price</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-gray-700 dark:text-gray-300 w-28">Label</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-gray-700 dark:text-gray-300 w-24">Booking</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr
                  key={row.id ?? row.row_number}
                  className="border-b border-gray-200 dark:border-gray-700 hover:bg-green-50 dark:hover:bg-green-900/10 transition-colors"
                >
                  <td className="px-4 py-3 text-sm font-mono text-gray-500 dark:text-gray-400">{row.row_number}</td>
                  <td className="px-4 py-3 text-sm font-mono text-gray-700 dark:text-gray-300">
                    {row.tracking_number || "—"}
                    {Array.isArray(row.warnings) && row.warnings.length > 0 && (
                      <span
                        title={row.warnings.join("\n")}
                        className="ml-2 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wide bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 align-middle"
                      >
                        <AlertTriangle className="h-3 w-3" />
                        Substituted default
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-600 dark:text-gray-400 hidden md:table-cell">
                    {row.pickup_city || "—"} → {row.dropoff_city || "—"}
                  </td>
                  <td className="px-4 py-3 text-sm text-right font-medium text-gray-900 dark:text-white">
                    {row.computed_price ? `£${parseFloat(row.computed_price).toFixed(2)}` : "—"}
                  </td>
                  <td className="px-4 py-3 text-center">
                    {row.label_status === "ready" ? (
                      <button
                        onClick={() => handleRowLabel(row)}
                        disabled={downloadingRow === (row.id ?? row.row_number)}
                        title="Download shipping label"
                        className="inline-flex items-center gap-1 text-xs font-medium text-orange-600 dark:text-orange-400 hover:underline disabled:opacity-60"
                      >
                        {downloadingRow === (row.id ?? row.row_number) ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          <Download className="h-3 w-3" />
                        )}
                        Label
                      </button>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-xs text-gray-400" title="Label still generating">
                        <Loader2 className="h-3 w-3 animate-spin" />
                        Pending
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-center">
                    {row.booking_url ? (
                      <button
                        onClick={() => onViewBooking(row.booking_url)}
                        className="inline-flex items-center gap-1 text-xs font-medium text-orange-600 dark:text-orange-400 hover:underline"
                      >
                        View <ExternalLink className="h-3 w-3" />
                      </button>
                    ) : (
                      <span className="text-xs text-gray-400">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <button
            onClick={() => onPageChange(Math.max(1, page - 1))}
            disabled={page === 1}
            className="px-3 py-2 rounded border border-gray-300 dark:border-gray-600 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700/50 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
          >
            ← Prev
          </button>
          <span className="text-sm text-gray-600 dark:text-gray-400 px-2">
            Page {page} of {totalPages}
          </span>
          <button
            onClick={() => onPageChange(Math.min(totalPages, page + 1))}
            disabled={page === totalPages}
            className="px-3 py-2 rounded border border-gray-300 dark:border-gray-600 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700/50 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
          >
            Next →
          </button>
        </div>
      )}

      {/* Matched existing bookings (skipped duplicate references) — shown
          distinctly so they are never mistaken for newly-created bookings and
          never counted in "Bookings Created". */}
      {skippedRows.length > 0 && (
        <div className="mt-8">
          <div className="flex items-center gap-2 mb-3">
            <h4 className="text-sm font-semibold text-amber-700 dark:text-amber-400">
              Matched existing bookings ({skippedRows.length})
            </h4>
          </div>
          <div className="p-4 bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-900/30 rounded-lg mb-3">
            <p className="text-sm text-amber-700 dark:text-amber-400">
              These rows reused a <span className="font-mono">reference</span> already present in this batch, so they
              matched the booking created by the first occurrence. No new booking was created for them, and they are not
              billed.
            </p>
          </div>
          <div className="overflow-x-auto border border-amber-200 dark:border-amber-900/30 rounded-lg">
            <table className="w-full">
              <thead>
                <tr className="border-b border-amber-200 dark:border-amber-900/30 bg-amber-50 dark:bg-amber-900/10">
                  <th className="px-4 py-3 text-left text-xs font-semibold text-amber-800 dark:text-amber-300 w-16">Row</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-amber-800 dark:text-amber-300">Reference</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-amber-800 dark:text-amber-300">Outcome</th>
                </tr>
              </thead>
              <tbody>
                {skippedRows.map((row) => (
                  <tr key={row.id ?? row.row_number} className="border-b border-amber-100 dark:border-amber-900/20">
                    <td className="px-4 py-3 text-sm font-mono text-gray-500 dark:text-gray-400">{row.row_number}</td>
                    <td className="px-4 py-3 text-sm font-mono text-gray-700 dark:text-gray-300">
                      {row.row_reference || "—"}
                    </td>
                    <td className="px-4 py-3 text-xs text-amber-700 dark:text-amber-400">
                      <span className="inline-flex items-center gap-1">
                        <AlertTriangle className="h-3 w-3" />
                        Matched existing booking — no new booking created
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function KPICard({ label, value, icon: Icon, color = "default" }) {
  const colors = {
    default: "bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white",
    green: "bg-green-50 dark:bg-green-900/10 text-green-600 dark:text-green-400",
    red: "bg-red-50 dark:bg-red-900/10 text-red-600 dark:text-red-400",
    blue: "bg-blue-50 dark:bg-blue-900/10 text-blue-600 dark:text-blue-400",
    amber: "bg-amber-50 dark:bg-amber-900/10 text-amber-600 dark:text-amber-400",
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className={`p-4 rounded-lg border ${colors[color]} transition-all`}
    >
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-semibold uppercase opacity-70 mb-1">{label}</p>
          <p className="text-2xl font-bold">{value}</p>
        </div>
        <Icon className="h-5 w-5 opacity-40" />
      </div>
    </motion.div>
  );
}

function InfoCard({ title, items }) {
  return (
    <div className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-800/50">
      <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">{title}</h4>
      <div className="space-y-2">
        {items.map((item, idx) => (
          <div key={idx} className="flex justify-between items-start">
            <span className="text-xs text-gray-600 dark:text-gray-400">{item.label}</span>
            <span className="text-sm font-medium text-gray-900 dark:text-white text-right">{item.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
