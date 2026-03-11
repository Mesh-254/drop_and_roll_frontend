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
        bg: "bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-950",
        border: "border-slate-200/70 dark:border-slate-800/60",
        text: "text-slate-700 dark:text-slate-300",
        accent: "text-slate-500 dark:text-slate-400",
        iconBg: "bg-slate-200/70 dark:bg-slate-800/50",
        iconColor: "text-slate-500 dark:text-slate-400",
        label: "All clear",
      };
    }
    if (num <= 3) {
      return {
        bg: "bg-gradient-to-br from-emerald-50/80 to-emerald-100/60 dark:from-emerald-950/40 dark:to-emerald-900/30",
        border: "border-emerald-200/60 dark:border-emerald-800/40",
        text: "text-emerald-800 dark:text-emerald-200",
        accent: "text-emerald-600 dark:text-emerald-400",
        iconBg: "bg-emerald-100 dark:bg-emerald-900/40",
        iconColor: "text-emerald-600 dark:text-emerald-400",
        label: "Smooth sailing",
      };
    }
    if (num <= 8) {
      return {
        bg: "bg-gradient-to-br from-amber-50/80 to-amber-100/60 dark:from-amber-950/40 dark:to-amber-900/30",
        border: "border-amber-200/60 dark:border-amber-800/40",
        text: "text-amber-800 dark:text-amber-200",
        accent: "text-amber-600 dark:text-amber-400",
        iconBg: "bg-amber-100 dark:bg-amber-900/40",
        iconColor: "text-amber-600 dark:text-amber-400",
        label: "Busy but manageable",
      };
    }
    return {
      bg: "bg-gradient-to-br from-rose-50/80 to-rose-100/60 dark:from-rose-950/40 dark:to-rose-900/30",
      border: "border-rose-200/60 dark:border-rose-800/40",
      text: "text-rose-800 dark:text-rose-200",
      accent: "text-rose-600 dark:text-rose-400",
      iconBg: "bg-rose-100 dark:bg-rose-900/40",
      iconColor: "text-rose-600 dark:text-rose-400",
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
        className="absolute -right-20 -top-20 w-64 h-64 rounded-full bg-gradient-to-br from-white/10 to-transparent dark:from-black/10 opacity-70 blur-3xl group-hover:scale-110 transition-transform duration-700"
      />

      <div className="relative flex flex-col items-center text-center gap-5 sm:gap-6">
        {/* Icon + Count – dominant visual */}
        <div className="flex items-center gap-5 sm:gap-6">
          <div
            className={`
              w-20 h-20 sm:w-24 sm:h-24 rounded-2xl sm:rounded-3xl
              ${style.iconBg}
              flex items-center justify-center
              shadow-inner ring-1 ring-inset ring-black/5 dark:ring-white/5
              transition-transform group-hover:scale-105
            `}
          >
            <Package className={`w-10 h-10 sm:w-12 sm:h-12 ${style.iconColor}`} strokeWidth={1.8} />
          </div>

          <div className="flex flex-col items-start">
            <p className="text-base sm:text-lg font-medium uppercase tracking-wider text-slate-500 dark:text-slate-400">
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
              bg-white/90 dark:bg-slate-900/80
              backdrop-blur-sm
              border border-slate-200/70 dark:border-slate-700/60
              text-base sm:text-lg font-semibold ${style.text}
              shadow-md hover:shadow-lg hover:scale-[1.03]
              transition-all duration-300 flex items-center gap-2.5
              ring-1 ring-inset ring-black/5 dark:ring-white/5
            `}
          >
            View All Active Jobs
            <ArrowRight className="w-5 h-5" />
          </button>
        ) : (
          <p className="text-sm sm:text-base text-slate-500 dark:text-slate-400 mt-2 max-w-xs">
            No deliveries in progress — new jobs will show here instantly
          </p>
        )}
      </div>
    </div>
  );
}