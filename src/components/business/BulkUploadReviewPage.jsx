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
 * So: the outcome in one line, the rows behind three collapsed sections, and
 * nothing billable until the footer button is pressed. The backend enforces the
 * same rule — paying a batch in awaiting_review returns 409 — because a screen
 * that merely declines to offer a button is not a guarantee.
 *
 * WHY THE SECTIONS ARE COLLAPSED. This page used to render every row of the
 * selected tab on arrival: a 187-row batch was 187 cards between the customer
 * and the two things they came to do, and three list requests fired on mount
 * (six under StrictMode) to fill tabs they might never open. Each section now
 * fetches on its first expand and caches.
 *
 * TWO DETAILS THAT CARRY MORE WEIGHT THAN THEY LOOK:
 *
 *   The Skipped section names the booking and batch each row matched. Skipping
 *   is invisible by nature: the customer sees a row they sent and no delivery
 *   against it. Without the evidence, a correct skip and a bug look identical.
 *
 *   NET shows a live countdown to auto-effect. The batch invoices and dispatches
 *   itself if nobody confirms, which is only fair if the deadline is on screen
 *   before it passes.
 *
 * WHAT IS DELIBERATELY NOT HERE: a "start a corrections upload" button. This
 * batch is never modified. Corrections are a NEW upload, declared as such at
 * Review & Confirm — the last point at which that answer can still change the
 * outcome — and a second entry point here competed with the two actions that
 * matter.
 */

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { motion } from "framer-motion";
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Download,
  Loader2,
  SkipForward,
} from "lucide-react";
import toast from "react-hot-toast";
import BulkUploadApi from "../../api/BulkUploadApi";

const SECTIONS = [
  { key: "failed", label: "Failed", icon: AlertCircle, tone: "text-red-400" },
  { key: "successful", label: "Booked", icon: CheckCircle2, tone: "text-green-400" },
  { key: "skipped", label: "Skipped", icon: SkipForward, tone: "text-slate-400" },
];

const FETCHERS = {
  failed: (id) => BulkUploadApi.getErrors(id),
  successful: (id) => BulkUploadApi.getSuccessful(id),
  skipped: (id) => BulkUploadApi.getSkipped(id),
};

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
  const [rows, setRows] = useState({});
  const [loadingSection, setLoadingSection] = useState(null);
  const [openSection, setOpenSection] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isContinuing, setIsContinuing] = useState(false);
  const [loadError, setLoadError] = useState(null);
  const [now, setNow] = useState(Date.now());

  const load = useCallback(async () => {
    try {
      setUpload(await BulkUploadApi.getUpload(id));
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

  /**
   * Expand a section, fetching its rows the first time.
   *
   * Cached by key rather than refetched on every open: the batch is finished, so
   * the rows cannot change while this page is on screen. A failed fetch caches
   * an empty list and says so rather than retrying on every click.
   */
  const toggleSection = useCallback(
    async (key) => {
      if (openSection === key) {
        setOpenSection(null);
        return;
      }
      setOpenSection(key);
      if (rows[key]) return;

      setLoadingSection(key);
      try {
        const page = await FETCHERS[key](id);
        setRows((prev) => ({ ...prev, [key]: page?.results || [] }));
      } catch {
        setRows((prev) => ({ ...prev, [key]: [] }));
      } finally {
        setLoadingSection(null);
      }
    },
    [id, openSection, rows],
  );

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

  const handleDownload = async () => {
    try {
      // The default shape: one line per failed row, carrying row_number,
      // reference, column_name, error_code and error_message beside the
      // original data columns — the same fields the batch detail page shows,
      // and still safe to fix and re-upload.
      await BulkUploadApi.downloadErrorReport(id);
    } catch {
      toast.error("Could not download the error report.");
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
  const counts = {
    failed: upload.failed || 0,
    successful,
    skipped: upload.skipped || 0,
  };

  return (
    <div className={embedded ? "space-y-6" : "max-w-5xl mx-auto p-4 sm:p-6 space-y-6"}>
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

      <div className="space-y-2">
        {SECTIONS.map(({ key, label, icon: Icon, tone }) => (
          <Section
            key={key}
            sectionKey={key}
            label={label}
            Icon={Icon}
            tone={tone}
            count={counts[key]}
            isOpen={openSection === key}
            isLoading={loadingSection === key}
            onToggle={() => toggleSection(key)}
            rows={rows[key]}
          />
        ))}
      </div>

      <footer className="border-t border-slate-700 pt-5 flex flex-wrap items-center gap-3">
        {counts.failed > 0 && (
          <button
            onClick={handleDownload}
            className="inline-flex items-center gap-2 px-3 py-2 text-sm rounded-lg border border-slate-600 text-slate-200 hover:bg-slate-700"
          >
            <Download className="h-4 w-4" /> Download error report
          </button>
        )}

        {nothingSucceeded ? (
          <>
            <p className="w-full text-slate-300 order-first">
              {/* An all-skipped batch is not a failed one. Every row of it
                  already has a delivery against it, and telling that customer
                  "no rows could be booked" reads as an outage. */}
              {counts.failed === 0 && counts.skipped > 0
                ? "Every row was already booked in an earlier batch, so nothing new was created and nothing has been charged."
                : "No rows could be booked, so there is nothing to pay for and nothing has been charged."}
            </p>
            <button
              onClick={() => navigate("/bulk-upload")}
              className="inline-flex items-center gap-2 px-3 py-2 text-sm rounded-lg border border-slate-600 text-slate-200 hover:bg-slate-700"
            >
              <ArrowLeft className="h-4 w-4" /> Back to uploads
            </button>
          </>
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

/**
 * One collapsed outcome group.
 *
 * A plain button + region rather than <details>: the panel's contents are
 * fetched on first open, which needs a handler, and the count has to stay
 * readable while the body is closed.
 */
function Section({ sectionKey, label, Icon, tone, count, isOpen, isLoading, onToggle, rows }) {
  const panelId = `review-panel-${sectionKey}`;
  const buttonId = `review-tab-${sectionKey}`;

  return (
    <div className="rounded-lg border border-slate-700 overflow-hidden">
      <button
        id={buttonId}
        type="button"
        onClick={onToggle}
        aria-expanded={isOpen}
        aria-controls={panelId}
        className="w-full flex items-center gap-2 px-4 py-3 text-sm font-medium text-slate-200 hover:bg-slate-700/50 transition-colors"
      >
        {isOpen ? (
          <ChevronDown className="h-4 w-4 text-slate-400" />
        ) : (
          <ChevronRight className="h-4 w-4 text-slate-400" />
        )}
        <Icon className={`h-4 w-4 ${tone}`} />
        <span>
          {label} ({count})
        </span>
      </button>

      {isOpen && (
        <div id={panelId} role="region" aria-labelledby={buttonId} className="px-4 pb-4 space-y-3">
          {isLoading ? (
            <p className="text-sm text-slate-400 py-4" role="status">
              Loading rows…
            </p>
          ) : (
            <SectionRows sectionKey={sectionKey} rows={rows || []} />
          )}
        </div>
      )}
    </div>
  );
}

function SectionRows({ sectionKey, rows }) {
  if (sectionKey === "failed") return <FailedRows rows={rows} />;
  if (sectionKey === "successful") return <SuccessfulRows rows={rows} />;
  return <SkippedRows rows={rows} />;
}

function Empty({ children }) {
  return <p className="text-sm text-slate-400 py-2">{children}</p>;
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
