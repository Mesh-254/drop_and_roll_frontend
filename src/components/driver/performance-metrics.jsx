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
    if (averageRating >= 4.5) return "text-success";
    if (averageRating >= 4) return "text-info";
    if (averageRating >= 3.5) return "text-brand-text";
    return "text-destructive";
  };

  const starColor = getStarColor();

  return (
    <div className="bg-gradient-to-br from-brand-surface to-brand-surface/50 dark:from-card dark:to-surface/50 border border-primary/30 rounded-2xl p-6 md:p-8 shadow-sm backdrop-blur-sm">
      {/* Title */}
      <h2 className="text-lg font-semibold text-foreground mb-6">
        Performance Metrics
      </h2>

      {/* Large Centered Rating */}
      <div className="text-center mb-8">
        <div className="flex items-center justify-center gap-3 mb-3">
          {/* Big Star Icon */}
          <Star className={`w-12 h-12 ${starColor} fill-current`} />
        </div>
        <div className="text-5xl md:text-6xl font-bold text-foreground mb-2">
          {averageRating.toFixed(1)}
        </div>
        <p className="text-sm text-muted-foreground">
          Average Rating
        </p>
      </div>

      {/* Two Compact KPI Cards Side-by-Side */}
      <div className="grid grid-cols-1 gap-4">
        {/* Completion Rate */}
        <div className="bg-card dark:bg-surface/50 rounded-xl p-4 border border-border">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Completion Rate
            </span>
            <TrendingUp className="w-4 h-4 text-success" />
          </div>
          <div className="text-3xl font-bold text-foreground">
            {completionRate}%
          </div>
          {/* Simple progress bar */}
          <div className="mt-3 h-2 bg-surface-hover dark:bg-surface rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-success to-success transition-all duration-300"
              style={{ width: `${completionRate}%` }}
            />
          </div>
        </div>

        {/* Jobs Completed This Month */}
        {/* <div className="bg-card dark:bg-surface/50 rounded-xl p-4 border border-border">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Deliveries
            </span>
            <Package className="w-4 h-4 text-brand-text" />
          </div>
          <div className="text-3xl font-bold text-foreground">
            {totalDeliveries}
          </div>
          <p className="text-xs text-subtle-foreground mt-2">
            Total completed
          </p>
        </div> */}
      </div>
    </div>
  );
}
