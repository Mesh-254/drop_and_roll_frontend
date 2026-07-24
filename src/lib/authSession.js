/**
 * authSession.js
 *
 * ONE place that coordinates session expiry across the whole app. The axios
 * interceptor in ApiBase (which is NOT a React component and can't call hooks
 * or navigate) signals expiry here; the React layer (AuthContext) subscribes.
 * Nothing else should scatter its own 401 / logout / redirect logic.
 *
 * Responsibilities:
 *   - Debounce a burst of concurrent 401s into a SINGLE expiry cycle.
 *   - Capture the route the user was on so login can send them back.
 *   - Broadcast logout to OTHER tabs via a localStorage `storage` event.
 *   - Fire an in-tab event so AuthContext can flip auth state immediately.
 */

const EXPIRED_FLAG = "session_expired"; // sessionStorage: show the notice on the login form
const REDIRECT_KEY = "post_login_redirect"; // sessionStorage: where to return after re-login
export const AUTH_BROADCAST_KEY = "auth_broadcast"; // localStorage: cross-tab logout signal
export const SESSION_EXPIRED_EVENT = "auth:session-expired"; // window event, this tab

// In-tab debounce: many concurrent requests can all 401 at once (requirement 6).
// Only the first should capture the route, broadcast, and flip state.
let expiryHandled = false;

function safe(fn, fallback) {
  try {
    return fn();
  } catch {
    // sessionStorage/localStorage can throw (private mode, disabled) — never let
    // an expiry cycle crash on storage access.
    return fallback;
  }
}

/** Path (with query) the user is currently on — the "return to" target. */
export function captureCurrentPath() {
  if (typeof window === "undefined") return "/";
  return window.location.pathname + window.location.search;
}

/**
 * Trigger the session-expired cycle. Idempotent within a tab until
 * resetExpiryGuard() runs (i.e. after a successful re-login), so a stampede of
 * 401s produces exactly one redirect.
 */
export function markSessionExpired() {
  if (expiryHandled) return;
  expiryHandled = true;

  safe(() => {
    sessionStorage.setItem(EXPIRED_FLAG, "1");
    // Don't overwrite an already-captured target (first 401 wins), and don't
    // capture a login/auth route as the return target.
    const path = captureCurrentPath();
    if (!sessionStorage.getItem(REDIRECT_KEY) && !/^\/(login|register)\b/.test(path)) {
      sessionStorage.setItem(REDIRECT_KEY, path);
    }
    // storage events fire in OTHER tabs only — this tells them to log out too.
    localStorage.setItem(AUTH_BROADCAST_KEY, JSON.stringify({ type: "logout", t: Date.now() }));
  });

  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(SESSION_EXPIRED_EVENT));
  }
}

/** Was the current login form reached via an expiry (vs a normal first login)? */
export function wasSessionExpired() {
  return safe(() => sessionStorage.getItem(EXPIRED_FLAG) === "1", false);
}

/**
 * Return the captured post-login route and clear BOTH the redirect target and
 * the expired flag. Call this once, on successful login.
 */
export function consumeRedirectPath() {
  return safe(() => {
    const path = sessionStorage.getItem(REDIRECT_KEY);
    sessionStorage.removeItem(REDIRECT_KEY);
    sessionStorage.removeItem(EXPIRED_FLAG);
    return path;
  }, null);
}

/**
 * Re-arm the debounce after a successful login so a FUTURE expiry can fire
 * again, and clear any stale expired flag.
 */
export function resetExpiryGuard() {
  expiryHandled = false;
  safe(() => {
    sessionStorage.removeItem(EXPIRED_FLAG);
    // Clear any captured route too. Some login paths (e.g. the admin bridge)
    // don't call consumeRedirectPath(); a stale key would block the next
    // expiry from capturing a fresh return target (first-401-wins guard).
    sessionStorage.removeItem(REDIRECT_KEY);
  });
}
