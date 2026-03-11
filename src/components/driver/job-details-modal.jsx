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
        return "bg-blue-100 text-blue-700 border border-blue-200";
      case "picked_up":
        return "bg-amber-100 text-amber-700 border border-amber-200";
      case "at_hub":
        return "bg-purple-100 text-purple-700 border border-purple-200";
      case "in_transit":
        return "bg-indigo-100 text-indigo-700 border border-indigo-200";
      case "delivered":
        return "bg-green-100 text-green-700 border border-green-200";
      default:
        return "bg-slate-100 text-slate-700 border border-slate-200";
    }
  };

  const getStatusLabel = (status) => {
    return status?.replace("_", " ").toUpperCase() || "UNKNOWN";
  };

  const getActionButtonClass = (status) => {
    switch (status) {
      case "assigned":
        return "bg-amber-500 hover:bg-amber-600 text-white";
      case "picked_up":
        return "bg-purple-500 hover:bg-purple-600 text-white";
      case "at_hub":
        return "bg-indigo-500 hover:bg-indigo-600 text-white";
      case "in_transit":
        return "bg-green-500 hover:bg-green-600 text-white";
      default:
        return "bg-slate-300 text-slate-600 cursor-not-allowed";
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ duration: 0.2 }}
            className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col"
          >
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-slate-200 bg-gradient-to-r from-slate-50 to-white">
              <div>
                <h2 className="text-2xl font-bold text-slate-900">
                  Job #{job.id?.slice(-8) || job.id}
                </h2>
                <p className="text-sm text-slate-600 mt-1">
                  {job.bookings?.length || 0} booking{job.bookings?.length !== 1 ? "s" : ""}
                </p>
              </div>
              <button
                onClick={onClose}
                className="p-2 hover:bg-slate-200 rounded-lg transition-colors"
                aria-label="Close modal"
              >
                <X className="h-6 w-6 text-slate-600" />
              </button>
            </div>

            {/* Content */}
            <div className="overflow-y-auto flex-1">
              <div className="p-6 space-y-6">
                {/* Bulk Actions Section */}
                <div className="bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-200 rounded-xl p-6">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
                    <div>
                      <h3 className="font-bold text-slate-900 flex items-center gap-2">
                        <AlertTriangle className="h-5 w-5 text-blue-600" />
                        Bulk Actions
                      </h3>
                      <p className="text-sm text-slate-600 mt-1">
                        Select bookings and upload a single photo for multiple deliveries
                      </p>
                    </div>
                    <button
                      onClick={() => setShowBulkDelivery(!showBulkDelivery)}
                      disabled={selectedBookings.length === 0}
                      className="px-4 py-2.5 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
                    >
                      Submit Bulk ({selectedBookings.length})
                    </button>
                  </div>

                  {/* Select All for Bulk */}
                  <div className="flex items-center gap-3 mb-4">
                    <button
                      onClick={handleSelectAll}
                      className="p-1 hover:bg-blue-100 rounded transition-colors"
                      aria-label="Select all bookings"
                    >
                      {selectedBookings.length === job.bookings?.length && job.bookings?.length > 0 ? (
                        <CheckSquare className="h-5 w-5 text-blue-600" />
                      ) : (
                        <Square className="h-5 w-5 text-slate-400" />
                      )}
                    </button>
                    <span className="text-sm font-medium text-slate-700">
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
                      className="mt-4 pt-4 border-t border-blue-200"
                    >
                      <div className="space-y-4">
                        <label className="block text-sm font-semibold text-slate-900">
                          Proof Photo (Required)
                        </label>

                        {bulkPhotoPreview ? (
                          <div className="relative bg-white rounded-lg p-4 border-2 border-dashed border-slate-300">
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
                              className="absolute top-2 right-2 p-2 bg-red-500 text-white rounded-full hover:bg-red-600 transition-colors"
                              aria-label="Remove photo"
                            >
                              <X className="h-4 w-4" />
                            </button>
                          </div>
                        ) : (
                          <label className="flex items-center justify-center gap-2 p-6 border-2 border-dashed border-slate-300 rounded-lg bg-white hover:bg-slate-50 cursor-pointer transition-colors">
                            <Upload className="h-5 w-5 text-slate-400" />
                            <span className="text-sm font-medium text-slate-700">
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
                          <label className="block text-sm font-semibold text-slate-900 mb-2">
                            Delivery Notes (Optional)
                          </label>
                          <textarea
                            value={bulkNotes}
                            onChange={(e) => setBulkNotes(e.target.value)}
                            placeholder="Add any notes about this delivery..."
                            rows={2}
                            className="w-full px-4 py-2 border border-slate-200 rounded-lg text-slate-900 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm resize-none"
                          />
                        </div>

                        <button
                          onClick={handleBulkDeliverySubmit}
                          disabled={!bulkPhoto || selectedBookings.length === 0}
                          className="w-full px-4 py-3 bg-green-600 text-white font-semibold rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          Complete Bulk Delivery
                        </button>
                      </div>
                    </motion.div>
                  )}
                </div>

                {/* Bookings List */}
                <div>
                  <h3 className="text-lg font-bold text-slate-900 mb-4">
                    Bookings ({job.bookings?.length || 0})
                  </h3>
                  <div className="space-y-4">
                    {job.bookings?.length ? (
                      job.bookings.map((booking) => (
                        <div
                          key={booking.id}
                          className="border border-slate-200 rounded-lg p-5 hover:shadow-md transition-shadow"
                        >
                          {/* Booking Header */}
                          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4 pb-4 border-b border-slate-100">
                            <div className="flex items-center gap-3">
                              <button
                                onClick={() => handleBookingSelect(booking.id)}
                                className="p-1 hover:bg-slate-100 rounded transition-colors"
                              >
                                {selectedBookings.includes(booking.id) ? (
                                  <CheckSquare className="h-5 w-5 text-blue-600" />
                                ) : (
                                  <Square className="h-5 w-5 text-slate-300" />
                                )}
                              </button>
                              <div>
                                <h4 className="font-bold text-slate-900">
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
                            <div className="flex flex-wrap gap-2">
                              {booking.status === "assigned" && (
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
                              )}
                              {booking.status === "delivered" && (
                                <div className="px-3 py-1.5 text-sm font-semibold rounded-lg bg-slate-100 text-slate-600">
                                  Completed
                                </div>
                              )}
                            </div>
                          </div>

                          {/* Pickup & Delivery Details */}
                          <div className="grid sm:grid-cols-2 gap-6">
                            {/* Pickup Section */}
                            <div className="space-y-3">
                              <h5 className="font-semibold text-slate-900 flex items-center gap-2">
                                <MapPin className="h-4 w-4 text-green-600" />
                                Pickup Location
                              </h5>
                              <div className="space-y-2 text-sm ml-6">
                                {booking.pickup_address && (
                                  <div className="text-slate-700 font-medium">
                                    {booking.pickup_address}
                                    {booking.pickup_city && (
                                      <p className="text-slate-500 text-xs mt-1">
                                        {booking.pickup_city}
                                        {booking.pickup_state && `, ${booking.pickup_state}`}
                                      </p>
                                    )}
                                  </div>
                                )}
                                {booking.pickup_contact_name && (
                                  <div className="flex items-center gap-2 text-slate-700">
                                    <User className="h-3.5 w-3.5 text-slate-400" />
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
                                    className="flex items-center gap-2 text-blue-600 hover:text-blue-700 font-medium"
                                  >
                                    <Phone className="h-3.5 w-3.5" />
                                    {booking.pickup_contact_phone}
                                  </button>
                                )}
                                {booking.pickup_time_window && (
                                  <div className="flex items-center gap-2 text-slate-600">
                                    <Clock className="h-3.5 w-3.5 text-slate-400" />
                                    {booking.pickup_time_window}
                                  </div>
                                )}
                              </div>
                            </div>

                            {/* Delivery Section */}
                            <div className="space-y-3">
                              <h5 className="font-semibold text-slate-900 flex items-center gap-2">
                                <MapPin className="h-4 w-4 text-blue-600" />
                                Delivery Location
                              </h5>
                              <div className="space-y-2 text-sm ml-6">
                                {booking.delivery_address && (
                                  <div className="text-slate-700 font-medium">
                                    {booking.delivery_address}
                                    {booking.delivery_city && (
                                      <p className="text-slate-500 text-xs mt-1">
                                        {booking.delivery_city}
                                        {booking.delivery_state && `, ${booking.delivery_state}`}
                                      </p>
                                    )}
                                  </div>
                                )}
                                {booking.delivery_contact_name && (
                                  <div className="flex items-center gap-2 text-slate-700">
                                    <User className="h-3.5 w-3.5 text-slate-400" />
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
                                    className="flex items-center gap-2 text-blue-600 hover:text-blue-700 font-medium"
                                  >
                                    <Phone className="h-3.5 w-3.5" />
                                    {booking.delivery_contact_phone}
                                  </button>
                                )}
                                {booking.delivery_time_window && (
                                  <div className="flex items-center gap-2 text-slate-600">
                                    <Clock className="h-3.5 w-3.5 text-slate-400" />
                                    {booking.delivery_time_window}
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>

                          {/* Package Details */}
                          {(booking.package_details || booking.special_instructions) && (
                            <div className="mt-4 p-4 bg-slate-50 rounded-lg border border-slate-200">
                              {booking.package_details && (
                                <div className="mb-3">
                                  <h6 className="font-semibold text-slate-900 text-sm mb-1">
                                    Package
                                  </h6>
                                  <p className="text-sm text-slate-600">
                                    {booking.package_details}
                                  </p>
                                </div>
                              )}
                              {booking.special_instructions && (
                                <div>
                                  <h6 className="font-semibold text-slate-900 text-sm mb-1">
                                    Special Instructions
                                  </h6>
                                  <p className="text-sm text-amber-700 bg-amber-50 px-3 py-2 rounded border border-amber-200">
                                    {booking.special_instructions}
                                  </p>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      ))
                    ) : (
                      <p className="text-slate-600 text-center py-6">
                        No bookings found for this job
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-slate-200 bg-slate-50 flex justify-end">
              <button
                onClick={onClose}
                className="px-4 py-2.5 bg-slate-200 text-slate-900 font-semibold rounded-lg hover:bg-slate-300 transition-colors"
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
