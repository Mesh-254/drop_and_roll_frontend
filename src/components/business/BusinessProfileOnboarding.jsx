import React, { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, AlertCircle, Loader2 } from 'lucide-react';
import confetti from 'canvas-confetti';
import BusinessApi from '../../api/BusinessApi';

/**
 * BusinessProfileOnboarding — Modal wizard for creating a business profile.
 * 
 * Step 1: Company details (name, registration number, VAT, address)
 * Step 2: Contact details (person, email, phone)
 * Step 3: Payment terms preference (NET terms request + justification)
 *
 * PHASE 3 STEP 7: Now integrates with BusinessApi to create profiles in the backend.
 * Uses modern React hooks (useState, useCallback) for state management and clean component logic.
 * 
 * Props:
 *   onClose: Function to close the modal
 *   onSuccess: Function to call after successful profile creation
 */
export default function BusinessProfileOnboarding({ onClose, onSuccess }) {
  // ── Form state ────────────────────────────────────────────────────────────
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [formData, setFormData] = useState({
    company_name: '',
    company_reg_number: '',
    vat_number: '',
    address: '',
    contact_person: '',
    contact_email: '',
    contact_phone: '',
    net_terms_requested: false,
    net_terms_justification: '',
    requested_package: 'starter',
  });

  // ── Handle form input changes ────────────────────────────────────────────
  const handleChange = useCallback((e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
    // Clear error when user starts typing
    setError(null);
  }, []);

  // ── Submit form to backend ──────────────────────────────────────────────
  const handleSubmit = useCallback(async (e) => {
    e.preventDefault();
    
    // Basic validation
    if (!formData.company_name?.trim()) {
      setError('Company name is required');
      return;
    }

    if (!formData.contact_email?.trim()) {
      setError('Contact email is required');
      return;
    }

    if (formData.net_terms_requested && !formData.net_terms_justification?.trim()) {
      setError('Please explain why you need NET terms');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Submit to backend using BusinessApi
      const response = await BusinessApi.createProfile(formData);
      
      console.log("[v0] Business profile created successfully:", response);
      
      // 🎉 Celebrate with confetti
      confetti({
        particleCount: 120,
        spread: 80,
        origin: { y: 0.6 },
        colors: ['#f97316', '#fb923c', '#fdba74', '#fff7ed', '#22c55e'],
      });
      
      // Brief delay to let confetti be visible before modal closes
      await new Promise(resolve => setTimeout(resolve, 800));
      
      // Call onSuccess callback to trigger auto-retry in bulk upload hook
      onSuccess?.();
      
      // Close modal
      onClose?.();
    } catch (err) {
      console.error("[v0] Failed to create business profile:", err);
      
      const errorMessage = err?.response?.data?.detail || 
                          err?.message || 
                          'Failed to create business profile. Please try again.';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  }, [formData, onSuccess, onClose]);

  // ── Navigate to next step ──────────────────────────────────────────────
  const handleNextStep = useCallback(() => {
    // Validate step 1 before proceeding
    if (step === 1) {
      if (!formData.company_name?.trim()) {
        setError('Company name is required');
        return;
      }
    }
    
    // Validate step 2 before proceeding to step 3
    if (step === 2) {
      if (!formData.contact_person?.trim()) {
        setError('Contact person name is required');
        return;
      }
      if (!formData.contact_email?.trim()) {
        setError('Contact email is required');
        return;
      }
    }
    
    setStep(step + 1);
    setError(null);
  }, [step, formData]);

  // ── Navigate to previous step ──────────────────────────────────────────
  const handlePrevStep = useCallback(() => {
    setStep(Math.max(1, step - 1));
    setError(null);
  }, [step]);

  return (
    <AnimatePresence>
      {/* Bug 1: AnimatePresence derives each child's tracking key via `child.key || ""`.
          Two keyless children (backdrop + modal) both collapsed to "" → React's
          "two children with the same key, ``" warning, which corrupted presence
          reconciliation and blocked the close. Unique, stable keys fix it. */}
      {/* Backdrop — click to close */}
      <motion.div
        key="onboarding-backdrop"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="fixed inset-0 bg-overlay backdrop-blur-sm z-50"
      />

      {/* Modal container */}
      <motion.div
        key="onboarding-modal"
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.9, y: 20 }}
        className="fixed inset-0 flex items-center justify-center z-50 p-4"
      >
        <div className="bg-card dark:bg-surface rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
          {/* Header — sticky */}
          <div className="sticky top-0 bg-card dark:bg-surface border-b border-border px-6 py-4 flex justify-between items-center">
            <div>
              <h2 className="text-xl font-bold text-foreground">
                Set Up Your Business Profile
              </h2>
              <p className="text-sm text-muted-foreground">
                Step {step} of 3
              </p>
            </div>
            {/* Close button */}
            <button
              onClick={onClose}
              disabled={loading}
              className="p-2 hover:bg-muted dark:hover:bg-surface-hover rounded-lg transition text-muted-foreground hover:text-foreground disabled:opacity-50"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Content area */}
          <div className="p-6">
            <AnimatePresence mode="wait">
              {/* STEP 1: Company Details */}
              {step === 1 && (
                <motion.div
                  key="step1"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="space-y-6"
                >
                  <div>
                    <label className="block text-sm font-semibold text-foreground mb-2">
                      Company Name <span className="text-destructive">*</span>
                    </label>
                    <input
                      type="text"
                      name="company_name"
                      value={formData.company_name}
                      onChange={handleChange}
                      placeholder="e.g., Acme Logistics Ltd"
                      className="w-full px-4 py-2.5 border border-border-strong rounded-lg bg-card dark:bg-surface-hover text-foreground placeholder-subtle-foreground focus:ring-2 focus:ring-ring focus:border-transparent transition-all"
                    />
                  </div>

                  {/* Registration Number & VAT Number in grid */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-semibold text-foreground mb-2">
                        Registration Number
                      </label>
                      <input
                        type="text"
                        name="company_reg_number"
                        value={formData.company_reg_number}
                        onChange={handleChange}
                        placeholder="e.g., 12345678"
                        className="w-full px-4 py-2.5 border border-border-strong rounded-lg bg-card dark:bg-surface-hover text-foreground placeholder-subtle-foreground focus:ring-2 focus:ring-ring focus:border-transparent transition-all"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-foreground mb-2">
                        VAT Number
                      </label>
                      <input
                        type="text"
                        name="vat_number"
                        value={formData.vat_number}
                        onChange={handleChange}
                        placeholder="e.g., GB123456789"
                        className="w-full px-4 py-2.5 border border-border-strong rounded-lg bg-card dark:bg-surface-hover text-foreground placeholder-subtle-foreground focus:ring-2 focus:ring-ring focus:border-transparent transition-all"
                      />
                    </div>
                  </div>

                  {/* Business Address */}
                  <div>
                    <label className="block text-sm font-semibold text-foreground mb-2">
                      Business Address
                    </label>
                    <textarea
                      name="address"
                      value={formData.address}
                      onChange={handleChange}
                      placeholder="Full business address"
                      rows={3}
                      className="w-full px-4 py-2.5 border border-border-strong rounded-lg bg-card dark:bg-surface-hover text-foreground placeholder-subtle-foreground focus:ring-2 focus:ring-ring focus:border-transparent resize-none transition-all"
                    />
                  </div>
                </motion.div>
              )}

              {/* STEP 2: Contact Details */}
              {step === 2 && (
                <motion.div
                  key="step2"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="space-y-6"
                >
                  <div>
                    <label className="block text-sm font-semibold text-foreground mb-2">
                      Contact Person Name <span className="text-destructive">*</span>
                    </label>
                    <input
                      type="text"
                      name="contact_person"
                      value={formData.contact_person}
                      onChange={handleChange}
                      placeholder="Full name"
                      className="w-full px-4 py-2.5 border border-border-strong rounded-lg bg-card dark:bg-surface-hover text-foreground placeholder-subtle-foreground focus:ring-2 focus:ring-ring focus:border-transparent transition-all"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-foreground mb-2">
                      Email Address <span className="text-destructive">*</span>
                    </label>
                    <input
                      type="email"
                      name="contact_email"
                      value={formData.contact_email}
                      onChange={handleChange}
                      placeholder="contact@company.com"
                      className="w-full px-4 py-2.5 border border-border-strong rounded-lg bg-card dark:bg-surface-hover text-foreground placeholder-subtle-foreground focus:ring-2 focus:ring-ring focus:border-transparent transition-all"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-foreground mb-2">
                      Phone Number
                    </label>
                    <input
                      type="tel"
                      name="contact_phone"
                      value={formData.contact_phone}
                      onChange={handleChange}
                      placeholder="+44 (0)20 7946 0958"
                      className="w-full px-4 py-2.5 border border-border-strong rounded-lg bg-card dark:bg-surface-hover text-foreground placeholder-subtle-foreground focus:ring-2 focus:ring-ring focus:border-transparent transition-all"
                    />
                  </div>
                </motion.div>
              )}

              {/* STEP 3: Payment Terms */}
              {step === 3 && (
                <motion.div
                  key="step3"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="space-y-6"
                >
                  {/* Info banner */}
                  <div className="p-4 bg-info-surface border border-info/30 rounded-lg">
                    <p className="text-sm text-info">
                      <strong>NET Terms</strong> allows you to pay by invoice (7, 30, or 60 days) instead of paying upfront after each upload. Until your request is approved, your account operates prepaid.
                    </p>
                  </div>

                  {/* NET terms checkbox */}
                  <div>
                    <label className="flex items-center gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        name="net_terms_requested"
                        checked={formData.net_terms_requested}
                        onChange={handleChange}
                        className="w-5 h-5 rounded border-border-strong text-brand-text bg-card dark:bg-surface-hover focus:ring-2 focus:ring-ring/50 transition-all"
                      />
                      <span className="text-foreground font-medium">
                        I would like to request NET payment terms
                      </span>
                    </label>
                  </div>

                  {/* NET terms package + justification (conditionally shown) */}
                  {formData.net_terms_requested && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                    >
                      <label className="block text-sm font-semibold text-foreground mb-2">
                        Package
                      </label>
                      <select
                        name="requested_package"
                        value={formData.requested_package}
                        onChange={handleChange}
                        className="w-full mb-4 px-4 py-2.5 border border-border-strong rounded-lg bg-card dark:bg-surface-hover text-foreground focus:ring-2 focus:ring-ring focus:border-transparent transition-all"
                      >
                        <option value="starter">Starter — £5,000 credit / NET 7</option>
                        <option value="pro">Pro — £25,000 credit / NET 30</option>
                        <option value="enterprise">Enterprise — £100,000 credit / NET 60</option>
                      </select>
                      <label className="block text-sm font-semibold text-foreground mb-2">
                        Please explain your NET terms requirement <span className="text-destructive">*</span>
                      </label>
                      <textarea
                        name="net_terms_justification"
                        value={formData.net_terms_justification}
                        onChange={handleChange}
                        placeholder="E.g., We handle large volume shipments and need flexible payment terms..."
                        rows={4}
                        className="w-full px-4 py-2.5 border border-border-strong rounded-lg bg-card dark:bg-surface-hover text-foreground placeholder-subtle-foreground focus:ring-2 focus:ring-ring focus:border-transparent resize-none transition-all"
                      />
                    </motion.div>
                  )}

                  {/* Approval notice */}
                  <div className="p-4 bg-success-surface border border-success/30 rounded-lg">
                    <p className="text-sm text-success">
                      ✅ Your profile will be submitted for admin approval. You&apos;ll receive an email once approved.
                    </p>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Error banner */}
            {error && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="mt-6 bg-destructive-surface border border-destructive/30 rounded-lg p-4 flex gap-3"
              >
                <AlertCircle className="w-5 h-5 text-destructive flex-shrink-0 mt-0.5" />
                <p className="text-sm text-destructive">{error}</p>
              </motion.div>
            )}
          </div>

          {/* Footer with navigation buttons */}
          <div className="border-t border-border px-6 py-4 bg-muted dark:bg-card flex justify-between gap-4">
            {/* Back button */}
            <motion.button
              onClick={handlePrevStep}
              disabled={step === 1 || loading}
              whileHover={step > 1 && !loading ? { scale: 1.05 } : {}}
              whileTap={step > 1 && !loading ? { scale: 0.95 } : {}}
              className={`px-6 py-2.5 rounded-lg font-medium transition ${
                step === 1 || loading
                  ? 'bg-surface-hover text-subtle-foreground cursor-not-allowed'
                  : 'bg-surface-hover text-foreground hover:bg-surface-hover'
              }`}
            >
              Back
            </motion.button>

            {/* Next or Submit button */}
            {step < 3 ? (
              <motion.button
                onClick={handleNextStep}
                disabled={loading}
                whileHover={!loading ? { scale: 1.05 } : {}}
                whileTap={!loading ? { scale: 0.95 } : {}}
                className="px-6 py-2.5 bg-primary hover:bg-primary-hover text-primary-foreground rounded-lg font-medium transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                Next
              </motion.button>
            ) : (
              <motion.button
                onClick={handleSubmit}
                disabled={loading}
                whileHover={!loading ? { scale: 1.05 } : {}}
                whileTap={!loading ? { scale: 0.95 } : {}}
                className="px-6 py-2.5 bg-success hover:bg-success text-success-foreground rounded-lg font-medium transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                {loading ? 'Creating Profile...' : 'Create Profile'}
              </motion.button>
            )}
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
