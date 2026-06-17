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
        className: 'bg-green-500/20 text-green-400 border-green-500/30',
        description: 'Your business profile has been approved. You can now access all business features.',
      };
    }
    if (isRejected) {
      return {
        icon: XCircle,
        text: 'Rejected',
        className: 'bg-red-500/20 text-red-400 border-red-500/30',
        description: 'Your profile was not approved. Please contact support for more information.',
      };
    }
    return {
      icon: Clock,
      text: 'Pending Review',
      className: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
      description: 'Your profile is being reviewed by our team. This usually takes 1-2 business days.',
    };
  };

  const statusConfig = getStatusConfig();
  const StatusIcon = statusConfig.icon;

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-black via-gray-900 to-black pt-24 pb-12">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-center py-20">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500"></div>
          </div>
        </div>
      </div>
    );
  }

  // No profile - show create prompt
  if (!hasProfile) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-black via-gray-900 to-black pt-24 pb-12">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Back Button */}
          <motion.button
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            onClick={() => navigate('/profile')}
            className="flex items-center gap-2 text-gray-400 hover:text-white mb-8 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
            Back to Profile
          </motion.button>

          {/* No Profile Card */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-gradient-to-br from-gray-900 to-black border-2 border-orange-500/30 rounded-2xl p-8 text-center"
          >
            <div className="w-20 h-20 bg-orange-500/20 rounded-2xl flex items-center justify-center mx-auto mb-6">
              <Building2 className="w-10 h-10 text-orange-400" />
            </div>
            
            <h1 className="text-3xl font-bold text-white mb-4">
              No Business Profile Yet
            </h1>
            
            <p className="text-gray-400 max-w-md mx-auto mb-8">
              Create a business profile to unlock exclusive features like bulk CSV uploads, 
              NET payment terms, and dedicated account management.
            </p>

            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => setShowOnboarding(true)}
              className="px-8 py-4 bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white font-bold rounded-xl transition-all"
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
    <div className="min-h-screen bg-gradient-to-br from-black via-gray-900 to-black pt-24 pb-12">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Back Button */}
        <motion.button
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          onClick={() => navigate('/profile')}
          className="flex items-center gap-2 text-gray-400 hover:text-white mb-8 transition-colors"
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
            <h1 className="text-4xl font-bold text-white mb-2">Business Profile</h1>
            <p className="text-gray-400">Manage your business account details</p>
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
              ? 'bg-green-500/10 border-green-500/30' 
              : isRejected 
              ? 'bg-red-500/10 border-red-500/30'
              : 'bg-yellow-500/10 border-yellow-500/30'
          }`}
        >
          <div className="flex items-center gap-3">
            <StatusIcon className={`w-5 h-5 ${
              isApproved ? 'text-green-400' : isRejected ? 'text-red-400' : 'text-yellow-400'
            }`} />
            <p className={`text-sm ${
              isApproved ? 'text-green-300' : isRejected ? 'text-red-300' : 'text-yellow-300'
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
            className="bg-gradient-to-br from-gray-900 to-black border-2 border-orange-500/20 rounded-2xl p-6"
          >
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 bg-orange-500/20 rounded-lg flex items-center justify-center">
                <Building2 className="w-5 h-5 text-orange-400" />
              </div>
              <h3 className="text-lg font-bold text-white">Company Details</h3>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-xs text-gray-500 uppercase tracking-wider">Company Name</label>
                <p className="text-white font-medium mt-1">{businessProfile.company_name}</p>
              </div>
              
              {businessProfile.company_reg_number && (
                <div>
                  <label className="text-xs text-gray-500 uppercase tracking-wider">Registration Number</label>
                  <p className="text-white font-medium mt-1">{businessProfile.company_reg_number}</p>
                </div>
              )}
              
              {businessProfile.vat_number && (
                <div>
                  <label className="text-xs text-gray-500 uppercase tracking-wider">VAT Number</label>
                  <p className="text-white font-medium mt-1">{businessProfile.vat_number}</p>
                </div>
              )}
              
              {businessProfile.address && (
                <div>
                  <label className="text-xs text-gray-500 uppercase tracking-wider flex items-center gap-1">
                    <MapPin className="w-3 h-3" /> Address
                  </label>
                  <p className="text-white font-medium mt-1">{businessProfile.address}</p>
                </div>
              )}
            </div>
          </motion.div>

          {/* Contact Details Card */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="bg-gradient-to-br from-gray-900 to-black border-2 border-orange-500/20 rounded-2xl p-6"
          >
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 bg-blue-500/20 rounded-lg flex items-center justify-center">
                <User className="w-5 h-5 text-blue-400" />
              </div>
              <h3 className="text-lg font-bold text-white">Contact Information</h3>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-xs text-gray-500 uppercase tracking-wider flex items-center gap-1">
                  <User className="w-3 h-3" /> Contact Person
                </label>
                <p className="text-white font-medium mt-1">{businessProfile.contact_person}</p>
              </div>
              
              <div>
                <label className="text-xs text-gray-500 uppercase tracking-wider flex items-center gap-1">
                  <Mail className="w-3 h-3" /> Email
                </label>
                <p className="text-white font-medium mt-1">{businessProfile.contact_email}</p>
              </div>
              
              {businessProfile.contact_phone && (
                <div>
                  <label className="text-xs text-gray-500 uppercase tracking-wider flex items-center gap-1">
                    <Phone className="w-3 h-3" /> Phone
                  </label>
                  <p className="text-white font-medium mt-1">{businessProfile.contact_phone}</p>
                </div>
              )}
            </div>
          </motion.div>

          {/* Payment Terms Card */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="bg-gradient-to-br from-gray-900 to-black border-2 border-orange-500/20 rounded-2xl p-6 lg:col-span-2"
          >
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 bg-green-500/20 rounded-lg flex items-center justify-center">
                <CreditCard className="w-5 h-5 text-green-400" />
              </div>
              <h3 className="text-lg font-bold text-white">Payment Terms</h3>
            </div>

            {/* Approved NET Terms */}
            {netTermsRequest?.status === 'approved' || businessProfile.payment_terms !== 'prepaid' ? (
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <CheckCircle className="w-5 h-5 text-green-400" />
                  <span className="px-3 py-1 rounded-full text-xs font-bold bg-green-500/20 text-green-400">
                    NET Terms Approved
                  </span>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
                  <div className="bg-gray-800/50 rounded-xl p-4">
                    <label className="text-xs text-gray-500 uppercase tracking-wider">Credit Limit</label>
                    <p className="text-2xl font-bold text-white mt-1">
                      £{businessProfile.credit_limit?.toLocaleString() || '0'}
                    </p>
                  </div>
                  <div className="bg-gray-800/50 rounded-xl p-4">
                    <label className="text-xs text-gray-500 uppercase tracking-wider">Available Credit</label>
                    <p className="text-2xl font-bold text-green-400 mt-1">
                      £{businessProfile.available_credit?.toLocaleString() || businessProfile.credit_limit?.toLocaleString() || '0'}
                    </p>
                  </div>
                  <div className="bg-gray-800/50 rounded-xl p-4">
                    <label className="text-xs text-gray-500 uppercase tracking-wider">Payment Terms</label>
                    <p className="text-2xl font-bold text-white mt-1">
                      NET {businessProfile.net_terms_days || 30}
                    </p>
                  </div>
                  <div className="bg-gray-800/50 rounded-xl p-4">
                    <label className="text-xs text-gray-500 uppercase tracking-wider">Outstanding</label>
                    <p className="text-2xl font-bold text-orange-400 mt-1">
                      £{businessProfile.outstanding_balance?.toLocaleString() || '0'}
                    </p>
                  </div>
                </div>
              </div>
            ) : netTermsRequest?.status === 'pending' ? (
              /* Pending Review */
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <Clock className="w-5 h-5 text-yellow-400" />
                  <span className="px-3 py-1 rounded-full text-xs font-bold bg-yellow-500/20 text-yellow-400">
                    Under Review
                  </span>
                </div>
                <div className="bg-gray-800/50 rounded-xl p-4">
                  <p className="text-sm text-gray-400">
                    Your application for <strong className="text-white">{netTermsRequest.requested_package}</strong> package is being reviewed.
                  </p>
                  <p className="text-xs text-gray-500 mt-2">
                    Expected decision: 1–2 business days
                  </p>
                </div>
              </div>
            ) : netTermsRequest?.status === 'rejected' ? (
              /* Rejected */
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <XCircle className="w-5 h-5 text-red-400" />
                  <span className="px-3 py-1 rounded-full text-xs font-bold bg-red-500/20 text-red-400">
                    Application Rejected
                  </span>
                </div>
                {netTermsRequest.rejection_reason && (
                  <div className="bg-red-900/20 border border-red-500/30 rounded-xl p-4">
                    <p className="text-sm text-red-300">{netTermsRequest.rejection_reason}</p>
                  </div>
                )}
                {isApproved && (
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => setShowNetTermsForm(true)}
                    className="w-full py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg font-medium transition-colors"
                  >
                    Re-apply
                  </motion.button>
                )}
              </div>
            ) : (
              /* No NET terms requested — show CTA */
              isApproved && (
                <div className="space-y-4">
                  <div className="bg-gradient-to-br from-orange-900/20 to-transparent border border-orange-500/20 rounded-xl p-6 text-center">
                    <div className="flex justify-center mb-4">
                      <div className="p-3 bg-orange-500/20 rounded-full">
                        <Zap className="w-6 h-6 text-orange-400" />
                      </div>
                    </div>
                    <h4 className="text-lg font-bold text-white mb-2">Unlock NET Payment Terms</h4>
                    <ul className="text-sm text-gray-300 space-y-2 mb-6 text-left">
                      <li className="flex items-center gap-2">
                        <CheckCircle className="w-4 h-4 text-green-400 flex-shrink-0" />
                        Defer your payment up to 60 days
                      </li>
                      <li className="flex items-center gap-2">
                        <CheckCircle className="w-4 h-4 text-green-400 flex-shrink-0" />
                        Increase your cash flow
                      </li>
                      <li className="flex items-center gap-2">
                        <CheckCircle className="w-4 h-4 text-green-400 flex-shrink-0" />
                        Get a dedicated account manager
                      </li>
                    </ul>
                    <motion.button
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => setShowNetTermsForm(true)}
                      className="w-full py-3 bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white font-bold rounded-lg transition-all"
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
              className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white font-bold rounded-xl transition-all"
            >
              Go to Bulk Upload
            </motion.button>
          )}
          
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => navigate('/history')}
            className="flex items-center gap-2 px-6 py-3 bg-gray-800 hover:bg-gray-700 text-white font-medium rounded-xl border border-gray-700 transition-all"
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
