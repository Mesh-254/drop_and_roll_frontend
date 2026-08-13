"use client";
import { useState, useCallback, useEffect, useMemo, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import {
  X,
  User,
  MapPin,
  Package,
  CreditCard,
  AlertCircle,
  Loader2,
  Info,
  ChevronLeft,
  Shield,
} from "lucide-react";
import ParcelDetails from "./ParcelDetails";
import { validateAllParcels, formatParcelsForSubmission } from "./parcelValidation";
// Default API singletons. BookingPage renders this modal without api props —
// destructuring bookingApi from props alone made it undefined and crashed
// "Proceed to Payment" with `Cannot read properties of undefined
// (reading 'createBooking')`. Props can still override (tests, storybook),
// but the singletons are the default, same as every other component.
import { bookingApi as defaultBookingApi } from "../../api/BookingApi";
import { paymentApi as defaultPaymentApi } from "../../api/PaymentApi";
import { useAuth } from "../../contexts/AuthContext";

const DEBUG = import.meta.env.NODE_ENV === "development" && false; // Set to true for dev debug logs
const REQUOTE_DEBOUNCE_MS = 400;

const debugLog = (msg, data) => {
  if (DEBUG) {
    console.log(`[BookingModal] ${msg}`, data);
  }
};

// The quote wizard and this modal historically used DIFFERENT parcel field
// names (wizard: weightKg camelCase; modal editor/validation: weight_kg
// snake_case). Wizard-shaped parcels therefore always failed
// validateAllParcels here, which is the root of the parcel/quote desync —
// the modal treated every handed-over parcel as blank. Normalize at the
// boundary: everything INSIDE the modal is snake_case; Back hands camelCase
// back to the wizard.
const toModalParcel = (p, i) => ({
  id: p.id ?? i + 1,
  weight_kg: p.weight_kg ?? p.weightKg ?? "",
  dimensions: {
    length: p.dimensions?.length ?? "",
    width: p.dimensions?.width ?? "",
    height: p.dimensions?.height ?? "",
  },
  fragile: Boolean(p.fragile),
});
const toWizardParcel = (p, i) => ({
  id: p.id ?? i + 1,
  weightKg: String(p.weight_kg ?? p.weightKg ?? ""),
  dimensions: {
    length: String(p.dimensions?.length ?? ""),
    width: String(p.dimensions?.width ?? ""),
    height: String(p.dimensions?.height ?? ""),
  },
  fragile: Boolean(p.fragile),
});

const formatAddress = (addr) => {
  if (!addr || !addr.line1) return "—";
  return [addr.line1, addr.line2, addr.city, addr.region, addr.postal_code]
    .filter(Boolean)
    .join(", ");
};

const ContactInfo = ({ formData, onUpdate, validation, isAuthenticated }) => {
  if (isAuthenticated) {
    return null;
  }

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold text-foreground flex items-center">
        <User className="h-5 w-5 text-brand-text mr-2" />
        Contact Information
      </h3>
      <p className="text-sm text-muted-foreground">
        We'll use your email to send you booking updates and confirmations.
      </p>

      <div>
        <label className="block text-sm font-medium text-muted-foreground mb-2">
          Email Address *
        </label>
        <input
          type="email"
          value={formData.guestEmail || ""}
          onChange={(e) => onUpdate({ guestEmail: e.target.value })}
          placeholder="Enter your email address"
          className="w-full px-4 py-3 border border-border-strong rounded-lg bg-card dark:bg-surface text-foreground placeholder-subtle-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent transition-colors"
        />
        {validation.guestEmail && (
          <div className="flex items-center text-destructive text-sm mt-2">
            <AlertCircle size={16} className="mr-2" />
            {validation.guestEmail}
          </div>
        )}
      </div>
    </div>
  );
};

