/**
 * useBulkUploadDetail.js
 * ════════════════════════════════════════════════════════════════════════════════
 *
 * Custom hook for BulkUploadDetail page.
 * Manages fetching upload details, error rows, and successful bookings with pagination.
 *
 * Features:
 *   • Fetch detailed upload data
 *   • Paginated error rows with rich details
 *   • Paginated successful bookings
 *   • Retry failed rows
 *   • Download error report
 *   • Error handling & loading states
 */

import { useState, useEffect, useCallback, useRef } from "react";
import BulkUploadApi from "../api/BulkUploadApi";

/**
 * How long a genuinely-submitted upload may sit without its status changing
 * before we stop polling and tell the user so.
 *
 * The backend reaper force-fails a lost task after
 * BULK_UPLOAD_STUCK_THRESHOLD_MINUTES (15m), so 5 minutes of silence is well
 * inside "still plausibly working" and the reaper remains the authority on the
 * final verdict. What this constant buys is honesty in the meantime: an
 * animated progress bar that has not moved in five minutes is telling the user
 * something is happening when nothing is, and it kept a 3s poll running against
 * a dead task indefinitely.
 */
const STALL_AFTER_MS = 5 * 60 * 1000;

/** Poll cadence while an upload is genuinely in flight. */
const POLL_INTERVAL_MS = 3000;

