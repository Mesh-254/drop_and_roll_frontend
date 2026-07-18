/* eslint-env jest */
// Regression tests for the debounced-validation race that produced a false
// "Length is required" toast on a field the user had just typed a valid value
// into (ParcelCard passes `skip: isBlank(value)`, which flips true→false on the
// first keystroke).

import { renderHook, act } from "@testing-library/react";

jest.mock("react-hot-toast", () => ({
  __esModule: true,
  default: { error: jest.fn() },
}));

import toast from "react-hot-toast";
import { useDebouncedValidation } from "./useDebouncedValidation";

const isBlank = (v) => v === "" || v === null || typeof v === "undefined";

// Mirrors the parcel dimension schema: blank → "required", 0/negative → range,
// otherwise valid.
const dimensionValidator = (v) => {
  if (isBlank(v)) return { valid: false, error: "Length is required" };
  const n = Number.parseFloat(v);
  if (Number.isNaN(n)) return { valid: false, error: "Length is required" };
  if (n <= 0) return { valid: false, error: "Length must be greater than 0 cm" };
  return { valid: true, error: null };
};

beforeEach(() => {
  jest.useFakeTimers();
  toast.error.mockClear();
});

afterEach(() => {
  jest.useRealTimers();
});

test("typing a valid first character into a blank field never fires a false error/toast", () => {
  const { result, rerender } = renderHook(
    ({ value }) =>
      useDebouncedValidation(value, dimensionValidator, {
        toastOnError: true,
        toastId: "length",
        skip: isBlank(value),
      }),
    { initialProps: { value: "" } },
  );

  // Blank + skipped → clean valid state, no toast.
  expect(result.current.error).toBeNull();
  expect(result.current.valid).toBe(true);

  // User types "2": skip flips true→false. This is the exact transition that
  // used to validate the STALE blank debouncedValue and toast "Length is required".
  act(() => {
    rerender({ value: "2" });
  });
  expect(toast.error).not.toHaveBeenCalled();

  // After the debounce settles, the valid value is validated — still no error.
  act(() => {
    jest.advanceTimersByTime(300);
  });
  expect(result.current.valid).toBe(true);
  expect(result.current.error).toBeNull();
  expect(toast.error).not.toHaveBeenCalled();
});

test("a genuinely invalid settled value still reports an error after the debounce", () => {
  const { result } = renderHook(() =>
    useDebouncedValidation("0", dimensionValidator, {
      toastOnError: true,
      toastId: "length",
      skip: isBlank("0"),
    }),
  );

  act(() => {
    jest.advanceTimersByTime(300);
  });

  expect(result.current.valid).toBe(false);
  expect(result.current.error).toBe("Length must be greater than 0 cm");
  expect(toast.error).toHaveBeenCalledWith(
    "Length must be greater than 0 cm",
    { id: "length" },
  );
});

test("a skipped (blank) field stays valid and never toasts", () => {
  const { result } = renderHook(() =>
    useDebouncedValidation("", dimensionValidator, {
      toastOnError: true,
      toastId: "length",
      skip: true,
    }),
  );

  act(() => {
    jest.advanceTimersByTime(300);
  });

  expect(result.current.valid).toBe(true);
  expect(result.current.error).toBeNull();
  expect(toast.error).not.toHaveBeenCalled();
});

test("clearing a field back to blank resets it to valid without an error", () => {
  const { result, rerender } = renderHook(
    ({ value }) =>
      useDebouncedValidation(value, dimensionValidator, {
        skip: isBlank(value),
      }),
    { initialProps: { value: "5" } },
  );

  act(() => {
    jest.advanceTimersByTime(300);
  });
  expect(result.current.valid).toBe(true);

  act(() => {
    rerender({ value: "" });
  });
  // Blank = untouched, not invalid.
  expect(result.current.valid).toBe(true);
  expect(result.current.error).toBeNull();
});
