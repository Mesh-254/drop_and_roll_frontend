import { motion } from "framer-motion";
import { AlertCircle, CheckCircle2, Clock, SkipForward } from "lucide-react";

/**
 * BulkUploadProgressBar — real processing progress, never a stand-in for it.
 *
 * What this replaces: the component used to take ({ pct, label, status }) while
 * BulkUploadFlow rendered it as <BulkUploadProgressBar upload={latestUpload} />.
 * The props never matched, so `pct` defaulted to 0 on every render. During
 * processing that hit an "indeterminate" branch and played a shimmer that
 * tracked nothing at all; the moment the status flipped to completed the
 * shimmer switched off and it rendered `{pct}%` — producing the screen that
 * said "Processing complete." directly above "0%".
 *
 * Three rules follow from that:
 *
 *   The percentage comes from the SERVER (`progress_pct`, floored in
 *   BulkUpload.get_progress_pct). A second calculation on the client is a
 *   second source of truth, and the two will disagree eventually — that is
 *   exactly how a batch containing skipped rows used to stall below 100%.
 *
 *   Skipped rows are PROCESSED rows. They matched a booking that already
 *   exists, so there is nothing left to do with them.
 *
 *   There is no indeterminate state. 0% renders as 0% of 43 rows. If the bar
 *   is not moving, the honest thing is to show that it is not moving.
 */
export default function BulkUploadProgressBar({
  upload,
  status = "processing",
  highlight = "orange",
}) {
  const total = upload?.total_rows || 0;
  const successful = upload?.successful || 0;
  const failed = upload?.failed || 0;
  const skipped = upload?.skipped || 0;

  // Clamped: counters are written by a Celery task that can re-run, and a
  // double count must show a full bar rather than "50 of 43".
  const processed = Math.min(total, successful + failed + skipped);
  const remaining = Math.max(0, total - processed);
  const pct = Math.max(0, Math.min(100, upload?.progress_pct ?? 0));

  const isCompleted = status === "completed" || upload?.status === "completed";
  const isFailed = status === "failed" || upload?.status === "failed";

  let barColor = highlight === "blue" ? "from-info to-info" : "from-primary to-primary-hover";
  if (isCompleted) barColor = "from-success to-success";
  if (isFailed) barColor = "from-destructive to-destructive";

  const countLabel = `${processed} of ${total} rows processed`;

  return (
    <div className="w-full space-y-3">
      <div
        role="progressbar"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuetext={`${countLabel}, ${failed} failed`}
        className="relative h-3 bg-surface-hover rounded-full overflow-hidden"
      >
        <motion.div
          className={`absolute inset-y-0 left-0 bg-gradient-to-r ${barColor} rounded-full`}
          initial={{ width: "0%" }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.4, ease: "easeOut" }}
        />
      </div>

      <div className="flex items-center justify-between text-sm">
        <span className="flex items-center gap-2 text-muted-foreground">
          {isCompleted && <CheckCircle2 className="h-4 w-4 text-success" />}
          {countLabel}
        </span>
        <span
          className={`text-xs font-semibold ${
            isCompleted
              ? "text-success"
              : isFailed
                ? "text-destructive"
                : "text-muted-foreground"
          }`}
        >
          {pct}%
        </span>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
        <Tile
          testId="count-successful"
          icon={<CheckCircle2 className="h-3.5 w-3.5" />}
          label="Booked"
          value={successful}
          tone="text-success"
        />
        <Tile
          testId="count-failed"
          icon={<AlertCircle className="h-3.5 w-3.5" />}
          label="Failed"
          value={failed}
          tone="text-destructive"
        />
        <Tile
          testId="count-skipped"
          icon={<SkipForward className="h-3.5 w-3.5" />}
          label="Skipped"
          value={skipped}
          tone="text-subtle-foreground dark:text-muted-foreground"
        />
        <Tile
          testId="count-remaining"
          icon={<Clock className="h-3.5 w-3.5" />}
          label="Remaining"
          value={remaining}
          tone="text-subtle-foreground dark:text-muted-foreground"
        />
      </div>

      {!isCompleted && !isFailed && (
        <p className="text-xs text-subtle-foreground dark:text-muted-foreground">
          You can close this page — processing continues, and we will email you
          when it is ready to review.
        </p>
      )}
    </div>
  );
}

/** One count. Icon AND text, so colour is never the only signal. */
function Tile({ testId, icon, label, value, tone }) {
  return (
    <div className="flex items-center gap-1.5 rounded-md border border-border px-2 py-1.5">
      <span className={tone}>{icon}</span>
      <span className="text-subtle-foreground dark:text-muted-foreground">{label}</span>
      <span data-testid={testId} className={`ml-auto font-semibold ${tone}`}>
        {value}
      </span>
    </div>
  );
}
