"use client";

import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import {
  AlertCircle,
  Wifi,
  WifiOff,
  ChevronDown,
  Gauge,
  Clock,
  X,
} from "lucide-react";
import driverApi from "../../api/driver-api";
import { trackingWsUrl } from "../../utils/wsUrl";
import AdminLiveMap from "./admin-live-map";
import { buildAdminRoutePoints, classifyStopStatus } from "../../lib/admin-route-points";
import { vehicleIcon, vehicleColor } from "../../lib/vehicle-icons";

export default function AdminLiveTrackingDashboard() {
  const [drivers, setDrivers] = useState([]);
  const [selectedDriver, setSelectedDriver] = useState(null);
  const [selectedDriverRoute, setSelectedDriverRoute] = useState(null);
  const [routeLoading, setRouteLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [wsConnected, setWsConnected] = useState(false);
  const [filterHub, setFilterHub] = useState("all");
  const [filterAvailableOnly, setFilterAvailableOnly] = useState(false);
  const [hubs, setHubs] = useState([]);
  const [error, setError] = useState(null);
  const wsRef = useRef(null);
  const wsReconnectTimeoutRef = useRef(null);

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

  // Initial fetch + live-updates socket. The map itself (AdminLiveMap) needs
  // no imperative setup here — it's a normal React component driven by
  // `drivers` / `selectedDriver` / `points` props, same as the driver Live
  // Map (route-overview-map.jsx). No Google Maps script to load, no manual
  // marker/polyline lifecycle to manage.
  useEffect(() => {
    fetchInitialLocations();
    connectWebSocket();

    return () => {
      disconnectWebSocket();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Refetch when filters change
  useEffect(() => {
    fetchInitialLocations();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterHub, filterAvailableOnly]);

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

  const selectDriver = useCallback(async (driver) => {
    setSelectedDriver(driver);
    setSelectedDriverRoute(null);
    setRouteLoading(true);
    try {
      // Goes through the shared driverApi wrapper (caching + offline
      // fallback) rather than a raw request call — `driver_id` is the admin
      // case it's explicitly built for (see driver-api.js getCurrentRoute).
      const result = await driverApi.getCurrentRoute(driver.driver_profile);
      if (result.success && result.data) {
        const { route, bookings } = result.data;
        console.log("[AdminDashboard] Fetched route for driver:", route, bookings);
        setSelectedDriverRoute(route ? { ...route, bookings } : { bookings });
        setError(null);
      } else if (result.success) {
        // No active route/bookings (backend 404 → success:true, data:null)
        setSelectedDriverRoute({ bookings: [] });
        setError(null);
      } else {
        setSelectedDriverRoute(null);
        setError(result.error || "Failed to fetch assignments");
      }
    } catch (err) {
      setSelectedDriverRoute(null);
      setError(
        err.response?.status === 404
          ? "No active assignments"
          : "Failed to fetch assignments",
      );
    } finally {
      setRouteLoading(false);
    }
  }, []);

  const clearSelectedDriver = useCallback(() => {
    setSelectedDriver(null);
    setSelectedDriverRoute(null);
  }, []);

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
    // Update driver in state. The map re-renders from this state directly
    // (AdminLiveMap is a plain React component) — no imperative marker
    // update to do here any more.
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

      return updatedDrivers;
    });

    // Keep the focused driver's own position current too.
    setSelectedDriver((prev) =>
      prev?.driver_profile === locationData.driver_profile ? locationData : prev,
    );
  };

  const filteredDrivers = drivers.filter((driver) => {
    if (filterHub !== "all" && driver.hub_name !== filterHub) return false;
    if (filterAvailableOnly && driver.status !== "available") return false;
    return true;
  });

  // Driver-scoped stop points for the map — every stop the selected driver
  // has (completed AND remaining), colour-coded. Built fresh whenever the
  // route data changes; never falls back to any other driver's stops.
  const routePoints = useMemo(
    () => buildAdminRoutePoints(selectedDriverRoute?.bookings || []),
    [selectedDriverRoute],
  );

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
                      {vehicleIcon(driver.vehicle_type)}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm truncate">
                        {driver.driver_name}
                      </p>
                      <p className="text-xs opacity-75 truncate">
                        {driver.vehicle_type} • {driver.hub_name || "—"}
                      </p>
                      <div className="flex items-center gap-2 mt-1">
                        {driver.speed_kmh ? (
                          <p className="text-xs opacity-75">
                            ⚡ {driver.speed_kmh} km/h
                          </p>
                        ) : null}
                        {driver.location_stale && (
                          <span className="text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded bg-warning/20 text-warning-foreground opacity-90">
                            Stale
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Main Map Area */}
      <div className="flex-1 flex flex-col gap-4 min-h-0">
        {/* Map — same Leaflet/OSM technique as the driver Live Map
            (route-overview-map.jsx). Shows every driver when nothing is
            selected; shows ONLY the selected driver's position and ONLY
            their stops (colour-coded, grouped, with a Google Maps deep
            link) once one is picked. */}
        <div className="flex-1 min-h-0">
          <AdminLiveMap
            drivers={filteredDrivers}
            selectedDriver={selectedDriver}
            points={routePoints}
            onSelectDriver={selectDriver}
            height="100%"
          />
        </div>

        {/* Selected Driver Details */}
        {selectedDriver && (
          <div className="space-y-4">
            {/* Driver Info Card */}
            <div className="bg-card border border-border rounded-lg p-4 shadow-sm">
              <div className="flex items-start justify-between gap-4">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 flex-1">
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
                      {selectedDriver.location_stale && (
                        <span className="ml-2 text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded bg-warning/20 text-warning-foreground">
                          Stale
                        </span>
                      )}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={clearSelectedDriver}
                  aria-label="Clear selected driver"
                  className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground px-2 py-1 rounded-lg hover:bg-muted flex-shrink-0"
                >
                  <X className="w-3.5 h-3.5" />
                  Back to all drivers
                </button>
              </div>
            </div>

            {/* Route Stops Card */}
            {routeLoading ? (
              <div className="bg-card border border-border rounded-lg p-4 shadow-sm text-sm text-muted-foreground">
                Loading route…
              </div>
            ) : (
              selectedDriverRoute &&
              selectedDriverRoute.bookings &&
              selectedDriverRoute.bookings.length > 0 && (
                <div className="bg-card border border-border rounded-lg p-4 shadow-sm">
                  <h3 className="font-semibold text-foreground mb-3">
                    Route Stops ({selectedDriverRoute.bookings.length})
                  </h3>
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {selectedDriverRoute.bookings.map((booking, index) => {
                      const statusGroup = classifyStopStatus(
                        booking.stop_status ?? booking.status,
                      );
                      const address = booking.stop_address || booking.pickup_address;
                      return (
                        <div
                          key={booking.stop_id || booking.id || index}
                          className="p-2 bg-muted rounded-lg text-sm"
                        >
                          <div className="flex items-start gap-2">
                            <span
                              className="flex items-center justify-center w-6 h-6 rounded-full text-white text-xs font-bold flex-shrink-0"
                              style={{
                                backgroundColor:
                                  statusGroup === "completed" ? "#16a34a" : "#dc2626",
                              }}
                            >
                              {booking.job_number ?? index + 1}
                            </span>
                            <div className="flex-1 min-w-0">
                              <p className="font-medium text-foreground truncate">
                                {formatAddress(address) || "Address"}
                              </p>
                              <p className="text-xs text-muted-foreground truncate">
                                {booking.leg ? `${booking.leg} · ` : ""}
                                {booking.stop_status || booking.status || "—"}
                              </p>
                              {booking.package_description && (
                                <p className="text-xs text-muted-foreground truncate">
                                  {booking.package_description}
                                </p>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )
            )}
          </div>
        )}
      </div>
    </div>
  );
}