import { motion, AnimatePresence } from 'framer-motion';
import { Copy, Check, Loader2, Download, RotateCcw } from 'lucide-react';
import { useState } from 'react';

/**
 * ErrorTable — displays paginated failed rows from bulk upload.
 *
 * Features:
 * - Row-level error display with copy-to-clipboard
 * - Pagination
 * - Copy all errors
 * - Download report + retry buttons
 * - Responsive design (hide reference col on mobile)
 */
export default function ErrorTable({
  errors = [],
  meta = {},
  onPageChange = () => {},
  isLoading = false,
  onDownloadCSV = () => {},
  onRetry = () => {},
  isRetrying = false,
}) {
  const [copiedRowIndex, setCopiedRowIndex] = useState(null);

  const copyRowErrors = (rowIndex, rowErrors) => {
    const rowRef = errors[rowIndex]?.row_reference || `Row ${rowIndex}`;
    const text = rowErrors.map((err) => `• ${err}`).join('\n');
    const fullText = `${rowRef}:\n${text}`;

    navigator.clipboard.writeText(fullText);
    setCopiedRowIndex(rowIndex);
    setTimeout(() => setCopiedRowIndex(null), 1500);
  };

  const copyAllErrors = () => {
    const allText = errors
      .map((row) => {
        const ref = row.row_reference || `Row ${row.row_number}`;
        const errs = row.errors.map((e) => `  • ${e}`).join('\n');
        return `${ref}:\n${errs}`;
      })
      .join('\n\n');

    navigator.clipboard.writeText(allText);
    // Show toast or brief visual feedback here
  };

  const isLoaded = !isLoading && errors.length >= 0;
  const pageSize = meta?.page_size || 50;
  const totalPages = meta?.total ? Math.ceil(meta.total / pageSize) : 1;
  const currentPage = meta?.page || 1;

  return (
    <div className="space-y-4">
      {/* Action bar */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
        <div className="text-sm text-gray-600 dark:text-gray-400">
          Showing {errors.length > 0 ? (currentPage - 1) * pageSize + 1 : 0}–
          {Math.min(currentPage * pageSize, meta?.total || 0)} of {meta?.total || 0} failed rows
        </div>
        <div className="flex gap-2 w-full sm:w-auto">
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={copyAllErrors}
            disabled={errors.length === 0}
            className="flex-1 sm:flex-none px-3 py-2 text-sm font-medium rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700/50 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 flex items-center justify-center gap-2"
          >
            <Copy className="h-4 w-4" />
            <span className="hidden sm:inline">Copy All</span>
          </motion.button>
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={onDownloadCSV}
            disabled={errors.length === 0}
            className="flex-1 sm:flex-none px-3 py-2 text-sm font-medium rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700/50 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 flex items-center justify-center gap-2"
          >
            <Download className="h-4 w-4" />
            <span className="hidden sm:inline">Download</span>
          </motion.button>
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={onRetry}
            disabled={errors.length === 0 || isRetrying}
            className="flex-1 sm:flex-none px-3 py-2 text-sm font-medium rounded-lg bg-orange-500 hover:bg-orange-600 text-white disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 flex items-center justify-center gap-2"
          >
            {isRetrying ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RotateCcw className="h-4 w-4" />
            )}
            <span className="hidden sm:inline">{isRetrying ? 'Retrying...' : 'Retry'}</span>
          </motion.button>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto border border-gray-200 dark:border-gray-700 rounded-lg">
        {isLoading ? (
          // Loading skeletons
          <div className="space-y-2 p-4">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-12 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
            ))}
          </div>
        ) : errors.length === 0 ? (
          // Empty state
          <div className="p-8 text-center text-gray-500 dark:text-gray-400">
            <div className="text-green-600 dark:text-green-400 text-xl mb-2">✓</div>
            <p>No failed rows — everything processed successfully!</p>
          </div>
        ) : (
          <table className="w-full">
            {/* Header */}
            <thead>
              <tr className="border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 w-16">
                  Row
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 hidden sm:table-cell">
                  Reference
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 dark:text-gray-300">
                  Errors
                </th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-gray-700 dark:text-gray-300 w-12">
                  Copy
                </th>
              </tr>
            </thead>

            {/* Body */}
            <tbody>
              <AnimatePresence>
                {errors.map((row, idx) => (
                  <motion.tr
                    key={`${row.row_number}-${idx}`}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="border-b border-gray-200 dark:border-gray-700 hover:bg-red-50 dark:hover:bg-red-900/10 transition-colors"
                  >
                    <td className="px-4 py-3 text-sm font-mono text-gray-500 dark:text-gray-400">
                      {row.row_number}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300 hidden sm:table-cell">
                      {row.row_reference || '—'}
                    </td>
                    <td className="px-4 py-3 text-sm space-y-1">
                      {row.errors && row.errors.length > 0 ? (
                        <ul className="space-y-1">
                          {row.errors.map((error, errIdx) => (
                            <li
                              key={errIdx}
                              className="flex items-start gap-2 text-red-600 dark:text-red-400"
                            >
                              <span className="text-red-500 flex-shrink-0 mt-0.5">●</span>
                              <span className="text-xs">{error}</span>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <span className="text-gray-400">No details</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <motion.button
                        whileHover={{ scale: 1.1 }}
                        whileTap={{ scale: 0.9 }}
                        onClick={() => copyRowErrors(idx, row.errors || [])}
                        className="inline-flex items-center justify-center p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                        title="Copy errors"
                      >
                        {copiedRowIndex === idx ? (
                          <Check className="h-4 w-4 text-green-500" />
                        ) : (
                          <Copy className="h-4 w-4 text-gray-500 dark:text-gray-400" />
                        )}
                      </motion.button>
                    </td>
                  </motion.tr>
                ))}
              </AnimatePresence>
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination */}
      {errors.length > 0 && totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => onPageChange(Math.max(1, currentPage - 1))}
            disabled={currentPage === 1}
            className="px-3 py-2 rounded border border-gray-300 dark:border-gray-600 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700/50 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
          >
            ← Prev
          </motion.button>

          <div className="flex items-center gap-1">
            {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
              <motion.button
                key={page}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => onPageChange(page)}
                className={`px-2 py-1 rounded text-sm font-medium transition-all ${
                  page === currentPage
                    ? 'bg-orange-500 text-white'
                    : 'border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700/50'
                }`}
              >
                {page}
              </motion.button>
            ))}
          </div>

          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
            disabled={currentPage === totalPages}
            className="px-3 py-2 rounded border border-gray-300 dark:border-gray-600 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700/50 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
          >
            Next →
          </motion.button>
        </div>
      )}
    </div>
  );
}
