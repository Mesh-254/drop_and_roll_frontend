"use client";

import { useState, useEffect } from "react";
import { toast } from "react-hot-toast";
import {
  MapPin,
  Clock,
  User,
  Phone,
  Package,
  Filter,
  Search,
  CheckSquare,
  Square,
  MoreVertical,
  AlertTriangle,
  FileText,
} from "lucide-react";
import { driverApi } from "../../api/driver-api";

export function DeliveryStatusUpdates({
  jobs: initialJobs = [],
  onJobClick,
  onStatusUpdate,
}) {
  const [selectedJobs, setSelectedJobs] = useState([]);
  const [statusFilter, setStatusFilter] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [bulkActionOpen, setBulkActionOpen] = useState(false);
  const [jobs, setJobs] = useState(
    Array.isArray(initialJobs) ? initialJobs : []
  );
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize] = useState(10);
  const [totalCount, setTotalCount] = useState(0);

  // Fetch jobs when dependencies change
  useEffect(() => {
    const fetchJobs = async () => {
      try {
        const statusParam = statusFilter !== "all" ? statusFilter : "";
        const response = await driverApi.getAssignedJobs(
          currentPage,
          pageSize,
          statusParam
        );
        setJobs(response.results || []);
        setTotalCount(response.count || 0);
      } catch (error) {
        toast.error("Failed to fetch jobs");
        console.error("[DeliveryStatusUpdates] Error fetching jobs:", error);
        setJobs([]);
        setTotalCount(0);
      }
    };
    fetchJobs();
  }, [currentPage, pageSize, statusFilter, onStatusUpdate]);

  // Reset to page 1 when status filter changes
  useEffect(() => {
    setCurrentPage(1);
  }, [statusFilter]);

  const totalPages = Math.ceil(totalCount / pageSize);

  // Format address (handles string or object)
  const formatAddress = (addr) => {
    if (typeof addr === "string") return addr;
    if (typeof addr === "object" && addr !== null) {
      const parts = [
        addr.line1 || "",
        addr.city || "",
        addr.state || "",
        addr.zip || "",
      ].filter(Boolean);
      return parts.join(", ");
    }
    return "";
  };

  // Format dimensions
  const formatDimensions = (dimensions) => {
    if (
      !dimensions ||
      !dimensions.length ||
      !dimensions.width ||
      !dimensions.height
    ) {
      return "N/A";
    }
    return `${dimensions.length}x${dimensions.width}x${dimensions.height} cm`;
  };

  // Check if pickup is within 30 minutes
  const isUrgentPickup = (scheduledPickupAt) => {
    if (!scheduledPickupAt) return false;
    const now = new Date();
    const pickupTime = new Date(scheduledPickupAt);
    const diffMinutes = (pickupTime - now) / (1000 * 60);
    return diffMinutes <= 30 && diffMinutes >= 0;
  };

  // Apply search filter client-side (status filter is now server-side)
  const filteredJobs = jobs.filter((job) => {
    const matchesSearch =
      (job.customer_name?.toLowerCase() || "").includes(
        searchTerm.toLowerCase()
      ) ||
      formatAddress(job.pickup_address)
        .toLowerCase()
        .includes(searchTerm.toLowerCase()) ||
      formatAddress(job.dropoff_address)
        .toLowerCase()
        .includes(searchTerm.toLowerCase());
    return matchesSearch;
  });

  const handleJobSelect = (jobId) => {
    setSelectedJobs((prev) =>
      prev.includes(jobId)
        ? prev.filter((id) => id !== jobId)
        : [...prev, jobId]
    );
  };

  const handleSelectAll = () => {
    if (selectedJobs.length === filteredJobs.length) {
      setSelectedJobs([]);
    } else {
      setSelectedJobs(filteredJobs.map((job) => job.id));
    }
  };

  const handleBulkStatusUpdate = async (newStatus) => {
    if (
      !window.confirm(
        `Are you sure you want to update ${
          selectedJobs.length
        } jobs to ${newStatus.toUpperCase().replace("_", " ")}?`
      )
    ) {
      return;
    }
    try {
      await Promise.all(
        selectedJobs.map((id) => driverApi.updateJobStatus(id, newStatus))
      );
      toast.success(`Updated ${selectedJobs.length} jobs to ${newStatus}`);
      setSelectedJobs([]);
      setBulkActionOpen(false);
      // Refresh job list
      const statusParam = statusFilter !== "all" ? statusFilter : "";
      const updatedResponse = await driverApi.getAssignedJobs(
        currentPage,
        pageSize,
        statusParam
      );
      setJobs(updatedResponse.results || []);
      setTotalCount(updatedResponse.count || 0);
      if (onStatusUpdate) onStatusUpdate();
    } catch (error) {
      toast.error("Failed to update job statuses");
      console.error("[DeliveryStatusUpdates] Bulk status update error:", error);
      setJobs([]);
      setTotalCount(0);
    }
  };

  const handleSingleStatusUpdate = async (jobId, newStatus) => {
    if (
      !window.confirm(
        `Are you sure you want to mark this job as ${newStatus
          .toUpperCase()
          .replace("_", " ")}?`
      )
    ) {
      return;
    }
    try {
      await driverApi.updateJobStatus(jobId, newStatus);
      toast.success(
        `Job status updated to ${newStatus.toUpperCase().replace("_", " ")}`
      );
      setJobs((prev) =>
        prev.map((job) =>
          job.id === jobId
            ? { ...job, status: newStatus, updated_at: new Date().toISOString() }
            : job
        )
      );
      if (onStatusUpdate) onStatusUpdate();
    } catch (error) {
      toast.error("Failed to update job status");
      console.error("[DeliveryStatusUpdates] Single status update error:", error);
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case "assigned":
        return "bg-blue-500/10 text-blue-600 border-blue-500/20";
      case "picked_up":
        return "bg-yellow-500/10 text-yellow-600 border-yellow-500/20";
      case "in_transit":
        return "bg-primary/10 text-primary border-primary/20";
      case "delivered":
        return "bg-green-500/10 text-green-600 border-green-500/20";
      default:
        return "bg-muted text-muted-foreground border-border";
    }
  };

  const getNextStatus = (currentStatus) => {
    switch (currentStatus) {
      case "assigned":
        return "picked_up";
      case "picked_up":
        return "in_transit";
      case "in_transit":
        return "delivered";
      default:
        return null;
    }
  };

  const getStatusLabel = (status) => {
    return status?.replace("_", " ").toUpperCase() || "UNKNOWN";
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-sans font-bold text-foreground">Jobs</h2>
          <p className="text-muted-foreground">
            Manage your delivery assignments and track progress
          </p>
        </div>
        {selectedJobs.length > 0 && (
          <div className="relative">
            <button
              onClick={() => setBulkActionOpen(!bulkActionOpen)}
              className="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-lg font-medium hover:bg-primary/90 transition-colors"
            >
              Bulk Actions ({selectedJobs.length})
              <MoreVertical className="h-4 w-4" />
            </button>
            {bulkActionOpen && (
              <div className="absolute right-0 mt-2 w-48 bg-card border border-border rounded-lg shadow-lg py-2 z-10">
                <button
                  onClick={() => handleBulkStatusUpdate("picked_up")}
                  className="w-full text-left px-4 py-2 hover:bg-muted transition-colors text-foreground"
                >
                  Mark as Picked Up
                </button>
                <button
                  onClick={() => handleBulkStatusUpdate("in_transit")}
                  className="w-full text-left px-4 py-2 hover:bg-muted transition-colors text-foreground"
                >
                  Mark as In Transit
                </button>
                <button
                  onClick={() => handleBulkStatusUpdate("delivered")}
                  className="w-full text-left px-4 py-2 hover:bg-muted transition-colors text-foreground"
                >
                  Mark as Delivered
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="flex-1 relative">
          <Filter className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-card border border-border rounded-lg text-foreground appearance-none focus:outline-none focus:ring-2 focus:ring-ring"
          >
            <option value="all">All Statuses</option>
            <option value="assigned">Assigned</option>
            <option value="picked_up">Picked Up</option>
            <option value="in_transit">In Transit</option>
            <option value="delivered">Delivered</option>
          </select>
        </div>
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search by customer or address..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-card border border-border rounded-lg text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
      </div>

      {/* Select All */}
      <div className="flex items-center gap-2">
        <button
          onClick={handleSelectAll}
          className="p-1 hover:bg-muted rounded"
        >
          {selectedJobs.length === filteredJobs.length ? (
            <CheckSquare className="h-4 w-4 text-primary" />
          ) : (
            <Square className="h-4 w-4 text-muted-foreground" />
          )}
        </button>
        <span className="text-sm text-muted-foreground">
          Select All ({filteredJobs.length})
        </span>
      </div>

      {/* Jobs List */}
      <div className="space-y-4">
        {filteredJobs.length > 0 ? (
          filteredJobs.map((job) => (
            <div
              key={job.id}
              className="bg-card border border-border rounded-lg overflow-hidden hover:shadow-md transition-shadow cursor-pointer"
              onClick={() => onJobClick && onJobClick(job)}
            >
              <div className="p-4">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleJobSelect(job.id);
                      }}
                      className="p-1"
                    >
                      {selectedJobs.includes(job.id) ? (
                        <CheckSquare className="h-4 w-4 text-primary" />
                      ) : (
                        <Square className="h-4 w-4 text-muted-foreground" />
                      )}
                    </button>
                    <div>
                      <h3 className="font-sans font-semibold text-foreground">
                        Job #{job.id.slice(-6)}
                      </h3>
                      <p className="text-xs text-muted-foreground">
                        {new Date(job.created_at).toLocaleTimeString()}
                      </p>
                      {job.tracking_number && (
                        <p className="text-xs text-foreground mt-1">
                          Tracking: {job.tracking_number}
                          {isUrgentPickup(job.scheduled_pickup_at) && (
                            <AlertTriangle
                              className="h-4 w-4 text-yellow-500 inline ml-2"
                              title="Pickup within 30 minutes"
                            />
                          )}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span
                      className={`px-3 py-1 rounded-full text-xs font-medium border ${getStatusColor(
                        job.status
                      )}`}
                    >
                      {getStatusLabel(job.status)}
                    </span>
                    <span className="text-sm font-medium text-foreground">
                      KES {job.driver_fee?.toLocaleString()}
                    </span>
                  </div>
                </div>

                <div className="space-y-4 mb-4">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 bg-green-500/20 rounded-full flex items-center justify-center">
                        <MapPin className="h-3 w-3 text-green-500" />
                      </div>
                      <span className="text-sm font-medium text-foreground">
                        Pickup
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground ml-8">
                      {formatAddress(job.pickup_address)}
                    </p>
                    {job.customer?.phone && (
                      <p className="text-sm text-muted-foreground ml-8">
                        Contact: {job.customer.phone}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            window.location.href = `tel:${job.customer.phone}`;
                          }}
                          className="ml-2 text-primary hover:underline"
                        >
                          <Phone className="h-3 w-3 inline" />
                        </button>
                      </p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 bg-primary/20 rounded-full flex items-center justify-center">
                        <MapPin className="h-3 w-3 text-primary" />
                      </div>
                      <span className="text-sm font-medium text-foreground">
                        Delivery
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground ml-8">
                      {formatAddress(job.dropoff_address)}
                    </p>
                    {job.receiver_phone && (
                      <p className="text-sm text-muted-foreground ml-8">
                        Receiver Contact: {job.receiver_phone}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            window.location.href = `tel:${job.receiver_phone}`;
                          }}
                          className="ml-2 text-primary hover:underline"
                        >
                          <Phone className="h-3 w-3 inline" />
                        </button>
                      </p>
                    )}
                  </div>
                </div>

                <div className="space-y-2 mb-4">
                  <div className="flex items-center gap-2">
                    <Package className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-medium text-foreground">
                      Package Details
                    </span>
                    {job.quote?.fragile && (
                      <span
                        className="text-xs text-red-500 font-medium"
                        title="Handle with care"
                      >
                        Fragile
                      </span>
                    )}
                    {job.quote?.service_type?.name && (
                      <span className="text-xs text-blue-500 font-medium ml-2">
                        {job.quote.service_type.name}
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground ml-8">
                    Weight: {job.quote?.weight_kg || "N/A"} kg, Dimensions:{" "}
                    {formatDimensions(job.quote?.dimensions)}
                  </p>
                  {(job.notes || job.quote?.meta?.special_instructions) && (
                    <div className="flex items-center gap-2 ml-8">
                      <FileText className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm text-muted-foreground truncate max-w-[300px]">
                        {job.notes || job.quote?.meta?.special_instructions}
                      </span>
                      {(job.notes || job.quote?.meta?.special_instructions)
                        ?.length > 50 && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            toast(
                              job.notes || job.quote?.meta?.special_instructions,
                              { duration: 5000 }
                            );
                          }}
                          className="text-primary text-xs hover:underline"
                        >
                          View more
                        </button>
                      )}
                    </div>
                  )}
                </div>

                <div className="flex flex-col sm:flex-row sm:items-center gap-4 pt-2 border-t border-border">
                  <div className="flex items-center gap-2">
                    <User className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm text-foreground">
                      {job.customer?.name || job.guest_email || "N/A"}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm text-muted-foreground">
                      {job.estimated_duration || "N/A"} min
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Package className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm text-muted-foreground">
                      {job.bookings?.length || 1} package(s)
                    </span>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2 pt-2">
                  {getNextStatus(job.status) && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleSingleStatusUpdate(
                          job.id,
                          getNextStatus(job.status)
                        );
                      }}
                      className="px-3 py-1 bg-primary text-primary-foreground text-sm rounded-lg hover:bg-primary/90 transition-colors"
                    >
                      {job.status === "assigned" && "Mark Picked Up"}
                      {job.status === "picked_up" && "Start Transit"}
                      {job.status === "in_transit" && "Mark Delivered"}
                    </button>
                  )}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      if (job.customer?.phone) {
                        window.location.href = `tel:${job.customer.phone}`;
                      } else {
                        toast.error("No customer phone number available");
                      }
                    }}
                    className="px-3 py-1 border border-border text-muted-foreground text-sm rounded-lg hover:bg-muted transition-colors"
                  >
                    <Phone className="h-3 w-3 inline mr-1" />
                    Call Customer
                  </button>
                </div>
              </div>
            </div>
          ))
        ) : (
          <p className="text-muted-foreground">No jobs found.</p>
        )}
      </div>

      {/* Pagination Controls */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-4">
          <button
            onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
            disabled={currentPage === 1}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-lg disabled:opacity-50"
          >
            Previous
          </button>
          <span className="text-muted-foreground">
            Page {currentPage} of {totalPages} ({totalCount} total)
          </span>
          <button
            onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
            disabled={currentPage === totalPages}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-lg disabled:opacity-50"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}