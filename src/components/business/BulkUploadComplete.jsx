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
            <AlertCircle className="w-16 h-16 text-destructive" />
          ) : (
            <CheckCircle className="w-16 h-16 text-success" />
          )}
        </motion.div>

        <motion.h2
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className={`text-3xl font-bold mb-2 ${
            isFailed ? 'text-destructive' : 'text-success'
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
          className="text-muted-foreground"
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
          <div className="bg-surface/50 border border-border rounded-lg p-4 text-center">
            <p className="text-muted-foreground text-sm mb-1">Total Rows</p>
            <p className="text-3xl font-bold text-foreground">{total}</p>
          </div>

          <div className="bg-success-surface border border-success/30 rounded-lg p-4 text-center">
            <p className="text-success text-sm mb-1">Successful</p>
            <p className="text-3xl font-bold text-success">{successful}</p>
          </div>

          {failed > 0 && (
            <div className="bg-destructive-surface border border-destructive/30 rounded-lg p-4 text-center">
              <p className="text-destructive text-sm mb-1">Failed</p>
              <p className="text-3xl font-bold text-destructive">{failed}</p>
            </div>
          )}
        </div>

        {/* Batch Details */}
        {latestUpload && (
          <div className="bg-surface/50 border border-border rounded-lg p-6">
            <h3 className="font-semibold text-foreground mb-4">Batch Summary</h3>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Batch ID:</span>
                <span className="text-foreground font-mono">{latestUpload.id.slice(0, 8)}...</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Batch Name:</span>
                <span className="text-foreground">{latestUpload.batch_name || 'Untitled'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Created:</span>
                <span className="text-foreground">
                  {new Date(latestUpload.created_at).toLocaleString()}
                </span>
              </div>
              {latestUpload.processed_at && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Completed:</span>
                  <span className="text-foreground">
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
            className="bg-warning-surface border border-warning/30 rounded-lg p-6"
          >
            <h3 className="font-semibold text-warning mb-3">Download Error Report</h3>
            <p className="text-sm text-warning mb-4">
              {failed} rows had errors. Download a detailed report with column-level information and suggested fixes.
            </p>
            <motion.button
              onClick={handleDownloadErrorReport}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="inline-flex items-center gap-2 px-4 py-2 bg-warning hover:bg-warning text-warning-foreground rounded-lg font-medium transition"
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
                ? 'bg-brand-surface border-primary'
                : 'bg-success-surface border-success'
            }`}
          >
            <h3 className={`font-semibold text-lg mb-3 ${
              paymentPath === 'prepaid' ? 'text-brand-text' : 'text-success'
            }`}>
              {paymentPath === 'prepaid' ? '💳 Next: Payment' : '📄 Your Invoice'}
            </h3>

            {paymentPath === 'prepaid' ? (
              <>
                <p className={`text-sm mb-4 ${
                  paymentPath === 'prepaid' ? 'text-brand-text' : 'text-success'
                }`}>
                  Total amount: <span className="font-bold">£{parseFloat(latestUpload?.effective_total || latestUpload?.computed_total || 0).toFixed(2)}</span>
                </p>
                <motion.button
                  onClick={handleInitiatePayment}
                  disabled={isInitiatingPayment}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  className="w-full px-6 py-3 bg-primary hover:bg-primary-hover text-primary-foreground rounded-lg font-semibold transition disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {isInitiatingPayment ? 'Starting payment...' : 'Proceed to Payment'}
                  <ArrowRight className="w-4 h-4" />
                </motion.button>
              </>
            ) : (
              <>
                {latestUpload?.invoice_number && (
                  <div className="mb-4">
                    <p className="text-sm text-success mb-1">Invoice Number</p>
                    <p className="text-lg font-bold text-success">{latestUpload.invoice_number}</p>
                  </div>
                )}
                {latestUpload?.invoice_due_date && (
                  <div className="mb-4">
                    <p className="text-sm text-success mb-1">Due Date</p>
                    <p className="text-lg font-bold text-success">
                      {new Date(latestUpload.invoice_due_date).toLocaleDateString()}
                    </p>
                  </div>
                )}
                <motion.button
                  onClick={handleViewInvoice}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  className="w-full px-6 py-3 bg-success hover:bg-success text-success-foreground rounded-lg font-semibold transition flex items-center justify-center gap-2"
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
            className="flex-1 px-6 py-3 bg-surface hover:bg-surface-hover text-foreground rounded-lg font-semibold transition"
          >
            Upload Another Batch
          </motion.button>

          <motion.button
            onClick={() => navigate('/bulk-upload')}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className="flex-1 px-6 py-3 bg-surface hover:bg-surface-hover text-foreground rounded-lg font-semibold transition"
          >
            View Dashboard
          </motion.button>
        </div>
      </motion.div>
    </div>
  );
}
