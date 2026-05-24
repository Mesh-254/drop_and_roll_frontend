import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, AlertTriangle, AlertCircle, FileText } from 'lucide-react';

const ErrorSummary = ({ 
  errors = [],
  isLoading = false,
  totalErrors = 0,
  currentPage = 1,
  pageSize = 20,
  onPageChange = () => {}
}) => {
  const [expandedIndex, setExpandedIndex] = useState(null);
  
  const totalPages = Math.ceil(totalErrors / pageSize);
  const startRow = (currentPage - 1) * pageSize + 1;
  const endRow = Math.min(currentPage * pageSize, totalErrors);

  if (totalErrors === 0) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-xl p-6 text-center"
      >
        <CheckCircle className="h-12 w-12 text-green-600 dark:text-green-400 mx-auto mb-3" />
        <p className="text-sm font-semibold text-green-900 dark:text-green-100">
          All records validated successfully
        </p>
        <p className="text-xs text-green-700 dark:text-green-300 mt-1">
          No errors found. Ready to proceed.
        </p>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="w-full"
    >
      {/* Error Summary Header */}
      <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-4 mb-4">
        <div className="flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm font-semibold text-amber-900 dark:text-amber-100">
              {totalErrors} validation error{totalErrors !== 1 ? 's' : ''} found
            </p>
            <p className="text-xs text-amber-700 dark:text-amber-300 mt-1">
              Review and fix errors before submitting. Showing {startRow}–{endRow} of {totalErrors}
            </p>
          </div>
        </div>
      </div>

      {/* Error List */}
      <div className="space-y-2 mb-4">
        <AnimatePresence>
          {errors.map((error, index) => (
            <motion.div
              key={`${currentPage}-${index}`}
              initial={{ opacity: 0, y: -5 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -5 }}
              transition={{ delay: index * 0.05 }}
              className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden bg-white dark:bg-gray-800"
            >
              <button
                onClick={() => setExpandedIndex(expandedIndex === index ? null : index)}
                className="w-full px-4 py-3 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors text-left"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                    Row {error.row_number || error.row}: {error.field || 'General'}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 truncate">
                    {error.message || error.detail || 'Validation error'}
                  </p>
                </div>
                <motion.div
                  animate={{ rotate: expandedIndex === index ? 180 : 0 }}
                  transition={{ duration: 0.2 }}
                  className="ml-2 flex-shrink-0"
                >
                  <ChevronDown className="h-4 w-4 text-gray-400 dark:text-gray-500" />
                </motion.div>
              </button>

              <AnimatePresence>
                {expandedIndex === index && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50 px-4 py-3"
                  >
                    <div className="space-y-2 text-xs">
                      {error.message && (
                        <div>
                          <p className="text-gray-600 dark:text-gray-400 font-medium">Error:</p>
                          <p className="text-gray-700 dark:text-gray-300 font-mono bg-white dark:bg-gray-800 p-2 rounded mt-1">
                            {error.message}
                          </p>
                        </div>
                      )}
                      {error.suggestion && (
                        <div>
                          <p className="text-gray-600 dark:text-gray-400 font-medium">Suggestion:</p>
                          <p className="text-amber-700 dark:text-amber-300 mt-1">
                            {error.suggestion}
                          </p>
                        </div>
                      )}
                      {error.value && (
                        <div>
                          <p className="text-gray-600 dark:text-gray-400 font-medium">Current value:</p>
                          <p className="text-gray-700 dark:text-gray-300 font-mono bg-white dark:bg-gray-800 p-2 rounded mt-1">
                            {error.value}
                          </p>
                        </div>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          ))}
        </AnimatePresence>

        {isLoading && (
          <div className="flex items-center justify-center py-8">
            <div className="flex flex-col items-center gap-2">
              <div className="animate-spin h-5 w-5 border-2 border-orange-500 border-t-transparent rounded-full" />
              <span className="text-sm text-gray-500 dark:text-gray-400">Loading errors...</span>
            </div>
          </div>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between pt-4 border-t border-gray-200 dark:border-gray-700">
          <button
            onClick={() => onPageChange(currentPage - 1)}
            disabled={currentPage === 1}
            className="px-3 py-2 text-sm font-medium rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700/50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            Previous
          </button>

          <span className="text-xs text-gray-600 dark:text-gray-400">
            Page {currentPage} of {totalPages}
          </span>

          <button
            onClick={() => onPageChange(currentPage + 1)}
            disabled={currentPage === totalPages}
            className="px-3 py-2 text-sm font-medium rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700/50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            Next
          </button>
        </div>
      )}
    </motion.div>
  );
};

// Placeholder icon - add to imports or create
const CheckCircle = ({ className }) => (
  <svg className={className} fill="currentColor" viewBox="0 0 20 20">
    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
  </svg>
);

export default ErrorSummary;
