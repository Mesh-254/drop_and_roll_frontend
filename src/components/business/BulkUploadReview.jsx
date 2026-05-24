import React from 'react';
import { motion } from 'framer-motion';
import { AlertCircle, CheckCircle, Clock, CreditCard } from 'lucide-react';

/**
 * BulkUploadReview — Final review before processing.
 * Shows payment path (Prepaid vs NET terms) and summary.
 */
export default function BulkUploadReview({
  uploadResult,
  paymentPath,
  bulkUpload,
}) {
  const { netDays, availableCredit } = bulkUpload;

  return (
    <div>
      <h2 className="text-2xl font-bold text-white mb-2">Review & Confirm</h2>
      <p className="text-slate-400 mb-8">
        Verify your details before processing your bulk upload.
      </p>

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="space-y-6"
      >
        {/* Upload Summary */}
        <div className="bg-slate-700/50 border border-slate-600 rounded-lg p-6">
          <h3 className="font-semibold text-white mb-4">Upload Summary</h3>
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-slate-300">Batch Name:</span>
              <span className="text-white font-medium">{uploadResult.batch_name || 'Untitled'}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-slate-300">File:</span>
              <span className="text-white font-medium">{uploadResult.original_filename}</span>
            </div>
            {uploadResult.notes && (
              <div className="flex justify-between items-start">
                <span className="text-slate-300">Notes:</span>
                <span className="text-white font-medium text-right max-w-xs">{uploadResult.notes}</span>
              </div>
            )}
          </div>
        </div>

        {/* Payment Path Card */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className={`rounded-lg p-6 border-2 ${
            paymentPath === 'prepaid'
              ? 'bg-orange-900/20 border-orange-500'
              : 'bg-green-900/20 border-green-500'
          }`}
        >
          <div className="flex items-start gap-4">
            <div className={`p-3 rounded-lg ${
              paymentPath === 'prepaid'
                ? 'bg-orange-500/20'
                : 'bg-green-500/20'
            }`}>
              {paymentPath === 'prepaid' ? (
                <CreditCard className={`w-6 h-6 ${paymentPath === 'prepaid' ? 'text-orange-400' : 'text-green-400'}`} />
              ) : (
                <Clock className={`w-6 h-6 ${paymentPath === 'prepaid' ? 'text-orange-400' : 'text-green-400'}`} />
              )}
            </div>
            <div className="flex-1">
              <h3 className={`font-bold text-lg mb-1 ${
                paymentPath === 'prepaid' ? 'text-orange-200' : 'text-green-200'
              }`}>
                {paymentPath === 'prepaid' ? 'Prepaid' : `NET ${netDays} Days`}
              </h3>
              <p className={`text-sm ${
                paymentPath === 'prepaid' ? 'text-orange-300' : 'text-green-300'
              }`}>
                {paymentPath === 'prepaid'
                  ? 'You will be charged after processing completes. You can review and adjust the total before payment.'
                  : `Invoice will be raised and due in ${netDays} days. No payment required now.`}
              </p>

              {paymentPath === 'net' && availableCredit && (
                <div className="mt-3 text-sm">
                  <p className="text-green-400">
                    Available Credit: <span className="font-semibold">£{availableCredit}</span>
                  </p>
                </div>
              )}
            </div>
          </div>
        </motion.div>

        {/* Estimated Cost */}
        {uploadResult.computed_total !== undefined && (
          <div className="bg-slate-700/50 border border-slate-600 rounded-lg p-6">
            <h3 className="font-semibold text-white mb-4">Estimated Cost</h3>
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-slate-300">Subtotal:</span>
                <span className="text-white font-medium">
                  £{parseFloat(uploadResult.computed_total || 0).toFixed(2)}
                </span>
              </div>
              {uploadResult.bulk_discount_pct > 0 && (
                <>
                  <div className="flex justify-between items-center text-green-400">
                    <span>Bulk Discount ({uploadResult.bulk_discount_pct}%):</span>
                    <span className="font-medium">
                      -£{(parseFloat(uploadResult.computed_total) * uploadResult.bulk_discount_pct / 100).toFixed(2)}
                    </span>
                  </div>
                  <div className="border-t border-slate-600 pt-3 flex justify-between items-center">
                    <span className="font-semibold text-white">Total:</span>
                    <span className="text-lg font-bold text-orange-400">
                      £{(parseFloat(uploadResult.effective_total || uploadResult.computed_total)).toFixed(2)}
                    </span>
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {/* Warning if partial */}
        {uploadResult.status === 'partial' && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-yellow-900/20 border border-yellow-700 rounded-lg p-4 flex gap-3"
          >
            <AlertCircle className="w-5 h-5 text-yellow-400 flex-shrink-0 mt-0.5" />
            <div>
              <h4 className="font-semibold text-yellow-200 mb-1">Some rows may have issues</h4>
              <p className="text-sm text-yellow-300">
                Some rows may not be valid. You'll see a detailed error report after processing.
              </p>
            </div>
          </motion.div>
        )}

        {/* Info Box */}
        <div className="bg-blue-900/20 border border-blue-800 rounded-lg p-4">
          <h3 className="font-semibold text-blue-200 mb-2">📋 Next Steps</h3>
          <ol className="text-sm text-blue-300 space-y-1 list-decimal list-inside">
            <li>Click "Process" to start processing your batch</li>
            <li>We'll validate each row and create bookings</li>
            <li>You'll see real-time progress updates</li>
            <li>Once complete, {paymentPath === 'prepaid' ? 'proceed to payment' : 'your invoice will be ready'}</li>
          </ol>
        </div>
      </motion.div>
    </div>
  );
}
