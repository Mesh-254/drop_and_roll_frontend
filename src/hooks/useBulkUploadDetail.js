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
      console.error("[useBulkUploadDetail] Failed to fetch successful rows:", err);
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
      const response = await BulkUploadApi.getSkipped?.(uploadId, { page: 1, page_size: 200 });
      if (!response) return;
      setSkippedRows(response.results || (Array.isArray(response) ? response : []));
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
    } catch (err) {
      console.error("[useBulkUploadDetail] Retry failed:", err);
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
  }, [uploadId, fetchUploadDetail, fetchErrorRows, fetchSuccessfulRows, fetchSkippedRows]);

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

  useEffect(() => {
    if (!uploadId || !upload) return;
    if (TERMINAL_STATUSES.has(upload.status)) return;

    const timer = setTimeout(async () => {
      await fetchUploadDetail();
    }, 3000);

    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uploadId, upload?.status, fetchUploadDetail]);

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
  };
}
