import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { AlertCircle, CheckCircle2, Loader2 } from 'lucide-react';
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
  const {
    isBusinessProfileRequired,
    isProfileCreating,
    uploadError,
    retryPendingAction,
  } = hook;

  // Track if BusinessProfileOnboarding modal should be visible
  const [showProfileModal, setShowProfileModal] = useState(false);

  // ── Auto-show profile modal when BUSINESS_PROFILE_REQUIRED is detected ────
  useEffect(() => {
    if (isBusinessProfileRequired && !showProfileModal) {
      console.log('[v0] Opening BusinessProfileOnboarding modal due to BUSINESS_PROFILE_REQUIRED error');
      setShowProfileModal(true);
    }
  }, [isBusinessProfileRequired, showProfileModal]);

  // ── Handle profile creation success ────────────────────────────────────
  const handleProfileSuccess = async () => {
    console.log('[v0] BusinessProfile created successfully, closing modal and retrying...');
    setShowProfileModal(false);
    
    // Auto-retry the pending action after a brief delay to allow state to settle
    await new Promise(resolve => setTimeout(resolve, 500));
    await retryPendingAction();
  };

  // ── Handle profile modal close ────────────────────────────────────────
  const handleProfileClose = () => {
    console.log('[v0] BusinessProfileOnboarding modal closed by user');
    setShowProfileModal(false);
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
      {uploadError?.code === 'BUSINESS_PROFILE_REQUIRED' && !showProfileModal && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="fixed top-4 right-4 max-w-md bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-900/50 rounded-lg p-4 shadow-lg z-40"
        >
          <div className="flex gap-3">
            <AlertCircle className="w-5 h-5 text-yellow-600 dark:text-yellow-400 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="font-semibold text-yellow-800 dark:text-yellow-300 text-sm">
                {uploadError.title}
              </p>
              <p className="text-sm text-yellow-700 dark:text-yellow-300/80 mt-1">
                {uploadError.message}
              </p>
              {uploadError.actionUrl && (
                <motion.button
                  onClick={() => setShowProfileModal(true)}
                  disabled={isProfileCreating}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className="mt-3 px-4 py-2 bg-yellow-600 hover:bg-yellow-700 text-white rounded-lg font-medium text-sm transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {isProfileCreating && <Loader2 className="w-4 h-4 animate-spin" />}
                  {uploadError.actionLabel || 'Set Up Business Profile'}
                </motion.button>
              )}
            </div>
          </div>
        </motion.div>
      )}
    </>
  );
}
