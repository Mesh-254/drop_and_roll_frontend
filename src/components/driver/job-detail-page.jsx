"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { toast } from "react-hot-toast";
import {
  MapPin,
  Phone,
  User,
  Package,
  Camera,
  AlertTriangle,
  Navigation,
  Calendar,
  Truck,
  ChevronLeft,
  X,
  Lock,
} from "lucide-react";
import { driverApi } from "../../api/driver-api";
import { ProofOfDelivery } from "./proof-of-delivery";
import MapComponent from "../map/MapComponent";
import { APIProvider } from "@vis.gl/react-google-maps";

const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
const libraries = ["places", "maps", "geometry", "routes"];

function ProofOfDeliveryView({ proofData, onClose }) {
  const pods = Array.isArray(proofData)
    ? proofData
    : proofData
    ? [proofData]
    : [];

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
      onClick={onClose}
    >
      <div
        className="bg-card rounded-xl p-6 max-w-lg w-full mx-4"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-muted-foreground hover:text-foreground"
          aria-label="Close modal"
        >
          <X className="h-5 w-5" />
        </button>
        <h2 className="text-xl font-bold text-foreground mb-4">
          Proof of Delivery
        </h2>
        {pods.length > 0 ? (
          pods.map((pod, index) => (
            <div
              key={pod.id || index}
              className="space-y-4 border-b pb-4 last:border-b-0"
            >
              {pods.length > 1 && (
                <h3 className="text-lg font-semibold">Proof #{index + 1}</h3>
              )}
              {pod.photo && (
                <div>
                  <p className="text-sm text-muted-foreground">Photo</p>
                  <img
                    src={pod.photo}
                    alt={`Proof of Delivery ${index + 1}`}
                    className="w-full h-48 object-cover rounded-lg mt-1"
                  />
                </div>
              )}
              {pod.notes && (
                <div>
                  <p className="text-sm text-muted-foreground">Notes</p>
                  <p className="text-foreground">{pod.notes}</p>
                </div>
              )}
              {pod.location?.lat && pod.location?.lng && (
                <div>
                  <p className="text-sm text-muted-foreground">Location</p>
                  <p className="text-foreground">
                    Lat: {pod.location.lat}, Lng: {pod.location.lng}
                  </p>
                </div>
              )}
              {pod.created_at && (
                <div>
                  <p className="text-sm text-muted-foreground">Submitted At</p>
                  <p className="text-foreground">
                    {new Date(pod.created_at).toLocaleString()}
                  </p>
                </div>
              )}
              {!pod.photo && !pod.notes && !pod.location && (
                <p className="text-muted-foreground">No details available</p>
              )}
            </div>
          ))
        ) : (
          <p className="text-muted-foreground">No proof details available</p>
        )}
      </div>
    </div>
  );
}

