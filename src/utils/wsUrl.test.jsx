/* eslint-env jest */
// Regression test for the admin live-tracking WS URL. The dashboard previously hardcoded
// `ws://127.0.0.1:8000/ws/tracking/`, which silently broke in production (https origin
// needs wss, and the host is never localhost there). This locks the env-derived behaviour.

import { httpBaseToWs, trackingWsUrl } from "./wsUrl";

test("http base downgrades to ws", () => {
  expect(httpBaseToWs("http://127.0.0.1:8000")).toBe("ws://127.0.0.1:8000");
});

test("https base upgrades to wss (the prod case the hardcoded URL got wrong)", () => {
  expect(httpBaseToWs("https://api.dropnroll.co.uk")).toBe(
    "wss://api.dropnroll.co.uk",
  );
});

test("empty / undefined base falls back to localhost http→ws (jest + local dev)", () => {
  expect(httpBaseToWs("")).toBe("ws://127.0.0.1:8000");
  expect(httpBaseToWs(undefined)).toBe("ws://127.0.0.1:8000");
});

test("trackingWsUrl appends the /ws/tracking/ path", () => {
  expect(trackingWsUrl("https://api.dropnroll.co.uk")).toBe(
    "wss://api.dropnroll.co.uk/ws/tracking/",
  );
  expect(trackingWsUrl("")).toBe("ws://127.0.0.1:8000/ws/tracking/");
});
