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
//   2. Matches → both options offered and NEITHER preselected. This changed:
//      "skip" used to be the default, which meant the system decided for the
//      customer every time. A needless skip is a parcel that never ships and
//      nobody notices; a needless booking is a real van and a real charge.
//      Neither is safe enough to pick on someone's behalf, so the wizard
//      refuses to continue until a human chooses. The backend enforces the
//      same rule independently (400 on submit with no policy), because a
//      disabled button is not a rule.
//   3. Rows matched on CONTENT say so. A customer who never typed a reference
//      would read "duplicate reference" as a system error.
//   4. The batch the rows came from is named. "You booked these before" is not
//      checkable without saying where.
//   5. Booking again says plainly that it will be charged for.
//   6. The within-file rule is stated, because the choice does NOT govern it.
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

const refRow = (n, reference) => ({
  row_number: n,
  reference,
  matched_by: "reference",
});
const fpRow = (n) => ({ row_number: n, reference: "", matched_by: "fingerprint" });

test("no duplicates means no question is asked", () => {
  const { container } = render(
    <DuplicateChoice count={0} rows={[]} policy={null} onChange={jest.fn()} />,
  );

  expect(container).toBeEmptyDOMElement();
});

test("neither option is preselected, so the system never decides", () => {
  render(
    <DuplicateChoice
      count={2}
      rows={[refRow(2, "A"), refRow(3, "B")]}
      policy={null}
      onChange={jest.fn()}
    />,
  );

  screen.getAllByRole("radio").forEach((r) => expect(r).not.toBeChecked());
});

test("the customer is told a choice is required to continue", () => {
  render(
    <DuplicateChoice
      count={2}
      rows={[refRow(2, "A"), refRow(3, "B")]}
      policy={null}
      onChange={jest.fn()}
    />,
  );

  expect(screen.getByText(/choose one to continue/i)).toBeInTheDocument();
});

test("counts rows, not references, since a matched row may have neither", () => {
  render(
    <DuplicateChoice
      count={12}
      rows={[fpRow(2), fpRow(3)]}
      policy={null}
      onChange={jest.fn()}
    />,
  );

  expect(screen.getByText(/12 rows already booked/i)).toBeInTheDocument();
});

test("the singular case reads as one row, not '1 rows'", () => {
  render(
    <DuplicateChoice
      count={1}
      rows={[refRow(2, "ORDER-9")]}
      policy={null}
      onChange={jest.fn()}
    />,
  );

  expect(screen.getByText(/1 row already booked/i)).toBeInTheDocument();
});

test("a row matched on content says so rather than naming a reference", () => {
  render(
    <DuplicateChoice
      count={1}
      rows={[fpRow(7)]}
      policy={null}
      onChange={jest.fn()}
    />,
  );

  expect(screen.getByText(/row 7/i)).toBeInTheDocument();
  expect(screen.getByText(/matched by contents/i)).toBeInTheDocument();
});

test("a row matched on a reference shows that reference", () => {
  render(
    <DuplicateChoice
      count={1}
      rows={[refRow(4, "ORDER-9")]}
      policy={null}
      onChange={jest.fn()}
    />,
  );

  expect(screen.getByText(/ORDER-9/)).toBeInTheDocument();
});

test("the batch the rows came from is named", () => {
  render(
    <DuplicateChoice
      count={1}
      rows={[fpRow(2)]}
      matchedUpload={{
        id: "u1",
        batch_name: "March Week 2",
        created_at: "2026-08-04T00:00:00Z",
      }}
      policy={null}
      onChange={jest.fn()}
    />,
  );

  expect(screen.getByText(/March Week 2/)).toBeInTheDocument();
});

test("a missing batch name does not render a broken sentence", () => {
  render(
    <DuplicateChoice
      count={1}
      rows={[fpRow(2)]}
      matchedUpload={null}
      policy={null}
      onChange={jest.fn()}
    />,
  );

  expect(screen.getByText(/already booked/i)).toBeInTheDocument();
  expect(screen.queryByText(/undefined|null/i)).not.toBeInTheDocument();
});

test("the listed rows are capped with an honest remainder", () => {
  render(
    <DuplicateChoice
      count={12}
      rows={[refRow(2, "A"), refRow(3, "B"), refRow(4, "C"), refRow(5, "D")]}
      policy={null}
      onChange={jest.fn()}
    />,
  );

  expect(screen.getByText(/\+9 more/)).toBeInTheDocument();
});

test("a short list is shown in full with no '+N more'", () => {
  render(
    <DuplicateChoice
      count={2}
      rows={[refRow(2, "A-1"), refRow(3, "B-2")]}
      policy={null}
      onChange={jest.fn()}
    />,
  );

  expect(screen.queryByText(/more/i)).not.toBeInTheDocument();
});

test("choosing book-again reports the choice up", () => {
  const onChange = jest.fn();
  render(
    <DuplicateChoice
      count={2}
      rows={[refRow(2, "A"), refRow(3, "B")]}
      policy={null}
      onChange={onChange}
    />,
  );

  fireEvent.click(screen.getByRole("radio", { name: /Book them again/i }));

  expect(onChange).toHaveBeenCalledWith("book_again");
});

test("choosing skip reports the choice up", () => {
  const onChange = jest.fn();
  render(
    <DuplicateChoice
      count={2}
      rows={[refRow(2, "A"), refRow(3, "B")]}
      policy={null}
      onChange={onChange}
    />,
  );

  fireEvent.click(screen.getByRole("radio", { name: /Skip them/i }));

  expect(onChange).toHaveBeenCalledWith("skip");
});

test("book-again states that every duplicate will be charged for", () => {
  render(
    <DuplicateChoice
      count={2}
      rows={[refRow(2, "A"), refRow(3, "B")]}
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
      rows={[refRow(2, "A"), refRow(3, "B")]}
      policy="skip"
      onChange={jest.fn()}
    />,
  );

  expect(
    screen.getByText(/inside this one file is always skipped/i),
  ).toBeInTheDocument();
});
