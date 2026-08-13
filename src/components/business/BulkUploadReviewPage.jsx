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
 * ── Three things this file got wrong, and what each one cost ─────────────────
 *
 * IT READ FIELDS THE API DOES NOT SERVE. `/errors/` returns `row_reference` and
 * an `errors: [{column_name, error_message, error_code, suggested_fix}]` list.
 * This component read `r.reference` and `r.error_message`, both undefined, so
 * every failed row rendered as a bare red bar saying "Row 12" and nothing else.
 * The customer could see WHICH rows failed and never WHY — on the one screen
 * built to tell them. The component tests mocked the component's own invented
 * shape rather than the API's, which is why it survived: the assertion and the
 * bug agreed with each other. `normaliseFailedRow` (utils/bulkReview.js) is the
 * seam, and it accepts both shapes so a row is never blank because a field
 * moved.
 *
 * IT ASSUMED A DARK SURFACE. Hardcoded `text-foreground` / `text-muted-foreground` on a
 * `bg-card dark:bg-surface` wizard modal. Tailwind v4 keys `dark:` off the OS
 * preference and this app forces `bg-background text-foreground` on the body regardless,
 * so on a light-mode machine the modal was white and this content was light
 * grey on white — legible in exactly one of the two places it renders. `dark:`
 * is now pinned to the app's own theme class (index.css), and the surface is
 * stated by the caller (`surface` prop) rather than inferred, so neither of
 * those can drift apart again.
 *
 * IT HAD ONE ANSWER FOR CONTINUE. `POST /continue/` 409s a batch that is not
 * awaiting review, which is what a customer gets when they open a bookmark, use
 * the back button, or click Continue in two tabs. That 409 was rendered as a red
 * toast reading "This batch is not awaiting review." — an error message for a
 * non-error, on a dead-end screen, when the batch had in fact continued
 * successfully and the customer simply needed to be taken to it. The status is
 * now read on load AND on 409, and both routes lead somewhere.
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
  CreditCard,
  Download,
  Loader2,
  SkipForward,
} from "lucide-react";
import toast from "react-hot-toast";
import BulkUploadApi from "../../api/BulkUploadApi";
// Pure, and tested on the API's real payloads rather than on a shape this
// component invented. See utils/bulkReview.js for what each one existed to fix.
import { normaliseFailedRow, resolveDone } from "../../utils/bulkReview";

const SECTIONS = [
  { key: "failed", label: "Failed", icon: AlertCircle, tone: "failed" },
  { key: "successful", label: "Booked", icon: CheckCircle2, tone: "booked" },
  { key: "skipped", label: "Skipped", icon: SkipForward, tone: "skipped" },
];

const FETCHERS = {
  failed: (id) => BulkUploadApi.getErrors(id),
  successful: (id) => BulkUploadApi.getSuccessful(id),
  skipped: (id) => BulkUploadApi.getSkipped(id),
};

const money = (v) => `£${Number(v || 0).toFixed(2)}`;

/**
 * The palette, keyed by the surface the caller renders us on.
 *
 * Stated rather than inferred. `dark:` variants would key off the OS setting,
 * which is not what decides this — the wizard modal is light and the standalone
 * route sits on the app's forced-dark body, on the same machine, at the same
 * time. One of them was always wrong while this was a guess.
 */
const THEME = {
  dark: {
    heading: "text-foreground",
    body: "text-muted-foreground",
    muted: "text-muted-foreground",
    strong: "text-foreground",
    rule: "border-border",
    card: "border-border bg-surface/40",
    cardHover: "hover:bg-surface/40",
    chipBg: "bg-surface/60 text-foreground",
    notice: "text-warning",
    failCard: "border-destructive/30 bg-destructive-surface",
    failTitle: "text-destructive",
    failBody: "text-destructive/80",
    failHint: "text-destructive/70",
    okIcon: "text-success",
    failIcon: "text-destructive",
    skipIcon: "text-muted-foreground",
    ghostBtn: "border-border text-foreground hover:bg-surface",
    meterTrack: "bg-surface",
  },
  light: {
    heading: "text-foreground",
    body: "text-muted-foreground",
    muted: "text-subtle-foreground",
    strong: "text-foreground",
    rule: "border-border",
    card: "border-border bg-muted",
    cardHover: "hover:bg-muted",
    chipBg: "bg-surface-hover text-muted-foreground",
    notice: "text-warning",
    failCard: "border-destructive/30 bg-destructive-surface",
    failTitle: "text-destructive",
    failBody: "text-destructive",
    failHint: "text-destructive",
    okIcon: "text-success",
    failIcon: "text-destructive",
    skipIcon: "text-subtle-foreground",
    ghostBtn: "border-border-strong text-muted-foreground hover:bg-muted",
    meterTrack: "bg-surface-hover",
  },
};

