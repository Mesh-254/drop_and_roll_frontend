/* eslint-env jest */
// Part 3 (live-tracking refresh survival): the localStorage flag that lets a page
// refresh auto-resume tracking without a re-tap, plus the env-derived WS URL.

import driverApi from "./driver-api";

const FLAG = "dnr_live_tracking_active";

beforeEach(() => {
  localStorage.clear();
});

test("markLiveTrackingActive sets the flag and isLiveTrackingActive reads it", () => {
  expect(driverApi.isLiveTrackingActive()).toBe(false);
  driverApi.markLiveTrackingActive();
  expect(localStorage.getItem(FLAG)).not.toBeNull();
  expect(driverApi.isLiveTrackingActive()).toBe(true);
});

test("clearLiveTrackingActive removes the flag (explicit stop / logout)", () => {
  driverApi.markLiveTrackingActive();
  driverApi.clearLiveTrackingActive();
  expect(localStorage.getItem(FLAG)).toBeNull();
  expect(driverApi.isLiveTrackingActive()).toBe(false);
});

test("a stale flag (older than the 5min TTL) reads inactive and is purged", () => {
  // 6 minutes ago — past LIVE_TRACKING_TTL_MS.
  localStorage.setItem(FLAG, String(Date.now() - 6 * 60 * 1000));
  expect(driverApi.isLiveTrackingActive()).toBe(false);
  expect(localStorage.getItem(FLAG)).toBeNull(); // purged on read
});

test("a garbage flag value reads inactive and is purged", () => {
  localStorage.setItem(FLAG, "not-a-number");
  expect(driverApi.isLiveTrackingActive()).toBe(false);
  expect(localStorage.getItem(FLAG)).toBeNull();
});

test("driverWsUrl builds an http→ws URL with the current access token", () => {
  localStorage.setItem("access_token", "TОKEN123".replace("О", "O")); // ascii token
  const url = driverApi.driverWsUrl("abc-123");
  // import.meta.env is {} under jest → falls back to http://127.0.0.1:8000 → ws://
  expect(url).toBe("ws://127.0.0.1:8000/ws/driver/abc-123/?token=TOKEN123");
});
