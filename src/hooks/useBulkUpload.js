/**
 * useBulkUpload — centralized logic for the bulk upload wizard + dashboard.
 *
 * TWO-STEP FLOW (matches backend v2 API):
 * ────────────────────────────────────────
 * Step 0 – File drop
 *   handleFileSelect(file)       → local state only
 *
 * Step 1 – Metadata (batch name, notes)
 *   setBatchName / setNotes      → local state only
 *
 * Step 2 – Review & confirm
 *   Shows payment_path hint:
 *     "prepaid" → "Submit and pay £X"
 *     "net"     → "Submit — Invoice will be raised (NET 30)"
 *
 *   handleValidateAndUpload()    → POST /validate/
 *     • Sends file + metadata
 *     • Saves bulk.id, payment_path, net_days, available_credit
 *     • Advances to step 3 (Review) — user can still cancel here
 *
 * Step 3 – Processing
 *   handleSubmit()               → PATCH /{id}/ { status: "submitted" }
 *     • Queues Celery
 *     • Starts polling
 *
 * On processing DONE:
 *   PREPAID → paymentPath === "prepaid"
 *     handleInitiatePayment()    → POST /{id}/pay/ → redirects to /payment/:txId
 *   NET     → paymentPath === "net"
 *     latestUpload.receivable_id is set
 *     No payment step — navigate to /invoices/:receivableId
 *
 * Credit limit exceeded:
 *   Backend sets bulk.status = "failed" and pricing_notes contains reason.
 *   processingStatus = "credit_exceeded"; hook exposes creditLimitError.
 *
 * PHASE 3 STEP 7 — BusinessProfile Detection:
 *   If BUSINESS_PROFILE_REQUIRED error is detected during validation/submit:
 *     - uploadError.code = "BUSINESS_PROFILE_REQUIRED"
 *     - uploadError.actionUrl = business setup URL
 *     - uploadError.actionLabel = button text
 *     - isBusinessProfileRequired flag is set to true
 *     - pendingAction stores the action to retry after profile creation
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import BulkUploadApi from "../api/BulkUploadApi";
import paymentApi from "../api/PaymentApi";

export function useBulkUpload() {
  const navigate = useNavigate();

  // ── Upload wizard state ───────────────────────────────────────────────────
  const [file, setFile] = useState(null);
  const [batchName, setBatchName] = useState("");
  const [notes, setNotes] = useState("");
  const [currentStep, setCurrentStep] = useState(0);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [gatewayPreference, setGatewayPreference] = useState("stripe");

  // Phase flags
  const [isUploading, setIsUploading] = useState(false); // POST /validate/
  const [isSubmitting, setIsSubmitting] = useState(false); // PATCH /{id}/
  const [uploadError, setUploadError] = useState(null);

  // Results from /validate/ (step 1 result — stored before submit)
  const [uploadResult, setUploadResult] = useState(null);
  const uploadResultRef = useRef(null); // Sync ref for immediate access
  const validationCompleteRef = useRef(false); // Track if validation has been attempted

  // Payment path from backend: "prepaid" | "net"
  const [paymentPath, setPaymentPath] = useState(null);
  const [netDays, setNetDays] = useState(0);
  const [availableCredit, setAvailableCredit] = useState(null);

  // ── Processing polling state ──────────────────────────────────────────────
  const [processingStatus, setProcessingStatus] = useState("idle");
  // idle | uploading | polling | done | failed | credit_exceeded
  const [latestUpload, setLatestUpload] = useState(null);
  const [creditLimitError, setCreditLimitError] = useState(null);
  const pollingRef = useRef(null);

  // ── Error rows state ──────────────────────────────────────────────────────
  const [errorRows, setErrorRows] = useState([]);
  const [errorMeta, setErrorMeta] = useState(null);
  const [errorPage, setErrorPage] = useState(1);
  const [isFetchingErrors, setIsFetchingErrors] = useState(false);

  // ── Dashboard state ───────────────────────────────────────────────────────
  const [stats, setStats] = useState(null);
  const [isFetchingStats, setIsFetchingStats] = useState(false);
  const [uploads, setUploads] = useState([]);
  const [isFetchingUploads, setIsFetchingUploads] = useState(false);

  // ── PHASE 3 STEP 7: BusinessProfile detection & auto-retry ────────────────
  const [isBusinessProfileRequired, setIsBusinessProfileRequired] =
    useState(false);
  const [isProfileCreating, setIsProfileCreating] = useState(false);
  // Store the action (validate/submit) to retry after profile creation
  const pendingActionRef = useRef(null);

  // ── Step navigation ───────────────────────────────────────────────────────
  const goToStep = useCallback((step) => setCurrentStep(step), []);
  const nextStep = useCallback(() => setCurrentStep((p) => p + 1), []);
  const prevStep = useCallback(
    () => setCurrentStep((p) => Math.max(0, p - 1)),
    [],
  );

  const handleFileSelect = useCallback((selectedFile) => {
    setFile(selectedFile);
    setUploadError(null);
    setUploadProgress(0);
  }, []);

  // ── STEP 1: POST /validate/ ───────────────────────────────────────────────
  //
  // Uploads the file + metadata. Creates the BulkUpload record in PENDING
  // status but does NOT queue Celery yet. Advances wizard to Review step
  // so the user can see the payment path before they commit.
  //
  // PHASE 3 STEP 7: Detects BUSINESS_PROFILE_REQUIRED error and exposes
  // isBusinessProfileRequired flag with action URL for modal trigger.
  //
  const handleValidateAndUpload = useCallback(async () => {
    if (!file) {
      setUploadError({
        title: "No file selected",
        message: "Please select a CSV file.",
      });
      return false;
    }

    setIsUploading(true);
    setUploadError(null);
    setUploadProgress(0);
    setProcessingStatus("uploading");
    // Store this action to retry after profile creation
    pendingActionRef.current = "validate";

    try {
      const data = await BulkUploadApi.validateFile(
        file,
        { batchName, notes },
        (pct) => setUploadProgress(pct),
      );

      // Validate response shape before setting state
      if (!data?.id) {
        console.error("[v0] validateFile response missing id field:", data);
        validationCompleteRef.current = false;
        uploadResultRef.current = null;
        setUploadError({
          title: "Upload failed",
          message:
            "Server validation succeeded but response is incomplete. Please try again.",
        });
        return false;
      }

      // data is the BulkUpload object + payment_path / net_days hints
      setUploadResult(data);
      uploadResultRef.current = data; // Sync ref immediately for handleSubmit
      validationCompleteRef.current = true; // Mark validation as successful
      setLatestUpload(data);
      setPaymentPath(data.payment_path || "prepaid");
      setNetDays(data.net_days || 0);
      setAvailableCredit(data.available_credit || null);
      setIsBusinessProfileRequired(false);

      console.log(
        "[v0] handleValidateAndUpload SUCCESS - uploadResult set to:",
        data,
      );

      // Return true — let the wizard component advance the step
      // This ensures all async state updates have flushed before re-render
      return true;
    } catch (err) {
      const errData = err?.response?.data || err?.data || {};

      // Handle BUSINESS_PROFILE_REQUIRED (Phase 3 Step 7)
      if (errData.code === "BUSINESS_PROFILE_REQUIRED") {
        setIsBusinessProfileRequired(true);
        setUploadError({
          title: "Business Profile Required",
          message:
            errData.detail || "Please set up your business profile first.",
          code: "BUSINESS_PROFILE_REQUIRED",
          actionUrl: errData.business_setup_url || "/business/register",
          actionLabel: "Set Up Business Profile",
        });
        console.log(
          "[v0] BUSINESS_PROFILE_REQUIRED detected during validation",
        );
        return false;
      }

      // Handle BUSINESS_PROFILE_PENDING
      if (errData.code === "BUSINESS_PROFILE_PENDING") {
        setUploadError({
          title: "Account Pending Approval",
          message:
            errData.detail ||
            "Your business account is awaiting admin approval.",
          code: "BUSINESS_PROFILE_PENDING",
        });
        return false;
      }

      console.error("[v0] validateFile error:", err);
      setUploadError({
        title: "Upload failed",
        message: err.message || "An unexpected error occurred.",
      });
      return false;
    } finally {
      setIsUploading(false);
      setProcessingStatus("idle");
    }
  }, [file, batchName, notes]);

  // ── STEP 2: PATCH /{id}/ { status: "submitted" } ─────────────────────────
  //
  // Called from the Review & Confirm step. Queues Celery and starts polling.
  //
  // PHASE 3 STEP 7: Also detects BUSINESS_PROFILE_REQUIRED and auto-retries.
  //
  const handleSubmit = useCallback(async () => {
    // Use state first, fall back to ref if state hasn't flushed yet
    const result = uploadResult || uploadResultRef.current;

    console.log("[v0] handleSubmit called", {
      uploadResultState: uploadResult,
      uploadResultRef: uploadResultRef.current,
      validationComplete: validationCompleteRef.current,
      currentStep,
      isSubmitting,
    });

    if (!result?.id) {
      console.error(
        "[v0] handleSubmit FAILED: No valid uploadResult. Check if validation completed.",
        {
          uploadResult,
          uploadResultRef: uploadResultRef.current,
          validationComplete: validationCompleteRef.current,
        },
      );
      setUploadError({
        title: "Error",
        message: "No upload to submit. Please start again.",
      });
      return false;
    }

    setIsSubmitting(true);
    setUploadError(null);
    // Store this action to retry after profile creation
    pendingActionRef.current = "submit";

    try {
      const data = await BulkUploadApi.submitBulkUpload(result.id);

      if (!data?.id) {
        console.error("[v0] submitBulkUpload response missing id:", data);
        setUploadError({
          title: "Submission failed",
          message: "Server response is incomplete. Please try again.",
        });
        return false;
      }

      setLatestUpload(data);
      setIsBusinessProfileRequired(false);

      // Start polling immediately (synced version — updates ref state directly)
      // The wizard will advance the step on the next render cycle
      startPolling(data.id);

      // Return true — let the wizard component know submission succeeded
      return true;
    } catch (err) {
      const errData = err?.response?.data || err?.data || {};

      // Handle BUSINESS_PROFILE_REQUIRED during submit (Phase 3 Step 7)
      if (errData.code === "BUSINESS_PROFILE_REQUIRED") {
        setIsBusinessProfileRequired(true);
        setUploadError({
          title: "Business Profile Required",
          message:
            errData.detail || "Please set up your business profile first.",
          code: "BUSINESS_PROFILE_REQUIRED",
          actionUrl: errData.business_setup_url || "/business/register",
          actionLabel: "Set Up Business Profile",
        });
        console.log("[v0] BUSINESS_PROFILE_REQUIRED detected during submit");
        return false;
      }

      console.error("[v0] submitBulkUpload error:", err);
      setUploadError({
        title: "Submission failed",
        message: err.message || "Could not start processing.",
      });
      return false;
    } finally {
      setIsSubmitting(false);
    }
  }, [uploadResult]);

  // ── Auto-retry after BusinessProfile creation ─────────────────────────────
  //
  // Called from BulkUploadWizard when BusinessProfileOnboarding closes
  // with onSuccess. Automatically retries the pending action (validate/submit).
  //
  const retryPendingAction = useCallback(async () => {
    console.log(
      "[v0] retryPendingAction: pendingAction =",
      pendingActionRef.current,
    );

    setIsProfileCreating(true);
    setIsBusinessProfileRequired(false);

    try {
      const action = pendingActionRef.current;

      if (action === "validate") {
        console.log("[v0] Retrying validation after profile creation...");
        const success = await handleValidateAndUpload();
        if (success) {
          console.log("[v0] Validation retry succeeded");
          // Step advances automatically in wizard
        }
      } else if (action === "submit") {
        console.log("[v0] Retrying submit after profile creation...");
        const success = await handleSubmit();
        if (success) {
          console.log("[v0] Submit retry succeeded");
          // Step advances automatically in wizard
        }
      }

      pendingActionRef.current = null;
    } finally {
      setIsProfileCreating(false);
    }
  }, [handleValidateAndUpload, handleSubmit]);

  // ── Polling ───────────────────────────────────────────────────────────────

  const startPolling = useCallback((uploadId) => {
    setProcessingStatus("polling");

    const poll = async () => {
      try {
        const data = await BulkUploadApi.getUploadStatus(uploadId);
        setLatestUpload(data);

        if (["completed", "partial", "failed"].includes(data.status)) {
          clearPolling();

          // Check for credit limit exceeded (pricing_notes contains reason)
          if (
            data.status === "failed" &&
            data.pricing_notes?.includes("[CREDIT LIMIT]")
          ) {
            setProcessingStatus("credit_exceeded");
            setCreditLimitError(
              data.pricing_notes.replace("[CREDIT LIMIT]", "").trim(),
            );
            return;
          }

          setProcessingStatus("done");

          // Auto-fetch error rows
          if (data.failed > 0) {
            fetchErrorsForId(uploadId);
          }
        }
      } catch (err) {
        console.error("[useBulkUpload] Poll error:", err);
      }
    };

    poll();
    pollingRef.current = setInterval(poll, 2000);
  }, []);

  const clearPolling = useCallback(() => {
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
  }, []);

  // ── NET path post-completion ──────────────────────────────────────────────
  //
  // Called from the Done screen when payment_path === "net".
  // Navigates to the receivable detail page.
  //
  const handleViewInvoice = useCallback(() => {
    const receivableId = latestUpload?.receivable_id;
    if (receivableId) {
      navigate(`/invoices/${receivableId}`);
    }
  }, [latestUpload, navigate]);

  // ── PREPAID path post-completion ──────────────────────────────────────────
  //
  // Initiates payment and navigates to the payment page.
  //
  const [isInitiatingPayment, setIsInitiatingPayment] = useState(false);

  const handleInitiatePayment = async (gatewayOverride) => {
    if (!latestUpload?.id) return;

    // NET-terms uploads do not go through payment initiation — they already
    // have a receivable created at submit time.
    if (paymentPath === "net") {
      const receivableId = latestUpload?.receivable_id;
      if (receivableId) {
        navigate(`/invoices/${receivableId}`);
      }
      return;
    }

    const gateway = gatewayOverride || gatewayPreference || "stripe";

    setIsInitiatingPayment(true);
    setUploadError(null);

    try {
      // FIX-HOOK-01: use the correct endpoint via PaymentApi
      const result = await paymentApi.initiateBulkPayment({
        bulkUploadId: latestUpload.id,
        gateway,
        idempotencyKey: `bulk-${latestUpload.id}`,
      });

      if (!result.success) {
        if (result.code === "ALREADY_PAID") {
          // Already paid — navigate directly to bulk upload dashboard
          navigate("/bulk-upload");
          return;
        }
        throw new Error(result.message || "Could not start payment.");
      }

      const data = result.data;

      // NET flow: if business terms changed between submit and pay, handle it
      if (data.flow === "net") {
        navigate(`/invoices/${data.invoice_id}`);
        return;
      }

      // FIX-HOOK-02: store gateway credentials in navigation state so
      // PaymentPage can read them without a separate API call.
      navigate(`/payment/${data.transaction_id}`, {
        state: {
          clientSecret: data.client_secret || null, // Stripe
          approvalUrl: data.approval_url || null, // PayPal
          orderId: data.order_id || null, // PayPal
          amount: data.amount,
          currency: data.currency || "GBP",
          isBulk: true,
        },
      });
    } catch (err) {
      setUploadError({
        title: "Payment initiation failed",
        message: err.message || "Could not start payment. Please try again.",
      });
    } finally {
      setIsInitiatingPayment(false);
    }
  };

  // ── Error rows ────────────────────────────────────────────────────────────

  const fetchErrorsForId = useCallback(async (id, page = 1) => {
    setIsFetchingErrors(true);
    try {
      const data = await BulkUploadApi.getErrors(id, { page, pageSize: 50 });
      setErrorRows(data.results || []);
      setErrorMeta({ count: data.count, page: data.page });
      setErrorPage(page);
    } catch (err) {
      console.error("[useBulkUpload] getErrors failed:", err);
    } finally {
      setIsFetchingErrors(false);
    }
  }, []);

  const fetchErrors = useCallback(
    (page = 1) => {
      if (latestUpload?.id) fetchErrorsForId(latestUpload.id, page);
    },
    [latestUpload, fetchErrorsForId],
  );

  // ── File actions ──────────────────────────────────────────────────────────

  const handleRetryFailed = useCallback(async () => {
    if (!latestUpload?.id) return;
    try {
      await BulkUploadApi.retryFailed(latestUpload.id);
      startPolling(latestUpload.id);
    } catch (err) {
      setUploadError({ title: "Retry failed", message: err.message });
    }
  }, [latestUpload, startPolling]);

  const handleDownloadTemplate = useCallback(async () => {
    try {
      await BulkUploadApi.downloadTemplate();
    } catch (err) {
      setUploadError({ title: "Download failed", message: err.message });
    }
  }, []);

  const handleDownloadErrorReport = useCallback(async () => {
    if (!latestUpload?.id) return;
    try {
      await BulkUploadApi.downloadErrorReport(latestUpload.id);
    } catch (err) {
      setUploadError({ title: "Download failed", message: err.message });
    }
  }, [latestUpload]);

  // ── Dashboard ─────────────────────────────────────────────────────────────

  const fetchStats = useCallback(async () => {
    setIsFetchingStats(true);
    try {
      const data = await BulkUploadApi.getStats();
      setStats(data);
    } catch (err) {
      console.error("[useBulkUpload] getStats failed:", err);
    } finally {
      setIsFetchingStats(false);
    }
  }, []);

  const fetchUploads = useCallback(async (page = 1) => {
    setIsFetchingUploads(true);
    try {
      const data = await BulkUploadApi.listUploads({ page });
      setUploads(data);
    } catch (err) {
      console.error("[useBulkUpload] listUploads failed:", err);
    } finally {
      setIsFetchingUploads(false);
    }
  }, []);

  // ── Cleanup on unmount ────────────────────────────────────────────────────
  useEffect(() => {
    return () => {
      if (pollingRef.current) clearPolling();
    };
  }, [clearPolling]);

  // ────────────────────────────────────────────────────────────────────────────
  // Return all hook state and handlers
  // ────────────────────────────────────────────────────────────────────────────
  return {
    // Wizard state
    file,
    setFile,
    batchName,
    setBatchName,
    notes,
    setNotes,
    currentStep,
    nextStep,
    prevStep,
    goToStep,
    uploadProgress,
    isUploading,
    isSubmitting,
    uploadError,
    setUploadError,
    uploadResult,
    paymentPath,
    netDays,
    availableCredit,

    // Processing state
    processingStatus,
    latestUpload,
    creditLimitError,

    // Error rows
    errorRows,
    errorMeta,
    errorPage,
    setErrorPage,
    isFetchingErrors,

    // Dashboard
    stats,
    isFetchingStats,
    uploads,
    isFetchingUploads,

    // PHASE 3 STEP 7: BusinessProfile detection
    isBusinessProfileRequired,
    isProfileCreating,
    retryPendingAction,

    // Payment gateway preference
    gatewayPreference,
    setGatewayPreference,

    // Handlers
    handleFileSelect,
    handleValidateAndUpload,
    handleSubmit,
    handleRetryFailed,
    handleDownloadTemplate,
    handleDownloadErrorReport,
    handleViewInvoice,
    handleInitiatePayment,
    isInitiatingPayment,
    fetchErrors,
    fetchStats,
    fetchUploads,
    reset: () => {
      setFile(null);
      setBatchName("");
      setNotes("");
      setCurrentStep(0);
      setUploadProgress(0);
      setIsUploading(false);
      setIsSubmitting(false);
      setUploadError(null);
      setUploadResult(null);
      uploadResultRef.current = null;
      validationCompleteRef.current = false;
      setPaymentPath(null);
      setNetDays(0);
      setAvailableCredit(null);
      setProcessingStatus("idle");
      setLatestUpload(null);
      setCreditLimitError(null);
      setErrorRows([]);
      setErrorMeta(null);
      setErrorPage(1);
      setIsBusinessProfileRequired(false);
      setIsProfileCreating(false);
      pendingActionRef.current = null;
      clearPolling();
    },
  };
}