/** Server-computed price breakdown (quote.meta from the pricing engine). */
const PriceBreakdown = ({ quote, requoteState }) => {
  const b = quote?.meta || {};
  const rows = [
    ["Base fare", b.base_price],
    [
      b.extra_parcels > 0
        ? `Extra parcels (${b.extra_parcels} × £${Number(b.extra_parcel_charge_per || 0).toFixed(2)})`
        : null,
      b.extra_parcel_fee,
    ],
    [
      b.extra_distance_miles > 0
        ? `Distance (${Number(b.extra_distance_miles).toFixed(1)} miles beyond ${Number(
            b.free_miles || 0,
          ).toFixed(0)} free)`
        : null,
      b.extra_distance_charge,
    ],
    [b.insurance_fee > 0 ? "Insurance" : null, b.insurance_fee],
    [b.discount > 0 ? "Discount" : null, b.discount > 0 ? -b.discount : null],
  ].filter(([label]) => label);

  return (
    <div className="mt-3 border-t border-border pt-3 space-y-1 text-sm">
      {rows.map(([label, value]) => (
        <div key={label} className="flex justify-between text-muted-foreground">
          <span>{label}</span>
          <span>£{Number(value || 0).toFixed(2)}</span>
        </div>
      ))}
      <div className="flex justify-between font-semibold text-foreground pt-1">
        <span>Total</span>
        <span className="flex items-center gap-2">
          {requoteState === "pending" && (
            <Loader2 size={14} className="animate-spin text-brand-text" />
          )}
          £{quote?.final_price ? Number.parseFloat(quote.final_price).toFixed(2) : "0.00"}
        </span>
      </div>
    </div>
  );
};

