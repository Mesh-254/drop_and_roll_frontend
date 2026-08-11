/**
 * components/business/BulkUploadReviewPage.jsx
 * ══════════════════════════════════════════════════════════════════════════════
 * The step between processing and paying.
 *
 * Before this screen existed, a batch where 30 of 43 rows failed took the
 * customer straight to a payment prompt (prepaid) or showed them an invoice
 * that had already been raised (NET). The first thing they learned about a
 * mostly-broken upload was the bill.
 *
 * So: three tabs, downloads for each, and nothing billable happens until the
 * footer button is pressed. The backend enforces the same rule — paying a batch
 * in awaiting_review returns 409 — because a screen that merely declines to
 * offer a button is not a guarantee.
 *
 * Two details that carry more weight than they look:
 *
 *   The Skipped tab names the booking and batch each row matched. Skipping is
 *   invisible by nature: the customer sees a row they sent and no delivery
 *   against it. Without the evidence, a correct skip and a bug look identical.
 *
 *   NET shows a live countdown to auto-effect. The batch invoices and dispatches
 *   itself if nobody confirms, which is only fair if the deadline is on screen
 *   before it passes.
 */

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { motion } from "framer-motion";
import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  Download,
  Loader2,
  SkipForward,
  Upload,
} from "lucide-react";
import toast from "react-hot-toast";
import BulkUploadApi from "../../api/BulkUploadApi";

const TABS = [
  { key: "failed", label: "Failed", icon: AlertCircle, tone: "text-red-400" },
  { key: "successful", label: "Booked", icon: CheckCircle2, tone: "text-green-400" },
  { key: "skipped", label: "Skipped", icon: SkipForward, tone: "text-slate-400" },
];

const money = (v) => `£${Number(v || 0).toFixed(2)}`;

/** Minutes until `iso`, floored at 0. Null when there is no deadline. */
function minutesUntil(iso) {
  if (!iso) return null;
  const ms = new Date(iso).getTime() - Date.now();
  return Math.max(0, Math.floor(ms / 60000));
}

export default function BulkUploadReviewPage({ uploadId = null, embedded = false }) {
  // Two mounts, one implementation: the /bulk-upload/:id/review route and the
  // wizard's fifth step. Rendering different components in the two places is how
  // "you can close this page and come back" quietly stops being true.
  const params = useParams();
  const id = uploadId || params.id;
  const navigate = useNavigate();

  const [upload, setUpload] = useState(null);
  const [rows, setRows] = useState({ failed: [], successful: [], skipped: [] });
  const [tab, setTab] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isContinuing, setIsContinuing] = useState(false);
  const [loadError, setLoadError] = useState(null);
  const [now, setNow] = useState(Date.now());

  const load = useCallback(async () => {
    try {
      const detail = await BulkUploadApi.getUpload(id);
      setUpload(detail);
      // Default to the tab that most needs attention. A customer who opens this
      // screen because 30 rows failed should not have to go looking for them.
      setTab((t) => t ?? (detail.failed > 0 ? "failed" : "successful"));

      const [failed, successful, skipped] = await Promise.all([
        BulkUploadApi.getErrors(id).catch(() => ({ results: [] })),
        BulkUploadApi.getSuccessful(id).catch(() => ({ results: [] })),
        BulkUploadApi.getSkipped(id).catch(() => ({ results: [] })),
      ]);
      setRows({
        failed: failed.results || [],
        successful: successful.results || [],
        skipped: skipped.results || [],
      });
    } catch (err) {
      setLoadError(
        err?.response?.data?.detail || "Could not load this batch. Please refresh.",
      );
    } finally {
      setIsLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  // Drives the NET countdown. One tick a minute is enough for a minutes-only
  // display and costs nothing.
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 60000);
    return () => clearInterval(t);
  }, []);

  const isNet = upload?.payment_path === "net";
  const total = upload?.effective_total ?? upload?.computed_total;
  const successful = upload?.successful || 0;
  const minutesLeft = useMemo(
    () => minutesUntil(upload?.auto_effect_at),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [upload?.auto_effect_at, now],
  );

  const handleContinue = async () => {
    setIsContinuing(true);
    try {
      const updated = await BulkUploadApi.continueToPayment(id);
      if (isNet) {
        toast.success("Invoice raised and bookings scheduled.");
        navigate("/billing");
      } else {
        navigate(`/pay/bulk/${updated.id || id}`);
      }
    } catch (err) {
      toast.error(
        err?.response?.data?.detail || "Could not continue. Please try again.",
      );
      setIsContinuing(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-24" role="status">
        <Loader2 className="h-6 w-6 animate-spin text-orange-400" />
        <span className="ml-3 text-slate-300">Loading your results…</span>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className={embedded ? "" : "max-w-3xl mx-auto p-6"}>
        <p className="text-red-300">{loadError}</p>
      </div>
    );
  }

  const nothingSucceeded = successful === 0;

  return (
    <div
      className={
        embedded
          ? "space-y-6"
          : "max-w-5xl mx-auto p-4 sm:p-6 space-y-6"
      }
    >
      <header className="space-y-2">
        <h1 className="text-2xl font-bold text-white">
          {upload.batch_name || upload.original_filename}
        </h1>
        <p className="text-slate-300">
          {successful} of {upload.total_rows} rows booked.{" "}
          {!nothingSucceeded && (
            <>
              <span className="font-semibold text-white">{money(total)}</span>{" "}
            </>
          )}
          <span className="text-amber-300">Nothing has been charged yet.</span>
        </p>
        {isNet && minutesLeft !== null && (
          <p className="text-sm text-amber-300/90" data-testid="auto-effect-countdown">
            These will be scheduled and invoiced automatically in {minutesLeft}{" "}
            {minutesLeft === 1 ? "minute" : "minutes"} unless you confirm sooner.
          </p>
        )}
      </header>

      <div role="tablist" aria-label="Results" className="flex gap-2 overflow-x-auto">
        {TABS.map(({ key, label, icon: Icon, tone }) => {
          const count =
            key === "failed" ? upload.failed : key === "skipped" ? upload.skipped : successful;
          return (
            <button
              key={key}
              role="tab"
              aria-selected={tab === key}
              onClick={() => setTab(key)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
                tab === key
                  ? "bg-slate-700 text-white"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              <Icon className={`h-4 w-4 ${tone}`} />
              {label} ({count || 0})
            </button>
          );
        })}
      </div>

      <div role="tabpanel" className="space-y-3">
        {tab === "failed" && <FailedRows rows={rows.failed} />}
        {tab === "successful" && <SuccessfulRows rows={rows.successful} />}
        {tab === "skipped" && <SkippedRows rows={rows.skipped} />}
      </div>

      {upload.failed > 0 && (
        <section className="rounded-lg border border-slate-700 p-4 space-y-3">
          <h2 className="font-semibold text-white">Fix the {upload.failed} failed rows</h2>
          {/* This batch is never modified. Corrections are a NEW upload that
              the customer marks as corrections at Review & Confirm, which is the
              last point at which that answer can still change the outcome. Rows
              already booked here are skipped, so pasting the whole original file
              back in is harmless. */}
          <p className="text-sm text-slate-300">
            Download them, fix them, then start a new upload and mark it as
            corrections to this batch. Anything already booked is skipped, so
            nothing is booked or charged twice.
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={async () => {
                try {
                  await BulkUploadApi.downloadErrorReport(id, { as: "template" });
                } catch {
                  toast.error("Could not download the failed rows.");
                }
              }}
              className="inline-flex items-center gap-2 px-3 py-2 text-sm rounded-lg border border-slate-600 text-slate-200 hover:bg-slate-700"
            >
              <Download className="h-4 w-4" /> Download failed rows
            </button>

            <button
              onClick={() => navigate("/bulk-upload")}
              className="inline-flex items-center gap-2 px-3 py-2 text-sm rounded-lg bg-orange-500 hover:bg-orange-600 text-white font-semibold"
            >
              <Upload className="h-4 w-4" /> Start a corrections upload
            </button>
          </div>
        </section>
      )}

      <footer className="border-t border-slate-700 pt-5">
        {nothingSucceeded ? (
          <div className="space-y-3">
            <p className="text-slate-300">
              No rows could be booked, so there is nothing to pay for. Fix the
              rows below and send them again.
            </p>
            <button
              onClick={() => navigate("/bulk-upload")}
              className="px-4 py-2 rounded-lg bg-orange-500 hover:bg-orange-600 text-white text-sm font-semibold"
            >
              Fix and re-upload
            </button>
          </div>
        ) : (
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={handleContinue}
            disabled={isContinuing}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-orange-500 hover:bg-orange-600 disabled:bg-slate-600 text-white text-sm font-semibold"
          >
            {isContinuing ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <ArrowRight className="h-4 w-4" />
            )}
            {isNet
              ? `Confirm and invoice — ${money(total)}`
              : `Continue to payment — ${money(total)}`}
          </motion.button>
        )}
      </footer>
    </div>
  );
}

