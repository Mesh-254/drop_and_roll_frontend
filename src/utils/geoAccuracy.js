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
 * How long to keep watching for a better fix before taking the best so far.
 * A cold GPS chip needs roughly 3-8 s. A single getCurrentPosition answers long
 * before that from WiFi/IP, which is exactly how the 374 km reading got in.
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
 * Watch for a bounded window and resolve with the BEST fix seen, not the first.
 *
 * Stops early once accuracy is at or under `goodEnoughM`, so a phone with a
 * working GPS lock does not burn the full window or the battery behind it.
 *
 * `geolocation` is injected rather than read off `navigator` so the acquisition
 * strategy is testable without a browser. That is the whole reason this
 * function is here and not in the component.
 *
 * An error AFTER a usable fix has arrived resolves with that fix instead of
 * rejecting: a late timeout on a position we already hold is not a failure, and
 * rejecting would send the driver round the retry loop for nothing.
 */
export function watchForBestFix(
  geolocation,
  { windowMs = LOCATION_WINDOW_MS, goodEnoughM = ACCURACY_GOOD_M } = {},
) {
  return new Promise((resolve, reject) => {
    let best = null;
    let settled = false;
    let watchId = null;

    const stop = () => {
      clearTimeout(timer);
      if (watchId !== null) geolocation.clearWatch(watchId);
    };

    const finish = () => {
      if (settled) return;
      settled = true;
      stop();
      if (best) resolve(best);
      else reject(new Error("no position acquired"));
    };

    const timer = setTimeout(finish, windowMs);

    watchId = geolocation.watchPosition(
      (position) => {
        if (settled) return;
        const accuracy = position?.coords?.accuracy;
        if (accuracy == null) return;
        if (best === null || accuracy < best.coords.accuracy) best = position;
        if (accuracy <= goodEnoughM) finish();
      },
      (error) => {
        if (settled) return;
        if (best !== null) {
          finish();
          return;
        }
        settled = true;
        stop();
        reject(error);
      },
      { enableHighAccuracy: true, timeout: windowMs, maximumAge: 0 },
    );
  });
}
