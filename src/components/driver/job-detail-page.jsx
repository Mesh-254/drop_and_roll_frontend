"use client";

import { useState, useEffect } from "react";
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
} from "lucide-react";
import { driverApi } from "../../api/driver-api";
import { ProofOfDelivery } from "./proof-of-delivery";
import MapComponent from "../map/MapComponent"; // Import MapComponent
import { APIProvider } from "@vis.gl/react-google-maps";

const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;

const libraries = ["places", "maps", "geometry", "routes"];

export function JobDetailPage({ jobId, onBack }) {
  const [job, setJob] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showProofModal, setShowProofModal] = useState(false);
  const [currentLocation, setCurrentLocation] = useState(null);
  const [isNearDropoff, setIsNearDropoff] = useState(false);
  const [mapError, setMapError] = useState(null);
  const [statuses, setStatuses] = useState([
    { current: "pending", next: "scheduled" },
    { current: "scheduled", next: "assigned" },
    { current: "assigned", next: "picked_up" },
    { current: "picked_up", next: "in_transit" },
    { current: "in_transit", next: "delivered" },
  ]);

  useEffect(() => {
    if (!jobId) {
      console.error(
        "jobId is missing! Cannot fetch. Check parent component (e.g., driver-dashboard)."
      );
      setLoading(false);
      return;
    }
    loadJobDetails();
    loadStatuses();
    getCurrentLocation();
  }, [jobId]);

  const loadJobDetails = async () => {
    try {
      setLoading(true);
      const jobDetail = await driverApi.getJob(jobId);
      if (!jobDetail || !jobDetail.data) {
        toast.error("Failed to load job details: No data returned");
        return;
      }
      console.log("RECEIVED JOB DETAILS", jobDetail);
      setJob(jobDetail);
      // Log address data for debugging
      console.log("Pickup Address:", jobDetail.data.pickup_address);
      console.log("Dropoff Address:", jobDetail.data.dropoff_address);
    } catch (error) {
      console.error("[DEBUG] Full error in loadJobDetails:", error);
      console.error("[DEBUG] Error stack:", error.stack);
      console.error("[DEBUG] Error message:", error.message);
      toast.error("Failed to load job details");
    } finally {
      setLoading(false);
    }
  };

  const loadStatuses = async () => {
    try {
      const statusData = await driverApi.getJobStatuses();
      if (statusData && statusData.length > 0) {
        setStatuses(statusData);
      } else {
        console.warn(
          "[DEBUG] No statuses returned from API, using fallback statuses"
        );
      }
    } catch (error) {
      console.error("Failed to fetch statuses:", error);
      toast.error("Failed to load job statuses, using fallback statuses");
    }
  };

  const getCurrentLocation = async () => {
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
  };

  const calculateDistance = (loc1, loc2) => {
    // Placeholder: Implement Haversine formula for distance calculation
    return 100; // Mock distance for now
  };

  const handleStatusUpdate = async (newStatus) => {
    const confirmMessage = `Are you sure you want to mark this job as ${getStatusText(
      newStatus
    )}?`;
    if (!window.confirm(confirmMessage)) {
      return;
    }

    if (newStatus === "delivered" && !showProofModal) {
      setShowProofModal(true);
      return;
    }

    try {
      await driverApi.updateJobStatus(job.data.id, newStatus, currentLocation);
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
        getCurrentLocation(); // Refresh location to check if near dropoff
      }
    } catch (error) {
      console.error("Failed to update job status:", error);
      const errorMessage =
        error.response?.data?.detail || "Failed to update job status";
      if (errorMessage.includes("Cannot set status to delivered")) {
        toast.error("Please upload proof of delivery to mark as delivered");
        setShowProofModal(true);
      } else {
        toast.error(errorMessage);
      }
    }
  };

  const getNextStatus = (currentStatus) => {
    console.log("[DEBUG] Current status:", currentStatus);
    console.log("[DEBUG] Available statuses:", statuses);
    const status = statuses.find((s) => s.current === currentStatus);
    console.log("[DEBUG] Next status:", status ? status.next : null);
    return status ? status.next : null;
  };

  const getStatusColor = (status) => {
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
  };

  const getStatusText = (status) => {
    const labels = {
      pending: "Pending",
      scheduled: "Scheduled",
      assigned: "Assigned",
      picked_up: "Picked Up",
      in_transit: "In Transit",
      delivered: "Delivered",
      cancelled: "Cancelled",
      failed: "Failed",
    };
    return labels[status] || status?.replace("_", " ").toUpperCase() || status;
  };

  const formatDimensions = (dimensions) => {
    if (!dimensions || typeof dimensions !== "object") return "N/A";
    const { length = 0, width = 0, height = 0 } = dimensions;
    return `${parseFloat(length) || 0}x${parseFloat(width) || 0}x${
      parseFloat(height) || 0
    } cm`;
  };

  const isUrgentPickup = (scheduledPickupAt) => {
    if (!scheduledPickupAt) return false;
    const now = new Date();
    const pickupTime = new Date(scheduledPickupAt);
    const diffMinutes = (pickupTime - now) / (1000 * 60);
    return diffMinutes <= 30 && diffMinutes >= 0;
  };

  const formatAddress = (addr) => {
    if (typeof addr === "string") return addr;
    if (typeof addr === "object" && addr !== null) {
      const parts = [
        addr.line1 || "",
        addr.city || "",
        addr.region || "",
        addr.postal_code || "",
      ].filter(Boolean);
      return parts.join(", ");
    }
    return "N/A";
  };

  // Prepare pickup and dropoff address objects for MapComponent
  const pickupAddress =
    job?.data?.pickup_address?.latitude && job?.data?.pickup_address?.longitude
      ? {
          latitude: parseFloat(job.data.pickup_address.latitude),
          longitude: parseFloat(job.data.pickup_address.longitude),
        }
      : null;

  const dropoffAddress =
    job?.data?.dropoff_address?.latitude &&
    job?.data?.dropoff_address?.longitude
      ? {
          latitude: parseFloat(job.data.dropoff_address.latitude),
          longitude: parseFloat(job.data.dropoff_address.longitude),
        }
      : null;

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading job details...</p>
        </div>
      </div>
    );
  }

  if (!job || !job.data) {
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

  const nextStatus = getNextStatus(job.data.status);

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="bg-card border-b border-border sticky top-0 z-10 p-4">
        <div className="flex items-center gap-4">
          <button
            onClick={onBack}
            className="flex items-center justify-center gap-2 px-4 py-2 bg-card text-foreground border border-border rounded-lg shadow-sm hover:bg-muted hover:shadow-md transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-opacity-50"
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
              >
                {getStatusText(job.data.status)}
              </span>
              {isUrgentPickup(job.data.scheduled_pickup_at) && (
                <AlertTriangle
                  className="h-4 w-4 text-orange-500"
                  title="Urgent pickup"
                />
              )}
            </div>
          </div>
          <span className="text-lg font-bold text-primary">
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
            {/* Pickup */}
            <div className="space-y-3">
              <h3 className="font-medium text-foreground flex items-center gap-2">
                <div className="w-2 h-2 bg-green-500 rounded-full"></div>
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

            {/* Delivery */}
            <div className="space-y-3">
              <h3 className="font-medium text-foreground flex items-center gap-2">
                <div className="w-2 h-2 bg-primary rounded-full"></div>
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
                  >
                    <Phone className="h-4 w-4" />
                    Receiver: {job.data.receiver_phone}
                  </button>
                )}
                {job.data.receiver_email && (
                  <p className="text-sm text-muted-foreground">
                    Receiver Email: {job.data.receiver_email}
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
                <p className="text-sm text-muted-foreground">No receiver details available</p>
              )}
            </div>
          </div>
        </div>

        {/* Status Update Section */}
        <div className="bg-card rounded-xl p-6 border-primary/20 border">
          <h2 className="font-semibold text-foreground mb-4">Next Action</h2>
          {nextStatus ? (
            <div className="flex flex-col sm:flex-row gap-4">
              <button
                onClick={() => handleStatusUpdate(nextStatus)}
                disabled={nextStatus === "delivered" && !isNearDropoff}
                className="flex-1 flex items-center justify-center gap-3 px-6 py-4 bg-primary text-primary-foreground rounded-xl font-semibold hover:bg-primary/90 transition-colors text-base disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Truck className="h-5 w-5" />
                Mark as {getStatusText(nextStatus)}
              </button>
              {job.data.status === "in_transit" && (
                <button
                  onClick={() => setShowProofModal(true)}
                  className="flex items-center justify-center gap-3 px-6 py-4 border border-input rounded-xl font-semibold hover:bg-muted transition-colors text-base"
                >
                  <Camera className="h-5 w-5" />
                  Upload Proof
                </button>
              )}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              No further status updates available
            </p>
          )}
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
              {job.data.quote.distance_km > 0 && (
                <span className="text-sm font-medium text-orange-600 dark:text-orange-400">
                  Distance: {job.data.quote.distance_km}km
                </span>
              )}
            </div>

            {/* Map Section with Debugging */}
            {mapError ? (
              <div className="bg-red-50 dark:bg-red-900/20 p-4 rounded-lg flex items-center justify-center">
                <AlertTriangle className="h-6 w-6 text-red-500 mr-2" />
                <p className="text-red-600 dark:text-red-300">{mapError}</p>
              </div>
            ) : !pickupAddress && !dropoffAddress ? (
              <div className="bg-yellow-50 dark:bg-yellow-900/20 p-4 rounded-lg flex items-center justify-center">
                <AlertTriangle className="h-6 w-6 text-yellow-500 mr-2" />
                <p className="text-yellow-600 dark:text-yellow-300">
                  Map cannot be displayed: Missing pickup and dropoff
                  coordinates
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
              setJob({
                ...job,
                data: {
                  ...job.data,
                  status: "delivered",
                  updated_at: new Date().toISOString(),
                },
              });
              if (onUpdateBookingStatus) {
                onUpdateBookingStatus(job.data.id, "delivered");
              }
            } catch (error) {
              console.error(
                "[JobDetailPage] Failed to submit proof of delivery:",
                error
              );
              const errorMessage =
                error.response?.data?.detail ||
                "Failed to submit proof of delivery";
              toast.error(errorMessage);
            }
          }}
        />
      )}
    </div>
  );
}