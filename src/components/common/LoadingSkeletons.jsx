/**
 * LoadingSkeletons.jsx
 * ════════════════════════════════════════════════════════════════════════════════
 *
 * Reusable loading skeleton components for better perceived performance.
 * These replace actual content while data is loading, reducing cumulative
 * layout shift and providing visual feedback to users.
 */

import { motion } from "framer-motion";

/**
 * TableSkeleton — Simulates a loading table with rows
 */
export function TableSkeleton({ rows = 5, columns = 4 }) {
  return (
    <div className="space-y-3 p-4">
      {Array.from({ length: rows }).map((_, rowIdx) => (
        <div key={rowIdx} className="grid gap-4 mb-3" style={{ gridTemplateColumns: `repeat(${columns}, 1fr)` }}>
          {Array.from({ length: columns }).map((_, colIdx) => (
            <motion.div
              key={colIdx}
              animate={{ opacity: [0.5, 1, 0.5] }}
              transition={{ duration: 1.5, repeat: Infinity }}
              className="h-4 bg-gray-200 dark:bg-gray-700 rounded"
            />
          ))}
        </div>
      ))}
    </div>
  );
}

/**
 * StatCardSkeleton — Simulates loading stat cards
 */
export function StatCardSkeleton({ count = 4 }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      {Array.from({ length: count }).map((_, idx) => (
        <motion.div
          key={idx}
          animate={{ opacity: [0.5, 1, 0.5] }}
          transition={{ duration: 1.5, repeat: Infinity }}
          className="p-6 bg-gray-200 dark:bg-gray-700 rounded-2xl h-24"
        />
      ))}
    </div>
  );
}

/**
 * UploadRowSkeleton — Simulates loading upload list row
 */
export function UploadRowSkeleton({ count = 5 }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: count }).map((_, idx) => (
        <motion.div
          key={idx}
          animate={{ opacity: [0.5, 1, 0.5] }}
          transition={{ duration: 1.5, repeat: Infinity }}
          className="grid grid-cols-1 sm:grid-cols-12 gap-4 p-4 bg-gray-200 dark:bg-gray-700 rounded-lg h-20"
        />
      ))}
    </div>
  );
}

/**
 * DetailPageSkeleton — Full detail page loading state
 */
export function DetailPageSkeleton() {
  return (
    <div className="space-y-8 animate-pulse">
      {/* Header */}
      <div className="h-12 bg-gray-200 dark:bg-gray-700 rounded-lg w-1/3" />
      
      {/* Stepper */}
      <div className="flex gap-4">
        {Array.from({ length: 4 }).map((_, idx) => (
          <div key={idx} className="flex flex-col items-center gap-2">
            <div className="h-8 w-8 bg-gray-200 dark:bg-gray-700 rounded-full" />
            <div className="h-2 w-16 bg-gray-200 dark:bg-gray-700 rounded" />
          </div>
        ))}
      </div>

      {/* Stats Grid */}
      <StatCardSkeleton count={4} />

      {/* Tabs */}
      <div className="flex gap-4 border-b border-gray-200 dark:border-gray-700">
        {Array.from({ length: 3 }).map((_, idx) => (
          <div key={idx} className="h-4 w-20 bg-gray-200 dark:bg-gray-700 rounded" />
        ))}
      </div>

      {/* Content area */}
      <TableSkeleton rows={6} columns={3} />
    </div>
  );
}

/**
 * PaginationSkeleton — Loading state for pagination controls
 */
export function PaginationSkeleton() {
  return (
    <div className="flex items-center justify-between p-4">
      <div className="h-4 w-48 bg-gray-200 dark:bg-gray-700 rounded" />
      <div className="flex gap-2">
        {Array.from({ length: 5 }).map((_, idx) => (
          <div key={idx} className="h-8 w-8 bg-gray-200 dark:bg-gray-700 rounded" />
        ))}
      </div>
    </div>
  );
}

/**
 * FormSkeleton — Loading state for form inputs
 */
export function FormSkeleton({ fieldCount = 4 }) {
  return (
    <div className="space-y-4">
      {Array.from({ length: fieldCount }).map((_, idx) => (
        <div key={idx} className="space-y-2">
          <div className="h-4 w-24 bg-gray-200 dark:bg-gray-700 rounded" />
          <div className="h-10 bg-gray-200 dark:bg-gray-700 rounded" />
        </div>
      ))}
    </div>
  );
}

/**
 * BannerSkeleton — Loading state for info/alert banners
 */
export function BannerSkeleton() {
  return (
    <motion.div
      animate={{ opacity: [0.5, 1, 0.5] }}
      transition={{ duration: 1.5, repeat: Infinity }}
      className="p-6 bg-gray-200 dark:bg-gray-700 rounded-lg h-20"
    />
  );
}

/**
 * ProgressBarSkeleton — Loading state for progress indicator
 */
export function ProgressBarSkeleton() {
  return (
    <div className="space-y-2">
      <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded-full" />
      <div className="h-4 w-32 bg-gray-200 dark:bg-gray-700 rounded" />
    </div>
  );
}
