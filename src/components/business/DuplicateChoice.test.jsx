/* eslint-env jest */
// The retry-vs-new-batch question on the confirm step.
//
// A business re-uploads a file that looks like a previous one for two opposite
// reasons: fixing bad rows (skip the ones that already worked) or sending a
// second batch of the same route (book them all). Nothing in the file tells
// those apart, so the wizard asks — but only when there is something to ask
// about.
//
// Pinned here:
//   1. No matches → no question. The common case stays silent.
//   2. Matches → both options offered, "skip" preselected (the safe default:
//      a needless skip is re-runnable, a needless booking is a real charge).
//   3. Booking again says plainly that it will be charged for.
//   4. The within-file rule is stated, because the choice does NOT govern it.
//
// The wiring from this choice through to the request is covered separately in
// useBulkUpload.test.jsx and BulkUploadApi.duplicatePolicy.test.js.

import { render, screen, fireEvent } from "@testing-library/react";

jest.mock("react-router-dom", () => ({
  __esModule: true,
  useNavigate: () => jest.fn(),
}));

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

jest.mock("react-hot-toast", () => ({
  __esModule: true,
  default: { success: jest.fn(), error: jest.fn() },
}));

import { DuplicateChoice } from "./BulkUploadFlow";

test("no duplicates means no question is asked", () => {
  const { container } = render(
    <DuplicateChoice
      count={0}
      references={[]}
      policy="skip"
      onChange={jest.fn()}
    />,
  );

  expect(container).toBeEmptyDOMElement();
});

test("duplicates surface both options with skip preselected", () => {
  render(
    <DuplicateChoice
      count={12}
      references={[
        "VALID-STD-02",
        "VALID-STD-03",
        "VALID-STD-05",
        "VALID-STD-06",
      ]}
      policy="skip"
      onChange={jest.fn()}
    />,
  );

  expect(screen.getByText(/12 references already booked/i)).toBeInTheDocument();
  // File order, capped at three, with an honest count of the remainder.
  expect(
    screen.getByText(/VALID-STD-02, VALID-STD-03, VALID-STD-05, \+9 more/),
  ).toBeInTheDocument();

  expect(screen.getByRole("radio", { name: /Skip them/i })).toBeChecked();
  expect(
    screen.getByRole("radio", { name: /Book them again/i }),
  ).not.toBeChecked();
});

test("the singular case reads as one reference, not '1 references'", () => {
  render(
    <DuplicateChoice
      count={1}
      references={["ORDER-9"]}
      policy="skip"
      onChange={jest.fn()}
    />,
  );

  expect(screen.getByText(/1 reference already booked/i)).toBeInTheDocument();
  expect(
    screen.getByText(/This reference matches a booking/i),
  ).toBeInTheDocument();
});

test("choosing book-again reports the choice up", () => {
  const onChange = jest.fn();
  render(
    <DuplicateChoice
      count={2}
      references={["A", "B"]}
      policy="skip"
      onChange={onChange}
    />,
  );

  fireEvent.click(screen.getByRole("radio", { name: /Book them again/i }));

  expect(onChange).toHaveBeenCalledWith("book_again");
});

test("book-again states that every duplicate will be charged for", () => {
  render(
    <DuplicateChoice
      count={2}
      references={["A", "B"]}
      policy="book_again"
      onChange={jest.fn()}
    />,
  );

  expect(screen.getByRole("radio", { name: /Book them again/i })).toBeChecked();
  expect(screen.getByText(/charged for all of them/i)).toBeInTheDocument();
});

test("the within-file rule is stated, since the choice does not govern it", () => {
  render(
    <DuplicateChoice
      count={2}
      references={["A", "B"]}
      policy="skip"
      onChange={jest.fn()}
    />,
  );

  expect(
    screen.getByText(/repeated twice inside this one file is always skipped/i),
  ).toBeInTheDocument();
});

test("a short duplicate list is shown in full with no '+N more'", () => {
  render(
    <DuplicateChoice
      count={2}
      references={["A-1", "B-2"]}
      policy="skip"
      onChange={jest.fn()}
    />,
  );

  expect(screen.getByText("A-1, B-2")).toBeInTheDocument();
});
