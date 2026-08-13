"use client";
import { motion, AnimatePresence } from "framer-motion";
import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { bookingApi } from "../../api/BookingApi"; // ← make sure this is imported
import {
  User,
  Package,
  BarChart3,
  Settings,
  LogOut,
  ChevronDown,
  Shield,
  Bell,
  FileText,
  Edit,
  Mail,
  Phone,
  MapPin,
  Calendar,
  Receipt,
} from "lucide-react";
import { useAuth } from "../../contexts/AuthContext";

// MODERN DESIGN UPGRADE: Premium profile dropdown with 2025 dark-mode design and animated transitions
export default function ProfileDropdown() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);
  const [activeSubmenu, setActiveSubmenu] = useState(null);
  const dropdownRef = useRef(null);
  const [bookingsCount, setBookingsCount] = useState(0);
  const [memberSince, setMemberSince] = useState("—");

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
        setActiveSubmenu(null);
      }
    }

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => {
        document.removeEventListener("mousedown", handleClickOutside);
      };
    }
  }, [isOpen]);

  // Fetch real bookings count
  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await bookingApi.getBookingHistory();
        if (res.success) {
          setBookingsCount(res.data?.length || 0);
        }
      } catch (err) {
        console.error("Failed to load bookings count", err);
      }
    };
    if (user) fetchData();
  }, [user]);

  // Calculate member since
  useEffect(() => {
    if (user?.date_joined) {
      const joinDate = new Date(user.date_joined);
      const months = Math.floor(
        (new Date() - joinDate) / (1000 * 60 * 60 * 24 * 30.44)
      );
      setMemberSince(months > 0 ? `${months}mo` : "New");
    }
  }, [user]);

  const handleLogout = async () => {
    await logout();
    setIsOpen(false);
    navigate("/");
  };

  // NAVIGATION & PROFILE UPGRADE: Updated menu with correct routes (/profile, /history, /faqs)
  // Removed "Get Quote" references and "Total Spent" aggregate display
  const menuItems = [
    {
      id: "profile",
      icon: User,
      label: "My Profile",
      submenu: [
        { label: "View Profile", icon: User, action: () => navigate("/profile") },
        { label: "Profile Settings", icon: Settings, action: () => navigate("/profile") },
      ],
    },
    {
      id: "bookings",
      icon: Package,
      label: "My Bookings",
      submenu: [
        { label: "Booking History", icon: FileText, action: () => navigate("/history") },
        { label: "Track Delivery", icon: MapPin, action: () => navigate("/") },
        { label: "Billing & Invoices", icon: Receipt, action: () => navigate("/billing") },
      ],
    },
    {
      id: "help",
      icon: Shield,
      label: "Help & Support",
      submenu: [
        { label: "FAQs", icon: FileText, action: () => navigate("/faqs") },
      ],
    },
  ];

  // NAVIGATION & PROFILE UPGRADE: Add driver dashboard link if user is a driver
  if (user?.role === "driver") {
    menuItems.splice(2, 0, {
      id: "driver",
      icon: BarChart3,
      label: "Driver Dashboard",
      submenu: [
        { label: "My Dashboard", icon: BarChart3, action: () => navigate("/driver-dashboard") },
      ],
    });
  }

  if (!user) {
    return null;
  }

  const getInitials = () => {
    const parts = user.full_name?.split(" ") || [];
    return parts.map((p) => p[0]).join("").toUpperCase();
  };

  return (
    <div className="relative" ref={dropdownRef}>
      {/* MODERN DESIGN UPGRADE: Enhanced avatar button with glow effect */}
      <motion.button
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={() => setIsOpen(!isOpen)}
        className={`flex items-center gap-3 px-4 py-2 rounded-xl transition-all duration-300 ${
          isOpen
            ? "bg-primary/20 border border-primary/50 shadow-lg shadow-primary/20"
            : "hover:bg-surface border border-border/50"
        }`}
      >
        <div className={`w-10 h-10 rounded-lg font-bold flex items-center justify-center transition-all ${
          isOpen
            ? "bg-gradient-to-br from-primary to-primary-hover text-primary-foreground"
            : "bg-surface text-muted-foreground group-hover:bg-primary/20 group-hover:text-brand-text"
        }`}>
          {getInitials()}
        </div>
        <div className="hidden sm:flex flex-col items-start">
          <span className="text-sm font-bold text-foreground">{user.full_name}</span>
          <span className="text-xs text-muted-foreground">{user.email}</span>
        </div>
        <motion.div
          animate={{ rotate: isOpen ? 180 : 0 }}
          transition={{ duration: 0.3 }}
          className="hidden sm:flex"
        >
          <ChevronDown className="w-4 h-4 text-muted-foreground" />
        </motion.div>
      </motion.button>

      {/* MODERN DESIGN UPGRADE: Premium dropdown menu with submenu support */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: -10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -10 }}
            transition={{ duration: 0.2 }}
            className="absolute right-0 mt-2 w-96 max-h-[600px] bg-gradient-to-br from-card via-background to-card border border-border rounded-2xl shadow-2xl shadow-black/50 overflow-hidden z-50"
          >
            {/* Header with user info */}
            <div className="bg-gradient-to-r from-primary/10 to-transparent border-b border-border px-6 py-6">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-primary to-primary-hover flex items-center justify-center font-bold text-primary-foreground text-lg">
                  {getInitials()}
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-foreground font-bold text-base truncate">
                    {user.full_name}
                  </h3>
                  <p className="text-muted-foreground text-xs truncate">{user.email}</p>
                  <div className="flex items-center gap-2 mt-2">
                    <span className="inline-flex items-center gap-1 text-xs bg-success/20 text-success px-2 py-1 rounded-full border border-success/30">
                      <span className="w-1.5 h-1.5 bg-success rounded-full"></span>
                      Active
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* NAVIGATION & PROFILE UPGRADE: User stats - removed "Total Spent" */}
            <div className="grid grid-cols-2 gap-3 px-6 py-6 border-b border-border/50">
              {[
                { label: "Total Orders", value: bookingsCount, icon: Package },
                { label: "Member Since", value: memberSince, icon: Calendar },
              ].map((stat, idx) => {
                const Icon = stat.icon;
                return (
                  <motion.div
                    key={idx}
                    whileHover={{ y: -2 }}
                    className="bg-surface/30 border border-border/30 rounded-lg p-3 text-center hover:border-primary/30 transition-all"
                  >
                    <Icon className="w-4 h-4 text-brand-text mx-auto mb-2" />
                    <p className="text-xs text-muted-foreground mb-1">{stat.label}</p>
                    <p className="text-sm font-bold text-foreground">{stat.value}</p>
                  </motion.div>
                );
              })}
            </div>

            {/* MODERN DESIGN UPGRADE: Menu items with accordion submenu support */}
            <div className="overflow-y-auto max-h-[300px] px-3 py-3 space-y-1">
              {menuItems.map((item) => {
                const Icon = item.icon;
                const hasSubmenu = item.submenu && item.submenu.length > 0;
                const isSubmenuOpen = activeSubmenu === item.id;

                return (
                  <div key={item.id}>
                    <motion.button
                      whileHover={{ x: 4 }}
                      onClick={() => {
                        if (hasSubmenu) {
                          setActiveSubmenu(isSubmenuOpen ? null : item.id);
                        }
                      }}
                      className="w-full flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-surface/50 transition-colors group"
                    >
                      <Icon className="w-5 h-5 text-brand-text group-hover:text-brand-text transition-colors" />
                      <span className="flex-1 text-left text-sm font-medium text-muted-foreground group-hover:text-foreground transition-colors">
                        {item.label}
                      </span>
                      {hasSubmenu && (
                        <motion.div
                          animate={{ rotate: isSubmenuOpen ? 180 : 0 }}
                          transition={{ duration: 0.2 }}
                        >
                          <ChevronDown className="w-4 h-4 text-subtle-foreground" />
                        </motion.div>
                      )}
                    </motion.button>

                    {/* MODERN DESIGN UPGRADE: Smooth submenu expansion */}
                    <AnimatePresence>
                      {hasSubmenu && isSubmenuOpen && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: "auto" }}
                          exit={{ opacity: 0, height: 0 }}
                          transition={{ duration: 0.2 }}
                          className="overflow-hidden"
                        >
                          <div className="pl-12 pr-4 py-2 space-y-1">
                            {item.submenu.map((subitem, idx) => {
                              const SubIcon = subitem.icon;
                              return (
                                <motion.button
                                  key={idx}
                                  whileHover={{ x: 4 }}
                                  onClick={() => {
                                    subitem.action();
                                    setIsOpen(false);
                                    setActiveSubmenu(null);
                                  }}
                                  className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-muted-foreground hover:text-foreground hover:bg-surface/50 transition-all"
                                >
                                  <SubIcon className="w-4 h-4 flex-shrink-0" />
                                  <span>{subitem.label}</span>
                                </motion.button>
                              );
                            })}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                );
              })}
            </div>

            {/* Divider */}
            <div className="border-t border-border/50" />

            {/* Logout Button - MODERN DESIGN UPGRADE: Full-width prominent CTA */}
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={handleLogout}
              className="w-full flex items-center gap-3 px-6 py-4 text-destructive hover:text-destructive hover:bg-destructive/10 transition-all font-bold text-sm"
            >
              <LogOut className="w-5 h-5" />
              <span>Logout</span>
            </motion.button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
