"use client";

import { motion } from "framer-motion";
import {
  MapPin,
  Zap,
  AlertCircle,
  Package,
  Weight,
  Minus,
  Plus,
  ArrowRight,
} from "lucide-react";
import { useState, useRef, useEffect, Suspense } from "react";
import GetQuoteBook from "../quote/GetQuoteBook";
import TrackParcelModal from "../track/TrackParcelModal";
import { useQuoteContext } from "../../contexts/QuoteContext";
import { useAuth } from "../../contexts/AuthContext";
import bookingApi from "../../api/BookingApi";

// UK postcode format (loose, accepts optional space): e.g. MK9 1AA / OX11AA
const POSTCODE_RE = /^[A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2}$/i;
const isValidPostcode = (pc) => POSTCODE_RE.test((pc || "").replace(/\s+/g, ""));

export default function Hero() {
  const [quickQuoteData, setQuickQuoteData] = useState({
    pickupPostcode: "",
    dropoffPostcode: "",
    parcelCount: 1,
    weightKg: "",
    serviceTypeId: "",
  });
  const [quickQuoteError, setQuickQuoteError] = useState("");
  const [errorField, setErrorField] = useState(null); // "pickup" | "dropoff" | null
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Result of the last instant quote. null = none yet.
  const [quoteResult, setQuoteResult] = useState(null);

  // Service types drive the dropdown AND the booking handoff. Pulled from the
  // same endpoint the real wizard uses so the list can never drift.
  const [serviceTypes, setServiceTypes] = useState([]);

  const inputRefs = {
    pickup: useRef(null),
    dropoff: useRef(null),
  };
  const [showQuoteModal, setShowQuoteModal] = useState(false);
  const [showTrackModal, setShowTrackModal] = useState(false);
  const { setQuickQuotePostcodes } = useQuoteContext();

  // Everything needed to pre-fill the booking wizard on "Continue to Booking".
  const [bookingHandoff, setBookingHandoff] = useState(null);

  const { isAuthenticated } = useAuth();

  // Load service types once for the dropdown.
  useEffect(() => {
    let alive = true;
    (async () => {
      const res = await bookingApi.getServiceTypes();
      if (alive && res.success && Array.isArray(res.data)) {
        setServiceTypes(res.data);
        // Default to the first service so the field is never empty.
        setQuickQuoteData((prev) =>
          prev.serviceTypeId ? prev : { ...prev, serviceTypeId: res.data[0]?.id || "" },
        );
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  const handleField = (field, value) => {
    setQuickQuoteData((prev) => ({ ...prev, [field]: value }));
    setQuickQuoteError("");
    setErrorField(null);
    // Any input change invalidates the shown quote.
    setQuoteResult(null);
  };

  const handlePostcodeChange = (field, value) =>
    handleField(field, value.toUpperCase());

  const adjustParcels = (delta) =>
    setQuickQuoteData((prev) => {
      const next = Math.min(20, Math.max(1, (Number(prev.parcelCount) || 1) + delta));
      setQuoteResult(null);
      return { ...prev, parcelCount: next };
    });

  const failValidation = (message, field = null) => {
    setQuickQuoteError(message);
    setErrorField(field);
    if (field && inputRefs[field]?.current) inputRefs[field].current.focus();
    return false;
  };

  const validate = () => {
    const { pickupPostcode, dropoffPostcode, weightKg } = quickQuoteData;
    if (!pickupPostcode.trim()) return failValidation("Please enter a collection postcode", "pickup");
    if (!isValidPostcode(pickupPostcode)) return failValidation("Invalid collection postcode (e.g. MK9 1AA)", "pickup");
    if (!dropoffPostcode.trim()) return failValidation("Please enter a delivery postcode", "dropoff");
    if (!isValidPostcode(dropoffPostcode)) return failValidation("Invalid delivery postcode (e.g. OX1 1AA)", "dropoff");
    const w = Number.parseFloat(weightKg);
    if (!weightKg || Number.isNaN(w) || w <= 0) return failValidation("Enter a total weight in kg");
    if (w > 1000) return failValidation("Total weight can't exceed 1000 kg");
    return true;
  };

  const handleQuickQuoteSubmit = async (e) => {
    e.preventDefault();
    setQuickQuoteError("");
    setErrorField(null);
    if (!validate()) return;

    const cleanPickup = quickQuoteData.pickupPostcode.replace(/\s+/g, "").toUpperCase();
    const cleanDropoff = quickQuoteData.dropoffPostcode.replace(/\s+/g, "").toUpperCase();

    setIsSubmitting(true);
    setQuoteResult(null);

    const res = await bookingApi.getInstantQuote({
      pickupPostalCode: cleanPickup,
      dropoffPostalCode: cleanDropoff,
      parcelCount: quickQuoteData.parcelCount,
      weightKg: quickQuoteData.weightKg,
      serviceTypeId: quickQuoteData.serviceTypeId || null,
    });

    setIsSubmitting(false);

    if (res.success) {
      setQuoteResult({ ok: true, ...res.data });
      // Stash postcodes in the shared context (kept for parity with the
      // existing hero → wizard bridge).
      setQuickQuotePostcodes(cleanPickup, cleanDropoff);
      return;
    }

    // Out-of-area is a distinct, non-error state; map field errors to inputs.
    if (res.outOfArea) {
      setQuoteResult({ ok: false, outOfArea: true, message: res.message });
    } else {
      failValidation(
        res.message,
        res.field === "pickup_postal_code" ? "pickup" : res.field === "dropoff_postal_code" ? "dropoff" : null,
      );
    }
  };

  // Carry the exact quote inputs into the real booking wizard. We pre-fill the
  // service, parcel weights and postcodes; shipmentType is intentionally left
  // unset so the wizard opens at step 1 (its shipment-type step) rather than
  // jumping to review — the visitor still picks Parcels/Cargo and adds parcel
  // dimensions, which the 10-second widget never collected.
  const handleContinueToBooking = () => {
    const cleanPickup = quickQuoteData.pickupPostcode.replace(/\s+/g, "").toUpperCase();
    const cleanDropoff = quickQuoteData.dropoffPostcode.replace(/\s+/g, "").toUpperCase();
    const service = serviceTypes.find((s) => s.id === quickQuoteData.serviceTypeId) || null;

    const parcels = Array.from({ length: quickQuoteData.parcelCount }, (_, i) => ({
      id: i + 1,
      // Spread the entered total across the first parcel; the rest start empty
      // so the user only tops up dimensions. Weight is what drives the price and
      // the total is preserved on parcel #1.
      weightKg: i === 0 ? String(quickQuoteData.weightKg) : "",
      dimensions: { length: "", width: "", height: "" },
      fragile: false,
    }));

    setBookingHandoff({
      pickup: cleanPickup,
      dropoff: cleanDropoff,
      initialState: {
        formData: {
          service,
          parcels,
        },
      },
    });
    setShowQuoteModal(true);
  };

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { staggerChildren: 0.2, delayChildren: 0.3 } },
  };
  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.8 } },
  };

  const openBlankModal = () => {
    setBookingHandoff(null);
    setShowQuoteModal(true);
  };

  return (
    <section className="relative min-h-screen flex items-center justify-center px-4 sm:px-6 lg:px-8 bg-gradient-to-br from-black via-gray-900 to-black pt-20 overflow-hidden">
      {/* Animated Background Elements */}
      <div className="absolute inset-0 overflow-hidden">
        <motion.div
          animate={{ x: [0, 100, 0], y: [0, 50, 0] }}
          transition={{ duration: 20, repeat: Infinity }}
          className="absolute top-20 right-20 w-96 h-96 bg-orange-500/10 rounded-full blur-3xl"
        />
        <motion.div
          animate={{ x: [0, -100, 0], y: [0, -50, 0] }}
          transition={{ duration: 25, repeat: Infinity }}
          className="absolute bottom-20 left-20 w-96 h-96 bg-orange-500/5 rounded-full blur-3xl"
        />
      </div>

      {/* Main Content */}
      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="relative z-10 max-w-6xl mx-auto w-full"
      >
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center mb-16">
          {/* Left Side - Text Content */}
          <motion.div variants={itemVariants} className="space-y-8">
            <h1 className="text-6xl md:text-7xl font-bold text-white leading-tight font-montserrat text-balance">
              Delivery{" "}
              <span className="bg-gradient-to-r from-orange-400 to-orange-600 bg-clip-text text-transparent">
                Perfected
              </span>
            </h1>

            <p className="text-xl text-gray-400 leading-relaxed max-w-lg">
              Fast, reliable same-day and next-day delivery across Milton
              Keynes, Oxford, and surrounding areas. Get your items where they
              need to be, on time, every time.
            </p>

            {/* Stats */}
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <div className="text-3xl font-bold text-orange-500 font-montserrat">500+</div>
                <p className="text-sm text-gray-400">Daily Deliveries</p>
              </div>
              <div className="space-y-2">
                <div className="text-3xl font-bold text-orange-500 font-montserrat">99.8%</div>
                <p className="text-sm text-gray-400">On-Time Rate</p>
              </div>
              <div className="space-y-2">
                <div className="text-3xl font-bold text-orange-500 font-montserrat">24/7</div>
                <p className="text-sm text-gray-400">Support</p>
              </div>
            </div>

            {/* CTA Buttons */}
            <div className="flex flex-col sm:flex-row gap-4 pt-4">
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={openBlankModal}
                className="px-8 py-4 rounded-full bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white font-bold shadow-lg hover:shadow-orange-500/40 transition-all duration-300"
              >
                Get Quote & Book
              </motion.button>
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => setShowTrackModal(true)}
                className="px-8 py-4 rounded-full border-2 border-orange-500/50 text-orange-400 hover:text-orange-300 hover:border-orange-400 font-bold transition-all duration-300 flex items-center justify-center gap-2"
              >
                <Zap size={20} />
                Track Delivery
              </motion.button>
            </div>
          </motion.div>

          {/* Right Side - Illustration Placeholder */}
          <motion.div
            variants={itemVariants}
            className="hidden lg:flex items-center justify-center"
          >
            <motion.div
              animate={{ y: [0, -20, 0] }}
              transition={{ duration: 4, repeat: Infinity }}
              className="relative w-full h-96 flex items-center justify-center"
            >
              <div className="absolute inset-0 bg-gradient-to-r from-orange-500/10 to-transparent rounded-3xl blur-2xl" />
              <div className="relative flex items-center justify-center">
                <div className="w-48 h-48 bg-gradient-to-br from-orange-500/20 to-transparent rounded-3xl border-2 border-orange-500/30 flex items-center justify-center">
                  <Zap className="w-24 h-24 text-orange-500/40" />
                </div>
              </div>
            </motion.div>
          </motion.div>
        </div>

        {/* Quick Quote Card - Floating Glass Effect */}
        <motion.div variants={itemVariants} whileHover={{ y: -5 }} className="relative mt-12">
          <div className="rounded-3xl border-2 border-orange-500/30 bg-gradient-to-br from-gray-900/50 via-black/50 to-gray-900/50 backdrop-blur-xl p-8 shadow-2xl hover:border-orange-500/50 transition-all duration-300">
            {/* Glow Effect */}
            <motion.div
              animate={{ opacity: [0.5, 0.8, 0.5] }}
              transition={{ duration: 3, repeat: Infinity }}
              className="absolute inset-0 bg-gradient-to-r from-orange-500/10 to-transparent rounded-3xl blur-xl"
            />

            {/* Card Content */}
            <div className="relative z-10">
              <h3 className="text-2xl font-bold text-white mb-2 font-montserrat flex items-center gap-2">
                <Zap className="w-6 h-6 text-orange-500" />
                Get an instant quote in 10 seconds
              </h3>
              <p className="text-gray-400 text-sm mb-6">
                We deliver across Milton Keynes, Oxford &amp; surrounding areas
              </p>

              {/* Form */}
              <form onSubmit={handleQuickQuoteSubmit} className="space-y-4">
                {/* Postcodes */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="relative">
                    <label className="block text-sm font-medium text-gray-300 mb-2 flex items-center gap-2">
                      <MapPin size={16} className="text-green-400" />
                      Collection Postcode
                    </label>
                    <input
                      ref={inputRefs.pickup}
                      type="text"
                      value={quickQuoteData.pickupPostcode}
                      onChange={(e) => handlePostcodeChange("pickupPostcode", e.target.value)}
                      placeholder="MK9 1AA"
                      className={`w-full px-4 py-3 rounded-lg bg-gray-800/50 border text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-colors ${
                        errorField === "pickup" ? "border-red-500" : "border-gray-700"
                      }`}
                    />
                  </div>

                  <div className="relative">
                    <label className="block text-sm font-medium text-gray-300 mb-2 flex items-center gap-2">
                      <MapPin size={16} className="text-red-400" />
                      Delivery Postcode
                    </label>
                    <input
                      ref={inputRefs.dropoff}
                      type="text"
                      value={quickQuoteData.dropoffPostcode}
                      onChange={(e) => handlePostcodeChange("dropoffPostcode", e.target.value)}
                      placeholder="OX1 1AA"
                      className={`w-full px-4 py-3 rounded-lg bg-gray-800/50 border text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-colors ${
                        errorField === "dropoff" ? "border-red-500" : "border-gray-700"
                      }`}
                    />
                  </div>
                </div>

                {/* Parcels / weight / service */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* Parcel count stepper */}
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2 flex items-center gap-2">
                      <Package size={16} className="text-orange-400" />
                      Parcels
                    </label>
                    <div className="flex items-center rounded-lg bg-gray-800/50 border border-gray-700 overflow-hidden">
                      <button
                        type="button"
                        aria-label="Decrease parcels"
                        onClick={() => adjustParcels(-1)}
                        className="px-3 py-3 text-gray-300 hover:text-white hover:bg-gray-700/50 transition-colors"
                      >
                        <Minus size={16} />
                      </button>
                      <span className="flex-1 text-center text-white font-semibold" aria-live="polite">
                        {quickQuoteData.parcelCount}
                      </span>
                      <button
                        type="button"
                        aria-label="Increase parcels"
                        onClick={() => adjustParcels(1)}
                        className="px-3 py-3 text-gray-300 hover:text-white hover:bg-gray-700/50 transition-colors"
                      >
                        <Plus size={16} />
                      </button>
                    </div>
                  </div>

                  {/* Weight */}
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2 flex items-center gap-2">
                      <Weight size={16} className="text-orange-400" />
                      Total weight (kg)
                    </label>
                    <input
                      type="number"
                      min="0.1"
                      step="0.1"
                      inputMode="decimal"
                      value={quickQuoteData.weightKg}
                      onChange={(e) => handleField("weightKg", e.target.value)}
                      placeholder="5"
                      className="w-full px-4 py-3 rounded-lg bg-gray-800/50 border border-gray-700 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-colors"
                    />
                  </div>

                  {/* Service type */}
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2 flex items-center gap-2">
                      <Zap size={16} className="text-orange-400" />
                      Service
                    </label>
                    <select
                      value={quickQuoteData.serviceTypeId}
                      onChange={(e) => handleField("serviceTypeId", e.target.value)}
                      className="w-full px-4 py-3 rounded-lg bg-gray-800/50 border border-gray-700 text-white focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-colors"
                    >
                      {serviceTypes.length === 0 && <option value="">Standard</option>}
                      {serviceTypes.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Error Message */}
                {quickQuoteError && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex items-center gap-2 p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400"
                  >
                    <AlertCircle size={18} className="flex-shrink-0" />
                    <span className="text-sm">{quickQuoteError}</span>
                  </motion.div>
                )}

                {/* Submit Button */}
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full py-4 px-6 rounded-lg bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 disabled:from-gray-500 disabled:to-gray-600 disabled:cursor-not-allowed text-white font-bold shadow-lg hover:shadow-orange-500/30 transition-all duration-300 flex items-center justify-center gap-2"
                >
                  {isSubmitting ? (
                    <>
                      <motion.div
                        animate={{ rotate: 360 }}
                        transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                        className="w-5 h-5 border-2 border-white border-t-transparent rounded-full"
                      />
                      Calculating...
                    </>
                  ) : (
                    <>
                      <Zap size={20} />
                      Get Instant Quote
                    </>
                  )}
                </motion.button>
              </form>

              {/* ── Result ─────────────────────────────────────────────── */}
              {quoteResult?.ok && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mt-6 rounded-2xl border border-orange-500/40 bg-black/40 p-6"
                >
                  <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
                    <div>
                      <p className="text-sm text-gray-400 mb-1">Estimated price</p>
                      <div className="text-4xl font-bold text-white font-montserrat">
                        {quoteResult.currency} {Number(quoteResult.price).toFixed(2)}
                      </div>
                      <p className="text-xs text-gray-500 mt-2">
                        ~{Number(quoteResult.distance_km).toFixed(1)} km ·{" "}
                        {quickQuoteData.parcelCount} parcel
                        {quickQuoteData.parcelCount > 1 ? "s" : ""} ·{" "}
                        {quickQuoteData.weightKg} kg
                      </p>
                    </div>
                    <motion.button
                      whileHover={{ scale: 1.03 }}
                      whileTap={{ scale: 0.97 }}
                      type="button"
                      onClick={handleContinueToBooking}
                      className="px-6 py-3 rounded-lg bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white font-bold shadow-lg transition-all duration-300 flex items-center justify-center gap-2 whitespace-nowrap"
                    >
                      Continue to Booking
                      <ArrowRight size={18} />
                    </motion.button>
                  </div>
                  <p className="text-[11px] text-gray-500 mt-3">
                    Final price is confirmed at checkout. Logged-in business
                    accounts may see account-specific rates.
                  </p>
                </motion.div>
              )}

              {quoteResult && !quoteResult.ok && quoteResult.outOfArea && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mt-6 flex items-start gap-3 rounded-2xl border border-yellow-500/30 bg-yellow-500/10 p-5 text-yellow-200"
                >
                  <AlertCircle size={20} className="flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold">Not currently serviceable</p>
                    <p className="text-sm text-yellow-200/80 mt-1">{quoteResult.message}</p>
                    <p className="text-sm text-yellow-200/80 mt-2">
                      We currently cover Milton Keynes, Oxford &amp; surrounding
                      areas. Need somewhere else?{" "}
                      <a href="/#contact" className="underline hover:text-yellow-100">
                        Contact us
                      </a>
                      .
                    </p>
                  </div>
                </motion.div>
              )}
            </div>
          </div>
        </motion.div>
      </motion.div>

      {/* Quote Modal */}
      {showQuoteModal && (
        <Suspense
          fallback={
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center">
              Loading...
            </div>
          }
        >
          <GetQuoteBook
            isOpen={showQuoteModal}
            onClose={() => {
              setShowQuoteModal(false);
              setTimeout(() => setBookingHandoff(null), 300);
            }}
            initialPickupPostcode={bookingHandoff?.pickup || ""}
            initialDropoffPostcode={bookingHandoff?.dropoff || ""}
            initialState={bookingHandoff?.initialState || null}
          />
        </Suspense>
      )}

      {/* Track Parcel Modal */}
      {showTrackModal && (
        <Suspense
          fallback={
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center">
              Loading...
            </div>
          }
        >
          <TrackParcelModal
            isOpen={showTrackModal}
            onClose={() => setShowTrackModal(false)}
          />
        </Suspense>
      )}
    </section>
  );
}
