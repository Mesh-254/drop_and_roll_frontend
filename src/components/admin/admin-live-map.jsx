import React, { useEffect, useRef, useState, useCallback, useMemo } from "react";
import "leaflet/dist/leaflet.css";
import { MapContainer, TileLayer, Polyline, Marker, Popup, useMap, useMapEvents } from "react-leaflet";
import L from "leaflet";
import { Plus, Minus, Maximize2, Minimize2, Navigation } from "lucide-react";
import { openDriverRouteDirections } from "../../lib/map-links";
import { groupPointsByLocation } from "../../lib/admin-route-points";
import { vehicleIcon, vehicleColor } from "../../lib/vehicle-icons";

// Same default-icon-path fix as route-overview-map.jsx. Re-running this in a
// second module is harmless (deleting an already-deleted prototype prop is a
// no-op; re-merging the same default options is idempotent) — kept local
// rather than shared so this component has no import-order dependency on
// the driver map ever being loaded first.
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "leaflet/dist/images/marker-icon-2x.png",
  iconUrl: "leaflet/dist/images/marker-icon.png",
  shadowUrl: "leaflet/dist/images/marker-shadow.png",
});

const STOP_COLORS = {
  completed: "#16a34a", // green — already tracked / completed
  remaining: "#dc2626", // red — remaining / pending
  mixed: "#d97706", // amber — a grouped pin with both, until opened
};

