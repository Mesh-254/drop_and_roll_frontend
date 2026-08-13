/**
 * PendingBookingsSection.jsx
 * ══════════════════════════════════════════════════════════════════════════════
 * Profile-page section listing the authenticated user's payable pending
 * bookings (status pending_payment, still inside the payment window),
 * soonest-to-expire first.
 *
 * "Complete payment" routes into /pay/:txId pre-hydrated with the pending
 * transaction the backend returned inline (same navigation-state hydration
 * contract as BookingModal → PaymentPage) — no fresh quote, no follow-up
 * transaction GET.
 *
 * Renders nothing at all when the user has no pending bookings, so the
 * profile stays uncluttered.
 */

import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { AlertCircle, Clock, CreditCard, Loader } from "lucide-react";
import bookingApi from "../../api/BookingApi";
import { formatTimeRemaining } from "../../utils/timeRemaining";

export default function PendingBookingsSection() {
  const navigate = useNavigate();
  const [state, setState] = useState({ loading: true, error: null, rows: [] });
  // Single fetch owner — StrictMode double-mount reuses the same promise.
  const requestRef = useRef(null);

  useEffect(() => {
    let mounted = true;
    if (!requestRef.current) {
      requestRef.current = bookingApi.getPendingBookings();
    }
    (async () => {
      const res = await requestRef.current;
      if (!mounted) return;
      if (!res.success) {
        setState({ loading: false, error: res.message, rows: [] });
        return;
      }
      setState({ loading: false, error: null, rows: res.data?.results || [] });
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const handleCompletePayment = (row) => {
    const tx = row.transaction;
    if (!tx?.id) return;
    navigate(`/pay/${tx.id}`, { state: { transaction: tx } });
  };

  if (state.loading) {
    return (
      <div className="mt-8 flex items-center justify-center py-4">
        <Loader className="w-5 h-5 animate-spin text-brand-text" />
        <span className="ml-2 text-muted-foreground text-sm">Checking for pending payments…</span>
      </div>
    );
  }

  // Errors and the empty case stay silent-but-honest: an empty list renders
  // nothing; a fetch error shows a quiet one-liner instead of a scary banner.
  if (state.error) {
    return (
      <p className="mt-8 text-sm text-subtle-foreground flex items-center gap-2">
        <AlertCircle className="w-4 h-4" />
        Couldn't check for pending payments right now.
      </p>
    );
  }
  if (state.rows.length === 0) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.15 }}
      className="mt-8"
      data-testid="pending-bookings-section"
    >
      <div className="bg-gradient-to-br from-card to-background border-2 border-warning/30 rounded-2xl p-8">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-lg bg-warning/20 flex items-center justify-center">
            <Clock className="w-5 h-5 text-warning" />
          </div>
          <div>
            <h3 className="text-2xl font-bold text-foreground">Pending Payments</h3>
            <p className="text-sm text-muted-foreground">
              These bookings are saved but not confirmed until you pay.
            </p>
          </div>
        </div>

        <div className="space-y-3">
          {state.rows.map((row) => {
            const remaining = formatTimeRemaining(row.payment_expires_at);
            return (
              <div
                key={row.booking_id}
                className="flex flex-col md:flex-row md:items-center gap-3 bg-surface/40 border border-border/40 rounded-xl p-4"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-foreground text-sm font-medium truncate">
                    {row.pickup || "Pickup"} → {row.dropoff || "Drop-off"}
                  </p>
                  <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                    <span className="text-brand-text font-semibold">£{row.final_price}</span>
                    {remaining && (
                      <span className="flex items-center gap-1 text-warning">
                        <Clock className="w-3 h-3" />
                        {remaining}
                      </span>
                    )}
                  </div>
                </div>
                <motion.button
                  whileHover={{ scale: 1.03 }}
                  whileTap={{ scale: 0.97 }}
                  onClick={() => handleCompletePayment(row)}
                  disabled={!row.transaction?.id}
                  className="flex items-center justify-center gap-2 px-5 py-2.5 bg-gradient-to-r
                             from-primary to-primary-hover hover:from-primary-hover hover:to-primary-hover
                             disabled:from-surface-hover disabled:to-surface-hover disabled:cursor-not-allowed
                             text-primary-foreground text-sm font-bold rounded-lg transition-all shrink-0"
                >
                  <CreditCard className="w-4 h-4" />
                  Complete payment
                </motion.button>
              </div>
            );
          })}
        </div>
      </div>
    </motion.div>
  );
}
