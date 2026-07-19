import { isValidUkPhone, normalizeUkPhone, UK_PHONE_ERROR } from "./ukPhone";

describe("isValidUkPhone", () => {
  test.each([
    ["07123456789", true], // mobile, 11 digits
    ["07123 456789", true], // spaces stripped
    ["07123-456-789", true], // dashes stripped
    ["+447123456789", true], // E.164 mobile
    ["+44 7123 456789", true],
    ["447123456789", true], // bare 44 prefix
    ["02079460000", true], // London landline, 11 digits
    ["03001234567", true], // non-geo, 11 digits
    ["01865123456", true], // 01 landline, 11 digits
    ["0186512345", true], // 01 landline, 10 digits (short subscriber)
    ["+442079460000", true],
  ])("accepts %s", (input, expected) => {
    expect(isValidUkPhone(input)).toBe(expected);
  });

  test.each([
    ["0712345678", false], // mobile with 10 digits — wrong count
    ["071234567890", false], // mobile with 12 digits — wrong count
    ["0207946000", false], // 02 with 10 digits — wrong count
    ["+44712345678", false], // +44 mobile short one digit
    ["1234567890", false], // no UK prefix
    ["+1 555 0100", false], // US number
    ["05123456789", false], // 05 prefix not accepted
    ["07123 45678a", false], // letters
    ["", false],
    ["07", false],
  ])("rejects %s", (input, expected) => {
    expect(isValidUkPhone(input)).toBe(expected);
  });
});

describe("normalizeUkPhone", () => {
  test("normalizes national mobile to E.164", () => {
    expect(normalizeUkPhone("07123 456789")).toBe("+447123456789");
  });
  test("keeps E.164 input stable", () => {
    expect(normalizeUkPhone("+447123456789")).toBe("+447123456789");
  });
  test("normalizes landline", () => {
    expect(normalizeUkPhone("020 7946 0000")).toBe("+442079460000");
  });
  test("returns null for invalid input", () => {
    expect(normalizeUkPhone("+1 555 0100")).toBeNull();
  });
});

describe("UK_PHONE_ERROR", () => {
  test("gives a concrete example", () => {
    expect(UK_PHONE_ERROR).toMatch(/07123 456789/);
  });
});
