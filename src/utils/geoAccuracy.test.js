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
  acquireFirstFix,
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

describe("acquireFirstFix", () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  // THE CHANGE THIS FILE RECORDS
  //
  // The previous strategy watched for up to 8 s and kept the most accurate fix,
  // exiting early only at <= 50 m. On the devices drivers actually complain
  // about it never hit that exit, so every capture paid the full window — and
  // the component then retried on a wide fix with a LONGER one (8 s, 16 s,
  // 24 s). A driver at a door could wait most of a minute per delivery.
  //
  // Accuracy was never a gate, only metadata: the server's verdict ladder still
  // records good / degraded / rejected / off_area either way. So the wide fix
  // is now taken immediately and flagged, rather than the driver paying for a
  // re-measurement that usually returns the same number.

  test("resolves with the first fix, however wide", async () => {
    const geo = fakeGeolocation();
    const promise = acquireFirstFix(geo, { timeoutMs: 5000 });

    geo.emit(373816); // the Nairobi-scale network estimate
    geo.emit(8); // GPS lock lands a moment later — too late, we already went

    await expect(promise).resolves.toMatchObject({
      coords: { accuracy: 373816 },
    });
  });

  test("does not wait for a better fix when the first is already good", async () => {
    const geo = fakeGeolocation();
    const promise = acquireFirstFix(geo, { timeoutMs: 30000 });

    geo.emit(10);
    await promise;

    // Settled without burning the window or leaving the GPS radio on.
    expect(geo.cleared).toEqual([42]);
  });

  test("resolves immediately without advancing any timer", async () => {
    // The guarantee that matters to the driver: no part of the happy path is
    // gated on a clock. If this ever needs jest.advanceTimersByTime to pass,
    // a wait has been reintroduced.
    const geo = fakeGeolocation();
    const promise = acquireFirstFix(geo, { timeoutMs: 8000 });

    geo.emit(120);

    await expect(promise).resolves.toMatchObject({ coords: { accuracy: 120 } });
  });

  test("a position with no accuracy is still a position", async () => {
    // Graded "unknown" downstream, which is its own verdict. Waiting for a
    // second reading that may never come is the exact delay being removed.
    const geo = fakeGeolocation();
    const promise = acquireFirstFix(geo, { timeoutMs: 5000 });

    geo.emit(undefined);

    await expect(promise).resolves.toMatchObject({
      coords: { latitude: 51.9 },
    });
  });

  test("an error before any fix rejects", async () => {
    const geo = fakeGeolocation();
    const promise = acquireFirstFix(geo, { timeoutMs: 5000 });

    geo.fail(1); // PERMISSION_DENIED
    await expect(promise).rejects.toMatchObject({ code: 1 });
  });

  test("a device that answers with nothing rejects rather than hanging", async () => {
    // The timeout is a ceiling, not a sampling window: some devices produce
    // neither a position nor an error, and the screen must not hang forever.
    const geo = fakeGeolocation();
    const promise = acquireFirstFix(geo, { timeoutMs: 5000 });

    jest.advanceTimersByTime(5000);
    await expect(promise).rejects.toThrow("no position acquired");
  });

  test("the watch is always cleared", async () => {
    // A leaked watchPosition keeps the GPS radio on for the rest of the session.
    const geo = fakeGeolocation();
    const promise = acquireFirstFix(geo, { timeoutMs: 5000 });
    jest.advanceTimersByTime(5000);
    await expect(promise).rejects.toThrow();

    expect(geo.cleared).toEqual([42]);
  });

  test("a late reading after resolution is ignored", async () => {
    const geo = fakeGeolocation();
    const promise = acquireFirstFix(geo, { timeoutMs: 5000 });

    geo.emit(200);
    const settled = await promise;
    geo.emit(5); // arrives after we already resolved

    expect(settled.coords.accuracy).toBe(200);
  });
});
