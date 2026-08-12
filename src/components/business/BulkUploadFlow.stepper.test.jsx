/* eslint-env jest */
// The wizard's step indicator, and the reason it needed fixing.
//
// Each step and its trailing connector used to be one flex child with FIXED
// widths: a 32px circle, an inline label, and a `w-14` rule with `mx-2`. Five of
// those want roughly:
//
//     5 circles           160px
//     5 inline labels    ~324px  ("Review & Confirm" is 16 characters)
//     5 label gaps         40px
//     4 connectors        144px  (w-14) + 64px margins
//                        ─────
//                        ~732px
//
// The card is `max-w-2xl` (672px) with `p-4` on the backdrop and `px-6` inside,
// leaving 592px of content at ANY viewport — the cap does not grow on a large
// screen. The card is also `overflow-hidden`. So the row was clipped, and what
// got clipped was the RIGHT end: step 5, which is the step the customer is on
// by the time results exist. It is visible in the reported screenshot as a
// half-circle at the modal's edge.
//
// jsdom computes no layout, so this cannot assert pixels. It asserts the two
// structural properties that make overflow impossible regardless of how many
// steps get added later:
//
//   1. connectors FLEX (flex-1) rather than claiming a fixed width
//   2. labels are stacked under their circle, not inline beside it
//
// Arithmetic that happens to fit is what broke when a fifth step was added.

import { render, screen } from "@testing-library/react";
import { STEPS } from "./bulkUploadSteps";

jest.mock("framer-motion", () => ({
  __esModule: true,
  AnimatePresence: ({ children }) => children,
  motion: new Proxy(
    {},
    {
      get:
        (_t, tag) =>
        ({ children, ...props }) => {
          const React = require("react");
          for (const k of [
            "whileHover",
            "whileTap",
            "initial",
            "animate",
            "transition",
            "exit",
            "variants",
            "layout",
          ]) {
            delete props[k];
          }
          return React.createElement(String(tag), props, children);
        },
    },
  ),
}));

jest.mock("react-router-dom", () => ({
  __esModule: true,
  useNavigate: () => jest.fn(),
}));
jest.mock("react-hot-toast", () => ({
  __esModule: true,
  default: { success: jest.fn(), error: jest.fn() },
}));
jest.mock("../../api/BulkUploadApi", () => ({ __esModule: true, default: {} }));

const mockHookState = {
  currentStep: 0,
  latestUpload: null,
  isPolling: false,
  uploadError: null,
  reset: jest.fn(),
  setCurrentStep: jest.fn(),
};
jest.mock("../../hooks/useBulkUpload", () => ({
  __esModule: true,
  useBulkUpload: () => mockHookState,
}));

import BulkUploadFlow from "./BulkUploadFlow";

function stepper() {
  render(<BulkUploadFlow onClose={jest.fn()} onSuccess={jest.fn()} />);
  return screen.getByRole("list", { name: /upload progress/i });
}

test("the connectors flex instead of demanding a fixed width", () => {
  const el = stepper();
  const rules = [...el.children].filter(
    (c) => c.getAttribute("aria-hidden") === "true",
  );

  expect(rules).toHaveLength(STEPS.length - 1);
  for (const rule of rules) {
    expect(rule.className).toContain("flex-1");
    // The old `w-14` is what made the row wider than its container.
    expect(rule.className).not.toMatch(/\bw-\d/);
  }
});

test("labels stack under their circle rather than beside it", () => {
  const el = stepper();
  const items = [...el.querySelectorAll('[role="listitem"]')];

  expect(items).toHaveLength(STEPS.length);
  for (const item of items) {
    expect(item.className).toContain("flex-col");
  }
});

test("every step is rendered, including the last one", () => {
  // The specific regression: five steps existed, four were fully visible.
  const el = stepper();
  expect(el.querySelectorAll('[role="listitem"]')).toHaveLength(STEPS.length);
  expect(screen.getByText(STEPS[STEPS.length - 1].label)).toBeInTheDocument();
});

test("the steps never claim more fixed width than the modal has", () => {
  // 592px of content at any viewport. The circles are the only fixed width
  // left, and they must fit with room for the rules between them.
  const el = stepper();
  const items = [...el.querySelectorAll('[role="listitem"]')];

  // w-8 (32px) on mobile, sm:w-20 (80px) once labels appear.
  for (const item of items) expect(item.className).toMatch(/\bw-8\b/);
  expect(items.length * 80).toBeLessThan(592);
});

test("the current step is announced, not only coloured", () => {
  const el = stepper();
  const current = el.querySelectorAll('[aria-current="step"]');
  expect(current).toHaveLength(1);
});