export function useBulkUploadDetail(uploadId) {
  // Upload details
  const [upload, setUpload] = useState(null);
  const [isLoadingUpload, setIsLoadingUpload] = useState(false);
  const [uploadError, setUploadError] = useState(null);

  // Error rows
  const [errorRows, setErrorRows] = useState([]);
  const [errorMeta, setErrorMeta] = useState({});
  const [errorPage, setErrorPage] = useState(1);
  const [isFetchingErrors, setIsFetchingErrors] = useState(false);

  // Successful rows
  const [successfulRows, setSuccessfulRows] = useState([]);
  const [successfulMeta, setSuccessfulMeta] = useState({});
  const [successfulPage, setSuccessfulPage] = useState(1);
  const [isFetchingSuccessful, setIsFetchingSuccessful] = useState(false);

  // Skipped rows — duplicate references that matched an existing booking.
  // Surfaced distinctly so they never read as freshly-created bookings.
  const [skippedRows, setSkippedRows] = useState([]);

  // Retry state
  const [isRetrying, setIsRetrying] = useState(false);
  const [retryError, setRetryError] = useState(null);

  // Fetch upload details
  const fetchUploadDetail = useCallback(async () => {
    if (!uploadId) return;
    setIsLoadingUpload(true);
    setUploadError(null);
    try {
      const data = await BulkUploadApi.getDetail(uploadId);
      setUpload(data);
    } catch (err) {
      console.error("[useBulkUploadDetail] Failed to fetch upload:", err);
      setUploadError(err?.response?.data?.detail || "Failed to load upload");
      setUpload(null);
    } finally {
      setIsLoadingUpload(false);
    }
  }, [uploadId]);

  // Fetch error rows (paginated)
  const fetchErrorRows = useCallback(async () => {
    if (!uploadId) return;
    setIsFetchingErrors(true);
    try {
      const response = await BulkUploadApi.getErrors(uploadId, {
        page: errorPage,
        page_size: 25,
      });

      // Handle both paginated { results, count } and flat array formats
      if (response.results) {
        setErrorRows(response.results);
        setErrorMeta({
          page: errorPage,
          page_size: 25,
          total: response.count,
        });
      } else if (Array.isArray(response)) {
        setErrorRows(response);
        setErrorMeta({
          page: errorPage,
          page_size: response.length,
          total: response.length,
        });
      }
    } catch (err) {
      console.error("[useBulkUploadDetail] Failed to fetch error rows:", err);
      setErrorRows([]);
    } finally {
      setIsFetchingErrors(false);
    }
  }, [uploadId, errorPage]);

  // Fetch successful rows (paginated)
  const fetchSuccessfulRows = useCallback(async () => {
    if (!uploadId) return;
    setIsFetchingSuccessful(true);
    try {
      const response = await BulkUploadApi.getSuccessful?.(uploadId, {
        page: successfulPage,
        page_size: 25,
      });

      if (!response) return; // Endpoint may not exist yet

      // Handle both paginated and flat formats
      if (response.results) {
        setSuccessfulRows(response.results);
        setSuccessfulMeta({
          page: successfulPage,
          page_size: 25,
          total: response.count,
        });
      } else if (Array.isArray(response)) {
        setSuccessfulRows(response);
        setSuccessfulMeta({
          page: successfulPage,
          page_size: response.length,
          total: response.length,
        });
      }
    } catch (err) {
      console.error(
        "[useBulkUploadDetail] Failed to fetch successful rows:",
        err,
      );
      setSuccessfulRows([]);
    } finally {
      setIsFetchingSuccessful(false);
    }
  }, [uploadId, successfulPage]);

  // Fetch skipped (matched-existing) rows. Small in practice (duplicate refs),
  // so one page is fine.
  const fetchSkippedRows = useCallback(async () => {
    if (!uploadId) return;
    try {
      const response = await BulkUploadApi.getSkipped?.(uploadId, {
        page: 1,
        page_size: 200,
      });
      if (!response) return;
      setSkippedRows(
        response.results || (Array.isArray(response) ? response : []),
      );
    } catch (err) {
      console.error("[useBulkUploadDetail] Failed to fetch skipped rows:", err);
      setSkippedRows([]);
    }
  }, [uploadId]);

  // Retry failed rows
  const handleRetryFailed = useCallback(async () => {
    if (!uploadId || isRetrying) return;
    setIsRetrying(true);
    try {
      await BulkUploadApi.retryFailed(uploadId);
      // Refresh both error and successful rows
      setErrorPage(1);
      setSuccessfulPage(1);
      await fetchUploadDetail();
      await fetchErrorRows();
      setRetryError(null);
    } catch (err) {
      // Retry used to be admin-only, so every business click 403'd and this
      // catch swallowed it into the console — the button looked broken with no
      // stated reason. Now that owners can retry, a failure has to say why.
      console.error("[useBulkUploadDetail] Retry failed:", err);
      setRetryError(
        err?.response?.data?.detail ||
          "Could not retry these rows. Please try again.",
      );
    } finally {
      setIsRetrying(false);
    }
  }, [uploadId, isRetrying, fetchUploadDetail, fetchErrorRows]);

  // Download error report
  const handleDownloadErrorReport = useCallback(async () => {
    if (!uploadId) return;
    try {
      await BulkUploadApi.downloadErrorReport(uploadId);
    } catch (err) {
      console.error("[useBulkUploadDetail] Download failed:", err);
    }
  }, [uploadId]);

  // Initial fetch — load everything up front so switching tabs is instant
  // rather than showing a fresh loading spinner per tab.
  useEffect(() => {
    if (uploadId) {
      fetchUploadDetail();
      fetchErrorRows();
      fetchSuccessfulRows();
      fetchSkippedRows();
    }
  }, [
    uploadId,
    fetchUploadDetail,
    fetchErrorRows,
    fetchSuccessfulRows,
    fetchSkippedRows,
  ]);

  // Live refresh while the upload is still being processed.
  //
  // This hook is also reachable via a direct page load / refresh on
  // /bulk-upload/:id (not just right after the wizard hands off), so if the
  // upload hasn't reached a terminal state yet we poll lightly until it
  // does, then do one final refresh of the row lists.
  const TERMINAL_STATUSES = new Set([
    "payment_pending",
    "completed",
    "partial",
    "failed",
    "cancelled",
  ]);

  // A draft (validated, never submitted) is NOT in flight — no Celery task
  // exists for it, so no amount of polling will ever change its status. The
  // backend says so explicitly via is_draft; `celery_task_id` is the fallback
  // for a cached/older payload that predates the field.
  const isDraft = upload
    ? (upload.is_draft ??
      (upload.status === "pending" && !upload.celery_task_id))
    : false;

  const isTerminal = upload ? TERMINAL_STATUSES.has(upload.status) : false;

  /**
   * True once a submitted upload has gone STALL_AFTER_MS without its status
   * changing. Polling stops and the UI says so, instead of animating a bar
   * against a task that is not running.
   */
  const [isStalled, setIsStalled] = useState(false);

  // Reset the stall clock whenever the status actually moves. Held in a ref so
  // restarting the clock never re-runs the polling effect.
  const statusSinceRef = useRef(null);
  const lastStatusRef = useRef(null);
  useEffect(() => {
    if (!upload) return;
    if (lastStatusRef.current !== upload.status) {
      lastStatusRef.current = upload.status;
      statusSinceRef.current = Date.now();
      setIsStalled(false);
    }
  }, [upload?.status, upload]);

  // `pollTick` is what keeps the loop alive, and it is not decoration. This
  // effect schedules exactly ONE timeout per run and re-arms by re-running, so
  // it needs a dependency that provably changes after every fetch. `upload` is
  // not that: setUpload with an object React considers equal bails out of the
  // re-render, the effect never re-runs, and polling stops dead with the upload
  // still mid-flight — a silent stall that looks identical to the bug we are
  // fixing. Incrementing a counter makes the next tick unconditional.
  const [pollTick, setPollTick] = useState(0);
  const isMountedRef = useRef(true);
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (!uploadId || !upload) return;
    if (isTerminal || isDraft || isStalled) return;

    const timer = setTimeout(async () => {
      if (
        statusSinceRef.current &&
        Date.now() - statusSinceRef.current >= STALL_AFTER_MS
      ) {
        setIsStalled(true);
        return;
      }
      await fetchUploadDetail();
      if (isMountedRef.current) setPollTick((n) => n + 1);
    }, POLL_INTERVAL_MS);

    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    uploadId,
    upload?.status,
    isTerminal,
    isDraft,
    isStalled,
    pollTick,
    fetchUploadDetail,
  ]);

  /**
   * Submit a draft for processing (PATCH status=submitted → queues Celery).
   * Exposed here so the detail page can rescue a draft the wizard abandoned,
   * rather than leaving the user to re-upload the same file.
   */
  const [isSubmittingDraft, setIsSubmittingDraft] = useState(false);
  const [draftActionError, setDraftActionError] = useState(null);

  const submitDraft = useCallback(async () => {
    if (!uploadId || isSubmittingDraft) return;
    setIsSubmittingDraft(true);
    setDraftActionError(null);
    try {
      await BulkUploadApi.create(uploadId);
      setIsStalled(false);
      await fetchUploadDetail();
    } catch (err) {
      console.error("[useBulkUploadDetail] Draft submit failed:", err);
      setDraftActionError(
        err?.response?.data?.detail ||
          "Could not submit this upload. Please try again.",
      );
    } finally {
      setIsSubmittingDraft(false);
    }
  }, [uploadId, isSubmittingDraft, fetchUploadDetail]);

  /** Discard a draft (PATCH status=cancelled) so it stops cluttering the list. */
  const discardDraft = useCallback(async () => {
    if (!uploadId || isSubmittingDraft) return;
    setIsSubmittingDraft(true);
    setDraftActionError(null);
    try {
      await BulkUploadApi.cancelUpload(uploadId);
      await fetchUploadDetail();
    } catch (err) {
      console.error("[useBulkUploadDetail] Draft discard failed:", err);
      setDraftActionError(
        err?.response?.data?.detail ||
          "Could not discard this upload. Please try again.",
      );
    } finally {
      setIsSubmittingDraft(false);
    }
  }, [uploadId, isSubmittingDraft, fetchUploadDetail]);

  // Once the upload transitions into a terminal state, refresh the row
  // lists one more time so the Errors/Successful tabs reflect the final
  // outcome without requiring a manual page reload.
  const prevStatusRef = useRef(null);
  useEffect(() => {
    if (!upload) return;
    const wasNonTerminal =
      prevStatusRef.current && !TERMINAL_STATUSES.has(prevStatusRef.current);
    const isNowTerminal = TERMINAL_STATUSES.has(upload.status);
    if (wasNonTerminal && isNowTerminal) {
      fetchErrorRows();
      fetchSuccessfulRows();
      fetchSkippedRows();
    }
    prevStatusRef.current = upload.status;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [upload?.status]);

  // Refetch error rows when page changes
  useEffect(() => {
    if (uploadId && errorPage > 0) {
      fetchErrorRows();
    }
  }, [uploadId, errorPage, fetchErrorRows]);

  // Refetch successful rows when page changes
  useEffect(() => {
    if (uploadId && successfulPage > 0) {
      fetchSuccessfulRows();
    }
  }, [uploadId, successfulPage, fetchSuccessfulRows]);

  return {
    // Upload details
    upload,
    isLoadingUpload,
    uploadError,
    refetchUpload: fetchUploadDetail,

    // Draft / stall state — the "stuck on Processing" fix
    isDraft,
    isStalled,
    submitDraft,
    discardDraft,
    isSubmittingDraft,
    draftActionError,

    // Error rows
    errorRows,
    errorMeta,
    errorPage,
    setErrorPage,
    isFetchingErrors,

    // Successful rows
    successfulRows,
    successfulMeta,
    successfulPage,
    setSuccessfulPage,
    isFetchingSuccessful,

    // Skipped (matched-existing) rows
    skippedRows,

    // Actions
    handleRetryFailed,
    handleDownloadErrorReport,
    isRetrying,
    retryError,
  };
}
