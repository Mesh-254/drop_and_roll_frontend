/**
 * components/business/BulkUploadFlow.jsx
 * ══════════════════════════════════════════════════════════════════════════════
 * The 4-step wizard modal for bulk CSV uploads.
 *
 * Step 0 — File drop zone
 * Step 1 — Batch name + notes form
 * Step 2 — Review & Confirm (triggers validate → submit)
 * Step 3 — Processing / Done
 *
 * ── HOOK SHAPE MIGRATION ────────────────────────────────────────────────────
 *
 * The OLD hook (pre-fix) exported:
 *   file, setFile, currentStep, nextStep, prevStep, uploadProgress,
 *   isUploading, isSubmitting, uploadError, uploadResult, paymentPath,
 *   netDays, processingStatus, latestUpload, errorRows, errorMeta,
 *   errorPage, setErrorPage, isFetchingErrors, isInitiatingPayment,
 *   gatewayPreference, setGatewayPreference, handleFileSelect,
 *   handleValidateAndUpload, handleSubmit, handleDownloadTemplate,
 *   handleDownloadErrorReport, handleInitiatePayment, handleViewInvoice,
 *   fetchErrors, reset, setUploadError
 *
 * The NEW hook (useBulkUpload.js) exports:
 *   selectedFile, validationResult, isValidating, validateFile,
 *   isUploading, startUpload,
 *   latestUpload, isPolling,
 *   isAutoNavQueued, isWaitingForReceivable,
 *   manualContinueToPayment,
 *   uploadError, reset
 *
 * This component now uses ONLY the new hook API.  Wizard step state,
 * batch metadata, and the validate→submit pipeline live here locally,
 * delegating file/upload/polling concerns to the hook.
 *
 * ── STEP 3 LOGIC ─────────────────────────────────────────────────────────────
 *
 * While polling (isPolling):
 *   Animated progress bar + live success/fail counters.
 *
 * When status === 'payment_pending' (PREPAID terminal state):
 *   1. isAutoNavQueued → hook fires auto-navigate within 2-3 s.
 *   2. Manual "Continue to Payment" button always shown as escape hatch
 *      (calls manualContinueToPayment from hook).
 *
 * When status === 'completed' (NET or legacy):
 *   Invoice raised banner.
 *
 * When status === 'failed':
 *   Error state with uploadError message.
 *
 * ── DEFENSIVE OBSERVABILITY ──────────────────────────────────────────────────
 * useEffect watches latestUpload.status changes and logs them in dev.
 * ══════════════════════════════════════════════════════════════════════════════
 */

import React, { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom"; // FIX Bug 1: was missing — caused ReferenceError crash
import { motion, AnimatePresence } from "framer-motion";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Download,
  Loader2,
  X,
} from "lucide-react";
import { useBulkUpload } from "../../hooks/useBulkUpload";
import BulkUploadApi from "../../api/BulkUploadApi";
import FileUploadZone from "./FileUploadZone";
import BulkUploadProgressBar from "./BulkUploadProgressBar";
import ErrorTable from "./ErrorTable";

// ─── Form validation ──────────────────────────────────────────────────────────

const metadataSchema = z.object({
  batchName: z
    .string()
    .min(1, "Batch name is required")
    .max(100, "Must be under 100 characters"),
  notes: z
    .string()
    .max(1000, "Must be under 1,000 characters")
    .optional()
    .or(z.literal("")),
});

// ─── Step labels ──────────────────────────────────────────────────────────────

