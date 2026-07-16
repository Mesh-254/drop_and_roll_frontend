// offline/workOfflineMode.js
//
// "Work Offline" is a manual mode, not a networking mechanism: it forces
// every action into the local queue for a fixed window (30/60/90 min),
// even if the device technically has signal. This is for drivers who know
// they're headed into a dead zone or a flaky-signal area and would rather
// not gamble on individual requests timing out mid-action.
//
// State is persisted (localStorage, not IndexedDB — it's tiny and needs
// to be readable synchronously before Dexie has necessarily opened) so it
// survives a refresh or the app being closed and reopened within the
// window.

const STORAGE_KEY = "dropnroll_work_offline_until";

const listeners = new Set();

function readExpiry() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return null;
  const until = Number(raw);
  if (Number.isNaN(until) || until <= Date.now()) {
    if (raw) localStorage.removeItem(STORAGE_KEY);
    return null;
  }
  return until;
}

function notify() {
  const until = readExpiry();
  listeners.forEach((cb) => cb(until));
}

export const workOfflineMode = {
  /** True if manual offline mode is currently active (not expired). */
  isActive() {
    return readExpiry() !== null;
  },

  /** Milliseconds until expiry, or null if not active. */
  remainingMs() {
    const until = readExpiry();
    return until ? until - Date.now() : null;
  },

  /** Turns on manual offline mode for `minutes` (default 60). */
  enable(minutes = 60) {
    const until = Date.now() + minutes * 60 * 1000;
    localStorage.setItem(STORAGE_KEY, String(until));
    notify();
  },

  /** Cancels manual offline mode immediately (e.g. "Go online now"). */
  disable() {
    localStorage.removeItem(STORAGE_KEY);
    notify();
  },

  /**
   * Subscribes to changes (enable/disable/expiry). Callback receives the
   * expiry timestamp (ms epoch) or null. Also ticks every 15s while active
   * so a countdown UI can re-render, and auto-disables on expiry.
   */
  subscribe(callback) {
    listeners.add(callback);
    callback(readExpiry());

    const interval = setInterval(() => {
      const until = readExpiry();
      if (until === null && localStorage.getItem(STORAGE_KEY)) {
        // Expired since last check — clean up and notify.
        localStorage.removeItem(STORAGE_KEY);
      }
      callback(until);
    }, 15000);

    return () => {
      listeners.delete(callback);
      clearInterval(interval);
    };
  },
};

export default workOfflineMode;
