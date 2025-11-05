"use client";
import { useState } from "react";
import {
  X,
  Search,
  Package,
  MapPin,
  Clock,
  Truck,
  CheckCircle,
} from "lucide-react";
import { bookingApi } from "../../api/BookingApi"; // Adjust path if needed

export default function TrackParcelModal({ isOpen, onClose }) {
  const [trackingNumber, setTrackingNumber] = useState("");
  const [trackingData, setTrackingData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

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
      // Use backend-provided data directly (aligned with custom payload)
      const mappedData = {
        id: result.data.tracking_number,
        status: result.data.status,
        currentLocation: result.data.current_location,
        estimatedDelivery: result.data.estimated_delivery || "TBD",
        timeline: result.data.timeline.map((event) => ({
          ...event,
          completed: event.completed,
          // Timestamp is already formatted by backend
        })),
      };
      setTrackingData(mappedData);
    } catch (err) {
      setError(err.message || "Failed to fetch tracking information. Please check the tracking number and try again.");
    } finally {
      setLoading(false);
    }
  };

  const getStatusIcon = (status, completed) => {
    if (completed) {
      return <CheckCircle className="text-green-400" size={20} />;
    }

    switch (status) {
      case "picked_up":
        return <Package className="text-orange-500" size={20} />;
      case "in_transit":
        return <Truck className="text-blue-400" size={20} />;
      case "out_for_delivery": // Not in model, but for compatibility
        return <MapPin className="text-yellow-400" size={20} />;
      case "delivered":
        return <CheckCircle className="text-gray-400" size={20} />;
      default:
        return <Clock className="text-gray-400" size={20} />;
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

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-black border border-orange-500/20 rounded-lg w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-800">
          <h2 className="text-xl font-bold text-white">Track Your Parcel</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors p-1"
          >
            <X size={24} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {/* Tracking Form */}
          <form onSubmit={handleTrack} className="mb-6">
            <div className="flex space-x-3">
              <div className="flex-1">
                <input
                  type="text"
                  placeholder="Enter tracking number (e.g., BK-ABC123)"
                  value={trackingNumber}
                  onChange={(e) => setTrackingNumber(e.target.value)}
                  className="w-full px-4 py-3 bg-gray-900 border border-gray-700 rounded-lg text-white placeholder-gray-400 focus:border-orange-500 focus:outline-none"
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                className="bg-orange-500 hover:bg-orange-600 disabled:bg-orange-500/50 text-white px-6 py-3 rounded-lg font-medium transition-colors flex items-center space-x-2"
              >
                {loading ? (
                  <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent" />
                ) : (
                  <Search size={20} />
                )}
                <span>{loading ? "Tracking..." : "Track"}</span>
              </button>
            </div>
            {error && <p className="text-red-400 text-sm mt-2">{error}</p>}
          </form>

          {/* Tracking Results */}
          {trackingData && (
            <div className="space-y-6">
              {/* Status Overview */}
              <div className="bg-gray-900 rounded-lg p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-white">
                    Tracking #{trackingData.id}
                  </h3>
                  <span className="px-3 py-1 bg-blue-500/20 text-blue-400 rounded-full text-sm font-medium border border-blue-500/30">
                    {getStatusText(trackingData.status)}
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="flex items-center space-x-3">
                    <MapPin className="text-orange-500" size={20} />
                    <div>
                      <p className="text-gray-400 text-sm">Current Location</p>
                      <p className="text-white font-medium">
                        {trackingData.currentLocation}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center space-x-3">
                    <Clock className="text-green-400" size={20} />
                    <div>
                      <p className="text-gray-400 text-sm">
                        Estimated Delivery
                      </p>
                      <p className="text-white font-medium">
                        {trackingData.estimatedDelivery}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Timeline */}
              <div className="bg-gray-900 rounded-lg p-6">
                <h4 className="text-lg font-semibold text-white mb-4">
                  Tracking Timeline
                </h4>

                <div className="space-y-4">
                  {trackingData.timeline.map((event, index) => (
                    <div key={index} className="flex items-start space-x-4 relative">
                      <div className="flex-shrink-0 mt-1">
                        {getStatusIcon(event.status, event.completed)}
                      </div>

                      <div className="flex-1">
                        <div className="flex items-center justify-between">
                          <h5
                            className={`font-medium ${event.completed ? "text-white" : "text-gray-400"}`}
                          >
                            {getStatusText(event.status)}
                          </h5>
                          <span
                            className={`text-sm ${event.completed ? "text-gray-300" : "text-gray-500"}`}
                          >
                            {event.timestamp || "TBD"}
                          </span>
                        </div>
                        <p
                          className={`text-sm ${event.completed ? "text-gray-300" : "text-gray-500"}`}
                        >
                          {event.location}
                        </p>
                      </div>

                      {index < trackingData.timeline.length - 1 && (
                        <div className="absolute left-[30px] top-8 w-0.5 h-full bg-gray-700" />
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Help Section */}
              <div className="bg-gray-900 rounded-lg p-6">
                <h4 className="text-lg font-semibold text-white mb-3">
                  Need Help?
                </h4>
                <p className="text-gray-400 mb-4">
                  If you have any questions about your delivery, our support
                  team is here to help.
                </p>
                <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-4">
                  <button className="bg-orange-500 hover:bg-orange-600 text-white px-4 py-2 rounded-lg font-medium transition-colors">
                    Contact Support
                  </button>
                  <button className="border border-gray-600 hover:border-orange-500 text-gray-300 hover:text-orange-500 px-4 py-2 rounded-lg font-medium transition-colors">
                    Report Issue
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* No Results State */}
          {!trackingData && !loading && trackingNumber && (
            <div className="text-center py-8">
              <Package className="mx-auto text-gray-600 mb-4" size={48} />
              <h3 className="text-lg font-medium text-white mb-2">
                No tracking information found
              </h3>
              <p className="text-gray-400">
                Please verify your tracking number or try again later.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
