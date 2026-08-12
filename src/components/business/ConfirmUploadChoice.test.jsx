/* eslint-env jest */
// The merged Review & Confirm question.
//
// It replaced two stacked questions — "a new batch vs corrections" and "skip the
// already-booked rows vs book them again" — that were the same question in
// different words, and could be answered inconsistently.
//
// Pinned here:
//   1. Nothing is preselected while money is at stake, and the clean file is
//      still one click.
//   2. The warning names the batch and lists the rows, collapsed.
//   3. "A new batch" states the consequence when duplicates exist.
//   4. Corrections preselect the batch the detector already matched.

import { render, screen, fireEvent } from "@testing-library/react";
import { ConfirmUploadChoice } from "./ConfirmUploadChoice";

const CORRECTABLE = [
  { id: "b1", batch_name: "March Week 2", failed: 30, label: "March Week 2 · 30 failed · 11 Aug 2026" },
  { id: "b2", batch_name: "March Week 1", failed: 0, label: "March Week 1 · no failures · 4 Aug 2026" },
];

const DUP_ROWS = [
  { row_number: 7, reference: "VALID-STD-02", matched_by: "reference" },
  { row_number: 9, reference: "", matched_by: "fingerprint" },
];

function setup(props = {}) {
  const onChange = jest.fn();
  const utils = render(
    <ConfirmUploadChoice
      kind={null}
      correctsUpload=""
      correctable={CORRECTABLE}
      duplicateCount={0}
      duplicateRows={[]}
      matchedUpload={null}
      onChange={onChange}
      {...props}
    />,
  );
  return { onChange, ...utils };
}

const radio = (name) => screen.getByRole("radio", { name: new RegExp(name, "i") });

// ── what is preselected ──────────────────────────────────────────────────────

test("a clean file preselects a new batch, so it submits in one click", () => {
  setup();
  expect(radio("a new batch")).toBeChecked();
  expect(screen.queryByText(/choose one to continue/i)).not.toBeInTheDocument();
});

test("a file with already-booked rows preselects nothing", () => {
  // The system must not answer a question that decides whether real vans go out
  // twice and the customer pays for it.
  setup({ duplicateCount: 14, duplicateRows: DUP_ROWS });
  expect(radio("a new batch")).not.toBeChecked();
  expect(radio("corrections")).not.toBeChecked();
  expect(screen.getByText(/choose one to continue/i)).toBeInTheDocument();
});

// ── the warning ──────────────────────────────────────────────────────────────

test("no duplicates means no warning at all", () => {
  setup();
  expect(screen.queryByText(/rows? already booked/i)).not.toBeInTheDocument();
  expect(screen.queryByRole("button", { name: /show rows/i })).not.toBeInTheDocument();
});

test("the warning counts the rows and names the batch they came from", () => {
  setup({
    duplicateCount: 14,
    duplicateRows: DUP_ROWS,
    matchedUpload: { id: "b1", batch_name: "March Week 2" },
  });
  expect(screen.getByText(/14 rows already booked/i)).toBeInTheDocument();
  expect(screen.getByText(/March Week 2/)).toBeInTheDocument();
});

test("the matched rows are hidden until asked for", () => {
  // A 200-row repeat would otherwise bury the question the list supports.
  setup({ duplicateCount: 2, duplicateRows: DUP_ROWS });
  const toggle = screen.getByRole("button", { name: /show rows/i });

  expect(toggle).toHaveAttribute("aria-expanded", "false");
  expect(screen.queryByText("VALID-STD-02")).not.toBeInTheDocument();

  fireEvent.click(toggle);

  expect(screen.getByText("VALID-STD-02")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: /hide rows/i })).toHaveAttribute("aria-expanded", "true");
});

test("a row matched on content says so instead of naming a reference", () => {
  // Calling a blank-reference match a "duplicate reference" reads as a system
  // error to the customer who never typed one.
  setup({ duplicateCount: 2, duplicateRows: DUP_ROWS });
  fireEvent.click(screen.getByRole("button", { name: /show rows/i }));
  expect(screen.getByText(/Row 9 \(matched by contents\)/i)).toBeInTheDocument();
});

// ── what the options say ─────────────────────────────────────────────────────

test("new batch spells out the charge when rows are already booked", () => {
  setup({ duplicateCount: 14, duplicateRows: DUP_ROWS });
  expect(screen.getByText(/including the 14 already booked/i)).toBeInTheDocument();
  expect(screen.getByText(/charged for all of them/i)).toBeInTheDocument();
});

