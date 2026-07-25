// Build a WebSocket URL from an HTTP(S) backend base, upgrading the scheme:
//   http://host:8000  -> ws://host:8000
//   https://api.host   -> wss://api.host
// Centralises the http→ws / https→wss rule so no component hardcodes a localhost WS URL
// (the class of bug that broke admin live-tracking in production). Mirrors the inline
// logic in driver-api.js `driverWsUrl`.
export function httpBaseToWs(base) {
  const fallback = "http://127.0.0.1:8000";
  const b = base || fallback;
  return b.replace(/^http/i, "ws");
}

// Full tracking-channel WS URL for the admin live-tracking dashboard.
export function trackingWsUrl(base) {
  return `${httpBaseToWs(base)}/ws/tracking/`;
}
