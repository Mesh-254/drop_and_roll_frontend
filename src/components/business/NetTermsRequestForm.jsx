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
        className="fixed inset-0 bg-overlay flex items-center justify-center p-4 z-50"
      >
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="bg-card border border-primary/30 rounded-2xl max-w-lg w-full p-8 relative"
        >
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-2 hover:bg-surface rounded-lg transition-colors"
          >
            <X className="h-5 w-5 text-muted-foreground" />
          </button>

          <div className="text-center space-y-4">
            <div className="flex justify-center">
              <div className="p-3 bg-warning-surface border border-warning/30 rounded-full">
                <Clock className="h-8 w-8 text-warning" />
              </div>
            </div>
            <h2 className="text-xl font-bold text-foreground">Request Under Review</h2>
            <div className="bg-surface/50 border border-border rounded-lg p-4 space-y-2 text-left">
              {pkg && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Package</span>
                  <span className="text-foreground font-medium">{pkg.name}</span>
                </div>
              )}
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Submitted</span>
                <span className="text-foreground">
                  {new Date(existingRequest.created_at).toLocaleDateString()}
                </span>
              </div>
            </div>
            <p className="text-muted-foreground text-sm">
              Under review — you'll receive an email within 1–2 business days.
            </p>
            <button
              onClick={onClose}
              className="w-full py-2 bg-primary hover:bg-primary-hover text-primary-foreground rounded-lg font-medium transition-colors"
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
        className="fixed inset-0 bg-overlay flex items-center justify-center p-4 z-50"
      >
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="bg-card border border-success/30 rounded-2xl max-w-lg w-full p-8 relative"
        >
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-2 hover:bg-surface rounded-lg transition-colors"
          >
            <X className="h-5 w-5 text-muted-foreground" />
          </button>

          <div className="text-center space-y-4">
            <div className="flex justify-center">
              <div className="p-3 bg-success-surface border border-success/30 rounded-full">
                <CheckCircle2 className="h-8 w-8 text-success" />
              </div>
            </div>
            <h2 className="text-xl font-bold text-foreground">NET Terms Approved!</h2>
            <div className="bg-surface/50 border border-border rounded-lg p-4 space-y-3 text-left">
              {pkg && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Package</span>
                  <span className="font-semibold text-foreground">{pkg.name}</span>
                </div>
              )}
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Credit Limit</span>
                <span className="font-semibold text-success">{approvedLimit}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Payment Terms</span>
                <span className="font-semibold text-foreground">{approvedTerms}</span>
              </div>
              {existingRequest.reviewed_at && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Approved On</span>
                  <span className="text-foreground">
                    {new Date(existingRequest.reviewed_at).toLocaleDateString()}
                  </span>
                </div>
              )}
            </div>
            <p className="text-muted-foreground text-sm">
              Your account now has NET payment terms enabled.
            </p>
            <button
              onClick={onClose}
              className="w-full py-2 bg-primary hover:bg-primary-hover text-primary-foreground rounded-lg font-medium transition-colors"
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
        className="fixed inset-0 bg-overlay flex items-center justify-center p-4 z-50"
      >
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="bg-card border border-destructive/30 rounded-2xl max-w-lg w-full p-8 relative"
        >
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-2 hover:bg-surface rounded-lg transition-colors"
          >
            <X className="h-5 w-5 text-muted-foreground" />
          </button>

          <div className="text-center space-y-4">
            <div className="flex justify-center">
              <div className="p-3 bg-destructive-surface border border-destructive/30 rounded-full">
                <AlertCircle className="h-8 w-8 text-destructive" />
              </div>
            </div>
            <h2 className="text-xl font-bold text-foreground">Application Rejected</h2>
            {existingRequest.rejection_reason && (
              <div className="bg-surface/50 border border-border rounded-lg p-4 text-left">
                <p className="text-sm text-muted-foreground">
                  <strong>Reason:</strong> {existingRequest.rejection_reason}
                </p>
              </div>
            )}
            <p className="text-xs text-subtle-foreground">
              You may re-apply after 30 days or contact support for assistance.
            </p>
            <div className="flex gap-3">
              <button
                onClick={onClose}
                className="flex-1 py-2 bg-surface-hover hover:bg-surface-hover text-foreground rounded-lg font-medium transition-colors"
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
                className="flex-1 py-2 bg-primary hover:bg-primary-hover text-primary-foreground rounded-lg font-medium transition-colors"
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
      className="fixed inset-0 bg-overlay flex items-center justify-center p-4 z-50"
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="bg-card border border-primary/30 rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-8 relative"
      >
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 hover:bg-surface rounded-lg transition-colors"
        >
          <X className="h-5 w-5 text-muted-foreground" />
        </button>

        <h2 className="text-2xl font-bold text-foreground mb-2">Apply for NET Payment Terms</h2>
        {isReapplying && (
          <p className="text-sm text-brand-text mb-4">
            Re-applying after previous rejection.
          </p>
        )}

        {error && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-6 p-4 bg-destructive-surface border border-destructive/30 rounded-lg flex gap-3"
          >
            <AlertCircle className="h-5 w-5 text-destructive flex-shrink-0 mt-0.5" />
            <p className="text-sm text-destructive">{error}</p>
          </motion.div>
        )}

        <form onSubmit={handleSubmitForm} className="space-y-8 mt-6">
          {/* Package Selector */}
          <div>
            <label className="block text-sm font-semibold text-foreground mb-4">
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
                      ? 'border-primary bg-primary/10 shadow-lg shadow-primary/20'
                      : 'border-border bg-surface/60 hover:border-primary'
                  }`}
                >
                  {pkg.popular && (
                    <div className="absolute top-2 right-2 px-2 py-1 bg-primary text-primary-foreground text-xs font-bold rounded">
                      Most Popular
                    </div>
                  )}
                  <h3 className="font-bold text-foreground mb-3">{pkg.name}</h3>
                  <div className="space-y-2 text-xs text-muted-foreground">
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
            <label className="block text-sm font-semibold text-foreground mb-2">
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
              className="w-full px-4 py-3 bg-surface border border-border rounded-lg text-foreground placeholder-subtle-foreground focus:ring-2 focus:ring-ring focus:border-transparent resize-none transition-all"
            />
            <div className="flex items-end justify-between mt-2">
              <p
                className={`text-xs ${
                  justificationLength < 50 ? 'text-destructive' : 'text-success'
                }`}
              >
                {justificationLength < 50
                  ? `${50 - justificationLength} more characters required`
                  : '✓ Valid'}
              </p>
              <span className="text-xs text-subtle-foreground">{justificationLength}/1000</span>
            </div>
          </div>

          {/* Monthly Volume */}
          <div>
            <label className="block text-sm font-semibold text-foreground mb-2">
              Estimated Monthly Volume (Optional)
            </label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-subtle-foreground">
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
                className="w-full pl-8 pr-4 py-3 bg-surface border border-border rounded-lg text-foreground placeholder-subtle-foreground focus:ring-2 focus:ring-ring focus:border-transparent transition-all"
              />
            </div>
          </div>

          {/* Submit */}
          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-3 bg-surface-hover hover:bg-surface-hover text-foreground rounded-lg font-medium transition-colors"
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
              className="flex-1 py-3 bg-primary hover:bg-primary-hover disabled:bg-surface-hover text-primary-foreground rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
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
