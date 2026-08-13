"use client";

import { useState, useEffect, useRef } from "react";
import {
  AlertCircle,
  Wifi,
  WifiOff,
  ChevronDown,
  Gauge,
  Clock,
} from "lucide-react";
import driverApi from "../../api/driver-api";
import { useCallback } from "react";
import { trackingWsUrl } from "../../utils/wsUrl";

const VEHICLE_ICONS = {
  bike: "🏍️",
  car: "🚗",
  van: "🚐",
  truck: "🚚",
};

const VEHICLE_COLORS = {
  bike: "#FF6B6B",
  car: "#4ECDC4",
  van: "#45B7D1",
  truck: "#FFA07A",
};

export default function AdminLiveTrackingDashboard() {
  const [drivers, setDrivers] = useState([]);
  const [selectedDriver, setSelectedDriver] = useState(null);
  const [selectedDriverRoute, setSelectedDriverRoute] = useState(null);
  const [loading, setLoading] = useState(true);
  const [wsConnected, setWsConnected] = useState(false);
  const [filterHub, setFilterHub] = useState("all");
  const [filterAvailableOnly, setFilterAvailableOnly] = useState(false);
  const [hubs, setHubs] = useState([]);
  const [error, setError] = useState(null);
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const directionsServiceRef = useRef(null);
  const directionsRendererRef = useRef(null);
  const markersRef = useRef({}); // Driver markers
  const routeMarkersRef = useRef([]); // Stop markers
  const polylineRef = useRef(null);
  const wsRef = useRef(null);
  const wsReconnectTimeoutRef = useRef(null);
  const [googleLoaded, setGoogleLoaded] = useState(!!window.google);

  const formatAddress = (addr) => {
    if (!addr) return null;
    const parts = [
      addr.line1,
      addr.line2,
      addr.city,
      addr.region,
      addr.postal_code,
      addr.country,
    ].filter(Boolean); // Remove empty parts
    return parts.join(", ") || "Unknown Address";
  };

  // Load Google Maps script if not already loaded
  useEffect(() => {
    const scriptId = "google-maps-script"; // Unique ID to check existence
    if (document.getElementById(scriptId) || window.google?.maps) {
      console.log("[AdminDashboard] Google Maps script already present");
      setGoogleLoaded(true);
      return;
    }

    const googleApiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
    if (!googleApiKey) {
      setError("Google Maps API key missing");
      return;
    }

    const script = document.createElement("script");
    script.id = scriptId;
    script.src = `https://maps.googleapis.com/maps/api/js?key=${googleApiKey}&libraries=places,directions`;
    script.async = true;
    script.defer = true;
    script.onload = () => {
      console.log("[AdminDashboard] Google Maps loaded");
      setGoogleLoaded(true);
    };
    script.onerror = () => setError("Failed to load Google Maps script");
    document.head.appendChild(script);

    return () => {
      // Optional cleanup: Remove script on unmount (rarely needed)
      script.remove();
    };
  }, []);

  // Initialize map and fetch initial data
  useEffect(() => {
    // Use setTimeout to ensure DOM and Google Maps are ready
    const initTimer = setTimeout(() => {
      if (googleLoaded && mapRef.current) {
        initializeMap();
      } else {
        console.log(
          "[AdminDashboard] Waiting for Google Maps or DOM ref, retrying...",
        );
        const retryTimer = setTimeout(() => {
          initializeMap();
        }, 500);
        return () => clearTimeout(retryTimer);
      }
    }, 200);

    fetchInitialLocations();
    connectWebSocket();

    return () => {
      clearTimeout(initTimer);
      disconnectWebSocket();
    };
  }, [googleLoaded]);

  // Refetch when filters change
  useEffect(() => {
    fetchInitialLocations();
  }, [filterHub, filterAvailableOnly]);

  const initializeMap = useCallback(() => {
    if (!window.google?.maps || !mapRef.current) {
      console.warn("[AdminDashboard] Google Maps not ready yet – will retry");
      return false; // Signal retry needed
    }
    try {
      const map = new window.google.maps.Map(mapRef.current, {
        zoom: 15,
        center: { lat: 51.5074, lng: -0.1278 }, // Default to London
        mapTypeId: "roadmap",
        styles: [{ featureType: "poi", stylers: [{ visibility: "off" }] }], // Hide POIs for clean tracking
      });
      mapInstanceRef.current = map;
      directionsServiceRef.current = new window.google.maps.DirectionsService();
      directionsRendererRef.current = new window.google.maps.DirectionsRenderer(
        { map,
          suppressMarkers: true, // Don't show default A/B markers; use custom ones
        },
      );
      console.log("[AdminDashboard] Map initialized successfully");
      return true; // Success
    } catch (err) {
      console.error("[AdminDashboard] Map init error:", err);
      setError("Map initialization failed");
      return false;
    }
  }, []);

  useEffect(() => {
    if (!googleLoaded) return;

    let retries = 0;
    const maxRetries = 5;
    const pollMapReady = () => {
      if (initializeMap()) return; // Success – stop
      if (retries >= maxRetries) {
        setError("Google Maps failed to load after retries");
        return;
      }
      retries++;
      setTimeout(pollMapReady, 300 * retries); // Exponential backoff: 300ms, 600ms, etc.
    };

    setTimeout(pollMapReady, 100); // Initial delay
  }, [googleLoaded, initializeMap]);

  const fetchInitialLocations = async () => {
    try {
      setLoading(true);
      const filters = {};

      if (filterHub !== "all") filters.hub_id = filterHub;
      if (filterAvailableOnly) filters.only_available = true;

      const result = await driverApi.fetchLiveLocations(filters);

      if (result.success) {
        const driversData = Array.isArray(result.data) ? result.data : [];
        setDrivers(driversData);
        setError(null);

        // Extract unique hubs
        const hubSet = new Set();
        driversData.forEach((driver) => {
          if (driver.hub_name) hubSet.add(driver.hub_name);
        });
        setHubs(Array.from(hubSet).sort());

        // Clear old markers
        Object.values(markersRef.current).forEach((marker) =>
          marker.setMap(null),
        );
        markersRef.current = {};

        // Add new markers
        driversData.forEach((driver) => {
          addDriverMarker(driver);
        });

        // Center map on first driver if available
        if (driversData.length > 0) {
          const firstDriver = driversData[0];
          mapInstanceRef.current?.setCenter({
            lat: Number.parseFloat(firstDriver.latitude),
            lng: Number.parseFloat(firstDriver.longitude),
          });
        }
      } else {
        setError(result.error || "Failed to fetch locations");
      }
    } catch (error) {
      console.error("[AdminDashboard] Fetch locations error:", error);
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  const addDriverMarker = (driver) => {
    if (!mapInstanceRef.current || !window.google) return;

    const key = driver.driver_profile || driver.id;
    const existing = markersRef.current[key];
    if (existing) existing.setMap(null);

    const position = {
      lat: Number.parseFloat(driver.latitude),
      lng: Number.parseFloat(driver.longitude),
    };

    const marker = new window.google.maps.Marker({
      position,
      map: mapInstanceRef.current,
      title: driver.driver_name,
      icon: {
        path: window.google.maps.SymbolPath.CIRCLE,
        scale: 10,
        fillColor: VEHICLE_COLORS[driver.vehicle_type] || "#4ECDC4",
        fillOpacity: 1,
        strokeColor: "#ffffff",
        strokeWeight: 2,
      },
      label: {
        text: VEHICLE_ICONS[driver.vehicle_type] || "📍",
        fontSize: "18px",
      },
    });

    const infoWindow = new window.google.maps.InfoWindow({
      content: `
        <div class="p-2 text-sm">
          <p class="font-semibold">${driver.driver_name}</p>
          <p class="text-xs text-muted-foreground">${driver.vehicle_type}</p>
          <p class="text-xs text-muted-foreground">${driver.hub_name || "Unknown Hub"}</p>
          ${driver.speed_kmh ? `<p class="text-xs">Speed: ${driver.speed_kmh} km/h</p>` : ""}
        </div>
      `,
    });

    marker.addListener("click", () => {
      infoWindow.open(mapInstanceRef.current, marker);
      selectDriver(driver);
    });

    markersRef.current[key] = marker;
  };

  const selectDriver = async (driver) => {
    setSelectedDriver(driver);
    try {
      const response = await driverApi.request(
        `/api/driver/live-tracking/current-route/?driver_id=${driver.driver_profile}`,
        { method: "GET" },
      );
      const { route, bookings } = response.data;
      console.log(
        "[AdminDashboard] Fetched route for driver:",
        route,
        bookings,
      );
      setSelectedDriverRoute(route ? { ...route, bookings } : { bookings });
      drawStopsOnMap(route, bookings);
    } catch (err) {
      setSelectedDriverRoute(null);
      setError(
        err.response?.status === 404
          ? "No active assignments"
          : "Failed to fetch assignments",
      );
    }
    if (mapInstanceRef.current) {
      mapInstanceRef.current.setCenter({
        lat: parseFloat(driver.latitude),
        lng: parseFloat(driver.longitude),
      });
      mapInstanceRef.current.setZoom(15);
    }
  };

  const drawStopsOnMap = (route, bookings) => {
    if (directionsRendererRef.current)
      directionsRendererRef.current.setDirections({ routes: [] });
    routeMarkersRef.current.forEach((marker) => marker.setMap(null));
    routeMarkersRef.current = [];

    if (bookings.length === 0) return;

    // Always draw markers for bookings/stops
    bookings.forEach((b, i) => {
      const position = {
        lat: parseFloat(b.pickup_address?.latitude || 0),
        lng: parseFloat(b.pickup_address?.longitude || 0),
      }; // Use coords from booking/address

      const labelText = route ? `${i + 1}` : `B${i + 1}`; // Number for route, B for direct
      const marker = new window.google.maps.Marker({
        position,
        map: mapInstanceRef.current,
        label: { text: labelText, color: "white", fontWeight: "bold" },
        title:
          formatAddress(b.pickup_address) ||
          (route ? `Stop ${i + 1}` : `Booking ${i + 1}`),
        icon: route
          ? undefined
          : { url: "http://maps.google.com/mapfiles/ms/icons/blue-dot.png" }, // Different icon for direct
      });
      routeMarkersRef.current.push(marker);
    });

    if (bookings.length < 2) return; // No path for single
      

    if (route) {
      // Optimized Directions for route
      const waypoints = bookings.slice(1, -1).map((b) => ({
        location: {
          lat: parseFloat(b.pickup_address?.latitude || 0),
          lng: parseFloat(b.pickup_address?.longitude || 0),
        },
        stopover: true,
      }));

      directionsServiceRef.current.route(
        {
          origin: {
            lat: parseFloat(bookings[0].pickup_address?.latitude || 0),
            lng: parseFloat(bookings[0].pickup_address?.longitude || 0),
          },
          destination: {
            lat: parseFloat(
              bookings[bookings.length - 1].dropoff_address?.latitude || 0,
            ),
            lng: parseFloat(
              bookings[bookings.length - 1].dropoff_address?.longitude || 0,
            ),
          },
          waypoints,
          travelMode: "DRIVING",
          optimizeWaypoint: true,
        },
        (result, status) => {
          if (status === "OK")
            directionsRendererRef.current.setDirections(result);
          else setError("Failed to calculate route path");
        },
      );
    } else {
      // Simple straight-line Polyline for direct bookings (no optimization)
      const path = bookings.map((b) => ({
        lat: parseFloat(b.pickup_address?.latitude || 0),
        lng: parseFloat(b.pickup_address?.longitude || 0),
      }));
      new window.google.maps.Polyline({
        path,
        geodesic: true,
        strokeColor: "#FF0000",
        strokeOpacity: 1.0,
        strokeWeight: 2,
        map: mapInstanceRef.current,
      });
    }

    // Center on first booking/marker
    if (bookings.length > 0 && mapInstanceRef.current) {
      mapInstanceRef.current.setCenter({
        lat: parseFloat(bookings[0].pickup_lat),
        lng: parseFloat(bookings[0].pickup_lng),
      });
    }
  };

  const connectWebSocket = () => {
    try {
      const token = localStorage.getItem("access_token");
      if (!token) {
        console.warn("[AdminDashboard] No auth token found");
        setError("Authentication required for live updates");
        return;
      }

      // Derive the tracking WS URL from the backend env (http→ws, https→wss). Never a
      // hardcoded localhost. See src/utils/wsUrl.js (unit-tested) — replaces the old
      // `ws://127.0.0.1:8000/ws/tracking/` literal that broke prod.
      const wsUrl = trackingWsUrl(import.meta.env.VITE_NEXT_PUBLIC_BACKEND_URL);

      console.log("[AdminDashboard] Connecting to WebSocket:", wsUrl);
      wsRef.current = new WebSocket(`${wsUrl}?token=${token}`);

      wsRef.current.onopen = () => {
        console.log("[AdminDashboard] WebSocket connected");
        setWsConnected(true);
        setError(null);
      };

      wsRef.current.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          handleLocationUpdate(data);
        } catch (error) {
          console.error("[AdminDashboard] WS message parse error:", error);
        }
      };

      wsRef.current.onerror = (error) => {
        console.error("[AdminDashboard] WebSocket error:", error);
        setWsConnected(false);
      };

      wsRef.current.onclose = () => {
        console.log("[AdminDashboard] WebSocket disconnected");
        setWsConnected(false);
        attemptReconnect();
      };
    } catch (error) {
      console.error("[AdminDashboard] WebSocket setup error:", error);
      setError("Failed to connect to live updates");
      attemptReconnect();
    }
  };

  const attemptReconnect = () => {
    if (wsReconnectTimeoutRef.current) {
      clearTimeout(wsReconnectTimeoutRef.current);
    }
    wsReconnectTimeoutRef.current = setTimeout(() => {
      console.log("[AdminDashboard] Attempting WebSocket reconnect...");
      connectWebSocket();
    }, 5000); // Retry every 5 seconds
  };

  const disconnectWebSocket = () => {
    if (wsReconnectTimeoutRef.current) {
      clearTimeout(wsReconnectTimeoutRef.current);
      wsReconnectTimeoutRef.current = null;
    }

    if (
      wsRef.current &&
      (wsRef.current.readyState === WebSocket.OPEN ||
        wsRef.current.readyState === WebSocket.CONNECTING)
    ) {
      try {
        wsRef.current.close();
      } catch (err) {
        console.warn("[AdminDashboard] Error closing WebSocket:", err);
      }
      wsRef.current = null;
    }
    setWsConnected(false);
  };

  const handleLocationUpdate = (locationData) => {
    // Update driver in state
    setDrivers((prevDrivers) => {
      const existingIndex = prevDrivers.findIndex(
        (d) => d.driver_profile === locationData.driver_profile,
      );

      let updatedDrivers;
      if (existingIndex >= 0) {
        updatedDrivers = [...prevDrivers];
        updatedDrivers[existingIndex] = locationData;
      } else {
        updatedDrivers = [...prevDrivers, locationData];
      }

      // Update marker
      addDriverMarker(locationData);

      // Update selected driver if it matches
      if (selectedDriver?.driver_profile === locationData.driver_profile) {
        setSelectedDriver(locationData);
      }

      return updatedDrivers;
    });
  };

  const filteredDrivers = drivers.filter((driver) => {
    if (filterHub !== "all" && driver.hub_name !== filterHub) return false;
    if (filterAvailableOnly && driver.status !== "available") return false;
    return true;
  });

  return (
    <div className="flex flex-col lg:flex-row h-screen bg-background gap-4 p-4">
      {/* Sidebar - Driver List */}
      <div className="lg:w-80 bg-card border border-border rounded-lg shadow-sm flex flex-col">
        <div className="p-4 border-b border-border">
          <h2 className="text-lg font-bold text-foreground mb-4">
            Live Drivers
          </h2>

          {/* Filters */}
          <div className="space-y-3">
            {/* Hub Filter */}
            <div>
              <label className="text-sm font-medium text-foreground block mb-1">
                Hub
              </label>
              <div className="relative">
                <select
                  value={filterHub}
                  onChange={(e) => setFilterHub(e.target.value)}
                  className="w-full px-3 py-2 bg-muted border border-border rounded-lg text-sm appearance-none cursor-pointer text-foreground"
                >
                  <option value="all">All Hubs</option>
                  {hubs.map((hub) => (
                    <option key={hub} value={hub}>
                      {hub}
                    </option>
                  ))}
                </select>
                <ChevronDown className="absolute right-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
              </div>
            </div>

            {/* Available Only Toggle */}
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={filterAvailableOnly}
                onChange={(e) => setFilterAvailableOnly(e.target.checked)}
                className="w-4 h-4 rounded border-border"
              />
              <span className="text-sm font-medium text-foreground">
                Available Only
              </span>
            </label>
          </div>

          {/* Status */}
          <div className="flex items-center gap-2 mt-4 p-2 bg-muted rounded-lg">
            {wsConnected ? (
              <>
                <Wifi className="w-4 h-4 text-success" />
                <span className="text-xs text-success font-medium">
                  Connected
                </span>
              </>
            ) : (
              <>
                <WifiOff className="w-4 h-4 text-destructive" />
                <span className="text-xs text-destructive font-medium">
                  Disconnected
                </span>
              </>
            )}
            <span className="text-xs text-muted-foreground ml-auto">
              {filteredDrivers.length} driver
              {filteredDrivers.length !== 1 ? "s" : ""}
            </span>
          </div>
        </div>

        {/* Driver List */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="p-4 text-center text-muted-foreground text-sm">
              Loading drivers...
            </div>
          ) : error ? (
            <div className="p-4 bg-destructive/10 border-t border-destructive/20 text-destructive text-sm flex gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          ) : filteredDrivers.length === 0 ? (
            <div className="p-4 text-center text-muted-foreground text-sm">
              No drivers found
            </div>
          ) : (
            <div className="space-y-2 p-2">
              {filteredDrivers.map((driver) => (
                <button
                  key={driver.driver_profile}
                  onClick={() => selectDriver(driver)}
                  className={`w-full text-left p-3 rounded-lg transition-colors ${
                    selectedDriver?.driver_profile === driver.driver_profile
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted hover:bg-muted/80"
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <span className="text-xl mt-0.5">
                      {VEHICLE_ICONS[driver.vehicle_type] || "📍"}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm truncate">
                        {driver.driver_name}
                      </p>
                      <p className="text-xs opacity-75 truncate">
                        {driver.vehicle_type} • {driver.hub_name || "—"}
                      </p>
                      {driver.speed_kmh && (
                        <p className="text-xs opacity-75 mt-1">
                          ⚡ {driver.speed_kmh} km/h
                        </p>
                      )}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Main Map Area */}
      <div className="flex-1 flex flex-col gap-4">
        {/* Map */}
        <div className="flex-1 bg-card border border-border rounded-lg shadow-sm overflow-hidden">
          <div
            ref={mapRef}
            className="w-full h-full"
            style={{ backgroundColor: "#f0f0f0" }}
          />
        </div>

        {/* Selected Driver Details */}
        {selectedDriver && (
          <div className="space-y-4">
            {/* Driver Info Card */}
            <div className="bg-card border border-border rounded-lg p-4 shadow-sm">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Driver</p>
                  <p className="font-semibold text-foreground truncate">
                    {selectedDriver.driver_name}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Vehicle</p>
                  <p className="font-semibold text-foreground capitalize">
                    {selectedDriver.vehicle_type}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
                    <Gauge className="w-3 h-3" />
                    Speed
                  </p>
                  <p className="font-semibold text-foreground">
                    {selectedDriver.speed_kmh
                      ? `${selectedDriver.speed_kmh} km/h`
                      : "—"}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    Updated
                  </p>
                  <p className="font-semibold text-foreground text-sm">
                    {selectedDriver.timestamp
                      ? new Date(selectedDriver.timestamp).toLocaleTimeString()
                      : "—"}
                  </p>
                </div>
              </div>
            </div>

            {/* Route Stops Card */}
            {selectedDriverRoute &&
              selectedDriverRoute.bookings &&
              selectedDriverRoute.bookings.length > 0 && (
                <div className="bg-card border border-border rounded-lg p-4 shadow-sm">
                  <h3 className="font-semibold text-foreground mb-3">
                    Route Stops ({selectedDriverRoute.bookings.length})
                  </h3>
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {selectedDriverRoute.bookings.map((booking, index) => (
                      <div
                        key={index}
                        className="p-2 bg-muted rounded-lg text-sm"
                      >
                        <div className="flex items-start gap-2">
                          <span
                            className="flex items-center justify-center w-6 h-6 rounded-full text-foreground text-xs font-bold flex-shrink-0"
                            style={{
                              backgroundColor: VEHICLE_COLORS["bike"],
                            }}
                          >
                            {index + 1}
                          </span>
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-foreground truncate">
                              {formatAddress(booking.pickup_address) ||
                                "Pickup"}
                            </p>
                            {booking.package_description && (
                              <p className="text-xs text-muted-foreground truncate">
                                {booking.package_description}
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
          </div>
        )}
      </div>
    </div>
  );
}
