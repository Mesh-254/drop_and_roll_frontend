"use client";

import React from 'react';
import { motion } from 'framer-motion';
import { Building2, Clock, CheckCircle, XCircle, AlertCircle, CreditCard, ArrowRight } from 'lucide-react';

/**
 * BusinessProfileCard — Displays business profile summary with status badge
 * 
 * Props:
 *   profile: Business profile object or null
 *   onManageClick: Function to handle "Manage" button click
 *   onCreateClick: Function to handle "Create Profile" button click
 */
export default function BusinessProfileCard({ profile, onManageClick, onCreateClick }) {
  // Status badge configuration
  const getStatusBadge = (status) => {
    const statusLower = status?.toLowerCase();
    
    switch (statusLower) {
      case 'approved':
        return {
          icon: CheckCircle,
          text: 'Approved',
          className: 'bg-success/20 text-success border-success/30',
        };
      case 'rejected':
        return {
          icon: XCircle,
          text: 'Rejected',
          className: 'bg-destructive/20 text-destructive border-destructive/30',
        };
      case 'pending':
      default:
        return {
          icon: Clock,
          text: 'Pending Review',
          className: 'bg-warning/20 text-warning border-warning/30',
        };
    }
  };

  // No profile exists
  if (!profile) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-gradient-to-br from-card to-background border-2 border-primary/20 rounded-2xl p-6"
      >
        <div className="flex items-center gap-3 mb-4">
          <div className="w-12 h-12 bg-primary/20 rounded-xl flex items-center justify-center">
            <Building2 className="w-6 h-6 text-brand-text" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-foreground">Business Account</h3>
            <p className="text-sm text-muted-foreground">Unlock bulk uploads & NET terms</p>
          </div>
        </div>

        <p className="text-muted-foreground text-sm mb-6">
          Create a business profile to access exclusive features like bulk CSV uploads, 
          NET payment terms, and dedicated account management.
        </p>

        <motion.button
          whileHover={{ scale: 1.02, y: -2 }}
          whileTap={{ scale: 0.98 }}
          onClick={onCreateClick}
          className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-r from-primary to-primary-hover hover:from-primary-hover hover:to-primary-hover text-primary-foreground font-bold rounded-xl transition-all"
        >
          Create Business Profile
          <ArrowRight className="w-4 h-4" />
        </motion.button>
      </motion.div>
    );
  }

  // Profile exists - show summary
  const statusBadge = getStatusBadge(profile.status);
  const StatusIcon = statusBadge.icon;
  const isApproved = profile.status?.toLowerCase() === 'approved';

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-gradient-to-br from-card to-background border-2 border-primary/20 rounded-2xl p-6"
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-primary/20 rounded-xl flex items-center justify-center">
            <Building2 className="w-6 h-6 text-brand-text" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-foreground">Business Account</h3>
            <p className="text-sm text-muted-foreground">{profile.company_name}</p>
          </div>
        </div>
        
        {/* Status Badge */}
        <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-bold ${statusBadge.className}`}>
          <StatusIcon className="w-3.5 h-3.5" />
          {statusBadge.text}
        </div>
      </div>

      {/* Profile Summary */}
      <div className="space-y-3 mb-6">
        {profile.contact_email && (
          <div className="flex items-center gap-2 text-sm">
            <span className="text-subtle-foreground">Contact:</span>
            <span className="text-muted-foreground">{profile.contact_person} ({profile.contact_email})</span>
          </div>
        )}
        
        {profile.vat_number && (
          <div className="flex items-center gap-2 text-sm">
            <span className="text-subtle-foreground">VAT:</span>
            <span className="text-muted-foreground">{profile.vat_number}</span>
          </div>
        )}

        {/* NET Terms Info (only show if approved) */}
        {isApproved && profile.net_terms_approved && (
          <div className="mt-4 p-4 bg-success/10 border border-success/30 rounded-xl">
            <div className="flex items-center gap-2 mb-2">
              <CreditCard className="w-4 h-4 text-success" />
              <span className="text-success font-semibold text-sm">NET Terms Active</span>
            </div>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-subtle-foreground">Credit Limit</span>
                <p className="text-foreground font-medium">
                  £{profile.credit_limit?.toLocaleString() || '0'}
                </p>
              </div>
              <div>
                <span className="text-subtle-foreground">Available Credit</span>
                <p className="text-success font-medium">
                  £{profile.available_credit?.toLocaleString() || profile.credit_limit?.toLocaleString() || '0'}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Pending message */}
        {profile.status?.toLowerCase() === 'pending' && (
          <div className="mt-4 p-4 bg-warning/10 border border-warning/30 rounded-xl">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-warning" />
              <span className="text-warning text-sm">
                Your profile is under review. You&apos;ll be notified once approved.
              </span>
            </div>
          </div>
        )}

        {/* Rejected message */}
        {profile.status?.toLowerCase() === 'rejected' && (
          <div className="mt-4 p-4 bg-destructive/10 border border-destructive/30 rounded-xl">
            <div className="flex items-center gap-2">
              <XCircle className="w-4 h-4 text-destructive" />
              <span className="text-destructive text-sm">
                Your profile was not approved. Please contact support for more information.
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Manage Button */}
      <motion.button
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        onClick={onManageClick}
        className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-surface hover:bg-surface-hover text-foreground font-medium rounded-xl border border-border transition-all"
      >
        Manage Business Profile
        <ArrowRight className="w-4 h-4" />
      </motion.button>
    </motion.div>
  );
}
