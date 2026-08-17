import React, { useEffect, useRef, useState, useCallback } from "react";
import "leaflet/dist/leaflet.css";
import { MapContainer, TileLayer, Polyline, Marker, Popup, useMap, useMapEvents } from "react-leaflet";
import L from "leaflet";
import { Plus, Minus, Maximize2, Minimize2 } from "lucide-react";
import markerIconUrl from "leaflet/dist/images/marker-icon.png";
import markerIcon2xUrl from "leaflet/dist/images/marker-icon-2x.png";
import markerShadowUrl from "leaflet/dist/images/marker-shadow.png";
import { openRouteDirections, openDirections } from "../../lib/map-links";

// Fix default icon paths for Leaflet in bundlers (Vite/webpack)
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2xUrl,
  iconUrl: markerIconUrl,
  shadowUrl: markerShadowUrl,
});

// Two stops with the same postcode geocode to the same (or near-identical)
// lat/lng — think a block of flats, a business park, a hub. Rendering one
// marker per point there stacked N pins exactly on top of each other: only
// the topmost was ever visible or tappable, and the rest silently
// disappeared. Group by postcode first (the more reliable identity — two
// rows for the same address should count as "the same place" even if their
// geocoded coordinates differ by a few decimal places of float noise), and
// fall back to rounded coordinates for points with no postcode.
function groupPointsByLocation(points) {
  const groups = [];
  const indexByKey = new Map();

  points.forEach((p) => {
    const lat = Number(p.lat);
    const lng = Number(p.lng);
    const postcode = (p.postcode || "").trim().toUpperCase();
    // ~1m precision — enough to catch float jitter between two geocodes of
    // the same address without merging two genuinely different addresses.
    const key = postcode ? `pc:${postcode}` : `geo:${lat.toFixed(5)},${lng.toFixed(5)}`;

    if (indexByKey.has(key)) {
      groups[indexByKey.get(key)].stops.push(p);
    } else {
      indexByKey.set(key, groups.length);
      groups.push({ key, lat, lng, postcode: p.postcode || "", stops: [p] });
    }
  });

  return groups;
}

// Default single-stop icon: plain markerIconUrl/markerIcon2xUrl set above.
// Grouped stops get a badge on the pin so "multiple jobs here" is visible
// at a glance on the map itself, not just after opening the popup.
function groupedMarkerIcon(count) {
  const html = `
    <div class="relative" style="width:25px;height:41px;">
      <svg width="25" height="41" viewBox="0 0 25 41" xmlns="http://www.w3.org/2000/svg">
        <path d="M12.5 0.5C5.87 0.5 0.5 5.87 0.5 12.5c0 9.3 12 27.4 12 27.4s12-18.1 12-27.4C24.5 5.87 19.13 0.5 12.5 0.5z"
              fill="#2b6cb0" stroke="#1a3f66" stroke-width="1"/>
        <circle cx="12.5" cy="12.5" r="5.5" fill="#fff"/>
      </svg>
      <span
        class="absolute flex items-center justify-center rounded-full bg-destructive text-white font-bold leading-none border-2 border-white shadow"
        style="top:-6px;right:-8px;min-width:20px;height:20px;padding:0 4px;font-size:11px;"
      >${count}</span>
    </div>
  `;
  return L.divIcon({
    html,
    className: "route-overview-grouped-marker",
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [0, -36],
  });
}

