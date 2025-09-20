"use client";

import { useState } from "react";
import {
  X,
  MapPin,
  Phone,
  User,
  Package,
  Clock,
  Camera,
  Upload,
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

  if (!job) return null;

  const handleBookingSelect = (bookingId) => {
    setSelectedBookings((prev) =>
      prev.includes(bookingId)
        ? prev.filter((id) => id !== bookingId)
        : [...prev, bookingId]
    );
  };

  const handleBulkPhotoCapture = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      const video = document.createElement("video");
      video.srcObject = stream;
      video.play();

      const canvas = document.createElement("canvas");
      const context = canvas.getContext("2d");

      setTimeout(() => {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        context.drawImage(video, 0, 0);

        canvas.toBlob((blob) => {
          setBulkPhoto(blob);
          setBulkPhotoPreview(URL.createObjectURL(blob));
          stream.getTracks().forEach((track) => track.stop());
        });
      }, 3000);
    } catch (error) {
      console.error("Camera access failed:", error);
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
    formData.append("delivery_notes", "Bulk delivery completed");

    await onBulkDelivery(formData);
    setShowBulkDelivery(false);
    setBulkPhoto(null);
    setBulkPhotoPreview(null);
    setSelectedBookings([]);
  };

  const getStatusColor = (status) => {
    switch (status) {
      case "assigned":
        return "bg-blue-500/20 text-blue-400 border-blue-500/30";
      case "picked_up":
        return "bg-yellow-500/20 text-yellow-400 border-yellow-500/30";
      case "in_transit":
        return "bg-purple-500/20 text-purple-400 border-purple-500/30";
      case "delivered":
        return "bg-green-500/20 text-green-400 border-green-500/30";
      default:
        return "bg-gray-500/20 text-gray-400 border-gray-500/30";
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="bg-gray-900 rounded-lg border border-gray-800 w-full max-w-4xl max-h-[90vh] overflow-hidden"
          >
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-gray-800">
              <h2 className="text-xl font-montserrat font-bold text-white">
                Job #{job.id} - {job.bookings?.length || 0} Bookings
              </h2>
              <button
                onClick={onClose}
                className="p-2 hover:bg-gray-800 rounded-lg transition-colors"
              >
                <X className="h-5 w-5 text-gray-400" />
              </button>
            </div>

            {/* Content */}
            <div className="p-6 overflow-y-auto max-h-[calc(90vh-140px)]">
              {/* Bulk Actions */}
              <div className="mb-6 p-4 bg-gray-800 rounded-lg">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-montserrat font-semibold text-white">
                    Bulk Actions
                  </h3>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setShowBulkDelivery(!showBulkDelivery)}
                      disabled={selectedBookings.length === 0}
                      className="px-4 py-2 bg-orange-500 text-white rounded-lg font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:bg-orange-600 transition-colors"
                    >
                      Bulk Delivery ({selectedBookings.length})
                    </button>
                  </div>
                </div>

                {/* Bulk Delivery Form */}
                {showBulkDelivery && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    className="border-t border-gray-700 pt-4 mt-4"
                  >
                    <h4 className="text-white font-medium mb-3">
                      Upload Delivery Photo
                    </h4>
                    <div className="flex gap-4 mb-4">
                      <button
                        onClick={handleBulkPhotoCapture}
                        className="flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
                      >
                        <Camera className="h-4 w-4" />
                        Take Photo
                      </button>
                      <label className="flex items-center gap-2 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors cursor-pointer">
                        <Upload className="h-4 w-4" />
                        Upload Photo
                        <input
                          type="file"
                          accept="image/*"
                          onChange={handleBulkPhotoUpload}
                          className="hidden"
                        />
                      </label>
                    </div>

                    {bulkPhotoPreview && (
                      <div className="mb-4">
                        <img
                          src={bulkPhotoPreview || "/placeholder.svg"}
                          alt="Bulk delivery proof"
                          className="w-32 h-32 object-cover rounded-lg border border-gray-600"
                        />
                      </div>
                    )}

                    <button
                      onClick={handleBulkDeliverySubmit}
                      disabled={!bulkPhoto || selectedBookings.length === 0}
                      className="px-6 py-2 bg-green-500 text-white rounded-lg font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:bg-green-600 transition-colors"
                    >
                      Complete Bulk Delivery
                    </button>
                  </motion.div>
                )}
              </div>

              {/* Bookings List */}
              <div className="space-y-4">
                {job.bookings?.map((booking) => (
                  <div
                    key={booking.id}
                    className="bg-gray-800 rounded-lg p-4 border border-gray-700"
                  >
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <input
                          type="checkbox"
                          checked={selectedBookings.includes(booking.id)}
                          onChange={() => handleBookingSelect(booking.id)}
                          className="w-4 h-4 text-orange-500 bg-gray-700 border-gray-600 rounded focus:ring-orange-500"
                        />
                        <div>
                          <h4 className="font-montserrat font-semibold text-white">
                            Booking #{booking.id}
                          </h4>
                          <span
                            className={`inline-block px-2 py-1 rounded-full text-xs font-medium border ${getStatusColor(
                              booking.status
                            )}`}
                          >
                            {booking.status?.replace("_", " ").toUpperCase()}
                          </span>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() =>
                            onUpdateBookingStatus(booking.id, "picked_up")
                          }
                          disabled={booking.status !== "assigned"}
                          className="px-3 py-1 bg-yellow-500 text-white text-sm rounded hover:bg-yellow-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                          Pick Up
                        </button>
                        <button
                          onClick={() =>
                            onUpdateBookingStatus(booking.id, "in_transit")
                          }
                          disabled={booking.status !== "picked_up"}
                          className="px-3 py-1 bg-purple-500 text-white text-sm rounded hover:bg-purple-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                          In Transit
                        </button>
                        <button
                          onClick={() =>
                            onUpdateBookingStatus(booking.id, "delivered")
                          }
                          disabled={booking.status !== "in_transit"}
                          className="px-3 py-1 bg-green-500 text-white text-sm rounded hover:bg-green-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                          Delivered
                        </button>
                      </div>
                    </div>

                    {/* Booking Details Grid */}
                    <div className="grid md:grid-cols-2 gap-4">
                      {/* Pickup Details */}
                      <div className="space-y-3">
                        <h5 className="font-medium text-orange-500 flex items-center gap-2">
                          <Package className="h-4 w-4" />
                          Pickup Details
                        </h5>
                        <div className="space-y-2 text-sm">
                          <div className="flex items-start gap-2">
                            <MapPin className="h-4 w-4 text-gray-400 mt-0.5" />
                            <div>
                              <p className="text-white">
                                {booking.pickup_address}
                              </p>
                              <p className="text-gray-400">
                                {booking.pickup_city}, {booking.pickup_state}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <User className="h-4 w-4 text-gray-400" />
                            <span className="text-white">
                              {booking.pickup_contact_name}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Phone className="h-4 w-4 text-gray-400" />
                            <span className="text-white">
                              {booking.pickup_contact_phone}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Clock className="h-4 w-4 text-gray-400" />
                            <span className="text-white">
                              {booking.pickup_time_window}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Delivery Details */}
                      <div className="space-y-3">
                        <h5 className="font-medium text-orange-500 flex items-center gap-2">
                          <MapPin className="h-4 w-4" />
                          Delivery Details
                        </h5>
                        <div className="space-y-2 text-sm">
                          <div className="flex items-start gap-2">
                            <MapPin className="h-4 w-4 text-gray-400 mt-0.5" />
                            <div>
                              <p className="text-white">
                                {booking.delivery_address}
                              </p>
                              <p className="text-gray-400">
                                {booking.delivery_city},{" "}
                                {booking.delivery_state}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <User className="h-4 w-4 text-gray-400" />
                            <span className="text-white">
                              {booking.delivery_contact_name}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Phone className="h-4 w-4 text-gray-400" />
                            <span className="text-white">
                              {booking.delivery_contact_phone}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Clock className="h-4 w-4 text-gray-400" />
                            <span className="text-white">
                              {booking.delivery_time_window}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Package Info */}
                    {booking.package_details && (
                      <div className="mt-4 p-3 bg-gray-700 rounded-lg">
                        <h6 className="font-medium text-white mb-2">
                          Package Details
                        </h6>
                        <p className="text-sm text-gray-300">
                          {booking.package_details}
                        </p>
                        {booking.special_instructions && (
                          <p className="text-sm text-orange-400 mt-1">
                            Special Instructions: {booking.special_instructions}
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
