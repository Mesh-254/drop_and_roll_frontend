"use client";

import { useState, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  AlertTriangle,
  X,
  Loader2,
  CheckCircle2,
} from "lucide-react";
import { toast } from "react-hot-toast";
import driverApi from "../../api/driver-api";

// Dynamic failure reasons based on failure type
const FAILURE_REASONS_MAP = {
  pickup: [
    { value: "business_closed", label: "Business Closed" },
    { value: "items_not_ready", label: "Items Not Ready" },
    { value: "unable_to_locate", label: "Unable to Locate Pickup Point" },
    { value: "vehicle_size_mismatch", label: "Vehicle Size Mismatch" },
    { value: "other", label: "Other" },
  ],
  delivery: [
    { value: "customer_not_available", label: "Customer Not Available" },
    { value: "refused_by_recipient", label: "Refused by Recipient" },
    { value: "incorrect_address", label: "Incorrect Address" },
    { value: "access_denied", label: "Access Denied" },
    { value: "other", label: "Other" },
  ],
};

export function FailureReportModal({
  isOpen,
  jobId,
  jobTitle,
  failureType = "delivery", // 'pickup' or 'delivery'
  onClose,
  onSuccess,
}) {
  const [reason, setReason] = useState("");
  const [notes, setNotes] = useState("");
  const [returnToHub, setReturnToHub] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Get dynamic reasons based on failure type
  const failureReasons = useMemo(
    () => FAILURE_REASONS_MAP[failureType] || FAILURE_REASONS_MAP.delivery,
    [failureType]
  );

  // Get modal title based on failure type
  const modalTitle = useMemo(
    () => (failureType === "pickup" ? "Report Pickup Issue" : "Report Delivery Issue"),
    [failureType]
  );

  // Get context message based on failure type
  const contextMessage = useMemo(() => {
    if (failureType === "pickup") {
      return "Once you report this pickup issue, the job status will be updated and the package may be reassigned.";
    }
    return "Once you report this delivery issue, the job status will be updated and removed from your active list.";
  }, [failureType]);

  const handleSubmit = useCallback(
    async (e) => {
      e.preventDefault();

      // Validation
      if (!reason.trim()) {
        toast.error("Please select a failure reason");
        return;
      }

      if (!notes.trim()) {
        toast.error("Please provide notes about the issue");
        return;
      }

      setIsSubmitting(true);

      try {
        // Call DriverAPI to record failure with failure type context
        const result = await driverApi.recordFailure(jobId, {
          reason,
          notes,
          return_to_hub: returnToHub,
          failure_type: failureType, // Include failure type for backend categorization
        });

        if (!result.success) {
          toast.error(result.message || "Failed to record failure");
          return;
        }

        // Success: Show toast and trigger callback
        toast.success("Failure recorded successfully");
        
        // Call parent callback to refresh jobs and close modal
        if (onSuccess) {
          onSuccess(result.data);
        }

        // Close modal
        onClose();
        
        // Reset form
        setReason("");
        setNotes("");
        setReturnToHub(true);
      } catch (error) {
        console.error("[FailureReportModal] Unexpected error:", error);
        toast.error("An unexpected error occurred");
      } finally {
        setIsSubmitting(false);
      }
    },
    [jobId, reason, notes, returnToHub, failureType, onClose, onSuccess]
  );

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="sticky top-0 bg-gradient-to-r from-slate-900 to-slate-800 text-white p-6 flex items-center justify-between border-b border-slate-700">
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-lg ${failureType === "pickup" ? "bg-amber-500/20" : "bg-orange-500/20"}`}>
                  <AlertTriangle className={`w-5 h-5 ${failureType === "pickup" ? "text-amber-500" : "text-orange-500"}`} />
                </div>
                <div>
                  <h2 className="text-xl font-bold">{modalTitle}</h2>
                  <p className="text-sm text-slate-400 mt-1">{jobTitle}</p>
                </div>
              </div>
              <button
                onClick={onClose}
                disabled={isSubmitting}
                className="p-2 hover:bg-slate-700 rounded-lg transition-colors disabled:opacity-50"
                aria-label="Close modal"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Form Content */}
            <form onSubmit={handleSubmit} className="p-6 space-y-6">
              {/* Reason Dropdown - Dynamic based on failure type */}
              <div>
                <label htmlFor="reason" className="block text-sm font-semibold text-slate-900 mb-2">
                  Failure Reason * <span className="text-xs text-slate-600">({failureType === "pickup" ? "Pickup" : "Delivery"})</span>
                </label>
                <select
                  id="reason"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  disabled={isSubmitting}
                  className="w-full px-4 py-2.5 border border-slate-300 rounded-lg bg-white text-slate-900 focus:border-orange-500 focus:ring-2 focus:ring-orange-500/30 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <option value="">Select a reason...</option>
                  {failureReasons.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Notes Textarea */}
              <div>
                <label htmlFor="notes" className="block text-sm font-semibold text-slate-900 mb-2">
                  Notes *
                </label>
                <textarea
                  id="notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  disabled={isSubmitting}
                  placeholder="Explain what happened and any relevant details..."
                  rows={4}
                  className="w-full px-4 py-2.5 border border-slate-300 rounded-lg bg-white text-slate-900 placeholder-slate-400 focus:border-orange-500 focus:ring-2 focus:ring-orange-500/30 transition-all disabled:opacity-50 disabled:cursor-not-allowed resize-none"
                />
                <p className="text-xs text-slate-500 mt-1">
                  {notes.length}/500 characters
                </p>
              </div>

              {/* Return to Hub Toggle */}
              <div className="flex items-center justify-between p-4 bg-slate-50 rounded-lg border border-slate-200">
                <div>
                  <label htmlFor="return-to-hub" className="text-sm font-semibold text-slate-900">
                    Return to Hub
                  </label>
                  <p className="text-xs text-slate-600 mt-0.5">
                    Are you returning this delivery to the hub?
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setReturnToHub(true)}
                    disabled={isSubmitting}
                    className={`px-4 py-2 rounded-lg font-semibold transition-all disabled:opacity-50 ${
                      returnToHub
                        ? "bg-orange-500 text-white shadow-lg"
                        : "bg-white text-slate-900 border border-slate-300 hover:border-slate-400"
                    }`}
                  >
                    Yes
                  </button>
                  <button
                    type="button"
                    onClick={() => setReturnToHub(false)}
                    disabled={isSubmitting}
                    className={`px-4 py-2 rounded-lg font-semibold transition-all disabled:opacity-50 ${
                      !returnToHub
                        ? "bg-orange-500 text-white shadow-lg"
                        : "bg-white text-slate-900 border border-slate-300 hover:border-slate-400"
                    }`}
                  >
                    No
                  </button>
                </div>
              </div>

              {/* Info Banner - Context-aware message */}
              <div className={`p-4 rounded-lg border ${failureType === "pickup" ? "bg-amber-50 border-amber-200" : "bg-blue-50 border-blue-200"}`}>
                <p className={`text-sm ${failureType === "pickup" ? "text-amber-900" : "text-blue-900"}`}>
                  <span className="font-semibold">Note:</span> {contextMessage}
                </p>
              </div>

              {/* Actions */}
              <div className="flex gap-3 pt-4 border-t border-slate-200">
                <button
                  type="button"
                  onClick={onClose}
                  disabled={isSubmitting}
                  className="flex-1 px-4 py-2.5 border border-slate-300 rounded-lg text-slate-900 font-semibold hover:bg-slate-50 transition-all disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || !reason.trim() || !notes.trim()}
                  className="flex-1 px-4 py-2.5 bg-orange-500 text-white rounded-lg font-semibold hover:bg-orange-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Submitting...
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4" />
                      Report Issue
                    </>
                  )}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
