import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Download,
  ArrowRight,
  ArrowLeft,
  Loader2,
  AlertCircle,
  CheckCircle2,
  X,
  Clock,
  FileText,
} from 'lucide-react';
import { useBulkUpload } from '../../hooks/useBulkUpload';
import FileUploadZone from './FileUploadZone';
import BulkUploadProgressBar from './BulkUploadProgressBar';
import ErrorTable from './ErrorTable';

/**
 * Step 0 metadata schema (steps 1 & 2 form)
 */
const metadataSchema = z.object({
  batchName: z
    .string()
    .min(1, 'Batch name is required')
    .max(100, 'Batch name must be under 100 characters'),
  notes: z
    .string()
    .max(1000, 'Notes must be under 1,000 characters')
    .optional()
    .or(z.literal('')),
});

/**
 * BulkUploadFlow — 4-step wizard for bulk uploads.
 *
 * Step 0: Upload File
 * Step 1: Batch Details (metadata)
 * Step 2: Review & Confirm
 * Step 3: Processing / Done
 *
 * PHASE 3 STEP 7: Now accepts optional 'hook' prop from parent (BulkUploadWizard).
 * If hook is provided, it uses the shared instance to enable auto-retry after
 * business profile creation. If not provided, creates its own hook instance.
 */
export default function BulkUploadFlow({ onSuccess = () => {}, onClose = () => {}, hook = null }) {
  // Use provided hook or create a new one
  const bulkUploadHook = hook || useBulkUpload();
  const {
    file,
    setFile,
    batchName,
    setBatchName,
    notes,
    setNotes,
    currentStep,
    nextStep,
    prevStep,
    goToStep,
    uploadProgress,
    isUploading,
    isSubmitting,
    uploadError,
    uploadResult,
    processingStatus,
    latestUpload,
    paymentPath,
    errorRows,
    errorMeta,
    errorPage,
    setErrorPage,
    isFetchingErrors,
    handleFileSelect,
    handleValidateAndUpload,   // FIX: was missing — must be called at step 1→2 transition
    handleSubmit,
    handleRetryFailed,
    handleDownloadTemplate,
    handleDownloadErrorReport,
    handleInitiatePayment,
    isInitiatingPayment,
    fetchErrors,
    reset,
    setUploadError,
    gatewayPreference,
    setGatewayPreference,
  } = bulkUploadHook;

  // FIX-BUG-05: Local gateway selector state for the Done step
  const [selectedGateway, setSelectedGateway] = useState("stripe");

  const {
    register,
    handleSubmit: rhfHandleSubmit,   // FIX: renamed so it doesn't shadow hook's handleSubmit
    watch,
    formState: { errors: formErrors },
  } = useForm({
    resolver: zodResolver(metadataSchema),
    defaultValues: { batchName: '', notes: '' },
  });

  // Sync form state to hook
  const watchedBatchName = watch('batchName');
  const watchedNotes = watch('notes');

  useEffect(() => {
    setBatchName(watchedBatchName);
    setNotes(watchedNotes);
  }, [watchedBatchName, watchedNotes, setBatchName, setNotes]);

  // Step indicator
  const stepLabels = [
    { name: 'Upload File', icon: '📁' },
    { name: 'Batch Details', icon: '📝' },
    { name: 'Review & Confirm', icon: '✓' },
    { name: 'Processing', icon: '⚙️' },
  ];

  const canAdvanceStep0 = !!file;
  // FIX: step 2 button must be disabled until uploadResult.id is available
  const canAdvanceStep2 = !!uploadResult?.id && !isUploading && !isSubmitting;

  // FIX: step 1 "Continue" must call validateFile, not just nextStep.
  // Previously onClick={nextStep} skipped the upload entirely, so uploadResult
  // was always null by the time the user reached the Review step.
  const handleStep1Continue = rhfHandleSubmit(async () => {
    const success = await handleValidateAndUpload();
    if (success) {
      nextStep(); // advance to Review only after uploadResult.id is set
    }
    // If validation failed, stay on step 1; error is already in uploadError state
  });

  // Close modal (X button)
  const handleClose = () => {
    reset();
    onClose();
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl overflow-hidden max-w-2xl w-full mx-auto">
      {/* Header with close button */}
      <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Bulk Upload</h2>
        <motion.button
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.95 }}
          onClick={handleClose}
          className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-all"
          title="Close"
        >
          <X className="h-6 w-6 text-gray-500 dark:text-gray-400" />
        </motion.button>
      </div>

      {/* Steps indicator */}
      <div className="px-6 pt-6">
        <div className="flex items-center justify-between mb-8">
          {stepLabels.map((step, idx) => (
            <div key={idx} className="flex flex-col items-center">
              <motion.div
                animate={{
                  scale: currentStep === idx ? 1.2 : 1,
                  backgroundColor:
                    currentStep > idx
                      ? '#f97316'
                      : currentStep === idx
                      ? '#fed7aa'
                      : '#e5e7eb',
                }}
                className="w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm dark:bg-gray-700 dark:text-gray-300 mb-2"
              >
                {currentStep > idx ? '✓' : idx + 1}
              </motion.div>
              <span
                className={`text-xs font-medium text-center max-w-20 ${
                  currentStep >= idx
                    ? 'text-orange-600 dark:text-orange-400'
                    : 'text-gray-500 dark:text-gray-400'
                }`}
              >
                {step.name}
              </span>
            </div>
          ))}
        </div>

        {/* Progress line */}
        <div className="flex gap-2 mb-8">
          {[0, 1, 2].map((idx) => (
            <motion.div
              key={idx}
              className="flex-1 h-1 bg-gray-200 dark:bg-gray-700 rounded-full"
              animate={{
                backgroundColor: currentStep > idx ? '#f97316' : '#e5e7eb',
              }}
            />
          ))}
        </div>
      </div>

      {/* ── Persistent error banner — visible on every step ─────────────────
           Errors (uploadError) can fire on any step (e.g. BUSINESS_PROFILE_PENDING
           fires on step 1 after the user hits "Validate & Review"). Rendering the
           error here — outside AnimatePresence — keeps it visible while the user
           reads it, regardless of which step they are on.
      ─────────────────────────────────────────────────────────────────────── */}
      {uploadError && (
        <motion.div
          key={uploadError.title}
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          className={`mx-6 mb-2 p-4 rounded-lg flex gap-3 border ${
            uploadError.code === 'BUSINESS_PROFILE_PENDING'
              ? 'bg-amber-50 dark:bg-amber-900/10 border-amber-200 dark:border-amber-900/30'
              : 'bg-red-50 dark:bg-red-900/10 border-red-200 dark:border-red-900/30'
          }`}
        >
          <AlertCircle
            className={`h-5 w-5 flex-shrink-0 mt-0.5 ${
              uploadError.code === 'BUSINESS_PROFILE_PENDING'
                ? 'text-amber-500'
                : 'text-red-500'
            }`}
          />
          <div className="flex-1 min-w-0">
            <p
              className={`font-semibold text-sm ${
                uploadError.code === 'BUSINESS_PROFILE_PENDING'
                  ? 'text-amber-700 dark:text-amber-400'
                  : 'text-red-700 dark:text-red-400'
              }`}
            >
              {uploadError.title}
            </p>
            <p
              className={`text-sm mt-1 ${
                uploadError.code === 'BUSINESS_PROFILE_PENDING'
                  ? 'text-amber-600 dark:text-amber-400/80'
                  : 'text-red-600 dark:text-red-400/80'
              }`}
            >
              {uploadError.message}
            </p>
          </div>
          {/* Dismiss button */}
          <button
            onClick={() => setUploadError(null)}
            className="flex-shrink-0 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
            title="Dismiss"
            aria-label="Dismiss error"
          >
            <X className="h-4 w-4" />
          </button>
        </motion.div>
      )}

      {/* Content */}
      <div className="px-6 pb-6 min-h-96">
        <AnimatePresence mode="wait">
          {/* Step 0: Upload File */}
          {currentStep === 0 && (
            <motion.div
              key="step0"
              initial={{ opacity: 0, x: 100 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -100 }}
              transition={{ duration: 0.3 }}
              className="space-y-6"
            >
              {/* Download template button */}
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={handleDownloadTemplate}
                className="w-full px-4 py-3 border border-orange-500 text-orange-600 dark:text-orange-400 dark:border-orange-500/50 hover:bg-orange-50 dark:hover:bg-orange-900/10 rounded-lg font-medium flex items-center justify-center gap-2 transition-all"
              >
                <Download className="h-5 w-5" />
                Download Template
              </motion.button>

              {/* File upload zone */}
              <FileUploadZone
                onFileSelect={handleFileSelect}
                selectedFile={file}
                onRemoveFile={() => setFile(null)}
                isLoading={isUploading}
                uploadProgress={uploadProgress}
                error={uploadError}
              />

              {/* File format info */}
              <div className="p-4 bg-blue-50 dark:bg-blue-900/10 border border-blue-200 dark:border-blue-900/30 rounded-lg">
                <p className="text-sm text-blue-700 dark:text-blue-400">
                  <strong>File format:</strong> CSV or Excel (.xlsx) · <strong>Max 10 MB</strong> · <strong>Max 1,000 rows</strong>
                </p>
              </div>
            </motion.div>
          )}

          {/* Step 1: Batch Details */}
          {currentStep === 1 && (
            <motion.div
              key="step1"
              initial={{ opacity: 0, x: 100 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -100 }}
              transition={{ duration: 0.3 }}
              className="space-y-6"
            >
              {/* Batch Name */}
              <div>
                <label className="block text-sm font-semibold text-gray-900 dark:text-white mb-2">
                  Batch Name *
                </label>
                <input
                  {...register('batchName')}
                  type="text"
                  placeholder="e.g., London Deliveries May 2024"
                  maxLength={100}
                  className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-all"
                />
                <div className="flex items-end justify-between mt-2">
                  {formErrors.batchName && (
                    <p className="text-sm text-red-600 dark:text-red-400">
                      {formErrors.batchName.message}
                    </p>
                  )}
                  <span className="text-xs text-gray-500 dark:text-gray-400 ml-auto">
                    {watchedBatchName.length}/100
                  </span>
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-sm font-semibold text-gray-900 dark:text-white mb-2">
                  Notes (Optional)
                </label>
                <textarea
                  {...register('notes')}
                  placeholder="Add any notes about this batch..."
                  maxLength={1000}
                  rows={4}
                  className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:ring-2 focus:ring-orange-500 focus:border-transparent resize-none transition-all"
                />
                <div className="flex items-end justify-between mt-2">
                  {formErrors.notes && (
                    <p className="text-sm text-red-600 dark:text-red-400">
                      {formErrors.notes.message}
                    </p>
                  )}
                  <span className="text-xs text-gray-500 dark:text-gray-400 ml-auto">
                    {watchedNotes.length}/1,000
                  </span>
                </div>
              </div>
            </motion.div>
          )}

          {/* Step 2: Review & Confirm */}
          {currentStep === 2 && (
            <motion.div
              key="step2"
              initial={{ opacity: 0, x: 100 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -100 }}
              transition={{ duration: 0.3 }}
              className="space-y-6"
            >
              {/* Summary card */}
              <div className="p-4 bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600 rounded-lg space-y-3">
                <div>
                  <p className="text-xs text-gray-600 dark:text-gray-400 font-semibold">FILE</p>
                  <p className="text-sm text-gray-900 dark:text-white font-medium">
                    {file?.name}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-600 dark:text-gray-400 font-semibold">BATCH NAME</p>
                  <p className="text-sm text-gray-900 dark:text-white font-medium">
                    {batchName || '—'}
                  </p>
                </div>
                {notes && (
                  <div>
                    <p className="text-xs text-gray-600 dark:text-gray-400 font-semibold">NOTES</p>
                    <p className="text-sm text-gray-700 dark:text-gray-300">{notes}</p>
                  </div>
                )}
              </div>

              {/* Info callout */}
              <div className="p-4 bg-blue-50 dark:bg-blue-900/10 border border-blue-200 dark:border-blue-900/30 rounded-lg flex gap-3">
                <Clock className="h-5 w-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-blue-700 dark:text-blue-400">
                  Your file will be validated and processed after submission. This may take 1–2 minutes for
                  large files.
                </p>
              </div>

              {/* Progress bar (while uploading) */}
              {isUploading && (
                <BulkUploadProgressBar
                  pct={uploadProgress}
                  label={`Uploading... ${uploadProgress}%`}
                  status="processing"
                />
              )}
            </motion.div>
          )}

          {/* Step 3: Processing / Done */}
          {currentStep === 3 && latestUpload && (
            <motion.div
              key="step3"
              initial={{ opacity: 0, x: 100 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -100 }}
              transition={{ duration: 0.3 }}
              className="space-y-6"
            >
              {/* Status */}
              {['pending', 'processing'].includes(latestUpload.status) && (
                <div className="space-y-4">
                  {/* Animated progress bar */}
                  <BulkUploadProgressBar
                    pct={latestUpload.progress_pct || 0}
                    label={`Processed: ${latestUpload.processed || 0} / ${latestUpload.total_rows || 0} rows`}
                    status="processing"
                  />

                  {/* Live stats */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-3 bg-green-50 dark:bg-green-900/10 rounded-lg border border-green-200 dark:border-green-900/30">
                      <p className="text-xs text-green-700 dark:text-green-400 font-semibold">SUCCESSFUL</p>
                      <p className="text-2xl font-bold text-green-600 dark:text-green-400 mt-1">
                        {latestUpload.successful || 0}
                      </p>
                    </div>
                    <div className="p-3 bg-red-50 dark:bg-red-900/10 rounded-lg border border-red-200 dark:border-red-900/30">
                      <p className="text-xs text-red-700 dark:text-red-400 font-semibold">FAILED</p>
                      <p className="text-2xl font-bold text-red-600 dark:text-red-400 mt-1">
                        {latestUpload.failed || 0}
                      </p>
                    </div>
                  </div>

                  <p className="text-center text-sm text-gray-600 dark:text-gray-400">
                    Processing... Please wait.
                  </p>
                </div>
              )}

              {/* Completed */}
              {latestUpload.status === 'completed' && (
                <div className="space-y-4">
                  <div className="p-4 bg-green-50 dark:bg-green-900/10 border border-green-200 dark:border-green-900/30 rounded-lg flex gap-3">
                    <CheckCircle2 className="h-6 w-6 text-green-600 dark:text-green-400 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="font-bold text-green-700 dark:text-green-400">
                        ✓ All {latestUpload.total_rows} bookings created successfully
                      </p>
                      {latestUpload.total_spend_gbp && (
                        <p className="text-sm text-green-600 dark:text-green-400/80 mt-1">
                          Total: £{latestUpload.total_spend_gbp.toFixed(2)}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* FIX-BUG-05: PREPAID payment with gateway selector */}
                  {paymentPath === "prepaid" && (
                    <div className="space-y-4">
                      <div className="flex gap-3">
                        <button
                          onClick={() => setSelectedGateway("stripe")}
                          className={`flex-1 py-2 rounded-lg border text-sm font-medium transition
                            ${selectedGateway === "stripe"
                              ? "border-orange-500 bg-orange-500/10 text-orange-400"
                              : "border-slate-600 text-slate-400 hover:border-slate-500"}`}
                        >
                          💳 Pay by Card (Stripe)
                        </button>
                        <button
                          onClick={() => setSelectedGateway("paypal")}
                          className={`flex-1 py-2 rounded-lg border text-sm font-medium transition
                            ${selectedGateway === "paypal"
                              ? "border-blue-500 bg-blue-500/10 text-blue-400"
                              : "border-slate-600 text-slate-400 hover:border-slate-500"}`}
                        >
                          🔵 Pay via PayPal
                        </button>
                      </div>

                      <button
                        onClick={() => handleInitiatePayment(selectedGateway)}
                        disabled={isInitiatingPayment}
                        className="w-full py-3 bg-orange-500 hover:bg-orange-600 disabled:bg-slate-600
                                   text-white rounded-xl font-semibold transition flex items-center justify-center gap-2"
                      >
                        {isInitiatingPayment ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            Preparing payment…
                          </>
                        ) : (
                          `Pay £${latestUpload?.effective_total || latestUpload?.total_spend_gbp?.toFixed(2) || "0.00"}`
                        )}
                      </button>
                    </div>
                  )}

                  {/* FIX-BUG-09: NET terms confirmation with invoice link */}
                  {paymentPath === "net" && latestUpload?.receivable_id && (
                    <div className="bg-slate-700/50 border border-slate-600 rounded-xl p-5">
                      <div className="flex items-center gap-2 mb-3">
                        <FileText className="w-5 h-5 text-blue-400" />
                        <span className="font-semibold text-white">Invoice Raised</span>
                      </div>
                      <p className="text-sm text-slate-400 mb-1">
                        An invoice has been emailed to your registered address.
                      </p>
                      <p className="text-sm text-slate-400 mb-4">
                        Due in {latestUpload.net_days || 30} days.
                      </p>
                      <button
                        onClick={() => {
                          reset();
                          onSuccess();
                          onClose();
                        }}
                        className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white
                                   rounded-lg font-medium text-sm transition"
                      >
                        View Invoice
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* Partial / Failed */}
              {['partial', 'failed'].includes(latestUpload.status) && (
                <div className="space-y-4">
                  <div
                    className={`p-4 rounded-lg flex gap-3 ${
                      latestUpload.status === 'partial'
                        ? 'bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-900/30'
                        : 'bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-900/30'
                    }`}
                  >
                    <AlertCircle
                      className={`h-6 w-6 flex-shrink-0 mt-0.5 ${
                        latestUpload.status === 'partial'
                          ? 'text-amber-600 dark:text-amber-400'
                          : 'text-red-600 dark:text-red-400'
                      }`}
                    />
                    <div>
                      <p
                        className={`font-bold ${
                          latestUpload.status === 'partial'
                            ? 'text-amber-700 dark:text-amber-400'
                            : 'text-red-700 dark:text-red-400'
                        }`}
                      >
                        {latestUpload.successful} / {latestUpload.total_rows} bookings created.{' '}
                        {latestUpload.failed} rows failed.
                      </p>
                    </div>
                  </div>

                  {/* Error table */}
                  <ErrorTable
                    errors={errorRows}
                    meta={errorMeta}
                    onPageChange={setErrorPage}
                    isLoading={isFetchingErrors}
                    onDownloadCSV={handleDownloadErrorReport}
                    onRetry={handleRetryFailed}
                    isRetrying={false}
                  />
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Footer navigation */}
      <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 flex items-center justify-between gap-3 bg-gray-50 dark:bg-gray-700/50">
        {currentStep > 0 && currentStep < 3 && (
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={prevStep}
            className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg font-medium flex items-center gap-2 transition-all"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </motion.button>
        )}

        <div className="flex-1" />

        {currentStep < 2 && (
          <motion.button
            whileHover={canAdvanceStep0 ? { scale: 1.02 } : {}}
            whileTap={canAdvanceStep0 ? { scale: 0.98 } : {}}
            // FIX: step 0 uses nextStep; step 1 must call handleStep1Continue
            // which runs RHF validation then handleValidateAndUpload
            onClick={currentStep === 0 ? nextStep : handleStep1Continue}
            disabled={currentStep === 0 ? !canAdvanceStep0 : (isUploading || !batchName?.trim())}
            className="px-6 py-2 bg-orange-500 hover:bg-orange-600 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg font-medium flex items-center gap-2 transition-all"
          >
            {isUploading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Uploading...
              </>
            ) : (
              <>
                {currentStep === 0 ? 'Continue' : 'Validate & Review'} <ArrowRight className="h-4 w-4" />
              </>
            )}
          </motion.button>
        )}

        {currentStep === 2 && (
          <motion.button
            whileHover={canAdvanceStep2 ? { scale: 1.02 } : {}}
            whileTap={canAdvanceStep2 ? { scale: 0.98 } : {}}
            // FIX: call handleSubmit directly — no RHF wrapper needed at step 2
            // (there are no form fields on the Review screen to validate)
            onClick={async () => {
              const success = await handleSubmit();
              if (success) nextStep();
            }}
            disabled={!canAdvanceStep2}
            className="px-6 py-2 bg-orange-500 hover:bg-orange-600 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg font-medium flex items-center gap-2 transition-all"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Submitting...
              </>
            ) : (
              <>
                Submit Batch <ArrowRight className="h-4 w-4" />
              </>
            )}
          </motion.button>
        )}

        {currentStep === 3 && (
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => {
              reset();
              onSuccess();
              onClose();
            }}
            className="px-6 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg font-medium flex items-center gap-2 transition-all"
          >
            Done <CheckCircle2 className="h-4 w-4" />
          </motion.button>
        )}
      </div>
    </div>
  );
}
