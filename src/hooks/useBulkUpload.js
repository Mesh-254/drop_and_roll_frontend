/**
 * useBulkUpload.js
 *
 * Custom hook managing the full bulk upload lifecycle:
 *   1. File validation & CSV parse
 *   2. POST to /api/booking/bulk-uploads/validate/
 *   3. POST to /api/booking/bulk-uploads/ (start Celery task)
 *   4. Poll /api/booking/bulk-uploads/:id/status/ until terminal
 *   5. Auto-navigate based on customer type:
 *        PREPAID → /pay/bulk/:uploadId  (PaymentPage, pre-loaded)
 *        NET     → /invoices/:receivableId  (invoice detail)
 *
 * KEY FIX (Bug 1):
 *   - PAYMENT_PENDING is now a terminal state for PREPAID customers.
 *     Previously the poller only watched for "completed"/"failed", so
 *     it looped forever even after the Celery task finished.
 *   - Added `isAutoNavQueued` flag that fires *immediately* when a
 *     terminal state is detected, so the UI shows a loading screen
 *     (zero flash) while the async receivable lookup / navigation
 *     happens in the background.
 *   - Added manual "Continue to Payment" escape hatch so the user
 *     is never permanently stuck even if the nav effect fires late.
 */

import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import BulkUploadApi from "../api/BulkUploadApi";

// ─── Constants ────────────────────────────────────────────────────────────────

/** How often to hit the status endpoint while a task is running. */
const POLL_INTERVAL_MS = 2_000;

/**
 * Terminal states where we should stop polling.
 *
 * PAYMENT_PENDING  → Celery finished, bookings created, awaiting payment
 *                    (this is the "success" state for PREPAID users)
 * completed        → Legacy / NET flow: task done, invoice may exist
 * partial          → NET flow: task done, SOME rows failed but at least one
 *                    succeeded — backend still raises a receivable for the
 *                    successful rows (see tasks_bulk._handle_net_terms_completion),
 *                    so this must be treated the same as "completed" or the
 *                    poller spins forever and the page looks "stuck".
 * failed           → Task errored; show failure UI
 */
const TERMINAL_STATES = new Set([
  "payment_pending",
  "completed",
  "partial",
  "failed",
]);

/**
 * States that represent a successful processing result we can navigate away
 * from (i.e., not an error).
 */
