/**
 * Bulk Upload Validation Utilities
 * 
 * Centralized validation logic for the bulk upload wizard.
 * Used by useBulkUpload hook and components.
 */

/**
 * Validate file selection
 * @param {File} file - File object from input
 * @returns {Object} { isValid: boolean, error: string | null }
 */
export function validateFile(file) {
  if (!file) {
    return { isValid: false, error: 'No file selected. Please select a CSV file.' };
  }

  // Check file size (max 10 MB)
  const maxSizeMB = 10;
  const maxSizeBytes = maxSizeMB * 1024 * 1024;
  if (file.size > maxSizeBytes) {
    return { isValid: false, error: `File is too large. Maximum size is ${maxSizeMB} MB.` };
  }

  // Check file type
  const validTypes = ['text/csv', 'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'];
  const fileExtension = file.name.split('.').pop().toLowerCase();
  if (!['csv', 'xlsx', 'xls'].includes(fileExtension)) {
    return { isValid: false, error: 'Invalid file type. Please upload a CSV or Excel file.' };
  }

  return { isValid: true, error: null };
}

/**
 * Validate batch name
 * @param {string} batchName - Batch name input
 * @returns {Object} { isValid: boolean, error: string | null }
 */
export function validateBatchName(batchName) {
  const trimmed = batchName?.trim();

  if (!trimmed) {
    return { isValid: false, error: 'Batch name is required.' };
  }

  if (trimmed.length > 100) {
    return { isValid: false, error: 'Batch name must be 100 characters or less.' };
  }

  return { isValid: true, error: null };
}

/**
 * Validate notes (optional)
 * @param {string} notes - Notes input
 * @returns {Object} { isValid: boolean, error: string | null }
 */
export function validateNotes(notes) {
  if (!notes) {
    return { isValid: true, error: null }; // Notes are optional
  }

  if (notes.length > 1000) {
    return { isValid: false, error: 'Notes must be 1,000 characters or less.' };
  }

  return { isValid: true, error: null };
}

/**
 * Validate all wizard inputs at once
 * @param {Object} inputs - { file, batchName, notes }
 * @returns {Object} { isValid: boolean, errors: Object }
 */
export function validateWizardInputs(inputs) {
  const { file, batchName, notes } = inputs;
  const errors = {};

  const fileValidation = validateFile(file);
  if (!fileValidation.isValid) {
    errors.file = fileValidation.error;
  }

  const batchNameValidation = validateBatchName(batchName);
  if (!batchNameValidation.isValid) {
    errors.batchName = batchNameValidation.error;
  }

  const notesValidation = validateNotes(notes);
  if (!notesValidation.isValid) {
    errors.notes = notesValidation.error;
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
  };
}

/**
 * Check if uploadResult is valid and ready for submission
 * @param {Object} uploadResult - Result from /validate/ API
 * @returns {Object} { isValid: boolean, error: string | null }
 */
export function validateUploadResult(uploadResult) {
  if (!uploadResult) {
    return { isValid: false, error: 'No upload result found.' };
  }

  if (!uploadResult.id) {
    return { isValid: false, error: 'Upload missing ID. Please start again.' };
  }

  if (!uploadResult.batch_name) {
    return { isValid: false, error: 'Upload missing batch name. Please start again.' };
  }

  return { isValid: true, error: null };
}

/**
 * Check upload processing status
 * @param {Object} upload - Upload object with status field
 * @returns {Object} { isProcessing: boolean, isDone: boolean, isFailed: boolean }
 */
export function getUploadStatusInfo(upload) {
  if (!upload) {
    return { isProcessing: false, isDone: false, isFailed: false };
  }

  return {
    isProcessing: ['pending', 'processing'].includes(upload.status),
    isDone: ['completed', 'partial', 'failed'].includes(upload.status),
    isFailed: upload.status === 'failed',
    isPartial: upload.status === 'partial',
    isCompleted: upload.status === 'completed',
    status: upload.status,
  };
}

/**
 * Calculate success rate from upload result
 * @param {Object} upload - Upload object with total_rows and successful fields
 * @returns {number} Success rate as percentage (0-100)
 */
export function calculateSuccessRate(upload) {
  if (!upload || !upload.total_rows || upload.total_rows === 0) {
    return 0;
  }
  return Math.round((upload.successful / upload.total_rows) * 100);
}

/**
 * Format currency for display
 * @param {number} amount - Amount in pounds
 * @param {string} currency - Currency code (default 'GBP')
 * @returns {string} Formatted currency string
 */
export function formatCurrency(amount, currency = 'GBP') {
  if (amount === null || amount === undefined) {
    return '-';
  }
  const formatter = new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency,
  });
  return formatter.format(amount);
}

/**
 * Get readable status label for UI display
 * @param {string} status - Status code (pending, processing, completed, failed, partial)
 * @returns {string} Human-readable status label
 */
export function getStatusLabel(status) {
  const labels = {
    pending: 'Pending',
    processing: 'Processing',
    completed: 'Completed',
    failed: 'Failed',
    partial: 'Partial',
  };
  return labels[status] || 'Unknown';
}

/**
 * Get status color for UI badges/indicators
 * @param {string} status - Status code
 * @returns {Object} { bg: string, text: string, badge: string }
 */
export function getStatusColors(status) {
  const colors = {
    pending: {
      bg: 'bg-yellow-900/30',
      text: 'text-yellow-300',
      badge: 'bg-yellow-500/20',
    },
    processing: {
      bg: 'bg-blue-900/30',
      text: 'text-blue-300',
      badge: 'bg-blue-500/20',
    },
    completed: {
      bg: 'bg-green-900/30',
      text: 'text-green-300',
      badge: 'bg-green-500/20',
    },
    failed: {
      bg: 'bg-red-900/30',
      text: 'text-red-300',
      badge: 'bg-red-500/20',
    },
    partial: {
      bg: 'bg-yellow-900/30',
      text: 'text-yellow-300',
      badge: 'bg-yellow-500/20',
    },
  };
  return colors[status] || colors.pending;
}
