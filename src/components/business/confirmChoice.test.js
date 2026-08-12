/* eslint-env jest */
// The rules behind the one Review & Confirm question, tested apart from any JSX.
//
// Two screens ask it — the wizard step and the draft banner that rescues an
// upload whose tab was closed — and they must gate and submit identically. A
// disagreement between them is a double-booking or a parcel that never ships.

import { confirmPayload, isConfirmIncomplete, resolveKind } from "./confirmChoice";

describe("resolveKind", () => {
  test("a clean file defaults to a new batch", () => {
    // Nothing matched, so skip and book-again do the same thing. The default
    // decides nothing and saves a click.
    expect(resolveKind(null, 0)).toBe("new");
    expect(resolveKind(undefined, 0)).toBe("new");
  });

  test("a file with already-booked rows defaults to nothing", () => {
    // Both wrong answers cost money and only one is visible: a needless booking
    // lands on an invoice, a needless skip is a parcel nobody misses.
    expect(resolveKind(null, 14)).toBeNull();
  });

  test("an explicit choice always wins", () => {
    expect(resolveKind("corrections", 0)).toBe("corrections");
    expect(resolveKind("new", 14)).toBe("new");
  });
});

describe("isConfirmIncomplete", () => {
  test("blocks while duplicates are unanswered", () => {
    expect(isConfirmIncomplete({ kind: null, correctsUpload: "", duplicateCount: 14 })).toBe(true);
  });

  test("does not block a clean file", () => {
    expect(isConfirmIncomplete({ kind: null, correctsUpload: "", duplicateCount: 0 })).toBe(false);
  });

  test("blocks corrections until a batch is named", () => {
    // "Corrections to nothing" is not a declaration.
    expect(isConfirmIncomplete({ kind: "corrections", correctsUpload: "", duplicateCount: 14 })).toBe(true);
    expect(isConfirmIncomplete({ kind: "corrections", correctsUpload: "b1", duplicateCount: 14 })).toBe(false);
  });

  test("does not block a new batch once chosen", () => {
    expect(isConfirmIncomplete({ kind: "new", correctsUpload: "", duplicateCount: 14 })).toBe(false);
  });
});

describe("confirmPayload", () => {
  test("a clean new batch sends no policy at all", () => {
    // Nothing to have a policy about; the server default then stands for every
    // client that never asks.
    expect(confirmPayload({ kind: "new", correctsUpload: "", duplicateCount: 0 })).toEqual({});
  });

  test("a new batch over duplicates books them again, explicitly", () => {
    expect(confirmPayload({ kind: "new", correctsUpload: "", duplicateCount: 14 })).toEqual({
      duplicatePolicy: "book_again",
    });
  });

  test("corrections send the parent and never a policy", () => {
    // corrects_upload IS the answer to skip-or-book-again. The backend rejects
    // a conflicting duplicate_policy sent alongside it.
    expect(confirmPayload({ kind: "corrections", correctsUpload: "b1", duplicateCount: 14 })).toEqual({
      correctsUpload: "b1",
    });
  });

  test("corrections with no batch chosen send nothing", () => {
    // Unreachable through the UI (isConfirmIncomplete gates it) — pinned so a
    // caller that forgets the gate cannot submit a half-answer.
    expect(confirmPayload({ kind: "corrections", correctsUpload: "", duplicateCount: 14 })).toEqual({});
  });

  test("an unanswered duplicate question sends nothing, so the backend refuses", () => {
    expect(confirmPayload({ kind: null, correctsUpload: "", duplicateCount: 14 })).toEqual({});
  });
});
