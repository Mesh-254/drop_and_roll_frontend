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
  // unconditionally `bg-black text-white`. Removing `.dark` therefore does not
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
      <div className="min-h-screen bg-black pt-24 pb-12 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-400 mb-4">Please log in to view your profile.</p>
          <button
            onClick={() => navigate("/login")}
            className="px-6 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-full font-bold transition-all"
          >
            Go to Login
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-black via-gray-900 to-black pt-24 pb-12">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <h1 className="text-4xl font-bold text-white mb-2">My Profile</h1>
          <p className="text-gray-400">Manage your account settings and preferences</p>
        </motion.div>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Column: Avatar & Quick Info */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="lg:col-span-1"
          >
            <div className="bg-gradient-to-br from-gray-900 to-black border-2 border-orange-500/30 rounded-2xl p-6">
              {/* Avatar */}
              <div className="flex flex-col items-center mb-6">
                <div className="w-24 h-24 rounded-xl bg-gradient-to-br from-orange-500 to-orange-600 flex items-center justify-center font-bold text-white text-4xl shadow-lg shadow-orange-500/30 mb-4">
                  {user?.full_name?.[0] || "?"}
                </div>
                <h2 className="text-xl font-bold text-white text-center">
                  {user?.full_name || "User"}
                </h2>
                <p className="text-sm text-gray-400 text-center mt-2">{user?.email}</p>
                <div className="flex items-center gap-2 mt-4 bg-green-500/20 px-3 py-1 rounded-full border border-green-500/30">
                  <span className="w-2 h-2 bg-green-400 rounded-full"></span>
                  <span className="text-xs text-green-400 font-bold">Active</span>
                </div>
              </div>

              {/* Role Badge */}
              <div className="bg-gray-800/50 rounded-lg p-4 mb-6 border border-gray-700/30">
                <p className="text-xs text-gray-400 uppercase tracking-wider mb-2">Account Role</p>
                <div className="inline-flex items-center gap-2 bg-blue-500/20 text-blue-400 px-3 py-2 rounded-lg text-sm font-bold border border-blue-500/30">
                  <span className="w-2 h-2 bg-blue-400 rounded-full"></span>
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
            <div className="bg-gradient-to-br from-gray-900 to-black border-2 border-orange-500/20 rounded-2xl p-8">
              {/* Form Header */}
              <div className="flex items-center justify-between mb-8 pb-6 border-b border-gray-700/30">
                <h3 className="text-2xl font-bold text-white">
                  {isEditing ? "Edit Profile" : "Profile Information"}
                </h3>
                {!isEditing && (
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => setIsEditing(true)}
                    className="flex items-center gap-2 px-4 py-2 bg-orange-500/20 hover:bg-orange-500/30 text-orange-400 rounded-lg border border-orange-500/30 transition-all"
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
                  className="mb-6 p-4 bg-red-500/10 border border-red-500/30 text-red-400 rounded-lg text-sm"
                >
                  {error}
                </motion.div>
              )}
              {success && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mb-6 p-4 bg-green-500/10 border border-green-500/30 text-green-400 rounded-lg text-sm"
                >
                  {success}
                </motion.div>
              )}

              {/* Form Fields */}
              <div className="space-y-6 mb-8">
                {/* First Name */}
                <div>
                  <label className="block text-sm font-bold text-gray-300 mb-2">
                    First Name
                  </label>
                  {isEditing ? (
                    <input
                      type="text"
                      name="firstName"
                      value={formData.firstName}
                      onChange={handleInputChange}
                      className="w-full px-4 py-3 bg-gray-800/50 border border-gray-700 text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                      placeholder="Enter first name"
                    />
                  ) : (
                    <div className="px-4 py-3 bg-gray-800/30 border border-gray-700/30 text-white rounded-lg">
                      {formData.firstName || "—"}
                    </div>
                  )}
                </div>

                {/* Last Name */}
                <div>
                  <label className="block text-sm font-bold text-gray-300 mb-2">
                    Last Name
                  </label>
                  {isEditing ? (
                    <input
                      type="text"
                      name="lastName"
                      value={formData.lastName}
                      onChange={handleInputChange}
                      className="w-full px-4 py-3 bg-gray-800/50 border border-gray-700 text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                      placeholder="Enter last name"
                    />
                  ) : (
                    <div className="px-4 py-3 bg-gray-800/30 border border-gray-700/30 text-white rounded-lg">
                      {formData.lastName || "—"}
                    </div>
                  )}
                </div>

                {/* Email (Read-only) */}
                <div>
                  <label className="block text-sm font-bold text-gray-300 mb-2">
                    Email Address
                  </label>
                  <div className="px-4 py-3 bg-gray-800/30 border border-gray-700/30 text-gray-400 rounded-lg">
                    {user?.email}
                  </div>
                  <p className="text-xs text-gray-500 mt-2">
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
                    className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 disabled:from-gray-500 disabled:to-gray-600 text-white font-bold rounded-lg transition-all"
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
                    className="flex items-center justify-center gap-2 px-6 py-3 border-2 border-gray-700 hover:border-gray-600 text-gray-400 hover:text-gray-300 font-bold rounded-lg transition-all"
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
            <div className="bg-gradient-to-br from-gray-900 to-black border-2 border-orange-500/20 rounded-2xl p-8">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-lg bg-orange-500/20 flex items-center justify-center">
                  <Building2 className="w-5 h-5 text-orange-400" />
                </div>
                <h3 className="text-2xl font-bold text-white">Business Account</h3>
              </div>

              {businessLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader className="w-6 h-6 animate-spin text-orange-400" />
                  <span className="ml-2 text-gray-400">Loading business profile...</span>
                </div>
              ) : hasProfile ? (
                // Business profile exists - show summary
                <div className="space-y-6">
                  {/* Company Info */}
                  <div className="flex items-start justify-between">
                    <div>
                      {/* <p className="text-lg font-semibold text-white">{businessProfile.company_name}</p> */}
                      <p className="text-sm text-gray-400 mt-1">{businessProfile.contact_email}</p>
                    </div>
                    {/* Status Badge */}
                    <div>
                      {isApproved ? (
                        <div className="flex items-center gap-2 bg-green-500/20 text-green-400 px-3 py-1.5 rounded-full text-sm font-bold border border-green-500/30">
                          <CheckCircle className="w-4 h-4" />
                          Approved
                        </div>
                      ) : isPending ? (
                        <div className="flex items-center gap-2 bg-amber-500/20 text-amber-400 px-3 py-1.5 rounded-full text-sm font-bold border border-amber-500/30">
                          <Clock className="w-4 h-4" />
                          Pending Review
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 bg-red-500/20 text-red-400 px-3 py-1.5 rounded-full text-sm font-bold border border-red-500/30">
                          <XCircle className="w-4 h-4" />
                          Rejected
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Approved profile - show NET terms and credit info */}
                  {isApproved && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t border-gray-700/30">
                      <div className="bg-gray-800/30 rounded-lg p-4">
                        <div className="flex items-center gap-2 mb-2">
                          <CreditCard className="w-4 h-4 text-gray-400" />
                          <p className="text-xs text-gray-400 uppercase tracking-wider">Payment Terms</p>
                        </div>
                        <p className="text-white font-semibold">
                          {businessProfile.payment_terms === 'prepaid' ? 'Prepaid' : 
                           businessProfile.payment_terms === 'net_7' ? 'NET 7 Days' :
                           businessProfile.payment_terms === 'net_30' ? 'NET 30 Days' :
                           businessProfile.payment_terms === 'net_60' ? 'NET 60 Days' : 'Prepaid'}
                        </p>
                      </div>
                      {businessProfile.credit_limit > 0 && (
                        <div className="bg-gray-800/30 rounded-lg p-4">
                          <p className="text-xs text-gray-400 uppercase tracking-wider mb-2">Available Credit</p>
                          <p className="text-white font-semibold">
                            £{Number(businessProfile.available_credit || businessProfile.credit_limit).toLocaleString('en-GB', { minimumFractionDigits: 2 })}
                          </p>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Pending profile - info message */}
                  {isPending && (
                    <div className="p-4 bg-amber-500/10 border border-amber-500/30 rounded-lg">
                      <p className="text-sm text-amber-400">
                        Your business profile is currently under review. You&apos;ll receive an email once approved.
                      </p>
                    </div>
                  )}

                  {/* View/Manage Business Profile link */}
                  <Link
                    to="/business/profile"
                    className="flex items-center justify-between px-4 py-3 bg-gray-800/50 hover:bg-gray-800 rounded-lg transition-all group"
                  >
                    <span className="text-gray-300 group-hover:text-white transition-colors">
                      Manage Business Profile
                    </span>
                    <ArrowRight className="w-4 h-4 text-gray-500 group-hover:text-orange-400 transition-colors" />
                  </Link>
                </div>
              ) : (
                // No business profile - show CTA to create one
                <div className="text-center py-6">
                  <div className="w-16 h-16 rounded-full bg-gray-800/50 flex items-center justify-center mx-auto mb-4">
                    <Building2 className="w-8 h-8 text-gray-500" />
                  </div>
                  <h4 className="text-lg font-semibold text-white mb-2">Upgrade to Business Account</h4>
                  <p className="text-gray-400 text-sm mb-6 max-w-md mx-auto">
                    Unlock bulk uploads, NET payment terms, volume discounts, and dedicated support for your business.
                  </p>
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => setShowBusinessOnboarding(true)}
                    className="px-6 py-3 bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white font-bold rounded-lg transition-all inline-flex items-center gap-2"
                  >
                    <Building2 className="w-5 h-5" />
                    Create Business Profile
                  </motion.button>
                  <p className="text-xs text-gray-500 mt-4">
                    Or <Link to="/business/register" className="text-orange-400 hover:text-orange-300 underline">register as a new business</Link>
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
            className="p-6 bg-gradient-to-br from-gray-900 to-black border-2 border-orange-500/20 hover:border-orange-500/50 rounded-xl text-center transition-all group"
          >
            <p className="text-lg font-bold text-white group-hover:text-orange-400 transition-colors">
              View Booking History
            </p>
            <p className="text-sm text-gray-400 mt-2">Check your past and current bookings</p>
          </motion.button>

          {/* View FAQs */}
          <motion.button
            whileHover={{ scale: 1.02, y: -2 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => navigate("/faqs")}
            className="p-6 bg-gradient-to-br from-gray-900 to-black border-2 border-orange-500/20 hover:border-orange-500/50 rounded-xl text-center transition-all group"
          >
            <p className="text-lg font-bold text-white group-hover:text-orange-400 transition-colors">
              FAQs & Help
            </p>
            <p className="text-sm text-gray-400 mt-2">Get answers to common questions</p>
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
            className="px-8 py-3 bg-red-500/20 hover:bg-red-500/30 text-red-400 font-bold rounded-lg border border-red-500/30 transition-all"
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
