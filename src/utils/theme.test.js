/* eslint-env jest */
// The app has one theme, and these are the two ways that stops being true:
// someone re-adds a toggle, or a user who pressed the old one is left with
// `theme: "light"` in localStorage and no code path that clears it.
//
// Why it matters is not aesthetic. `scripts/audit_theme.mjs` reports that NOT
// ONE file in src/ flips cleanly — every file with `dark:` pairs also carries
// unpaired dark-only utilities, and `body` is unconditionally `bg-black
// text-white`. Dropping the `.dark` class does not render a light app; it
// renders half of each, per screen.

import { applyAppTheme } from "./theme";

beforeEach(() => {
  window.localStorage.clear();
  document.documentElement.className = "";
});

test("the dark class is asserted", () => {
  applyAppTheme();
  expect(document.documentElement.classList.contains("dark")).toBe(true);
});

test("a stale light preference is cleared, not honoured", () => {
  // Exactly the state a user who pressed the old toggle is left in.
  window.localStorage.setItem("theme", "light");

  expect(applyAppTheme()).toBe(true);

  expect(window.localStorage.getItem("theme")).toBeNull();
  expect(document.documentElement.classList.contains("dark")).toBe(true);
});

test("a user who never touched the toggle is not reported as repaired", () => {
  expect(applyAppTheme()).toBe(false);
});

test("it is idempotent — one dark class, however many boots", () => {
  applyAppTheme();
  applyAppTheme();
  applyAppTheme();
  expect(document.documentElement.className.match(/dark/g)).toHaveLength(1);
});

test("it survives storage being unavailable", () => {
  // Private browsing throws on access rather than returning null.
  const original = Object.getOwnPropertyDescriptor(window, "localStorage");
  Object.defineProperty(window, "localStorage", {
    configurable: true,
    get() {
      throw new Error("access denied");
    },
  });

  expect(() => applyAppTheme()).not.toThrow();
  expect(document.documentElement.classList.contains("dark")).toBe(true);

  if (original) Object.defineProperty(window, "localStorage", original);
});