/** Minutes until `iso`, floored at 0. Null when there is no deadline. */
function minutesUntil(iso) {
  if (!iso) return null;
  const ms = new Date(iso).getTime() - Date.now();
  return Math.max(0, Math.floor(ms / 60000));
}

export default function BulkUploadReviewPage({
  uploadId = null,
  embedded = false,
  surface = "dark",
}) {
  // Two mounts, one implementation: the /bulk-upload/:id/review route and the
  // wizard's fifth step. Rendering different components in the two places is how
  // "you can close this page and come back" quietly stops being true.
  const params = useParams();
  const id = uploadId || params.id;
  const navigate = useNavigate();
  const t = THEME[surface] || THEME.dark;

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
        err?.response?.data?.detail ||
          "Could not load this batch. Please refresh.",
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
    const t2 = setInterval(() => setNow(Date.now()), 60000);
    return () => clearInterval(t2);
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
  const done = useMemo(() => resolveDone(upload), [upload]);
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
      // A 409 here is not a failure. It is this batch telling us it has already
      // continued — a second tab, a bookmark, a back button. Re-read it and show
      // the customer where their batch actually is instead of a red toast that
      // leaves them on a screen with nothing left to do.
      if (err?.response?.status === 409) {
        try {
          const fresh = await BulkUploadApi.getUpload(id);
          setUpload(fresh);
          const where = resolveDone(fresh);
          toast.success(
            where?.headline || "This batch has already been confirmed.",
          );
          setIsContinuing(false);
          return;
        } catch {
          /* fall through to the generic message below */
        }
      }
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
        <Loader2 className="h-6 w-6 animate-spin text-brand-text" />
        <span className={`ml-3 ${t.body}`}>Loading your results…</span>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className={embedded ? "" : "max-w-3xl mx-auto p-6"}>
        <p className={t.failTitle}>{loadError}</p>
      </div>
    );
  }

  const nothingSucceeded = successful === 0;
  const counts = {
    failed: upload.failed || 0,
    successful,
    skipped: upload.skipped || 0,
  };
  const totalRows = upload.total_rows || 0;

  return (
    <div
      className={
        embedded
          ? "space-y-6"
          : // The site Header is `fixed top-0` at h-20 (80px), so a page whose
            // title sits at the very top renders behind it. pt-24 matches the
            // pattern InvoiceDetailPage already established for this case.
            "max-w-3xl mx-auto px-4 sm:px-6 pt-24 pb-10 space-y-6"
      }
    >
      <header className="space-y-4">
        <div className="space-y-1">
          <p
            className={`text-[11px] font-semibold uppercase tracking-[0.14em] ${t.muted}`}
          >
            {done ? "Batch results" : "Review your results"}
          </p>
          <h1 className={`text-2xl font-bold tracking-tight ${t.heading}`}>
            {upload.batch_name || upload.original_filename}
          </h1>
        </div>

        {/* The outcome as a proportion, before the numbers. A 13-of-43 batch
            reads very differently as a bar than as two integers in a sentence,
            and this is the screen where that difference has to land. */}
        <OutcomeMeter counts={counts} totalRows={totalRows} theme={t} />

        <p className={`text-sm ${t.body}`}>
          <span className={`font-semibold ${t.strong}`}>{successful}</span> of{" "}
          {totalRows} rows booked
          {!nothingSucceeded && (
            <>
              {" · "}
              <span className={`font-semibold ${t.strong}`}>
                {money(total)}
              </span>
            </>
          )}
          {". "}
          {done ? null : (
            <span className={t.notice}>Nothing has been charged yet.</span>
          )}
        </p>

        {!done && isNet && minutesLeft !== null && (
          <p
            className={`text-sm ${t.notice}`}
            data-testid="auto-effect-countdown"
          >
            These will be scheduled and invoiced automatically in {minutesLeft}{" "}
            {minutesLeft === 1 ? "minute" : "minutes"} unless you confirm
            sooner.
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
            theme={t}
            count={counts[key]}
            isOpen={openSection === key}
            isLoading={loadingSection === key}
            onToggle={() => toggleSection(key)}
            rows={rows[key]}
          />
        ))}
      </div>

      <footer
        className={`border-t ${t.rule} pt-5 flex flex-wrap items-center gap-3`}
      >
        {counts.failed > 0 && (
          <button
            onClick={handleDownload}
            className={`inline-flex items-center gap-2 px-3 py-2 text-sm rounded-lg border ${t.ghostBtn}`}
          >
            <Download className="h-4 w-4" /> Download error report
          </button>
        )}

        {done ? (
          <>
            {/* Already continued. The batch moved on without this screen — via a
                second tab, the wizard, or the NET auto-effect sweep — and the
                only useful thing left to do here is say so and open the door. */}
            <p
              className={`w-full text-sm order-first ${t.body}`}
              data-testid="already-done"
            >
              {done.headline}
            </p>
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => navigate(done.to)}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-primary hover:bg-primary-hover text-primary-foreground text-sm font-semibold"
            >
              {done.money ? (
                <CreditCard className="h-4 w-4" />
              ) : (
                <ArrowRight className="h-4 w-4" />
              )}
              {done.money ? `${done.cta} — ${money(total)}` : done.cta}
            </motion.button>
          </>
        ) : nothingSucceeded ? (
          <>
            <p className={`w-full text-sm order-first ${t.body}`}>
              {/* An all-skipped batch is not a failed one. Every row of it
                  already has a delivery against it, and telling that customer
                  "no rows could be booked" reads as an outage. */}
              {counts.failed === 0 && counts.skipped > 0
                ? "Every row was already booked in an earlier batch, so nothing new was created and nothing has been charged."
                : "No rows could be booked, so there is nothing to pay for and nothing has been charged."}
            </p>
            <button
              onClick={() => navigate("/bulk-upload")}
              className={`inline-flex items-center gap-2 px-3 py-2 text-sm rounded-lg border ${t.ghostBtn}`}
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
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-primary hover:bg-primary-hover disabled:bg-surface-hover text-primary-foreground text-sm font-semibold"
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
 * Booked / skipped / failed as one bar.
 *
 * Not a chart for its own sake: the single most important fact on this screen is
 * the RATIO, and it is the one thing "13 of 43" makes the reader compute. Zero
 * counts render no segment, so a clean batch is a solid green bar rather than a
 * bar with two invisible slivers in it.
 */
function OutcomeMeter({ counts, totalRows, theme }) {
  const total = totalRows || counts.failed + counts.successful + counts.skipped;
  if (!total) return null;

  const pct = (n) => `${(n / total) * 100}%`;
  const segments = [
    {
      key: "successful",
      n: counts.successful,
      className: "bg-success",
      label: "booked",
    },
    {
      key: "skipped",
      n: counts.skipped,
      className: "bg-surface-hover",
      label: "skipped",
    },
    {
      key: "failed",
      n: counts.failed,
      className: "bg-destructive",
      label: "failed",
    },
  ].filter((s) => s.n > 0);

  return (
    <div
      className={`h-2 w-full rounded-full overflow-hidden flex ${theme.meterTrack}`}
      role="img"
      aria-label={segments.map((s) => `${s.n} ${s.label}`).join(", ")}
      data-testid="outcome-meter"
    >
      {segments.map((s) => (
        <div key={s.key} className={s.className} style={{ width: pct(s.n) }} />
      ))}
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
function Section({
  sectionKey,
  label,
  Icon,
  tone,
  theme,
  count,
  isOpen,
  isLoading,
  onToggle,
  rows,
}) {
  const panelId = `review-panel-${sectionKey}`;
  const buttonId = `review-tab-${sectionKey}`;
  const iconTone = {
    failed: theme.failIcon,
    booked: theme.okIcon,
    skipped: theme.skipIcon,
  }[tone];

  return (
    <div className={`rounded-xl border overflow-hidden ${theme.card}`}>
      <button
        id={buttonId}
        type="button"
        onClick={onToggle}
        aria-expanded={isOpen}
        aria-controls={panelId}
        className={`w-full flex items-center gap-2.5 px-4 py-3 text-sm font-medium ${theme.strong} ${theme.cardHover} transition-colors`}
      >
        {isOpen ? (
          <ChevronDown className={`h-4 w-4 ${theme.muted}`} />
        ) : (
          <ChevronRight className={`h-4 w-4 ${theme.muted}`} />
        )}
        <Icon className={`h-4 w-4 ${iconTone}`} />
        <span>
          {label} ({count})
        </span>
      </button>

      {isOpen && (
        <div
          id={panelId}
          role="region"
          aria-labelledby={buttonId}
          className="px-4 pb-4 space-y-2.5"
        >
          {isLoading ? (
            <p className={`text-sm py-4 ${theme.muted}`} role="status">
              Loading rows…
            </p>
          ) : (
            <SectionRows
              sectionKey={sectionKey}
              rows={rows || []}
              theme={theme}
            />
          )}
        </div>
      )}
    </div>
  );
}

function SectionRows({ sectionKey, rows, theme }) {
  if (sectionKey === "failed") return <FailedRows rows={rows} theme={theme} />;
  if (sectionKey === "successful")
    return <SuccessfulRows rows={rows} theme={theme} />;
  return <SkippedRows rows={rows} theme={theme} />;
}

function Empty({ children, theme }) {
  return <p className={`text-sm py-2 ${theme.muted}`}>{children}</p>;
}

function FailedRows({ rows, theme }) {
  if (!rows.length) return <Empty theme={theme}>No rows failed.</Empty>;
  return rows.map((raw) => {
    const r = normaliseFailedRow(raw);
    return (
      <div
        key={r.rowNumber}
        className={`rounded-lg border p-3 ${theme.failCard}`}
      >
        <div className="flex items-baseline justify-between gap-3">
          <p className={`text-sm font-semibold ${theme.failTitle}`}>
            Row {r.rowNumber}
            {r.reference ? ` — ${r.reference}` : ""}
          </p>
          {r.column && r.column !== "unknown" && (
            <span
              className={`text-[11px] font-mono px-1.5 py-0.5 rounded ${theme.chipBg}`}
            >
              {r.column}
            </span>
          )}
        </div>
        {/* The reason. This is the whole point of the section and it used to
            render empty, because the field it read does not exist. */}
        <p className={`text-sm mt-0.5 ${theme.failBody}`}>
          {r.reason}
          {r.extra > 0 && (
            <span className={theme.failHint}>
              {" "}
              (and {r.extra} other {r.extra === 1 ? "problem" : "problems"} on
              this row)
            </span>
          )}
        </p>
        {r.fix && <p className={`text-xs mt-1 ${theme.failHint}`}>{r.fix}</p>}
      </div>
    );
  });
}

function SuccessfulRows({ rows, theme }) {
  if (!rows.length) return <Empty theme={theme}>No rows were booked.</Empty>;
  return rows.map((r) => (
    <div
      key={r.row_number}
      className={`rounded-lg border p-3 flex justify-between gap-3 ${theme.card}`}
    >
      <span className={`text-sm ${theme.strong}`}>
        Row {r.row_number}
        {r.row_reference || r.reference
          ? ` — ${r.row_reference || r.reference}`
          : ""}
      </span>
      <span className={`text-sm font-mono ${theme.muted}`}>
        {r.tracking_number || ""}
      </span>
    </div>
  ));
}

function SkippedRows({ rows, theme }) {
  if (!rows.length) return <Empty theme={theme}>Nothing was skipped.</Empty>;
  return rows.map((r) => {
    const reference = r.reference || r.row_reference || "";
    return (
      <div key={r.row_number} className={`rounded-lg border p-3 ${theme.card}`}>
        <p className={`text-sm ${theme.strong}`}>
          Row {r.row_number}
          {reference ? ` — ${reference}` : " — matched by contents"}
        </p>
        {/* The evidence. Without it a correct skip and a bug look the same. */}
        <p className={`text-xs mt-0.5 ${theme.muted}`}>
          Already booked as{" "}
          <span className="font-mono">
            {r.matched_booking || "an earlier booking"}
          </span>
          {r.matched_upload ? " in an earlier batch" : ""}. No new booking was
          created and you have not been charged twice.
        </p>
      </div>
    );
  });
}
