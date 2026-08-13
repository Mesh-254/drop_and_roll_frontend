import React, { useCallback, useState, useRef } from 'react';
import { motion } from 'framer-motion';
import { Upload, FileText, FileSpreadsheet, AlertCircle, Loader2, X } from 'lucide-react';

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB

// Mirrors the server (serializers_bulk.MAX_ROWS_HARD_LIMIT and
// REQUIRED_COLUMNS). The server stays authoritative -- this only fails fast, so
// a missing column is caught before a 10 MB upload rather than after it.
const MAX_ROWS = 1000;
const REQUIRED_HEADERS = [
  'pickup_postal_code',
  'pickup_address_line1',
  'dropoff_postal_code',
  'dropoff_address_line1',
  'dropoff_phone',
  'receiver_name',
  'leave_safe_spot',
  'weight_kg',
  'num_parcels',
  'service_type_name',
];
const ALLOWED_FORMATS = ['.csv', '.xlsx', '.xls'];

/**
 * FileUploadZone — drag-and-drop file upload with validation.
 *
 * Features:
 * - Client-side size & type validation
 * - File preview with size display
 * - Keyboard accessible (Enter/Space to open picker)
 * - Upload progress visualization
 * - Responsive design with light/dark mode support
 */
const FileUploadZone = ({
  onFileSelect = () => {},
  isLoading = false,
  error = null,
  selectedFile = null,
  onRemoveFile = null,
  uploadProgress = 0,
}) => {
  const [isDragActive, setIsDragActive] = useState(false);
  const [validationError, setValidationError] = useState(null);
  const fileInputRef = useRef(null);

  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
  };

  /**
   * Content checks that need the file READ, not just its metadata.
   *
   * CSV only. Parsing .xlsx in the browser would mean shipping a spreadsheet
   * library to every visitor to catch a mistake the server already catches, so
   * those fall through to server-side validation as before. Better to check
   * nothing than to check it wrongly.
   *
   * Cheap by construction: it slices the first 64 KB rather than reading a
   * 10 MB file into memory to look at line one.
   */
  const inspectCsv = async (file) => {
    if (!file.name.toLowerCase().endsWith('.csv')) return null;

    let text;
    try {
      text = await file.slice(0, 64 * 1024).text();
    } catch {
      return null; // Unreadable here is the server's problem to report.
    }

    const lines = text.split(/\r?\n/).filter((l) => l.trim() !== '');
    if (!lines.length) {
      return { title: 'That file is empty', message: 'There are no rows to upload.' };
    }

    const headers = lines[0]
      .split(',')
      .map((h) => h.trim().toLowerCase().replace(/^"|"$/g, ''));
    const missing = REQUIRED_HEADERS.filter((h) => !headers.includes(h));
    if (missing.length) {
      // Name them. "Invalid file" sends the customer back to a spreadsheet with
      // no idea which of fifteen columns is wrong.
      return {
        title: `Missing ${missing.length === 1 ? 'a required column' : 'required columns'}`,
        message: `Add ${missing.join(', ')} to your file, then upload it again.`,
      };
    }

    // Only meaningful when the whole file fits in the slice; a truncated read
    // undercounts, and refusing a file for a count we did not actually take
    // would be worse than letting the server decide.
    if (file.size <= 64 * 1024 && lines.length - 1 > MAX_ROWS) {
      return {
        title: 'Too many rows',
        message: `This file has ${lines.length - 1} rows. The maximum is ${MAX_ROWS} per upload.`,
      };
    }

    return null;
  };

  const validateFile = (file) => {
    // Check file type
    const isValidType = ALLOWED_FORMATS.some((fmt) =>
      file.name.toLowerCase().endsWith(fmt)
    );
    if (!isValidType) {
      return {
        valid: false,
        error: {
          title: 'Invalid file type',
          message: `Please upload a CSV or Excel file. Got: ${file.name}`,
        },
      };
    }

    // Check file size
    if (file.size > MAX_FILE_SIZE) {
      return {
        valid: false,
        error: {
          title: 'File too large',
          message: `File size exceeds 10 MB. Your file: ${formatFileSize(file.size)}`,
        },
      };
    }

    return { valid: true };
  };

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setIsDragActive(true);
    } else if (e.type === 'dragleave') {
      setIsDragActive(false);
    }
  };

  const handleDrop = useCallback(
    async (e) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragActive(false);

      const files = e.dataTransfer.files;
      if (files && files[0]) {
        const file = files[0];
        const validation = validateFile(file);

        if (!validation.valid) {
          setValidationError(validation.error);
          return;
        }

        const contentError = await inspectCsv(file);
        if (contentError) {
          setValidationError(contentError);
          return;
        }

        setValidationError(null);
        onFileSelect(file);
      }
    },
    [onFileSelect]
  );

  const handleChange = useCallback(
    async (e) => {
      const files = e.target.files;
      if (files && files[0]) {
        const file = files[0];
        const validation = validateFile(file);

        if (!validation.valid) {
          setValidationError(validation.error);
          return;
        }

        const contentError = await inspectCsv(file);
        if (contentError) {
          setValidationError(contentError);
          return;
        }

        setValidationError(null);
        onFileSelect(file);
      }
    },
    [onFileSelect]
  );

  const handleKeyDown = (e) => {
    if ((e.key === 'Enter' || e.key === ' ') && !isLoading && !selectedFile) {
      e.preventDefault();
      fileInputRef.current?.click();
    }
  };

  const getFileIcon = (filename) => {
    if (filename.toLowerCase().endsWith('.csv')) {
      return <FileText className="h-8 w-8 text-brand-text" />;
    }
    return <FileSpreadsheet className="h-8 w-8 text-success" />;
  };

  // File preview card
  if (selectedFile) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full space-y-3"
      >
        {/* File preview */}
        <div className="bg-card dark:bg-surface rounded-lg border border-border p-4 flex items-center justify-between">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <div className="p-2 bg-muted dark:bg-surface-hover rounded-lg flex-shrink-0">
              {getFileIcon(selectedFile.name)}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground truncate">
                {selectedFile.name}
              </p>
              <p className="text-xs text-muted-foreground">
                {formatFileSize(selectedFile.size)}
              </p>
            </div>
          </div>

          {!isLoading && onRemoveFile && (
            <motion.button
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.95 }}
              onClick={onRemoveFile}
              className="p-2 hover:bg-destructive-surface text-destructive rounded-lg transition-all ml-2"
              title="Remove file"
            >
              <X className="h-5 w-5" />
            </motion.button>
          )}
        </div>

        {/* Upload progress */}
        {isLoading && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-2"
          >
            {/* Progress bar */}
            <div className="h-2 bg-surface-hover rounded-full overflow-hidden">
              <motion.div
                className="h-full bg-gradient-to-r from-primary to-primary-hover"
                initial={{ width: '0%' }}
                animate={{ width: `${uploadProgress}%` }}
                transition={{ duration: 0.6, ease: 'easeOut' }}
              />
            </div>

            {/* Loading text */}
            <div className="flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin text-brand-text" />
              <span className="text-sm text-muted-foreground">
                Uploading file... {uploadProgress}%
              </span>
            </div>
          </motion.div>
        )}
      </motion.div>
    );
  }

  // Drag and drop zone
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="w-full space-y-3"
    >
      <div
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
        onKeyDown={handleKeyDown}
        tabIndex={0}
        role="button"
        aria-label="Upload booking file"
        className={`relative rounded-2xl border-2 border-dashed transition-all duration-300 overflow-hidden group cursor-pointer focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 dark:focus:ring-offset-gray-900 ${
          isDragActive
            ? 'border-primary bg-brand-surface shadow-lg shadow-primary/20'
            : 'border-border-strong hover:border-primary bg-card dark:bg-surface'
        }`}
      >
        {/* Hidden file input */}
        <input
          ref={fileInputRef}
          type="file"
          onChange={handleChange}
          accept={ALLOWED_FORMATS.join(',')}
          disabled={isLoading}
          className="absolute inset-0 cursor-pointer opacity-0 z-10"
          aria-hidden="true"
        />

        {/* Content */}
        <div className="relative z-0 flex flex-col items-center justify-center px-6 py-16 sm:py-24">
          <motion.div
            animate={isDragActive ? { scale: 1.15, y: -5 } : { scale: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className="mb-6"
          >
            <div className="p-4 bg-brand-surface rounded-2xl">
              <Upload className="h-12 w-12 text-brand-text" />
            </div>
          </motion.div>

          <h3 className="text-xl sm:text-2xl font-bold text-foreground mb-2 text-center">
            Drop your file here
          </h3>
          <p className="text-muted-foreground text-center mb-6 max-w-sm text-sm">
            Drag and drop your CSV or Excel file, or click to browse from your computer
          </p>

          {/* File format info */}
          <div className="space-y-3 w-full max-w-sm">
            <div className="flex flex-wrap gap-2 justify-center">
              {ALLOWED_FORMATS.map((format) => (
                <span
                  key={format}
                  className="px-3 py-1.5 bg-muted dark:bg-surface-hover border border-border dark:border-border-strong rounded-lg text-muted-foreground text-xs font-medium"
                >
                  {format.toUpperCase()}
                </span>
              ))}
            </div>

            <p className="text-xs text-subtle-foreground dark:text-muted-foreground text-center">
              Max 10 MB · Max 1,000 rows per file
            </p>
          </div>
        </div>
      </div>

      {/* Validation errors */}
      {(validationError || error) && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-start gap-3 p-4 bg-destructive-surface border border-destructive/30 rounded-lg"
        >
          <AlertCircle className="h-5 w-5 text-destructive flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm font-semibold text-destructive mb-1">
              {validationError?.title || error?.title || 'Error'}
            </p>
            <p className="text-sm text-destructive dark:text-destructive/80">
              {validationError?.message || error?.message}
            </p>
          </div>
        </motion.div>
      )}
    </motion.div>
  );
};

export default FileUploadZone;
