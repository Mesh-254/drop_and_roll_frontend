import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { X, AlertCircle, CheckCircle2, Loader2, Clock } from 'lucide-react';
import BusinessApi from '../../api/BusinessApi';

// Fallback cards, used only if GET /net-terms-packages/ fails or returns empty
// (e.g. offline, or the admin table is empty mid-migration). The live source of
// truth is the admin-managed NetTermsPackage catalogue — see mapPackage below.
// Values mirror the backend TIER_DEFAULTS seed so the fallback is never wrong.
const FALLBACK_PACKAGES = [
  { id: 'starter', name: 'Starter', limit: '£5,000', terms: 'NET 7', popular: false },
  { id: 'pro', name: 'Pro', limit: '£25,000', terms: 'NET 30', popular: true },
  { id: 'enterprise', name: 'Enterprise', limit: '£100,000', terms: 'NET 60', popular: false },
];

// Map an API NetTermsPackage into the card shape the modal renders.
// slug → id (submitted as requested_package), so the frontend never hardcodes
// tier ids. Money/terms come straight from admin.
function mapPackage(p) {
  return {
    id: p.slug,
    name: p.label,
    limit: `£${Number(p.credit_limit).toLocaleString('en-GB', { maximumFractionDigits: 0 })}`,
    terms: (p.net_terms_label || '').toUpperCase(), // "Net 30" → "NET 30"
    popular: Boolean(p.is_default),
  };
}

/**
 * NetTermsRequestForm — Modal for submitting NET terms requests.
 *
 * Props:
 *   onClose: () => void — close the modal
 *   onSuccess: (request: object) => void — called when request submitted
 *   existingRequest: object | null — shows status if request exists
 *
 * FIXES vs previous version:
 *   1. Re-apply bug: clicking "Re-apply" on the rejected screen previously
 *      only reset formData state but left existingRequest?.status === 'rejected',
 *      so the component stayed on the rejected screen forever.
 *      FIX: added `isReapplying` boolean state — when true, the early-return
 *      for rejected status is skipped and the form renders instead.
 *
 *   2. Approved state showed hardcoded tier limits from the local `packages`
 *      array. On approval the admin can grant different terms to the tier
 *      defaults. FIX: now renders `approved_credit_limit` and
 *      `approved_payment_terms` from the server response when present, with
 *      the tier defaults as a readable fallback.
 */
