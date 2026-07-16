"use client";

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
  Camera, // NEW: For QR scan button
} from "lucide-react";
import { driverApi } from "../../api/driver-api";
import { ProofOfDelivery } from "./proof-of-delivery";
import { QRScannerModal } from "./QRScannerModal"; // NEW: QR Scanner component

function ProofOfDeliveryView({ proofData, onClose }) {
  const pods = Array.isArray(proofData) ? proofData : proofData ? [proofData] : [];

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-xl p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-slate-900">Proof of Delivery</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
            aria-label="Close modal"
          >
            <X className="h-5 w-5 text-slate-600" />
          </button>
        </div>

        {pods.length > 0 ? (
          <div className="space-y-6">
            {pods.map((pod, index) => (
              <div key={pod.id || index} className="border border-slate-200 rounded-lg p-5">
                {pods.length > 1 && (
                  <h3 className="font-bold text-slate-900 mb-4 text-lg">
                    Proof #{index + 1}
                  </h3>
                )}

                {/* Photo - Large Display */}
                {pod.photo && (
                  <div className="mb-5">
                    <p className="text-xs font-semibold text-slate-600 uppercase tracking-wide mb-2">
                      Photo
                    </p>
                    <img
                      src={pod.photo || "/placeholder.svg"}
                      alt={`Proof of Delivery ${index + 1}`}
                      className="w-full max-h-96 object-contain rounded-lg bg-slate-50 border border-slate-200"
                    />
                  </div>
                )}

                {/* Notes */}
                {pod.notes && (
                  <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                    <p className="text-xs font-semibold text-slate-600 uppercase tracking-wide mb-2">
                      Notes
                    </p>
                    <p className="text-slate-900 whitespace-pre-wrap">{pod.notes}</p>
                  </div>
                )}

                {/* Metadata */}
                <div className="grid sm:grid-cols-2 gap-4 text-sm">
                  {pod.location?.lat && pod.location?.lng && (
                    <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
                      <p className="text-xs font-semibold text-slate-600 uppercase tracking-wide mb-1">
                        Location
                      </p>
                      <p className="text-slate-900 font-mono text-xs">
                        {pod.location.lat.toFixed(6)}, {pod.location.lng.toFixed(6)}
                      </p>
                      {pod.location.accuracy && (
                        <p className="text-xs text-slate-500 mt-1">
                          ±{pod.location.accuracy.toFixed(0)}m accuracy
                        </p>
                      )}
                    </div>
                  )}
                  {pod.created_at && (
                    <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
                      <p className="text-xs font-semibold text-slate-600 uppercase tracking-wide mb-1">
                        Submitted
                      </p>
                      <p className="text-slate-900">
                        {new Date(pod.created_at).toLocaleString()}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-12">
            <ImageIcon className="h-12 w-12 text-slate-300 mx-auto mb-3" />
            <p className="text-slate-600 font-medium">No proof details available</p>
          </div>
        )}
      </div>
    </div>
  );
}

const STATUS_TRANSITIONS = [
  { current: "pending", next: "scheduled" },
  { current: "scheduled", next: "assigned" },
  { current: "assigned", next: "picked_up" },
  { current: "picked_up", next: "at_hub" },
  { current: "at_hub", next: "in_transit" },
  { current: "in_transit", next: "delivered" },
  { current: "delivered", next: null },
];

export function JobDetailPage({ jobId, onBack }) {
  const [job, setJob] = useState(null);
  const [loading, setLoading] = useState(true);
  const [immutable, setImmutable] = useState(false);
  const [immutableReason, setImmutableReason] = useState("");
  const [showProofModal, setShowProofModal] = useState(false); // For submitting new proof
  const [showProofViewModal, setShowProofViewModal] = useState(false); // For viewing submitted proof
  const [proofData, setProofData] = useState(null);
  const [currentLocation, setCurrentLocation] = useState(null);
  const [hasProof, setHasProof] = useState(false);
  const [showQRScanner, setShowQRScanner] = useState(false); // NEW: QR scanner state
  const [showProofDeliveryFlow, setShowProofDeliveryFlow] = useState(false); // NEW: Proof delivery flow for marking as delivered

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
      console.error("Error fetching proof of delivery:", error);
      toast.error("Failed to fetch proof of delivery");
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
      console.error("Error loading job details:", error);
      toast.error("Failed to load job details");
    } finally {
      setLoading(false);
    }
  }, [jobId, loadProofOfDelivery]);

  const getCurrentLocation = useCallback(async () => {
    try {
      const location = await driverApi.getCurrentLocation();
      setCurrentLocation(location);
    } catch (error) {
      console.error("Failed to get current location:", error);
    }
  }, []);

  useEffect(() => {
    if (!jobId) {
      console.error("Missing jobId");
      toast.error("Invalid job ID");
      setLoading(false);
      return;
    }
    loadJobDetails();
    getCurrentLocation();
  }, [jobId, loadJobDetails, getCurrentLocation]);

  const getStatusText = useCallback((status) => {
    const texts = {
      assigned: "Assigned",
      picked_up: "Picked Up",
      at_hub: "At Hub",
      in_transit: "In Transit",
      delivered: "Delivered",
      cancelled: "Cancelled",
      failed: "Failed",
    };
    return (
      texts[status] ||
      (status ? status.replace("_", " ").toUpperCase() : status)
    );
  }, []);

  const handleStatusUpdate = useCallback(
    async (newStatus) => {
      if (immutable) {
        toast.error(
          immutableReason || "Job is locked—cannot update status."
        );
        return;
      }

      // BLOCK: If trying to mark as "delivered", open Proof of Delivery instead
      if (newStatus === "delivered") {
        console.log("[JobDetailPage] Blocking direct delivered status - opening ProofOfDelivery");
        setShowProofDeliveryFlow(true);
        return;
      }

      if (!window.confirm(`Mark job as ${getStatusText(newStatus)}?`)) return;

      try {
        const result = await driverApi.updateJobStatus(job.data.id, newStatus, currentLocation);
        setJob({
          ...job,
          data: {
            ...job.data,
            status: newStatus,
            updated_at: new Date().toISOString(),
          },
        });
        if (result?.queued) {
          toast(`Saved offline — will sync when you're back online (${getStatusText(newStatus)})`, { icon: "📶" });
        } else {
          toast.success(`Job status updated to ${getStatusText(newStatus)}`);
        }

        const immutabilityCheck = await driverApi.checkImmutable(job.data.id);
        if (immutabilityCheck.success) {
          setImmutable(immutabilityCheck.immutable);
          setImmutableReason(immutabilityCheck.reason || "");
        }
      } catch (error) {
        console.error("Failed to update job status:", error);
        toast.error(
          error.response?.data?.detail || "Failed to update job status"
        );
      }
    },
    [job, currentLocation, immutable, immutableReason, getStatusText]
  );

  const getNextStatus = useCallback((currentStatus) => {
    return STATUS_TRANSITIONS.find((s) => s.current === currentStatus)?.next || null;
  }, []);

  const getStatusColor = useCallback((status) => {
    const colors = {
      assigned: "bg-blue-100 text-blue-700 border border-blue-200",
      picked_up: "bg-amber-100 text-amber-700 border border-amber-200",
      at_hub: "bg-purple-100 text-purple-700 border border-purple-200",
      in_transit: "bg-indigo-100 text-indigo-700 border border-indigo-200",
      delivered: "bg-green-100 text-green-700 border border-green-200",
      cancelled: "bg-red-100 text-red-700 border border-red-200",
      failed: "bg-red-100 text-red-700 border border-red-200",
    };
    return colors[status] || "bg-slate-100 text-slate-700 border border-slate-200";
  }, []);

  const formatDimensions = useCallback((dimensions) => {
    if (!dimensions || typeof dimensions !== "object") return "N/A";
    const { length = 0, width = 0, height = 0 } = dimensions;
    return `${Number.parseFloat(length) || 0}×${Number.parseFloat(width) || 0}×${Number.parseFloat(height) || 0} cm`;
  }, []);

  const isUrgentPickup = useCallback((scheduledPickupAt) => {
    if (!scheduledPickupAt) return false;
    const diffMinutes = (new Date(scheduledPickupAt) - new Date()) / (1000 * 60);
    return diffMinutes <= 30 && diffMinutes >= 0;
  }, []);

  const formatAddress = useCallback((addr) => {
    if (typeof addr === "string") return addr;
    if (typeof addr === "object" && addr) {
      return [addr.line1, addr.city, addr.region, addr.postal_code]
        .filter(Boolean)
        .join(", ");
    }
    return "N/A";
  }, []);

  // NEW: Handle Proof of Delivery submission for marking as delivered
  // NOTE: submitProofOfDelivery now automatically updates status to "delivered" atomically
  const handleProofOfDeliverySubmit = useCallback(
    async (proofData) => {
      try {
        console.log("[JobDetailPage] Submitting proof of delivery for job:", job.data.id);

        // Single API call that submits proof AND updates status to "delivered" atomically
        const result = await driverApi.submitProofOfDelivery(
          job.data.id,
          proofData
        );

        if (!result.success) {
          throw new Error(result.message || "Failed to submit proof");
        }

        console.log("[JobDetailPage] Proof submitted and status updated:", result);

        // Close modal
        setShowProofDeliveryFlow(false);

        if (result.queued) {
          // Offline: reflect the delivery locally right away rather than
          // re-fetching (which would just fail with no connection), and
          // let the sync engine reconcile the real record once online.
          toast("Saved offline — proof of delivery will sync automatically 📶", {
            icon: "📶",
          });
          setJob({
            ...job,
            data: { ...job.data, status: "delivered", updated_at: new Date().toISOString() },
          });
          return;
        }

        toast.success("Delivery completed successfully! ✓");
        // Reload job details to show updated status
        await loadJobDetails();
      } catch (error) {
        console.error("[JobDetailPage] Proof submission error:", error);
        toast.error(error.message || "Failed to complete delivery");
      }
    },
    [job, loadJobDetails]
  );

  // NEW: Handle QR scan success
  const handleQRScanSuccess = useCallback(
    async (qrContent) => {
      try {
        const result = await driverApi.scanQr(qrContent);
        if (result.success) {
          toast.success("Label scanned successfully! Job picked up.", {
            duration: 3,
          });
          setShowQRScanner(false);
          // Refresh job details
          await loadJobDetails();
        } else {
          toast.error(
            result.message ||
              "Failed to scan QR. Please try again or manually update status."
          );
        }
      } catch (error) {
        console.error("[JobDetailPage] QR scan error:", error);
        toast.error("QR scan failed. Please try again.");
      }
    },
    [loadJobDetails]
  );

  const nextStatus = useMemo(
    () => getNextStatus(job?.data?.status),
    [job?.data?.status, getNextStatus]
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-white">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-slate-200 border-t-blue-600 mx-auto mb-4" />
          <p className="text-slate-600 font-medium">Loading job details...</p>
        </div>
      </div>
    );
  }

  if (!job?.data) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-white">
        <div className="text-center">
          <AlertTriangle className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <h3 className="text-lg font-bold text-slate-900 mb-2">Job not found</h3>
          <p className="text-slate-600">The requested job could not be loaded.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
      {/* Header */}
      <div className="bg-white border-b border-slate-200 sticky top-0 z-10 shadow-sm">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
          <button
            onClick={onBack}
            className="flex items-center gap-2 px-3 py-2 bg-slate-100 text-slate-900 rounded-lg hover:bg-slate-200 transition-colors font-medium text-sm"
            aria-label="Go back"
          >
            <ChevronLeft className="h-4 w-4" />
            Back
          </button>
          <div className="text-right">
            <h1 className="text-2xl font-bold text-slate-900">
              Job #{job.data.id?.slice(-8) || job.data.id}
            </h1>
            <div className="flex flex-wrap items-center justify-end gap-2 mt-2">
              <span className={`px-3 py-1 rounded-full text-xs font-semibold ${getStatusColor(job.data.status)}`}>
                {getStatusText(job.data.status)}
                {immutable && <Lock className="h-3 w-3 inline ml-1" />}
              </span>
              {isUrgentPickup(job.data.scheduled_pickup_at) && (
                <span className="px-3 py-1 rounded-full text-xs font-semibold bg-red-100 text-red-700 border border-red-200 flex items-center gap-1">
                  <AlertCircle className="h-3 w-3" />
                  Urgent Pickup
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Immutable Banner */}
        {immutable && (
          <div className="mb-6 p-4 bg-red-50 border-l-4 border-red-500 rounded-lg">
            <div className="flex items-start gap-3">
              <Lock className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
              <div>
                <h3 className="font-bold text-red-900">Job Locked</h3>
                <p className="text-sm text-red-700 mt-1">
                  {immutableReason || "This job has been delivered with proof submitted and cannot be modified."}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Next Action Button - Prominent */}
        {nextStatus && !immutable && (
          <div className="mb-6 flex flex-col sm:flex-row gap-3">
            {/* NEW: QR Scan button for assigned jobs */}
            {job?.data?.status === "assigned" && (
              <button
                onClick={() => setShowQRScanner(true)}
                className="flex items-center justify-center gap-2 px-8 py-4 bg-gradient-to-r from-green-600 to-green-700 text-white font-bold text-lg rounded-lg hover:shadow-lg transition-all shadow-md hover:from-green-700 hover:to-green-800"
              >
                <Camera className="h-5 w-5" />
                Scan Label QR (Recommended)
              </button>
            )}

            <button
              onClick={() => handleStatusUpdate(nextStatus)}
              className="flex-1 px-8 py-4 bg-gradient-to-r from-blue-600 to-blue-700 text-white font-bold text-lg rounded-lg hover:shadow-lg transition-all shadow-md hover:from-blue-700 hover:to-blue-800"
            >
              {nextStatus === "picked_up" && "► Pick Up This Job"}
              {nextStatus === "at_hub" && "◆ Mark as At Hub"}
              {nextStatus === "in_transit" && "↗ Mark as In Transit"}
              {nextStatus === "delivered" && "✓ Complete Delivery"}
            </button>
          </div>
        )}

        {/* Main Content Grid */}
        <div className="space-y-6">
          {/* Locations Card */}
          <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
            <h2 className="text-xl font-bold text-slate-900 mb-6 flex items-center gap-2">
              <MapPin className="h-5 w-5 text-blue-600" />
              Delivery Route
            </h2>

            <div className="space-y-6">
              {/* Pickup */}
              <div className="border-l-4 border-green-500 pl-4">
                <h3 className="font-bold text-slate-900 flex items-center gap-2 mb-3">
                  <div className="w-2.5 h-2.5 bg-green-500 rounded-full" />
                  Pickup Location
                </h3>
                <div className="space-y-3 text-sm">
                  <p className="text-slate-900 font-medium text-base">
                    {formatAddress(job.data.pickup_address) || "N/A"}
                  </p>
                  {job.data.customer?.phone && (
                    <button
                      onClick={() =>
                        (window.location.href = `tel:${job.data.customer.phone.replace(
                          /\D/g,
                          ""
                        )}`)
                      }
                      className="flex items-center gap-2 text-blue-600 hover:text-blue-700 font-medium"
                    >
                      <Phone className="h-4 w-4" />
                      {job.data.customer.phone}
                    </button>
                  )}
                  {job.data.customer?.name && (
                    <div className="flex items-center gap-2 text-slate-700">
                      <User className="h-4 w-4 text-slate-400" />
                      {job.data.customer.name}
                    </div>
                  )}
                  {job.data.scheduled_pickup_at && (
                    <div className="flex items-center gap-2 text-slate-700">
                      <Calendar className="h-4 w-4 text-slate-400" />
                      {new Date(job.data.scheduled_pickup_at).toLocaleString()}
                    </div>
                  )}
                </div>
              </div>

              {/* Divider */}
              <div className="flex items-center gap-3 text-slate-400">
                <div className="flex-1 h-px bg-slate-200" />
                <span className="text-xs font-semibold">DELIVERY</span>
                <div className="flex-1 h-px bg-slate-200" />
              </div>

              {/* Delivery */}
              <div className="border-l-4 border-blue-500 pl-4">
                <h3 className="font-bold text-slate-900 flex items-center gap-2 mb-3">
                  <div className="w-2.5 h-2.5 bg-blue-500 rounded-full" />
                  Delivery Location
                </h3>
                <div className="space-y-3 text-sm">
                  <p className="text-slate-900 font-medium text-base">
                    {formatAddress(job.data.dropoff_address) || "N/A"}
                  </p>
                  {job.data.receiver_phone && (
                    <button
                      onClick={() =>
                        (window.location.href = `tel:${job.data.receiver_phone.replace(
                          /\D/g,
                          ""
                        )}`)
                      }
                      className="flex items-center gap-2 text-blue-600 hover:text-blue-700 font-medium"
                    >
                      <Phone className="h-4 w-4" />
                      {job.data.receiver_phone}
                    </button>
                  )}
                  {job.data.receiver_name && (
                    <div className="flex items-center gap-2 text-slate-700">
                      <User className="h-4 w-4 text-slate-400" />
                      {job.data.receiver_name}
                    </div>
                  )}
                  {job.data.receiver_email && (
                    <div className="text-slate-600 text-xs">{job.data.receiver_email}</div>
                  )}
                  {job.data.scheduled_dropoff_at && (
                    <div className="flex items-center gap-2 text-slate-700">
                      <Calendar className="h-4 w-4 text-slate-400" />
                      {new Date(job.data.scheduled_dropoff_at).toLocaleString()}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Package Details Card */}
          <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
            <h2 className="text-xl font-bold text-slate-900 mb-6 flex items-center gap-2">
              <Package className="h-5 w-5 text-slate-600" />
              Package Details
            </h2>

            <div className="grid sm:grid-cols-2 gap-6">
              <div>
                <label className="text-xs font-semibold text-slate-600 uppercase tracking-wide mb-2 block">
                  Description
                </label>
                <p className="text-slate-900 text-base mb-3">
                  {job.data.notes || "N/A"}
                </p>
                {job.data.quote?.fragile && (
                  <div className="flex items-center gap-2 text-sm text-red-700 bg-red-50 px-3 py-2 rounded-lg border border-red-200 w-fit">
                    <AlertTriangle className="h-4 w-4" />
                    Fragile - Handle with care
                  </div>
                )}
                {job.data.quote?.service_type?.name && (
                  <div className="mt-3 text-sm">
                    <p className="text-slate-600 font-medium">
                      Service: <span className="text-blue-600">{job.data.quote.service_type.name}</span>
                    </p>
                  </div>
                )}
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-600 uppercase tracking-wide mb-2 block">
                  Dimensions & Weight
                </label>
                <div className="space-y-2 text-slate-900">
                  <div className="flex justify-between">
                    <span className="text-slate-600">Weight:</span>
                    <span className="font-medium">{job.data.quote?.weight_kg || 0} kg</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-600">Dimensions:</span>
                    <span className="font-medium font-mono text-sm">
                      {formatDimensions(job.data.quote?.dimensions)}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {job.data.tracking_number && (
              <div className="mt-6 pt-6 border-t border-slate-200">
                <p className="text-xs font-semibold text-slate-600 uppercase tracking-wide mb-2">
                  Tracking Number
                </p>
                <p className="text-slate-900 font-mono text-base">
                  {job.data.tracking_number}
                </p>
              </div>
            )}
          </div>

          {/* Proof of Delivery Section */}
          {job.data.status === "delivered" && (
            <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-xl border border-green-200 p-6 shadow-sm">
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="h-6 w-6 text-green-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <h3 className="font-bold text-green-900 text-lg">Proof of Delivery</h3>
                    <p className="text-sm text-green-700 mt-1">
                      {hasProof
                        ? "✓ Proof submitted and verified"
                        : "Submission required to complete this delivery"}
                    </p>
                  </div>
                </div>
                {hasProof && proofData && (
                  <button
                    onClick={() => setShowProofViewModal(true)}
                    className="px-4 py-2 bg-white text-green-600 font-semibold rounded-lg hover:bg-green-50 transition-colors border border-green-200"
                  >
                    <FileText className="h-4 w-4 inline mr-1" />
                    View Proof
                  </button>
                )}
              </div>
              {!hasProof && !immutable && (
                <button
                  onClick={() => setShowProofModal(true)}
                  className="mt-4 w-full px-6 py-3 bg-green-600 text-white font-semibold rounded-lg hover:bg-green-700 transition-colors"
                >
                  Submit Proof of Delivery
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Proof of Delivery Modal */}
      {showProofModal && (
        <ProofOfDelivery
          jobId={job.data.id}
          onClose={() => setShowProofModal(false)}
          onSubmit={async (proofData) => {
            try {
              const response = await driverApi.submitProofOfDelivery(
                job.data.id,
                proofData
              );
              if (response.success) {
                setShowProofModal(false);
                if (response.queued) {
                  toast("Saved offline — proof of delivery will sync automatically 📶", {
                    icon: "📶",
                  });
                  setJob({
                    ...job,
                    data: { ...job.data, status: "delivered", updated_at: new Date().toISOString() },
                  });
                } else {
                  toast.success("Proof of delivery submitted successfully!");
                  await loadJobDetails();
                }
              } else {
                toast.error(response.message || "Failed to submit proof");
              }
            } catch (error) {
              console.error("Error submitting proof:", error);
              toast.error("Failed to submit proof of delivery");
            }
          }}
        />
      )}

      {/* Proof View Modal */}
      {showProofViewModal && (
        <ProofOfDeliveryView
          proofData={proofData}
          onClose={() => setShowProofViewModal(false)}
        />
      )}

      {/* NEW: QR Scanner Modal */}
      {showQRScanner && (
        <QRScannerModal
          jobId={job?.data?.id}
          onClose={() => setShowQRScanner(false)}
          onScanSuccess={handleQRScanSuccess}
        />
      )}

      {/* NEW: Proof of Delivery Flow Modal (for marking as delivered) */}
      {showProofDeliveryFlow && (
        <ProofOfDelivery
          jobId={job?.data?.id}
          onClose={() => setShowProofDeliveryFlow(false)}
          onSubmit={handleProofOfDeliverySubmit}
        />
      )}
    </div>
  );
}