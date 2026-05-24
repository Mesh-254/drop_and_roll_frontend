import React from 'react';
import { motion } from 'framer-motion';

/**
 * BulkUploadMetadata — Collect batch name and notes from user.
 */
export default function BulkUploadMetadata({
  batchName,
  setBatchName,
  notes,
  setNotes,
}) {
  return (
    <div>
      <h2 className="text-2xl font-bold text-white mb-2">Batch Details</h2>
      <p className="text-slate-400 mb-8">
        Give your upload a name and add any notes for your reference.
      </p>

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="space-y-6"
      >
        {/* Batch Name */}
        <div>
          <label className="block text-sm font-medium text-slate-200 mb-2">
            Batch Name <span className="text-red-400">*</span>
          </label>
          <input
            type="text"
            value={batchName}
            onChange={(e) => setBatchName(e.target.value)}
            placeholder="e.g., London Q1 Deliveries"
            maxLength={255}
            className="w-full px-4 py-3 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 transition"
          />
          <p className="text-xs text-slate-400 mt-1">
            A unique name to identify this batch (required)
          </p>
        </div>

        {/* Notes */}
        <div>
          <label className="block text-sm font-medium text-slate-200 mb-2">
            Notes (Optional)
          </label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Add any special instructions or references..."
            maxLength={1000}
            rows={4}
            className="w-full px-4 py-3 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 transition resize-none"
          />
          <div className="flex justify-between items-center mt-1">
            <p className="text-xs text-slate-400">
              Add PO reference, special instructions, or notes
            </p>
            <span className="text-xs text-slate-500">
              {notes.length}/1000
            </span>
          </div>
        </div>

        {/* Info Box */}
        <div className="bg-blue-900/20 border border-blue-800 rounded-lg p-4 mt-8">
          <h3 className="font-semibold text-blue-200 mb-2">💡 Tip</h3>
          <p className="text-sm text-blue-300">
            Use batch names like "London-2024-Q1" or "Emergency Stock Replenishment" to easily identify your uploads later.
          </p>
        </div>
      </motion.div>
    </div>
  );
}
