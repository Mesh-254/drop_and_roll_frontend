/**
 * components/payments/PayPalButtons.jsx
 * ══════════════════════════════════════════════════════════════════════════════
 * PayPal, paid in place.
 *
 * What this replaces: a "Pay with PayPal" button that sent the customer to
 * paypal.com and relied on them coming back to `?paypal_return=1&token=…`. That
 * works, but every redirect is a place to lose someone, and on the bulk page
 * PayPal was not offered at all — card or nothing.
 *
 * Server contract is UNCHANGED. `createOrder` calls the same initiate endpoint
 * that produced the approval URL, and `onApprove` calls the same capture
 * endpoint the return leg called. The amount is never computed here: this
 * component asks the server for an order id and hands back an approval, so a
 * bug in this file cannot change what someone is charged.
 *
 * DEGRADES RATHER THAN BLOCKS. If the SDK fails to load — blocked script, an ad
 * blocker, a bad network — the redirect flow is still offered. Removing a
 * working money path because a nicer one usually loads is not an upgrade.
 */

import React, { useEffect, useRef, useState } from "react";

const SDK_ID = "paypal-sdk";

/**
 * Load the PayPal SDK once per page. Resolves with window.paypal, or rejects if
 * the script cannot be fetched.
 */
export function loadPayPalSdk(clientId, currency = "GBP") {
  if (typeof window === "undefined") return Promise.reject(new Error("no window"));
  if (window.paypal) return Promise.resolve(window.paypal);

  const existing = document.getElementById(SDK_ID);
  if (existing?._loadPromise) return existing._loadPromise;

  const script = document.createElement("script");
  script.id = SDK_ID;
  script.src =
    `https://www.paypal.com/sdk/js?client-id=${encodeURIComponent(clientId)}` +
    `&currency=${encodeURIComponent(currency)}&components=buttons`;
  const promise = new Promise((resolve, reject) => {
    script.onload = () =>
      window.paypal ? resolve(window.paypal) : reject(new Error("sdk loaded without window.paypal"));
    script.onerror = () => reject(new Error("paypal sdk failed to load"));
  });
  script._loadPromise = promise;
  document.body.appendChild(script);
  return promise;
}

export default function PayPalButtons({
  createOrder,
  onApprove,
  onFallback = null,
  currency = "GBP",
  clientId = import.meta.env?.VITE_PAYPAL_CLIENT_ID,
  sdkLoader = loadPayPalSdk,
}) {
  const container = useRef(null);
  const [status, setStatus] = useState("loading"); // loading | ready | unavailable
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;

    if (!clientId) {
      setStatus("unavailable");
      return undefined;
    }

    sdkLoader(clientId, currency)
      .then((paypal) => {
        if (cancelled || !container.current) return;
        paypal
          .Buttons({
            style: { layout: "horizontal", height: 44, tagline: false },
            createOrder: () => createOrder(),
            onApprove: (data) => onApprove(data),
            onError: (err) => {
              // A failure INSIDE PayPal is not a failure to pay: the order may
              // exist. Say so plainly rather than implying the money moved.
              setError(
                "PayPal could not complete that. If you were charged, do not pay again — contact support.",
              );
              if (typeof err?.message === "string") {
                // eslint-disable-next-line no-console
                console.error("[PayPalButtons]", err.message);
              }
            },
          })
          .render(container.current);
        setStatus("ready");
      })
      .catch(() => {
        if (!cancelled) setStatus("unavailable");
      });

    return () => {
      cancelled = true;
    };
  }, [clientId, currency, createOrder, onApprove, sdkLoader]);

  return (
    <div>
      <div ref={container} data-testid="paypal-buttons" />

      {status === "loading" && (
        <p style={{ fontSize: 13, color: "#64748b" }}>Loading PayPal…</p>
      )}

      {status === "unavailable" && (
        <div data-testid="paypal-fallback">
          <p style={{ fontSize: 13, color: "#64748b" }}>
            PayPal could not load here.
            {onFallback ? " You can still pay through PayPal directly." : ""}
          </p>
          {onFallback && (
            <button
              type="button"
              onClick={onFallback}
              style={{
                padding: "8px 14px",
                borderRadius: 8,
                border: "1px solid #cbd5e1",
                background: "#fff",
                cursor: "pointer",
              }}
            >
              Continue to PayPal
            </button>
          )}
        </div>
      )}

      {error && (
        <p role="alert" style={{ fontSize: 13, color: "#b91c1c" }}>
          {error}
        </p>
      )}
    </div>
  );
}
