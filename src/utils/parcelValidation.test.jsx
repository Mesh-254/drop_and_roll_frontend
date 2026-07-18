/* eslint-env jest */
// Gate tests for the parcel Zod schemas — the validation logic behind the
// Parcel Details step. Fast, deterministic, no network. The message text here
// is what ParcelCard surfaces on blur / the parent surfaces on Next.

import {
  validateField,
  validateParcelFields,
  weightSchema,
  lengthSchema,
  volumetricWeightKg,
} from "./parcelValidation";

test("blank required fields report a friendly required message (Zod v4 error callback)", () => {
  expect(validateField(weightSchema, "")).toEqual({ valid: false, error: "Weight is required" });
  expect(validateField(lengthSchema, "")).toEqual({ valid: false, error: "Length is required" });
});

test("a valid value passes with no error (the Length = 2 case from the bug report)", () => {
  expect(validateField(lengthSchema, "2")).toEqual({ valid: true, error: null });
  expect(validateField(weightSchema, "2.5")).toEqual({ valid: true, error: null });
});

test("zero / negative dimensions are rejected with a range message", () => {
  expect(validateField(lengthSchema, "0")).toEqual({
    valid: false,
    error: "Length must be greater than 0 cm",
  });
});

test("validateParcelFields returns an empty map for a fully valid parcel", () => {
  const parcel = { weightKg: "2", dimensions: { length: "2", width: "22", height: "21" } };
  expect(validateParcelFields(parcel)).toEqual({});
});

test("validateParcelFields flags each missing dimension by key", () => {
  const parcel = { weightKg: "", dimensions: { length: "", width: "22", height: "21" } };
  const errors = validateParcelFields(parcel);
  expect(errors.weightKg).toBe("Weight is required");
  expect(errors.length).toBe("Length is required");
  expect(errors.width).toBeUndefined();
});

test("volumetric weight uses the industry 5000 divisor", () => {
  expect(volumetricWeightKg({ length: "50", width: "50", height: "50" })).toBeCloseTo(25, 5);
  expect(volumetricWeightKg({ length: "", width: "10", height: "10" })).toBe(0);
});