export default function NetTermsRequestForm({ onClose, onSuccess, existingRequest }) {
  const [formData, setFormData] = useState({
    requested_package: 'pro',
    justification: '',
    expected_monthly_volume: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [justificationLength, setJustificationLength] = useState(0);

  // FIX 1: Track when the user has clicked "Re-apply" so we can show the
  // submission form even though existingRequest?.status is still 'rejected'.
  const [isReapplying, setIsReapplying] = useState(false);

  // Package cards are now admin-managed (NetTermsPackage). Fetch them on mount;
  // fall back to FALLBACK_PACKAGES so the modal always renders.
  const [packages, setPackages] = useState(FALLBACK_PACKAGES);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await BusinessApi.getNetTermsPackages();
        if (cancelled || !Array.isArray(data) || data.length === 0) return;
        const mapped = data.map(mapPackage);
        setPackages(mapped);
        // Keep the selected tier valid against the live list: prefer the current
        // selection, else the admin-flagged default, else the first card.
        setFormData((prev) => {
          if (mapped.some((p) => p.id === prev.requested_package)) return prev;
          const fallback = mapped.find((p) => p.popular) || mapped[0];
          return { ...prev, requested_package: fallback.id };
        });
      } catch {
        // Keep FALLBACK_PACKAGES; the modal stays usable offline / on error.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // ── Pending state ─────────────────────────────────────────────────────────
  if (existingRequest?.status === 'pending' && !isReapplying) {
    const pkg = packages.find((p) => p.id === existingRequest.requested_package);
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50"
      >
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="bg-gray-900 border border-orange-500/30 rounded-2xl max-w-lg w-full p-8 relative"
        >
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-2 hover:bg-gray-800 rounded-lg transition-colors"
          >
            <X className="h-5 w-5 text-gray-400" />
          </button>

          <div className="text-center space-y-4">
            <div className="flex justify-center">
              <div className="p-3 bg-yellow-900/20 border border-yellow-500/30 rounded-full">
                <Clock className="h-8 w-8 text-yellow-400" />
              </div>
            </div>
            <h2 className="text-xl font-bold text-white">Request Under Review</h2>
            <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-4 space-y-2 text-left">
              {pkg && (
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400">Package</span>
                  <span className="text-white font-medium">{pkg.name}</span>
                </div>
              )}
              <div className="flex justify-between text-sm">
                <span className="text-gray-400">Submitted</span>
                <span className="text-white">
                  {new Date(existingRequest.created_at).toLocaleDateString()}
                </span>
              </div>
            </div>
            <p className="text-gray-400 text-sm">
              Under review — you'll receive an email within 1–2 business days.
            </p>
            <button
              onClick={onClose}
              className="w-full py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg font-medium transition-colors"
            >
              Close
            </button>
          </div>
        </motion.div>
      </motion.div>
    );
  }

  // ── Approved state ────────────────────────────────────────────────────────
  // FIX 2: Use actual `approved_credit_limit` and `approved_payment_terms`
  // from the server response rather than hardcoded tier defaults. Admin may
  // grant different terms to what the business applied for.
  if (existingRequest?.status === 'approved' && !isReapplying) {
    const pkg = packages.find((p) => p.id === existingRequest.requested_package);

    // Format approved credit limit — prefer server value, fall back to tier default
    const approvedLimit = existingRequest.approved_credit_limit
      ? `£${parseFloat(existingRequest.approved_credit_limit).toLocaleString('en-GB', { minimumFractionDigits: 0 })}`
      : pkg?.limit ?? '—';

    // Format approved payment terms — prefer server value, fall back to tier default
    const approvedTerms = existingRequest.approved_payment_terms
      ? existingRequest.approved_payment_terms.replace('_', ' ').toUpperCase()
      : pkg?.terms ?? '—';

    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50"
      >
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="bg-gray-900 border border-green-500/30 rounded-2xl max-w-lg w-full p-8 relative"
        >
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-2 hover:bg-gray-800 rounded-lg transition-colors"
          >
            <X className="h-5 w-5 text-gray-400" />
          </button>

          <div className="text-center space-y-4">
            <div className="flex justify-center">
              <div className="p-3 bg-green-900/20 border border-green-500/30 rounded-full">
                <CheckCircle2 className="h-8 w-8 text-green-500" />
              </div>
            </div>
            <h2 className="text-xl font-bold text-white">NET Terms Approved!</h2>
            <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-4 space-y-3 text-left">
              {pkg && (
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400">Package</span>
                  <span className="font-semibold text-white">{pkg.name}</span>
                </div>
              )}
              <div className="flex justify-between text-sm">
                <span className="text-gray-400">Credit Limit</span>
                <span className="font-semibold text-green-400">{approvedLimit}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-400">Payment Terms</span>
                <span className="font-semibold text-white">{approvedTerms}</span>
              </div>
              {existingRequest.reviewed_at && (
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400">Approved On</span>
                  <span className="text-white">
                    {new Date(existingRequest.reviewed_at).toLocaleDateString()}
                  </span>
                </div>
              )}
            </div>
            <p className="text-gray-400 text-sm">
              Your account now has NET payment terms enabled.
            </p>
            <button
              onClick={onClose}
              className="w-full py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg font-medium transition-colors"
            >
              Close
            </button>
          </div>
        </motion.div>
      </motion.div>
    );
  }

  // ── Rejected state ────────────────────────────────────────────────────────
  // FIX 1 continued: only show this screen if NOT re-applying.
  if (existingRequest?.status === 'rejected' && !isReapplying) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50"
      >
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="bg-gray-900 border border-red-500/30 rounded-2xl max-w-lg w-full p-8 relative"
        >
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-2 hover:bg-gray-800 rounded-lg transition-colors"
          >
            <X className="h-5 w-5 text-gray-400" />
          </button>

          <div className="text-center space-y-4">
            <div className="flex justify-center">
              <div className="p-3 bg-red-900/20 border border-red-500/30 rounded-full">
                <AlertCircle className="h-8 w-8 text-red-500" />
              </div>
            </div>
            <h2 className="text-xl font-bold text-white">Application Rejected</h2>
            {existingRequest.rejection_reason && (
              <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-4 text-left">
                <p className="text-sm text-gray-300">
                  <strong>Reason:</strong> {existingRequest.rejection_reason}
                </p>
              </div>
            )}
            <p className="text-xs text-gray-500">
              You may re-apply after 30 days or contact support for assistance.
            </p>
            <div className="flex gap-3">
              <button
                onClick={onClose}
                className="flex-1 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg font-medium transition-colors"
              >
                Close
              </button>
              <button
                onClick={() => {
                  // FIX 1: Set isReapplying=true so we fall through to the
                  // form render below instead of hitting this early-return again.
                  setIsReapplying(true);
                  setFormData({
                    requested_package: 'pro',
                    justification: '',
                    expected_monthly_volume: '',
                  });
                  setJustificationLength(0);
                  setError(null);
                }}
                className="flex-1 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg font-medium transition-colors"
              >
                Re-apply
              </button>
            </div>
          </div>
        </motion.div>
      </motion.div>
    );
  }

  // ── Submission form ───────────────────────────────────────────────────────
  const handleSubmitForm = async (e) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const payload = {
        requested_package: formData.requested_package,
        justification: formData.justification,
      };
      if (formData.expected_monthly_volume) {
        payload.expected_monthly_volume = parseInt(formData.expected_monthly_volume, 10);
      }

      const response = await BusinessApi.submitNetTermsRequest(payload);
      onSuccess(response.request || response);
    } catch (err) {
      const errorData = err?.response?.data;
      if (err?.response?.status === 400 && errorData?.non_field_errors) {
        setError(
          Array.isArray(errorData.non_field_errors)
            ? errorData.non_field_errors[0]
            : errorData.non_field_errors,
        );
      } else {
        setError(errorData?.detail || 'Failed to submit request. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50"
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="bg-gray-900 border border-orange-500/30 rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-8 relative"
      >
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 hover:bg-gray-800 rounded-lg transition-colors"
        >
          <X className="h-5 w-5 text-gray-400" />
        </button>

        <h2 className="text-2xl font-bold text-white mb-2">Apply for NET Payment Terms</h2>
        {isReapplying && (
          <p className="text-sm text-orange-400 mb-4">
            Re-applying after previous rejection.
          </p>
        )}

        {error && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-6 p-4 bg-red-900/20 border border-red-500/30 rounded-lg flex gap-3"
          >
            <AlertCircle className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-red-400">{error}</p>
          </motion.div>
        )}

        <form onSubmit={handleSubmitForm} className="space-y-8 mt-6">
          {/* Package Selector */}
          <div>
            <label className="block text-sm font-semibold text-white mb-4">
              Select Package *
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {packages.map((pkg) => (
                <button
                  key={pkg.id}
                  type="button"
                  onClick={() =>
                    setFormData({ ...formData, requested_package: pkg.id })
                  }
                  className={`relative p-6 rounded-xl border-2 transition-all text-left ${
                    formData.requested_package === pkg.id
                      ? 'border-orange-500 bg-orange-500/10 shadow-lg shadow-orange-500/20'
                      : 'border-gray-700 bg-gray-800/60 hover:border-orange-400'
                  }`}
                >
                  {pkg.popular && (
                    <div className="absolute top-2 right-2 px-2 py-1 bg-orange-500 text-white text-xs font-bold rounded">
                      Most Popular
                    </div>
                  )}
                  <h3 className="font-bold text-white mb-3">{pkg.name}</h3>
                  <div className="space-y-2 text-xs text-gray-300">
                    <p>
                      <strong>Limit:</strong> {pkg.limit}
                    </p>
                    <p>
                      <strong>Terms:</strong> {pkg.terms}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Justification */}
          <div>
            <label className="block text-sm font-semibold text-white mb-2">
              Business Justification *
            </label>
            <textarea
              value={formData.justification}
              onChange={(e) => {
                const val = e.target.value;
                setFormData({ ...formData, justification: val });
                setJustificationLength(val.length);
              }}
              placeholder="Explain your business need for NET payment terms (minimum 50 characters)..."
              minLength={50}
              rows={4}
              className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:ring-2 focus:ring-orange-500 focus:border-transparent resize-none transition-all"
            />
            <div className="flex items-end justify-between mt-2">
              <p
                className={`text-xs ${
                  justificationLength < 50 ? 'text-red-400' : 'text-green-400'
                }`}
              >
                {justificationLength < 50
                  ? `${50 - justificationLength} more characters required`
                  : '✓ Valid'}
              </p>
              <span className="text-xs text-gray-500">{justificationLength}/1000</span>
            </div>
          </div>

          {/* Monthly Volume */}
          <div>
            <label className="block text-sm font-semibold text-white mb-2">
              Estimated Monthly Volume (Optional)
            </label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500">
                £
              </span>
              <input
                type="number"
                value={formData.expected_monthly_volume}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    expected_monthly_volume: e.target.value,
                  })
                }
                placeholder="e.g. 5000"
                className="w-full pl-8 pr-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-all"
              />
            </div>
          </div>

          {/* Submit */}
          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-3 bg-gray-700 hover:bg-gray-600 text-white rounded-lg font-medium transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={
                loading ||
                !formData.requested_package ||
                formData.justification.length < 50
              }
              className="flex-1 py-3 bg-orange-500 hover:bg-orange-600 disabled:bg-gray-600 text-white rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
            >
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              {loading ? 'Submitting...' : 'Submit Request'}
            </button>
          </div>
        </form>
      </motion.div>
    </motion.div>
  );
}