test("new batch stays plain when there is nothing already booked", () => {
  setup();
  expect(screen.getByText(/books every row in this file/i)).toBeInTheDocument();
});

test("corrections states the consequence: already-booked rows are skipped", () => {
  setup();
  expect(screen.getByText(/nothing is booked or\s+charged twice/i)).toBeInTheDocument();
});

test("the within-file rule is stated, because the choice does not govern it", () => {
  // A row repeated inside one file is skipped whichever option is picked. Left
  // unsaid, "book them again" reads as a promise to book those too.
  setup({ duplicateCount: 2, duplicateRows: DUP_ROWS });
  expect(screen.getByText(/repeated inside this one file is always skipped/i)).toBeInTheDocument();
});

test("both options are offered on every upload, matches or not", () => {
  // A declaration of intent, not a reaction to a detection: a corrections file
  // whose rows we happen not to match must still be declarable.
  setup();
  expect(radio("a new batch")).toBeInTheDocument();
  expect(radio("corrections")).toBeInTheDocument();
});

test("the picker lists every correctable batch by label", () => {
  setup({ kind: "corrections" });
  expect(screen.getByRole("option", { name: CORRECTABLE[0].label })).toBeInTheDocument();
  expect(screen.getByRole("option", { name: CORRECTABLE[1].label })).toBeInTheDocument();
});

// ── the picker ───────────────────────────────────────────────────────────────

test("the picker only appears once corrections is chosen", () => {
  const { rerender, onChange } = setup();
  expect(screen.queryByRole("combobox")).not.toBeInTheDocument();

  fireEvent.click(radio("corrections"));
  expect(onChange).toHaveBeenCalledWith({ kind: "corrections", correctsUpload: "" });

  rerender(
    <ConfirmUploadChoice
      kind="corrections"
      correctsUpload=""
      correctable={CORRECTABLE}
      duplicateCount={0}
      onChange={onChange}
    />,
  );
  expect(screen.getByRole("combobox")).toBeInTheDocument();
});

test("choosing corrections preselects the batch the detector matched", () => {
  const { onChange } = setup({
    duplicateCount: 14,
    duplicateRows: DUP_ROWS,
    matchedUpload: { id: "b1", batch_name: "March Week 2" },
  });

  fireEvent.click(radio("corrections"));

  expect(onChange).toHaveBeenCalledWith({ kind: "corrections", correctsUpload: "b1" });
});

test("a matched batch that is not offered is not preselected", () => {
  // Outside the dedupe window the skip cannot see its rows, so naming it would
  // promise a de-duplication that will not happen.
  const { onChange } = setup({
    duplicateCount: 14,
    duplicateRows: DUP_ROWS,
    matchedUpload: { id: "gone", batch_name: "January" },
  });

  fireEvent.click(radio("corrections"));

  expect(onChange).toHaveBeenCalledWith({ kind: "corrections", correctsUpload: "" });
});

test("an empty picker says why rather than showing an empty dropdown", () => {
  setup({ kind: "corrections", correctable: [] });
  expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
  expect(screen.getByText(/no earlier uploads to correct/i)).toBeInTheDocument();
});

test("switching back to a new batch clears the chosen parent", () => {
  const { onChange } = setup({ kind: "corrections", correctsUpload: "b1" });
  fireEvent.click(radio("a new batch"));
  expect(onChange).toHaveBeenCalledWith({ kind: "new", correctsUpload: "" });
});

test("picking a batch reports it", () => {
  const { onChange } = setup({ kind: "corrections", correctsUpload: "" });
  fireEvent.change(screen.getByRole("combobox"), { target: { value: "b2" } });
  expect(onChange).toHaveBeenCalledWith({ kind: "corrections", correctsUpload: "b2" });
});

test("two instances on one page do not share a radio group", () => {
  // The wizard and the draft banner never render together today, but a shared
  // `name` would silently make one deselect the other if they ever did.
  const { container } = render(
    <>
      <ConfirmUploadChoice kind={null} correctsUpload="" onChange={() => {}} idPrefix="a" />
      <ConfirmUploadChoice kind={null} correctsUpload="" onChange={() => {}} idPrefix="b" />
    </>,
  );
  const names = new Set([...container.querySelectorAll("input[type=radio]")].map((i) => i.name));
  expect(names.size).toBe(2);
});
