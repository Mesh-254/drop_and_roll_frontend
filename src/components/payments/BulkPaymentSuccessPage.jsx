/**
 * BulkPaymentSuccessPage.jsx
 *
 * Route: /bulk-uploads/:uploadId/success
 *
 * ── Why this page exists ──────────────────────────────────────────────────
 * After Stripe Checkout completes, BulkPaymentPage:
 *   1. Receives ?session_id=cs_xxx back from Stripe
 *   2. POSTs /api/payments/confirm-success/ to finalise the transaction
 *   3. navigate(`/bulk-uploads/${uploadId}/success`, { replace: true })
 *
 * This page was MISSING from App.jsx — React Router had no route for
 * /bulk-uploads/:uploadId/success, so the user saw a blank page or a 404
 * fallback after a successful payment.
 *
 * ── What this page does ───────────────────────────────────────────────────
 * 1. Reads :uploadId from the URL params.
 * 2. Fetches the BulkUpload detail from GET /api/booking/bulk-uploads/:id/
 * 3. Shows a polished success screen with batch summary.
 * 4. Links to the bulk-upload detail page and dashboard.
 *
 * ── Auth ──────────────────────────────────────────────────────────────────
 * Must be wrapped in ProtectedRoute allowedRoles=["customer"] in App.jsx
 * (same as /pay/bulk/:uploadId).
 */

import React, { useState, useEffect } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import BulkUploadApi from "../../api/BulkUploadApi";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt(value) {
  const n = parseFloat(value);
  return isNaN(n) ? "0.00" : n.toFixed(2);
}

