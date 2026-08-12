/* eslint-env jest */
// The reported dead end: a 400 whose body was {"duplicate_policy": [...]} was
// reported to the customer as "Please try again", because the caller only read
// `detail`. Retrying could not work — the request needed a field the form had
// not asked for yet.

import { extractApiError } from "./extractApiError";

const err = (data) => ({ response: { data } });

test("reads a DRF detail", () => {
  expect(extractApiError(err({ detail: "Upload is already being processed." }))).toBe(
    "Upload is already being processed.",
  );
});

test("reads a field error, which is what the submit bug threw away", () => {
  expect(
    extractApiError(
      err({
        duplicate_policy: ["This file contains rows you have already booked. Choose skip or book_again explicitly."],
      }),
    ),
  ).toBe("This file contains rows you have already booked. Choose skip or book_again explicitly.");
});

test("prefers non_field_errors over an arbitrary field", () => {
  // Object key order is otherwise the only tiebreak, and it describes the whole
  // request rather than one input.
  const message = extractApiError(err({ corrects_upload: ["Bad parent."], non_field_errors: ["The whole thing."] }));
  expect(message).toBe("The whole thing.");
});

test("falls back when the body says nothing useful", () => {
  expect(extractApiError(err({}), "Could not submit.")).toBe("Could not submit.");
  expect(extractApiError(undefined, "Could not submit.")).toBe("Could not submit.");
  expect(extractApiError(err(null), "Could not submit.")).toBe("Could not submit.");
});

test("ignores an HTML error page rather than pasting markup into a toast", () => {
  expect(extractApiError(err("<!doctype html><html>500</html>"), "Could not submit.")).toBe("Could not submit.");
});

test("takes a plain-text body when there is one", () => {
  expect(extractApiError(err("Service unavailable"), "fallback")).toBe("Service unavailable");
});

test("digs through a nested list", () => {
  expect(extractApiError(err({ rows: [[], ["Row 7 is broken."]] }))).toBe("Row 7 is broken.");
});