// Internal: same fit/resize logic as RouteOverviewMap's MapReady.
function MapReady({ bounds }) {
  const map = useMap();
  const hasFitRef = useRef(false);
  const boundsKeyRef = useRef("");

  useEffect(() => {
    const container = map.getContainer();
    const boundsKey = bounds && bounds.isValid() ? bounds.toBBoxString() : "";

    const settle = () => {
      map.invalidateSize(true);
      // Re-fit whenever the bounds actually change shape (new driver
      // selected, stops loaded) — not just once — but never fight the
      // admin's own zoom/pan on a poll tick that produced the same bounds.
      if (bounds && bounds.isValid() && (!hasFitRef.current || boundsKeyRef.current !== boundsKey)) {
        map.fitBounds(bounds, { padding: [40, 40], animate: hasFitRef.current, maxZoom: 16 });
        hasFitRef.current = true;
        boundsKeyRef.current = boundsKey;
      }
    };

    const raf = requestAnimationFrame(settle);
    const resizeObserver = new ResizeObserver(() => map.invalidateSize(true));
    resizeObserver.observe(container);

    return () => {
      cancelAnimationFrame(raf);
      resizeObserver.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, bounds]);

  return null;
}

function ZoomControls() {
  const map = useMap();
  return (
    <div className="absolute right-3 bottom-3 flex flex-col overflow-hidden rounded-lg border border-border shadow-md" style={{ zIndex: 9999 }}>
      <button
        type="button"
        onClick={() => map.zoomIn()}
        aria-label="Zoom in"
        className="flex h-9 w-9 items-center justify-center bg-white/90 text-foreground hover:bg-white dark:bg-black/80 dark:hover:bg-black touch-action-manipulation border-b border-border"
      >
        <Plus size={16} />
      </button>
      <button
        type="button"
        onClick={() => map.zoomOut()}
        aria-label="Zoom out"
        className="flex h-9 w-9 items-center justify-center bg-white/90 text-foreground hover:bg-white dark:bg-black/80 dark:hover:bg-black touch-action-manipulation"
      >
        <Minus size={16} />
      </button>
    </div>
  );
}

// Click anywhere on the map (that isn't a marker/popup) to open Google Maps
// with the selected driver's current position and remaining/complete stops.
function MapClickHandler({ enabled, driverPosition, points }) {
  useMapEvents({
    click: (e) => {
      if (!enabled) return;
      try {
        const tgt = e.originalEvent?.target;
        const className = tgt?.className || "";
        if (typeof className === "string" && /(leaflet-marker-icon|leaflet-marker-shadow|leaflet-popup|leaflet-popup-content|admin-live-map-marker)/.test(className)) {
          return;
        }
        openDriverRouteDirections(driverPosition, points);
      } catch (err) {
        console.error("Admin map click handler failed:", err);
      }
    },
  });
  return null;
}

function stopDivIcon(color, label, size = 28) {
  return L.divIcon({
    className: "admin-live-map-marker",
    html: `<div style="
        width:${size}px;height:${size}px;border-radius:9999px;
        background:${color};color:#fff;display:flex;align-items:center;
        justify-content:center;font-size:11px;font-weight:700;
        border:2px solid white;box-shadow:0 1px 4px rgba(0,0,0,0.4);
      ">${label}</div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    popupAnchor: [0, -size / 2],
  });
}

function driverDivIcon({ vehicleType, stale, emphasis = false }) {
  const color = vehicleColor(vehicleType);
  const size = emphasis ? 44 : 34;
  const opacity = stale ? 0.55 : 1;
  const ring = stale ? "dashed" : "solid";
  return L.divIcon({
    className: "admin-live-map-marker",
    html: `<div style="
        width:${size}px;height:${size}px;border-radius:9999px;
        background:${color};opacity:${opacity};display:flex;align-items:center;
        justify-content:center;font-size:${emphasis ? 22 : 16}px;
        border:3px ${ring} white;box-shadow:0 2px 6px rgba(0,0,0,0.45);
      ">${vehicleIcon(vehicleType)}</div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    popupAnchor: [0, -size / 2],
  });
}

/**
 * Admin live-tracking map. Two modes, chosen by whether a driver is selected:
 *
 *  - Overview (no `selectedDriver`): a marker per driver in `drivers`,
 *    click to select. No stops are drawn — nothing to scope them to yet.
 *  - Focused (`selectedDriver` set): ONLY that driver's marker and ONLY
 *    that driver's stops (via `points`, from buildAdminRoutePoints) are
 *    drawn — colour-coded green (completed) / red (remaining), grouped
 *    when several stops share one address, connected by the same clean
 *    polyline style as the driver Live Map, with a Google Maps deep link
 *    that starts from the driver's current position.
 */
export default function AdminLiveMap({
  drivers = [],
  selectedDriver = null,
  points = [],
  onSelectDriver = () => {},
  height = 480,
}) {
  const shellRef = useRef(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    const handler = () => setIsFullscreen(document.fullscreenElement === shellRef.current);
    document.addEventListener("fullscreenchange", handler);
    return () => document.removeEventListener("fullscreenchange", handler);
  }, []);

  const toggleFullscreen = useCallback(() => {
    const el = shellRef.current;
    if (!el) return;
    try {
      if (document.fullscreenElement) {
        document.exitFullscreen?.();
      } else {
        el.requestFullscreen?.();
      }
    } catch (err) {
      console.error("Fullscreen toggle failed:", err);
    }
  }, []);

  const focused = !!selectedDriver;

  const driverPosition = useMemo(() => {
    if (!selectedDriver) return null;
    const lat = Number.parseFloat(selectedDriver.latitude);
    const lng = Number.parseFloat(selectedDriver.longitude);
    if (Number.isNaN(lat) || Number.isNaN(lng)) return null;
    return { lat, lng };
  }, [selectedDriver]);

  const groupedStops = useMemo(() => groupPointsByLocation(points), [points]);

  // Ordered stop positions (sequence order) for the polyline + deep link —
  // one entry per GROUP, so a shared-address cluster contributes one waypoint
  // rather than several stacked ones.
  const orderedStopPositions = useMemo(
    () => [...groupedStops].sort((a, b) => a.sequence - b.sequence).map((g) => ({ lat: g.lat, lng: g.lng })),
    [groupedStops],
  );

  const routeLine = useMemo(() => {
    if (!focused) return null;
    const line = [];
    if (driverPosition) line.push([driverPosition.lat, driverPosition.lng]);
    orderedStopPositions.forEach((p) => line.push([p.lat, p.lng]));
    return line.length >= 2 ? line : null;
  }, [focused, driverPosition, orderedStopPositions]);

  const bounds = useMemo(() => {
    const coords = [];
    if (focused) {
      if (driverPosition) coords.push([driverPosition.lat, driverPosition.lng]);
      groupedStops.forEach((g) => coords.push([g.lat, g.lng]));
    } else {
      drivers.forEach((d) => {
        const lat = Number.parseFloat(d.latitude);
        const lng = Number.parseFloat(d.longitude);
        if (!Number.isNaN(lat) && !Number.isNaN(lng)) coords.push([lat, lng]);
      });
    }
    if (coords.length === 0) return null;
    return L.latLngBounds(coords);
  }, [focused, driverPosition, groupedStops, drivers]);

  const heightStyle = typeof height === "number" ? `${height}px` : height;

  const driverHasNoLocation = focused && !driverPosition;

  return (
    <div
      ref={shellRef}
      className="admin-live-map-shell rounded-lg overflow-hidden border border-border bg-card relative w-full"
      style={{ height: heightStyle, width: "100%" }}
    >
      {/* Same defensive tile/marker overrides as route-overview-map.jsx —
          keeps this map visually identical to the driver Live Map and
          guards against global `img` resets elsewhere in the app. */}
      <style>{`
        .admin-live-map-shell, .admin-live-map-shell .leaflet-container {
          width: 100%;
          height: 100%;
        }
        .admin-live-map-shell img {
          max-width: none;
          min-height: 0;
          width: auto;
          height: auto;
          object-fit: fill;
        }
        .admin-live-map-shell:fullscreen,
        .admin-live-map-shell:-webkit-full-screen {
          width: 100vw !important;
          height: 100vh !important;
          border-radius: 0;
        }
        .admin-live-map-shell .leaflet-control-container {
          display: none;
        }
        .admin-live-map-marker { background: transparent; border: none; }
      `}</style>

      <MapContainer
        center={[52.03, -0.9]} /* roughly between Milton Keynes and Oxford until bounds fit */
        className="leaflet-container w-full h-full"
        style={{ height: "100%", width: "100%" }}
        zoom={11}
        minZoom={3}
        maxZoom={18}
        scrollWheelZoom={true}
        touchZoom={true}
        dragging={true}
        doubleClickZoom={false}
        zoomControl={false}
        attributionControl={false}
      >
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='© OpenStreetMap contributors'
          detectRetina={typeof window !== "undefined" && window.devicePixelRatio > 1}
        />

        <MapReady bounds={bounds} />
        <ZoomControls />
        <MapClickHandler enabled={focused} driverPosition={driverPosition} points={orderedStopPositions} />

        {focused ? (
          <>
            {routeLine && (
              <Polyline
                positions={routeLine}
                pathOptions={{ color: "#2b6cb0", weight: 4, opacity: 0.95, lineCap: "round", lineJoin: "round" }}
              />
            )}

            {driverPosition && (
              <Marker
                position={[driverPosition.lat, driverPosition.lng]}
                icon={driverDivIcon({
                  vehicleType: selectedDriver.vehicle_type,
                  stale: !!selectedDriver.location_stale,
                  emphasis: true,
                })}
              >
                <Popup>
                  <div className="text-sm">
                    <div className="font-semibold">{selectedDriver.driver_name}</div>
                    <div className="text-muted-foreground capitalize">{selectedDriver.vehicle_type}</div>
                    {selectedDriver.speed_kmh != null && <div>Speed: {selectedDriver.speed_kmh} km/h</div>}
                    <div className="text-xs text-muted-foreground mt-1">
                      {selectedDriver.location_stale ? "Last known position (signal delayed)" : "Live position"}
                    </div>
                  </div>
                </Popup>
              </Marker>
            )}

            {groupedStops.map((group, idx) => (
              <Marker
                key={`${group.lat}-${group.lng}-${idx}`}
                position={[group.lat, group.lng]}
                icon={stopDivIcon(
                  STOP_COLORS[group.statusGroup],
                  group.points.length > 1 ? String(group.points.length) : String(group.sequence),
                )}
              >
                <Popup>
                  <div className="text-sm space-y-1">
                    {group.points.map((p) => (
                      <div key={p.id} className="flex items-center gap-2">
                        <span
                          className="inline-block w-2 h-2 rounded-full flex-shrink-0"
                          style={{ backgroundColor: STOP_COLORS[p.statusGroup] }}
                        />
                        <div>
                          <div className="font-medium">{p.label}</div>
                          <div className="text-xs text-muted-foreground">
                            {p.leg ? `${p.leg} · ` : ""}
                            {p.status || "unknown"}
                            {p.postcode ? ` · ${p.postcode}` : ""}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </Popup>
              </Marker>
            ))}
          </>
        ) : (
          drivers.map((driver) => {
            const lat = Number.parseFloat(driver.latitude);
            const lng = Number.parseFloat(driver.longitude);
            if (Number.isNaN(lat) || Number.isNaN(lng)) return null;
            return (
              <Marker
                key={driver.driver_profile || driver.id}
                position={[lat, lng]}
                icon={driverDivIcon({ vehicleType: driver.vehicle_type, stale: !!driver.location_stale })}
                eventHandlers={{ click: () => onSelectDriver(driver) }}
              >
                <Popup>
                  <div className="text-sm">
                    <div className="font-semibold">{driver.driver_name}</div>
                    <div className="text-muted-foreground capitalize">{driver.vehicle_type}</div>
                    <div className="text-xs text-muted-foreground">{driver.hub_name || "Unknown hub"}</div>
                  </div>
                </Popup>
              </Marker>
            );
          })
        )}
      </MapContainer>

      {driverHasNoLocation && (
        <div className="absolute inset-x-0 top-3 flex justify-center pointer-events-none" style={{ zIndex: 9999 }}>
          <div className="bg-white/95 dark:bg-black/85 text-xs px-3 py-1.5 rounded-lg shadow-md border border-border">
            No live position for {selectedDriver.driver_name} — location tracking may be off, or no signal has been received yet.
          </div>
        </div>
      )}

      {/* Legend, focused mode only — explains the colour coding. */}
      {focused && groupedStops.length > 0 && (
        <div
          className="absolute left-3 bottom-3 bg-white/90 dark:bg-black/80 rounded-lg shadow-md border border-border px-3 py-2 text-xs space-y-1"
          style={{ zIndex: 9999 }}
        >
          <div className="flex items-center gap-2">
            <span className="inline-block w-2.5 h-2.5 rounded-full" style={{ backgroundColor: STOP_COLORS.completed }} />
            Completed
          </div>
          <div className="flex items-center gap-2">
            <span className="inline-block w-2.5 h-2.5 rounded-full" style={{ backgroundColor: STOP_COLORS.remaining }} />
            Remaining
          </div>
        </div>
      )}

      {/* Overlay CTAs, top-right: open-in-maps (focused only) and fullscreen toggle */}
      <div className="absolute top-3 right-3 flex items-center gap-2" style={{ zIndex: 9999 }}>
        {focused && (
          <button
            type="button"
            onClick={() => openDriverRouteDirections(driverPosition, orderedStopPositions)}
            disabled={!driverPosition && orderedStopPositions.length === 0}
            aria-label="Open route in Google Maps"
            className="flex items-center gap-1.5 bg-white/90 dark:bg-black/80 text-sm px-3 py-1 rounded-lg shadow-md border border-border hover:shadow-lg touch-action-manipulation disabled:opacity-50"
          >
            <Navigation size={14} />
            Open in Google Maps
          </button>
        )}
        <button
          type="button"
          onClick={toggleFullscreen}
          aria-label={isFullscreen ? "Exit fullscreen" : "Expand map to fullscreen"}
          className="flex h-8 w-8 items-center justify-center bg-white/90 dark:bg-black/80 rounded-lg shadow-md border border-border hover:shadow-lg touch-action-manipulation"
        >
          {isFullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
        </button>
      </div>
    </div>
  );
}