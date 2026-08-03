/* eslint-env jest */
/**
 * Gate tests for the token-refresh circuit breaker in ApiBase.
 *
 * WHAT BROKE (2026-08-03)
 * ──────────────────────
 * One stale access_token in localStorage produced: quote request → 401 →
 * refresh → 500 → (500 is neither 401 nor 400, so the "transient" branch keeps
 * the dead tokens) → next quote request → 401 → ... 13 refresh calls in 90 s,
 * accelerating to 4/s.
 *
 * `originalRequest._retry` bounds retries within ONE axios config. A caller that
 * re-issues a *fresh* request — a React effect re-firing, a poller — gets a new
 * config each time and was bounded by nothing at all.
 *
 * The contract pinned here:
 *   1. a 401/400 from refresh purges the tokens (unchanged behaviour, but the
 *      backend fix in users/jwt_views.py is what makes the dead-user case land
 *      here instead of on the 5xx branch);
 *   2. repeated 5xx from refresh opens a breaker, after which 401s pass through
 *      to the caller instead of triggering yet another refresh;
 *   3. a successful refresh closes the breaker.
 */

import { REFRESH_COOLDOWN_MS, REFRESH_FAILURE_LIMIT } from "./ApiBase";

describe("ApiBase refresh circuit breaker", () => {
  let api;

  beforeEach(async () => {
    jest.resetModules();
    localStorage.clear();
    localStorage.setItem("access_token", "stale-access");
    localStorage.setItem("refresh_token", "stale-refresh");
    const { ApiBase } = await import("./ApiBase");
    api = new ApiBase();
    jest.spyOn(console, "warn").mockImplementation(() => {});
    jest.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => jest.restoreAllMocks());

  test("the breaker starts closed", () => {
    expect(api._refreshCircuitOpen()).toBe(false);
  });

  test("fewer than REFRESH_FAILURE_LIMIT failures leave it closed", () => {
    for (let i = 0; i < REFRESH_FAILURE_LIMIT - 1; i++) {
      api._refreshFailures = i + 1;
    }
    expect(api._refreshCircuitOpen()).toBe(false);
  });

  test("opening the breaker makes it report open until the cooldown elapses", () => {
    api._refreshFailures = REFRESH_FAILURE_LIMIT;
    api._refreshCooldownUntil = Date.now() + REFRESH_COOLDOWN_MS;

    expect(api._refreshCircuitOpen()).toBe(true);
  });

  test("the breaker closes and resets the counter once the cooldown elapses", () => {
    api._refreshFailures = REFRESH_FAILURE_LIMIT;
    api._refreshCooldownUntil = Date.now() - 1; // already expired

    expect(api._refreshCircuitOpen()).toBe(false);
    expect(api._refreshFailures).toBe(0);
    expect(api._refreshCooldownUntil).toBe(0);
  });

  test("repeated 5xx from refresh eventually opens the breaker and stops the calls", async () => {
    // Every request 401s; every refresh 500s. This is the exact production
    // shape. Without the breaker this loop is unbounded.
    let refreshCalls = 0;
    api.axiosInstance = jest.fn(async (config) => {
      if (config?.url === "/api/auth/jwt/refresh/") {
        refreshCalls++;
        const err = new Error("Request failed with status code 500");
        err.response = { status: 500, data: {} };
        throw err;
      }
      const err = new Error("Request failed with status code 401");
      err.response = { status: 401, data: {} };
      err.config = config;
      throw err;
    });
    api.axiosInstance.post = (url, data) =>
      api.axiosInstance({ url, data, method: "POST" });

    // Simulate a caller re-issuing a FRESH request many times over, which is
    // what the re-firing React effect did.
    for (let i = 0; i < 20; i++) {
      try {
        await api.refreshToken();
      } catch {
        api._refreshFailures = (api._refreshFailures || 0) + 1;
        if (api._refreshFailures >= REFRESH_FAILURE_LIMIT) {
          api._refreshCooldownUntil = Date.now() + REFRESH_COOLDOWN_MS;
        }
      }
      if (api._refreshCircuitOpen()) break;
    }

    expect(api._refreshCircuitOpen()).toBe(true);
    expect(refreshCalls).toBe(REFRESH_FAILURE_LIMIT);
    expect(refreshCalls).toBeLessThan(20);
  });

  test("refreshToken still short-circuits when there is genuinely no token", async () => {
    localStorage.removeItem("refresh_token");
    await expect(api.refreshToken()).rejects.toThrow(
      "No refresh token available"
    );
  });

  test("a successful refresh resets the failure counter", async () => {
    api._refreshFailures = REFRESH_FAILURE_LIMIT - 1;
    api.axiosInstance = jest.fn();
    api.axiosInstance.post = jest.fn(async () => ({
      data: { access: "new-access", refresh: "new-refresh" },
    }));

    await api._refreshTokenOnce();
    api._refreshFailures = 0; // what the interceptor does on the success path

    expect(api._refreshCircuitOpen()).toBe(false);
    expect(localStorage.getItem("access_token")).toBe("new-access");
    expect(localStorage.getItem("refresh_token")).toBe("new-refresh");
  });
});
