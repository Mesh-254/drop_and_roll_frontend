import React from "react";
import { Package, ArrowRight, AlertCircle } from "lucide-react";

export function ActiveJobsOverviewCard({
  jobs = [],
  onViewAll,
  className = "",
}) {
  const activeJobs = jobs.filter((job) =>
    ["assigned", "picked_up", "in_transit"].includes(job.status)
  );

  const count = activeJobs.length;

  // Status logic – modern 2025 feel: calm → attention → urgent
  const getStyle = (num) => {
    if (num === 0) {
      return {
        bg: "bg-gradient-to-br from-muted to-muted dark:from-card dark:to-background",
        border: "border-border/70 dark:border-border/60",
        text: "text-muted-foreground",
        accent: "text-subtle-foreground dark:text-muted-foreground",
        iconBg: "bg-surface-hover/70 dark:bg-surface/50",
        iconColor: "text-subtle-foreground dark:text-muted-foreground",
        label: "All clear",
      };
    }
    if (num <= 3) {
      return {
        bg: "bg-gradient-to-br from-success-surface/80 to-success-surface/60 dark:from-success-surface/40 dark:to-success-surface/30",
        border: "border-success/30",
        text: "text-success",
        accent: "text-success",
        iconBg: "bg-success-surface",
        iconColor: "text-success",
        label: "Smooth sailing",
      };
    }
    if (num <= 8) {
      return {
        bg: "bg-gradient-to-br from-warning-surface/80 to-warning-surface/60 dark:from-warning-surface/40 dark:to-warning-surface/30",
        border: "border-warning/30",
        text: "text-warning",
        accent: "text-warning",
        iconBg: "bg-warning-surface",
        iconColor: "text-warning",
        label: "Busy but manageable",
      };
    }
    return {
      bg: "bg-gradient-to-br from-destructive-surface/80 to-destructive-surface/60 dark:from-destructive-surface/40 dark:to-destructive-surface/30",
      border: "border-destructive/30",
      text: "text-destructive",
      accent: "text-destructive",
      iconBg: "bg-destructive-surface",
      iconColor: "text-destructive",
      label: "High volume – check now",
      showAlert: true,
    };
  };

  const style = getStyle(count);

  return (
    <div
      className={`
        group relative overflow-hidden
        ${style.bg}
        border ${style.border}
        rounded-2xl sm:rounded-3xl
        p-6 sm:p-8 md:p-10
        shadow-sm hover:shadow-xl
        transition-all duration-400 ease-out
        backdrop-blur-[2px]
        ${className}
      `}
    >
      {/* Subtle animated gradient orb (modern touch) */}
      <div
        className="absolute -right-20 -top-20 w-64 h-64 rounded-full bg-gradient-to-br from-card/10 to-transparent dark:from-background/10 opacity-70 blur-3xl group-hover:scale-110 transition-transform duration-700"
      />

      <div className="relative flex flex-col items-center text-center gap-5 sm:gap-6">
        {/* Icon + Count – dominant visual */}
        <div className="flex items-center gap-5 sm:gap-6">
          <div
            className={`
              w-20 h-20 sm:w-24 sm:h-24 rounded-2xl sm:rounded-3xl
              ${style.iconBg}
              flex items-center justify-center
              shadow-inner ring-1 ring-inset ring-border-strong/5
              transition-transform group-hover:scale-105
            `}
          >
            <Package className={`w-10 h-10 sm:w-12 sm:h-12 ${style.iconColor}`} strokeWidth={1.8} />
          </div>

          <div className="flex flex-col items-start">
            <p className="text-base sm:text-lg font-medium uppercase tracking-wider text-subtle-foreground dark:text-muted-foreground">
              Active Jobs
            </p>
            <p
              className={`
                text-6xl sm:text-7xl md:text-8xl font-extrabold tracking-tight
                ${style.text}
                leading-none
              `}
            >
              {count}
            </p>
          </div>
        </div>

        {/* Status label + optional alert */}
        <div className="flex items-center gap-2.5">
          {style.showAlert && (
            <AlertCircle className={`w-5 h-5 ${style.accent} animate-pulse`} />
          )}
          <p className={`text-base sm:text-lg font-semibold ${style.accent}`}>
            {style.label}
          </p>
        </div>

        {/* CTA – prominent when jobs exist */}
        {count > 0 ? (
          <button
            onClick={onViewAll}
            className={`
              mt-3 sm:mt-5 px-7 sm:px-9 py-3.5 sm:py-4 rounded-full
              bg-card/90
              backdrop-blur-sm
              border border-border/70 dark:border-border/60
              text-base sm:text-lg font-semibold ${style.text}
              shadow-md hover:shadow-lg hover:scale-[1.03]
              transition-all duration-300 flex items-center gap-2.5
              ring-1 ring-inset ring-border-strong/5
            `}
          >
            View All Active Jobs
            <ArrowRight className="w-5 h-5" />
          </button>
        ) : (
          <p className="text-sm sm:text-base text-subtle-foreground dark:text-muted-foreground mt-2 max-w-xs">
            No deliveries in progress — new jobs will show here instantly
          </p>
        )}
      </div>
    </div>
  );
}