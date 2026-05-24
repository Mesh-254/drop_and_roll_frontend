import React, { useEffect } from 'react';
import { motion } from 'framer-motion';
import { CheckCircle, AlertCircle, Download, ArrowRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import confetti from 'canvas-confetti';

/**
 * BulkUploadComplete — Final completion screen.
 * Shows success/partial status, handles navigation to payment or invoices.
 */
export default function BulkUploadComplete({ bulkUpload, onReset }) {
  const navigate = useNavigate();
  const {
    latestUpload,
    paymentPath,
    handleInitiatePayment,
    handleViewInvoice,
    handleDownloadErrorReport,
    isInitiatingPayment,
  } = bulkUpload;

  // Trigger confetti on mount for successful completions
  useEffect(() => {
    if (latestUpload?.status !== 'failed') {
      confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 },
      });
    }
  }, [latestUpload?.status]);

  const isSuccess = latestUpload?.status === 'completed';
  const isPartial = latestUpload?.status === 'partial';
  const isFailed = latestUpload?.status === 'failed';

  const total = latestUpload?.total_rows || 0;
  const successful = latestUpload?.successful || 0;
  const failed = latestUpload?.failed || 0;

  return (
    <div>
      <div className="text-center mb-8">
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: 'spring', stiffness: 200, damping: 15 }}
          className="flex justify-center mb-4"
        >
          {isFailed ? (
            <AlertCircle className="w-16 h-16 text-red-400" />
          ) : (
            <CheckCircle className="w-16 h-16 text-green-400" />
          )}
        </motion.div>

        <motion.h2
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className={`text-3xl font-bold mb-2 ${
            isFailed ? 'text-red-200' : 'text-green-200'
          }`}
        >
          {isSuccess
            ? '🎉 All Done!'
            : isPartial
              ? '⚠️ Partial Success'
              : '❌ Processing Failed'}
        </motion.h2>

        <motion.p
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="text-slate-400"
        >
          {isSuccess
            ? `All ${successful} bookings have been created successfully.`
            : isPartial
              ? `${successful} bookings created, ${failed} had errors.`
              : 'There was an issue processing your batch. Please try again.'}
        </motion.p>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="space-y-6"
      >
        {/* Summary Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-slate-700/50 border border-slate-600 rounded-lg p-4 text-center">
            <p className="text-slate-300 text-sm mb-1">Total Rows</p>
            <p className="text-3xl font-bold text-white">{total}</p>
          </div>

          <div className="bg-green-900/20 border border-green-800 rounded-lg p-4 text-center">
            <p className="text-green-300 text-sm mb-1">Successful</p>
            <p className="text-3xl font-bold text-green-300">{successful}</p>
          </div>

          {failed > 0 && (
            <div className="bg-red-900/20 border border-red-800 rounded-lg p-4 text-center">
              <p className="text-red-300 text-sm mb-1">Failed</p>
              <p className="text-3xl font-bold text-red-300">{failed}</p>
            </div>
          )}
        </div>

        {/* Batch Details */}
        {latestUpload && (
          <div className="bg-slate-700/50 border border-slate-600 rounded-lg p-6">
            <h3 className="font-semibold text-white mb-4">Batch Summary</h3>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-300">Batch ID:</span>
                <span className="text-white font-mono">{latestUpload.id.slice(0, 8)}...</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-300">Batch Name:</span>
                <span className="text-white">{latestUpload.batch_name || 'Untitled'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-300">Created:</span>
                <span className="text-white">
                  {new Date(latestUpload.created_at).toLocaleString()}
                </span>
              </div>
              {latestUpload.processed_at && (
                <div className="flex justify-between">
                  <span className="text-slate-300">Completed:</span>
                  <span className="text-white">
                    {new Date(latestUpload.processed_at).toLocaleString()}
                  </span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Error Report Download */}
        {failed > 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.4 }}
            className="bg-yellow-900/20 border border-yellow-800 rounded-lg p-6"
          >
            <h3 className="font-semibold text-yellow-200 mb-3">Download Error Report</h3>
            <p className="text-sm text-yellow-300 mb-4">
              {failed} rows had errors. Download a detailed report with column-level information and suggested fixes.
            </p>
            <motion.button
              onClick={handleDownloadErrorReport}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="inline-flex items-center gap-2 px-4 py-2 bg-yellow-600 hover:bg-yellow-700 text-white rounded-lg font-medium transition"
            >
              <Download className="w-4 h-4" />
              Download Error Report
            </motion.button>
          </motion.div>
        )}

        {/* Payment/Invoice Section */}
        {!isFailed && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
            className={`rounded-lg p-6 border-2 ${
              paymentPath === 'prepaid'
                ? 'bg-orange-900/20 border-orange-500'
                : 'bg-green-900/20 border-green-500'
            }`}
          >
            <h3 className={`font-semibold text-lg mb-3 ${
              paymentPath === 'prepaid' ? 'text-orange-200' : 'text-green-200'
            }`}>
              {paymentPath === 'prepaid' ? '💳 Next: Payment' : '📄 Your Invoice'}
            </h3>

            {paymentPath === 'prepaid' ? (
              <>
                <p className={`text-sm mb-4 ${
                  paymentPath === 'prepaid' ? 'text-orange-300' : 'text-green-300'
                }`}>
                  Total amount: <span className="font-bold">£{parseFloat(latestUpload?.effective_total || latestUpload?.computed_total || 0).toFixed(2)}</span>
                </p>
                <motion.button
                  onClick={handleInitiatePayment}
                  disabled={isInitiatingPayment}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  className="w-full px-6 py-3 bg-orange-500 hover:bg-orange-600 text-white rounded-lg font-semibold transition disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {isInitiatingPayment ? 'Starting payment...' : 'Proceed to Payment'}
                  <ArrowRight className="w-4 h-4" />
                </motion.button>
              </>
            ) : (
              <>
                {latestUpload?.invoice_number && (
                  <div className="mb-4">
                    <p className="text-sm text-green-400 mb-1">Invoice Number</p>
                    <p className="text-lg font-bold text-green-200">{latestUpload.invoice_number}</p>
                  </div>
                )}
                {latestUpload?.invoice_due_date && (
                  <div className="mb-4">
                    <p className="text-sm text-green-400 mb-1">Due Date</p>
                    <p className="text-lg font-bold text-green-200">
                      {new Date(latestUpload.invoice_due_date).toLocaleDateString()}
                    </p>
                  </div>
                )}
                <motion.button
                  onClick={handleViewInvoice}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  className="w-full px-6 py-3 bg-green-500 hover:bg-green-600 text-white rounded-lg font-semibold transition flex items-center justify-center gap-2"
                >
                  View Invoice
                  <ArrowRight className="w-4 h-4" />
                </motion.button>
              </>
            )}
          </motion.div>
        )}

        {/* Action Buttons */}
        <div className="flex gap-4 pt-4">
          <motion.button
            onClick={onReset}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className="flex-1 px-6 py-3 bg-slate-700 hover:bg-slate-600 text-white rounded-lg font-semibold transition"
          >
            Upload Another Batch
          </motion.button>

          <motion.button
            onClick={() => navigate('/bulk-upload')}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className="flex-1 px-6 py-3 bg-slate-700 hover:bg-slate-600 text-white rounded-lg font-semibold transition"
          >
            View Dashboard
          </motion.button>
        </div>
      </motion.div>
    </div>
  );
}
