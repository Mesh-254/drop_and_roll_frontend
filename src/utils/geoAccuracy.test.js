/**
 * Geolocation accuracy rules.
 *
 * THE RECORD THIS EXISTS TO PREVENT
 * ---------------------------------
 * A real proof of delivery stored:
 *   {"lat": -1.2920659, "lng": 36.8219462, "accuracy": 373816.1159124061}
 * Nairobi city centre, 374 km wide, on a UK-only (MK/OX) operation. That is the
 * browser's WiFi/IP estimate, which is what Chrome returns on a desktop with no
 * GPS. Nothing miscalculated — the system accepted a fix it should have refused,
 * and then rendered it as a pin, which looks exactly like a good one.
 *
 * Two independent defects fed it: taking the FIRST position rather than the best
 * one, and never checking the error radius at all.
 */

import {
  ACCURACY_GOOD_M,
  ACCURACY_MAX_M,
  classifyAccuracy,
  exifHorizontalError,
  formatAccuracy,
  isUsableAccuracy,
  watchForBestFix,
} from "./geoAccuracy";

// ── The specific record ─────────────────────────────────────────────────────

describe("the Nairobi record", () => {
  const NAIROBI_ACCURACY = 373816.1159124061;

  test("is rejected outright", () => {
    expect(classifyAccuracy(NAIROBI_ACCURACY)).toBe("rejected");
    expect(isUsableAccuracy(NAIROBI_ACCURACY)).toBe(false);
  });

  test("reads as kilometres so nobody mistakes it for a good fix", () => {
    // "373816 m" scans as a number. "373.8 km" scans as obviously wrong, which
    // is the entire job of the string an admin actually looks at.
    expect(formatAccuracy(NAIROBI_ACCURACY)).toBe("373.8 km");
  });
});

// ── Classification ──────────────────────────────────────────────────────────

describe("classifyAccuracy", () => {
  test.each([
    [5, "good"],
    [ACCURACY_GOOD_M, "good"],
    [ACCURACY_GOOD_M + 0.1, "degraded"],
    [ACCURACY_MAX_M, "degraded"],
    [ACCURACY_MAX_M + 0.1, "rejected"],
    [50000, "rejected"],
  ])("%d m is %s", (accuracy, expected) => {
    expect(classifyAccuracy(accuracy)).toBe(expected);
  });

  test("unknown is its own answer, not folded into good or bad", () => {
    // A photo with coordinates but no error tag is UNVERIFIABLE. Calling that
    // "good" trusts a number nobody measured; calling it "rejected" throws away
    // the only location a driver could produce indoors.
    expect(classifyAccuracy(null)).toBe("unknown");
    expect(classifyAccuracy(undefined)).toBe("unknown");
    expect(classifyAccuracy(NaN)).toBe("unknown");
    expect(isUsableAccuracy(null)).toBe(true);
  });
});

describe("formatAccuracy", () => {
  test.each([
    [12.4381, "12 m"],
    [0, "0 m"],
    [999, "999 m"],
    [1000, "1.0 km"],
    [2500, "2.5 km"],
  ])("%p renders as %s", (metres, expected) => {
    expect(formatAccuracy(metres)).toBe(expected);
  });

  test("missing accuracy says so rather than rendering NaN", () => {
    expect(formatAccuracy(null)).toBe("unknown");
    expect(formatAccuracy(undefined)).toBe("unknown");
  });
});

// ── EXIF ────────────────────────────────────────────────────────────────────

describe("exifHorizontalError", () => {
  test("reads the horizontal error when the camera wrote one", () => {
    expect(exifHorizontalError({ GPSHPositioningError: 8 })).toBe(8);
  });

  test("never invents a value when the tag is absent", () => {
    // The old code was `exif.gpsAltitudeAccuracy || 10`, which fabricated a 10 m
    // precision for every photo carrying neither tag — a made-up accuracy that
    // outranked every real GPS reading in the system.
    expect(exifHorizontalError({})).toBeNull();
    expect(exifHorizontalError(null)).toBeNull();
    expect(exifHorizontalError(undefined)).toBeNull();
  });

  test("ignores altitude accuracy, which is a different axis", () => {
    expect(exifHorizontalError({ gpsAltitudeAccuracy: 3 })).toBeNull();
  });

  test("ignores a non-numeric tag", () => {
    expect(
      exifHorizontalError({ GPSHPositioningError: "8 metres" }),
    ).toBeNull();
  });
});