function fmtDate(iso) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    });
  } catch {
    return iso;
  }
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function CheckIcon() {
  return (
    <svg
      style={styles.checkSvg}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

function Spinner() {
  return <div style={styles.spinner} />;
}

function DetailRow({ label, value, highlight }) {
  return (
    <div style={styles.detailRow}>
      <span style={styles.detailLabel}>{label}</span>
      <span style={highlight ? { ...styles.detailValue, ...styles.detailHighlight } : styles.detailValue}>
        {value}
      </span>
    </div>
  );
}

// ─── Main component ────────────────────────────────────────────────────────────

export default function BulkPaymentSuccessPage() {
  const { uploadId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();

  const [upload, setUpload] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // The session_id might still be in the URL if the user was navigated here
  // with replace:true after a Stripe return (BulkPaymentPage passes it along).
  // We don't need it here — just display the upload status.
  const sessionId = new URLSearchParams(location.search).get("session_id");

  useEffect(() => {
    if (!uploadId) {
      setError("No upload ID found in URL.");
      setLoading(false);
      return;
    }

    let cancelled = false;

    async function load() {
      try {
        const data = await BulkUploadApi.getDetail(uploadId);
        if (!cancelled) setUpload(data);
      } catch (err) {
        if (!cancelled) {
          setError(
            err?.response?.data?.detail ||
              err?.response?.data?.error ||
              err?.message ||
              "Could not load batch details."
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, [uploadId]);

  // ── Loading state ──────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div style={styles.page}>
        <div style={styles.card}>
          <div style={styles.successHeader}>
            <Spinner />
            <h2 style={{ ...styles.heading, marginTop: 16 }}>Confirming your payment…</h2>
            <p style={styles.subtext}>This will only take a moment.</p>
          </div>
        </div>
      </div>
    );
  }

  // ── Error state ────────────────────────────────────────────────────────────
  // Non-fatal: even if we can't load the upload, payment was already confirmed.
  // Show a softer success message with a navigation fallback.
  if (error) {
    return (
      <div style={styles.page}>
        <div style={styles.card}>
          <div style={styles.successHeader}>
            <div style={styles.successIconWrap}>
              <CheckIcon />
            </div>
            <h1 style={styles.heading}>Payment Received</h1>
            <p style={styles.subtext}>
              Your payment was processed successfully. Your bookings will be
              confirmed shortly.
            </p>
          </div>
          <div style={styles.cardBody}>
            <p style={styles.smallHint}>
              (We couldn't load batch details — {error})
            </p>
            <div style={styles.btnRow}>
              <button
                style={styles.btnPrimary}
                onClick={() => navigate("/bulk-upload")}
              >
                Go to Dashboard
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── Success state ──────────────────────────────────────────────────────────
  const successful = upload?.success_count ?? upload?.successful ?? 0;
  const failed = upload?.failed_count ?? upload?.failed ?? 0;
  const total = upload?.total_rows ?? upload?.total ?? (successful + failed);
  const amount = fmt(upload?.effective_total ?? upload?.total_amount ?? upload?.computed_total);
  const filename = upload?.original_filename || upload?.batch_name || `Batch ${uploadId?.slice(0, 8)}`;

  return (
    <div style={styles.page}>
      <div style={styles.card}>

        {/* ── Success header ────────────────────────────────────────────── */}
        <div style={styles.successHeader}>
          <div style={styles.successIconWrap}>
            <CheckIcon />
          </div>
          <h1 style={styles.heading}>Payment Confirmed!</h1>
          <p style={styles.subtext}>
            Your batch has been paid and{" "}
            <strong>{successful}</strong>{" "}
            booking{successful !== 1 ? "s are" : " is"} now scheduled for delivery.
          </p>
        </div>

        <div style={styles.cardBody}>

          {/* ── Batch summary ────────────────────────────────────────────── */}
          <div style={styles.summaryBox}>
            <h3 style={styles.sectionTitle}>Batch Summary</h3>

            <DetailRow label="File" value={filename} />
            <DetailRow
              label="Bookings scheduled"
              value={`${successful} of ${total}`}
              highlight
            />
            {failed > 0 && (
              <DetailRow
                label="Rows with errors"
                value={failed}
              />
            )}
            <DetailRow label="Amount paid" value={`£${amount}`} highlight />
            {upload?.created_at && (
              <DetailRow label="Batch created" value={fmtDate(upload.created_at)} />
            )}
            {upload?.processed_at && (
              <DetailRow label="Processed at" value={fmtDate(upload.processed_at)} />
            )}
            {sessionId && (
              <DetailRow
                label="Stripe session"
                value={`${sessionId.slice(0, 20)}…`}
              />
            )}
          </div>

          {/* ── What happens next ────────────────────────────────────────── */}
          <div style={styles.nextBox}>
            <h3 style={styles.sectionTitle}>What happens next?</h3>
            <ul style={styles.nextList}>
              <li style={styles.nextItem}>
                <span style={styles.bullet}>✓</span>
                Your bookings are confirmed and queued for pickup.
              </li>
              <li style={styles.nextItem}>
                <span style={styles.bullet}>✓</span>
                A receipt will be emailed to you shortly.
              </li>
              <li style={styles.nextItem}>
                <span style={styles.bullet}>→</span>
                Track delivery status from the dashboard.
              </li>
            </ul>
          </div>

          {/* ── Actions ──────────────────────────────────────────────────── */}
          <div style={styles.btnRow}>
            <button
              style={styles.btnPrimary}
              onClick={() => navigate(`/bulk-upload/${uploadId}`)}
            >
              View Batch Details
            </button>
            <button
              style={styles.btnSecondary}
              onClick={() => navigate("/bulk-upload")}
            >
              Go to Dashboard
            </button>
          </div>

        </div>

        {/* ── Footer ───────────────────────────────────────────────────────── */}
        <div style={styles.cardFooter}>
          Questions?{" "}
          <a href="mailto:support@dropnroll.co.uk" style={styles.link}>
            support@dropnroll.co.uk
          </a>{" "}
          · Drop 'n Roll Logistics Ltd · Ref: {uploadId?.slice(0, 8)}
        </div>

      </div>
    </div>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = {
  page: {
    minHeight: "100vh",
    background: "#f1f5f9",
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "center",
    padding: "48px 16px",
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
  },
  card: {
    background: "#ffffff",
    borderRadius: "16px",
    boxShadow: "0 4px 32px rgba(0,0,0,0.10)",
    width: "100%",
    maxWidth: "560px",
    overflow: "hidden",
  },
  successHeader: {
    background: "linear-gradient(135deg, #0f172a 0%, #1e3a5f 100%)",
    borderBottom: "3px solid #22c55e",
    padding: "36px 32px 28px",
    textAlign: "center",
  },
  successIconWrap: {
    width: 56,
    height: 56,
    borderRadius: "50%",
    background: "#22c55e",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    margin: "0 auto 16px",
  },
  checkSvg: {
    width: 28,
    height: 28,
    color: "#ffffff",
  },
  heading: {
    fontSize: 24,
    fontWeight: 800,
    color: "#ffffff",
    margin: "0 0 8px",
    letterSpacing: "-0.5px",
  },
  subtext: {
    fontSize: 14,
    color: "#94a3b8",
    margin: 0,
    lineHeight: 1.6,
  },
  cardBody: {
    padding: "28px 32px",
  },
  summaryBox: {
    background: "#f8fafc",
    border: "1px solid #e2e8f0",
    borderRadius: 12,
    padding: "20px 24px",
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: 700,
    color: "#64748b",
    textTransform: "uppercase",
    letterSpacing: "0.8px",
    margin: "0 0 14px",
  },
  detailRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "6px 0",
    borderBottom: "1px solid #f1f5f9",
    fontSize: 14,
  },
  detailLabel: {
    color: "#64748b",
  },
  detailValue: {
    color: "#1e293b",
    fontWeight: 500,
    maxWidth: "60%",
    textAlign: "right",
    wordBreak: "break-all",
  },
  detailHighlight: {
    color: "#16a34a",
    fontWeight: 700,
  },
  nextBox: {
    background: "#f0fdf4",
    border: "1px solid #bbf7d0",
    borderRadius: 12,
    padding: "16px 24px",
    marginBottom: 24,
  },
  nextList: {
    listStyle: "none",
    margin: 0,
    padding: 0,
  },
  nextItem: {
    display: "flex",
    alignItems: "flex-start",
    gap: 10,
    fontSize: 14,
    color: "#166534",
    padding: "4px 0",
    lineHeight: 1.5,
  },
  bullet: {
    flexShrink: 0,
    fontWeight: 700,
    marginTop: 1,
    color: "#16a34a",
  },
  btnRow: {
    display: "flex",
    gap: 12,
    flexWrap: "wrap",
  },
  btnPrimary: {
    flex: 1,
    minWidth: 140,
    background: "#f97316",
    color: "#ffffff",
    border: "none",
    borderRadius: 10,
    padding: "13px 20px",
    fontSize: 14,
    fontWeight: 700,
    cursor: "pointer",
    boxShadow: "0 4px 14px rgba(249,115,22,0.30)",
  },
  btnSecondary: {
    flex: 1,
    minWidth: 140,
    background: "#f1f5f9",
    color: "#334155",
    border: "1px solid #e2e8f0",
    borderRadius: 10,
    padding: "13px 20px",
    fontSize: 14,
    fontWeight: 600,
    cursor: "pointer",
  },
  smallHint: {
    fontSize: 12,
    color: "#94a3b8",
    marginBottom: 16,
  },
  cardFooter: {
    background: "#f8fafc",
    borderTop: "1px solid #e2e8f0",
    padding: "14px 32px",
    textAlign: "center",
    fontSize: 12,
    color: "#94a3b8",
  },
  link: {
    color: "#f97316",
    textDecoration: "none",
  },
  spinner: {
    width: 40,
    height: 40,
    border: "3px solid rgba(255,255,255,0.2)",
    borderTop: "3px solid #22c55e",
    borderRadius: "50%",
    animation: "spin 0.8s linear infinite",
    margin: "0 auto",
  },
};
