/* eslint-env jest */
// "Is this a new batch, or corrections to an earlier upload?" on the confirm step.
//
// This is a DECLARATION of intent, not a reaction to something we detected, so
// it is shown on every upload rather than only when rows happen to match. The
// customer knows which it is; nothing in the file does. The template has no date
// column, so a weekly repeat of the same route is a byte-identical file to a
// corrections re-upload.
//
// Pinned here:
//   1. Both options always visible.
//   2. "A new batch" IS preselected. That is safe in a way the skip/book-again
//      default was not: if rows really do match an earlier upload, DuplicateChoice
//      still fires and still refuses to guess, so this default can never cause a
//      silent double-booking. It only saves a click on the uploads that need no
//      decision.
//   3. Choosing corrections reveals the picker, and Continue is blocked until a
//      batch is named — "corrections to nothing" is not a declaration.
//   4. Switching back to a new batch clears the picked batch, so a stale id
//      cannot ride along on a submit that no longer means corrections.
//   5. The consequence is stated in words: already-booked rows are skipped.
//   6. An empty picker says why rather than showing an empty dropdown.
//
// The wiring from this choice through to the request is covered in
// BulkUploadApi.correctsUpload.test.js.

import { render, screen, fireEvent } from "@testing-library/react";

import { UploadKindChoice } from "./UploadKindChoice";

const BATCHES = [
  { id: "parent-1", label: "March Week 2 · 30 failed · 04 Aug 2026", failed: 30 },
  { id: "parent-2", label: "March Week 1 · 2 failed · 28 Jul 2026", failed: 2 },
];

function setup(props = {}) {
  const onChange = jest.fn();
  const utils = render(
    <UploadKindChoice
      kind={props.kind ?? "new"}
      correctsUpload={props.correctsUpload ?? ""}
      correctable={props.correctable ?? BATCHES}
      onChange={onChange}
    />,
  );
  return { onChange, ...utils };
}

test("both options are offered on every upload", () => {
  setup();
  expect(screen.getByLabelText(/a new batch/i)).toBeInTheDocument();
  expect(screen.getByLabelText(/corrections to an earlier upload/i)).toBeInTheDocument();
});

test("a new batch is preselected", () => {
  setup();
  expect(screen.getByLabelText(/a new batch/i)).toBeChecked();
  expect(screen.getByLabelText(/corrections to an earlier upload/i)).not.toBeChecked();
});

test("the picker is hidden until corrections is chosen", () => {
  setup({ kind: "new" });
  expect(screen.queryByLabelText(/which batch are you correcting/i)).not.toBeInTheDocument();
});

test("choosing corrections reveals the picker", () => {
  setup({ kind: "corrections" });
  expect(screen.getByLabelText(/which batch are you correcting/i)).toBeInTheDocument();
});

test("the picker lists every correctable batch by label", () => {
  setup({ kind: "corrections" });
  expect(screen.getByRole("option", { name: /March Week 2 · 30 failed/ })).toBeInTheDocument();
  expect(screen.getByRole("option", { name: /March Week 1 · 2 failed/ })).toBeInTheDocument();
});

test("selecting the kind reports it upward", () => {
  const { onChange } = setup({ kind: "new" });
  fireEvent.click(screen.getByLabelText(/corrections to an earlier upload/i));
  expect(onChange).toHaveBeenCalledWith({ kind: "corrections", correctsUpload: "" });
});

test("switching back to a new batch clears the chosen parent", () => {
  const { onChange } = setup({ kind: "corrections", correctsUpload: "parent-1" });
  fireEvent.click(screen.getByLabelText(/a new batch/i));
  expect(onChange).toHaveBeenCalledWith({ kind: "new", correctsUpload: "" });
});

test("picking a batch reports it upward", () => {
  const { onChange } = setup({ kind: "corrections" });
  fireEvent.change(screen.getByLabelText(/which batch are you correcting/i), {
    target: { value: "parent-2" },
  });
  expect(onChange).toHaveBeenCalledWith({ kind: "corrections", correctsUpload: "parent-2" });
});

test("it states that already-booked rows are skipped", () => {
  setup();
  expect(screen.getByText(/already booked/i)).toBeInTheDocument();
});

test("an empty picker explains itself instead of showing an empty dropdown", () => {
  setup({ kind: "corrections", correctable: [] });
  expect(screen.queryByLabelText(/which batch are you correcting/i)).not.toBeInTheDocument();
  expect(screen.getByText(/no earlier uploads.*failed rows/i)).toBeInTheDocument();
});
