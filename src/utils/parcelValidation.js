// src/utils/parcelValidation.js
//
// Real-time validation for the Parcel Details step (GetQuoteBook.jsx / ParcelCard.jsx).
//
// Limits are fetched from /api/bookings/parcel-limits/ on app startup via
// fetchParcelLimits(), so the frontend always mirrors the backend's PricingRule
// table exactly. PARCEL_LIMITS below holds the fallback defaults used before
// the fetch resolves (or if it fails). The Zod schemas read PARCEL_LIMITS at
// evaluation time, not at module load time, so a successful fetch before the
// first user interaction is transparent.
//
// Total weight across all parcels is also capped server-side via the
// MAX_WEIGHT_KG PricingRule (bookings/utils/pricing.py), but that limit is
// admin-configurable at runtime, so we deliberately do NOT hardcode a
// blocking client-side check for it — the backend surfaces a clear
// `quoteError` at Step 5 if the total exceeds whatever the current rule is.
//
// Insurance amount has no hard backend maximum (just a DecimalField(10,2)
// column), so INSURANCE_MAX_GBP below is a soft, sensible UX guardrail only.

import { z } from "zod";

export const PARCEL_LIMITS = {
  WEIGHT_MIN_KG: 0.1,
  WEIGHT_MAX_KG: 30,
  DIMENSION_MIN_CM: 1,
  DIMENSION_MAX_CM: 100,
  INSURANCE_MIN_GBP: 0,
  INSURANCE_MAX_GBP: 100000,
  MAX_PARCELS: 5,
};

/**
 * Update PARCEL_LIMITS from a backend response object (the shape returned by
 * GET /api/bookings/parcel-limits/).  Call this before the first validation.
 */
export function initParcelLimits(data) {
  if (typeof data.min_weight_kg === "number") PARCEL_LIMITS.WEIGHT_MIN_KG = data.min_weight_kg;
  if (typeof data.max_weight_kg === "number") PARCEL_LIMITS.WEIGHT_MAX_KG = data.max_weight_kg;
  if (typeof data.min_dimension_cm === "number") PARCEL_LIMITS.DIMENSION_MIN_CM = data.min_dimension_cm;
  if (typeof data.max_dimension_cm === "number") PARCEL_LIMITS.DIMENSION_MAX_CM = data.max_dimension_cm;
}

/**
 * Fetch canonical per-parcel limits from the backend and update PARCEL_LIMITS.
 * Safe to call multiple times; ignores network errors silently so the app
 * works offline with the defaults.
 *
 * Usage in main.jsx / App.jsx:
 *   import { fetchParcelLimits } from "./utils/parcelValidation";
 *   fetchParcelLimits();  // fire-and-forget on startup
 */
export async function fetchParcelLimits(baseUrl = "") {
  try {
    const res = await fetch(`${baseUrl}/api/booking/parcel-limits/`);
    if (!res.ok) return;
    const data = await res.json();
    initParcelLimits(data);
  } catch {
    // Silently fall back to defaults
  }
}

/** Coerce a form input's string/number/empty value into a number, or leave
 *  it undefined so the number check fails for blank/non-numeric fields.
 *
 *  Bug 3: this project is on Zod v4, where the v3 `required_error` /
 *  `invalid_type_error` options are ignored — a blank field fell through to
 *  Zod's raw default ("Invalid input: expected number, received undefined").
 *  Zod v4 takes a unified `error` callback instead, which restores the
 *  friendly message. (The `.refine()` range messages below were unaffected.) */
const coerceNumber = (label) =>
  z.preprocess((val) => {
    if (val === "" || val === null || typeof val === "undefined") return undefined;
    const n = typeof val === "number" ? val : Number.parseFloat(val);
    return Number.isNaN(n) ? undefined : n;
  }, z.number({ error: () => `${label} is required` }));

export const weightSchema = coerceNumber("Weight")
  .refine((v) => v > 0, { message: "Weight must be greater than 0 kg" })
  .refine((v) => v <= PARCEL_LIMITS.WEIGHT_MAX_KG, {
    message: () => `Maximum weight per parcel is ${PARCEL_LIMITS.WEIGHT_MAX_KG} kg`,
  });

const dimensionSchema = (label) =>
  coerceNumber(label)
    .refine((v) => v > 0, { message: `${label} must be greater than 0 cm` })
    .refine((v) => v <= PARCEL_LIMITS.DIMENSION_MAX_CM, {
      message: () => `Maximum ${label.toLowerCase()} is ${PARCEL_LIMITS.DIMENSION_MAX_CM} cm`,
    });

export const lengthSchema = dimensionSchema("Length");
export const widthSchema = dimensionSchema("Width");
export const heightSchema = dimensionSchema("Height");

export const insuranceSchema = coerceNumber("Insurance amount")
  .refine((v) => v >= PARCEL_LIMITS.INSURANCE_MIN_GBP, {
    message: "Insurance amount cannot be negative",
  })
  .refine((v) => v <= PARCEL_LIMITS.INSURANCE_MAX_GBP, {
    message: () => `Maximum insurance amount is £${PARCEL_LIMITS.INSURANCE_MAX_GBP.toLocaleString()}`,
  });

export const parcelSchema = z.object({
  weightKg: weightSchema,
  dimensions: z.object({
    length: lengthSchema,
    width: widthSchema,
    height: heightSchema,
  }),
  fragile: z.boolean().optional(),
});

/** Run a single zod schema against a raw value. Never throws. */
export function validateField(schema, value) {
  const result = schema.safeParse(value);
  if (result.success) return { valid: true, error: null };
  return { valid: false, error: result.error.issues[0]?.message || "Invalid value" };
}

/** Validate one parcel's fields, returning an errors map keyed the same way
 *  ParcelCard/GetQuoteBook already expect (weightKg/length/width/height). */
export function validateParcelFields(parcel) {
  const errors = {};
  const weight = validateField(weightSchema, parcel.weightKg);
  if (!weight.valid) errors.weightKg = weight.error;

  const length = validateField(lengthSchema, parcel.dimensions?.length);
  if (!length.valid) errors.length = length.error;

  const width = validateField(widthSchema, parcel.dimensions?.width);
  if (!width.valid) errors.width = width.error;

  const height = validateField(heightSchema, parcel.dimensions?.height);
  if (!height.valid) errors.height = height.error;

  return errors;
}

/** Volumetric ("dimensional") weight in kg, industry-standard divisor 5000
 *  for cm measurements. Informational only — actual pricing uses real
 *  weight (see bookings/utils/pricing.py), but showing this helps a
 *  customer sanity-check unusually large dimensions before submitting. */
export function volumetricWeightKg({ length, width, height } = {}) {
  const l = Number.parseFloat(length) || 0;
  const w = Number.parseFloat(width) || 0;
  const h = Number.parseFloat(height) || 0;
  if (!l || !w || !h) return 0;
  return (l * w * h) / 5000;
}
