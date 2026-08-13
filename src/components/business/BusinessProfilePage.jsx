"use client";

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { 
  Building2, 
  ArrowLeft, 
  Clock, 
  CheckCircle, 
  XCircle,
  CreditCard,
  User,
  Mail,
  Phone,
  MapPin,
  FileText,
  Zap
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useBusinessProfile } from '../../hooks/useBusinessProfile';
import BusinessApi from '../../api/BusinessApi';
import BusinessProfileOnboarding from './BusinessProfileOnboarding';
import NetTermsRequestForm from './NetTermsRequestForm';

/**
 * BusinessProfilePage — Full page view of business profile with edit capability
 */
export default function BusinessProfilePage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { businessProfile, loading, refetch, hasProfile, isApproved, isPending, isRejected } = useBusinessProfile();
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [showNetTermsForm, setShowNetTermsForm] = useState(false);
  const [netTermsRequest, setNetTermsRequest] = useState(null);

  // Fetch latest NET terms request on mount
  useEffect(() => {
    if (!businessProfile) return;
    BusinessApi.getNetTermsRequests()
      .then(data => {
        const results = Array.isArray(data) ? data : (data.results ?? []);
        if (results.length > 0) setNetTermsRequest(results[0]);
      })
      .catch(() => {}); // non-critical
  }, [businessProfile]);

  // Status badge configuration
  const getStatusConfig = () => {
    if (isApproved) {
      return {
        icon: CheckCircle,
        text: 'Approved',
        className: 'bg-success/20 text-success border-success/30',
        description: 'Your business profile has been approved. You can now access all business features.',
      };
    }
    if (isRejected) {
      return {
        icon: XCircle,
        text: 'Rejected',
        className: 'bg-destructive/20 text-destructive border-destructive/30',
        description: 'Your profile was not approved. Please contact support for more information.',
      };
    }
    return {
      icon: Clock,
      text: 'Pending Review',
      className: 'bg-warning/20 text-warning border-warning/30',
      description: 'Your profile is being reviewed by our team. This usually takes 1-2 business days.',
    };
  };

  const statusConfig = getStatusConfig();
  const StatusIcon = statusConfig.icon;

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-card to-background pt-24 pb-12">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-center py-20">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
          </div>
        </div>
      </div>
    );
  }

  // No profile - show create prompt
  if (!hasProfile) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-card to-background pt-24 pb-12">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Back Button */}
          <motion.button
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            onClick={() => navigate('/profile')}
            className="flex items-center gap-2 text-muted-foreground hover:text-foreground mb-8 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
            Back to Profile
          </motion.button>

          {/* No Profile Card */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-gradient-to-br from-card to-background border-2 border-primary/30 rounded-2xl p-8 text-center"
          >
            <div className="w-20 h-20 bg-primary/20 rounded-2xl flex items-center justify-center mx-auto mb-6">
              <Building2 className="w-10 h-10 text-brand-text" />
            </div>
            
            <h1 className="text-3xl font-bold text-foreground mb-4">
              No Business Profile Yet
            </h1>
            
            <p className="text-muted-foreground max-w-md mx-auto mb-8">
              Create a business profile to unlock exclusive features like bulk CSV uploads, 
              NET payment terms, and dedicated account management.
            </p>

            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => setShowOnboarding(true)}
              className="px-8 py-4 bg-gradient-to-r from-primary to-primary-hover hover:from-primary-hover hover:to-primary-hover text-primary-foreground font-bold rounded-xl transition-all"
            >
              Create Business Profile
            </motion.button>
          </motion.div>
        </div>

        {/* Onboarding Modal */}
        {showOnboarding && (
          <BusinessProfileOnboarding
            onClose={() => setShowOnboarding(false)}
            onSuccess={() => {
              refetch();
              setShowOnboarding(false);
            }}
          />
        )}
      </div>
    );
  }

  // Profile exists - show details
  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-card to-background pt-24 pb-12">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Back Button */}
        <motion.button
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          onClick={() => navigate('/profile')}
          className="flex items-center gap-2 text-muted-foreground hover:text-foreground mb-8 transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
          Back to Profile
        </motion.button>

        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-start justify-between mb-8"
        >
          <div>
            <h1 className="text-4xl font-bold text-foreground mb-2">Business Profile</h1>
            <p className="text-muted-foreground">Manage your business account details</p>
          </div>
          
          {/* Status Badge */}
          <div className={`flex items-center gap-2 px-4 py-2 rounded-full border ${statusConfig.className}`}>
            <StatusIcon className="w-4 h-4" />
            <span className="font-bold text-sm">{statusConfig.text}</span>
          </div>
        </motion.div>

        {/* Status Alert */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className={`mb-8 p-4 rounded-xl border ${
            isApproved 
              ? 'bg-success/10 border-success/30' 
              : isRejected 
              ? 'bg-destructive/10 border-destructive/30'
              : 'bg-warning/10 border-warning/30'
          }`}
        >
          <div className="flex items-center gap-3">
            <StatusIcon className={`w-5 h-5 ${
              isApproved ? 'text-success' : isRejected ? 'text-destructive' : 'text-warning'
            }`} />
            <p className={`text-sm ${
              isApproved ? 'text-success' : isRejected ? 'text-destructive' : 'text-warning'
            }`}>
              {statusConfig.description}
            </p>
          </div>
        </motion.div>

        {/* Profile Details Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Company Details Card */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="bg-gradient-to-br from-card to-background border-2 border-primary/20 rounded-2xl p-6"
          >
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 bg-primary/20 rounded-lg flex items-center justify-center">
                <Building2 className="w-5 h-5 text-brand-text" />
              </div>
              <h3 className="text-lg font-bold text-foreground">Company Details</h3>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-xs text-subtle-foreground uppercase tracking-wider">Company Name</label>
                <p className="text-foreground font-medium mt-1">{businessProfile.company_name}</p>
              </div>
              
              {businessProfile.company_reg_number && (
                <div>
                  <label className="text-xs text-subtle-foreground uppercase tracking-wider">Registration Number</label>
                  <p className="text-foreground font-medium mt-1">{businessProfile.company_reg_number}</p>
                </div>
              )}
              
              {businessProfile.vat_number && (
                <div>
                  <label className="text-xs text-subtle-foreground uppercase tracking-wider">VAT Number</label>
                  <p className="text-foreground font-medium mt-1">{businessProfile.vat_number}</p>
                </div>
              )}
              
              {businessProfile.address && (
                <div>
                  <label className="text-xs text-subtle-foreground uppercase tracking-wider flex items-center gap-1">
                    <MapPin className="w-3 h-3" /> Address
                  </label>
                  <p className="text-foreground font-medium mt-1">{businessProfile.address}</p>
                </div>
              )}
            </div>
          </motion.div>

          {/* Contact Details Card */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="bg-gradient-to-br from-card to-background border-2 border-primary/20 rounded-2xl p-6"
          >
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 bg-info/20 rounded-lg flex items-center justify-center">
                <User className="w-5 h-5 text-info" />
              </div>
              <h3 className="text-lg font-bold text-foreground">Contact Information</h3>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-xs text-subtle-foreground uppercase tracking-wider flex items-center gap-1">
                  <User className="w-3 h-3" /> Contact Person
                </label>
                <p className="text-foreground font-medium mt-1">{businessProfile.contact_person}</p>
              </div>
              
              <div>
                <label className="text-xs text-subtle-foreground uppercase tracking-wider flex items-center gap-1">
                  <Mail className="w-3 h-3" /> Email
                </label>
                <p className="text-foreground font-medium mt-1">{businessProfile.contact_email}</p>
              </div>
              
              {businessProfile.contact_phone && (
                <div>
                  <label className="text-xs text-subtle-foreground uppercase tracking-wider flex items-center gap-1">
                    <Phone className="w-3 h-3" /> Phone
                  </label>
                  <p className="text-foreground font-medium mt-1">{businessProfile.contact_phone}</p>
                </div>
              )}
            </div>
          </motion.div>

          {/* Payment Terms Card */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="bg-gradient-to-br from-card to-background border-2 border-primary/20 rounded-2xl p-6 lg:col-span-2"
          >
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 bg-success/20 rounded-lg flex items-center justify-center">
                <CreditCard className="w-5 h-5 text-success" />
              </div>
              <h3 className="text-lg font-bold text-foreground">Payment Terms</h3>
            </div>

            {/* Bug 2: "NET Terms Approved" must never show while the overall account is not
                approved. The account status (isApproved) and the NET-terms signal are
                independent, so gate the approved badge on BOTH. While the account is under
                review we show a neutral pending notice instead of a contradictory green badge. */}
            {!isApproved ? (
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <Clock className="w-5 h-5 text-warning" />
                  <span className="px-3 py-1 rounded-full text-xs font-bold bg-warning/20 text-warning">
                    Pending Account Review
                  </span>
                </div>
                <div className="bg-surface/50 rounded-xl p-4">
                  <p className="text-sm text-muted-foreground">
                    Your payment terms{netTermsRequest?.status === 'pending' ? ' and NET terms application' : ''} will
                    be finalised once your business account is approved.
                  </p>
                </div>
              </div>
            ) : netTermsRequest?.status === 'approved' || businessProfile.payment_terms !== 'prepaid' ? (
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <CheckCircle className="w-5 h-5 text-success" />
                  <span className="px-3 py-1 rounded-full text-xs font-bold bg-success/20 text-success">
                    NET Terms Approved
                  </span>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
                  <div className="bg-surface/50 rounded-xl p-4">
                    <label className="text-xs text-subtle-foreground uppercase tracking-wider">Credit Limit</label>
                    <p className="text-2xl font-bold text-foreground mt-1">
                      £{businessProfile.credit_limit?.toLocaleString() || '0'}
                    </p>
                  </div>
                  <div className="bg-surface/50 rounded-xl p-4">
                    <label className="text-xs text-subtle-foreground uppercase tracking-wider">Available Credit</label>
                    <p className="text-2xl font-bold text-success mt-1">
                      £{businessProfile.available_credit?.toLocaleString() || businessProfile.credit_limit?.toLocaleString() || '0'}
                    </p>
                  </div>
                  <div className="bg-surface/50 rounded-xl p-4">
                    <label className="text-xs text-subtle-foreground uppercase tracking-wider">Payment Terms</label>
                    <p className="text-2xl font-bold text-foreground mt-1">
                      NET {businessProfile.net_terms_days || 30}
                    </p>
                  </div>
                  <div className="bg-surface/50 rounded-xl p-4">
                    <label className="text-xs text-subtle-foreground uppercase tracking-wider">Outstanding</label>
                    <p className="text-2xl font-bold text-brand-text mt-1">
                      £{businessProfile.outstanding_balance?.toLocaleString() || '0'}
                    </p>
                  </div>
                </div>
              </div>
            ) : netTermsRequest?.status === 'pending' ? (
              /* Pending Review */
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <Clock className="w-5 h-5 text-warning" />
                  <span className="px-3 py-1 rounded-full text-xs font-bold bg-warning/20 text-warning">
                    Under Review
                  </span>
                </div>
                <div className="bg-surface/50 rounded-xl p-4">
                  <p className="text-sm text-muted-foreground">
                    Your application for <strong className="text-foreground">{netTermsRequest.requested_package}</strong> package is being reviewed.
                  </p>
                  <p className="text-xs text-subtle-foreground mt-2">
                    Expected decision: 1–2 business days
                  </p>
                </div>
              </div>
            ) : netTermsRequest?.status === 'rejected' ? (
              /* Rejected */
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <XCircle className="w-5 h-5 text-destructive" />
                  <span className="px-3 py-1 rounded-full text-xs font-bold bg-destructive/20 text-destructive">
                    Application Rejected
                  </span>
                </div>
                {netTermsRequest.rejection_reason && (
                  <div className="bg-destructive-surface border border-destructive/30 rounded-xl p-4">
                    <p className="text-sm text-destructive">{netTermsRequest.rejection_reason}</p>
                  </div>
                )}
                {isApproved && (
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => setShowNetTermsForm(true)}
                    className="w-full py-2 bg-primary hover:bg-primary-hover text-primary-foreground rounded-lg font-medium transition-colors"
                  >
                    Re-apply
                  </motion.button>
                )}
              </div>
            ) : (
              /* No NET terms requested — show CTA */
              isApproved && (
                <div className="space-y-4">
                  <div className="bg-gradient-to-br from-brand-surface/20 to-transparent border border-primary/20 rounded-xl p-6 text-center">
                    <div className="flex justify-center mb-4">
                      <div className="p-3 bg-primary/20 rounded-full">
                        <Zap className="w-6 h-6 text-brand-text" />
                      </div>
                    </div>
                    <h4 className="text-lg font-bold text-foreground mb-2">Unlock NET Payment Terms</h4>
                    <ul className="text-sm text-muted-foreground space-y-2 mb-6 text-left">
                      <li className="flex items-center gap-2">
                        <CheckCircle className="w-4 h-4 text-success flex-shrink-0" />
                        Defer your payment up to 60 days
                      </li>
                      <li className="flex items-center gap-2">
                        <CheckCircle className="w-4 h-4 text-success flex-shrink-0" />
                        Increase your cash flow
                      </li>
                      <li className="flex items-center gap-2">
                        <CheckCircle className="w-4 h-4 text-success flex-shrink-0" />
                        Get a dedicated account manager
                      </li>
                    </ul>
                    <motion.button
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => setShowNetTermsForm(true)}
                      className="w-full py-3 bg-gradient-to-r from-primary to-primary-hover hover:from-primary-hover hover:to-primary-hover text-primary-foreground font-bold rounded-lg transition-all"
                    >
                      Apply for NET Terms
                    </motion.button>
                  </div>
                </div>
              )
            )}
          </motion.div>
        </div>

        {/* Actions */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="mt-8 flex flex-wrap gap-4"
        >
          {isApproved && (
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => navigate('/bulk-upload')}
              className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-primary to-primary-hover hover:from-primary-hover hover:to-primary-hover text-primary-foreground font-bold rounded-xl transition-all"
            >
              Go to Bulk Upload
            </motion.button>
          )}
          
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => navigate('/history')}
            className="flex items-center gap-2 px-6 py-3 bg-surface hover:bg-surface-hover text-foreground font-medium rounded-xl border border-border transition-all"
          >
            View Booking History
          </motion.button>
        </motion.div>
      </div>

      {/* Onboarding Modal */}
      {showOnboarding && (
        <BusinessProfileOnboarding
          onClose={() => setShowOnboarding(false)}
          onSuccess={() => {
            refetch();
            setShowOnboarding(false);
          }}
        />
      )}

      {/* NET Terms Request Form Modal */}
      {showNetTermsForm && (
        <NetTermsRequestForm
          onClose={() => setShowNetTermsForm(false)}
          onSuccess={(req) => {
            setNetTermsRequest(req);
            setShowNetTermsForm(false);
          }}
          existingRequest={netTermsRequest}
        />
      )}
    </div>
  );
}