// Internal component: keeps the map correctly sized and fitted to its
// container. Uses the useMap() hook (stable across react-leaflet versions)
// instead of relying on whenCreated, and re-runs invalidateSize whenever the
// container itself resizes (sidebar collapse, tab switch, entering/exiting
// fullscreen, etc.) so the tile grid never gets stuck at a stale/incorrect
// size. Only fits bounds on the initial mount — later resizes (e.g. the
// fullscreen toggle) just resize the tile grid without resetting whatever
// zoom/pan the user has since chosen.
function MapReady({ bounds }) {
  const map = useMap();
  const hasFitRef = useRef(false);

  useEffect(() => {
    const container = map.getContainer();

    const settle = () => {
      map.invalidateSize(true);
      if (!hasFitRef.current && bounds && bounds.isValid()) {
        map.fitBounds(bounds, { padding: [20, 20], animate: false });
        hasFitRef.current = true;
      }
    };

    // Initial fit, deferred one frame so layout has settled.
    const raf = requestAnimationFrame(settle);

    // Keep the tile grid in sync any time the container's own size changes
    // (sidebar collapse, tab switch, fullscreen enter/exit, etc.)
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

// Internal component: floating +/- zoom buttons. Built ourselves (rather
// than the default Leaflet zoom control) so they can be styled to match the
// app and placed without colliding with the other overlay buttons.
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

// Internal component: handle map clicks but ignore clicks on markers/popups
function MapClickHandler({ points }) {
  useMapEvents({
    click: (e) => {
      try {
        const tgt = e.originalEvent?.target;
        // `.className` is a plain string on <img> (the default marker icon)
        // but an SVGAnimatedString on <svg>/<path>/<circle> (our custom
        // grouped-stop icon) — checking it directly silently mis-detects
        // clicks on the SVG marker as map-background clicks. `closest()`
        // works the same way on both HTML and SVG elements, so it's the
        // one check that covers both icon types.
        if (tgt?.closest?.(".leaflet-marker-icon, .leaflet-marker-shadow, .leaflet-popup, .leaflet-popup-content")) {
          return;
        }
        // Otherwise open Google Maps directions for the ordered points
        openRouteDirections(points);
      } catch (err) {
        console.error("Map click handler failed:", err);
      }
    },
  });
  return null;
}

/**
 * Lightweight route overview map.
 * Props:
 *  - points: [{ lat: number, lng: number, label?: string }] in route order
 *  - center?: { lat, lng } optional initial center; otherwise fits bounds
 *  - height?: CSS height (default 200)
 */
export default function RouteOverviewMap({ points = [], center = null, height = 240 }) {
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

  if (!points || points.length < 2) {
    return (
      <div className="bg-card border border-border rounded-lg p-4 h-48 flex items-center justify-center">
        <p className="text-sm text-muted-foreground">Not enough location data to show route overview</p>
      </div>
    );
  }

  const poly = points.map((p) => [Number(p.lat), Number(p.lng)]);
  const bounds = L.latLngBounds(poly);
  const locationGroups = groupPointsByLocation(points);

  // Normalize height value to CSS string
  const heightStyle = typeof height === "number" ? `${height}px` : height;

  return (
    <div
      ref={shellRef}
      className="route-overview-map-shell rounded-lg overflow-hidden border border-border bg-card relative w-full"
      style={{ height: heightStyle, width: "100%" }}
    >
      {/*
        Scoped, defensive overrides. These guard the map against any global
        `img` rules elsewhere in the app (e.g. width/min-height/object-fit
        resets meant for unrelated components) that would otherwise stretch
        Leaflet's 256px tile images and marker icons, producing white
        seams between tile rows and blurry/pixelated tiles and markers.
        The :fullscreen rules force the shell to actually fill the screen —
        some browsers apply the UA fullscreen sizing with lower specificity
        than the inline height style, which would otherwise leave a
        letterboxed map with white bars top/bottom while fullscreen.
      */}
      <style>{`
        .route-overview-map-shell, .route-overview-map-shell .leaflet-container {
          width: 100%;
          height: 100%;
        }
        .route-overview-map-shell img {
          max-width: none;
          min-height: 0;
          width: auto;
          height: auto;
          object-fit: fill;
        }
        .route-overview-map-shell:fullscreen,
        .route-overview-map-shell:-webkit-full-screen {
          width: 100vw !important;
          height: 100vh !important;
          border-radius: 0;
        }
        /*
          We ship our own zoom/fullscreen/open-in-maps buttons and disable
          Leaflet's built-in zoomControl/attributionControl — but Leaflet
          still creates its (empty) .leaflet-control-container corner boxes
          unconditionally, and they carry z-index: 1000 in leaflet.css. Our
          custom buttons were painting underneath that whenever a popup or
          extra pane pushed the stacking order around, which is exactly the
          "controls vanish once the map finishes loading" bug. Removing the
          unused container outright is more robust than trying to out-number
          a z-index we don't control.
        */
        .route-overview-map-shell .leaflet-control-container {
          display: none;
        }
        /* Our grouped-stop marker is a plain divIcon — strip Leaflet's
           default white box/border styling so only our own pin+badge SVG
           shows. */
        .route-overview-map-shell .route-overview-grouped-marker {
          background: transparent;
          border: none;
        }
      `}</style>
      <MapContainer
        bounds={bounds}
        boundsOptions={{ padding: [20, 20] }}
        className="leaflet-container w-full h-full"
        style={{ height: "100%", width: "100%" }}
        zoom={13}
        minZoom={3}
        maxZoom={18}
        scrollWheelZoom={true}
        touchZoom={true}
        // keep interactivity limited for lightweight overview but allow touch panning
        dragging={true}
        doubleClickZoom={false}
        zoomControl={false}
        attributionControl={false}
      >
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='© OpenStreetMap contributors'
          // enable retina tiles where available for sharper rendering on high-dpi displays
          detectRetina={typeof window !== 'undefined' && window.devicePixelRatio > 1}
        />

        <MapReady bounds={bounds} />
        <ZoomControls />

        <Polyline
          positions={poly}
          pathOptions={{
            color: "#2b6cb0",
            weight: 4,
            opacity: 0.95,
            lineCap: "round",
            lineJoin: "round",
          }}
        />

        {locationGroups.map((g) => {
          const isGrouped = g.stops.length > 1;
          const jobLabels = g.stops.map((s, i) => s.label || `Stop ${i + 1}`);
          const combinedLabel = jobLabels.join(", ");

          return (
            <Marker
              key={g.key}
              position={[g.lat, g.lng]}
              // Never pass icon={undefined} here — react-leaflet forwards it
              // straight into Leaflet's option merge (L.extend(Object.create(
              // this.options), options)), which copies own keys regardless of
              // value. An explicit `icon: undefined` therefore overwrites the
              // prototype's default icon instead of falling through to it,
              // so this.options.icon ends up undefined and Leaflet's
              // _initIcon() crashes calling undefined.createIcon(). Only
              // include the prop at all when there's a real icon to set.
              {...(isGrouped ? { icon: groupedMarkerIcon(g.stops.length) } : {})}
            >
              <Popup>
                <div className="text-sm max-w-[220px]">
                  {isGrouped ? (
                    <>
                      <div className="font-semibold">
                        {g.postcode || "Multiple stops"} ({g.stops.length} jobs)
                      </div>
                      <div className="text-muted-foreground break-words">Jobs {combinedLabel}</div>
                    </>
                  ) : (
                    <>
                      <div className="font-semibold">{combinedLabel}</div>
                      <div className="text-muted-foreground">{g.postcode || ""}</div>
                    </>
                  )}
                  <button
                    type="button"
                    onClick={() =>
                      openDirections({ lat: g.lat, lng: g.lng, postcode: g.postcode, label: combinedLabel })
                    }
                    className="mt-2 text-xs font-medium text-primary underline underline-offset-2 touch-action-manipulation"
                  >
                    Get directions
                  </button>
                </div>
              </Popup>
            </Marker>
          );
        })}

        {/* Attach map click handler to open route in Google Maps (unless clicking markers/popups) */}
        <MapClickHandler points={points} />
      </MapContainer>

      {/* Overlay CTAs, top-right: open-in-maps and fullscreen toggle */}
      <div className="absolute top-3 right-3 flex items-center gap-2" style={{ zIndex: 9999 }}>
        <button
          type="button"
          onClick={() => openRouteDirections(points)}
          aria-label="Open route in Google Maps"
          className="bg-white/90 dark:bg-black/80 text-sm px-3 py-1 rounded-lg shadow-md border border-border hover:shadow-lg touch-action-manipulation"
          style={{ backdropFilter: 'none' }}
        >
          Open in Google Maps
        </button>
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