// src/hooks/useDebouncedValidation.js
//
// Generic debounced field-level validation hook. Debounces the raw input
// value (default 300ms), runs a validator function against the settled
// value, and optionally escalates a NEW validation error to a toast
// notification (via react-hot-toast) so critical mistakes (e.g. a wildly
// out-of-range value) get surfaced even if the person doesn't notice the
// inline red text.
//
// Toasts only fire on a valid -> invalid transition (or when the error
// message itself changes), never on every keystroke, and reuse a stable
// `id` so react-hot-toast updates the existing toast in place instead of
// stacking duplicates.

import { useEffect, useRef, useState } from "react";
import toast from "react-hot-toast";

const DEFAULT_DEBOUNCE_MS = 300;

/**
 * @param {*} value - current raw field value (string/number/etc.)
 * @param {(value: *) => { valid: boolean, error: string | null }} validate
 * @param {object} [options]
 * @param {number} [options.debounceMs=300]
 * @param {boolean} [options.toastOnError=false] - fire a toast on new errors
 * @param {string} [options.toastId] - stable id so toasts update, not stack
 * @param {boolean} [options.skip=false] - skip validation entirely (e.g. optional field not in use)
 * @returns {{ valid: boolean, error: string|null, isValidating: boolean }}
 */
export function useDebouncedValidation(value, validate, options = {}) {
  const {
    debounceMs = DEFAULT_DEBOUNCE_MS,
    toastOnError = false,
    toastId,
    skip = false,
  } = options;

  const [debouncedValue, setDebouncedValue] = useState(value);
  const [result, setResult] = useState({ valid: true, error: null, isValidating: false });
  const lastToastedError = useRef(null);

  // Debounce the raw value. This effect OWNS the `skip` transition: when the
  // field is skipped we reset to a clean valid state AND sync debouncedValue to
  // the current value, so a later un-skip can never validate a stale value.
  useEffect(() => {
    if (skip) {
      setDebouncedValue(value);
      setResult({ valid: true, error: null, isValidating: false });
      lastToastedError.current = null;
      return undefined;
    }
    setResult((prev) => ({ ...prev, isValidating: true }));
    const handle = setTimeout(() => setDebouncedValue(value), debounceMs);
    return () => clearTimeout(handle);
  }, [value, debounceMs, skip]);

  // Validate ONLY the settled value. Intentionally NOT keyed on `skip`.
  //
  // Bug: keying this on `skip` meant that flipping skip true→false (which
  // happens the instant a blank field receives its first character, since
  // ParcelCard passes `skip: isBlank(value)`) re-ran validation immediately —
  // but against the *previous* debouncedValue (still blank), firing a false
  // "Length is required" toast for a field the user had just typed a valid
  // value into. The debounce effect above already owns skip; here we wait for
  // debouncedValue to settle before validating.
  useEffect(() => {
    if (skip) return;

    const outcome = validate(debouncedValue);
    setResult({ ...outcome, isValidating: false });

    if (toastOnError && !outcome.valid && outcome.error) {
      if (outcome.error !== lastToastedError.current) {
        toast.error(outcome.error, toastId ? { id: toastId } : undefined);
        lastToastedError.current = outcome.error;
      }
    } else {
      lastToastedError.current = null;
    }
    // `validate` is expected to be referentially stable-ish (a zod schema
    // check); re-running on every render would defeat the debounce.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedValue]);

  return result;
}

export default useDebouncedValidation;
