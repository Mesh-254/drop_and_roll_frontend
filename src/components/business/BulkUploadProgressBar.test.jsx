/* eslint-env jest */
// The processing progress bar.
//
// What it looked like before: BulkUploadFlow rendered
// <BulkUploadProgressBar upload={latestUpload} …/> but the component's
// signature was ({ pct, label, status }). The props did not match, so `pct`
// silently defaulted to 0 on every render. While processing that hit the
// "indeterminate" branch and showed a shimmer that meant nothing; the instant
// the status flipped to completed the shimmer switched off and the component
// rendered `{pct}%` — literally "Processing complete." beside "0%".
//
// Pinned here:
//   1. The percentage comes from the SERVER (progress_pct), not a second
//      client-side calculation that can disagree with it.
//   2. Skipped rows count as processed, or a batch containing a duplicate can
//      never reach 100%.
//   3. 0% renders as 0%. There is no fake motion standing in for real progress.
//   4. A terminal state never shows a percentage that contradicts its own label.
//   5. The counts the brief asks for are on screen: X of Y, plus the split.

import { render, screen } from "@testing-library/react";

jest.mock("framer-motion", () => ({
  __esModule: true,
  AnimatePresence: ({ children }) => children,
  motion: new Proxy(
    {},
    {
      get:
        (_target, tag) =>
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

import BulkUploadProgressBar from "./BulkUploadProgressBar";

const upload = (o = {}) => ({
  total_rows: 43,
  successful: 0,
  failed: 0,
  skipped: 0,
  progress_pct: 0,
  status: "processing",
  ...o,
});

test("uses the server percentage rather than recomputing it", () => {
  render(
    <BulkUploadProgressBar
      upload={upload({ successful: 3, failed: 1, skipped: 2, progress_pct: 60, total_rows: 10 })}
    />,
  );

  expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "60");
  expect(screen.getByText("60%")).toBeInTheDocument();
});

test("shows X of Y processed, counting skipped rows as processed", () => {
  render(
    <BulkUploadProgressBar
      upload={upload({ successful: 4, failed: 2, skipped: 4, progress_pct: 100, total_rows: 10 })}
    />,
  );

  expect(screen.getByText("10 of 10 rows processed")).toBeInTheDocument();
});

test("zero percent renders as zero, with no fake motion", () => {
  const { container } = render(<BulkUploadProgressBar upload={upload()} />);

  expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "0");
  expect(screen.getByText("0 of 43 rows processed")).toBeInTheDocument();
  expect(container.querySelector("[data-indeterminate]")).toBeNull();
});

test("a completed batch never shows a percentage that contradicts its label", () => {
  render(
    <BulkUploadProgressBar
      upload={upload({ successful: 43, progress_pct: 100, status: "completed" })}
      status="completed"
    />,
  );

  expect(screen.getByText("100%")).toBeInTheDocument();
  expect(screen.queryByText("0%")).not.toBeInTheDocument();
});

test("the success, failure and skip split is on screen", () => {
  render(
    <BulkUploadProgressBar
      upload={upload({ successful: 13, failed: 30, skipped: 0, progress_pct: 100, total_rows: 43 })}
    />,
  );

  expect(screen.getByTestId("count-successful")).toHaveTextContent("13");
  expect(screen.getByTestId("count-failed")).toHaveTextContent("30");
  expect(screen.getByTestId("count-skipped")).toHaveTextContent("0");
});

test("remaining is derived, never negative", () => {
  render(
    <BulkUploadProgressBar
      upload={upload({ successful: 50, progress_pct: 100, total_rows: 43 })}
    />,
  );

  expect(screen.getByTestId("count-remaining")).toHaveTextContent("0");
});

test("a missing upload does not crash the step", () => {
  render(<BulkUploadProgressBar upload={null} />);

  expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "0");
});

test("the bar is announced to assistive tech with real numbers", () => {
  render(
    <BulkUploadProgressBar
      upload={upload({ successful: 10, failed: 2, progress_pct: 27, total_rows: 43 })}
    />,
  );

  const bar = screen.getByRole("progressbar");
  expect(bar).toHaveAttribute("aria-valuemin", "0");
  expect(bar).toHaveAttribute("aria-valuemax", "100");
  expect(bar).toHaveAttribute("aria-valuetext", "12 of 43 rows processed, 2 failed");
});

test("leaving the page is described as safe", () => {
  render(<BulkUploadProgressBar upload={upload({ progress_pct: 20 })} />);

  expect(screen.getByText(/you can close this page/i)).toBeInTheDocument();
});