// ── Acquisition ─────────────────────────────────────────────────────────────

/** A geolocation stand-in that replays a scripted sequence of positions. */
function fakeGeolocation() {
  let successCb = null;
  let errorCb = null;
  const cleared = [];
  return {
    cleared,
    watchPosition(onSuccess, onError) {
      successCb = onSuccess;
      errorCb = onError;
      return 42;
    },
    clearWatch(id) {
      cleared.push(id);
    },
    emit(accuracy, extra = {}) {
      successCb?.({
        coords: { latitude: 51.9, longitude: -0.7, accuracy, ...extra },
      });
    },
    fail(code = 3) {
      errorCb?.({ code, message: "timeout" });
    },
  };
}

describe("watchForBestFix", () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  test("keeps the best fix, not the first", async () => {
    // THE core defect. getCurrentPosition would have resolved on the 374 km
    // network estimate that arrives first, while the GPS chip was still warming
    // up and about to produce 8 m.
    const geo = fakeGeolocation();
    const promise = watchForBestFix(geo, { windowMs: 5000, goodEnoughM: 50 });

    geo.emit(373816);
    geo.emit(120);
    geo.emit(8);

    await expect(promise).resolves.toMatchObject({ coords: { accuracy: 8 } });
  });

  test("stops early once the fix is good enough", async () => {
    const geo = fakeGeolocation();
    const promise = watchForBestFix(geo, { windowMs: 30000, goodEnoughM: 50 });

    geo.emit(10);
    await promise;

    // Resolved without burning the 30 s window or the battery behind it.
    expect(geo.cleared).toEqual([42]);
  });

  test("takes the best available when the window expires", async () => {
    const geo = fakeGeolocation();
    const promise = watchForBestFix(geo, { windowMs: 5000, goodEnoughM: 50 });

    geo.emit(140); // usable, but never reaches "good"
    jest.advanceTimersByTime(5000);

    await expect(promise).resolves.toMatchObject({ coords: { accuracy: 140 } });
  });

  test("a later, worse reading does not overwrite a better one", async () => {
    const geo = fakeGeolocation();
    const promise = watchForBestFix(geo, { windowMs: 5000, goodEnoughM: 5 });

    geo.emit(60);
    geo.emit(900); // drove into a tunnel
    jest.advanceTimersByTime(5000);

    await expect(promise).resolves.toMatchObject({ coords: { accuracy: 60 } });
  });

  test("an error after a usable fix resolves rather than rejecting", async () => {
    // A late timeout on a position we already hold is not a failure. Rejecting
    // would send the driver round the retry loop for a fix already in hand.
    const geo = fakeGeolocation();
    const promise = watchForBestFix(geo, { windowMs: 5000 });

    geo.emit(30);
    geo.fail();

    await expect(promise).resolves.toMatchObject({ coords: { accuracy: 30 } });
  });

  test("an error with no fix at all rejects", async () => {
    const geo = fakeGeolocation();
    const promise = watchForBestFix(geo, { windowMs: 5000 });

    geo.fail(1); // PERMISSION_DENIED
    await expect(promise).rejects.toMatchObject({ code: 1 });
  });

  test("a window that produces nothing rejects rather than hanging", async () => {
    const geo = fakeGeolocation();
    const promise = watchForBestFix(geo, { windowMs: 5000 });

    jest.advanceTimersByTime(5000);
    await expect(promise).rejects.toThrow("no position acquired");
  });

  test("the watch is always cleared", async () => {
    // A leaked watchPosition keeps the GPS radio on for the rest of the session.
    const geo = fakeGeolocation();
    const promise = watchForBestFix(geo, { windowMs: 5000 });
    jest.advanceTimersByTime(5000);
    await expect(promise).rejects.toThrow();

    expect(geo.cleared).toEqual([42]);
  });

  test("positions with no accuracy are ignored, not treated as perfect", async () => {
    // `undefined < anything` is false, so a naive comparison would have kept a
    // reading with no radius and then crashed formatting it.
    const geo = fakeGeolocation();
    const promise = watchForBestFix(geo, { windowMs: 5000, goodEnoughM: 50 });

    geo.emit(undefined);
    geo.emit(20);

    await expect(promise).resolves.toMatchObject({ coords: { accuracy: 20 } });
  });
});
