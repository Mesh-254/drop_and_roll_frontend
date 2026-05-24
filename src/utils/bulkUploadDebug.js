/**
 * bulkUploadDebug.js — Debugging and validation utilities for bulk upload flows
 * 
 * This module provides tools to diagnose issues with upload state management,
 * API responses, and async/state synchronization problems.
 */

/**
 * Validates the shape and content of API response data
 * Returns { valid: boolean, errors: string[] }
 */
export function validateUploadResponseShape(data) {
  const errors = [];

  if (!data) {
    errors.push("Response is null/undefined");
    return { valid: false, errors };
  }

  if (typeof data !== 'object') {
    errors.push(`Response is not an object: ${typeof data}`);
    return { valid: false, errors };
  }

  if (Array.isArray(data)) {
    errors.push("Response is an array, expected object");
    return { valid: false, errors };
  }

  // Critical fields
  if (!data.id && data.id !== 0) {
    errors.push("Missing required field: id");
  }

  if (!data.status) {
    errors.push("Missing required field: status");
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Logs upload state for debugging (dev only)
 */
export function logUploadState(context, state) {
  if (process.env.NODE_ENV !== "development") return;

  console.group(`[BULK_UPLOAD] ${context}`);
  console.log("uploadResult:", state.uploadResult);
  console.log("uploadResult?.id:", state.uploadResult?.id);
  console.log("currentStep:", state.currentStep);
  console.log("isUploading:", state.isUploading);
  console.log("isSubmitting:", state.isSubmitting);
  console.log("uploadError:", state.uploadError);
  console.log("processingStatus:", state.processingStatus);
  console.groupEnd();
}

/**
 * Helper to create a "fail-safe" session validation before submission
 * Returns { valid: boolean, error: null | { title, message } }
 */
export function validateUploadSession(uploadResult) {
  if (!uploadResult) {
    return {
      valid: false,
      error: {
        title: "No Upload Session",
        message: "Upload session data is missing. Please select a file and validate.",
      },
    };
  }

  if (!uploadResult.id) {
    return {
      valid: false,
      error: {
        title: "Invalid Upload Session",
        message: `Upload ID is missing (got: ${JSON.stringify(uploadResult.id)}). This usually means the backend validation failed. Please try again.`,
      },
    };
  }

  if (!uploadResult.status) {
    return {
      valid: false,
      error: {
        title: "Incomplete Upload Session",
        message: "Upload status is missing. The session may be corrupted. Please try again.",
      },
    };
  }

  return { valid: true, error: null };
}

/**
 * Helper to diagnose async state synchronization issues
 * 
 * Usage:
 *   useEffect(() => {
 *     diagnoseStateMismatch("handleValidateAndUpload returned true", {
 *       returnValue: true,
 *       uploadResult,
 *       uploadResultId: uploadResult?.id,
 *     });
 *   }, [uploadResult]);
 */
export function diagnoseStateMismatch(context, data) {
  if (process.env.NODE_ENV !== "development") return;

  const mismatch = data.returnValue === true && !data.uploadResultId;
  if (mismatch) {
    console.warn(
      `[BULK_UPLOAD] State Synchronization Issue in "${context}"`,
      {
        problem: "Callback returned true but state variable is still undefined",
        explanation:
          "React state updates are async. The component checked uploadResult?.id in the closure, but it hasn't flushed yet.",
        fix: "Trust the callback return value; don't double-check the state variable.",
        data,
      }
    );
  }
}

/**
 * Extracts meaningful error from various error shapes
 */
export function extractErrorMessage(err) {
  if (!err) return "Unknown error";

  if (typeof err === "string") return err;

  // Axios-style error
  if (err.response?.data?.detail) return err.response.data.detail;
  if (err.response?.data?.message) return err.response.data.message;

  // Generic error object
  if (err.message) return err.message;

  // Fallback
  return JSON.stringify(err).substring(0, 100);
}

/**
 * Format API response for logging
 */
export function formatApiResponse(data, maxLength = 200) {
  if (!data) return "(empty)";
  const str = JSON.stringify(data);
  return str.length > maxLength ? str.substring(0, maxLength) + "..." : str;
}
