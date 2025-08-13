"use client";

import { useState, useEffect, lazy, Suspense } from "react";
import { X, MapPin, Loader2 } from "lucide-react";
const MapComponent = lazy(() => import("../map/MapComponent"));

export default function TrackParcelModal({ isOpen, onClose }) {
  const [trackingNumber, setTrackingNumber] = useState("");
  const [showMap, setShowMap] = useState(false);
  const [mapCoords, setMapCoords] = useState({ lat: 44.6488, lng: -63.585 }); // Default Halifax coords
  const [loading, setLoading] = useState(false);

  // Simulate real-time tracking update (replace with API call in production)
  useEffect(() => {
    let interval;
    if (showMap) {
      interval = setInterval(() => {
        setMapCoords((prev) => ({
          lat: prev.lat + (Math.random() - 0.5) * 0.01,
          lng: prev.lng + (Math.random() - 0.5) * 0.01,
        }));
      }, 2000); // Update every 2 seconds
    }
    return () => clearInterval(interval);
  }, [showMap]);

  const handleTrack = () => {
    if (trackingNumber) {
      setLoading(true);
      setTimeout(() => {
        setShowMap(true);
        setLoading(false);
        // In production, replace with API call to get real coordinates
      }, 1000); // Simulate API delay
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/90 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-gray-900 rounded-2xl max-w-2xl w-full max-h-[95vh] overflow-y-auto border border-gray-700 shadow-2xl">
        {/* Header */}
        <div className="flex justify-between items-center p-6 border-b border-gray-700 bg-gray-800 rounded-t-2xl">
          <h2 className="text-2xl font-bold text-white">Track Your Parcel</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors p-2 hover:bg-gray-700 rounded-lg"
          >
            <X size={24} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          <div className="space-y-6">
            <div>
              <label className="block text-white font-medium mb-2">Tracking Number *</label>
              <input
                type="text"
                value={trackingNumber}
                onChange={(e) => setTrackingNumber(e.target.value)}
                placeholder="Enter your tracking number"
                className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-orange-500 transition-colors"
              />
            </div>

            <button
              onClick={handleTrack}
              disabled={!trackingNumber || loading}
              className="w-full bg-orange-500 hover:bg-orange-600 disabled:bg-gray-700 disabled:text-gray-400 disabled:cursor-not-allowed text-black font-bold py-3 px-6 rounded-lg transition-all duration-300 flex items-center justify-center gap-2"
            >
              {loading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <>
                  <MapPin size={20} />
                  <span>Track Parcel</span>
                </>
              )}
            </button>

            {showMap && (
              <div className="mt-6">
                <h4 className="text-white font-medium mb-4 flex items-center">
                  <MapPin className="w-5 h-5 mr-2 text-orange-500" />
                  Parcel Location
                </h4>
                <Suspense
                  fallback={
                    <div className="h-64 bg-gray-700 rounded-lg flex items-center justify-center text-gray-400">
                      <div className="text-center">
                        <Loader2 className="w-8 h-8 animate-spin text-orange-500 mb-2" />
                        Loading map...
                      </div>
                    </div>
                  }
                >
                  <MapComponent center={mapCoords} zoom={12} marker={mapCoords} />
                </Suspense>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}