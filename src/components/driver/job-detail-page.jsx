"use client";

/**
 * Everything about one job that the card deliberately does not say.
 *
 * The card answers "what do I do at this door". This page answers "what is this
 * shipment": both ends of the route, the parcel manifest, the schedule, the
 * references support will ask for, and the proof of delivery once it exists.
 *
 * BOTH ADDRESSES, ALWAYS
 * ----------------------
 * The card shows one address on purpose — the stop's. This page shows the whole
 * journey, with the driver's CURRENT stop marked, because that is the question
 * this page exists to answer: "where is this parcel going after I hand it over".
 *
 * WHY IT TAKES A `stopContext`
 * ----------------------------
 * `/api/booking/bookings/<id>/` returns a BOOKING. A same-day booking is one
 * booking row and two jobs at two different doors, so the detail response alone
 * cannot say which one the driver tapped. The list already resolved that (leg,
 * job number, next_status, blocked_reason), so it is handed down rather than
 * re-derived here — re-deriving it from the booking's status is exactly the
 * guess that sent same-day parcels to the hub.
 */

import { useState, useEffect, useCallback, useMemo } from "react";
import { toast } from "react-hot-toast";
import {
  MapPin,
  Phone,
  User,
  Package,
  AlertTriangle,
  Calendar,
  ChevronLeft,
  X,
  Lock,
  CheckCircle2,
  AlertCircle,
  ImageIcon,
  FileText,
  Camera,
  Hash,
  Weight,
  Ruler,
  Zap,
  Mail,
  StickyNote,
  ShieldAlert,
} from "lucide-react";
import { driverApi } from "../../api/driver-api";
import { ProofOfDelivery } from "./proof-of-delivery";
import { QRScannerModal } from "./QRScannerModal";
import { FailureReportModal } from "./FailureReportModal";
import { publishJobStatus } from "../../lib/driver-events";

