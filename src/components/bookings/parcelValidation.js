/**
 * Parcel Validation Utility
 * Provides real-time and batch validation for parcels with detailed error messages
 * Handles all edge cases: negative values, zero, decimals, very large numbers, empty parcels
 *
 * Limits are sourced from utils/parcelValidation.js so there is one source of truth.
 * If limits were updated via fetchParcelLimits() at startup, this file picks them up
 * automatically at validation call time (not at module load time) because
 * VALIDATION_RULES reads from the shared PARCEL_LIMITS object by reference.
 */
import { PARCEL_LIMITS } from "../../utils/parcelValidation";

// Thin proxy so existing callers of VALIDATION_RULES continue to work.
// Reads are lazy (property access at call time) so updates from fetchParcelLimits()
// are reflected automatically without any re-import.
const VALIDATION_RULES = new Proxy(
  {
    WARNING_WEIGHT: 20,
    WARNING_DIMENSION: 80,
  },
  {
    get(target, prop) {
      switch (prop) {
        case "WEIGHT_MIN": return PARCEL_LIMITS.WEIGHT_MIN_KG;
        case "WEIGHT_MAX": return PARCEL_LIMITS.WEIGHT_MAX_KG;
        case "DIMENSION_MIN": return PARCEL_LIMITS.DIMENSION_MIN_CM;
        case "DIMENSION_MAX": return PARCEL_LIMITS.DIMENSION_MAX_CM;
        default: return target[prop];
      }
    },
  }
);

const DEBUG = import.meta.env.NODE_ENV === 'development' && false; // Set to true for debug logs

const debugLog = (msg, data) => {
  if (DEBUG) {
    console.log(`[ParcelValidation] ${msg}`, data);
  }
};

/**
 * Validate a single parcel's weight field
 * @param {number|string} weight - The weight value to validate
 * @returns {string} Empty string if valid, error message otherwise
 */
export const validateWeight = (weight) => {
  debugLog('Validating weight:', weight);

  // Empty value
  if (weight === '' || weight === null || weight === undefined) {
    return 'Weight is required';
  }

  const numWeight = parseFloat(weight);

  // Not a number
  if (isNaN(numWeight)) {
    return 'Weight must be a valid number';
  }

  // Negative value
  if (numWeight < 0) {
    return 'Weight cannot be negative';
  }

  // Zero value
  if (numWeight === 0) {
    return `Weight must be between ${VALIDATION_RULES.WEIGHT_MIN} and ${VALIDATION_RULES.WEIGHT_MAX} kg`;
  }

  // Below minimum
  if (numWeight < VALIDATION_RULES.WEIGHT_MIN) {
    return `Weight must be between ${VALIDATION_RULES.WEIGHT_MIN} and ${VALIDATION_RULES.WEIGHT_MAX} kg`;
  }

  // Above maximum
  if (numWeight > VALIDATION_RULES.WEIGHT_MAX) {
    return `Weight must be between ${VALIDATION_RULES.WEIGHT_MIN} and ${VALIDATION_RULES.WEIGHT_MAX} kg`;
  }

  // Check for very large numbers (e.g., 1e10)
  if (numWeight > Number.MAX_SAFE_INTEGER) {
    return 'Weight value is too large';
  }

  debugLog('Weight is valid:', numWeight);
  return '';
};

/**
 * Validate a single dimension field (length, width, or height)
 * @param {number|string} dimension - The dimension value to validate
 * @param {string} fieldName - Name of the dimension (for error message)
 * @returns {string} Empty string if valid, error message otherwise
 */
export const validateDimension = (dimension, fieldName = 'Dimension') => {
  debugLog(`Validating ${fieldName}:`, dimension);

  // Empty value
  if (dimension === '' || dimension === null || dimension === undefined) {
    return `${fieldName} is required`;
  }

  const numDimension = parseFloat(dimension);

  // Not a number
  if (isNaN(numDimension)) {
    return `${fieldName} must be a valid number`;
  }

  // Negative value
  if (numDimension < 0) {
    return `${fieldName} cannot be negative`;
  }

  // Zero value
  if (numDimension === 0) {
    return `${fieldName} must be between ${VALIDATION_RULES.DIMENSION_MIN} and ${VALIDATION_RULES.DIMENSION_MAX} cm`;
  }

  // Below minimum
  if (numDimension < VALIDATION_RULES.DIMENSION_MIN) {
    return `${fieldName} must be between ${VALIDATION_RULES.DIMENSION_MIN} and ${VALIDATION_RULES.DIMENSION_MAX} cm`;
  }

  // Above maximum
  if (numDimension > VALIDATION_RULES.DIMENSION_MAX) {
    return `${fieldName} must be between ${VALIDATION_RULES.DIMENSION_MIN} and ${VALIDATION_RULES.DIMENSION_MAX} cm`;
  }

  // Check for very large numbers (e.g., 1e10)
  if (numDimension > Number.MAX_SAFE_INTEGER) {
    return `${fieldName} value is too large`;
  }

  debugLog(`${fieldName} is valid:`, numDimension);
  return '';
};

