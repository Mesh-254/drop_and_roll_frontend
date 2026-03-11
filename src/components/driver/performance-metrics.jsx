import React from "react";
import { Star, TrendingUp, Package } from "lucide-react";

export function PerformanceMetrics({ metrics = {} }) {
  const {
    averageRating = 0,
    completionRate = 0,
    totalDeliveries = 0,
  } = metrics;

  // Determine star rating color based on rating value
  const getStarColor = () => {
    if (averageRating >= 4.5) return "text-green-500";
    if (averageRating >= 4) return "text-blue-500";
    if (averageRating >= 3.5) return "text-orange-500";
    return "text-red-500";
  };

  const starColor = getStarColor();

  return (
    <div className="bg-gradient-to-br from-orange-50 to-orange-50/50 dark:from-slate-900 dark:to-slate-800/50 border border-orange-200/50 dark:border-orange-900/30 rounded-2xl p-6 md:p-8 shadow-sm backdrop-blur-sm">
      {/* Title */}
      <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-6">
        Performance Metrics
      </h2>

      {/* Large Centered Rating */}
      <div className="text-center mb-8">
        <div className="flex items-center justify-center gap-3 mb-3">
          {/* Big Star Icon */}
          <Star className={`w-12 h-12 ${starColor} fill-current`} />
        </div>
        <div className="text-5xl md:text-6xl font-bold text-slate-900 dark:text-white mb-2">
          {averageRating.toFixed(1)}
        </div>
        <p className="text-sm text-slate-600 dark:text-slate-400">
          Average Rating
        </p>
      </div>

      {/* Two Compact KPI Cards Side-by-Side */}
      <div className="grid grid-cols-2 gap-4">
        {/* Completion Rate */}
        <div className="bg-white dark:bg-slate-800/50 rounded-xl p-4 border border-slate-200 dark:border-slate-700">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-medium text-slate-600 dark:text-slate-400 uppercase tracking-wide">
              Completion Rate
            </span>
            <TrendingUp className="w-4 h-4 text-orange-500" />
          </div>
          <div className="text-3xl font-bold text-slate-900 dark:text-white">
            {completionRate}%
          </div>
          {/* Simple progress bar */}
          <div className="mt-3 h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-orange-500 to-orange-600 transition-all duration-300"
              style={{ width: `${completionRate}%` }}
            />
          </div>
        </div>

        {/* Jobs Completed This Month */}
        <div className="bg-white dark:bg-slate-800/50 rounded-xl p-4 border border-slate-200 dark:border-slate-700">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-medium text-slate-600 dark:text-slate-400 uppercase tracking-wide">
              Deliveries
            </span>
            <Package className="w-4 h-4 text-orange-500" />
          </div>
          <div className="text-3xl font-bold text-slate-900 dark:text-white">
            {totalDeliveries}
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-500 mt-2">
            Total completed
          </p>
        </div>
      </div>
    </div>
  );
}
