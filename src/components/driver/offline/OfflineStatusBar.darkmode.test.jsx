/* eslint-env jest */
// Regression: the "Work Offline" popup card (DurationMenu) and the status
// banner shipped with ZERO dark-mode variants — a bare `bg-white` card with
// faint gray text that was effectively invisible against the driver
// dashboard in dark mode, and a low-contrast trigger in both themes.
//
// HOW THE PROOF CHANGED. The original fix was to pair each raw colour with a
// `dark:` variant, and these tests asserted those variants existed — a missing
// `dark:` WAS the bug, so its presence was the evidence. The theme migration
// replaces that with something stronger: these surfaces now name semantic tokens,
// which cannot be missing a dark variant, because the token itself is what knows
// what to be in each theme.
//
// So the assertions moved from "has a dark: twin" to "names a token and no raw
// colour". That is a superset of the old guarantee: the old bug was a raw colour
// with no twin, and a raw colour is now forbidden outright. The actual contrast
// of each token is proven once, centrally, in src/styles/themeContrast.test.js
// rather than re-asserted per component.

/** A raw palette colour, i.e. one that renders identically in both themes. */
const RAW_COLOUR =
  /\b(?:dark:)?(?:bg|text|border)-(?:white|black|gray|slate|zinc|orange|red|green|blue|amber|yellow)(?:-\d{2,3})?(?:\/\d{1,3})?\b/;

import { render, screen, fireEvent, act } from "@testing-library/react";

// The component subscribes to the offline stack on mount. Stub each module to
// the minimal surface it touches so we can drive UI state deterministically.
let modeSubscriber = null;
jest.mock("../../../offline/workOfflineMode", () => ({
  workOfflineMode: {
    subscribe: (cb) => {
      modeSubscriber = cb;
      cb(null); // start: no manual offline window
      return () => {};
    },
    enable: jest.fn(),
    disable: jest.fn(),
  },
}));

jest.mock("../../../offline/network", () => ({
  watchConnectivity: (cb) => {
    cb(true); // start: online
    return () => {};
  },
}));

jest.mock("../../../offline/syncEngine", () => ({
  subscribe: () => () => {},
  flush: jest.fn(),
}));

jest.mock("../../../offline/offlineQueueManager", () => ({
  getPendingCount: jest.fn().mockResolvedValue(0),
  getPermanentFailures: jest.fn().mockResolvedValue([]),
  discardAction: jest.fn(),
}));

jest.mock("react-hot-toast", () => ({
  toast: Object.assign(jest.fn(), { success: jest.fn() }),
}));

import { OfflineStatusBar } from "./OfflineStatusBar";

async function renderBar() {
  let utils;
  await act(async () => {
    utils = render(<OfflineStatusBar />);
  });
  return utils;
}

test("idle trigger button is readable in both themes", async () => {
  await renderBar();
  const trigger = screen.getByRole("button", { name: /work offline/i });
  // A foreground token, not the old text-gray-600 dark:text-gray-300 pair.
  expect(trigger.className).toMatch(/text-muted-foreground/);
  expect(trigger.className).not.toMatch(RAW_COLOUR);
});

test("the Work Offline popup card renders on both themes", async () => {
  await renderBar();
  fireEvent.click(screen.getByRole("button", { name: /work offline/i }));

  // The DurationMenu is tagged data-duration-menu — this is the "invisible
  // card" from the report.
  const card = document.querySelector("[data-duration-menu]");
  expect(card).not.toBeNull();
  // One background token replaces the bg-white + dark:bg-gray-800 pair, so the
  // card cannot be left with a background for only one theme.
  expect(card.className).toMatch(/\bbg-(?:card|popover|surface)\b/);
  expect(card.className).toMatch(/\bborder-border\b/);
  expect(card.className).not.toMatch(RAW_COLOUR);

  // Its duration options must carry readable text on either surface too.
  const option = screen.getByRole("button", { name: /30 minutes/i });
  expect(option.className).toMatch(/text-(?:foreground|muted-foreground)/);
  expect(option.className).not.toMatch(RAW_COLOUR);
});

test("the status banner uses the warning role, so it themes with everything else", async () => {
  await renderBar();
  // Enter manual offline mode so the banner (not the idle trigger) renders.
  await act(async () => {
    modeSubscriber(Date.now() + 30 * 60000);
  });

  const banner = screen.getByText(/work offline mode/i).closest("div");
  // Was bg-amber-50 + dark:bg-amber-950/50 + dark:text-amber-100. The warning
  // tokens carry both themes, and the pair collapsed to one class each.
  expect(banner.className).toMatch(/bg-warning-surface/);
  expect(banner.className).not.toMatch(RAW_COLOUR);
});
