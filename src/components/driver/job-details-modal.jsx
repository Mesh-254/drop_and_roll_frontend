"use client";

import { useState } from "react";
import {
  X,
  MapPin,
  Phone,
  User,
  Clock,
  Camera,
  Upload,
  CheckSquare,
  Square,
  AlertTriangle,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

export function JobDetailsModal({
  job,
  isOpen,
  onClose,
  onUpdateBookingStatus,
  onBulkDelivery,
  onReportFailure, // Callback for reporting failures
}) {
  const [selectedBookings, setSelectedBookings] = useState([]);
  const [bulkPhoto, setBulkPhoto] = useState(null);
  const [bulkPhotoPreview, setBulkPhotoPreview] = useState(null);
  const [showBulkDelivery, setShowBulkDelivery] = useState(false);
  const [bulkNotes, setBulkNotes] = useState("");

  if (!job) return null;

  const handleBookingSelect = (bookingId) => {
    setSelectedBookings((prev) =>
      prev.includes(bookingId)
        ? prev.filter((id) => id !== bookingId)
        : [...prev, bookingId]
    );
  };

  const handleSelectAll = () => {
    if (selectedBookings.length === job.bookings?.length) {
      setSelectedBookings([]);
    } else {
      setSelectedBookings((job.bookings || []).map((b) => b.id));
    }
  };

  const handleBulkPhotoUpload = (event) => {
    const file = event.target.files[0];
    if (file) {
      setBulkPhoto(file);
      setBulkPhotoPreview(URL.createObjectURL(file));
    }
  };

  const handleBulkDeliverySubmit = async () => {
    if (!bulkPhoto || selectedBookings.length === 0) return;

    const formData = new FormData();
    formData.append("photo", bulkPhoto);
    formData.append("booking_ids", JSON.stringify(selectedBookings));
    formData.append("delivery_notes", bulkNotes || "Bulk delivery completed");

    await onBulkDelivery(formData);
    setShowBulkDelivery(false);
    setBulkPhoto(null);
    setBulkPhotoPreview(null);
    setSelectedBookings([]);
    setBulkNotes("");
  };

  const getStatusBadgeClass = (status) => {
    switch (status) {
      case "assigned":
        return "bg-info-surface text-info border border-info/30";
      case "picked_up":
        return "bg-warning-surface text-warning border border-warning/30";
      case "at_hub":
        return "bg-purple-100 text-purple-700 border border-purple-200";
      case "in_transit":
        return "bg-info-surface text-info border border-info/30";
      case "delivered":
        return "bg-success-surface text-success border border-success/30";
      default:
        return "bg-muted text-muted-foreground border border-border";
    }
  };

  const getStatusLabel = (status) => {
    return status?.replace("_", " ").toUpperCase() || "UNKNOWN";
  };

  const getActionButtonClass = (status) => {
    switch (status) {
      case "assigned":
        return "bg-warning hover:bg-warning text-warning-foreground";
      case "picked_up":
        return "bg-purple-500 hover:bg-purple-600 text-primary-foreground";
      case "at_hub":
        return "bg-info hover:bg-info text-primary-foreground";
      case "in_transit":
        return "bg-success hover:bg-success text-success-foreground";
      default:
        return "bg-surface-hover text-muted-foreground cursor-not-allowed";
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-overlay backdrop-blur-sm">
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ duration: 0.2 }}
            className="bg-card rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col"
          >
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-border bg-gradient-to-r from-muted to-card">
              <div>
                <h2 className="text-2xl font-bold text-foreground">
                  Job #{job.id?.slice(-8) || job.id}
                </h2>
                <p className="text-sm text-muted-foreground mt-1">
                  {job.bookings?.length || 0} booking{job.bookings?.length !== 1 ? "s" : ""}
                </p>
              </div>
              <button
                onClick={onClose}
                className="p-2 hover:bg-surface-hover rounded-lg transition-colors"
                aria-label="Close modal"
              >
                <X className="h-6 w-6 text-muted-foreground" />
              </button>
            </div>

            {/* Content */}
            <div className="overflow-y-auto flex-1">
              <div className="p-6 space-y-6">
                {/* Bulk Actions Section */}
                <div className="bg-gradient-to-br from-info-surface to-info-surface border border-info/30 rounded-xl p-6">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
                    <div>
                      <h3 className="font-bold text-foreground flex items-center gap-2">
                        <AlertTriangle className="h-5 w-5 text-info" />
                        Bulk Actions
                      </h3>
                      <p className="text-sm text-muted-foreground mt-1">
                        Select bookings and upload a single photo for multiple deliveries
                      </p>
                    </div>
                    <button
                      onClick={() => setShowBulkDelivery(!showBulkDelivery)}
                      disabled={selectedBookings.length === 0}
                      className="px-4 py-2.5 bg-info text-info-foreground text-sm font-semibold rounded-lg hover:bg-info transition-colors disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
                    >
                      Submit Bulk ({selectedBookings.length})
                    </button>
                  </div>

                  {/* Select All for Bulk */}
                  <div className="flex items-center gap-3 mb-4">
                    <button
                      onClick={handleSelectAll}
                      className="p-1 hover:bg-info-surface rounded transition-colors"
                      aria-label="Select all bookings"
                    >
                      {selectedBookings.length === job.bookings?.length && job.bookings?.length > 0 ? (
                        <CheckSquare className="h-5 w-5 text-info" />
                      ) : (
                        <Square className="h-5 w-5 text-muted-foreground" />
                      )}
                    </button>
                    <span className="text-sm font-medium text-muted-foreground">
                      {selectedBookings.length > 0
                        ? `${selectedBookings.length} selected`
                        : "Select bookings to bulk deliver"}
                    </span>
                  </div>

                  {/* Bulk Photo Upload Form */}
                  {showBulkDelivery && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      className="mt-4 pt-4 border-t border-info/30"
                    >
                      <div className="space-y-4">
                        <label className="block text-sm font-semibold text-foreground">
                          Proof Photo (Required)
                        </label>

                        {bulkPhotoPreview ? (
                          <div className="relative bg-card rounded-lg p-4 border-2 border-dashed border-border-strong">
                            <img
                              src={bulkPhotoPreview}
                              alt="Bulk delivery proof"
                              className="w-full max-h-48 object-contain rounded-lg"
                            />
                            <button
                              onClick={() => {
                                setBulkPhoto(null);
                                setBulkPhotoPreview(null);
                              }}
                              className="absolute top-2 right-2 p-2 bg-destructive text-destructive-foreground rounded-full hover:bg-destructive transition-colors"
                              aria-label="Remove photo"
                            >
                              <X className="h-4 w-4" />
                            </button>
                          </div>
                        ) : (
                          <label className="flex items-center justify-center gap-2 p-6 border-2 border-dashed border-border-strong rounded-lg bg-card hover:bg-muted cursor-pointer transition-colors">
                            <Upload className="h-5 w-5 text-muted-foreground" />
                            <span className="text-sm font-medium text-muted-foreground">
                              Click to upload photo
                            </span>
                            <input
                              type="file"
                              accept="image/*"
                              onChange={handleBulkPhotoUpload}
                              className="hidden"
                            />
                          </label>
                        )}

                        <div>
                          <label className="block text-sm font-semibold text-foreground mb-2">
                            Delivery Notes (Optional)
                          </label>
                          <textarea
                            value={bulkNotes}
                            onChange={(e) => setBulkNotes(e.target.value)}
                            placeholder="Add any notes about this delivery..."
                            rows={2}
                            className="w-full px-4 py-2 border border-border rounded-lg text-foreground placeholder-subtle-foreground focus:outline-none focus:ring-2 focus:ring-info focus:border-transparent text-sm resize-none"
                          />
                        </div>

                        <button
                          onClick={handleBulkDeliverySubmit}
                          disabled={!bulkPhoto || selectedBookings.length === 0}
                          className="w-full px-4 py-3 bg-success text-success-foreground font-semibold rounded-lg hover:bg-success transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          Complete Bulk Delivery
                        </button>
                      </div>
                    </motion.div>
                  )}
                </div>

                {/* Bookings List */}
                <div>
                  <h3 className="text-lg font-bold text-foreground mb-4">
                    Bookings ({job.bookings?.length || 0})
                  </h3>
                  <div className="space-y-4">
                    {job.bookings?.length ? (
                      job.bookings.map((booking) => (
                        <div
                          key={booking.id}
                          className="border border-border rounded-lg p-5 hover:shadow-md transition-shadow"
                        >
                          {/* Booking Header */}
                          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4 pb-4 border-b border-border">
                            <div className="flex items-center gap-3">
                              <button
                                onClick={() => handleBookingSelect(booking.id)}
                                className="p-1 hover:bg-muted rounded transition-colors"
                              >
                                {selectedBookings.includes(booking.id) ? (
                                  <CheckSquare className="h-5 w-5 text-info" />
                                ) : (
                                  <Square className="h-5 w-5 text-muted-foreground" />
                                )}
                              </button>
                              <div>
                                <h4 className="font-bold text-foreground">
                                  Booking #{booking.id?.slice(-8) || booking.id}
                                </h4>
                                <span
                                  className={`inline-block mt-1 px-2.5 py-1 rounded-full text-xs font-semibold border ${getStatusBadgeClass(
                                    booking.status
                                  )}`}
                                >
                                  {getStatusLabel(booking.status)}
                                </span>
                              </div>
                            </div>

                            {/* Action Buttons */}
                            <div className="flex flex-col sm:flex-row flex-wrap gap-2">
                              {booking.status === "assigned" && (
                                <>
                                  <button
                                    onClick={() =>
                                      onUpdateBookingStatus(booking.id, "picked_up")
                                    }
                                    className={`px-3 py-1.5 text-sm font-semibold rounded-lg transition-colors ${getActionButtonClass(
                                      booking.status
                                    )}`}
                                  >
                                    ► Pick Up
                                  </button>
                                  {onReportFailure && (
                                    <button
                                      onClick={() =>
                                        onReportFailure(booking.id, "pickup", booking.id)
                                      }
                                      className="px-3 py-1.5 text-sm font-semibold rounded-lg bg-warning hover:bg-warning text-warning-foreground transition-colors flex items-center gap-1"
                                    >
                                      <AlertTriangle className="h-3.5 w-3.5" />
                                      Pickup Issue
                                    </button>
                                  )}
                                </>
                              )}
                              {booking.status === "picked_up" && (
                                <button
                                  onClick={() =>
                                    onUpdateBookingStatus(booking.id, "in_transit")
                                  }
                                  className={`px-3 py-1.5 text-sm font-semibold rounded-lg transition-colors ${getActionButtonClass(
                                    "picked_up"
                                  )}`}
                                >
                                  ↗ In Transit
                                </button>
                              )}
                              {booking.status === "in_transit" && (
                                <>
                                  <button
                                    onClick={() =>
                                      onUpdateBookingStatus(booking.id, "delivered")
                                    }
                                    className={`px-3 py-1.5 text-sm font-semibold rounded-lg transition-colors ${getActionButtonClass(
                                      "in_transit"
                                    )}`}
                                  >
                                    ✓ Deliver
                                  </button>
                                  {onReportFailure && (
                                    <button
                                      onClick={() =>
                                        onReportFailure(booking.id, "delivery", booking.id)
                                      }
                                      className="px-3 py-1.5 text-sm font-semibold rounded-lg bg-primary hover:bg-primary-hover text-primary-foreground transition-colors flex items-center gap-1"
                                    >
                                      <AlertTriangle className="h-3.5 w-3.5" />
                                      Delivery Issue
                                    </button>
                                  )}
                                </>
                              )}
                              {booking.status === "delivered" && (
                                <div className="px-3 py-1.5 text-sm font-semibold rounded-lg bg-muted text-muted-foreground">
                                  Completed
                                </div>
                              )}
                            </div>
                          </div>

                          {/* Pickup & Delivery Details */}
                          <div className="grid sm:grid-cols-2 gap-6">
                            {/* Pickup Section */}
                            <div className="space-y-3">
                              <h5 className="font-semibold text-foreground flex items-center gap-2">
                                <MapPin className="h-4 w-4 text-success" />
                                Pickup Location
                              </h5>
                              <div className="space-y-2 text-sm ml-6">
                                {booking.pickup_address && (
                                  <div className="text-muted-foreground font-medium">
                                    {booking.pickup_address}
                                    {booking.pickup_city && (
                                      <p className="text-subtle-foreground text-xs mt-1">
                                        {booking.pickup_city}
                                        {booking.pickup_state && `, ${booking.pickup_state}`}
                                      </p>
                                    )}
                                  </div>
                                )}
                                {booking.pickup_contact_name && (
                                  <div className="flex items-center gap-2 text-muted-foreground">
                                    <User className="h-3.5 w-3.5 text-muted-foreground" />
                                    {booking.pickup_contact_name}
                                  </div>
                                )}
                                {booking.pickup_contact_phone && (
                                  <button
                                    onClick={() =>
                                      (window.location.href = `tel:${booking.pickup_contact_phone.replace(
                                        /\D/g,
                                        ""
                                      )}`)
                                    }
                                    className="flex items-center gap-2 text-info hover:text-info font-medium"
                                  >
                                    <Phone className="h-3.5 w-3.5" />
                                    {booking.pickup_contact_phone}
                                  </button>
                                )}
                                {booking.pickup_time_window && (
                                  <div className="flex items-center gap-2 text-muted-foreground">
                                    <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                                    {booking.pickup_time_window}
                                  </div>
                                )}
                              </div>
                            </div>

                            {/* Delivery Section */}
                            <div className="space-y-3">
                              <h5 className="font-semibold text-foreground flex items-center gap-2">
                                <MapPin className="h-4 w-4 text-info" />
                                Delivery Location
                              </h5>
                              <div className="space-y-2 text-sm ml-6">
                                {booking.delivery_address && (
                                  <div className="text-muted-foreground font-medium">
                                    {booking.delivery_address}
                                    {booking.delivery_city && (
                                      <p className="text-subtle-foreground text-xs mt-1">
                                        {booking.delivery_city}
                                        {booking.delivery_state && `, ${booking.delivery_state}`}
                                      </p>
                                    )}
                                  </div>
                                )}
                                {booking.delivery_contact_name && (
                                  <div className="flex items-center gap-2 text-muted-foreground">
                                    <User className="h-3.5 w-3.5 text-muted-foreground" />
                                    {booking.delivery_contact_name}
                                  </div>
                                )}
                                {booking.delivery_contact_phone && (
                                  <button
                                    onClick={() =>
                                      (window.location.href = `tel:${booking.delivery_contact_phone.replace(
                                        /\D/g,
                                        ""
                                      )}`)
                                    }
                                    className="flex items-center gap-2 text-info hover:text-info font-medium"
                                  >
                                    <Phone className="h-3.5 w-3.5" />
                                    {booking.delivery_contact_phone}
                                  </button>
                                )}
                                {booking.delivery_time_window && (
                                  <div className="flex items-center gap-2 text-muted-foreground">
                                    <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                                    {booking.delivery_time_window}
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>

                          {/* Package Details */}
                          {(booking.package_details || booking.special_instructions) && (
                            <div className="mt-4 p-4 bg-muted rounded-lg border border-border">
                              {booking.package_details && (
                                <div className="mb-3">
                                  <h6 className="font-semibold text-foreground text-sm mb-1">
                                    Package
                                  </h6>
                                  <p className="text-sm text-muted-foreground">
                                    {booking.package_details}
                                  </p>
                                </div>
                              )}
                              {booking.special_instructions && (
                                <div>
                                  <h6 className="font-semibold text-foreground text-sm mb-1">
                                    Special Instructions
                                  </h6>
                                  <p className="text-sm text-warning bg-warning-surface px-3 py-2 rounded border border-warning/30">
                                    {booking.special_instructions}
                                  </p>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      ))
                    ) : (
                      <p className="text-muted-foreground text-center py-6">
                        No bookings found for this job
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-border bg-muted flex justify-end">
              <button
                onClick={onClose}
                className="px-4 py-2.5 bg-surface-hover text-foreground font-semibold rounded-lg hover:bg-surface-hover transition-colors"
              >
                Close
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
