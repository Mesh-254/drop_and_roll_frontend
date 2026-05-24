import React, { useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, Download, RotateCcw, Loader2, AlertCircle, CheckCircle2 } from 'lucide-react';
import { useBulkUpload } from '../../hooks/useBulkUpload';
import BulkUploadProgressBar from './BulkUploadProgressBar';
import ErrorTable from './ErrorTable';

/**
 * BulkUploadDetail — detailed view of a single upload with live status.
 *
 * Shows:
 * - Horizontal stepper (Uploaded → Processing → Complete)
 * - Live stats & progress
 * - Error table with pagination
 * - Action buttons (download report, retry, etc.)
 */
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

  // Fetch upload detail on mount
  useEffect(() => {
    if (!id) return;
    // In a real app, this would fetch from hook or via API
    // For now, we rely on hook's polling if upload already loaded
  }, [id]);

  // Determine stepper status
  const getStepStatus = (step) => {
    if (!latestUpload) return 'pending';
    const status = latestUpload.status;

    if (step === 0) return 'done'; // Uploaded is always done
    if (step === 1) {
      if (status === 'pending' || status === 'processing') return 'active';
      return 'done';
    }
    if (step === 2) {
      if (status === 'completed' || status === 'partial' || status === 'failed') return 'done';
      return 'pending';
    }
    return 'pending';
  };

  // Loading state
  if (!latestUpload) {
    return (
      <div className="min-h-screen bg-white dark:bg-gray-900 pt-20">
        <div className="max-w-6xl mx-auto px-4 py-12 flex items-center justify-center">
          <div className="text-center">
            <Loader2 className="h-8 w-8 animate-spin text-orange-500 mx-auto mb-4" />
            <p className="text-gray-600 dark:text-gray-400">Loading upload details...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white dark:bg-gray-900 pt-20">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Back button */}
        <Link
          to="/bulk-uploads"
          className="inline-flex items-center gap-2 text-orange-600 dark:text-orange-400 hover:text-orange-700 dark:hover:text-orange-300 font-medium mb-8 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Dashboard
        </Link>

        {/* Header */}
        <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
          <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-2">
            {latestUpload.batch_name || 'Bulk Upload'}
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Uploaded {new Date(latestUpload.created_at).toLocaleDateString()}
          </p>
        </motion.div>

        {/* Horizontal stepper */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-12 p-6 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700"
        >
          <div className="flex items-center justify-between">
            {[
              { name: 'Uploaded', icon: '📁' },
              { name: 'Processing', icon: '⚙️' },
              { name: 'Complete', icon: '✓' },
            ].map((step, idx) => {
              const status = getStepStatus(idx);
              const isActive = status === 'active';
              const isDone = status === 'done';

              return (
                <div key={idx} className="flex items-center flex-1">
                  {/* Step circle */}
                  <motion.div
                    animate={{
                      scale: isActive ? 1.15 : 1,
                      backgroundColor: isDone
                        ? '#f97316'
                        : isActive
                        ? '#fed7aa'
                        : '#e5e7eb',
                    }}
                    className="w-12 h-12 rounded-full flex items-center justify-center font-bold text-sm dark:bg-gray-700 flex-shrink-0"
                  >
                    {isDone ? '✓' : isActive ? '⚙️' : idx + 1}
                  </motion.div>

                  {/* Step name */}
                  <div className="ml-4 flex-1 min-w-0">
                    <p
                      className={`text-sm font-semibold ${
                        isDone || isActive
                          ? 'text-orange-600 dark:text-orange-400'
                          : 'text-gray-500 dark:text-gray-400'
                      }`}
                    >
                      {step.name}
                    </p>
                  </div>

                  {/* Connector line */}
                  {idx < 2 && (
                    <motion.div
                      className="flex-1 h-1 bg-gray-200 dark:bg-gray-700 rounded-full mx-2"
                      animate={{
                        backgroundColor: isDone || isActive ? '#f97316' : '#e5e7eb',
                      }}
                    />
                  )}
                </div>
              );
            })}
          </div>
        </motion.div>

        {/* Status badge and summary */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="mb-8"
        >
          {latestUpload.status === 'completed' && (
            <div className="p-6 bg-green-50 dark:bg-green-900/10 border border-green-200 dark:border-green-900/30 rounded-lg flex gap-4 items-start">
              <CheckCircle2 className="h-6 w-6 text-green-600 dark:text-green-400 flex-shrink-0 mt-0.5" />
              <div>
                <h3 className="font-bold text-green-700 dark:text-green-400 text-lg">
                  Upload Completed Successfully
                </h3>
                <p className="text-sm text-green-600 dark:text-green-400/80 mt-1">
                  All {latestUpload.total_rows} rows processed and {latestUpload.successful} bookings
                  created.
                </p>
                {latestUpload.total_spend_gbp && (
                  <p className="text-sm text-green-600 dark:text-green-400/80 mt-2 font-semibold">
                    Total value: £{latestUpload.total_spend_gbp.toFixed(2)}
                  </p>
                )}
              </div>
            </div>
          )}

          {['partial', 'failed'].includes(latestUpload.status) && (
            <div
              className={`p-6 rounded-lg flex gap-4 items-start ${
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
                <h3
                  className={`font-bold text-lg ${
                    latestUpload.status === 'partial'
                      ? 'text-amber-700 dark:text-amber-400'
                      : 'text-red-700 dark:text-red-400'
                  }`}
                >
                  {latestUpload.successful} / {latestUpload.total_rows} Rows Processed
                </h3>
                <p
                  className={`text-sm mt-1 ${
                    latestUpload.status === 'partial'
                      ? 'text-amber-600 dark:text-amber-400/80'
                      : 'text-red-600 dark:text-red-400/80'
                  }`}
                >
                  {latestUpload.failed} rows had errors. Please review and retry.
                </p>
              </div>
            </div>
          )}

          {['pending', 'processing'].includes(latestUpload.status) && (
            <div>
              <BulkUploadProgressBar
                pct={latestUpload.progress_pct || 0}
                label={`Processing: ${latestUpload.processed || 0} / ${latestUpload.total_rows} rows`}
                status="processing"
              />
            </div>
          )}
        </motion.div>

        {/* Stats grid */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8"
        >
          <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
            <p className="text-xs text-gray-600 dark:text-gray-400 font-semibold mb-1">TOTAL ROWS</p>
            <p className="text-2xl font-bold text-gray-900 dark:text-white">
              {latestUpload.total_rows}
            </p>
          </div>

          <div className="p-4 bg-green-50 dark:bg-green-900/10 rounded-lg border border-green-200 dark:border-green-900/30">
            <p className="text-xs text-green-700 dark:text-green-400 font-semibold mb-1">SUCCESSFUL</p>
            <p className="text-2xl font-bold text-green-600 dark:text-green-400">
              {latestUpload.successful || 0}
            </p>
          </div>

          <div className="p-4 bg-red-50 dark:bg-red-900/10 rounded-lg border border-red-200 dark:border-red-900/30">
            <p className="text-xs text-red-700 dark:text-red-400 font-semibold mb-1">FAILED</p>
            <p className="text-2xl font-bold text-red-600 dark:text-red-400">
              {latestUpload.failed || 0}
            </p>
          </div>

          {latestUpload.total_spend_gbp && (
            <div className="p-4 bg-blue-50 dark:bg-blue-900/10 rounded-lg border border-blue-200 dark:border-blue-900/30">
              <p className="text-xs text-blue-700 dark:text-blue-400 font-semibold mb-1">TOTAL SPEND</p>
              <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                £{latestUpload.total_spend_gbp.toFixed(2)}
              </p>
            </div>
          )}
        </motion.div>

        {/* Bulk discount badge */}
        {latestUpload.bulk_discount_pct && latestUpload.bulk_discount_pct > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="mb-8 p-3 bg-blue-50 dark:bg-blue-900/10 border border-blue-200 dark:border-blue-900/30 rounded-lg text-center"
          >
            <p className="text-sm font-semibold text-blue-700 dark:text-blue-400">
              💸 {latestUpload.bulk_discount_pct}% bulk discount applied
            </p>
          </motion.div>
        )}

        {/* Error table section */}
        {latestUpload.failed > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="mb-8"
          >
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">Failed Rows</h2>
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
                className="flex-1 sm:flex-none px-4 py-2.5 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700/50 rounded-lg font-medium flex items-center justify-center gap-2 transition-all"
              >
                <Download className="h-5 w-5" />
                Download Error Report
              </motion.button>

              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={handleRetryFailed}
                className="flex-1 sm:flex-none px-4 py-2.5 bg-orange-500 hover:bg-orange-600 text-white rounded-lg font-medium flex items-center justify-center gap-2 transition-all"
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
