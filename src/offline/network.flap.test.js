/* eslint-env jest */
// Part 2 (flap protection): watchConnectivity must require N consecutive checks
// before flipping, so a single flaky heartbeat doesn't churn the job list.

import { watchConnectivity } from "./network";

function setOnline(v) {
  Object.defineProperty(navigator, "onLine", { value: v, configurable: true });
}

beforeEach(() => {
  jest.useFakeTimers();
  setOnline(true);
  // fetch → ok:true means the heartbeat says "online". navigator.onLine === false
  // short-circuits isOnline() to false before any fetch.
  global.fetch = jest.fn().mockResolvedValue({ ok: true });
});

afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
});

// Let queued microtasks (the async isOnline()) settle between timer steps.
async function flush() {
  await Promise.resolve();
  await Promise.resolve();
}

test("first observed state is reported immediately", async () => {
  const onChange = jest.fn();
  const stop = watchConnectivity(onChange, { confirmations: 2 });
  await flush();
  expect(onChange).toHaveBeenCalledTimes(1);
  expect(onChange).toHaveBeenLastCalledWith(true);
  stop();
});

test("a single offline blip that recovers does NOT fire an offline change", async () => {
  const onChange = jest.fn();
  const stop = watchConnectivity(onChange, { confirmations: 2, confirmDelayMs: 3000 });
  await flush(); // initial → online

  // One flaky offline reading.
  setOnline(false);
  window.dispatchEvent(new Event("offline"));
  await flush(); // streak=1 (<2) → schedules a confirm check, no fire yet

  // Blip resolves before the confirm fires.
  setOnline(true);
  jest.advanceTimersByTime(3000);
  await flush(); // confirm sees online === lastFired → resets, still no offline fire

  const calls = onChange.mock.calls.map((c) => c[0]);
  expect(calls).toEqual([true]); // only the initial online, never false
  stop();
});

test("a sustained offline state fires exactly once after confirmation", async () => {
  const onChange = jest.fn();
  const stop = watchConnectivity(onChange, { confirmations: 2, confirmDelayMs: 3000 });
  await flush(); // initial → online

  setOnline(false);
  window.dispatchEvent(new Event("offline"));
  await flush(); // streak=1, schedules confirm

  jest.advanceTimersByTime(3000);
  await flush(); // confirm: still offline → streak=2 → fires false

  const calls = onChange.mock.calls.map((c) => c[0]);
  expect(calls).toEqual([true, false]);
  stop();
});
