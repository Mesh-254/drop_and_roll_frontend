export function openDirections({ postcode = "", lat = null, lng = null, label = "Destination" } = {}) {
  try {
    const isMobile = typeof navigator !== "undefined" && /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);

    // Preferred destination string for Google Maps
    const dest = postcode ? postcode : (lat != null && lng != null ? `${lat},${lng}` : "");
    const googleUrl = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(dest)}`;

    // If coordinates are available and on mobile, try geo: URI to open native maps
    if (isMobile && lat != null && lng != null) {
      // geo URI with query label. On Android this opens a chooser/Maps directly.
      const geoUri = `geo:${lat},${lng}?q=${lat},${lng}(${encodeURIComponent(label)})`;
      // Setting location to geo: should hand off to native maps on mobile.
      window.location.href = geoUri;

      // As a safety, open the Google Maps URL shortly after in case geo: is
      // not supported or the platform ignores it (desktop browsers won't handle)
      setTimeout(() => {
        window.open(googleUrl, "_blank", "noopener,noreferrer");
      }, 500);
      return;
    }

    // If no coords or not mobile, open Google Maps directions in a new tab/window
    window.open(googleUrl, "_blank", "noopener,noreferrer");
  } catch (err) {
    // On any error, fallback to opening Google Maps link
    try {
      const dest = postcode ? postcode : (lat != null && lng != null ? `${lat},${lng}` : "");
      const googleUrl = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(dest)}`;
      window.open(googleUrl, "_blank", "noopener,noreferrer");
    } catch (e) {
      // swallow
      console.error("openDirections fallback failed:", e);
    }
  }
}

/**
 * Open a multi-stop route in Google Maps using a directions URL. No API key required.
 * points: ordered array of { lat, lng, label?, postcode? }
 */
export function openRouteDirections(points = []) {
  if (!points || points.length === 0) return;

  try {
    // Build waypoints and destination. Google Maps web/url supports waypoints as
    // pipe-separated list. Destination is the last point. Origin is omitted so
    // Google Maps uses current device location.
    const safe = (p) => `${Number(p.lat)},${Number(p.lng)}`;

    // When there is only one point, just open directions to that single point
    if (points.length === 1) {
      const dest = safe(points[0]);
      const url = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(dest)}`;
      window.open(url, "_blank", "noopener,noreferrer");
      return;
    }

    const destination = safe(points[points.length - 1]);
    const waypoints = points.slice(0, -1).map((p) => safe(p)).join("|");

    // Compose URL: omit origin so Maps uses current location. Include travelmode=driving by default.
    const url = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(destination)}&waypoints=${encodeURIComponent(waypoints)}&travelmode=driving`;

    const isMobile = typeof navigator !== "undefined" && /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);

    if (isMobile) {
      // Attempt to open the google maps URL via location.href so mobile may open the native app
      window.location.href = url;
      // As a fallback, also open in a new tab after a short delay
      setTimeout(() => window.open(url, "_blank", "noopener,noreferrer"), 600);
      return;
    }

    window.open(url, "_blank", "noopener,noreferrer");
  } catch (e) {
    console.error("openRouteDirections failed:", e);
  }
}
