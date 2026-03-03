"use client";

import { motion } from "framer-motion";
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import { Moon, Sun, Save, X, Loader } from "lucide-react";

// NAVIGATION & PROFILE UPGRADE: New /profile page with editable name fields and theme toggle
export default function ProfilePage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [isDarkMode, setIsDarkMode] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [formData, setFormData] = useState({
    firstName: user?.first_name || "",
    lastName: user?.last_name || "",
  });
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Initialize dark mode from localStorage
  useEffect(() => {
    const savedMode = localStorage.getItem("theme") === "light" ? false : true;
    setIsDarkMode(savedMode);
    applyTheme(savedMode);
  }, []);

  // NAVIGATION & PROFILE UPGRADE: Theme toggle functionality
  const applyTheme = (isDark) => {
    if (isDark) {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
    localStorage.setItem("theme", isDark ? "dark" : "light");
  };

  const toggleTheme = () => {
    const newMode = !isDarkMode;
    setIsDarkMode(newMode);
    applyTheme(newMode);
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  // NAVIGATION & PROFILE UPGRADE: Save profile changes via PATCH /api/users/auth/me/
  const handleSaveProfile = async () => {
    if (!formData.firstName.trim() || !formData.lastName.trim()) {
      setError("First and last name are required");
      return;
    }

    setIsSaving(true);
    setError("");
    setSuccess("");

    try {
      // PATCH to /api/users/auth/me/
      const response = await fetch(
        `${import.meta.env.VITE_NEXT_PUBLIC_BACKEND_URL}/api/users/auth/me/`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${localStorage.getItem("access_token")}`,
          },
          body: JSON.stringify({
            first_name: formData.firstName,
            last_name: formData.lastName,
          }),
        }
      );

      if (!response.ok) {
        throw new Error("Failed to update profile");
      }

      setSuccess("Profile updated successfully!");
      setIsEditing(false);
      // Refresh user data
      setTimeout(() => window.location.reload(), 1500);
    } catch (err) {
      setError(err.message || "Failed to save profile");
    } finally {
      setIsSaving(false);
    }
  };

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
                  {user?.first_name?.[0]}
                  {user?.last_name?.[0]}
                </div>
                <h2 className="text-xl font-bold text-white text-center">
                  {user?.first_name} {user?.last_name}
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

              {/* Theme Toggle */}
              <div className="bg-gray-800/50 rounded-lg p-4 border border-gray-700/30">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs text-gray-400 uppercase tracking-wider">Theme</p>
                  <motion.button
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={toggleTheme}
                    className="p-2 rounded-lg hover:bg-gray-700/50 transition-all"
                  >
                    {isDarkMode ? (
                      <Moon className="w-5 h-5 text-gray-400 hover:text-orange-400" />
                    ) : (
                      <Sun className="w-5 h-5 text-gray-400 hover:text-orange-400" />
                    )}
                  </motion.button>
                </div>
                <p className="text-sm text-gray-400">
                  {isDarkMode ? "Dark Mode" : "Light Mode"}
                </p>
              </div>
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
                      {user?.first_name || "—"}
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
                      {user?.last_name || "—"}
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
                      setFormData({
                        firstName: user?.first_name || "",
                        lastName: user?.last_name || "",
                      });
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
    </div>
  );
}
