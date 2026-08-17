/**
 * TurnstileWidget.jsx
 *
 * Phase 3, Task 3.5: Cloudflare Turnstile widget, loaded from the official script (no npm
 * dependency). Renders nothing when VITE_TURNSTILE_SITE_KEY is unset, so the feature is off
 * by default in environments that haven't configured it — mirroring the backend gate.
 *
 * Usage:
 *   <TurnstileWidget onVerify={setToken} onExpire={() => setToken("")} />
 * The token produced by onVerify is sent to the backend as `turnstile_token`.
 */
import { useEffect, useRef } from "react";

const SITE_KEY = import.meta.env.VITE_TURNSTILE_SITE_KEY;
const SCRIPT_SRC =
  "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";

// True when a site key is configured — call sites use this to require a token before submit.
export const TURNSTILE_ENABLED = Boolean(SITE_KEY);

let scriptPromise = null;
function loadTurnstileScript() {
  if (window.turnstile) return Promise.resolve();
  if (scriptPromise) return scriptPromise;
  scriptPromise = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = SCRIPT_SRC;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Failed to load Turnstile"));
    document.head.appendChild(script);
  });
  return scriptPromise;
}

export default function TurnstileWidget({ onVerify, onExpire, onError, className = "" }) {
  const containerRef = useRef(null);
  const widgetIdRef = useRef(null);
  // Keep the latest callbacks in a ref so the render effect can run exactly once (mounting
  // the widget twice would show duplicate challenges).
  const callbacksRef = useRef({ onVerify, onExpire, onError });
  callbacksRef.current = { onVerify, onExpire, onError };

  useEffect(() => {
    if (!SITE_KEY) return undefined;
    let cancelled = false;

    loadTurnstileScript()
      .then(() => {
        if (cancelled || !containerRef.current || !window.turnstile) return;
        widgetIdRef.current = window.turnstile.render(containerRef.current, {
          sitekey: SITE_KEY,
          // theme: "dark" (not the default "auto") — LIGHT-MODE CONTRAST FIX.
          // "auto" follows the visitor's OS-level prefers-color-scheme, not
          // this app's light/dark toggle. LoginForm/RegisterForm render this
          // widget inside a permanently dark glass card (see tokens.css's
          // --overlay-* tokens), so on a light-OS visitor "auto" rendered a
          // bright white Cloudflare widget/"Success!" box that clashed with
          // and was hard to read against the dark card — same root cause as
          // the input-field contrast bug, just via Cloudflare's own theming
          // instead of ours.
          theme: "dark",
          callback: (token) => callbacksRef.current.onVerify?.(token),
          "expired-callback": () => callbacksRef.current.onExpire?.(),
          "error-callback": () => callbacksRef.current.onError?.(),
        });
      })
      .catch(() => callbacksRef.current.onError?.());

    return () => {
      cancelled = true;
      if (widgetIdRef.current && window.turnstile) {
        try {
          window.turnstile.remove(widgetIdRef.current);
        } catch {
          /* widget already gone — nothing to clean up */
        }
        widgetIdRef.current = null;
      }
    };
  }, []);

  if (!SITE_KEY) return null;
  return <div ref={containerRef} className={className} />;
}