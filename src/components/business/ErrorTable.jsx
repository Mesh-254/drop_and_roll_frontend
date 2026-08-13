import { motion, AnimatePresence } from 'framer-motion';
import { Copy, Check, Loader2, Download, RotateCcw, AlertCircle } from 'lucide-react';
import { useState } from 'react';

/**
 * ErrorTable — displays paginated failed rows from a bulk upload.
 *
 * Expects the rich per-row shape returned by
 * GET /api/booking/bulk-uploads/{id}/errors/ :
 *   {
 *     id, row_number, row_reference,
 *     errors: [{ column_name, error_message, error_code, suggested_fix, raw_value }],
 *     raw_data: { ...original CSV row... },
 *   }
 *
 * A single row can fail on more than one column, so each row renders as a
 * small group with one line per error — Column, Error Message, Suggested
 * Fix, and a snippet of the raw value that caused it.
 *
 * Features:
 * - Row-level grouping of per-column errors
 * - Copy-to-clipboard (single row / all rows)
 * - Pagination (driven by the parent's meta/onPageChange)
 * - Download report + retry buttons
 * - Responsive design (columns collapse on mobile)
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
  const [copiedRowId, setCopiedRowId] = useState(null);

  const formatRow = (row) => {
    const ref = row.row_reference ? ` (${row.row_reference})` : '';
    const lines = (row.errors || []).map(
      (e) => `  • [${e.column_name}] ${e.error_message}${e.suggested_fix ? ` — Fix: ${e.suggested_fix}` : ''}`,
    );
    return `Row ${row.row_number}${ref}:\n${lines.join('\n')}`;
  };

  const copyRow = (row) => {
    navigator.clipboard.writeText(formatRow(row));
    setCopiedRowId(row.id ?? row.row_number);
    setTimeout(() => setCopiedRowId(null), 1500);
  };

  const copyAllErrors = () => {
    const allText = errors.map(formatRow).join('\n\n');
    navigator.clipboard.writeText(allText);
  };

  const truncate = (value, max = 40) => {
    if (value === null || value === undefined || value === '') return '—';
    const str = String(value);
    return str.length > max ? `${str.slice(0, max)}…` : str;
  };

  const pageSize = meta?.page_size || 20;
  const totalPages = meta?.total ? Math.ceil(meta.total / pageSize) : 1;
  const currentPage = meta?.page || 1;

  return (
    <div className="space-y-4">
      {/* Action bar */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
        <div className="text-sm text-muted-foreground">
          Showing {errors.length > 0 ? (currentPage - 1) * pageSize + 1 : 0}–
          {Math.min(currentPage * pageSize, meta?.total || 0)} of {meta?.total || 0} failed rows
        </div>
        <div className="flex gap-2 w-full sm:w-auto">
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={copyAllErrors}
            disabled={errors.length === 0}
            className="flex-1 sm:flex-none px-3 py-2 text-sm font-medium rounded-lg border border-border-strong text-muted-foreground hover:bg-muted dark:hover:bg-surface-hover/50 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 flex items-center justify-center gap-2"
          >
            <Copy className="h-4 w-4" />
            <span className="hidden sm:inline">Copy All</span>
          </motion.button>
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={onDownloadCSV}
            disabled={errors.length === 0}
            className="flex-1 sm:flex-none px-3 py-2 text-sm font-medium rounded-lg border border-border-strong text-muted-foreground hover:bg-muted dark:hover:bg-surface-hover/50 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 flex items-center justify-center gap-2"
          >
            <Download className="h-4 w-4" />
            <span className="hidden sm:inline">Download</span>
          </motion.button>
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={onRetry}
            disabled={errors.length === 0 || isRetrying}
            className="flex-1 sm:flex-none px-3 py-2 text-sm font-medium rounded-lg bg-primary hover:bg-primary-hover text-primary-foreground disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 flex items-center justify-center gap-2"
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
      <div className="overflow-x-auto border border-border rounded-lg">
        {isLoading ? (
          <div className="space-y-2 p-4">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-12 bg-surface-hover rounded animate-pulse" />
            ))}
          </div>
        ) : errors.length === 0 ? (
          <div className="p-8 text-center text-subtle-foreground dark:text-muted-foreground">
            <div className="text-success text-xl mb-2">✓</div>
            <p>No failed rows — everything processed successfully!</p>
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-border bg-muted dark:bg-surface/50">
                <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground w-16">
                  Row
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground hidden md:table-cell">
                  Column
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground">
                  Error Message
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground hidden lg:table-cell">
                  Suggested Fix
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground hidden lg:table-cell">
                  Raw Value
                </th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-muted-foreground w-12">
                  Copy
                </th>
              </tr>
            </thead>

            <tbody>
              <AnimatePresence>
                {errors.map((row) => {
                  const rowErrors = row.errors && row.errors.length > 0
                    ? row.errors
                    : [{ column_name: 'unknown', error_message: 'Row failed — see original file.', suggested_fix: '', raw_value: '' }];

                  return rowErrors.map((err, errIdx) => (
                    <motion.tr
                      key={`${row.id ?? row.row_number}-${errIdx}`}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="border-b border-border hover:bg-destructive-surface transition-colors align-top"
                    >
                      {errIdx === 0 ? (
                        <td
                          className="px-4 py-3 text-sm font-mono text-subtle-foreground dark:text-muted-foreground align-top"
                          rowSpan={rowErrors.length}
                        >
                          <div>{row.row_number}</div>
                          {row.row_reference && (
                            <div className="text-[10px] text-muted-foreground truncate max-w-[80px]" title={row.row_reference}>
                              {row.row_reference}
                            </div>
                          )}
                        </td>
                      ) : null}
                      <td className="px-4 py-3 text-xs font-mono text-muted-foreground hidden md:table-cell whitespace-nowrap">
                        {err.column_name || '—'}
                      </td>
                      <td className="px-4 py-3 text-sm">
                        <div className="flex items-start gap-2 text-destructive">
                          <AlertCircle className="h-3.5 w-3.5 flex-shrink-0 mt-0.5" />
                          <span className="text-xs">{err.error_message}</span>
                        </div>
                        {/* Column shown inline on small screens where its column is hidden */}
                        <div className="text-[10px] text-muted-foreground mt-1 md:hidden">
                          Column: {err.column_name || '—'}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground hidden lg:table-cell">
                        {err.suggested_fix || '—'}
                      </td>
                      <td
                        className="px-4 py-3 text-xs font-mono text-subtle-foreground dark:text-muted-foreground hidden lg:table-cell"
                        title={err.raw_value ? String(err.raw_value) : undefined}
                      >
                        {truncate(err.raw_value)}
                      </td>
                      {errIdx === 0 ? (
                        <td className="px-4 py-3 text-center align-top" rowSpan={rowErrors.length}>
                          <motion.button
                            whileHover={{ scale: 1.1 }}
                            whileTap={{ scale: 0.9 }}
                            onClick={() => copyRow(row)}
                            className="inline-flex items-center justify-center p-1 rounded hover:bg-surface-hover transition-colors"
                            title="Copy errors for this row"
                          >
                            {copiedRowId === (row.id ?? row.row_number) ? (
                              <Check className="h-4 w-4 text-success" />
                            ) : (
                              <Copy className="h-4 w-4 text-subtle-foreground dark:text-muted-foreground" />
                            )}
                          </motion.button>
                        </td>
                      ) : null}
                    </motion.tr>
                  ));
                })}
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
            className="px-3 py-2 rounded border border-border-strong text-sm font-medium text-muted-foreground hover:bg-muted dark:hover:bg-surface-hover/50 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
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
                    ? 'bg-primary text-foreground'
                    : 'border border-border-strong text-muted-foreground hover:bg-muted dark:hover:bg-surface-hover/50'
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
            className="px-3 py-2 rounded border border-border-strong text-sm font-medium text-muted-foreground hover:bg-muted dark:hover:bg-surface-hover/50 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
          >
            Next →
          </motion.button>
        </div>
      )}
    </div>
  );
}
