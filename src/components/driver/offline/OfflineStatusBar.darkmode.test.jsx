/* eslint-env jest */
// Regression: the "Work Offline" popup card (DurationMenu) and the status
// banner shipped with ZERO dark-mode variants — a bare `bg-white` card with
// faint gray text that was effectively invisible against the driver
// dashboard in dark mode, and a low-contrast trigger in both themes.
//
// This locks the fix: every surface a driver can see must carry an explicit
// `dark:` background so it renders on both themes. We assert on the class
// strings rather than computed styles because jsdom doesn't run Tailwind — the
// missing `dark:` variant IS the bug, so its presence is the proof.

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
  // Light: darker gray for contrast on white. Dark: explicit light text.
  expect(trigger.className).toMatch(/dark:text-gray-300/);
  expect(trigger.className).toMatch(/text-gray-600/);
});

test("the Work Offline popup card has an explicit dark background", async () => {
  await renderBar();
  fireEvent.click(screen.getByRole("button", { name: /work offline/i }));

  // The DurationMenu is tagged data-duration-menu — this is the "invisible
  // card" from the report.
  const card = document.querySelector("[data-duration-menu]");
  expect(card).not.toBeNull();
  expect(card.className).toMatch(/\bbg-white\b/); // light theme
  expect(card.className).toMatch(/dark:bg-gray-800/); // dark theme, was missing
  expect(card.className).toMatch(/dark:border-gray-700/);

  // Its duration options must carry readable text on the dark surface too.
  const option = screen.getByRole("button", { name: /30 minutes/i });
  expect(option.className).toMatch(/dark:text-gray-200/);
  expect(option.className).toMatch(/dark:hover:bg-gray-700/);
});

test("the status banner carries a dark variant for every state color", async () => {
  await renderBar();
  // Enter manual offline mode so the banner (not the idle trigger) renders.
  await act(async () => {
    modeSubscriber(Date.now() + 30 * 60000);
  });

  const banner = screen.getByText(/work offline mode/i).closest("div");
  expect(banner.className).toMatch(/bg-amber-50/); // light
  expect(banner.className).toMatch(/dark:bg-amber-950\/50/); // dark, was missing
  expect(banner.className).toMatch(/dark:text-amber-100/);
});
