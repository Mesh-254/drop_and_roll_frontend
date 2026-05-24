import React, { useEffect } from 'react';
import { motion } from 'framer-motion';
import { CheckCircle, AlertCircle, Clock, Zap } from 'lucide-react';

/**
 * BulkUploadProcessing — Real-time processing progress.
 * Shows polling status, counts, and estimated time.
 */
export default function BulkUploadProcessing({ bulkUpload }) {
  const {
    latestUpload,
    processingStatus,
    errorRows,
  } = bulkUpload;

  const total = latestUpload?.total_rows || 0;
  const successful = latestUpload?.successful || 0;
  const failed = latestUpload?.failed || 0;
  const processed = successful + failed;
  const progress = total > 0 ? Math.round((processed / total) * 100) : 0;

  // Determine status message
  const getStatusMessage = () => {
    if (processingStatus === 'done' || latestUpload?.status === 'completed') {
      return 'Processing completed successfully! 🎉';
    }
    if (processingStatus === 'done' || latestUpload?.status === 'partial') {
      return 'Processing completed with some errors';
    }
    if (processingStatus === 'credit_exceeded') {
      return 'Credit limit exceeded';
    }
    return 'Processing your batch...';
  };

  const statusColor = {
    polling: 'text-blue-400',
    done: 'text-green-400',
    failed: 'text-red-400',
    credit_exceeded: 'text-red-400',
  }[processingStatus] || 'text-slate-400';

  return (
    <div>
      <h2 className="text-2xl font-bold text-white mb-2">
        {getStatusMessage()}
      </h2>
      <p className="text-slate-400 mb-8">
        {processingStatus === 'polling'
          ? 'Please wait while we process your bookings. This may take a few minutes.'
          : 'Your batch has finished processing. See the summary below.'}
      </p>

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="space-y-6"
      >
        {/* Progress Section */}
        <div className="bg-slate-700/50 border border-slate-600 rounded-lg p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-white">Progress</h3>
            <motion.div
              animate={{ rotate: processingStatus === 'polling' ? 360 : 0 }}
              transition={{ repeat: processingStatus === 'polling' ? Infinity : 0, duration: 2 }}
              className={statusColor}
            >
              {processingStatus === 'polling' ? (
                <Zap className="w-5 h-5" />
              ) : (
                <CheckCircle className="w-5 h-5" />
              )}
            </motion.div>
          </div>

          {/* Progress Bar */}
          <div className="space-y-3">
            <div className="h-3 bg-slate-600 rounded-full overflow-hidden">
              <motion.div
                className="h-full bg-gradient-to-r from-orange-500 to-orange-600"
                initial={{ width: '0%' }}
                animate={{ width: `${progress}%` }}
                transition={{ duration: 0.5, ease: 'easeOut' }}
              />
            </div>

            <div className="flex justify-between items-center text-sm">
              <span className="text-slate-300">
                {processed} of {total} rows processed
              </span>
              <span className="font-semibold text-orange-400">
                {progress}%
              </span>
            </div>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {/* Successful */}
          <motion.div
            whileHover={{ scale: 1.05 }}
            className="bg-green-900/20 border border-green-800 rounded-lg p-4"
          >
            <div className="flex items-center gap-2 mb-2">
              <CheckCircle className="w-5 h-5 text-green-400" />
              <h4 className="font-semibold text-green-200">Success</h4>
            </div>
            <p className="text-2xl font-bold text-green-300">{successful}</p>
            <p className="text-xs text-green-400 mt-1">
              {successful > 0 ? `${Math.round(successful / total * 100)}% complete` : 'Processing...'}
            </p>
          </motion.div>

          {/* Failed */}
          <motion.div
            whileHover={{ scale: 1.05 }}
            className="bg-red-900/20 border border-red-800 rounded-lg p-4"
          >
            <div className="flex items-center gap-2 mb-2">
              <AlertCircle className="w-5 h-5 text-red-400" />
              <h4 className="font-semibold text-red-200">Failed</h4>
            </div>
            <p className="text-2xl font-bold text-red-300">{failed}</p>
            <p className="text-xs text-red-400 mt-1">
              {failed > 0 ? 'Review errors below' : 'No errors yet'}
            </p>
          </motion.div>

          {/* Remaining */}
          <motion.div
            whileHover={{ scale: 1.05 }}
            className="bg-slate-700/50 border border-slate-600 rounded-lg p-4"
          >
            <div className="flex items-center gap-2 mb-2">
              <Clock className="w-5 h-5 text-slate-400" />
              <h4 className="font-semibold text-slate-200">Remaining</h4>
            </div>
            <p className="text-2xl font-bold text-slate-300">
              {Math.max(0, total - processed)}
            </p>
            <p className="text-xs text-slate-400 mt-1">
              Rows to process
            </p>
          </motion.div>
        </div>

        {/* Status Timeline */}
        <div className="bg-slate-700/50 border border-slate-600 rounded-lg p-6">
          <h3 className="font-semibold text-white mb-4">Timeline</h3>
          <div className="space-y-3">
            {[
              { status: latestUpload?.status === 'processing' || processingStatus === 'polling', label: 'Processing rows...', time: 'In progress' },
              { status: latestUpload?.status in { completed: 1, partial: 1 }, label: 'Applying discounts...', time: 'Done' },
              { status: latestUpload?.status in { completed: 1, partial: 1 }, label: 'Finalizing...', time: 'Done' },
            ].map((step, idx) => (
              <div key={idx} className="flex items-center gap-3">
                <motion.div
                  animate={{ scale: step.status ? [1, 1.2, 1] : 1 }}
                  transition={{ repeat: step.status ? Infinity : 0, duration: 0.5 }}
                  className={`w-3 h-3 rounded-full ${
                    step.status
                      ? 'bg-orange-500 shadow-lg shadow-orange-500/50'
                      : 'bg-slate-600'
                  }`}
                />
                <span className="text-sm text-slate-300 flex-1">{step.label}</span>
                <span className="text-xs text-slate-500">{step.time}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Error Preview (if any) */}
        {failed > 0 && processingStatus === 'done' && errorRows.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-red-900/20 border border-red-800 rounded-lg p-6"
          >
            <h3 className="font-semibold text-red-200 mb-4">First Error Example</h3>
            <div className="bg-red-900/20 rounded p-3 text-sm text-red-300">
              <p>
                <span className="font-semibold">Row {errorRows[0]?.row_number}:</span> {errorRows[0]?.error_messages?.[0] || 'Unknown error'}
              </p>
            </div>
            <p className="text-xs text-red-400 mt-2">
              Download the error report to see all {failed} failed rows with details.
            </p>
          </motion.div>
        )}

        {/* Auto-refresh info */}
        {processingStatus === 'polling' && (
          <div className="bg-blue-900/20 border border-blue-800 rounded-lg p-4">
            <p className="text-sm text-blue-300">
              🔄 Refreshing every 2 seconds. Don't close this page.
            </p>
          </div>
        )}
      </motion.div>
    </div>
  );
}