export function JobDetailPage({ jobId, onBack }) {
  const [job, setJob] = useState(null);
  const [loading, setLoading] = useState(true);
  const [immutable, setImmutable] = useState(false); // New: Track if job is locked (DELIVERED + POD)
  const [immutableReason, setImmutableReason] = useState(""); // New: Reason for lock
  const [showProofModal, setShowProofModal] = useState(false);
  const [showProofViewModal, setShowProofViewModal] = useState(false);
  const [proofData, setProofData] = useState(null);
  const [currentLocation, setCurrentLocation] = useState(null);
  const [isNearDropoff, setIsNearDropoff] = useState(false);
  const [mapError, setMapError] = useState(null);
  const [hasProof, setHasProof] = useState(false);

  const statuses = [
    { current: "pending", next: "scheduled" },
    { current: "scheduled", next: "assigned" },
    { current: "assigned", next: "picked_up" },
    { current: "picked_up", next: "in_transit" },
    { current: "in_transit", next: "delivered" },
    { current: "delivered", next: null },
  ];

  useEffect(() => {
    if (!jobId) {
      console.error("Missing jobId");
      toast.error("Invalid job ID");
      setLoading(false);
      return;
    }
    loadJobDetails();
    getCurrentLocation();
  }, [jobId]);

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

      // New: Check immutability on load
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
  }, [jobId]);

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

  const getCurrentLocation = useCallback(async () => {
    try {
      const location = await driverApi.getCurrentLocation();
      setCurrentLocation(location);
      if (job?.data?.dropoff_address?.coordinates && job?.data?.status) {
        const distance = calculateDistance(
          location,
          job.data.dropoff_address.coordinates
        );
        setIsNearDropoff(job.data.status === "in_transit" && distance <= 100);
      }
    } catch (error) {
      console.error("Failed to get current location:", error);
    }
  }, [job?.data]);

  const calculateDistance = useCallback((loc1, loc2) => {
    // Placeholder: Implement Haversine formula in prod
    return 100; // Mock distance in meters
  }, []);

  const handleStatusUpdate = useCallback(
    async (newStatus) => {
      // New: Check immutability before update
      if (immutable) {
        toast.error(
          immutableReason ||
            "Job is delivered with POD submitted—cannot update status."
        );
        return;
      }

      if (!window.confirm(`Mark job as ${getStatusText(newStatus)}?`)) return;

      try {
        await driverApi.updateJobStatus(
          job.data.id,
          newStatus,
          currentLocation
        );
        // Optimistic update
        setJob({
          ...job,
          data: {
            ...job.data,
            status: newStatus,
            updated_at: new Date().toISOString(),
          },
        });
        toast.success(`Job status updated to ${getStatusText(newStatus)}`);
        if (newStatus === "in_transit") {
          await getCurrentLocation();
        }
        // Re-check immutability after update
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
    [job?.data?.id, currentLocation, immutable, immutableReason]
  );

  const getNextStatus = useCallback((currentStatus) => {
    return statuses.find((s) => s.current === currentStatus)?.next || null;
  }, []);

  const getStatusColor = useCallback((status) => {
    const colors = {
      pending: "bg-gray-500",
      scheduled: "bg-orange-500",
      assigned: "bg-blue-500",
      picked_up: "bg-yellow-500",
      in_transit: "bg-indigo-500",
      delivered: "bg-green-500",
      cancelled: "bg-red-500",
      failed: "bg-red-500",
    };
    return colors[status] || "bg-gray-500";
  }, []);

  const getStatusText = useCallback((status) => {
    const texts = {
      pending: "Pending",
      scheduled: "Scheduled",
      assigned: "Assigned",
      picked_up: "Picked Up",
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

  const formatDimensions = useCallback((dimensions) => {
    if (!dimensions || typeof dimensions !== "object") return "N/A";
    const { length = 0, width = 0, height = 0 } = dimensions;
    return `${Number.parseFloat(length) || 0}x${
      Number.parseFloat(width) || 0
    }x${Number.parseFloat(height) || 0} cm`;
  }, []);

  const isUrgentPickup = useCallback((scheduledPickupAt) => {
    if (!scheduledPickupAt) return false;
    const diffMinutes =
      (new Date(scheduledPickupAt) - new Date()) / (1000 * 60);
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

  const pickupAddress = useMemo(() => {
    const addr = job?.data?.pickup_address;
    return addr?.latitude && addr?.longitude
      ? {
          latitude: Number.parseFloat(addr.latitude),
          longitude: Number.parseFloat(addr.longitude),
        }
      : null;
  }, [job?.data?.pickup_address]);

  const dropoffAddress = useMemo(() => {
    const addr = job?.data?.dropoff_address;
    return addr?.latitude && addr?.longitude
      ? {
          latitude: Number.parseFloat(addr.latitude),
          longitude: Number.parseFloat(addr.longitude),
        }
      : null;
  }, [job?.data?.dropoff_address]);

  const nextStatus = useMemo(
    () => getNextStatus(job?.data?.status),
    [job?.data?.status, getNextStatus]
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4" />
          <p className="text-muted-foreground">Loading job details...</p>
        </div>
      </div>
    );
  }

  if (!job?.data) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <AlertTriangle className="h-12 w-12 text-destructive mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-foreground mb-2">
            Job not found
          </h3>
          <p className="text-muted-foreground">
            The requested job could not be loaded.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="bg-card border-b border-border sticky top-0 z-10 p-4">
        <div className="flex items-center gap-4">
          <button
            onClick={onBack}
            className="flex items-center gap-2 px-4 py-2 bg-card text-foreground border border-border rounded-lg hover:bg-muted hover:shadow-md transition-all focus:outline-none focus:ring-2 focus:ring-primary"
            aria-label="Go back"
          >
            <ChevronLeft className="h-5 w-5" />
            <span className="text-sm font-medium">Back</span>
          </button>
          <div className="flex-1">
            <h1 className="text-xl font-bold text-foreground">
              Job #{job.data.id}
            </h1>
            <div className="flex items-center gap-2">
              <span
                className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(
                  job.data.status
                )} text-primary-foreground`}
                aria-label={`Status: ${getStatusText(job.data.status)}`}
              >
                {getStatusText(job.data.status)}
                {immutable && (
                  <Lock
                    className="h-3 w-3 inline ml-1 text-destructive"
                    title="Locked - POD Submitted"
                  />
                )}
              </span>
              {isUrgentPickup(job.data.scheduled_pickup_at) && (
                <AlertTriangle
                  className="h-4 w-4 text-orange-500"
                  title="Urgent pickup"
                />
              )}
              {immutable && (
                <span
                  className="text-xs text-destructive ml-2"
                  title={immutableReason}
                >
                  {immutableReason || "Status Locked"}
                </span>
              )}
            </div>
          </div>
          <span
            className="text-lg font-bold text-primary"
            aria-label={`Fee: KES ${
              job.data.final_price?.toLocaleString() || "0"
            }`}
          >
            KES {job.data.final_price?.toLocaleString() || "0"}
          </span>
        </div>
      </div>

      <div className="p-4 space-y-6 max-w-4xl mx-auto">
        {/* Locations */}
        <div className="bg-card rounded-xl p-6">
          <h2 className="font-semibold text-foreground mb-4 flex items-center gap-2">
            <MapPin className="h-5 w-5" />
            Locations
          </h2>
          <div className="space-y-6">
            <div className="space-y-3">
              <h3 className="font-medium text-foreground flex items-center gap-2">
                <div className="w-2 h-2 bg-green-500 rounded-full" />
                Pickup
              </h3>
              <div className="ml-6 space-y-2">
                <p className="text-muted-foreground">
                  {formatAddress(job.data.pickup_address)}
                </p>
                {job.data.customer?.phone && (
                  <button
                    onClick={() =>
                      (window.location.href = `tel:${job.data.customer.phone.replace(
                        /\D/g,
                        ""
                      )}`)
                    }
                    className="flex items-center gap-2 text-sm text-primary hover:underline"
                    aria-label={`Call sender: ${job.data.customer.phone}`}
                  >
                    <Phone className="h-4 w-4" />
                    {job.data.customer.phone}
                  </button>
                )}
                {job.data.scheduled_pickup_at && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Calendar className="h-4 w-4" />
                    {new Date(job.data.scheduled_pickup_at).toLocaleString()}
                  </div>
                )}
              </div>
            </div>
            <div className="space-y-3">
              <h3 className="font-medium text-foreground flex items-center gap-2">
                <div className="w-2 h-2 bg-primary rounded-full" />
                Delivery
              </h3>
              <div className="ml-6 space-y-2">
                <p className="text-muted-foreground">
                  {formatAddress(job.data.dropoff_address)}
                </p>
                {job.data.receiver_phone && (
                  <button
                    onClick={() =>
                      (window.location.href = `tel:${job.data.receiver_phone.replace(
                        /\D/g,
                        ""
                      )}`)
                    }
                    className="flex items-center gap-2 text-sm text-primary hover:underline"
                    aria-label={`Call receiver: ${job.data.receiver_phone}`}
                  >
                    <Phone className="h-4 w-4" />
                    Receiver: {job.data.receiver_phone}
                  </button>
                )}
                {job.data.receiver_email && (
                  <p className="text-sm text-muted-foreground">
                    Email: {job.data.receiver_email}
                  </p>
                )}
                {job.data.scheduled_dropoff_at && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Calendar className="h-4 w-4" />
                    {new Date(job.data.scheduled_dropoff_at).toLocaleString()}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Package Details */}
        <div className="bg-card rounded-xl p-6">
          <h2 className="font-semibold text-foreground mb-4 flex items-center gap-2">
            <Package className="h-5 w-5" />
            Package Details
          </h2>
          <div className="grid md:grid-cols-2 gap-6">
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">Description</p>
              <p className="text-foreground">{job.data.notes || "N/A"}</p>
              {job.data.quote?.fragile && (
                <div className="flex items-center gap-2 text-sm text-destructive">
                  <AlertTriangle className="h-4 w-4" />
                  Fragile - Handle with care
                </div>
              )}
              {job.data.quote?.service_type?.name && (
                <p className="text-sm text-blue-500">
                  Service: {job.data.quote.service_type.name}
                </p>
              )}
            </div>
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Dimensions & Weight
              </p>
              <div className="space-y-1 text-sm text-foreground">
                <p>Weight: {job.data.quote?.weight_kg || 0} kg</p>
                <p>Size: {formatDimensions(job.data.quote?.dimensions)}</p>
              </div>
              {job.data.notes && (
                <div className="mt-4 p-3 bg-muted/50 rounded-lg">
                  <p className="text-sm text-muted-foreground">
                    <strong>Notes:</strong> {job.data.notes}
                  </p>
                </div>
              )}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4 pt-4 mt-4 border-t border-border">
            <div>
              <p className="text-sm text-muted-foreground">Tracking Number</p>
              <p className="text-foreground font-mono text-sm">
                {job.data.tracking_number || "N/A"}
              </p>
            </div>
          </div>
        </div>

        {/* Sender Info */}
        <div className="bg-card rounded-xl p-6">
          <h2 className="font-semibold text-foreground mb-4 flex items-center gap-2">
            <User className="h-5 w-5" />
            Sender
          </h2>
          <div className="flex flex-col sm:flex-row gap-6">
            <div className="flex-1 space-y-2">
              <p className="text-foreground font-medium">
                {job.data.customer?.name || job.data.guest_email || "N/A"}
              </p>
              {job.data.customer?.phone && (
                <button
                  onClick={() =>
                    (window.location.href = `tel:${job.data.customer.phone.replace(
                      /\D/g,
                      ""
                    )}`)
                  }
                  className="flex items-center gap-2 text-sm text-primary hover:underline"
                  aria-label={`Call sender: ${job.data.customer.phone}`}
                >
                  <Phone className="h-4 w-4" />
                  Call Sender
                </button>
              )}
            </div>
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">Updated</p>
              <p className="text-sm text-foreground">
                {new Date(job.data.updated_at).toLocaleString()}
              </p>
            </div>
          </div>
        </div>

        {/* Receiver Info */}
        <div className="bg-card rounded-xl p-6">
          <h2 className="font-semibold text-foreground mb-4 flex items-center gap-2">
            <User className="h-5 w-5" />
            Receiver
          </h2>
          <div className="flex flex-col sm:flex-row gap-6">
            <div className="flex-1 space-y-2">
              {job.data.receiver_phone && (
                <button
                  onClick={() =>
                    (window.location.href = `tel:${job.data.receiver_phone.replace(
                      /\D/g,
                      ""
                    )}`)
                  }
                  className="flex items-center gap-2 text-sm text-primary hover:underline"
                  aria-label={`Call receiver: ${job.data.receiver_phone}`}
                >
                  <Phone className="h-4 w-4" />
                  {job.data.receiver_phone}
                </button>
              )}
              {job.data.receiver_email && (
                <p className="text-sm text-muted-foreground">
                  Email: {job.data.receiver_email}
                </p>
              )}
              {!job.data.receiver_phone && !job.data.receiver_email && (
                <p className="text-sm text-muted-foreground">
                  No receiver details available
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Status Update Section */}
        <div className="bg-card rounded-xl p-6 border-primary/20 border">
          <h2 className="font-semibold text-foreground mb-4">Next Action</h2>
          <div className="flex flex-col gap-4">
            {job.data.status === "delivered" ? (
              <>
                <button
                  onClick={() => hasProof && setShowProofViewModal(true)}
                  disabled={!hasProof}
                  className="flex items-center justify-center gap-3 px-6 py-4 bg-green-500 text-white rounded-xl font-semibold text-base hover:bg-green-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  aria-label={hasProof ? "View POD" : "No POD available"}
                >
                  <Truck className="h-5 w-5" />
                  Delivered
                  {immutable && <Lock className="h-5 w-5" title="Locked" />}
                </button>
                {hasProof && (
                  <button
                    onClick={() => setShowProofViewModal(true)}
                    className="text-sm text-primary hover:underline focus:outline-none focus:ring-2 focus:ring-primary"
                    aria-label="View POD submission"
                  >
                    View Submission
                  </button>
                )}
                {immutable && (
                  <p className="text-sm text-destructive text-center">
                    {immutableReason || "Status locked—POD submitted."}
                  </p>
                )}
              </>
            ) : nextStatus ? (
              <div className="flex flex-col sm:flex-row gap-4">
                <button
                  onClick={() => handleStatusUpdate(nextStatus)}
                  disabled={
                    immutable ||
                    (nextStatus === "delivered" &&
                      (!isNearDropoff || !hasProof))
                  }
                  className="flex-1 flex items-center justify-center gap-3 px-6 py-4 bg-primary text-primary-foreground rounded-xl font-semibold hover:bg-primary/90 transition-colors text-base disabled:opacity-50 disabled:cursor-not-allowed"
                  aria-label={
                    immutable
                      ? immutableReason
                      : `Mark as ${getStatusText(nextStatus)}`
                  }
                >
                  <Truck className="h-5 w-5" />
                  Mark as {getStatusText(nextStatus)}
                  {immutable && <Lock className="h-5 w-5" />}
                </button>
                {job.data.status === "in_transit" && (
                  <button
                    onClick={() => setShowProofModal(true)}
                    disabled={immutable}
                    className="flex items-center justify-center gap-3 px-6 py-4 bg-orange-500 text-white rounded-xl font-semibold hover:bg-orange-600 transition-colors text-base disabled:opacity-50 disabled:cursor-not-allowed"
                    aria-label={
                      immutable ? "POD locked" : "Upload Proof of Delivery"
                    }
                  >
                    <Camera className="h-5 w-5" />
                    Upload Proof
                    {immutable && <Lock className="h-5 w-5" />}
                  </button>
                )}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                No further status updates available
              </p>
            )}
          </div>
        </div>

        {/* Navigation */}
        <div className="bg-card rounded-xl p-6">
          <h2 className="font-semibold text-foreground mb-4 flex items-center gap-2">
            <Navigation className="h-5 w-5" />
            Navigation
          </h2>
          <div className="space-y-4">
            <div className="flex items-center justify-between mb-4">
              <h4 className="text-lg font-medium text-gray-900 dark:text-white">
                Route Preview
              </h4>
              {job.data.quote?.distance_km > 0 && (
                <span className="text-sm font-medium text-orange-600 dark:text-orange-400">
                  Distance: {job.data.quote.distance_km}km
                </span>
              )}
            </div>
            {mapError ? (
              <div className="bg-red-50 dark:bg-red-900/20 p-4 rounded-lg flex items-center justify-center">
                <AlertTriangle className="h-6 w-6 text-red-500 mr-2" />
                <p className="text-red-600 dark:text-red-300">{mapError}</p>
              </div>
            ) : !pickupAddress && !dropoffAddress ? (
              <div className="bg-yellow-50 dark:bg-yellow-900/20 p-4 rounded-lg flex items-center justify-center">
                <AlertTriangle className="h-6 w-6 text-yellow-500 mr-2" />
                <p className="text-yellow-600 dark:text-yellow-300">
                  Map cannot be displayed: Missing coordinates
                </p>
              </div>
            ) : (
              <APIProvider apiKey={apiKey} libraries={libraries}>
                <MapComponent
                  pickupAddress={pickupAddress}
                  dropoffAddress={dropoffAddress}
                  isLoading={loading}
                  error={mapError}
                  className="w-full h-96 rounded-lg border border-gray-300 dark:border-gray-600"
                  onError={(error) =>
                    setMapError(error?.message || "Map failed to load")
                  }
                />
              </APIProvider>
            )}
          </div>
        </div>
      </div>

      {/* Proof of Delivery Modal */}
      {showProofModal && (
        <ProofOfDelivery
          job={job.data}
          onClose={() => setShowProofModal(false)}
          onSubmit={async (proofData) => {
            try {
              await driverApi.submitProofOfDelivery(job.data.id, proofData);
              toast.success("Proof of delivery submitted successfully");
              setShowProofModal(false);
              setHasProof(true);
              await loadProofOfDelivery(job.data.id);
              // New: Full refresh after POD submit to sync status/UI
              await loadJobDetails();
            } catch (error) {
              console.error("Failed to submit proof of delivery:", error);
              toast.error(
                error.response?.data?.detail ||
                  "Failed to submit proof of delivery"
              );
            }
          }}
        />
      )}

      {/* Proof of Delivery View Modal */}
      {showProofViewModal && (
        <ProofOfDeliveryView
          proofData={proofData}
          onClose={() => setShowProofViewModal(false)}
        />
      )}
    </div>
  );
}
