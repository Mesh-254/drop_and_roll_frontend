// Gate tests for the postcode-ONLY search matcher (spec §A). Mirrors the
// backend suite in bookings/tests/test_address_validation.py
// (TestPostcodeOnlyGate) — the two matchers must stay in sync.

import { isPostcodeQuery, isFullPostcode, formatPostcode } from "./ukPostcode";

describe("isPostcodeQuery — progressive postcode shapes pass", () => {
  test.each(["MK9", "mk9", "OX49", "W1A", "MK9 1", "MK9 1A", "MK9 1AA", "mk91aa", "OX1 2JD"])(
    "accepts %s",
    (q) => {
      expect(isPostcodeQuery(q)).toBe(true);
    },
  );
});

describe("isPostcodeQuery — free-text/name queries are rejected", () => {
  test.each([
    "Central Milton Keynes",
    "Starbucks",
    "10 Downing Street",
    "M", // single letter — not an outward code yet
    "MK", // letters only, no district digit
    "123",
    "MK9 1AAA", // too long for a UK postcode
    "",
  ])("rejects %s", (q) => {
    expect(isPostcodeQuery(q)).toBe(false);
  });
});

describe("isFullPostcode", () => {
  test.each(["MK9 1AA", "mk91aa", "OX49 5RJ"])("accepts complete postcode %s", (q) => {
    expect(isFullPostcode(q)).toBe(true);
  });
  test.each(["MK9", "MK9 1", "MK9 1A", "Starbucks"])("rejects incomplete %s", (q) => {
    expect(isFullPostcode(q)).toBe(false);
  });
});

describe("formatPostcode", () => {
  test("canonicalises a squashed lowercase postcode", () => {
    expect(formatPostcode("mk91aa")).toBe("MK9 1AA");
  });
  test("leaves partial input uppercased but unsplit", () => {
    expect(formatPostcode("mk9")).toBe("MK9");
  });
});
