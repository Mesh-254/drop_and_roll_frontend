"use client";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  Search,
  Package,
  MapPin,
  Clock,
  Truck,
  CheckCircle,
  Copy,
  AlertCircle,
  Loader2,
  MessageSquare,
  AlertTriangle,
} from "lucide-react";
import { bookingApi } from "../../api/BookingApi";

// MODERN DESIGN UPGRADE: Premium dark-mode tracking experience with animated status badges
export default function TrackParcelModal({ isOpen, onClose }) {
  const [trackingNumber, setTrackingNumber] = useState("");
  const [trackingData, setTrackingData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

  const handleTrack = async (e) => {
    e.preventDefault();
    if (!trackingNumber.trim()) {
      setError("Please enter a tracking number");
      return;
    }

    setLoading(true);
    setError("");
    setTrackingData(null);

    try {
      const result = await bookingApi.trackBooking(trackingNumber);
      if (!result.success) {
        throw new Error(result.message || "Tracking failed");
      }
      const mappedData = {
        id: result.data.tracking_number,
        status: result.data.status,
        currentLocation: result.data.current_location,
        estimatedDelivery: result.data.estimated_delivery || "TBD",
        timeline: result.data.timeline.map((event) => ({
          ...event,
          completed: event.completed,
        })),
      };
      setTrackingData(mappedData);
    } catch (err) {
      setError(
        err.message ||
          "Failed to fetch tracking information. Please check the tracking number and try again."
      );
    } finally {
      setLoading(false);
    }
  };

  const getStatusIcon = (status, completed) => {
    if (completed) {
      return <CheckCircle className="text-success" size={24} />;
    }

    switch (status) {
      case "picked_up":
        return <Package className="text-brand-text" size={24} />;
      case "in_transit":
        return <Truck className="text-info" size={24} />;
      case "out_for_delivery":
        return <MapPin className="text-warning" size={24} />;
      case "delivered":
        return <CheckCircle className="text-success" size={24} />;
      default:
        return <Clock className="text-muted-foreground" size={24} />;
    }
  };

  const getStatusText = (status) => {
    const statusMap = {
      pending: "Pending",
      scheduled: "Scheduled",
      assigned: "Assigned",
      picked_up: "Picked Up",
      in_transit: "In Transit",
      delivered: "Delivered",
      cancelled: "Cancelled",
      failed: "Failed",
      refunded: "Refunded",
    };
    return statusMap[status] || status.replace(/_/g, " ").toUpperCase();
  };

  const getStatusColor = (status) => {
    switch (status) {
      case "pending":
      case "scheduled":
      case "assigned":
        return "bg-warning/20 text-warning border-warning/30";
      case "picked_up":
      case "in_transit":
        return "bg-primary/20 text-brand-text border-primary/30";
      case "delivered":
        return "bg-success/20 text-success border-success/30";
      case "cancelled":
      case "failed":
        return "bg-destructive/20 text-destructive border-destructive/30";
      default:
        return "bg-info/20 text-info border-info/30";
    }
  };

  const copyToClipboard = async () => {
    await navigator.clipboard.writeText(trackingData.id);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 bg-overlay backdrop-blur-md z-50 flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          transition={{ duration: 0.3 }}
          className="bg-gradient-to-br from-card via-background to-card border border-primary/20 rounded-3xl w-full max-w-4xl max-h-[90vh] overflow-y-auto shadow-2xl shadow-primary/10"
        >
          {/* Header */}
          <div className="sticky top-0 flex items-center justify-between p-6 sm:p-8 border-b border-border bg-gradient-to-r from-card to-background z-20">
            <h2 className="text-2xl font-bold text-foreground flex items-center gap-3">
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
              >
                <Truck className="w-6 h-6 text-brand-text" />
              </motion.div>
              Track Your Parcel
            </h2>
            <motion.button
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.95 }}
              onClick={onClose}
              className="text-muted-foreground hover:text-foreground transition-colors p-2 hover:bg-surface rounded-lg"
            >
              <X size={24} />
            </motion.button>
          </div>

          {/* Content */}
          <div className="p-6 sm:p-8">
            {/* Tracking Form */}
            <form onSubmit={handleTrack} className="mb-8">
              <div className="flex flex-col sm:flex-row gap-3">
                <div className="flex-1">
                  <input
                    type="text"
                    placeholder="Enter tracking number (e.g., BK-ABC123)"
                    value={trackingNumber}
                    onChange={(e) => setTrackingNumber(e.target.value)}
                    className="w-full px-4 py-4 bg-card/50 border border-border hover:border-primary/30 rounded-xl text-foreground placeholder-subtle-foreground focus:outline-none focus:border-primary focus:ring-2 focus:ring-ring/20 transition-all duration-300"
                  />
                </div>
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  type="submit"
                  disabled={loading}
                  className="bg-gradient-to-r from-primary to-primary-hover hover:from-primary-hover hover:to-primary-hover disabled:from-surface-hover disabled:to-surface-hover text-primary-foreground px-6 py-4 rounded-xl font-bold transition-all duration-300 flex items-center justify-center gap-2 whitespace-nowrap shadow-lg hover:shadow-primary/30"
                >
                  {loading ? (
                    <>
                      <motion.div
                        animate={{ rotate: 360 }}
                        transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                        className="w-5 h-5"
                      >
                        <Loader2 size={20} />
                      </motion.div>
                      <span>Tracking...</span>
                    </>
                  ) : (
                    <>
                      <Search size={20} />
                      <span>Track</span>
                    </>
                  )}
                </motion.button>
              </div>
              {error && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex items-center gap-3 p-3 rounded-lg mt-3 bg-destructive/10 border border-destructive/30 text-destructive"
                >
                  <AlertCircle size={18} />
                  <span className="text-sm">{error}</span>
                </motion.div>
              )}
            </form>

            {/* Tracking Results */}
            <AnimatePresence mode="wait">
              {trackingData && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="space-y-6"
                >
                  {/* MODERN DESIGN UPGRADE: Large centered status badge */}
                  <motion.div
                    initial={{ scale: 0.95, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    className="bg-gradient-to-br from-primary/10 via-card to-card rounded-2xl p-8 border border-primary/20"
                  >
                    <div className="flex flex-col items-center text-center">
                      <motion.div
                        animate={{ scale: [1, 1.1, 1] }}
                        transition={{ duration: 2, repeat: Infinity }}
                        className="mb-4"
                      >
                        {getStatusIcon(trackingData.status, false)}
                      </motion.div>
                      <h3 className="text-2xl font-bold text-foreground mb-3 flex items-center gap-3 justify-center">
                        <span>Tracking #{trackingData.id}</span>
                        <motion.button
                          whileHover={{ scale: 1.1 }}
                          onClick={copyToClipboard}
                          className="p-2 hover:bg-surface rounded-lg transition-colors"
                          title="Copy tracking number"
                        >
                          {copied ? (
                            <CheckCircle className="w-5 h-5 text-success" />
                          ) : (
                            <Copy className="w-5 h-5 text-muted-foreground hover:text-brand-text" />
                          )}
                        </motion.button>
                      </h3>
                      <motion.span
                        key={trackingData.status}
                        initial={{ scale: 0.8, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        className={`px-4 py-2 rounded-full text-sm font-bold border ${getStatusColor(
                          trackingData.status
                        )}`}
                      >
                        {getStatusText(trackingData.status)}
                      </motion.span>
                    </div>
                  </motion.div>

                  {/* Key Info Cards */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <motion.div
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.1 }}
                      className="bg-card/50 border border-border rounded-xl p-6 hover:border-primary/30 transition-colors"
                    >
                      <div className="flex items-start gap-4">
                        <div className="p-3 bg-primary/10 rounded-lg">
                          <MapPin className="text-brand-text" size={24} />
                        </div>
                        <div className="flex-1">
                          <p className="text-muted-foreground text-sm font-medium mb-1">
                            Current Location
                          </p>
                          <p className="text-foreground font-semibold">
                            {trackingData.currentLocation}
                          </p>
                        </div>
                      </div>
                    </motion.div>

                    <motion.div
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.2 }}
                      className="bg-card/50 border border-border rounded-xl p-6 hover:border-primary/30 transition-colors"
                    >
                      <div className="flex items-start gap-4">
                        <div className="p-3 bg-success/10 rounded-lg">
                          <Clock className="text-success" size={24} />
                        </div>
                        <div className="flex-1">
                          <p className="text-muted-foreground text-sm font-medium mb-1">
                            Estimated Delivery
                          </p>
                          <p className="text-foreground font-semibold">
                            {trackingData.estimatedDelivery}
                          </p>
                        </div>
                      </div>
                    </motion.div>
                  </div>

                  {/* MODERN DESIGN UPGRADE: Animated vertical timeline with pulsing current step */}
                  <div className="bg-card/50 border border-border rounded-2xl p-6 sm:p-8">
                    <h4 className="text-lg font-bold text-foreground mb-6 flex items-center gap-2">
                      <Package size={20} className="text-brand-text" />
                      Delivery Timeline
                    </h4>

                    <div className="space-y-6">
                      {trackingData.timeline.map((event, index) => {
                        const isCurrentStep =
                          index === trackingData.timeline.findIndex((e) => !e.completed);

                        return (
                          <motion.div
                            key={index}
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: index * 0.1 }}
                            className="flex gap-6 relative"
                          >
                            {/* Timeline Connector */}
                            {index < trackingData.timeline.length - 1 && (
                              <div className="absolute left-11 top-16 w-0.5 h-16 bg-gradient-to-b from-surface-hover to-surface" />
                            )}

                            {/* Step Icon */}
                            <div className="flex-shrink-0 z-10">
                              <div
                                className={`flex items-center justify-center w-12 h-12 rounded-full transition-all ${
                                  event.completed
                                    ? "bg-success/20 text-success"
                                    : isCurrentStep
                                      ? "bg-primary/20 text-brand-text"
                                      : "bg-surface-hover/50 text-muted-foreground"
                                }`}
                              >
                                {getStatusIcon(event.status, event.completed)}
                              </div>
                            </div>

                            {/* Step Content */}
                            <div className="flex-1 py-2">
                              <div className="flex items-center justify-between mb-2">
                                <h5
                                  className={`font-bold text-base ${
                                    event.completed
                                      ? "text-foreground"
                                      : isCurrentStep
                                        ? "text-brand-text"
                                        : "text-muted-foreground"
                                  }`}
                                >
                                  {getStatusText(event.status)}
                                </h5>
                                <span className="text-sm text-muted-foreground">
                                  {event.timestamp || "TBD"}
                                </span>
                              </div>
                              <p
                                className={`text-sm ${
                                  event.completed
                                    ? "text-muted-foreground"
                                    : "text-subtle-foreground"
                                }`}
                              >
                                {event.location}
                              </p>
                            </div>
                          </motion.div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Help Section */}
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.3 }}
                    className="bg-gradient-to-br from-info/10 to-purple-500/5 border border-info/20 rounded-2xl p-6 sm:p-8"
                  >
                    <h4 className="text-lg font-bold text-foreground mb-4 flex items-center gap-2">
                      <MessageSquare size={20} className="text-info" />
                      Need Help?
                    </h4>
                    <p className="text-muted-foreground mb-6">
                      If you have any questions about your delivery, our support
                      team is here to help 24/7.
                    </p>
                    <div className="flex flex-col sm:flex-row gap-3">
                      <motion.button
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        className="flex-1 bg-info hover:bg-info text-info-foreground px-4 py-3 rounded-lg font-bold transition-colors"
                      >
                        Contact Support
                      </motion.button>
                      <motion.button
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        className="flex-1 border border-border-strong hover:border-primary text-muted-foreground hover:text-brand-text px-4 py-3 rounded-lg font-bold transition-colors"
                      >
                        Report Issue
                      </motion.button>
                    </div>
                  </motion.div>
                </motion.div>
              )}

              {/* Empty State */}
              {!trackingData && !loading && trackingNumber && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="text-center py-12"
                >
                  <motion.div
                    animate={{ rotate: [0, -10, 10, 0] }}
                    transition={{ duration: 2, repeat: Infinity }}
                  >
                    <Package className="mx-auto text-muted-foreground mb-6" size={56} />
                  </motion.div>
                  <h3 className="text-xl font-bold text-foreground mb-3">
                    No tracking information found
                  </h3>
                  <p className="text-muted-foreground mb-6">
                    Please verify your tracking number and try again. It may take a few minutes for new shipments to appear in the system.
                  </p>
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => setTrackingNumber("")}
                    className="bg-primary hover:bg-primary-hover text-primary-foreground px-6 py-2 rounded-lg font-bold transition-colors"
                  >
                    Try Again
                  </motion.button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