const STEPS = [
  { label: "Upload File" },
  { label: "Batch Details" },
  { label: "Review & Confirm" },
  { label: "Processing" },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Safely format a Decimal/string total from the backend.
 * effective_total comes back as a Decimal-serialised string e.g. "85.00".
 */
function formatTotal(upload) {
  const raw = upload?.effective_total ?? upload?.computed_total ?? 0;
  const n = parseFloat(raw);
  return isNaN(n) ? "0.00" : n.toFixed(2);
}

/**
 * Derive a display-friendly status from the latestUpload snapshot.
 * Returns one of: "processing" | "payment_pending" | "completed" | "failed"
 */
function deriveStatus(latestUpload, isPolling) {
  if (!latestUpload) return isPolling ? "processing" : null;
  const s = latestUpload.status?.toLowerCase();
  if (s === "payment_pending") return "payment_pending";
  if (s === "completed") return "completed";
  // FIX Bug 2: "partial" is a terminal success for NET — treat same as "completed"
  // so the UI never falls through to "processing" and gets stuck.
  if (s === "partial") return "completed";
  if (s === "failed") return "failed";
  return "processing";
}

// ─────────────────────────────────────────────────────────────────────────────
// BulkUploadFlow component
// ─────────────────────────────────────────────────────────────────────────────

export default function BulkUploadFlow({
  onSuccess = () => {},
  onClose = () => {},
  hook = null,
}) {
  // Allow parent to pass a shared hook instance (recommended) or create own.
  // BulkUploadWizard always passes its hook to avoid duplicate state trees.
  const navigate = useNavigate();
  const h = hook || useBulkUpload();

  // Destructure NEW hook API (see migration note at top of file)
  const {
    selectedFile, // File | null
    validationResult, // result from validate endpoint
    isValidating, // true while validate POST is in-flight
    validateFile, // (file: File) => Promise<void>
    isUploading, // true while create POST is in-flight
    startUpload, // () => Promise<void>  — starts Celery task + polling
    latestUpload, // { id, status, customer_type, success_count, total_amount, ... } | null
    isPolling, // true while poller is running
    isAutoNavQueued, // true as soon as terminal success detected (nav imminent)
    isWaitingForReceivable, // true while polling for AR record (NET flow)
    manualContinueToPayment, // () => void — escape hatch for PREPAID
    manualViewInvoice, // () => void — FIX Bug 4: escape hatch for NET
    uploadError, // string | null
    reset, // () => void — full reset
  } = h;

  // ── Local wizard state ────────────────────────────────────────────────────
  const [currentStep, setCurrentStep] = useState(0);
  const [localError, setLocalError] = useState(null);

  // What to do with references this customer already booked. Defaults to
  // "skip", matching the backend: a needless skip is visible and re-runnable,
  // a needless booking is a real van and a real charge with no undo.
  const [duplicatePolicy, setDuplicatePolicy] = useState("skip");

  const nextStep = () =>
    setCurrentStep((s) => Math.min(s + 1, STEPS.length - 1));
  const prevStep = () => setCurrentStep((s) => Math.max(s - 1, 0));

  // ── React Hook Form for step 1 ────────────────────────────────────────────
  const {
    register,
    handleSubmit: rhfSubmit,
    formState: { errors: formErrors },
  } = useForm({
    resolver: zodResolver(metadataSchema),
    defaultValues: { batchName: "", notes: "" },
  });

  // ── File handling ─────────────────────────────────────────────────────────

  const handleFileSelect = useCallback(
    (file) => {
      setLocalError(null);
      // validateFile updates selectedFile inside the hook
      validateFile(file);
    },
    [validateFile],
  );

  const handleRemoveFile = useCallback(() => {
    // Reset just enough to clear the file; hook.reset() would wipe all state.
    // Since the hook doesn't expose setSelectedFile we call validateFile(null)
    // if it handles null, otherwise reset and stay on step 0.
    reset();
    setCurrentStep(0);
    setLocalError(null);
  }, [reset]);

  // ── Step 1 submit (validate + move to review) ─────────────────────────────

  const handleStep1Continue = rhfSubmit(async () => {
    setLocalError(null);
    if (validationResult) {
      // File was already validated on drop — just advance.
      nextStep();
      return;
    }
    if (selectedFile) {
      // Re-validate (user may have re-uploaded after a reset).
      // validateFile sets validationResult via setState which is async —
      // we cannot read the new value synchronously here.
      // The useEffect below watches validationResult and calls nextStep()
      // once the state update lands, provided we are still on step 1.
      await validateFile(selectedFile);
    }
  });

  // When validation completes (hook sets validationResult), advance to step 2
  // if the user had already clicked "Continue" (i.e. we are still on step 1).
  // This replaces the stale `if (validationResult) nextStep()` that read the
  // pre-await value of React state.
  useEffect(() => {
    if (validationResult && currentStep === 1) {
      nextStep();
    }
    // nextStep is a stable inline arrow — intentionally excluded from deps.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [validationResult]);

  // ── Step 2 submit → step 3 ────────────────────────────────────────────────

  const handleStep2Submit = async () => {
    setLocalError(null);
    try {
      await startUpload({ duplicatePolicy });
      // Only advance to the processing screen if startUpload() succeeded.
      // If it throws, uploadError will be set in the hook and the user stays
      // on step 2 — the wizard must NOT navigate forward to a polling screen
      // that has no upload id to poll.
      nextStep();
    } catch (err) {
      // startUpload already calls setUploadError; we just prevent step advance.
      if (process.env.NODE_ENV === "development") {
        console.error("[BulkUploadFlow] startUpload threw:", err);
      }
    }
  };

  // ── Template download ─────────────────────────────────────────────────────
  // FIX: was pointing at a non-existent static file (/templates/bulk_upload_template.csv)
  // which caused Vite's SPA fallback to serve index.html instead of a real file.
  // Now delegates to BulkUploadApi.downloadTemplate() which calls
  // GET /api/booking/bulk-template/ — the backend generates a live .xlsx with
  // dropdowns sourced from the DB and returns it as an attachment.

  const handleDownloadTemplate = async () => {
    try {
      await BulkUploadApi.downloadTemplate();
    } catch (err) {
      console.error("[BulkUploadFlow] Template download failed:", err);
    }
  };

  // ── Close handler ─────────────────────────────────────────────────────────

  const handleClose = () => {
    reset();
    setCurrentStep(0);
    setLocalError(null);
    onClose();
  };

  // ── Retry handler (terminal FAILED state) ─────────────────────────────────
  // Clears all hook state (poller, latestUpload, errors) and returns the wizard
  // to step 0 WITHOUT closing the modal, so the user can pick a file and try
  // again. Distinct from handleClose, which also fires onClose().
  const handleRetry = () => {
    reset();
    setCurrentStep(0);
    setLocalError(null);
  };

  // ── Derive status for Step 3 rendering ───────────────────────────────────

  const derivedStatus = deriveStatus(latestUpload, isPolling);
  const isPaymentPending = derivedStatus === "payment_pending";
  const isCompleted = derivedStatus === "completed";
  const isFailed = derivedStatus === "failed";
  const isProcessing =
    derivedStatus === "processing" || (!derivedStatus && isPolling);

  // ── Defensive observability: log status changes in dev ────────────────────

  useEffect(() => {
    if (!latestUpload) return;
    if (process.env.NODE_ENV === "development") {
      console.debug(
        `[BulkUploadFlow] latestUpload status changed | id=${latestUpload.id} | status=${latestUpload.status} | customer_type=${latestUpload.customer_type} | isPolling=${isPolling} | isAutoNavQueued=${isAutoNavQueued}`,
      );
    }

    // If we've reached payment_pending and auto-nav is queued, log the
    // expected timing so it's visible in dev tools.
    if (
      latestUpload.status?.toLowerCase() === "payment_pending" &&
      isAutoNavQueued
    ) {
      console.debug(
        "[BulkUploadFlow] Auto-nav is queued — expect redirect within ~2s.",
      );
    }
  }, [latestUpload, isPolling, isAutoNavQueued]);

  // ── Combine errors for display ────────────────────────────────────────────

  const displayError = localError || uploadError || null;

  // ─────────────────────────────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────────────────────────────

  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl overflow-hidden max-w-2xl w-full mx-auto">
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-6 py-5 border-b border-gray-200 dark:border-gray-700">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
          Bulk Upload
        </h2>
        <button
          onClick={handleClose}
          className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          aria-label="Close"
        >
          <X className="h-5 w-5 text-gray-500 dark:text-gray-400" />
        </button>
      </div>

      {/* ── Step indicator ─────────────────────────────────────────────────── */}
      <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between">
          {STEPS.map((step, idx) => (
            <div key={idx} className="flex items-center">
              <div
                className={`flex items-center gap-2 ${idx <= currentStep ? "opacity-100" : "opacity-40"}`}
              >
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-colors ${
                    idx < currentStep
                      ? "bg-green-500 text-white"
                      : idx === currentStep
                        ? "bg-orange-500 text-white"
                        : "bg-gray-200 dark:bg-gray-600 text-gray-600 dark:text-gray-300"
                  }`}
                >
                  {idx < currentStep ? "✓" : idx + 1}
                </div>
                <span className="hidden sm:block text-xs font-medium text-gray-600 dark:text-gray-300">
                  {step.label}
                </span>
              </div>
              {idx < STEPS.length - 1 && (
                <div
                  className={`w-6 sm:w-14 h-0.5 mx-2 transition-colors ${
                    idx < currentStep
                      ? "bg-green-500"
                      : "bg-gray-200 dark:bg-gray-600"
                  }`}
                />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* ── Step content ───────────────────────────────────────────────────── */}
      <div className="px-6 py-6 min-h-[340px]">
        <AnimatePresence mode="wait">
          {/* ════ STEP 0 — File upload ═══════════════════════════════════════ */}
          {currentStep === 0 && (
            <motion.div
              key="step0"
              initial={{ opacity: 0, x: -40 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 40 }}
              transition={{ duration: 0.25 }}
              className="space-y-6"
            >
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">
                  Upload your CSV file
                </h3>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Download our template to see the required format.
                </p>
              </div>

              {/*
               * FIX (hook shape): hook now exposes `selectedFile` (not `file`).
               * FileUploadZone prop is also `selectedFile` — the naming now matches.
               * onRemoveFile calls local handleRemoveFile which resets the hook.
               */}
              <FileUploadZone
                selectedFile={selectedFile}
                onFileSelect={handleFileSelect}
                onRemoveFile={selectedFile ? handleRemoveFile : undefined}
                accept=".csv,.xlsx"
                isLoading={isValidating}
              />

              {displayError && <ErrorBanner error={displayError} />}

              <div className="flex gap-3">
                <button
                  onClick={handleDownloadTemplate}
                  className="flex items-center gap-2 px-4 py-2 text-sm font-medium
                             text-gray-700 dark:text-gray-300 border border-gray-300
                             dark:border-gray-600 rounded-lg hover:bg-gray-50
                             dark:hover:bg-gray-700 transition-colors"
                >
                  <Download className="h-4 w-4" /> Template
                </button>
                <button
                  onClick={nextStep}
                  disabled={!selectedFile || isValidating}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2 text-sm
                             font-semibold text-white bg-orange-500 hover:bg-orange-600
                             disabled:bg-gray-300 dark:disabled:bg-gray-600 rounded-lg
                             transition-colors disabled:cursor-not-allowed"
                >
                  {isValidating ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" /> Checking
                      file…
                    </>
                  ) : (
                    <>
                      Continue <ArrowRight className="h-4 w-4" />
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          )}

          {/* ════ STEP 1 — Batch details ══════════════════════════════════════ */}
          {currentStep === 1 && (
            <motion.div
              key="step1"
              initial={{ opacity: 0, x: 40 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -40 }}
              transition={{ duration: 0.25 }}
              className="space-y-6"
            >
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">
                  Batch details
                </h3>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Give your batch a name so you can find it later.
                </p>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Batch name <span className="text-red-500">*</span>
                  </label>
                  <input
                    {...register("batchName")}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600
                               rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white
                               focus:outline-none focus:ring-2 focus:ring-orange-500 transition"
                    placeholder="e.g. March Week 2 Deliveries"
                  />
                  {formErrors.batchName && (
                    <p className="mt-1 text-xs text-red-500">
                      {formErrors.batchName.message}
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Notes (optional)
                  </label>
                  <textarea
                    {...register("notes")}
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600
                               rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white
                               focus:outline-none focus:ring-2 focus:ring-orange-500 resize-none transition"
                    placeholder="Any special instructions…"
                  />
                  {formErrors.notes && (
                    <p className="mt-1 text-xs text-red-500">
                      {formErrors.notes.message}
                    </p>
                  )}
                </div>
              </div>

              {displayError && <ErrorBanner error={displayError} />}

              <div className="flex gap-3">
                <button
                  onClick={prevStep}
                  className="flex items-center gap-2 px-4 py-2 text-sm font-medium
                             text-gray-700 dark:text-gray-300 border border-gray-300
                             dark:border-gray-600 rounded-lg hover:bg-gray-50
                             dark:hover:bg-gray-700 transition-colors"
                >
                  <ArrowLeft className="h-4 w-4" /> Back
                </button>
                <button
                  onClick={handleStep1Continue}
                  disabled={isValidating}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2 text-sm
                             font-semibold text-white bg-orange-500 hover:bg-orange-600
                             disabled:bg-gray-300 dark:disabled:bg-gray-600 rounded-lg
                             transition-colors disabled:cursor-not-allowed"
                >
                  Validate & Continue <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            </motion.div>
          )}

          {/* ════ STEP 2 — Review & Confirm ══════════════════════════════════ */}
          {currentStep === 2 && (
            <motion.div
              key="step2"
              initial={{ opacity: 0, x: 40 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -40 }}
              transition={{ duration: 0.25 }}
              className="space-y-6"
            >
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">
                  Review & Confirm
                </h3>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Check your upload details before submitting.
                </p>
              </div>

              {validationResult && (
                <div className="space-y-3">
                  <ReviewRow label="File" value={selectedFile?.name} />
                  <ReviewRow
                    label="Valid rows"
                    value={
                      validationResult.valid_rows ?? validationResult.row_count
                    }
                  />
                  {validationResult.error_count > 0 && (
                    <ReviewRow
                      label="Rows with errors"
                      value={validationResult.error_count}
                      valueClass="text-red-500"
                    />
                  )}
                  <ReviewRow
                    label="Estimated total"
                    value={`£${formatTotal(validationResult)}`}
                    valueClass="text-orange-400 font-bold"
                  />
                </div>
              )}

              <DuplicateChoice
                count={validationResult?.duplicate_count || 0}
                references={validationResult?.duplicate_references || []}
                policy={duplicatePolicy}
                onChange={setDuplicatePolicy}
              />

              {displayError && <ErrorBanner error={displayError} />}

              <div className="flex gap-3">
                <button
                  onClick={prevStep}
                  className="flex items-center gap-2 px-4 py-2 text-sm font-medium
                             text-gray-700 dark:text-gray-300 border border-gray-300
                             dark:border-gray-600 rounded-lg hover:bg-gray-50
                             dark:hover:bg-gray-700 transition-colors"
                >
                  <ArrowLeft className="h-4 w-4" /> Back
                </button>
                <button
                  onClick={handleStep2Submit}
                  disabled={isUploading}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2 text-sm
                             font-semibold text-white bg-orange-500 hover:bg-orange-600
                             disabled:bg-gray-300 dark:disabled:bg-gray-600 rounded-lg
                             transition-colors disabled:cursor-not-allowed"
                >
                  {isUploading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" /> Submitting…
                    </>
                  ) : (
                    <>
                      Submit Batch <ArrowRight className="h-4 w-4" />
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          )}

          {/* ════ STEP 3 — Processing ═════════════════════════════════════════ */}
          {currentStep === 3 && (
            <motion.div
              key="step3"
              initial={{ opacity: 0, x: 40 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -40 }}
              transition={{ duration: 0.25 }}
              className="space-y-6"
            >
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">
                  Processing your batch
                </h3>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {isProcessing
                    ? "Please wait while we process your bookings…"
                    : isPaymentPending
                      ? "Bookings created — preparing payment…"
                      : isCompleted
                        ? "Processing complete."
                        : isFailed
                          ? "Processing failed."
                          : ""}
                </p>
              </div>

              {/* Progress bar — always shown in step 3 */}
              <BulkUploadProgressBar
                upload={latestUpload}
                status={isProcessing ? "processing" : derivedStatus}
                highlight={
                  latestUpload?.customer_type?.toUpperCase() === "NET"
                    ? "blue"
                    : "orange"
                }
              />

              {/* ── PAYMENT_PENDING: auto-nav in flight ──────────────────── */}
              {isPaymentPending && isAutoNavQueued && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="flex items-center gap-3 p-4 bg-orange-500/10 border border-orange-500/30 rounded-lg"
                >
                  <Loader2 className="h-5 w-5 animate-spin text-orange-400 flex-shrink-0" />
                  <p className="text-sm text-orange-300 font-medium">
                    Preparing your payment — redirecting shortly…
                  </p>
                </motion.div>
              )}

              {/*
               * ── PAYMENT_PENDING: manual escape hatch ──────────────────────
               * Always shown when status is payment_pending so the user can
               * continue even if the auto-nav timer misbehaves.
               * Calls manualContinueToPayment() which navigates to
               * /pay/bulk/:uploadId (same route as auto-nav).
               */}
              {isPaymentPending && (
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="space-y-3 p-4 bg-green-500/10 border border-green-500/30 rounded-xl"
                >
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-5 w-5 text-green-400 flex-shrink-0" />
                    <p className="text-sm font-semibold text-green-300">
                      Bookings created successfully!
                    </p>
                  </div>
                  {latestUpload?.success_count && (
                    <p className="text-sm text-green-200/80">
                      {latestUpload.success_count} booking
                      {latestUpload.success_count !== 1 ? "s" : ""} ready for
                      payment (£
                      {formatTotal(latestUpload)}).
                    </p>
                  )}
                  <button
                    onClick={manualContinueToPayment}
                    className="w-full flex items-center justify-center gap-2 py-2.5 bg-orange-500
                               hover:bg-orange-600 text-white text-sm font-semibold rounded-lg
                               transition-colors"
                  >
                    Continue to Payment <ArrowRight className="h-4 w-4" />
                  </button>
                </motion.div>
              )}

              {/* ── COMPLETED (NET flow): invoice raised ──────────────────── */}
              {isCompleted && (
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="p-4 bg-blue-900/20 border border-blue-500/30 rounded-xl space-y-3"
                >
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-5 w-5 text-blue-400" />
                    <p className="text-sm font-semibold text-blue-300">
                      Invoice Raised
                    </p>
                  </div>
                  <p className="text-sm text-blue-200/80">
                    Your invoice for{" "}
                    <strong>£{formatTotal(latestUpload)}</strong> has been
                    created. You will receive a confirmation email shortly.
                  </p>
                  {/* FIX Bug 4: manual "View Invoice" escape hatch for NET flow */}
                  {latestUpload?.receivable_id && (
                    <button
                      onClick={manualViewInvoice}
                      className="w-full flex items-center justify-center gap-2 py-2.5 bg-blue-600
                                 hover:bg-blue-700 text-white text-sm font-semibold rounded-lg
                                 transition-colors mt-2"
                    >
                      View Invoice <ArrowRight className="h-4 w-4" />
                    </button>
                  )}
                  <button
                    onClick={() => {
                      handleClose();
                      navigate("/billing");
                    }}
                    className="w-full flex items-center justify-center gap-2 py-2.5 border border-blue-500/40
                               text-blue-300 text-sm font-medium rounded-lg
                               transition-colors hover:bg-blue-500/10"
                  >
                    View Billing &amp; Invoices{" "}
                    <ArrowRight className="h-4 w-4" />
                  </button>
                </motion.div>
              )}

              {/* ── Waiting for receivable (NET interim) ──────────────────── */}
              {isWaitingForReceivable && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="flex items-center gap-3 p-4 bg-blue-500/10 border border-blue-500/30 rounded-lg"
                >
                  <Loader2 className="h-5 w-5 animate-spin text-blue-400 flex-shrink-0" />
                  <p className="text-sm text-blue-300">
                    Generating your invoice — this takes a moment…
                  </p>
                </motion.div>
              )}

              {/* ── FAILED — show error + explicit retry (never a spinner) ─── */}
              {isFailed && (
                <ErrorBanner
                  error={
                    displayError ||
                    "Failed — please retry. If it keeps failing, contact support."
                  }
                />
              )}
              {isFailed && (
                <button
                  onClick={handleRetry}
                  className="w-full flex items-center justify-center gap-2 py-2.5 bg-orange-500
                             hover:bg-orange-600 text-white text-sm font-semibold rounded-lg
                             transition-colors"
                >
                  Retry Upload <ArrowRight className="h-4 w-4" />
                </button>
              )}

              <div className="flex justify-end">
                <button
                  onClick={handleClose}
                  className="px-4 py-2 text-sm font-medium text-gray-600 dark:text-gray-400
                             hover:text-gray-900 dark:hover:text-white transition-colors"
                >
                  Close
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function ErrorBanner({ error }) {
  if (!error) return null;
  const msg =
    typeof error === "string" ? error : error?.message || "An error occurred";
  // Billing-gate rejections (OVERDUE_INVOICES / CREDIT_LIMIT_EXCEEDED) carry
  // a destination so the user can go pay instead of dead-ending here.
  const payUrl =
    typeof error === "object" &&
    (error?.code === "OVERDUE_INVOICES" ||
      error?.code === "CREDIT_LIMIT_EXCEEDED")
      ? error.invoicesUrl || "/business/invoices"
      : null;
  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex items-start gap-3 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg"
    >
      <AlertCircle className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />
      <div className="flex-1">
        <p className="text-sm text-red-700 dark:text-red-400">{msg}</p>
        {payUrl && (
          <a
            href={payUrl}
            className="inline-block mt-2 px-4 py-2 text-sm font-semibold text-white bg-orange-500 hover:bg-orange-600 rounded-lg"
          >
            Pay outstanding invoices
          </a>
        )}
      </div>
    </motion.div>
  );
}

/**
 * DuplicateChoice — the retry-vs-new-batch question.
 *
 * Renders NOTHING when there are no matches, which is the common case: a
 * business sending fresh references every time must never be asked about a
 * problem it does not have.
 *
 * When matches DO exist the question is unavoidable. The same file legitimately
 * means either "I fixed the bad rows, leave the rest alone" or "this is next
 * week's run of the same route", nothing in the file distinguishes them, and
 * guessing wrong in one direction silently skips deliveries while guessing
 * wrong in the other silently books and charges for them twice.
 */
export function DuplicateChoice({ count, references, policy, onChange }) {
  if (!count) return null;

  const shown = references.slice(0, 3).join(", ");
  const more = count > 3 ? `, +${count - 3} more` : "";

  return (
    <div className="rounded-lg border-2 border-amber-400 dark:border-amber-600 bg-amber-50 dark:bg-amber-900/20 p-4">
      <div className="flex gap-3">
        <AlertCircle className="h-5 w-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
        <div className="flex-1">
          <h4 className="font-bold text-amber-800 dark:text-amber-200">
            {count} reference{count === 1 ? "" : "s"} already booked
          </h4>
          <p className="text-sm text-amber-700 dark:text-amber-300 mt-1 mb-3">
            {count === 1
              ? "This reference matches a booking"
              : "These references match bookings"}{" "}
            you already have from the last 30 days:{" "}
            <span className="font-mono">
              {shown}
              {more}
            </span>
          </p>

          <fieldset className="space-y-2">
            <legend className="sr-only">
              What should happen to already-booked references?
            </legend>

            <label className="flex items-start gap-3 p-3 rounded-lg border border-amber-300 dark:border-amber-700/60 cursor-pointer hover:bg-amber-100/60 dark:hover:bg-amber-900/30">
              <input
                type="radio"
                name="duplicate_policy"
                value="skip"
                checked={policy === "skip"}
                onChange={() => onChange("skip")}
                className="mt-1"
              />
              <span>
                <span className="block text-sm font-semibold text-amber-900 dark:text-amber-100">
                  Skip them — I&apos;m re-uploading to fix errors
                </span>
                <span className="block text-xs text-amber-700 dark:text-amber-300/80">
                  The rows that already worked are left alone. Nothing is booked
                  or charged twice.
                </span>
              </span>
            </label>

            <label className="flex items-start gap-3 p-3 rounded-lg border border-amber-300 dark:border-amber-700/60 cursor-pointer hover:bg-amber-100/60 dark:hover:bg-amber-900/30">
              <input
                type="radio"
                name="duplicate_policy"
                value="book_again"
                checked={policy === "book_again"}
                onChange={() => onChange("book_again")}
                className="mt-1"
              />
              <span>
                <span className="block text-sm font-semibold text-amber-900 dark:text-amber-100">
                  Book them again — this is a new batch
                </span>
                <span className="block text-xs text-amber-700 dark:text-amber-300/80">
                  Every row books, including the {count} above, and you are
                  charged for all of them. Use this for a repeat run of the same
                  route.
                </span>
              </span>
            </label>
          </fieldset>

          <p className="text-xs text-amber-600 dark:text-amber-400/70 mt-3">
            A reference repeated twice inside this one file is always skipped,
            whichever you pick.
          </p>
        </div>
      </div>
    </div>
  );
}

function ReviewRow({
  label,
  value,
  valueClass = "text-gray-900 dark:text-white",
}) {
  return (
    <div className="flex justify-between items-center py-2 border-b border-gray-100 dark:border-gray-700 last:border-0">
      <span className="text-sm text-gray-500 dark:text-gray-400">{label}</span>
      <span className={`text-sm font-medium ${valueClass}`}>
        {value ?? "—"}
      </span>
    </div>
  );
}
