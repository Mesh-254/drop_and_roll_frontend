// offline/network.js
//
// Connectivity detection for the offline sync engine.
//
// navigator.onLine is necessary but NOT sufficient: it reports "online"
// as soon as the device has a network interface with a link, even if
// that Wi-Fi/mobile connection has no actual route to the internet (a
// common state on UK mobile networks with a captive/degraded signal).
// We pair it with a real heartbeat request to a cheap backend endpoint
// before the sync engine trusts that it can flush the queue.

import { workOfflineMode } from "./workOfflineMode";

const HEALTH_URL_PATH = "/api/health/";
const HEARTBEAT_TIMEOUT_MS = 5000;
const HEARTBEAT_MIN_INTERVAL_MS = 8000; // don't hammer the health endpoint

let lastHeartbeatAt = 0;
let lastHeartbeatResult = null;

function getBaseUrl() {
  // Mirrors ApiBase.js's env var so this module has zero import-cycle risk
  // with the axios-based API layer.
  return import.meta.env.VITE_NEXT_PUBLIC_BACKEND_URL || "";
}

/**
 * Real connectivity check: navigator.onLine AND a fast round trip to the
 * backend succeed. Debounced so callers (queue manager, UI banners) can
 * call this liberally without generating request storms.
 */
export async function isOnline({ force = false } = {}) {
  if (workOfflineMode.isActive()) {
    // Manual "Work Offline" mode always forces the queue path, even on a
    // technically-live connection — this is the point of the toggle for
    // known-flaky-signal situations.
    return false;
  }

  if (typeof navigator !== "undefined" && navigator.onLine === false) {
    return false;
  }

  const now = Date.now();
  if (!force && now - lastHeartbeatAt < HEARTBEAT_MIN_INTERVAL_MS) {
    return lastHeartbeatResult ?? true;
  }

  lastHeartbeatAt = now;
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), HEARTBEAT_TIMEOUT_MS);
    const res = await fetch(`${getBaseUrl()}${HEALTH_URL_PATH}`, {
      method: "GET",
      cache: "no-store",
      signal: controller.signal,
    });
    clearTimeout(timeout);
    lastHeartbeatResult = res.ok;
    return res.ok;
  } catch (err) {
    lastHeartbeatResult = false;
    return false;
  }
}

/**
 * Subscribes to browser connectivity events and periodic heartbeats.
 * Calls `onChange(isOnlineBool)` whenever the *effective* status changes.
 * Returns an unsubscribe function.
 */
export function watchConnectivity(onChange, { pollMs = 20000 } = {}) {
  let cancelled = false;
  let lastKnown = null;

  const check = async (opts) => {
    if (cancelled) return;
    const online = await isOnline(opts);
    if (online !== lastKnown) {
      lastKnown = online;
      onChange(online);
    }
  };

  const handleOnline = () => check({ force: true });
  const handleOffline = () => check({ force: true });
  const handleVisibility = () => {
    if (document.visibilityState === "visible") check({ force: true });
  };

  window.addEventListener("online", handleOnline);
  window.addEventListener("offline", handleOffline);
  document.addEventListener("visibilitychange", handleVisibility);

  const interval = setInterval(() => check({}), pollMs);

  // Initial check
  check({ force: true });

  return () => {
    cancelled = true;
    window.removeEventListener("online", handleOnline);
    window.removeEventListener("offline", handleOffline);
    document.removeEventListener("visibilitychange", handleVisibility);
    clearInterval(interval);
  };
}
