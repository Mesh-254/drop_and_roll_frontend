import { motion } from 'framer-motion';
import { CheckCircle2 } from 'lucide-react';

/**
 * BulkUploadProgressBar — animated progress visualization.
 *
 * Displays processing progress with status-aware styling.
 * Shows indeterminate animation when pending.
 */
export default function BulkUploadProgressBar({
  pct = 0,
  label = null,
  status = 'processing',
  estimatedSecondsLeft = null,
}) {
  const isCompleted = status === 'completed';
  const isFailed = status === 'failed';
  const isIndeterminate = pct === 0 && status === 'processing';

  // Determine bar color
  let barColor = 'from-orange-500 to-orange-600';
  if (isCompleted) barColor = 'from-green-500 to-green-600';
  if (isFailed) barColor = 'from-red-500 to-red-600';

  return (
    <div className="w-full space-y-2">
      {/* Progress bar container */}
      <div className="relative h-3 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
        {isIndeterminate ? (
          // Shimmer animation for 0%
          <motion.div
            className={`absolute inset-y-0 left-0 w-1/4 bg-gradient-to-r ${barColor}`}
            animate={{ x: ['0%', '400%'] }}
            transition={{
              duration: 1.5,
              repeat: Infinity,
              ease: 'linear',
            }}
          />
        ) : (
          // Standard progress bar
          <motion.div
            className={`absolute inset-y-0 left-0 bg-gradient-to-r ${barColor} rounded-full`}
            initial={{ width: '0%' }}
            animate={{ width: `${pct}%` }}
            transition={{ duration: 0.6, ease: 'easeOut' }}
          />
        )}
      </div>

      {/* Label and metadata */}
      <div className="flex items-center justify-between text-sm">
        <div className="flex items-center gap-2">
          {isCompleted && <CheckCircle2 className="h-4 w-4 text-green-500" />}
          {label && (
            <span className={`font-medium ${
              isCompleted
                ? 'text-green-600 dark:text-green-400'
                : isFailed
                ? 'text-red-600 dark:text-red-400'
                : 'text-gray-700 dark:text-gray-300'
            }`}>
              {label}
            </span>
          )}
        </div>

        {/* Estimated time remaining */}
        {estimatedSecondsLeft && !isCompleted && !isFailed && (
          <span className="text-xs text-gray-500 dark:text-gray-400">
            ~{Math.ceil(estimatedSecondsLeft / 60)} min remaining
          </span>
        )}

        {/* Percentage display */}
        {!isIndeterminate && (
          <span className={`text-xs font-semibold ${
            isCompleted
              ? 'text-green-600 dark:text-green-400'
              : isFailed
              ? 'text-red-600 dark:text-red-400'
              : 'text-gray-600 dark:text-gray-400'
          }`}>
            {pct}%
          </span>
        )}
      </div>
    </div>
  );
}
