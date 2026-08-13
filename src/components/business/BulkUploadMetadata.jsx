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
      <h2 className="text-2xl font-bold text-foreground mb-2">Batch Details</h2>
      <p className="text-muted-foreground mb-8">
        Give your upload a name and add any notes for your reference.
      </p>

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="space-y-6"
      >
        {/* Batch Name */}
        <div>
          <label className="block text-sm font-medium text-foreground mb-2">
            Batch Name <span className="text-destructive">*</span>
          </label>
          <input
            type="text"
            value={batchName}
            onChange={(e) => setBatchName(e.target.value)}
            placeholder="e.g., London Q1 Deliveries"
            maxLength={255}
            className="w-full px-4 py-3 bg-surface border border-border rounded-lg text-foreground placeholder-subtle-foreground focus:outline-none focus:border-primary focus:ring-2 focus:ring-ring/20 transition"
          />
          <p className="text-xs text-muted-foreground mt-1">
            A unique name to identify this batch (required)
          </p>
        </div>

        {/* Notes */}
        <div>
          <label className="block text-sm font-medium text-foreground mb-2">
            Notes (Optional)
          </label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Add any special instructions or references..."
            maxLength={1000}
            rows={4}
            className="w-full px-4 py-3 bg-surface border border-border rounded-lg text-foreground placeholder-subtle-foreground focus:outline-none focus:border-primary focus:ring-2 focus:ring-ring/20 transition resize-none"
          />
          <div className="flex justify-between items-center mt-1">
            <p className="text-xs text-muted-foreground">
              Add PO reference, special instructions, or notes
            </p>
            <span className="text-xs text-subtle-foreground">
              {notes.length}/1000
            </span>
          </div>
        </div>

        {/* Info Box */}
        <div className="bg-info-surface border border-info/30 rounded-lg p-4 mt-8">
          <h3 className="font-semibold text-info mb-2">💡 Tip</h3>
          <p className="text-sm text-info">
            Use batch names like "London-2024-Q1" or "Emergency Stock Replenishment" to easily identify your uploads later.
          </p>
        </div>
      </motion.div>
    </div>
  );
}
