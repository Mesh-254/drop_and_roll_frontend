"use client";

import { motion } from "framer-motion";
import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import { Save, X, Loader, Building2, CheckCircle, Clock, XCircle, CreditCard, ArrowRight } from "lucide-react";
import { authApi } from "../../api/AuthApi";
import { useBusinessProfile } from "../../hooks/useBusinessProfile";
import BusinessProfileOnboarding from "../business/BusinessProfileOnboarding";
import PendingBookingsSection from "./PendingBookingsSection";

// NAVIGATION & PROFILE UPGRADE: /profile page with editable name fields.
// The theme toggle that used to live here was removed — see the comment below.
export default function ProfilePage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
  });
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  
  // Business profile state — useBusinessProfile exports `businessProfile`, not `profile`
  const { businessProfile, loading: businessLoading, refetch: refetchBusiness, hasProfile, isApproved, isPending } = useBusinessProfile();
  const [showBusinessOnboarding, setShowBusinessOnboarding] = useState(false);

  console.log("Rendering ProfilePage with user:", user, "and business profile:", businessProfile);
  // Split full_name when user data is available
  useEffect(() => {
    if (user?.full_name) {
      const parts = user.full_name.trim().split(/\s+/);
      setFormData({
        firstName: parts[0] || "",
        lastName: parts.slice(1).join(" ") || "",
      });
    }
  }, [user]);

  // THE THEME TOGGLE IS GONE. See utils/theme.js for the measurement behind it.
  //
  // Short version: this app has no light mode to switch to. `scripts/audit_theme.mjs`
  // reports that NOT ONE file in src/ flips cleanly — every file carrying
  // `dark:` pairs also carries unpaired dark-only utilities — and `body` is
  // unconditionally `bg-background text-foreground`. Removing `.dark` therefore does not
  // produce a light app; it produces whatever screen you happen to be on, half
  // in one theme and half in the other.
  //
  // The button was harmless only while `dark:` resolved from the operating
  // system and the class it wrote was read by nothing. Pinning `dark:` to that
  // class made the button work, which is exactly what made it dangerous.

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSaveProfile = async () => {
    if (!formData.firstName.trim()) {
      setError("First name is required");
      return;
    }

    setIsSaving(true);
    setError("");
    setSuccess("");

    // Combine into full_name (backend only has this field)
    const fullName = [formData.firstName.trim(), formData.lastName.trim()]
      .filter(Boolean)
      .join(" ");

    try {
      const result = await authApi.updateUserProfile({
        full_name: fullName,
      });

      if (!result.success) {
        throw new Error(result.message || "Failed to update profile");
      }

      setSuccess("Profile updated successfully!");
      setIsEditing(false);

      // Refresh page to show updated name (you can later improve this)
      setTimeout(() => window.location.reload(), 1500);
    } catch (err) {
      setError(err.message || "Failed to save profile");
    } finally {
      setIsSaving(false);
    }
  };

  // ────────────────────────────────────────────────
  //  The rest of your component (return statement) stays EXACTLY the same
  //  Only the logic parts above were updated
  // ────────────────────────────────────────────────

  if (!user) {
    return (
      <div className="min-h-screen bg-background pt-24 pb-12 flex items-center justify-center">
        <div className="text-center">
          <p className="text-muted-foreground mb-4">Please log in to view your profile.</p>
          <button
            onClick={() => navigate("/login")}
            className="px-6 py-2 bg-primary hover:bg-primary-hover text-primary-foreground rounded-full font-bold transition-all"
          >
            Go to Login
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-card to-background pt-24 pb-12">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <h1 className="text-4xl font-bold text-foreground mb-2">My Profile</h1>
          <p className="text-muted-foreground">Manage your account settings and preferences</p>
        </motion.div>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Column: Avatar & Quick Info */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="lg:col-span-1"
          >
            <div className="bg-gradient-to-br from-card to-background border-2 border-primary/30 rounded-2xl p-6">
              {/* Avatar */}
              <div className="flex flex-col items-center mb-6">
                <div className="w-24 h-24 rounded-xl bg-gradient-to-br from-primary to-primary-hover flex items-center justify-center font-bold text-primary-foreground text-4xl shadow-lg shadow-primary/30 mb-4">
                  {user?.full_name?.[0] || "?"}
                </div>
                <h2 className="text-xl font-bold text-foreground text-center">
                  {user?.full_name || "User"}
                </h2>
                <p className="text-sm text-muted-foreground text-center mt-2">{user?.email}</p>
                <div className="flex items-center gap-2 mt-4 bg-success/20 px-3 py-1 rounded-full border border-success/30">
                  <span className="w-2 h-2 bg-success rounded-full"></span>
                  <span className="text-xs text-success font-bold">Active</span>
                </div>
              </div>

              {/* Role Badge */}
              <div className="bg-surface/50 rounded-lg p-4 mb-6 border border-border/30">
                <p className="text-xs text-muted-foreground uppercase tracking-wider mb-2">Account Role</p>
                <div className="inline-flex items-center gap-2 bg-info/20 text-info px-3 py-2 rounded-lg text-sm font-bold border border-info/30">
                  <span className="w-2 h-2 bg-info rounded-full"></span>
                  {user?.role?.toUpperCase() || "CUSTOMER"}
                </div>
              </div>

              {/* No theme card. Offering a switch to a theme that does not exist
                  is worse than offering nothing: the button worked, and what it
                  produced was half a screen in each theme. */}
            </div>
          </motion.div>

          {/* Right Column: Editable Profile Form */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="lg:col-span-2"
          >
            <div className="bg-gradient-to-br from-card to-background border-2 border-primary/20 rounded-2xl p-8">
              {/* Form Header */}
              <div className="flex items-center justify-between mb-8 pb-6 border-b border-border/30">
                <h3 className="text-2xl font-bold text-foreground">
                  {isEditing ? "Edit Profile" : "Profile Information"}
                </h3>
                {!isEditing && (
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => setIsEditing(true)}
                    className="flex items-center gap-2 px-4 py-2 bg-primary/20 hover:bg-primary/30 text-brand-text rounded-lg border border-primary/30 transition-all"
                  >
                    Edit Profile
                  </motion.button>
                )}
              </div>

              {/* Error/Success Messages */}
              {error && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mb-6 p-4 bg-destructive/10 border border-destructive/30 text-destructive rounded-lg text-sm"
                >
                  {error}
                </motion.div>
              )}
              {success && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mb-6 p-4 bg-success/10 border border-success/30 text-success rounded-lg text-sm"
                >
                  {success}
                </motion.div>
              )}

              {/* Form Fields */}
              <div className="space-y-6 mb-8">
                {/* First Name */}
                <div>
                  <label className="block text-sm font-bold text-muted-foreground mb-2">
                    First Name
                  </label>
                  {isEditing ? (
                    <input
                      type="text"
                      name="firstName"
                      value={formData.firstName}
                      onChange={handleInputChange}
                      className="w-full px-4 py-3 bg-surface/50 border border-border text-foreground rounded-lg focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent"
                      placeholder="Enter first name"
                    />
                  ) : (
                    <div className="px-4 py-3 bg-surface/30 border border-border/30 text-foreground rounded-lg">
                      {formData.firstName || "—"}
                    </div>
                  )}
                </div>

                {/* Last Name */}
                <div>
                  <label className="block text-sm font-bold text-muted-foreground mb-2">
                    Last Name
                  </label>
                  {isEditing ? (
                    <input
                      type="text"
                      name="lastName"
                      value={formData.lastName}
                      onChange={handleInputChange}
                      className="w-full px-4 py-3 bg-surface/50 border border-border text-foreground rounded-lg focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent"
                      placeholder="Enter last name"
                    />
                  ) : (
                    <div className="px-4 py-3 bg-surface/30 border border-border/30 text-foreground rounded-lg">
                      {formData.lastName || "—"}
                    </div>
                  )}
                </div>

                {/* Email (Read-only) */}
                <div>
                  <label className="block text-sm font-bold text-muted-foreground mb-2">
                    Email Address
                  </label>
                  <div className="px-4 py-3 bg-surface/30 border border-border/30 text-muted-foreground rounded-lg">
                    {user?.email}
                  </div>
                  <p className="text-xs text-subtle-foreground mt-2">
                    To change email, please contact support.
                  </p>
                </div>
              </div>

              {/* Action Buttons */}
              {isEditing && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex gap-3"
                >
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={handleSaveProfile}
                    disabled={isSaving}
                    className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-r from-primary to-primary-hover hover:from-primary-hover hover:to-primary-hover disabled:from-surface-hover disabled:to-surface-hover text-primary-foreground font-bold rounded-lg transition-all"
                  >
                    {isSaving ? (
                      <>
                        <Loader className="w-5 h-5 animate-spin" />
                        Saving...
                      </>
                    ) : (
                      <>
                        <Save className="w-5 h-5" />
                        Save Changes
                      </>
                    )}
                  </motion.button>
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => {
                      setIsEditing(false);
                      setError("");
                    }}
                    className="flex items-center justify-center gap-2 px-6 py-3 border-2 border-border hover:border-border-strong text-muted-foreground hover:text-muted-foreground font-bold rounded-lg transition-all"
                  >
                    <X className="w-5 h-5" />
                    Cancel
                  </motion.button>
                </motion.div>
              )}
            </div>
          </motion.div>
        </div>

        {/* Pending payments — bookings awaiting payment (customers only) */}
        {user?.role === 'customer' && <PendingBookingsSection />}

        {/* Business Account Section - Only show for customers */}
        {user?.role === 'customer' && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="mt-8"
          >
            <div className="bg-gradient-to-br from-card to-background border-2 border-primary/20 rounded-2xl p-8">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-lg bg-primary/20 flex items-center justify-center">
                  <Building2 className="w-5 h-5 text-brand-text" />
                </div>
                <h3 className="text-2xl font-bold text-foreground">Business Account</h3>
              </div>

              {businessLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader className="w-6 h-6 animate-spin text-brand-text" />
                  <span className="ml-2 text-muted-foreground">Loading business profile...</span>
                </div>
              ) : hasProfile ? (
                // Business profile exists - show summary
                <div className="space-y-6">
                  {/* Company Info */}
                  <div className="flex items-start justify-between">
                    <div>
                      {/* <p className="text-lg font-semibold text-foreground">{businessProfile.company_name}</p> */}
                      <p className="text-sm text-muted-foreground mt-1">{businessProfile.contact_email}</p>
                    </div>
                    {/* Status Badge */}
                    <div>
                      {isApproved ? (
                        <div className="flex items-center gap-2 bg-success/20 text-success px-3 py-1.5 rounded-full text-sm font-bold border border-success/30">
                          <CheckCircle className="w-4 h-4" />
                          Approved
                        </div>
                      ) : isPending ? (
                        <div className="flex items-center gap-2 bg-warning/20 text-warning px-3 py-1.5 rounded-full text-sm font-bold border border-warning/30">
                          <Clock className="w-4 h-4" />
                          Pending Review
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 bg-destructive/20 text-destructive px-3 py-1.5 rounded-full text-sm font-bold border border-destructive/30">
                          <XCircle className="w-4 h-4" />
                          Rejected
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Approved profile - show NET terms and credit info */}
                  {isApproved && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t border-border/30">
                      <div className="bg-surface/30 rounded-lg p-4">
                        <div className="flex items-center gap-2 mb-2">
                          <CreditCard className="w-4 h-4 text-muted-foreground" />
                          <p className="text-xs text-muted-foreground uppercase tracking-wider">Payment Terms</p>
                        </div>
                        <p className="text-foreground font-semibold">
                          {businessProfile.payment_terms === 'prepaid' ? 'Prepaid' : 
                           businessProfile.payment_terms === 'net_7' ? 'NET 7 Days' :
                           businessProfile.payment_terms === 'net_30' ? 'NET 30 Days' :
                           businessProfile.payment_terms === 'net_60' ? 'NET 60 Days' : 'Prepaid'}
                        </p>
                      </div>
                      {businessProfile.credit_limit > 0 && (
                        <div className="bg-surface/30 rounded-lg p-4">
                          <p className="text-xs text-muted-foreground uppercase tracking-wider mb-2">Available Credit</p>
                          <p className="text-foreground font-semibold">
                            £{Number(businessProfile.available_credit || businessProfile.credit_limit).toLocaleString('en-GB', { minimumFractionDigits: 2 })}
                          </p>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Pending profile - info message */}
                  {isPending && (
                    <div className="p-4 bg-warning/10 border border-warning/30 rounded-lg">
                      <p className="text-sm text-warning">
                        Your business profile is currently under review. You&apos;ll receive an email once approved.
                      </p>
                    </div>
                  )}

                  {/* View/Manage Business Profile link */}
                  <Link
                    to="/business/profile"
                    className="flex items-center justify-between px-4 py-3 bg-surface/50 hover:bg-surface rounded-lg transition-all group"
                  >
                    <span className="text-muted-foreground group-hover:text-foreground transition-colors">
                      Manage Business Profile
                    </span>
                    <ArrowRight className="w-4 h-4 text-subtle-foreground group-hover:text-brand-text transition-colors" />
                  </Link>
                </div>
              ) : (
                // No business profile - show CTA to create one
                <div className="text-center py-6">
                  <div className="w-16 h-16 rounded-full bg-surface/50 flex items-center justify-center mx-auto mb-4">
                    <Building2 className="w-8 h-8 text-subtle-foreground" />
                  </div>
                  <h4 className="text-lg font-semibold text-foreground mb-2">Upgrade to Business Account</h4>
                  <p className="text-muted-foreground text-sm mb-6 max-w-md mx-auto">
                    Unlock bulk uploads, NET payment terms, volume discounts, and dedicated support for your business.
                  </p>
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => setShowBusinessOnboarding(true)}
                    className="px-6 py-3 bg-gradient-to-r from-primary to-primary-hover hover:from-primary-hover hover:to-primary-hover text-primary-foreground font-bold rounded-lg transition-all inline-flex items-center gap-2"
                  >
                    <Building2 className="w-5 h-5" />
                    Create Business Profile
                  </motion.button>
                  <p className="text-xs text-subtle-foreground mt-4">
                    Or <Link to="/business/register" className="text-brand-text hover:text-brand-text underline">register as a new business</Link>
                  </p>
                </div>
              )}
            </div>
          </motion.div>
        )}

        {/* Account Actions */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-4"
        >
          {/* View Booking History */}
          <motion.button
            whileHover={{ scale: 1.02, y: -2 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => navigate("/history")}
            className="p-6 bg-gradient-to-br from-card to-background border-2 border-primary/20 hover:border-primary/50 rounded-xl text-center transition-all group"
          >
            <p className="text-lg font-bold text-foreground group-hover:text-brand-text transition-colors">
              View Booking History
            </p>
            <p className="text-sm text-muted-foreground mt-2">Check your past and current bookings</p>
          </motion.button>

          {/* View FAQs */}
          <motion.button
            whileHover={{ scale: 1.02, y: -2 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => navigate("/faqs")}
            className="p-6 bg-gradient-to-br from-card to-background border-2 border-primary/20 hover:border-primary/50 rounded-xl text-center transition-all group"
          >
            <p className="text-lg font-bold text-foreground group-hover:text-brand-text transition-colors">
              FAQs & Help
            </p>
            <p className="text-sm text-muted-foreground mt-2">Get answers to common questions</p>
          </motion.button>
        </motion.div>

        {/* Logout Button */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="mt-8 flex justify-center"
        >
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => {
              logout();
              navigate("/");
            }}
            className="px-8 py-3 bg-destructive/20 hover:bg-destructive/30 text-destructive font-bold rounded-lg border border-destructive/30 transition-all"
          >
            Logout
          </motion.button>
        </motion.div>
      </div>

      {/* Business Profile Onboarding Modal */}
      {showBusinessOnboarding && (
        <BusinessProfileOnboarding
          onClose={() => setShowBusinessOnboarding(false)}
          onSuccess={() => {
            setShowBusinessOnboarding(false);
            refetchBusiness();
          }}
        />
      )}
    </div>
  );
}
