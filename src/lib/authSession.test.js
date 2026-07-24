/* eslint-env jest */
// Pass 1 (session expiry): the centralized coordination module. Covers the
// debounce (concurrent 401s → one cycle), route capture/return, cross-tab
// broadcast, and re-arm-after-login behaviour.

import {
  markSessionExpired,
  wasSessionExpired,
  consumeRedirectPath,
  resetExpiryGuard,
  captureCurrentPath,
  SESSION_EXPIRED_EVENT,
  AUTH_BROADCAST_KEY,
} from "./authSession";

beforeEach(() => {
  sessionStorage.clear();
  localStorage.clear();
  resetExpiryGuard(); // clear the in-tab debounce between tests
  window.history.pushState({}, "", "/bulk-upload?tab=net");
});

test("captureCurrentPath returns path + query string", () => {
  expect(captureCurrentPath()).toBe("/bulk-upload?tab=net");
});

test("markSessionExpired captures route, writes the cross-tab broadcast, and fires ONCE for a burst", () => {
  const handler = jest.fn();
  window.addEventListener(SESSION_EXPIRED_EVENT, handler);

  markSessionExpired();
  markSessionExpired(); // concurrent 401s — must be debounced
  markSessionExpired();

  expect(handler).toHaveBeenCalledTimes(1);
  expect(wasSessionExpired()).toBe(true);
  expect(sessionStorage.getItem("post_login_redirect")).toBe("/bulk-upload?tab=net");
  expect(JSON.parse(localStorage.getItem(AUTH_BROADCAST_KEY)).type).toBe("logout");

  window.removeEventListener(SESSION_EXPIRED_EVENT, handler);
});

test("a login/register route is NOT captured as the return target", () => {
  window.history.pushState({}, "", "/login");
  markSessionExpired();
  expect(sessionStorage.getItem("post_login_redirect")).toBeNull();
});

test("consumeRedirectPath returns the captured path and clears both keys", () => {
  markSessionExpired();
  expect(consumeRedirectPath()).toBe("/bulk-upload?tab=net");
  expect(wasSessionExpired()).toBe(false);
  expect(sessionStorage.getItem("post_login_redirect")).toBeNull();
});

test("resetExpiryGuard re-arms so a FUTURE expiry fires again", () => {
  const handler = jest.fn();
  window.addEventListener(SESSION_EXPIRED_EVENT, handler);

  markSessionExpired();
  resetExpiryGuard(); // e.g. after a successful re-login
  markSessionExpired();

  expect(handler).toHaveBeenCalledTimes(2);
  window.removeEventListener(SESSION_EXPIRED_EVENT, handler);
});

test("resetExpiryGuard clears a stale redirect key so the next expiry captures fresh", () => {
  markSessionExpired(); // captures /bulk-upload...
  resetExpiryGuard(); // admin-bridge login path never consumes it
  window.history.pushState({}, "", "/driver-dashboard");
  markSessionExpired();
  expect(sessionStorage.getItem("post_login_redirect")).toBe("/driver-dashboard");
});
