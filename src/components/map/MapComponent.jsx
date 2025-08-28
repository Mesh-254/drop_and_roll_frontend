"use client";

// MapComponent.jsx - Interactive map component using Leaflet
import React, { useEffect, useRef, useState, useCallback } from "react";
import { MapPin, Loader2, AlertCircle } from "lucide-react";

// Leaflet imports (assuming Leaflet is available)
let L;
if (typeof window !== "undefined") {
  try {
    L = require("leaflet");
    require("leaflet/dist/leaflet.css");

    // Fix for default markers in Leaflet
    delete L.Icon.Default.prototype._getIconUrl;
    L.Icon.Default.mergeOptions({
      iconRetinaUrl:
        "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png",
      iconUrl:
        "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png",
      shadowUrl:
        "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png",
    });
  } catch (error) {
    console.warn("Leaflet not available, using fallback map component");
  }
}

const MapComponent = React.memo(
  ({
    pickupAddress,
    dropoffAddress,
    isLoading = false,
    error = null,
    className = "w-full h-64 rounded-lg border border-gray-300 dark:border-gray-600",
  }) => {
    const mapRef = useRef(null);
    const mapInstanceRef = useRef(null);
    const markersRef = useRef([]);
    const routeRef = useRef(null);
    const [mapError, setMapError] = useState(null);
    const [isMapLoading, setIsMapLoading] = useState(true);

    // Geocoding function to get coordinates from address
    const geocodeAddress = useCallback(async (address) => {
      if (!address) return null;

      try {
        // Simple geocoding using Nominatim (OpenStreetMap)
        const response = await fetch(
          `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
            address,
          )}&limit=1`,
        );
        const data = await response.json();

        if (data && data.length > 0) {
          return {
            lat: Number.parseFloat(data[0].lat),
            lng: Number.parseFloat(data[0].lon),
          };
        }
        return null;
      } catch (error) {
        console.error("Geocoding failed:", error);
        return null;
      }
    }, []);

    // Initialize map
    useEffect(() => {
      if (!mapRef.current || !L) {
        setMapError("Map library not available");
        setIsMapLoading(false);
        return;
      }

      try {
        // Initialize map centered on UK
        mapInstanceRef.current = L.map(mapRef.current).setView(
          [52.3555, -1.1743],
          6,
        );

        // Add OpenStreetMap tiles
        L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
          attribution: "© OpenStreetMap contributors",
        }).addTo(mapInstanceRef.current);

        setIsMapLoading(false);
      } catch (error) {
        console.error("Map initialization failed:", error);
        setMapError("Failed to initialize map");
        setIsMapLoading(false);
      }

      // Cleanup function
      return () => {
        if (mapInstanceRef.current) {
          mapInstanceRef.current.remove();
          mapInstanceRef.current = null;
        }
      };
    }, []);

    // Update markers when addresses change
    useEffect(() => {
      if (!mapInstanceRef.current || !L) return;

      const updateMarkers = async () => {
        // Clear existing markers and route
        markersRef.current.forEach((marker) => {
          mapInstanceRef.current.removeLayer(marker);
        });
        markersRef.current = [];

        if (routeRef.current) {
          mapInstanceRef.current.removeLayer(routeRef.current);
          routeRef.current = null;
        }

        const coordinates = [];

        // Add pickup marker
        if (pickupAddress) {
          const pickupCoords = await geocodeAddress(pickupAddress);
          if (pickupCoords) {
            const pickupMarker = L.marker([pickupCoords.lat, pickupCoords.lng])
              .addTo(mapInstanceRef.current)
              .bindPopup(`<strong>Pickup:</strong><br/>${pickupAddress}`);

            markersRef.current.push(pickupMarker);
            coordinates.push(pickupCoords);
          }
        }

        // Add dropoff marker
        if (dropoffAddress) {
          const dropoffCoords = await geocodeAddress(dropoffAddress);
          if (dropoffCoords) {
            const dropoffMarker = L.marker([
              dropoffCoords.lat,
              dropoffCoords.lng,
            ])
              .addTo(mapInstanceRef.current)
              .bindPopup(`<strong>Dropoff:</strong><br/>${dropoffAddress}`);

            markersRef.current.push(dropoffMarker);
            coordinates.push(dropoffCoords);
          }
        }

        // Draw route line if both coordinates are available
        if (coordinates.length === 2) {
          routeRef.current = L.polyline(coordinates, {
            color: "#f97316",
            weight: 3,
            opacity: 0.7,
          }).addTo(mapInstanceRef.current);

          // Fit map to show both markers
          const group = new L.featureGroup(markersRef.current);
          mapInstanceRef.current.fitBounds(group.getBounds().pad(0.1));
        } else if (coordinates.length === 1) {
          // Center on single marker
          mapInstanceRef.current.setView(
            [coordinates[0].lat, coordinates[0].lng],
            12,
          );
        }
      };

      updateMarkers();
    }, [pickupAddress, dropoffAddress, geocodeAddress]);

    // Fallback component when Leaflet is not available
    if (!L) {
      return (
        <div
          className={`${className} bg-gray-100 dark:bg-gray-800 flex items-center justify-center`}
        >
          <div className="text-center p-6">
            <MapPin className="mx-auto h-12 w-12 text-gray-400 mb-4" />
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
              Map Preview
            </h3>
            <div className="space-y-2 text-sm text-gray-600 dark:text-gray-400">
              {pickupAddress && (
                <div className="flex items-center justify-center">
                  <MapPin className="h-4 w-4 text-green-500 mr-2" />
                  <span>Pickup: {pickupAddress}</span>
                </div>
              )}
              {dropoffAddress && (
                <div className="flex items-center justify-center">
                  <MapPin className="h-4 w-4 text-red-500 mr-2" />
                  <span>Dropoff: {dropoffAddress}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      );
    }

    // Error state
    if (error || mapError) {
      return (
        <div
          className={`${className} bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800 flex items-center justify-center`}
        >
          <div className="text-center p-6">
            <AlertCircle className="mx-auto h-12 w-12 text-red-500 mb-4" />
            <h3 className="text-lg font-medium text-red-900 dark:text-red-100 mb-2">
              Map Error
            </h3>
            <p className="text-sm text-red-600 dark:text-red-300">
              {error || mapError}
            </p>
          </div>
        </div>
      );
    }

    // Loading state
    if (isLoading || isMapLoading) {
      return (
        <div
          className={`${className} bg-gray-100 dark:bg-gray-800 flex items-center justify-center`}
        >
          <div className="text-center p-6">
            <Loader2 className="mx-auto h-12 w-12 text-orange-500 animate-spin mb-4" />
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
              Loading Map...
            </h3>
          </div>
        </div>
      );
    }

    return (
      <div className={className}>
        <div ref={mapRef} className="w-full h-full rounded-lg" />
      </div>
    );
  },
);

MapComponent.displayName = "MapComponent";

export default MapComponent;