/**
 * Validate all dimensions of a parcel
 * @param {object} dimensions - Object with length, width, height properties
 * @returns {object} Object with error messages for each dimension field
 */
export const validateDimensions = (dimensions) => {
  debugLog('Validating dimensions object:', dimensions);

  const errors = {};

  if (!dimensions || typeof dimensions !== 'object') {
    debugLog('Dimensions object is invalid');
    return {
      dimension_length: 'Dimensions must be provided',
      dimension_width: 'Dimensions must be provided',
      dimension_height: 'Dimensions must be provided',
      dimensions_overall: 'Invalid dimensions structure',
    };
  }

  // Validate each dimension
  errors.dimension_length = validateDimension(dimensions.length, 'Length');
  errors.dimension_width = validateDimension(dimensions.width, 'Width');
  errors.dimension_height = validateDimension(dimensions.height, 'Height');

  // Filter out empty errors
  Object.keys(errors).forEach((key) => {
    if (!errors[key]) {
      delete errors[key];
    }
  });

  debugLog('Dimensions validation result:', errors);
  return errors;
};

/**
 * Validate a single parcel object
 * @param {object} parcel - Parcel object with weight_kg, dimensions, fragile
 * @param {number} parcelIndex - Index of the parcel for error keys
 * @returns {object} Object with validation errors for this parcel
 */
export const validateParcel = (parcel, parcelIndex = 0) => {
  debugLog(`Validating parcel ${parcelIndex}:`, parcel);

  if (!parcel || typeof parcel !== 'object') {
    debugLog('Parcel object is invalid');
    return {
      [`parcel_${parcelIndex}_weight_kg`]: 'Parcel data is invalid',
      [`parcel_${parcelIndex}_dimensions_overall`]: 'Parcel data is invalid',
    };
  }

  const errors = {};

  // Validate weight
  const weightError = validateWeight(parcel.weight_kg);
  if (weightError) {
    errors[`parcel_${parcelIndex}_weight_kg`] = weightError;
  }

  // Validate dimensions
  const dimensionErrors = validateDimensions(parcel.dimensions);
  Object.entries(dimensionErrors).forEach(([key, error]) => {
    errors[`parcel_${parcelIndex}_${key}`] = error;
  });

  debugLog(`Parcel ${parcelIndex} validation result:`, errors);
  return errors;
};

/**
 * Validate all parcels in an array
 * @param {array} parcels - Array of parcel objects
 * @returns {object} { isValid: boolean, errors: object, summary: array }
 *   - isValid: true if all parcels are valid
 *   - errors: Map of field errors for inline display
 *   - summary: Array of overall error messages for the summary box
 */
export const validateAllParcels = (parcels) => {
  debugLog('Validating all parcels, count:', parcels?.length);

  if (!parcels || !Array.isArray(parcels)) {
    debugLog('Parcels is not an array');
    return {
      isValid: false,
      errors: {},
      summary: ['Parcels must be a valid array'],
    };
  }

  if (parcels.length === 0) {
    debugLog('No parcels to validate');
    return {
      isValid: true,
      errors: {},
      summary: [],
    };
  }

  const allErrors = {};
  const summary = [];
  let isValid = true;

  parcels.forEach((parcel, index) => {
    const parcelErrors = validateParcel(parcel, index);
    Object.assign(allErrors, parcelErrors);

    if (Object.keys(parcelErrors).length > 0) {
      isValid = false;
      summary.push(`Parcel ${index + 1}: ${Object.values(parcelErrors)[0]}`);
    }
  });

  debugLog('All parcels validation result:', {
    isValid,
    errorCount: Object.keys(allErrors).length,
    summaryCount: summary.length,
  });

  return {
    isValid,
    errors: allErrors,
    summary,
  };
};

/**
 * Check if form can be submitted based on parcel validation
 * @param {array} parcels - Array of parcel objects
 * @returns {boolean} True if validation passes and form can be submitted
 */
export const canSubmitForm = (parcels) => {
  const validation = validateAllParcels(parcels);
  debugLog('Can submit form?', validation.isValid);
  return validation.isValid;
};

/**
 * Format parcel data for backend submission
 * Converts all string numbers to proper types and cleans up data
 * @param {array} parcels - Array of parcel objects (potentially with string values)
 * @returns {array} Cleaned array of parcels ready for API submission
 */
export const formatParcelsForSubmission = (parcels) => {
  debugLog('Formatting parcels for submission, count:', parcels?.length);

  if (!parcels || !Array.isArray(parcels)) {
    return [];
  }

  return parcels
    .filter((p) => p && typeof p === 'object')
    .map((parcel) => ({
      weight_kg: parseFloat(parcel.weight_kg) || 0,
      dimensions: {
        length: parseFloat(parcel.dimensions?.length) || 0,
        width: parseFloat(parcel.dimensions?.width) || 0,
        height: parseFloat(parcel.dimensions?.height) || 0,
      },
      fragile: Boolean(parcel.fragile),
    }));
};

export default {
  validateWeight,
  validateDimension,
  validateDimensions,
  validateParcel,
  validateAllParcels,
  canSubmitForm,
  formatParcelsForSubmission,
  VALIDATION_RULES,
};
