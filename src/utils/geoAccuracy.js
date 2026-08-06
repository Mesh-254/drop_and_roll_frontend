/**
 * Geolocation accuracy: thresholds, classification, and best-fix acquisition.
 *
 * WHY THIS IS NOT INSIDE THE COMPONENT
 * ------------------------------------
 * Every rule here is same-input-same-output: given an accuracy in metres, is
 * this fix good, usable, or not a location at all? Given a stream of positions,
 * which one do we keep? None of that needs React, and buried in a component it
 * could only be exercised by rendering one — so it never was, and a real POD
 * was recorded at {"lat": -1.292, "lng": 36.822, "accuracy": 373816}: Nairobi,
 * 374 km wide, on a UK-only operation.
 *
 * THE BUG THAT PRODUCED THAT RECORD
 * ---------------------------------
 * `getCurrentPosition` resolves with the FIRST position the device can produce.
 * `enableHighAccuracy: true` is a hint, not a guarantee, and it does not make
 * the browser wait for GPS — the WiFi/IP estimate is available immediately, so
 * that is what the promise resolves with. On a desktop with no GPS radio at all
 * that estimate is the whole country. Nothing downstream checked the radius, so
 * it was stored as the delivery location.
 */

// ── Thresholds ──────────────────────────────────────────────────────────────
// Mirrored by POD_ACCURACY_GOOD_M / POD_ACCURACY_MAX_M on the server, which is
// the gate that actually holds. The client copy exists to give the driver an
// immediate answer, not to be the last line of defence.

/** A good consumer GPS fix outdoors. Below this, "the right house?" is answerable. */
export const ACCURACY_GOOD_M = 50;

/** Above this a fix cannot tell neighbouring streets apart and is not evidence. */
export const ACCURACY_MAX_M = 200;

/**
 * Upper bound on how long we will wait for the device to produce ANY position.
 *
 * This is a timeout, not a sampling window. Nothing waits it out on purpose —
 * `acquireFirstFix` resolves the moment the first position arrives, which on a
 * phone is typically well under a second. It only exists so a device that
 * answers with neither a position nor an error cannot hang the screen forever.
 */
export const LOCATION_WINDOW_MS = 8000;

/** Metres for humans: "12 m" reads, "12.4381 m" does not. */
export function formatAccuracy(metres) {
  if (metres == null || Number.isNaN(metres)) return "unknown";
  return metres >= 1000
    ? `${(metres / 1000).toFixed(1)} km`
    : `${Math.round(metres)} m`;
}

/**
 * Bucket an error radius.
 *
 * "unknown" is its own answer and is not folded into any other. A photo whose
 * EXIF carries coordinates but no horizontal-error tag is unverifiable, which is
 * a different thing from precise and a different thing from bad — treating it as
 * either one is how a fix nobody measured ends up trusted.
 */
export function classifyAccuracy(accuracy) {
  if (accuracy == null || Number.isNaN(accuracy)) return "unknown";
  if (accuracy <= ACCURACY_GOOD_M) return "good";
  if (accuracy <= ACCURACY_MAX_M) return "degraded";
  return "rejected";
}

export function isUsableAccuracy(accuracy) {
  return classifyAccuracy(accuracy) !== "rejected";
}

/**
 * The horizontal error a photo's EXIF actually reports, or null.
 *
 * GPSHPositioningError is the only EXIF tag that answers "how wrong could this
 * be". Most cameras omit it.
 *
 * This replaced `exif.gpsAltitudeAccuracy || 10`, which was wrong twice:
 * gpsAltitudeAccuracy is the error on ALTITUDE, a different axis, and the `|| 10`
 * invented a 10 m precision for every photo carrying neither tag. A fabricated
 * accuracy is worse than a missing one — it makes an unverified fix look like
 * the best reading in the system.
 */
export function exifHorizontalError(exif) {
  const value = exif?.GPSHPositioningError;
  return typeof value === "number" && !Number.isNaN(value) ? value : null;
}

/**
 * Resolve with the FIRST position the device produces. Never wait for better.
 *
 * WHY FIRST AND NOT BEST
 * ----------------------
 * The previous strategy watched for up to 8 s and kept the most accurate fix,
 * finishing early only at <= ACCURACY_GOOD_M. On a phone that locks GPS quickly
 * that is nearly free — but on the devices drivers actually complain about, it
 * never hits the early exit, so every single capture paid the full window. The
 * component then retried with a LONGER window on a wide fix (8 s, then 16 s,
 * then 24 s, plus back-off), so a driver standing at a door with a parcel in
 * their hand could wait the better part of a minute before the button did
 * anything. That cost is paid on every delivery; the accuracy it buys matters
 * on the small fraction that are ever disputed.
 *
 * Taking the first fix does not lose the evidence, because accuracy was never
 * a gate — it is metadata. `classifyAccuracy` still labels it, the payload
 * still carries the metres, and the server's verdict ladder
 * (tracking/services/pod_location.evaluate) still records `good` / `degraded` /
 * `rejected` / `off_area` for the admin. The Nairobi record in this module's
 * header would still be caught and flagged; it would simply be flagged after a
 * fast submission instead of after a slow one.
 *
 * `geolocation` is injected rather than read off `navigator` so the acquisition
 * strategy is testable without a browser. That is the whole reason this
 * function is here and not in the component.
 *
 * `timeoutMs` is a ceiling, not a sampling window: a device that answers with
 * neither a position nor an error must not hang the screen forever.
 */
export function acquireFirstFix(
  geolocation,
  { timeoutMs = LOCATION_WINDOW_MS } = {},
) {
  return new Promise((resolve, reject) => {
    let settled = false;
    let watchId = null;

    const stop = () => {
      clearTimeout(timer);
      if (watchId !== null) geolocation.clearWatch(watchId);
    };

    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      stop();
      reject(new Error("no position acquired"));
    }, timeoutMs);

    watchId = geolocation.watchPosition(
      (position) => {
        if (settled) return;
        // A position with no accuracy field is still a position. It is graded
        // "unknown" downstream, which is its own verdict — waiting for a
        // second reading that may never come would be the exact delay this
        // function exists to remove.
        if (position?.coords?.latitude == null) return;
        settled = true;
        stop();
        resolve(position);
      },
      (error) => {
        if (settled) return;
        settled = true;
        stop();
        reject(error);
      },
      // enableHighAccuracy still asks the device for its best source. It is a
      // hint about WHICH sensor to use, not an instruction to wait — so it
      // costs nothing here and may improve the first reading for free.
      { enableHighAccuracy: true, timeout: timeoutMs, maximumAge: 0 },
    );
  });
}
