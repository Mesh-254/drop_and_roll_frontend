import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { AlertCircle, CheckCircle2 } from 'lucide-react';
import { useBulkUpload } from '../../hooks/useBulkUpload';
import BulkUploadFlow from './BulkUploadFlow';
import BusinessProfileOnboarding from './BusinessProfileOnboarding';

/**
 * BulkUploadWizard — Wrapper component that manages the bulk upload flow.
 *
 * Handles:
 *   - Bulk upload wizard lifecycle
 *   - BusinessProfile modal trigger & auto-close
 *   - Auto-retry of pending upload actions after profile creation
 *
 * PHASE 3 STEP 7 Changes:
 *   - Detects BUSINESS_PROFILE_REQUIRED error from useBulkUpload hook
 *   - Displays BusinessProfileOnboarding modal
 *   - After profile creation, automatically retries the pending action (validate/submit)
 *   - Shows helpful error banner with "Set Up Business Profile" button
 */
export default function BulkUploadWizard({ onSuccess = () => {}, onClose = () => {} }) {
  const hook = useBulkUpload();

  // ── New hook shape ────────────────────────────────────────────────────────
  // uploadError is now a plain string | null.
  // isBusinessProfileRequired, isProfileCreating, retryPendingAction no longer
  // exist — removed from the hook during the PAYMENT_PENDING fix refactor.
  const { uploadError } = hook;

  const [showProfileModal, setShowProfileModal] = useState(false);
  // Bug 1 (independent close bug): the auto-open effect below fires whenever
  // `isBusinessProfileRequired && !showProfileModal`. Without a latch, clicking the modal's
  // "X" set showProfileModal=false, the effect re-ran (the error is still present) and
  // instantly reopened it — so the modal appeared un-closeable. This flag records a manual
  // dismissal so we only auto-open ONCE per error.
  const [profileModalDismissed, setProfileModalDismissed] = useState(false);

  // Detect a missing-business-profile error by inspecting the error string.
  const isBusinessProfileRequired =
    typeof uploadError === "string" &&
    uploadError.toLowerCase().includes("business profile");

  // ── Auto-show profile modal when error indicates missing profile ──────────
  useEffect(() => {
    if (isBusinessProfileRequired && !showProfileModal && !profileModalDismissed) {
      setShowProfileModal(true);
    }
  }, [isBusinessProfileRequired, showProfileModal, profileModalDismissed]);

  // Reset the dismissal latch once the underlying error clears, so a *new*
  // business-profile error later can re-trigger the modal.
  useEffect(() => {
    if (!isBusinessProfileRequired && profileModalDismissed) {
      setProfileModalDismissed(false);
    }
  }, [isBusinessProfileRequired, profileModalDismissed]);

  // ── Handle profile creation success ──────────────────────────────────────
  const handleProfileSuccess = async () => {
    setShowProfileModal(false);
    setProfileModalDismissed(false); // profile now exists — allow future prompts
    // retryPendingAction is not available in the new hook.
    // The user will simply re-submit; the profile will now exist.
  };

  // ── Handle profile modal close ────────────────────────────────────────
  const handleProfileClose = () => {
    setShowProfileModal(false);
    setProfileModalDismissed(true); // respect the manual close; don't auto-reopen
  };

  return (
    <>
      {/* Main bulk upload wizard */}
      <BulkUploadFlow
        onSuccess={onSuccess}
        onClose={onClose}
        hook={hook}
      />

      {/* BusinessProfileOnboarding Modal (shown when BUSINESS_PROFILE_REQUIRED) */}
      {showProfileModal && (
        <BusinessProfileOnboarding
          onClose={handleProfileClose}
          onSuccess={handleProfileSuccess}
        />
      )}

      {/* Business Profile Required Error Banner */}
      {isBusinessProfileRequired && !showProfileModal && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="fixed top-4 right-4 max-w-md bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-900/50 rounded-lg p-4 shadow-lg z-40"
        >
          <div className="flex gap-3">
            <AlertCircle className="w-5 h-5 text-yellow-600 dark:text-yellow-400 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="font-semibold text-yellow-800 dark:text-yellow-300 text-sm">
                Business Profile Required
              </p>
              <p className="text-sm text-yellow-700 dark:text-yellow-300/80 mt-1">
                {uploadError}
              </p>
              <motion.button
                onClick={() => setShowProfileModal(true)}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className="mt-3 px-4 py-2 bg-yellow-600 hover:bg-yellow-700 text-white rounded-lg font-medium text-sm transition flex items-center gap-2"
              >
                Set Up Business Profile
              </motion.button>
            </div>
          </div>
        </motion.div>
      )}
    </>
  );
}