export default function BookingModalEnhanced({
  isOpen,
  onClose,
  onBack,
  quote,
  bookingApi: bookingApiProp,
  paymentApi: paymentApiProp,
  initialFormData = {},
  existingBookingId,
  existingTransactionId,
  resumeGuestEmail,
}) {
  const navigate = useNavigate();
  const location = useLocation();
  const bookingApi = bookingApiProp || defaultBookingApi;
  const paymentApi = paymentApiProp || defaultPaymentApi;
  const { isAuthenticated, user } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(null);
  const [validation, setValidation] = useState({});
  const [parcels, setParcels] = useState(
    (initialFormData.parcels || []).map(toModalParcel)
  );
  const [showParcelErrors, setShowParcelErrors] = useState(false);

  // The quote whose id and total are actually used for this draft. Every
  // parcel mutation recomputes it server-side (a fresh Quote row = a new
  // draft revision); the displayed total is ALWAYS this server value, never
  // a client-side estimate.
  const [activeQuote, setActiveQuote] = useState(quote);
  // "idle" — total matches the current parcel list; "pending" — recompute in
  // flight; "error" — recompute failed. Proceed is only enabled on "idle".
  const [requoteState, setRequoteState] = useState("idle");
  const [requoteError, setRequoteError] = useState(null);
  const requoteRequestRef = useRef(0);
  // The parcel list the CURRENT activeQuote was priced for. Skipping only
  // when parcels match this (not the initial list) means an edit-then-revert
  // still recomputes back to the correct total.
  const lastQuotedParcelsRef = useRef(
    JSON.stringify((initialFormData.parcels || []).map(toModalParcel))
  );

  const resumeBookingId =
    location.state?.existingBookingId || existingBookingId || null;
  const resumeTransactionId =
    location.state?.existingTransactionId || existingTransactionId || null;
  const resumeEmail =
    location.state?.guestEmail || resumeGuestEmail || null;

  const [resumeStatus, setResumeStatus] = useState(
    resumeTransactionId ? "checking" : null
  );

  const [formData, setFormData] = useState({
    promoCode: "",
    notes: "",
    guestEmail: isAuthenticated ? "" : resumeEmail || user?.email || "",
    pickupAddress: initialFormData.pickupAddress || {},
    dropoffAddress: initialFormData.dropoffAddress || {},
    ...initialFormData,
  });

  useEffect(() => {
    if (location.state?.formData) {
      setFormData((prev) => ({
        ...prev,
        pickupAddress: location.state.formData.pickupAddress || {},
        dropoffAddress: location.state.formData.dropoffAddress || {},
        ...location.state.formData,
      }));
      if (location.state.formData.parcels) {
        const normalized = location.state.formData.parcels.map(toModalParcel);
        setParcels(normalized);
        lastQuotedParcelsRef.current = JSON.stringify(normalized);
      }
    }
  }, [location.state]);

  useEffect(() => {
    setActiveQuote(quote);
  }, [quote]);

  // ── Resume-edit session check (spec: reuse, don't recreate) ───────────────
  // Arriving back from the payment page with a still-PENDING transaction now
  // KEEPS it. Parcel edits re-price the SAME quote in place (quote_id on the
  // recompute), the backend syncs the pending booking + transaction amounts,
  // and "Proceed to Payment" reuses the same booking/transaction via the
  // create endpoint's idempotency — no cancelled orphans, no duplicate
  // bookings, no junk Quote rows. We only verify the session is still
  // pending so the banner can tell the user what will happen.
  useEffect(() => {
    if (!resumeTransactionId || !paymentApi) return;
    let mounted = true;
    setResumeStatus("checking");
    (async () => {
      const result = await paymentApi.getTransaction(
        resumeTransactionId,
        resumeEmail
      );
      if (!mounted) return;
      if (!result.success || !result.data) {
        setResumeStatus("unknown");
        return;
      }
      setResumeStatus(result.data.status === "pending" ? "resumable" : "stale");
    })();
    return () => {
      mounted = false;
    };
  }, [resumeTransactionId, resumeEmail, paymentApi]);

  // ── Live re-quote on every parcel mutation (spec §B) ──────────────────────
  // Debounced 400ms; sends the CURRENT full parcel list to
  // POST /api/booking/quotes/compute/. Runs only once all parcels are valid
  // (an in-progress blank parcel isn't quotable yet), and ignores stale
  // responses so rapid edits can't interleave totals.
  useEffect(() => {
    if (!quote?.id) return;
    if (JSON.stringify(parcels) === lastQuotedParcelsRef.current) return; // already priced
    const check = validateAllParcels(parcels);
    if (!check.isValid || parcels.length === 0) {
      // Not quotable yet — Proceed stays blocked via parcel validation.
      setRequoteState("idle");
      return;
    }

    setRequoteState("pending");
    setRequoteError(null);
    const thisRequest = ++requoteRequestRef.current;
    const timer = setTimeout(async () => {
      const result = await bookingApi.createQuote({
        parcels: parcels.map(toWizardParcel),
        shipmentType: activeQuote?.shipping_type || quote.shipping_type,
        service: activeQuote?.service_type || quote.service_type,
        distanceKm: activeQuote?.distance_km ?? quote.distance_km,
        insuranceAmount: activeQuote?.insurance_amount ?? quote.insurance_amount,
        discount: activeQuote?.discount_amount ?? quote.discount_amount,
        // Re-price the SAME quote in place — the draft (and any pending
        // booking linked to it) keeps one stable quote id across edits.
        quoteId: activeQuote?.id ?? quote.id,
        guestEmail: !isAuthenticated ? formData.guestEmail || resumeEmail || undefined : undefined,
      });
      if (thisRequest !== requoteRequestRef.current) return; // stale
      if (result.success && result.data?.id) {
        setActiveQuote(result.data);
        lastQuotedParcelsRef.current = JSON.stringify(parcels);
        setRequoteState("idle");
      } else {
        setRequoteState("error");
        setRequoteError(
          result.message || "Couldn't update the price for your changes. Please retry."
        );
      }
    }, REQUOTE_DEBOUNCE_MS);

    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [parcels]);

  const updateFormData = useCallback((updates) => {
    setFormData((prev) => ({ ...prev, ...updates }));
    setValidation((prev) => {
      const newValidation = { ...prev };
      Object.keys(updates).forEach((key) => {
        delete newValidation[key];
      });
      return newValidation;
    });
  }, []);

  const validateEmail = (email) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const validateForm = () => {
    const errors = {};

    if (!isAuthenticated) {
      if (!formData.guestEmail?.trim()) {
        errors.guestEmail = "Email is required";
      } else if (!validateEmail(formData.guestEmail)) {
        errors.guestEmail = "Please enter a valid email address";
      }
    }

    if (!formData.pickupAddress?.line1) {
      errors.pickupAddress = "Please select a valid pickup address";
    }
    if (!formData.dropoffAddress?.line1) {
      errors.dropoffAddress = "Please select a valid dropoff address";
    }

    // Validate parcels
    const parcelValidation = validateAllParcels(parcels);
    if (!parcelValidation.isValid) {
      errors.parcels = "Please fix all parcel validation errors";
    }

    debugLog("Form validation complete:", { errors, parcelCount: parcels.length });
    return errors;
  };

  const handleSubmit = async () => {
    setShowParcelErrors(true);
    const errors = validateForm();

    if (Object.keys(errors).length > 0) {
      debugLog("Form submission blocked due to errors:", errors);
      setValidation({
        ...errors,
        ...(!formData.pickupAddress.line1 ? { pickupAddress: "Required" } : {}),
        ...(!formData.dropoffAddress.line1 ? { dropoffAddress: "Required" } : {}),
      });
      return;
    }

    if (requoteState !== "idle") return; // total not in sync with parcels

    setIsSubmitting(true);
    setSubmitError(null);

    try {
      // Format parcels for submission
      const formattedParcels = formatParcelsForSubmission(parcels);
      debugLog("Formatted parcels for submission:", formattedParcels);

      const payload = {
        // The ACTIVE quote id — a fresh server-priced revision whenever
        // parcels changed. Never the original prop quote after an edit.
        quoteId: activeQuote.id,
        pickupAddress: formData.pickupAddress,
        dropoffAddress: formData.dropoffAddress,
        promoCode: formData.promoCode || null,
        notes: formData.notes || null,
        receiverEmail: formData.receiverEmail,
        receiverPhone: formData.receiverPhone,
        parcels: formattedParcels, // Include validated parcels
      };

      if (!isAuthenticated && formData.guestEmail) {
        payload.guestEmail = formData.guestEmail.trim();
      }

      debugLog("Booking payload:", payload);

      const result = await bookingApi.createBooking(payload);

      if (result.success) {
        const transaction = result.data;
        debugLog("Transaction created:", transaction);

        if (!transaction.id) {
          throw new Error("Transaction ID is missing");
        }

        navigate(`/pay/${transaction.id}`, {
          state: {
            transaction,
            quote: activeQuote,
            booking: transaction.booking,
            guestEmail: payload.guestEmail,
            // The payment page keys its idempotency on this draft revision:
            // a re-quote produces a new quote id, so a stale amount can
            // never dedupe against the new session.
            draftRevision: activeQuote.id,
          },
        });
      } else {
        throw new Error(result.message || "Failed to create booking");
      }
    } catch (error) {
      console.error("[BookingModal] Booking error:", error);
      setSubmitError(
        error.message || "An error occurred while creating the booking"
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  // "Back" — return to the quote wizard with the FULL draft state (addresses,
  // parcels, contact info, promo code, active quote) so nothing is lost.
  const handleBack = () => {
    if (typeof onBack === "function") {
      onBack({
        formData: { ...formData, parcels: parcels.map(toWizardParcel) },
        parcels: parcels.map(toWizardParcel),
        quote: activeQuote,
      });
    }
  };

  // Aggregates for the booking summary
  const totalWeight = useMemo(
    () =>
      parcels.reduce(
        (sum, p) => sum + (Number.parseFloat(p.weightKg ?? p.weight_kg) || 0),
        0
      ),
    [parcels]
  );
  const fragileCount = useMemo(
    () => parcels.filter((p) => p.fragile).length,
    [parcels]
  );

  if (!isOpen || !quote) return null;

  // Validate parcels for display
  const parcelValidation = validateAllParcels(parcels);
  const hasParcelErrors = !parcelValidation.isValid;
  const proceedBlocked =
    isSubmitting || hasParcelErrors || requoteState !== "idle";

  return (
    <div className="fixed inset-0 bg-overlay flex items-center justify-center z-50 p-4">
      <div className="bg-card rounded-2xl shadow-2xl w-full max-w-4xl max-h-[95vh] overflow-y-auto animate-in zoom-in-95 duration-300">
        <div className="flex items-center justify-between p-6 border-b border-border bg-primary text-primary-foreground rounded-t-2xl">
          <div>
            <h2 className="text-2xl font-bold">Complete Your Booking</h2>
            <p className="text-brand-text text-sm">
              Total: GBP{" "}
              {activeQuote?.final_price
                ? Number.parseFloat(activeQuote.final_price).toFixed(2)
                : "0.00"}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-primary-hover rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-ring"
            aria-label="Close modal"
          >
            <X size={24} />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {resumeBookingId && resumeStatus && (
            <div
              role="status"
              className={`flex items-start gap-2 rounded-lg p-3 text-sm border ${
                resumeStatus === "stale"
                  ? "bg-warning-surface border-warning/30 text-warning"
                  : "bg-info-surface border-info/30 text-info"
              }`}
            >
              {resumeStatus === "checking" ? (
                <Loader2 className="h-4 w-4 mt-0.5 flex-shrink-0 animate-spin" />
              ) : (
                <Info className="h-4 w-4 mt-0.5 flex-shrink-0" />
              )}
              <span>
                {resumeStatus === "checking" &&
                  "Checking your previous payment session…"}
                {resumeStatus === "resumable" &&
                  "You're editing your existing booking. Any changes update its price, and proceeding returns you to the same payment — nothing is duplicated."}
                {resumeStatus === "stale" &&
                  "Your previous payment session is no longer available. A new one will be created when you proceed."}
                {resumeStatus === "unknown" &&
                  "You're editing a previously started booking. Your payment will match the current total when you proceed."}
              </span>
            </div>
          )}

          <div className="bg-muted dark:bg-surface rounded-lg p-4">
            <h3 className="text-lg font-semibold text-foreground mb-3 flex items-center">
              <Package className="h-5 w-5 text-brand-text mr-2" />
              Booking Summary
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-muted-foreground">
                  Service:
                </span>
                <span className="ml-2 font-medium text-foreground">
                  {activeQuote?.service_type?.name || quote.service_type?.name || "—"}
                </span>
              </div>
              <div>
                <span className="text-muted-foreground">
                  Shipment:
                </span>
                <span className="ml-2 font-medium text-foreground">
                  {activeQuote?.shipping_type?.name || quote.shipping_type?.name || "—"}
                </span>
              </div>
              <div>
                <span className="text-muted-foreground">
                  Parcels:
                </span>
                <span className="ml-2 font-medium text-foreground">
                  {parcels.length}
                </span>
              </div>
              <div>
                <span className="text-muted-foreground">
                  Total weight:
                </span>
                <span className="ml-2 font-medium text-foreground">
                  {totalWeight.toFixed(1)}kg
                </span>
              </div>

              {parcels.length > 0 && (
                <div className="md:col-span-2 flex flex-wrap gap-2">
                  {parcels.map((p, i) => {
                    const d = p.dimensions || {};
                    return (
                      <span
                        key={p.id ?? i}
                        className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-card dark:bg-surface-hover border border-border dark:border-border-strong text-xs text-muted-foreground"
                      >
                        <Package size={12} className="text-brand-text" />
                        {Number.parseFloat(p.weightKg ?? p.weight_kg) || 0}kg ·{" "}
                        {d.length || "?"}×{d.width || "?"}×{d.height || "?"}cm
                        {p.fragile && (
                          <Shield size={12} className="text-warning" aria-label="Fragile" />
                        )}
                      </span>
                    );
                  })}
                </div>
              )}

              {fragileCount > 0 && (
                <div className="md:col-span-2 text-warning flex items-center gap-1.5">
                  <Shield size={14} />
                  {fragileCount} fragile {fragileCount === 1 ? "item" : "items"} — handled with
                  extra care
                </div>
              )}

              <div className="md:col-span-2">
                <div className="flex items-start space-x-2">
                  <MapPin className="h-4 w-4 text-success mt-0.5 flex-shrink-0" />
                  <div>
                    <span className="text-muted-foreground">
                      From:
                    </span>
                    <span className="ml-2 font-medium text-foreground">
                      {formatAddress(formData.pickupAddress)}
                    </span>
                  </div>
                </div>
              </div>
              <div className="md:col-span-2">
                <div className="flex items-start space-x-2">
                  <MapPin className="h-4 w-4 text-destructive mt-0.5 flex-shrink-0" />
                  <div>
                    <span className="text-muted-foreground">
                      To:
                    </span>
                    <span className="ml-2 font-medium text-foreground">
                      {formatAddress(formData.dropoffAddress)}
                    </span>
                  </div>
                </div>
              </div>

              {formData.promoCode && (
                <div className="md:col-span-2">
                  <span className="text-muted-foreground">Promo code:</span>
                  <span className="ml-2 font-medium text-foreground">
                    {formData.promoCode}
                  </span>
                </div>
              )}
            </div>

            <PriceBreakdown quote={activeQuote} requoteState={requoteState} />
          </div>

          {/* Enhanced Parcel Details Section */}
          <ParcelDetails
            parcels={parcels}
            onUpdate={setParcels}
            showErrors={showParcelErrors || hasParcelErrors}
          />

          {requoteState === "error" && (
            <div className="bg-destructive-surface border border-destructive/30 rounded-lg p-3 text-sm text-destructive flex items-center gap-2">
              <AlertCircle size={16} />
              {requoteError}
              <button
                type="button"
                onClick={() => setParcels((p) => [...p])}
                className="ml-auto underline font-medium"
              >
                Retry
              </button>
            </div>
          )}

          <ContactInfo
            formData={formData}
            onUpdate={updateFormData}
            validation={validation}
            isAuthenticated={isAuthenticated}
          />

          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-foreground">
              Additional Options
            </h3>

            <div>
              <label className="block text-sm font-medium text-muted-foreground mb-2">
                Promo Code
              </label>
              <input
                type="text"
                value={formData.promoCode}
                onChange={(e) => updateFormData({ promoCode: e.target.value })}
                placeholder="Enter promo code (optional)"
                className="w-full px-4 py-3 border border-border-strong rounded-lg bg-card dark:bg-surface text-foreground placeholder-subtle-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent transition-colors"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-muted-foreground mb-2">
                Special Instructions
              </label>
              <textarea
                value={formData.notes}
                onChange={(e) => updateFormData({ notes: e.target.value })}
                placeholder="Any special instructions for pickup or delivery (optional)"
                rows={3}
                className="w-full px-4 py-3 border border-border-strong rounded-lg bg-card dark:bg-surface text-foreground placeholder-subtle-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent transition-colors resize-none"
              />
            </div>
          </div>

          {submitError && (
            <div className="bg-destructive-surface border border-destructive/30 rounded-lg p-4">
              <div className="flex items-center">
                <AlertCircle className="h-5 w-5 text-destructive mr-2" />
                <span className="text-destructive">
                  {submitError}
                </span>
              </div>
            </div>
          )}
        </div>

        <div className="flex justify-between items-center p-6 border-t border-border bg-muted dark:bg-surface rounded-b-2xl">
          <div className="flex items-center gap-3">
            {typeof onBack === "function" && (
              <button
                onClick={handleBack}
                disabled={isSubmitting}
                className="flex items-center px-4 py-2 text-muted-foreground hover:text-foreground border border-border-strong rounded-lg hover:bg-muted dark:hover:bg-surface-hover transition-colors focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
              >
                <ChevronLeft size={16} className="mr-1" />
                Back
              </button>
            )}
            <div className="text-sm text-muted-foreground">
              Total:{" "}
              <span className="font-bold text-foreground">
                GBP{" "}
                {activeQuote?.final_price
                  ? Number.parseFloat(activeQuote.final_price).toFixed(2)
                  : "0.00"}
              </span>
              {requoteState === "pending" && (
                <span className="ml-2 text-brand-text">updating…</span>
              )}
            </div>
          </div>

          <div className="flex space-x-3">
            <button
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 text-muted-foreground hover:text-foreground border border-border-strong rounded-lg hover:bg-muted dark:hover:bg-surface-hover transition-colors focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
            >
              Cancel
            </button>

            <button
              onClick={handleSubmit}
              disabled={proceedBlocked}
              className={`flex items-center px-6 py-3 text-primary-foreground font-bold rounded-lg transition-all transform focus:outline-none focus:ring-2 focus:ring-ring ${
                proceedBlocked && !isSubmitting
                  ? "bg-surface-hover cursor-not-allowed"
                  : "bg-primary hover:bg-primary-hover hover:scale-105"
              } ${isSubmitting ? "opacity-75 cursor-not-allowed" : ""}`}
            >
              {isSubmitting ? (
                <>
                  <Loader2 size={20} className="mr-2 animate-spin" />
                  Creating Booking...
                </>
              ) : requoteState === "pending" ? (
                <>
                  <Loader2 size={20} className="mr-2 animate-spin" />
                  Updating price…
                </>
              ) : (
                <>
                  <CreditCard size={20} className="mr-2" />
                  Proceed to Payment
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
