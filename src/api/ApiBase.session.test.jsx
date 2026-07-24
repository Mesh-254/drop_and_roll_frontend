/* eslint-env jest */
// Pass 1 (session expiry): ApiBase refresh fixes — rotated-token persistence
// and single-flight de-duplication. These are the two bugs that broke sessions:
// the rotated refresh token was dropped, and concurrent 401s stampeded refresh.

import { ApiBase } from "./ApiBase";

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
});

test("refreshToken returns BOTH the new access and the rotated refresh token", async () => {
  const api = new ApiBase();
  localStorage.setItem("refresh_token", "old-refresh");
  api.axiosInstance.post = jest
    .fn()
    .mockResolvedValue({ data: { access: "A2", refresh: "R2" } });

  const out = await api.refreshToken();

  expect(out).toEqual({ access: "A2", refresh: "R2" });
  expect(api.axiosInstance.post).toHaveBeenCalledWith("/api/auth/jwt/refresh/", {
    refresh: "old-refresh",
  });
});

test("refreshToken throws when there is no stored refresh token", async () => {
  const api = new ApiBase();
  await expect(api.refreshToken()).rejects.toThrow("No refresh token available");
});

test("_refreshTokenOnce de-dupes concurrent refreshes and persists BOTH tokens", async () => {
  const api = new ApiBase();
  localStorage.setItem("refresh_token", "old-refresh");
  let calls = 0;
  api.refreshToken = jest.fn(async () => {
    calls += 1;
    return { access: "A2", refresh: "R2" };
  });

  const results = await Promise.all([
    api._refreshTokenOnce(),
    api._refreshTokenOnce(),
    api._refreshTokenOnce(),
  ]);

  expect(calls).toBe(1); // single-flight: one network refresh for the burst
  expect(results).toEqual(["A2", "A2", "A2"]);
  expect(localStorage.getItem("access_token")).toBe("A2");
  // The rotated refresh token MUST replace the (now blacklisted) old one.
  expect(localStorage.getItem("refresh_token")).toBe("R2");
});

test("a refresh after the first has settled starts a fresh flight", async () => {
  const api = new ApiBase();
  localStorage.setItem("refresh_token", "r");
  api.refreshToken = jest.fn(async () => ({ access: "A", refresh: "R" }));

  await api._refreshTokenOnce();
  await api._refreshTokenOnce();

  expect(api.refreshToken).toHaveBeenCalledTimes(2);
});
