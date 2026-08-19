import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertCircle, CheckCircle2, X } from 'lucide-react';
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
 * Business Profile flow (fixed):
 *   1. User tries to upload → backend returns BUSINESS_PROFILE_REQUIRED error
 *   2. isBusinessProfileRequired=true → auto-opens BusinessProfileOnboarding modal
 *   3a. Profile created successfully:
 *       - clearError() clears the uploadError so isBusinessProfileRequired → false
 *       - Notification banner disappears
 *       - Bulk Upload modal becomes freely closeable
 *       - Success banner is shown briefly so the user gets clear feedback
 *   3b. Profile form has validation errors:
 *       - Error is shown inside BusinessProfileOnboarding (not here)
 *   4. User can now close the Bulk Upload modal and re-start the upload flow
 */
export default function BulkUploadWizard({ onSuccess = () => {}, onClose = () => {} }) {
  const hook = useBulkUpload();

  // uploadError is a plain string | null (or a billing-gate object).
  const { uploadError, clearError } = hook;

  const [showProfileModal, setShowProfileModal] = useState(false);
  // Latch: records a manual dismissal so the modal doesn't re-open on the
  // same error. Reset when the error clears (profile was created or user reset).
  const [profileModalDismissed, setProfileModalDismissed] = useState(false);

  // Success banner: shown after a profile is created so the user gets clear
  // feedback before starting (or restarting) the upload.
  const [profileSuccessBanner, setProfileSuccessBanner] = useState(false);

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

  // Auto-dismiss the success banner after 4 s.
  useEffect(() => {
    if (!profileSuccessBanner) return;
    const t = setTimeout(() => setProfileSuccessBanner(false), 4000);
    return () => clearTimeout(t);
  }, [profileSuccessBanner]);

  // ── Handle profile creation success ──────────────────────────────────────
  const handleProfileSuccess = () => {
    // Clear the uploadError so isBusinessProfileRequired becomes false.
    // This removes the "Business Profile Required" notification and lets the
    // user close the Bulk Upload modal freely.
    clearError();
    setShowProfileModal(false);
    setProfileModalDismissed(false);
    setProfileSuccessBanner(true);
  };

  // ── Handle profile modal dismiss (× button or backdrop click) ────────────
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

      {/* Business Profile Required notification banner
          Only visible when the modal is dismissed but the error is still active.
          Gives the user a way to re-open the profile form without reloading. */}
      <AnimatePresence>
        {isBusinessProfileRequired && !showProfileModal && (
          <motion.div
            key="bp-required-banner"
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="fixed top-4 right-4 max-w-md bg-warning-surface border border-warning/30 rounded-lg p-4 shadow-lg z-40"
          >
            <div className="flex gap-3">
              <AlertCircle className="w-5 h-5 text-warning flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="font-semibold text-warning text-sm">
                  Business Profile Required
                </p>
                <p className="text-sm text-warning dark:text-warning/80 mt-1">
                  {uploadError}
                </p>
                <motion.button
                  onClick={() => {
                    setProfileModalDismissed(false);
                    setShowProfileModal(true);
                  }}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className="mt-3 px-4 py-2 bg-warning hover:bg-warning text-warning-foreground rounded-lg font-medium text-sm transition flex items-center gap-2"
                >
                  Set Up Business Profile
                </motion.button>
              </div>
              {/* Allow dismissing the notification without re-opening the form */}
              <button
                onClick={handleProfileClose}
                aria-label="Dismiss notification"
                className="p-1 rounded hover:bg-warning/20 transition-colors flex-shrink-0"
              >
                <X className="w-4 h-4 text-warning" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Profile created successfully banner */}
      <AnimatePresence>
        {profileSuccessBanner && (
          <motion.div
            key="bp-success-banner"
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="fixed top-4 right-4 max-w-md bg-success/10 border border-success/30 rounded-lg p-4 shadow-lg z-40"
          >
            <div className="flex gap-3 items-start">
              <CheckCircle2 className="w-5 h-5 text-success flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="font-semibold text-success text-sm">
                  Business Profile Created
                </p>
                <p className="text-sm text-success/80 mt-1">
                  Your profile has been submitted for review. You can close
                  this window and re-start the upload once it&apos;s approved.
                </p>
              </div>
              <button
                onClick={() => setProfileSuccessBanner(false)}
                aria-label="Dismiss"
                className="p-1 rounded hover:bg-success/20 transition-colors flex-shrink-0"
              >
                <X className="w-4 h-4 text-success" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