function ProofOfDeliveryView({ proofData, onClose }) {
  const pods = Array.isArray(proofData) ? proofData : proofData ? [proofData] : [];

  return (
    <div
      className="fixed inset-0 bg-black/60 flex items-end sm:items-center justify-center z-50 p-0 sm:p-4"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-slate-900 rounded-t-3xl sm:rounded-2xl p-5 max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-xl font-bold text-slate-900 dark:text-white">
            Proof of Delivery
          </h2>
          <button
            onClick={onClose}
            className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition"
            aria-label="Close"
          >
            <X className="h-5 w-5 text-slate-600 dark:text-slate-300" />
          </button>
        </div>

        {pods.length > 0 ? (
          <div className="space-y-5">
            {pods.map((pod, index) => (
              <div
                key={pod.id || index}
                className="rounded-2xl border border-slate-200 dark:border-slate-700 p-4"
              >
                {pods.length > 1 && (
                  <h3 className="font-bold text-slate-900 dark:text-white mb-3">
                    Proof #{index + 1}
                  </h3>
                )}
                {pod.photo && (
                  <img
                    src={pod.photo}
                    alt={`Proof of delivery ${index + 1}`}
                    className="w-full max-h-96 object-contain rounded-xl bg-slate-50 dark:bg-slate-800 mb-4"
                  />
                )}
                {pod.notes && (
                  <p className="text-sm text-slate-900 dark:text-slate-100 whitespace-pre-wrap bg-slate-50 dark:bg-slate-800 rounded-xl p-3 mb-3">
                    {pod.notes}
                  </p>
                )}
                <div className="grid sm:grid-cols-2 gap-3 text-xs">
                  {pod.location?.lat != null && pod.location?.lng != null && (
                    <div className="rounded-xl bg-slate-50 dark:bg-slate-800 p-3">
                      <p className="font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-1">
                        Location
                      </p>
                      <p className="font-mono text-slate-900 dark:text-white">
                        {Number(pod.location.lat).toFixed(6)},{" "}
                        {Number(pod.location.lng).toFixed(6)}
                      </p>
                    </div>
                  )}
                  {pod.created_at && (
                    <div className="rounded-xl bg-slate-50 dark:bg-slate-800 p-3">
                      <p className="font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-1">
                        Submitted
                      </p>
                      <p className="text-slate-900 dark:text-white">
                        {new Date(pod.created_at).toLocaleString()}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-10">
            <ImageIcon className="h-12 w-12 text-slate-300 dark:text-slate-700 mx-auto mb-3" />
            <p className="text-slate-600 dark:text-slate-400 font-medium">
              No proof details available
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Fallback chain, used only when the server has not sent `next_status`.
 *
 * C8: it maps `picked_up` to `at_hub` unconditionally, which is wrong for a
 * same-day parcel — it must go straight to the recipient. Whether it may
 * depends on the booking having an open delivery stop on this driver's route,
 * which this page cannot see and the backend can. The server's answer wins;
 * this only covers a response cached before the field existed.
 */
const STATUS_CHAIN = {
  pending: "scheduled",
  scheduled: "assigned",
  assigned: "picked_up",
  picked_up: "at_hub",
  at_hub: "in_transit",
  in_transit: "delivered",
  delivered: null,
};

const STATUS_LABEL = {
  pending: "Pending",
  scheduled: "Scheduled",
  assigned: "Assigned",
  picked_up: "Picked Up",
  at_hub: "At Hub",
  in_transit: "In Transit",
  delivered: "Delivered",
  cancelled: "Cancelled",
  failed: "Failed",
};

const STATUS_BADGE = {
  assigned: "bg-blue-100 text-blue-700 border-blue-200",
  picked_up: "bg-amber-100 text-amber-700 border-amber-200",
  at_hub: "bg-purple-100 text-purple-700 border-purple-200",
  in_transit: "bg-indigo-100 text-indigo-700 border-indigo-200",
  delivered: "bg-green-100 text-green-700 border-green-200",
  cancelled: "bg-red-100 text-red-700 border-red-200",
  failed: "bg-red-100 text-red-700 border-red-200",
};

const ACTION_LABEL = {
  picked_up: "Mark Picked Up",
  at_hub: "Mark At Hub",
  in_transit: "Start Delivery",
  delivered: "Complete Delivery",
};

/** One labelled value in the reference / manifest grids. */
function Fact({ icon: Icon, label, value, mono = false }) {
  return (
    <div className="rounded-2xl bg-slate-50 dark:bg-slate-800/60 p-3.5">
      <p className="text-[11px] uppercase tracking-wide font-semibold text-slate-500 dark:text-slate-400 flex items-center gap-1.5 mb-1.5">
        <Icon className="h-3.5 w-3.5" />
        {label}
      </p>
      <p
        className={`text-sm font-semibold text-slate-900 dark:text-white break-words ${
          mono ? "font-mono" : ""
        }`}
      >
        {value}
      </p>
    </div>
  );
}

/**
 * One end of the shipment. `active` marks the stop the driver is currently at,
 * which is the difference between "here is the route" and "here is where you
 * are on it".
 */
function AddressBlock({ kind, address, name, phone, email, scheduledAt, active }) {
  const isDelivery = kind === "delivery";
  const postcode = address?.postal_code || "";
  const rest = [address?.line1, address?.line2, address?.city, address?.region]
    .filter(Boolean)
    .join(", ");

  return (
    <div
      className={`rounded-2xl p-4 border-2 transition ${
        active
          ? isDelivery
            ? "border-emerald-500 bg-emerald-50/60 dark:bg-emerald-900/15"
            : "border-sky-500 bg-sky-50/60 dark:bg-sky-900/15"
          : "border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900"
      }`}
    >
      <div className="flex items-center justify-between gap-2 mb-3">
        <span
          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-bold uppercase tracking-wide ${
            isDelivery
              ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200"
              : "bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-200"
          }`}
        >
          <MapPin className="h-3 w-3" />
          {isDelivery ? "Delivery" : "Collection"}
        </span>
        {active && (
          <span className="text-[11px] font-bold uppercase tracking-wide text-orange-600 dark:text-orange-400">
            You are here
          </span>
        )}
      </div>

      <p className="text-xl font-extrabold tracking-tight text-slate-900 dark:text-white">
        {postcode || "No postcode"}
      </p>
      <p className="text-sm text-slate-600 dark:text-slate-300 mt-0.5 leading-snug">
        {rest || "Address unavailable"}
      </p>

      <div className="mt-3 space-y-1.5 text-sm">
        {name && (
          <p className="flex items-center gap-2 text-slate-700 dark:text-slate-200">
            <User className="h-4 w-4 text-slate-400 flex-shrink-0" />
            {name}
          </p>
        )}
        {email && (
          <p className="flex items-center gap-2 text-slate-500 dark:text-slate-400 text-xs break-all">
            <Mail className="h-4 w-4 flex-shrink-0" />
            {email}
          </p>
        )}
        {scheduledAt && (
          <p className="flex items-center gap-2 text-slate-700 dark:text-slate-200">
            <Calendar className="h-4 w-4 text-slate-400 flex-shrink-0" />
            {new Date(scheduledAt).toLocaleString()}
          </p>
        )}
      </div>

      {phone && (
        <a
          href={`tel:${phone.replace(/[^\d+]/g, "")}`}
          className="mt-3 w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-sm active:scale-95 transition"
        >
          <Phone className="h-4 w-4" />
          {phone}
        </a>
      )}
    </div>
  );
}

export function JobDetailPage({ jobId, onBack, stopContext = null }) {
  const [job, setJob] = useState(null);
  const [loading, setLoading] = useState(true);
  const [immutable, setImmutable] = useState(false);
  const [immutableReason, setImmutableReason] = useState("");
  const [showProofModal, setShowProofModal] = useState(false);
  const [showProofViewModal, setShowProofViewModal] = useState(false);
  const [proofData, setProofData] = useState(null);
  const [hasProof, setHasProof] = useState(false);
  const [currentLocation, setCurrentLocation] = useState(null);
  const [showQRScanner, setShowQRScanner] = useState(false);
  const [showFailureModal, setShowFailureModal] = useState(false);

  const loadProofOfDelivery = useCallback(async (bookingId) => {
    try {
      const response = await driverApi.getProofOfDelivery(bookingId);
      if (response.success && response.data) {
        setProofData(response.data);
        setHasProof(true);
      } else {
        setProofData(null);
        setHasProof(false);
      }
    } catch (error) {
      console.error("[JobDetailPage] Error fetching proof of delivery:", error);
      setProofData(null);
      setHasProof(false);
    }
  }, []);

  const loadJobDetails = useCallback(async () => {
    try {
      setLoading(true);
      const jobDetail = await driverApi.getJob(jobId);
      if (!jobDetail?.data) {
        toast.error("Failed to load job details");
        return;
      }
      setJob(jobDetail);
      setHasProof(!!jobDetail.data.proof_of_delivery);

      const immutabilityCheck = await driverApi.checkImmutable(jobId);
      if (immutabilityCheck.success) {
        setImmutable(immutabilityCheck.immutable);
        setImmutableReason(immutabilityCheck.reason || "");
      }

      if (jobDetail.data.proof_of_delivery) {
        await loadProofOfDelivery(jobId);
      }
    } catch (error) {
      console.error("[JobDetailPage] Error loading job details:", error);
      toast.error("Failed to load job details");
    } finally {
      setLoading(false);
    }
  }, [jobId, loadProofOfDelivery]);

  const getCurrentLocation = useCallback(async () => {
    try {
      setCurrentLocation(await driverApi.getCurrentLocation());
    } catch (error) {
      console.error("[JobDetailPage] Failed to get current location:", error);
    }
  }, []);

  useEffect(() => {
    if (!jobId) {
      toast.error("Invalid job ID");
      setLoading(false);
      return;
    }
    loadJobDetails();
    getCurrentLocation();
  }, [jobId, loadJobDetails, getCurrentLocation]);

  const data = job?.data;
  const quote = data?.quote;

  // The leg comes from the stop the driver tapped, never from the booking's
  // status. See the file header: the booking alone cannot distinguish the two
  // halves of a same-day pair.
  const isDeliveryLeg = (stopContext?.stop_leg || stopContext?.leg) === "delivery";

  const nextStatus = useMemo(() => {
    if (stopContext && stopContext.next_status !== undefined) {
      return stopContext.next_status;
    }
    if (data && data.next_status !== undefined) return data.next_status;
    return STATUS_CHAIN[data?.status] ?? null;
  }, [stopContext, data]);

  const blockedReason = !nextStatus && !immutable ? stopContext?.blocked_reason : null;

  const handleStatusUpdate = useCallback(
    async (newStatus) => {
      if (immutable) {
        toast.error(immutableReason || "Job is locked — cannot update status.");
        return;
      }
      if (newStatus === "delivered") {
        setShowProofModal(true);
        return;
      }
      if (!window.confirm(`Mark job as ${STATUS_LABEL[newStatus] || newStatus}?`)) return;

      try {
        const result = await driverApi.updateJobStatus(data.id, newStatus, currentLocation);
        setJob((prev) => ({
          ...prev,
          data: { ...prev.data, status: newStatus, updated_at: new Date().toISOString() },
        }));

        if (result?.queued) {
          toast(`Saved offline — will sync when you're back online`, { icon: "📶" });
        } else {
          toast.success(`Job marked ${STATUS_LABEL[newStatus] || newStatus}`);
          publishJobStatus({ booking_id: data.id, status: newStatus, reason: "local" });
        }

        const check = await driverApi.checkImmutable(data.id);
        if (check.success) {
          setImmutable(check.immutable);
          setImmutableReason(check.reason || "");
        }
      } catch (error) {
        console.error("[JobDetailPage] Failed to update job status:", error);
        toast.error(error.response?.data?.detail || "Failed to update job status");
      }
    },
    [data, currentLocation, immutable, immutableReason]
  );

  const handleProofOfDeliverySubmit = useCallback(
    async (proof) => {
      try {
        // One call: submits the proof AND moves the booking to delivered.
        const result = await driverApi.submitProofOfDelivery(data.id, proof);
        if (!result.success) throw new Error(result.message || "Failed to submit proof");

        setShowProofModal(false);

        if (result.queued) {
          toast("Saved offline — proof will sync automatically", { icon: "📶" });
          setJob((prev) => ({
            ...prev,
            data: { ...prev.data, status: "delivered", updated_at: new Date().toISOString() },
          }));
          return;
        }

        toast.success("Delivery completed");
        publishJobStatus({ booking_id: data.id, status: "delivered", reason: "pod" });
        await loadJobDetails();
      } catch (error) {
        console.error("[JobDetailPage] Proof submission error:", error);
        toast.error(error.message || "Failed to complete delivery");
      }
    },
    [data, loadJobDetails]
  );

  const handleQRScanSuccess = useCallback(
    async (qrContent) => {
      try {
        const result = await driverApi.scanQr(qrContent);
        if (result.success) {
          toast.success("Label scanned — job picked up");
          setShowQRScanner(false);
          publishJobStatus({
            booking_id: result.data?.booking_id || data?.id,
            status: result.data?.new_status || "picked_up",
            reason: "scan",
          });
          await loadJobDetails();
        } else {
          toast.error(result.message || "Scan failed. Update the status manually.");
        }
      } catch (error) {
        console.error("[JobDetailPage] QR scan error:", error);
        toast.error("QR scan failed. Please try again.");
      }
    },
    [loadJobDetails, data]
  );

  const formatDimensions = useCallback((dimensions) => {
    // The manifest is a LIST of parcels, each with its own dimensions — it was
    // read as a single {length,width,height} object, so a two-parcel booking
    // rendered "0×0×0 cm".
    const parcels = Array.isArray(dimensions)
      ? dimensions
      : dimensions && typeof dimensions === "object"
        ? [{ dimensions }]
        : [];
    const rendered = parcels
      .map((parcel) => {
        const d = parcel?.dimensions || parcel || {};
        const { length = 0, width = 0, height = 0 } = d;
        return `${Number(length) || 0}×${Number(width) || 0}×${Number(height) || 0}`;
      })
      .filter((s) => s !== "0×0×0");
    return rendered.length ? `${rendered.join(", ")} cm` : "Not recorded";
  }, []);

  const isUrgentPickup = useCallback((scheduledPickupAt) => {
    if (!scheduledPickupAt) return false;
    const diffMinutes = (new Date(scheduledPickupAt) - new Date()) / (1000 * 60);
    return diffMinutes <= 30 && diffMinutes >= 0;
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-50 dark:bg-slate-950">
        <div className="text-center">
          <div className="animate-spin rounded-full h-11 w-11 border-4 border-slate-200 dark:border-slate-700 border-t-orange-600 mx-auto mb-4" />
          <p className="text-slate-600 dark:text-slate-400 font-medium">
            Loading job details...
          </p>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-50 dark:bg-slate-950 px-6">
        <div className="text-center">
          <AlertTriangle className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2">
            Job not found
          </h3>
          <p className="text-slate-600 dark:text-slate-400 mb-6">
            The requested job could not be loaded.
          </p>
          <button
            onClick={onBack}
            className="px-6 py-2.5 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-semibold"
          >
            Back to jobs
          </button>
        </div>
      </div>
    );
  }

  const parcels = quote?.num_parcels || 1;
  const isSameDay = stopContext?.is_same_day || quote?.service_type?.routing_bucket === "same_day";

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 pb-28">
      {/* Header */}
      <div className="sticky top-0 z-20 bg-white/95 dark:bg-slate-900/95 backdrop-blur border-b border-slate-200 dark:border-slate-800">
        <div className="max-w-3xl mx-auto px-4 py-3">
          <div className="flex items-center gap-3">
            <button
              onClick={onBack}
              className="p-2 -ml-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition"
              aria-label="Back to jobs"
            >
              <ChevronLeft className="h-5 w-5 text-slate-700 dark:text-slate-200" />
            </button>
            <div className="min-w-0 flex-1">
              <h1 className="text-lg font-bold text-slate-900 dark:text-white truncate">
                {stopContext?.job_number != null
                  ? `Job ${stopContext.job_number}`
                  : data.tracking_number || "Job details"}
              </h1>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-mono truncate">
                {data.tracking_number}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-1.5 mt-2.5">
            {stopContext && (
              <span
                className={`inline-flex items-center px-2.5 py-1 rounded-lg text-[11px] font-bold uppercase tracking-wide ${
                  isDeliveryLeg
                    ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200"
                    : "bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-200"
                }`}
              >
                {isDeliveryLeg ? "Delivery" : "Collection"}
              </span>
            )}
            <span
              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border text-[11px] font-bold uppercase tracking-wide ${
                STATUS_BADGE[data.status] || "bg-slate-100 text-slate-700 border-slate-200"
              }`}
            >
              {STATUS_LABEL[data.status] || data.status}
              {immutable && <Lock className="h-3 w-3" />}
            </span>
            {isSameDay && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold uppercase tracking-wide bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-200">
                <Zap className="h-3 w-3" />
                Same Day
              </span>
            )}
            {isUrgentPickup(data.scheduled_pickup_at) && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold uppercase tracking-wide bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-200">
                <AlertCircle className="h-3 w-3" />
                Urgent
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-4 space-y-4">
        {immutable && (
          <div className="rounded-2xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 p-4 flex items-start gap-3">
            <Lock className="h-5 w-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="font-bold text-red-900 dark:text-red-200">Job locked</h3>
              <p className="text-sm text-red-700 dark:text-red-300 mt-0.5">
                {immutableReason ||
                  "This job has been delivered with proof submitted and cannot be modified."}
              </p>
            </div>
          </div>
        )}

        {blockedReason && (
          <div className="rounded-2xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 p-4 flex items-start gap-3">
            <ShieldAlert className="h-5 w-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="font-bold text-amber-900 dark:text-amber-200">
                Not yet available
              </h3>
              <p className="text-sm text-amber-700 dark:text-amber-300 mt-0.5">
                {blockedReason}
              </p>
            </div>
          </div>
        )}

        {/* THE ROUTE — both ends, current stop marked. */}
        <section>
          <h2 className="text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400 mb-2 px-1">
            Route
          </h2>
          <div className="space-y-2">
            <AddressBlock
              kind="pickup"
              address={data.pickup_address}
              name={data.customer?.name}
              phone={data.customer?.phone}
              scheduledAt={data.scheduled_pickup_at}
              active={!!stopContext && !isDeliveryLeg}
            />
            <div className="flex justify-center">
              <div className="h-5 w-0.5 bg-slate-300 dark:bg-slate-700 rounded-full" />
            </div>
            <AddressBlock
              kind="delivery"
              address={data.dropoff_address}
              name={data.receiver_name}
              phone={data.receiver_phone}
              email={data.receiver_email}
              scheduledAt={data.scheduled_dropoff_at}
              active={!!stopContext && isDeliveryLeg}
            />
          </div>
        </section>

        {/* THE PARCELS */}
        <section>
          <h2 className="text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400 mb-2 px-1">
            Shipment
          </h2>
          <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
              <Fact icon={Package} label="Parcels" value={parcels} />
              <Fact icon={Weight} label="Weight" value={`${quote?.weight_kg ?? 0} kg`} />
              <Fact
                icon={Ruler}
                label="Dimensions"
                value={formatDimensions(quote?.dimensions)}
                mono
              />
              <Fact
                icon={Zap}
                label="Service"
                value={quote?.service_type?.name || "Standard"}
              />
              <Fact
                icon={Package}
                label="Shipping"
                value={quote?.shipping_type?.name || "Parcel"}
              />
              <Fact icon={Hash} label="Tracking" value={data.tracking_number || "—"} mono />
            </div>

            {quote?.fragile && (
              <div className="mt-3 flex items-center gap-2 text-sm font-semibold text-red-700 dark:text-red-300 bg-red-50 dark:bg-red-900/20 px-3.5 py-2.5 rounded-xl">
                <AlertTriangle className="h-4 w-4 flex-shrink-0" />
                Fragile — handle with care
              </div>
            )}

            {data.notes && (
              <div className="mt-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 p-3.5">
                <p className="text-[11px] uppercase tracking-wide font-semibold text-slate-500 dark:text-slate-400 flex items-center gap-1.5 mb-1.5">
                  <StickyNote className="h-3.5 w-3.5" />
                  Notes
                </p>
                <p className="text-sm text-slate-900 dark:text-white whitespace-pre-wrap">
                  {data.notes}
                </p>
              </div>
            )}

            {data.routing_note && (
              <div className="mt-3 rounded-xl bg-blue-50 dark:bg-blue-900/20 p-3.5">
                <p className="text-[11px] uppercase tracking-wide font-semibold text-blue-700 dark:text-blue-300 mb-1.5">
                  Routing note
                </p>
                <p className="text-sm text-blue-900 dark:text-blue-100">
                  {data.routing_note}
                </p>
              </div>
            )}
          </div>
        </section>

        {/* PROOF OF DELIVERY */}
        {data.status === "delivered" && (
          <section>
            <h2 className="text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400 mb-2 px-1">
              Proof of delivery
            </h2>
            <div className="rounded-2xl bg-white dark:bg-slate-900 border border-green-200 dark:border-green-800 p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3 min-w-0">
                  <CheckCircle2 className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
                  <p className="text-sm font-semibold text-slate-900 dark:text-white">
                    {hasProof
                      ? "Proof submitted"
                      : "Submission required to complete this delivery"}
                  </p>
                </div>
                {hasProof && proofData && (
                  <button
                    onClick={() => setShowProofViewModal(true)}
                    className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white font-semibold text-sm flex-shrink-0 active:scale-95 transition"
                  >
                    <FileText className="h-4 w-4" />
                    View
                  </button>
                )}
              </div>
              {!hasProof && !immutable && (
                <button
                  onClick={() => setShowProofModal(true)}
                  className="mt-3 w-full px-6 py-3 rounded-xl bg-green-600 hover:bg-green-700 text-white font-bold active:scale-95 transition"
                >
                  Submit proof of delivery
                </button>
              )}
            </div>
          </section>
        )}
      </div>

      {/* Action bar — pinned, so the thing the driver came here to do is always
          within thumb reach however far they have scrolled. */}
      {!immutable && (nextStatus || data.status === "assigned") && (
        <div className="fixed bottom-0 inset-x-0 z-20 bg-white/95 dark:bg-slate-900/95 backdrop-blur border-t border-slate-200 dark:border-slate-800">
          <div className="max-w-3xl mx-auto px-4 py-3 flex items-stretch gap-2">
            {data.status === "assigned" && !blockedReason && (
              <button
                onClick={() => setShowQRScanner(true)}
                className="flex items-center justify-center gap-2 px-4 py-3.5 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-bold text-sm active:scale-95 transition"
              >
                <Camera className="h-5 w-5" />
                Scan
              </button>
            )}
            {nextStatus && (
              <button
                onClick={() => handleStatusUpdate(nextStatus)}
                className="flex-1 px-4 py-3.5 rounded-xl bg-orange-600 hover:bg-orange-700 text-white font-bold active:scale-95 transition"
              >
                {ACTION_LABEL[nextStatus] || "Update status"}
              </button>
            )}
            <button
              onClick={() => setShowFailureModal(true)}
              className="flex items-center justify-center w-14 rounded-xl bg-amber-500 hover:bg-amber-600 text-white active:scale-95 transition"
              aria-label="Report an issue"
              title="Report an issue"
            >
              <AlertTriangle className="h-5 w-5" />
            </button>
          </div>
        </div>
      )}

      {showProofModal && (
        <ProofOfDelivery
          jobId={data.id}
          onClose={() => setShowProofModal(false)}
          onSubmit={handleProofOfDeliverySubmit}
        />
      )}

      {showProofViewModal && (
        <ProofOfDeliveryView
          proofData={proofData}
          onClose={() => setShowProofViewModal(false)}
        />
      )}

      {showQRScanner && (
        <QRScannerModal
          jobId={data.id}
          onClose={() => setShowQRScanner(false)}
          onScanSuccess={handleQRScanSuccess}
        />
      )}

      <FailureReportModal
        isOpen={showFailureModal}
        jobId={data.id}
        jobTitle={
          stopContext?.job_number != null
            ? `Job ${stopContext.job_number}`
            : data.tracking_number || "this job"
        }
        failureType={isDeliveryLeg ? "delivery" : "pickup"}
        onClose={() => setShowFailureModal(false)}
        onSuccess={() => {
          setShowFailureModal(false);
          loadJobDetails();
        }}
      />
    </div>
  );
}
