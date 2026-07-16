// Bug 3 regression tests for the parcel validation schemas.
//
// Run with:  node --test src/utils/parcelValidation.nodetest.mjs
//
// Uses Node's built-in test runner (no jest/jsdom/babel needed — the project is ESM and
// the frontend jest harness currently lacks jest-environment-jsdom + a babel config).
import test from "node:test";
import assert from "node:assert/strict";

import { validateField, weightSchema, lengthSchema } from "./parcelValidation.js";

test("blank weight -> friendly 'required' message, NOT the raw Zod v4 default", () => {
  const r = validateField(weightSchema, "");
  assert.equal(r.valid, false);
  assert.equal(r.error, "Weight is required");
  // The exact string from the bug report must never come back.
  assert.doesNotMatch(r.error, /expected number, received undefined/);
});

test("blank dimension -> friendly 'required' message", () => {
  const r = validateField(lengthSchema, "");
  assert.equal(r.valid, false);
  assert.equal(r.error, "Length is required");
  assert.doesNotMatch(r.error, /expected number, received undefined/);
});

test("30kg per-parcel limit still enforced", () => {
  assert.equal(validateField(weightSchema, "40").valid, false);
  assert.match(validateField(weightSchema, "40").error, /Maximum weight/);
});

test("100cm per-dimension limit still enforced", () => {
  assert.equal(validateField(lengthSchema, "150").valid, false);
  assert.match(validateField(lengthSchema, "150").error, /Maximum length/i);
});

test("valid values pass", () => {
  assert.equal(validateField(weightSchema, "2.5").valid, true);
  assert.equal(validateField(lengthSchema, "50").valid, true);
});