const SUCCESS_STATES = new Set(["payment_pending", "completed", "partial"]);

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useBulkUpload() {
  const navigate = useNavigate();

  // ── Upload lifecycle state ─────────────────────────────────────────────────
  const [selectedFile, setSelectedFile] = useState(null);
  const [validationResult, setValidationResult] = useState(null);
  const [isValidating, setIsValidating] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState(null);

  // ── Active upload tracking ─────────────────────────────────────────────────
  const [latestUpload, setLatestUpload] = useState(null); // { id, status, customerType, ... }
  const [isPolling, setIsPolling] = useState(false);

  // ── Auto-navigation flags ──────────────────────────────────────────────────
  /**
   * isAutoNavQueued: set to true the *instant* a terminal success state is
   * detected (before any async work), so the UI can immediately flip to a
   * loading screen with no flash of the processing UI.
   */
  const [isAutoNavQueued, setIsAutoNavQueued] = useState(false);

  /**
   * isWaitingForReceivable: true while we are polling the receivable endpoint
   * waiting for the backend to create the AR record (NET flow only).
   */
  const [isWaitingForReceivable, setIsWaitingForReceivable] = useState(false);

  /**
   * pendingAutoInit: captured uploadId waiting for the payment-init effect
   * to fire (PREPAID flow).  Stored in state (not ref) so the useEffect
   * dependency array can react to it.
   */
  const [pendingAutoInit, setPendingAutoInit] = useState(null);

  /**
   * pendingNetNav: captured { uploadId, receivableId } waiting for the
   * NET nav effect to fire.
   */
  const [pendingNetNav, setPendingNetNav] = useState(null);

  // ── Refs ───────────────────────────────────────────────────────────────────
  const pollTimerRef = useRef(null);
  /**
   * Separate timer for _pollForReceivable (NET flow) so it never clobbers
   * the main status-polling loop which uses pollTimerRef.
   */
  const receivableTimerRef = useRef(null);
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      _clearPollTimer();
      // Also clear any in-flight receivable poller (NET flow)
      if (receivableTimerRef.current) {
        clearTimeout(receivableTimerRef.current);
        receivableTimerRef.current = null;
      }
    };
  }, []);

  // ─── Helpers ────────────────────────────────────────────────────────────────

  const _clearPollTimer = () => {
    if (pollTimerRef.current) {
      clearTimeout(pollTimerRef.current);
      pollTimerRef.current = null;
    }
  };

  /**
   * Extract a human-readable error string from a DRF response body.
   *
   * DRF can return errors in several shapes:
   *   { detail: "..." }
   *   { field_name: ["error msg", ...], ... }
   *   { non_field_errors: ["..."] }
   */
  const _extractDrfError = (data) => {
    if (!data || typeof data !== "object") return "An unknown error occurred.";
    if (data.detail) return data.detail;
    if (data.non_field_errors) return data.non_field_errors.join(" ");

    // Flatten field-level errors into a readable string
    const fieldErrors = Object.entries(data)
      .filter(([, v]) => Array.isArray(v))
      .map(([field, msgs]) => `${field}: ${msgs.join(", ")}`)
      .join(" | ");

    return fieldErrors || JSON.stringify(data);
  };

  /**
   * DRF's 429 body is "Request was throttled. Expected available in 1893
   * seconds." — a raw second count the user has to divide in their head, with
   * no hint that the limit is per-hour or that an already-validated batch can
   * still be submitted. Rewrite it into minutes and say what to do.
   */
  const _throttleError = (err) => {
    if (err?.response?.status !== 429) return null;
    const detail = err?.response?.data?.detail || "";
    const retryAfter =
      Number(err?.response?.headers?.["retry-after"]) ||
      Number((detail.match(/(\d+)\s*second/) || [])[1]) ||
      0;
    const mins = retryAfter ? Math.max(1, Math.ceil(retryAfter / 60)) : null;
    return (
      `Too many upload attempts. ${mins ? `Please try again in about ${mins} minute${mins === 1 ? "" : "s"}.` : "Please try again shortly."}` +
      " Any file you already validated is saved — you can open it from the uploads list and submit it without re-validating."
    );
  };

  /**
   * Billing-gate rejections (backend _check_business_access) carry a `code`
   * plus a Pay-Now destination. Return a structured error object for them so
   * the UI can render a CTA, or null for every other failure (string path).
   *
   * Codes: OVERDUE_INVOICES — settle overdue invoice(s) first (D3)
   *        CREDIT_LIMIT_EXCEEDED — outstanding balance ate the limit (D5)
   *        BUSINESS_SUSPENDED — admin hard-block
   */
  const _billingGateError = (data) => {
    if (!data || typeof data !== "object") return null;
    const gateCodes = [
      "OVERDUE_INVOICES",
      "CREDIT_LIMIT_EXCEEDED",
      "BUSINESS_SUSPENDED",
    ];
    if (!gateCodes.includes(data.code)) return null;
    return {
      message: data.detail,
      code: data.code,
      invoicesUrl: data.invoices_url || "/business/invoices",
      invoices: data.invoices || [],
    };
  };

  // ─── Validation ─────────────────────────────────────────────────────────────

  const validateFile = useCallback(async (file) => {
    if (!file) return;
    setIsValidating(true);
    setUploadError(null);
    setValidationResult(null);

    try {
      const formData = new FormData();
      formData.append("file", file);
      const result = await BulkUploadApi.validate(formData);
      setValidationResult(result);
      setSelectedFile(file);
    } catch (err) {
      const data = err?.response?.data;
      const errorMsg = _extractDrfError(data);
      setUploadError(
        _billingGateError(data) ||
          _throttleError(err) ||
          `Validation failed: ${errorMsg}`,
      );
      setSelectedFile(null);
    } finally {
      setIsValidating(false);
    }
  }, []);

  // ─── Upload (start Celery task) ──────────────────────────────────────────────

  const startUpload = useCallback(
    async ({ duplicatePolicy, correctsUpload } = {}) => {
      if (!selectedFile || !validationResult) return;

      setIsUploading(true);
      setUploadError(null);

      try {
        // validationResult.id was set by the validate() call in step 0/1.
        // We submit by id (PATCH status=submitted) — no second file upload.
        if (!validationResult.id) {
          throw new Error(
            "No validated upload id — please re-validate the file.",
          );
        }
        const upload = await BulkUploadApi.create(validationResult.id, {
          duplicatePolicy,
          correctsUpload,
        });

        if (!isMountedRef.current) return;

        setLatestUpload(upload);
        _startPolling(upload.id);
      } catch (err) {
        if (!isMountedRef.current) return;
        const data = err?.response?.data;
        const errorMsg = _extractDrfError(data);
        setUploadError(
          _billingGateError(data) ||
            _throttleError(err) ||
            `Upload failed: ${errorMsg}`,
        );
      } finally {
        if (isMountedRef.current) setIsUploading(false);
      }
    },
    [selectedFile, validationResult],
  );

  // ─── Status polling ──────────────────────────────────────────────────────────

  /**
   * _startPolling
   *
   * Kicks off the polling loop.  Separated from startUpload so it can also
   * be called from the "resume" path (e.g. page reload with an in-progress
   * upload stored in sessionStorage).
   */
  const _startPolling = useCallback((uploadId) => {
    _clearPollTimer();
    setIsPolling(true);

    if (import.meta.env.NODE_ENV === "development") {
      console.debug(`[BulkUpload] Started polling for upload ${uploadId}`);
    }

    const tick = async () => {
      if (!isMountedRef.current) return;

      try {
        const statusData = await BulkUploadApi.getStatus(uploadId);

        if (!isMountedRef.current) return;

        // Backend may return status=null while the Celery worker picks up the
        // task.  Treat null/undefined as "processing" so the poller keeps going
        // rather than silently failing the TERMINAL_STATES.has() check.
        const normalizedStatus = (
          statusData.status ?? "processing"
        ).toLowerCase();

        if (process.env.NODE_ENV === "development") {
          console.debug(
            `[BulkUpload] Poll result | id=${uploadId} | status=${normalizedStatus} | customerType=${statusData.customer_type}`,
          );
        }

        // Preserve uploadId — backend may omit `id` in status-only responses.
        setLatestUpload((prev) => ({ ...prev, ...statusData, id: uploadId }));

        if (TERMINAL_STATES.has(normalizedStatus)) {
          // ── Terminal state reached ──────────────────────────────────────
          _clearPollTimer();
          setIsPolling(false);

          if (process.env.NODE_ENV === "development") {
            console.debug(
              `[BulkUpload] Terminal state detected | status=${normalizedStatus} | customerType=${statusData.customer_type}`,
            );
          }

          if (SUCCESS_STATES.has(normalizedStatus)) {
            // Signal the UI to flip to loading *immediately* (no flash).
            setIsAutoNavQueued(true);

            const customerType = statusData.customer_type?.toUpperCase();

            if (customerType === "PREPAID") {
              // Queue the payment-init effect.
              setPendingAutoInit(uploadId);
            } else {
              // FIX Bug 3: receivable_id is already in the status response —
              // use it directly instead of firing a second GET /receivable/ poll.
              const receivableId = statusData.receivable_id;
              if (receivableId) {
                if (process.env.NODE_ENV === "development") {
                  console.debug(
                    `[BulkUpload] NET: receivable_id in status response, skipping extra poll | receivableId=${receivableId}`,
                  );
                }
                setPendingNetNav({ uploadId, receivableId });
              } else {
                // receivable_id absent — backend still creating AR record; fall back to polling.
                _pollForReceivable(uploadId);
              }
            }
          }
          // "failed" path: latestUpload.status === "failed" drives error UI.
        } else {
          // Still processing — schedule next tick.
          pollTimerRef.current = setTimeout(tick, POLL_INTERVAL_MS);
        }
      } catch (pollErr) {
        if (!isMountedRef.current) return;
        console.error("[BulkUpload] Polling error:", pollErr);
        // Don't bail out on a transient network hiccup — retry.
        pollTimerRef.current = setTimeout(tick, POLL_INTERVAL_MS * 2);
      }
    };

    // Kick off the first tick immediately.
    tick();
  }, []);

  /**
   * _pollForReceivable
   *
   * NET Terms flow: after the task finishes, the backend may still be
   * creating the AccountsReceivable record asynchronously.  Poll until it
   * exists, then set pendingNetNav to trigger the navigation effect.
   */
  const _pollForReceivable = useCallback(
    async (uploadId) => {
      setIsWaitingForReceivable(true);
      const MAX_ATTEMPTS = 15;
      let attempts = 0;

      const tryFetch = async () => {
        if (!isMountedRef.current) return;
        attempts++;

        try {
          const data = await BulkUploadApi.getReceivable(uploadId);
          if (data?.id) {
            if (process.env.NODE_ENV === "development") {
              console.debug(
                `[BulkUpload] Receivable found | receivableId=${data.id}`,
              );
            }
            setPendingNetNav({ uploadId, receivableId: data.id });
            setIsWaitingForReceivable(false);
            return;
          }
        } catch (_) {
          // 404 is expected while the record is still being created.
        }

        if (attempts < MAX_ATTEMPTS) {
          // FIX: use receivableTimerRef, not pollTimerRef, so the receivable
          // poller never clobbers or gets clobbered by the status poller.
          receivableTimerRef.current = setTimeout(tryFetch, POLL_INTERVAL_MS);
        } else {
          // Gave up waiting for the receivable — navigate to upload detail as
          // a fallback so the user isn't permanently stuck.
          console.warn(
            `[BulkUpload] Receivable not found after ${MAX_ATTEMPTS} attempts; falling back.`,
          );
          setIsWaitingForReceivable(false);
          // FIX: the app's route is singular `/bulk-upload/:id` (see App.jsx);
          // navigating to the plural `/bulk-uploads/:id` 404'd instead of
          // falling back gracefully to the detail page.
          navigate(`/bulk-upload/${uploadId}`);
        }
      };

      tryFetch();
    },
    [navigate],
  );

  // ─── Auto-navigation effects ─────────────────────────────────────────────────

  /**
   * PREPAID auto-nav effect.
   *
   * Fires when pendingAutoInit is set.  We navigate to the payment page,
   * passing the uploadId as state so PaymentPage can bootstrap itself
   * without needing to re-fetch (avoids "no transaction data" flash).
   */
  useEffect(() => {
    if (!pendingAutoInit) return;

    if (process.env.NODE_ENV === "development") {
      console.debug(
        `[BulkUpload] PREPAID auto-nav firing | uploadId=${pendingAutoInit}`,
      );
    }

    navigate(`/pay/bulk/${pendingAutoInit}`, {
      replace: true,
      state: {
        fromBulkUpload: true,
        uploadId: pendingAutoInit,
        // Pass the latest snapshot so PaymentPage has immediate data.
        uploadSnapshot: latestUpload,
      },
    });

    // Clean up so a re-render doesn't re-navigate.
    setPendingAutoInit(null);
  }, [pendingAutoInit, navigate, latestUpload]);

  /**
   * NET Terms auto-nav effect.
   */
  useEffect(() => {
    if (!pendingNetNav) return;

    if (process.env.NODE_ENV === "development") {
      console.debug(
        `[BulkUpload] NET auto-nav firing | receivableId=${pendingNetNav.receivableId}`,
      );
    }

    navigate(`/invoices/${pendingNetNav.receivableId}`, { replace: true });
    setPendingNetNav(null);
  }, [pendingNetNav, navigate]);

  /**
   * Defensive status-change watcher.
   *
   * If for any reason the pendingAutoInit effect didn't fire (e.g. the
   * component remounted and lost the queued state), this effect watches
   * latestUpload.status directly and re-queues navigation.
   */
  useEffect(() => {
    if (!latestUpload) return;
    const status = latestUpload.status?.toLowerCase();
    const customerType = latestUpload.customer_type?.toUpperCase();

    if (
      status === "payment_pending" &&
      customerType === "PREPAID" &&
      !isPolling &&
      !isAutoNavQueued &&
      !pendingAutoInit
    ) {
      if (process.env.NODE_ENV === "development") {
        console.debug(
          `[BulkUpload] Defensive watcher triggered auto-nav | uploadId=${latestUpload.id}`,
        );
      }
      setIsAutoNavQueued(true);
      setPendingAutoInit(latestUpload.id);
    }

    // FIX Bug 4: NET flow had no defensive watcher — PREPAID had one but NET
    // didn't. If the component remounts after a "completed"/"partial" status
    // is set and pendingNetNav was lost, this re-queues NET navigation using
    // receivable_id already present in latestUpload (injected by the status
    // endpoint via _inject_payment_path).
    if (
      (status === "completed" || status === "partial") &&
      customerType !== "PREPAID" &&
      !isPolling &&
      !isAutoNavQueued &&
      !pendingNetNav
    ) {
      const receivableId = latestUpload.receivable_id;
      if (receivableId) {
        if (process.env.NODE_ENV === "development") {
          console.debug(
            `[BulkUpload] Defensive NET watcher triggered nav | receivableId=${receivableId}`,
          );
        }
        setIsAutoNavQueued(true);
        setPendingNetNav({ uploadId: latestUpload.id, receivableId });
      }
    }
  }, [
    latestUpload,
    isPolling,
    isAutoNavQueued,
    pendingAutoInit,
    pendingNetNav,
  ]);

  // ─── Manual escape hatch ─────────────────────────────────────────────────────

  /**
   * manualContinueToPayment
   *
   * Exposed so BulkUploadFlow can render a "Continue to Payment" button
   * when status === 'payment_pending' but auto-nav hasn't fired.
   * This is the user's escape hatch if JS timers misbehave.
   */
  const manualContinueToPayment = useCallback(() => {
    if (!latestUpload?.id) return;
    navigate(`/pay/bulk/${latestUpload.id}`, {
      replace: true,
      state: {
        fromBulkUpload: true,
        uploadId: latestUpload.id,
        uploadSnapshot: latestUpload,
      },
    });
  }, [latestUpload, navigate]);

  /**
   * manualViewInvoice
   *
   * FIX Bug 4 (escape hatch): NET equivalent of manualContinueToPayment.
   * Shown in BulkUploadFlow when status is "completed"/"partial" but the
   * auto-nav to /invoices/:receivableId hasn't fired.
   */
  const manualViewInvoice = useCallback(() => {
    const receivableId = latestUpload?.receivable_id;
    if (!receivableId) return;
    navigate(`/invoices/${receivableId}`, { replace: true });
  }, [latestUpload, navigate]);

  // ─── Reset ───────────────────────────────────────────────────────────────────

  const reset = useCallback(() => {
    _clearPollTimer();
    setSelectedFile(null);
    setValidationResult(null);
    setIsValidating(false);
    setIsUploading(false);
    setUploadError(null);
    setLatestUpload(null);
    setIsPolling(false);
    setIsAutoNavQueued(false);
    setIsWaitingForReceivable(false);
    setPendingAutoInit(null);
    setPendingNetNav(null);
  }, []);

  // ─── Public API ───────────────────────────────────────────────────────────────

  return {
    // File selection & validation
    selectedFile,
    validationResult,
    isValidating,
    validateFile,

    // Upload
    isUploading,
    startUpload,

    // Polling / status
    latestUpload,
    isPolling,

    // Navigation flags
    isAutoNavQueued,
    isWaitingForReceivable,

    // Manual escape hatch
    manualContinueToPayment,
    manualViewInvoice,

    // Errors
    uploadError,

    // Clear error without full reset (e.g. after business profile created)
    clearError: () => setUploadError(null),

    // Lifecycle
    reset,
  };
}
