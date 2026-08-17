import React, { useEffect, useRef, useState, useCallback } from "react";
import "leaflet/dist/leaflet.css";
import { MapContainer, TileLayer, Polyline, Marker, Popup, useMap, useMapEvents } from "react-leaflet";
import L from "leaflet";
import { Plus, Minus, Maximize2, Minimize2 } from "lucide-react";
import markerIconUrl from "leaflet/dist/images/marker-icon.png";
import markerIcon2xUrl from "leaflet/dist/images/marker-icon-2x.png";
import markerShadowUrl from "leaflet/dist/images/marker-shadow.png";
import { openRouteDirections } from "../../lib/map-links";

// Fix default icon paths for Leaflet in bundlers (Vite/webpack)
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2xUrl,
  iconUrl: markerIconUrl,
  shadowUrl: markerShadowUrl,
});

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
        const className = tgt?.className || "";
        // If click originated on a marker or popup element, ignore so the popup can work
        if (typeof className === "string" && /(leaflet-marker-icon|leaflet-marker-shadow|leaflet-popup|leaflet-popup-content)/.test(className)) {
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

        {points.map((p, idx) => (
          <Marker key={`${p.lat}-${p.lng}-${idx}`} position={[Number(p.lat), Number(p.lng)]}>
            <Popup>
              <div className="text-sm">
                <div className="font-semibold">{p.label || `Stop ${idx + 1}`}</div>
                <div className="text-muted-foreground">{p.postcode || ""}</div>
              </div>
            </Popup>
          </Marker>
        ))}

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