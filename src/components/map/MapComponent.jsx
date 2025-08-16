"use client";

import { useState, useEffect } from "react";
import { MapPin, Navigation } from "lucide-react";

export default function MapComponent({ onLocationSelect }) {
  const [pickupMarker, setPickupMarker] = useState(null);
  const [destinationMarker, setDestinationMarker] = useState(null);
  const [activeMarker, setActiveMarker] = useState("pickup");
  const [userLocation, setUserLocation] = useState(null);

  // Get user's current location
  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setUserLocation({
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          });
        },
        (error) => {
          console.log("Geolocation error:", error);
          // Default to Halifax coordinates
          setUserLocation({ lat: 44.6488, lng: -63.5752 });
        },
      );
    } else {
      // Default to Halifax coordinates
      setUserLocation({ lat: 44.6488, lng: -63.5752 });
    }
  }, []);

  const handleMapClick = (event) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;

    // Convert to approximate coordinates (Halifax metro area)
    const coords = {
      lat: 44.7488 - (y / rect.height) * 0.2, // Approximate latitude range
      lng: -63.7752 + (x / rect.width) * 0.4, // Approximate longitude range
    };

    if (activeMarker === "pickup") {
      setPickupMarker({ x, y, coords });
      onLocationSelect(coords, "pickup");
      setActiveMarker("destination");
    } else {
      setDestinationMarker({ x, y, coords });
      onLocationSelect(coords, "destination");
    }
  };

  const clearMarkers = () => {
    setPickupMarker(null);
    setDestinationMarker(null);
    setActiveMarker("pickup");
  };

  return (
    <div className="space-y-4">
      {/* Map Controls */}
      <div className="flex flex-wrap gap-3 justify-between items-center">
        <div className="flex gap-3">
          <button
            onClick={() => setActiveMarker("pickup")}
            className={`px-4 py-2 rounded-lg font-medium transition-all ${
              activeMarker === "pickup"
                ? "bg-orange-500 text-black shadow-lg"
                : "bg-gray-700 text-gray-300 hover:bg-gray-600"
            }`}
          >
            📍 Set Pickup
          </button>
          <button
            onClick={() => setActiveMarker("destination")}
            className={`px-4 py-2 rounded-lg font-medium transition-all ${
              activeMarker === "destination"
                ? "bg-orange-500 text-black shadow-lg"
                : "bg-gray-700 text-gray-300 hover:bg-gray-600"
            }`}
          >
            🎯 Set Destination
          </button>
        </div>
        <button
          onClick={clearMarkers}
          className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium transition-colors"
        >
          Clear All
        </button>
      </div>

      {/* Interactive Map */}
      <div
        className="relative w-full h-80 bg-gradient-to-br from-gray-700 to-gray-800 rounded-xl cursor-crosshair border-2 border-gray-600 overflow-hidden shadow-inner"
        onClick={handleMapClick}
      >
        {/* Map Grid Background */}
        <div className="absolute inset-0 opacity-10">
          <div className="grid grid-cols-12 grid-rows-12 h-full">
            {Array.from({ length: 144 }).map((_, i) => (
              <div key={i} className="border border-gray-500"></div>
            ))}
          </div>
        </div>

        {/* Map Labels */}
        <div className="absolute top-4 left-4 bg-black/80 px-3 py-2 rounded-lg">
          <div className="flex items-center space-x-2">
            <Navigation className="w-4 h-4 text-orange-500" />
            <span className="text-white text-sm font-medium">
              Halifax Metro Area
            </span>
          </div>
        </div>

        {/* User Location Indicator */}
        {userLocation && (
          <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2">
            <div className="w-3 h-3 bg-blue-500 rounded-full animate-pulse"></div>
            <div className="absolute -bottom-6 left-1/2 transform -translate-x-1/2 bg-blue-500 text-white text-xs px-2 py-1 rounded whitespace-nowrap">
              Your Location
            </div>
          </div>
        )}

        {/* Pickup Marker */}
        {pickupMarker && (
          <div
            className="absolute transform -translate-x-1/2 -translate-y-full z-10"
            style={{ left: pickupMarker.x, top: pickupMarker.y }}
          >
            <div className="relative">
              <MapPin className="w-8 h-8 text-green-500 drop-shadow-lg" />
              <div className="absolute -bottom-8 left-1/2 transform -translate-x-1/2 bg-green-500 text-black text-xs px-2 py-1 rounded font-medium whitespace-nowrap shadow-lg">
                📦 Pickup
              </div>
            </div>
          </div>
        )}

        {/* Destination Marker */}
        {destinationMarker && (
          <div
            className="absolute transform -translate-x-1/2 -translate-y-full z-10"
            style={{ left: destinationMarker.x, top: destinationMarker.y }}
          >
            <div className="relative">
              <MapPin className="w-8 h-8 text-red-500 drop-shadow-lg" />
              <div className="absolute -bottom-8 left-1/2 transform -translate-x-1/2 bg-red-500 text-white text-xs px-2 py-1 rounded font-medium whitespace-nowrap shadow-lg">
                🎯 Destination
              </div>
            </div>
          </div>
        )}

        {/* Connection Line */}
        {pickupMarker && destinationMarker && (
          <svg className="absolute inset-0 w-full h-full pointer-events-none">
            <defs>
              <linearGradient
                id="routeGradient"
                x1="0%"
                y1="0%"
                x2="100%"
                y2="0%"
              >
                <stop offset="0%" stopColor="#10B981" />
                <stop offset="100%" stopColor="#EF4444" />
              </linearGradient>
            </defs>
            <line
              x1={pickupMarker.x}
              y1={pickupMarker.y}
              x2={destinationMarker.x}
              y2={destinationMarker.y}
              stroke="url(#routeGradient)"
              strokeWidth="3"
              strokeDasharray="8,4"
              className="animate-pulse"
            />
            {/* Distance indicator */}
            <text
              x={(pickupMarker.x + destinationMarker.x) / 2}
              y={(pickupMarker.y + destinationMarker.y) / 2 - 10}
              fill="#F28C38"
              fontSize="12"
              fontWeight="bold"
              textAnchor="middle"
              className="drop-shadow-lg"
            >
              ~
              {Math.round(
                Math.sqrt(
                  Math.pow(destinationMarker.x - pickupMarker.x, 2) +
                    Math.pow(destinationMarker.y - pickupMarker.y, 2),
                ) / 10,
              )}
              km
            </text>
          </svg>
        )}

        {/* Instructions */}
        <div className="absolute bottom-4 left-4 right-4 bg-black/80 px-4 py-3 rounded-lg">
          <div className="flex items-center justify-between">
            <div className="text-white text-sm">
              <span className="font-medium">
                {activeMarker === "pickup"
                  ? "📍 Click to set pickup location"
                  : "🎯 Click to set destination"}
              </span>
            </div>
            <div className="text-orange-500 text-xs">
              {pickupMarker && destinationMarker
                ? "✅ Both locations set"
                : pickupMarker
                  ? "✅ Pickup set"
                  : "⏳ No locations set"}
            </div>
          </div>
        </div>
      </div>

      {/* Selected Locations Display */}
      {(pickupMarker || destinationMarker) && (
        <div className="bg-gray-800 p-4 rounded-lg border border-gray-700">
          <h5 className="text-white font-medium mb-2">Selected Locations:</h5>
          <div className="space-y-2 text-sm">
            {pickupMarker && (
              <div className="flex items-center space-x-2">
                <span className="text-green-500">📦</span>
                <span className="text-gray-300">
                  Pickup: {pickupMarker.coords.lat.toFixed(4)},{" "}
                  {pickupMarker.coords.lng.toFixed(4)}
                </span>
              </div>
            )}
            {destinationMarker && (
              <div className="flex items-center space-x-2">
                <span className="text-red-500">🎯</span>
                <span className="text-gray-300">
                  Destination: {destinationMarker.coords.lat.toFixed(4)},{" "}
                  {destinationMarker.coords.lng.toFixed(4)}
                </span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
