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
import { ConfirmUploadChoice } from "./ConfirmUploadChoice";
import { confirmPayload, isConfirmIncomplete } from "./confirmChoice";
import BulkUploadReviewPage from "./BulkUploadReviewPage";
import { STEPS, REVIEW_STEP, deriveStatus, stepForStatus } from "./bulkUploadSteps";
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

  // ONE question at Review & Confirm: "a new batch, or corrections to an earlier
  // upload?" It used to be two — that, and "skip the already-booked rows or book
  // them again" directly below it — which is the same question in different
  // words, since choosing corrections already answers skip-or-book-again.
  //
  // `null` until the customer picks. See confirmChoice.resolveKind for when that
  // resolves to a default and why it cannot when money is at stake.
  const [uploadKind, setUploadKind] = useState(null);
  const [correctsUpload, setCorrectsUpload] = useState("");
  const [correctable, setCorrectable] = useState([]);

  const duplicateCount = validationResult?.duplicate_count || 0;

  // Only gates the step when there is actually something to ask about, so a
  // clean file is never slowed down by a question it does not have.
  const confirmIncomplete = isConfirmIncomplete({
    kind: uploadKind,
    correctsUpload,
    duplicateCount,
  });

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

  // Load the correctable batches when the confirm step opens.
  //
  // Failing open on purpose: if this request fails, the list is empty, the
  // picker says so, and a NEW batch still submits normally. A picker outage must
  // never block an ordinary upload, which is the overwhelmingly common case.
  useEffect(() => {
    if (currentStep !== 2) return;
    let cancelled = false;
    BulkUploadApi.listCorrectable()
      .then((data) => {
        if (!cancelled) setCorrectable(data?.results || []);
      })
      .catch(() => {
        if (!cancelled) setCorrectable([]);
      });
    return () => {
      cancelled = true;
    };
  }, [currentStep]);

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
      await startUpload(
        confirmPayload({ kind: uploadKind, correctsUpload, duplicateCount }),
      );
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

  // Move to the Review step when processing lands. Without this the wizard sat
  // on "Please wait while we process your bookings…" over a finished batch,
  // with Close as the only way forward and the Review screen reachable only
  // from the dashboard.
  useEffect(() => {
    const target = stepForStatus(derivedStatus);
    if (target !== null) setCurrentStep((s) => (s < target ? target : s));
  }, [derivedStatus]);

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
    <div className="bg-card dark:bg-surface rounded-2xl shadow-2xl overflow-hidden max-w-2xl w-full mx-auto">
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-6 py-5 border-b border-border">
        <h2 className="text-2xl font-bold text-foreground">
          Bulk Upload
        </h2>
        <button
          onClick={handleClose}
          className="p-2 rounded-full hover:bg-muted dark:hover:bg-surface-hover transition-colors"
          aria-label="Close"
        >
          <X className="h-5 w-5 text-subtle-foreground dark:text-muted-foreground" />
        </button>
      </div>

      {/* ── Step indicator ───────────────────────────────────────────────────
          THE FIFTH STEP USED TO BE CUT IN HALF. Each step and its trailing
          connector were one flex child with FIXED widths — a 32px circle, a
          label, and a `w-14` rule — inside a card that is `max-w-2xl` and
          `overflow-hidden`. Five of those exceed the 592px of content width the
          modal actually has at any viewport, so the row was clipped at the right
          edge and the customer's current step was the half that vanished.

          Labels now sit UNDER their circle instead of beside it, which removes
          the horizontal pressure entirely, and the connectors are `flex-1` so
          they absorb whatever slack is left rather than demanding a fixed size.
          The row now fits by construction at every width instead of by
          arithmetic that happened to hold until a fifth step was added. */}
      <div className="px-6 py-4 border-b border-border">
        <div className="flex items-start" role="list" aria-label="Upload progress">
          {STEPS.map((step, idx) => (
            <React.Fragment key={idx}>
              <div
                role="listitem"
                aria-current={idx === currentStep ? "step" : undefined}
                className={`flex flex-col items-center gap-1.5 flex-shrink-0 w-8 sm:w-20 ${
                  idx <= currentStep ? "opacity-100" : "opacity-40"
                }`}
              >
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-colors ${
                    idx < currentStep
                      ? "bg-success text-foreground"
                      : idx === currentStep
                        ? "bg-primary text-foreground"
                        : "bg-surface-hover text-muted-foreground"
                  }`}
                >
                  {idx < currentStep ? "✓" : idx + 1}
                </div>
                {/* Hidden below sm, where five labels cannot fit however they
                    are arranged. The circles still carry the position, and the
                    step's own heading names it on screen. */}
                <span className="hidden sm:block text-[11px] leading-tight text-center font-medium text-muted-foreground">
                  {step.label}
                </span>
              </div>
              {idx < STEPS.length - 1 && (
                <div
                  aria-hidden="true"
                  className={`flex-1 h-0.5 mt-4 mx-1 sm:mx-1.5 transition-colors ${
                    idx < currentStep ? "bg-success" : "bg-surface-hover"
                  }`}
                />
              )}
            </React.Fragment>
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
                <h3 className="text-lg font-semibold text-foreground mb-1">
                  Upload your CSV file
                </h3>
                <p className="text-sm text-subtle-foreground dark:text-muted-foreground">
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
                             text-muted-foreground border border-border-strong rounded-lg hover:bg-muted
                             dark:hover:bg-surface-hover transition-colors"
                >
                  <Download className="h-4 w-4" /> Template
                </button>
                <button
                  onClick={nextStep}
                  disabled={!selectedFile || isValidating}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2 text-sm
                             font-semibold text-primary-foreground bg-primary hover:bg-primary-hover
                             disabled:bg-surface-hover rounded-lg
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
                <h3 className="text-lg font-semibold text-foreground mb-1">
                  Batch details
                </h3>
                <p className="text-sm text-subtle-foreground dark:text-muted-foreground">
                  Give your batch a name so you can find it later.
                </p>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-muted-foreground mb-1">
                    Batch name <span className="text-destructive">*</span>
                  </label>
                  <input
                    {...register("batchName")}
                    className="w-full px-3 py-2 border border-border-strong
                               rounded-lg bg-card dark:bg-surface-hover text-foreground
                               focus:outline-none focus:ring-2 focus:ring-ring transition"
                    placeholder="e.g. March Week 2 Deliveries"
                  />
                  {formErrors.batchName && (
                    <p className="mt-1 text-xs text-destructive">
                      {formErrors.batchName.message}
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-muted-foreground mb-1">
                    Notes (optional)
                  </label>
                  <textarea
                    {...register("notes")}
                    rows={3}
                    className="w-full px-3 py-2 border border-border-strong
                               rounded-lg bg-card dark:bg-surface-hover text-foreground
                               focus:outline-none focus:ring-2 focus:ring-ring resize-none transition"
                    placeholder="Any special instructions…"
                  />
                  {formErrors.notes && (
                    <p className="mt-1 text-xs text-destructive">
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
                             text-muted-foreground border border-border-strong rounded-lg hover:bg-muted
                             dark:hover:bg-surface-hover transition-colors"
                >
                  <ArrowLeft className="h-4 w-4" /> Back
                </button>
                <button
                  onClick={handleStep1Continue}
                  disabled={isValidating}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2 text-sm
                             font-semibold text-primary-foreground bg-primary hover:bg-primary-hover
                             disabled:bg-surface-hover rounded-lg
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
                <h3 className="text-lg font-semibold text-foreground mb-1">
                  Review & Confirm
                </h3>
                <p className="text-sm text-subtle-foreground dark:text-muted-foreground">
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
                      valueClass="text-destructive"
                    />
                  )}
                  <ReviewRow
                    label="Estimated total"
                    value={`£${formatTotal(validationResult)}`}
                    valueClass="text-brand-text font-bold"
                  />
                </div>
              )}

              <ConfirmUploadChoice
                kind={uploadKind}
                correctsUpload={correctsUpload}
                correctable={correctable}
                duplicateCount={duplicateCount}
                duplicateRows={validationResult?.duplicate_rows || []}
                matchedUpload={validationResult?.duplicate_matched_upload || null}
                idPrefix="wizard"
                onChange={({ kind, correctsUpload: parent }) => {
                  setUploadKind(kind);
                  setCorrectsUpload(parent);
                }}
              />

              {displayError && <ErrorBanner error={displayError} />}

              <div className="flex gap-3">
                <button
                  onClick={prevStep}
                  className="flex items-center gap-2 px-4 py-2 text-sm font-medium
                             text-muted-foreground border border-border-strong rounded-lg hover:bg-muted
                             dark:hover:bg-surface-hover transition-colors"
                >
                  <ArrowLeft className="h-4 w-4" /> Back
                </button>
                <button
                  onClick={handleStep2Submit}
                  disabled={isUploading || confirmIncomplete}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2 text-sm
                             font-semibold text-primary-foreground bg-primary hover:bg-primary-hover
                             disabled:bg-surface-hover rounded-lg
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
                <h3 className="text-lg font-semibold text-foreground mb-1">
                  Processing your batch
                </h3>
                <p className="text-sm text-subtle-foreground dark:text-muted-foreground">
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
                  className="flex items-center gap-3 p-4 bg-primary/10 border border-primary/30 rounded-lg"
                >
                  <Loader2 className="h-5 w-5 animate-spin text-brand-text flex-shrink-0" />
                  <p className="text-sm text-brand-text font-medium">
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
                  className="space-y-3 p-4 bg-success/10 border border-success/30 rounded-xl"
                >
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-5 w-5 text-success flex-shrink-0" />
                    <p className="text-sm font-semibold text-success">
                      Bookings created successfully!
                    </p>
                  </div>
                  {latestUpload?.success_count && (
                    <p className="text-sm text-success/80">
                      {latestUpload.success_count} booking
                      {latestUpload.success_count !== 1 ? "s" : ""} ready for
                      payment (£
                      {formatTotal(latestUpload)}).
                    </p>
                  )}
                  <button
                    onClick={manualContinueToPayment}
                    className="w-full flex items-center justify-center gap-2 py-2.5 bg-primary
                               hover:bg-primary-hover text-primary-foreground text-sm font-semibold rounded-lg
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
                  className="p-4 bg-info-surface border border-info/30 rounded-xl space-y-3"
                >
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-5 w-5 text-info" />
                    <p className="text-sm font-semibold text-info">
                      Invoice Raised
                    </p>
                  </div>
                  <p className="text-sm text-info/80">
                    Your invoice for{" "}
                    <strong>£{formatTotal(latestUpload)}</strong> has been
                    created. You will receive a confirmation email shortly.
                  </p>
                  {/* FIX Bug 4: manual "View Invoice" escape hatch for NET flow */}
                  {latestUpload?.receivable_id && (
                    <button
                      onClick={manualViewInvoice}
                      className="w-full flex items-center justify-center gap-2 py-2.5 bg-info
                                 hover:bg-info text-info-foreground text-sm font-semibold rounded-lg
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
                    className="w-full flex items-center justify-center gap-2 py-2.5 border border-info/40
                               text-info text-sm font-medium rounded-lg
                               transition-colors hover:bg-info/10"
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
                  className="flex items-center gap-3 p-4 bg-info/10 border border-info/30 rounded-lg"
                >
                  <Loader2 className="h-5 w-5 animate-spin text-info flex-shrink-0" />
                  <p className="text-sm text-info">
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
                  className="w-full flex items-center justify-center gap-2 py-2.5 bg-primary
                             hover:bg-primary-hover text-primary-foreground text-sm font-semibold rounded-lg
                             transition-colors"
                >
                  Retry Upload <ArrowRight className="h-4 w-4" />
                </button>
              )}

              <div className="flex justify-end">
                <button
                  onClick={handleClose}
                  className="px-4 py-2 text-sm font-medium text-muted-foreground
                             hover:text-foreground transition-colors"
                >
                  Close
                </button>
              </div>
            </motion.div>
          )}

          {/* ── STEP 4: Results review ────────────────────────────────────── */}
          {currentStep === REVIEW_STEP && latestUpload?.id && (
            <motion.div
              key="step4"
              initial={{ opacity: 0, x: 40 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -40 }}
              transition={{ duration: 0.25 }}
            >
              {/* The same component the /bulk-upload/:id/review route renders.
                  One implementation, so closing the tab and coming back through
                  the dashboard lands on identical UI -- which is what makes
                  "you can close this page" true rather than a promise.

                  `surface` is passed rather than inferred. This modal is
                  `bg-card dark:bg-surface` and the review step's palette has
                  to match whichever of those is actually painted. It used to
                  hardcode the dark half, which on a light-mode machine put
                  white text on the white card -- the step that lists which rows
                  failed rendered blank. The app now pins `dark:` to its own
                  theme class (see index.css), so "gray-800" is the answer here
                  and it no longer depends on the visitor's OS. */}
              <BulkUploadReviewPage uploadId={latestUpload.id} embedded surface="dark" />
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
      className="flex items-start gap-3 p-4 bg-destructive-surface border border-destructive/30 rounded-lg"
    >
      <AlertCircle className="h-5 w-5 text-destructive flex-shrink-0 mt-0.5" />
      <div className="flex-1">
        <p className="text-sm text-destructive">{msg}</p>
        {payUrl && (
          <a
            href={payUrl}
            className="inline-block mt-2 px-4 py-2 text-sm font-semibold text-primary-foreground bg-primary hover:bg-primary-hover rounded-lg"
          >
            Pay outstanding invoices
          </a>
        )}
      </div>
    </motion.div>
  );
}

function ReviewRow({
  label,
  value,
  valueClass = "text-foreground",
}) {
  return (
    <div className="flex justify-between items-center py-2 border-b border-border last:border-0">
      <span className="text-sm text-subtle-foreground dark:text-muted-foreground">{label}</span>
      <span className={`text-sm font-medium ${valueClass}`}>
        {value ?? "—"}
      </span>
    </div>
  );
}