function Empty({ children }) {
  return <p className="text-sm text-slate-400 py-6">{children}</p>;
}

function FailedRows({ rows }) {
  if (!rows.length) return <Empty>No rows failed.</Empty>;
  return rows.map((r) => (
    <div key={r.row_number} className="rounded-lg border border-red-800 bg-red-900/15 p-3">
      <p className="text-sm font-semibold text-red-200">
        Row {r.row_number}
        {r.reference ? ` — ${r.reference}` : ""}
      </p>
      <p className="text-sm text-red-100/80">
        {r.error_message || (r.error_messages || []).join("; ")}
      </p>
      {r.suggested_fix && (
        <p className="text-xs text-red-200/70 mt-1">{r.suggested_fix}</p>
      )}
    </div>
  ));
}

function SuccessfulRows({ rows }) {
  if (!rows.length) return <Empty>No rows were booked.</Empty>;
  return rows.map((r) => (
    <div
      key={r.row_number}
      className="rounded-lg border border-slate-700 p-3 flex justify-between gap-3"
    >
      <span className="text-sm text-slate-200">
        Row {r.row_number}
        {r.reference ? ` — ${r.reference}` : ""}
      </span>
      <span className="text-sm text-slate-400">{r.tracking_number || ""}</span>
    </div>
  ));
}

function SkippedRows({ rows }) {
  if (!rows.length) return <Empty>Nothing was skipped.</Empty>;
  return rows.map((r) => (
    <div key={r.row_number} className="rounded-lg border border-slate-700 p-3">
      <p className="text-sm text-slate-200">
        Row {r.row_number}
        {r.reference ? ` — ${r.reference}` : " — matched by contents"}
      </p>
      {/* The evidence. Without it a correct skip and a bug look the same. */}
      <p className="text-xs text-slate-400">
        Already booked as{" "}
        <span className="font-mono">{r.matched_booking || "an earlier booking"}</span>
        {r.matched_upload ? " in an earlier batch" : ""}. No new booking was
        created and you have not been charged twice.
      </p>
    </div>
  ));
}
