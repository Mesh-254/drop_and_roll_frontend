/**
 * src/components/business/BulkUploadDetail.jsx
 * ══════════════════════════════════════════════════════════════════════════════
 * FULL REPLACEMENT — adds payment_pending banner + Make Payment CTA.
 *
 * Key changes vs. original:
 *   • getStepStatus() now treats payment_pending as a distinct 4th step
 *   • Prominent amber banner when status === "payment_pending"
 *   • Large "Make Payment (£X.XX)" button that navigates to /pay/bulk/:id
 * ══════════════════════════════════════════════════════════════════════════════
 */

import React, { useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  Download,
  RotateCcw,
  Loader2,
  AlertCircle,
  CheckCircle2,
  CreditCard,
  Clock,
} from "lucide-react";
import { useBulkUpload } from "../../hooks/useBulkUpload";
import BulkUploadProgressBar from "./BulkUploadProgressBar";
import ErrorTable from "./ErrorTable";

/**
 * Status steps for the stepper component.
 * payment_pending is inserted as step 2 for PREPAID uploads.
 */
const STEPS_PREPAID = [
  "Uploaded",
  "Processing",
  "Awaiting Payment",
  "Completed",
];
const STEPS_NET = ["Uploaded", "Processing", "Completed"];

export default function BulkUploadDetail() {
  const navigate = useNavigate();
  const { id } = useParams();

  const {
    latestUpload,
    errorRows,
    errorMeta,
    errorPage,
    setErrorPage,
    isFetchingErrors,
    handleRetryFailed,
    handleDownloadErrorReport,
  } = useBulkUpload();

  // Poll for status changes while processing
  useEffect(() => {
    if (!id) return;
    // useBulkUpload polling handles live updates via fetchUploadStatus
  }, [id]);

  // ── Stepper logic ──────────────────────────────────────────────────────────
  const isPrepaid = latestUpload?.payment_path === "prepaid";
  const steps = isPrepaid ? STEPS_PREPAID : STEPS_NET;

  const getStepStatus = (stepIdx) => {
    if (!latestUpload) return "pending";
    const s = latestUpload.status;

    if (isPrepaid) {
      // 0:Uploaded  1:Processing  2:Awaiting Payment  3:Completed
      if (stepIdx === 0) return "done";
      if (stepIdx === 1) {
        if (s === "pending" || s === "processing") return "active";
        return "done";
      }
      if (stepIdx === 2) {
        if (s === "payment_pending") return "active";
        if (s === "completed" || s === "partial") return "done";
        if (s === "failed") return "skipped";
        return "pending";
      }
      if (stepIdx === 3) {
        if (s === "completed" || s === "partial") return "done";
        return "pending";
      }
    } else {
      // 0:Uploaded  1:Processing  2:Completed
      if (stepIdx === 0) return "done";
      if (stepIdx === 1) {
        if (s === "pending" || s === "processing") return "active";
        return "done";
      }
      if (stepIdx === 2) {
        if (s === "completed" || s === "partial" || s === "failed")
          return "done";
        return "pending";
      }
    }
    return "pending";
  };

  // ── Loading ────────────────────────────────────────────────────────────────
  if (!latestUpload) {
    return (
      <div className="min-h-screen bg-white dark:bg-gray-900 pt-20">
        <div className="max-w-6xl mx-auto px-4 py-12 flex items-center justify-center">
          <div className="text-center">
            <Loader2 className="h-10 w-10 text-orange-500 animate-spin mx-auto mb-4" />
            <p className="text-gray-500 dark:text-gray-400">
              Loading upload details…
            </p>
          </div>
        </div>
      </div>
    );
  }

  const amount = latestUpload.computed_total
    ? parseFloat(latestUpload.computed_total).toFixed(2)
    : latestUpload.effective_total
      ? parseFloat(latestUpload.effective_total).toFixed(2)
      : null;

  const isPaymentPending =
    latestUpload.status === "payment_pending" && isPrepaid;

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-white dark:bg-gray-900 pt-20">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Back button */}
        <button
          onClick={() => navigate("/bulk-upload")}
          className="flex items-center gap-2 text-gray-500 dark:text-gray-400
                     hover:text-gray-900 dark:hover:text-white transition mb-8"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to dashboard
        </button>

        {/* Stepper */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <ol className="flex items-center gap-0 overflow-x-auto">
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
                      className={`text-xs mt-1.5 text-center font-medium ${
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
                      className={`flex-1 h-0.5 mx-1 rounded ${
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

        {/* ── Status banners ─────────────────────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="mb-8"
        >
          {/* PAYMENT PENDING — amber, prominent */}
          {isPaymentPending && (
            <div
              className="p-6 bg-amber-50 dark:bg-amber-900/10 border border-amber-200
                            dark:border-amber-800/40 rounded-xl flex flex-col sm:flex-row
                            gap-4 items-start sm:items-center"
            >
              <div
                className="w-12 h-12 rounded-full bg-amber-100 dark:bg-amber-800/30
                              flex items-center justify-center flex-shrink-0"
              >
                <Clock className="h-6 w-6 text-amber-600 dark:text-amber-400" />
              </div>
              <div className="flex-1">
                <h3 className="font-bold text-amber-800 dark:text-amber-300 text-lg">
                  Payment Required
                </h3>
                <p className="text-sm text-amber-700 dark:text-amber-400/80 mt-1">
                  Your {latestUpload.successful} booking
                  {latestUpload.successful !== 1 ? "s are" : " is"} processed
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
                onClick={() => navigate(`/pay/bulk/${latestUpload.id}`)}
                className="w-full sm:w-auto px-6 py-3 bg-amber-500 hover:bg-amber-600
                           text-white rounded-xl font-bold flex items-center justify-center
                           gap-2 shadow-lg shadow-amber-500/20 transition-all whitespace-nowrap"
              >
                <CreditCard className="h-5 w-5" />
                {amount ? `Pay £${amount}` : "Complete Payment"}
              </motion.button>
            </div>
          )}

          {/* COMPLETED */}
          {latestUpload.status === "completed" && (
            <div
              className="p-6 bg-green-50 dark:bg-green-900/10 border border-green-200
                            dark:border-green-900/30 rounded-lg flex gap-4 items-start"
            >
              <CheckCircle2 className="h-6 w-6 text-green-600 dark:text-green-400 flex-shrink-0 mt-0.5" />
              <div>
                <h3 className="font-bold text-green-700 dark:text-green-400 text-lg">
                  Upload Completed Successfully
                </h3>
                <p className="text-sm text-green-600 dark:text-green-400/80 mt-1">
                  All {latestUpload.total_rows} rows processed and{" "}
                  {latestUpload.successful} bookings created and scheduled.
                </p>
                {amount && (
                  <p className="text-sm text-green-600 dark:text-green-400/80 mt-2 font-semibold">
                    Total: £{amount}
                  </p>
                )}
              </div>
            </div>
          )}

          {/* PARTIAL / FAILED */}
          {["partial", "failed"].includes(latestUpload.status) && (
            <div
              className={`p-6 rounded-lg flex gap-4 items-start ${
                latestUpload.status === "partial"
                  ? "bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-900/30"
                  : "bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-900/30"
              }`}
            >
              <AlertCircle
                className={`h-6 w-6 flex-shrink-0 mt-0.5 ${
                  latestUpload.status === "partial"
                    ? "text-amber-600 dark:text-amber-400"
                    : "text-red-600 dark:text-red-400"
                }`}
              />
              <div>
                <h3
                  className={`font-bold text-lg ${
                    latestUpload.status === "partial"
                      ? "text-amber-700 dark:text-amber-400"
                      : "text-red-700 dark:text-red-400"
                  }`}
                >
                  {latestUpload.successful} / {latestUpload.total_rows} Rows
                  Processed
                </h3>
                <p
                  className={`text-sm mt-1 ${
                    latestUpload.status === "partial"
                      ? "text-amber-600 dark:text-amber-400/80"
                      : "text-red-600 dark:text-red-400/80"
                  }`}
                >
                  {latestUpload.failed} rows had errors. Please review and
                  retry.
                </p>
              </div>
            </div>
          )}

          {/* PENDING / PROCESSING */}
          {["pending", "processing"].includes(latestUpload.status) && (
            <BulkUploadProgressBar
              pct={latestUpload.progress_pct || 0}
              label={`Processing: ${latestUpload.processed || 0} / ${latestUpload.total_rows} rows`}
              status="processing"
            />
          )}
        </motion.div>

        {/* Stats Grid */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8"
        >
          <StatBox
            label="TOTAL ROWS"
            value={latestUpload.total_rows}
            color="default"
          />
          <StatBox
            label="SUCCESSFUL"
            value={latestUpload.successful || 0}
            color="green"
          />
          <StatBox
            label="FAILED"
            value={latestUpload.failed || 0}
            color="red"
          />
          {amount && (
            <StatBox
              label="AMOUNT"
              value={`£${amount}`}
              color={isPaymentPending ? "amber" : "blue"}
            />
          )}
        </motion.div>

        {/* Discount badge */}
        {latestUpload.bulk_discount_pct > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="mb-8 p-3 bg-blue-50 dark:bg-blue-900/10 border border-blue-200
                       dark:border-blue-900/30 rounded-lg text-center"
          >
            <p className="text-sm font-semibold text-blue-700 dark:text-blue-400">
              💸 {latestUpload.bulk_discount_pct}% bulk discount applied
            </p>
          </motion.div>
        )}

        {/* Error table */}
        {latestUpload.failed > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="mb-8"
          >
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
              Failed Rows
            </h2>
            <ErrorTable
              errors={errorRows}
              meta={errorMeta}
              onPageChange={setErrorPage}
              isLoading={isFetchingErrors}
              onDownloadCSV={handleDownloadErrorReport}
              onRetry={handleRetryFailed}
              isRetrying={false}
            />
          </motion.div>
        )}

        {/* Action buttons */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="flex flex-col sm:flex-row gap-3 items-start"
        >
          {latestUpload.failed > 0 && (
            <>
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={handleDownloadErrorReport}
                className="flex-1 sm:flex-none px-4 py-2.5 border border-gray-300
                           dark:border-gray-600 text-gray-700 dark:text-gray-300
                           hover:bg-gray-50 dark:hover:bg-gray-700/50 rounded-lg font-medium
                           flex items-center justify-center gap-2 transition-all"
              >
                <Download className="h-5 w-5" />
                Download Error Report
              </motion.button>

              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={handleRetryFailed}
                className="flex-1 sm:flex-none px-4 py-2.5 bg-orange-500
                           hover:bg-orange-600 text-white rounded-lg font-medium
                           flex items-center justify-center gap-2 transition-all"
              >
                <RotateCcw className="h-5 w-5" />
                Retry Failed Rows
              </motion.button>
            </>
          )}
        </motion.div>
      </div>
    </div>
  );
}

function StatBox({ label, value, color = "default" }) {
  const colors = {
    default:
      "bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white label:text-gray-600 dark:label:text-gray-400",
    green:
      "bg-green-50 dark:bg-green-900/10 border-green-200 dark:border-green-900/30 text-green-600 dark:text-green-400",
    red: "bg-red-50 dark:bg-red-900/10 border-red-200 dark:border-red-900/30 text-red-600 dark:text-red-400",
    blue: "bg-blue-50 dark:bg-blue-900/10 border-blue-200 dark:border-blue-900/30 text-blue-600 dark:text-blue-400",
    amber:
      "bg-amber-50 dark:bg-amber-900/10 border-amber-200 dark:border-amber-800/40 text-amber-600 dark:text-amber-400",
  };
  const labelColors = {
    default: "text-gray-600 dark:text-gray-400",
    green: "text-green-700 dark:text-green-400",
    red: "text-red-700 dark:text-red-400",
    blue: "text-blue-700 dark:text-blue-400",
    amber: "text-amber-700 dark:text-amber-300",
  };
  return (
    <div className={`p-4 rounded-lg border ${colors[color]}`}>
      <p className={`text-xs font-semibold mb-1 ${labelColors[color]}`}>
        {label}
      </p>
      <p className="text-2xl font-bold">{value}</p>
    </div>
  );
}
