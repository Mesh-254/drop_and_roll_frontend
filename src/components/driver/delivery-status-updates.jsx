"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { toast } from "react-hot-toast";
import {
  MapPin,
  Clock,
  Package,
  Filter,
  Search,
  CheckSquare,
  Square,
  ChevronDown,
  AlertTriangle,
  Loader2,
  Lock,
  ChevronLeft,
  ChevronRight,
  AlertCircle,
  RefreshCw,
  Camera, // NEW: For QR scan button
  User,
} from "lucide-react";
import { driverApi } from "../../api/driver-api";
import { QRScannerModal } from "./QRScannerModal"; // NEW: QR Scanner component
import { ProofOfDelivery } from "./proof-of-delivery"; // NEW: Proof of Delivery component
import { FailureReportModal } from "./FailureReportModal"; // NEW: Failure Report Modal

export function DeliveryStatusUpdates({
  jobs: initialJobs = [],
  onJobClick,
  onStatusUpdate,
}) {
  const [selectedJobs, setSelectedJobs] = useState([]);
  const [statusFilter, setStatusFilter] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [bulkActionOpen, setBulkActionOpen] = useState(false);
  const [jobs, setJobs] = useState(Array.isArray(initialJobs) ? initialJobs : []);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize] = useState(10);
  const [totalCount, setTotalCount] = useState(0);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMoreJobs, setHasMoreJobs] = useState(true);
  const [immutableChecks, setImmutableChecks] = useState({});
  const [isCheckingImmutable, setIsCheckingImmutable] = useState(false);
  const [showQRScanner, setShowQRScanner] = useState(false);
  const [selectedJobForQR, setSelectedJobForQR] = useState(null);
  const [showProofModal, setShowProofModal] = useState(false);
  const [pendingDeliveryJob, setPendingDeliveryJob] = useState(null);
  const [pendingDeliveryJobs, setPendingDeliveryJobs] = useState([]); // For bulk
  const [showFailureModal, setShowFailureModal] = useState(false);
  const [failureJobId, setFailureJobId] = useState(null);
  const [failureJobTitle, setFailureJobTitle] = useState("");
  const [failureType, setFailureType] = useState("delivery"); // 'pickup' or 'delivery'
  const observerTarget = useRef(null);

  // NEW: Auto-refresh interval ref (for cleanup)
  const autoRefreshIntervalRef = useRef(null);

  const fetchJobs = useCallback(
    async (page, append = false) => {
      try {
        if (append) {
          setIsLoadingMore(true);
        }

        const statusParam = statusFilter !== "all" ? statusFilter : "all";
        const response = await driverApi.getAssignedJobs(
          page,
          pageSize,
          statusParam
        );

        const newJobs = response.ordered_bookings || [];
        const count = response.count || 0;

        if (append) {
          setJobs((prevJobs) => [...prevJobs, ...newJobs]);
        } else {
          setJobs(newJobs);
        }

        setTotalCount(count);
        const totalPages = Math.ceil(count / pageSize);
        setHasMoreJobs(page < totalPages);
      } catch (error) {
        toast.error("Failed to fetch jobs");
        console.error("[DeliveryStatusUpdates] Error fetching jobs:", error);
        if (!append) {
          setJobs([]);
          setTotalCount(0);
        }
      } finally {
        if (append) {
          setIsLoadingMore(false);
        }
      }
    },
    [statusFilter, pageSize]
  );

  const checkAllSelectedImmutable = useCallback(async () => {
    if (selectedJobs.length === 0 || isCheckingImmutable) return;
    setIsCheckingImmutable(true);
    try {
      const response = await driverApi.batchCheckImmutable(selectedJobs);
      setImmutableChecks((prev) => ({ ...prev, ...response.data }));
    } catch (error) {
      console.error("[DeliveryStatusUpdates] Batch immutable check error:", error);
      toast.error("Failed to check job statuses");
      await Promise.allSettled(
        selectedJobs.slice(0, 5).map((id) =>
          driverApi.checkImmutable(id).then((res) => {
            if (res.success)
              setImmutableChecks((prev) => ({
                ...prev,
                [id]: { immutable: res.immutable, reason: res.reason },
              }));
          })
        )
      );
    } finally {
      setIsCheckingImmutable(false);
    }
  }, [selectedJobs, isCheckingImmutable]);

  const checkSingleImmutable = useCallback(
    async (jobId) => {
      const cached = immutableChecks[jobId];
      if (cached !== undefined) return cached;
      const result = await driverApi.checkImmutable(jobId);
      if (result.success) {
        setImmutableChecks((prev) => ({
          ...prev,
          [jobId]: { immutable: result.immutable, reason: result.reason },
        }));
        return { immutable: result.immutable, reason: result.reason };
      }
      return { immutable: false };
    },
    [immutableChecks]
  );

  useEffect(() => {
    setCurrentPage(1);
    setJobs([]);
    fetchJobs(1, false);
  }, [statusFilter, onStatusUpdate, fetchJobs]);

  // STEP 4: Auto-refresh every 8 seconds when on "all" or "assigned" tab (critical for QR scan updates)
  useEffect(() => {
    // Clear any existing interval
    if (autoRefreshIntervalRef.current) {
      clearInterval(autoRefreshIntervalRef.current);
    }

    // Only auto-refresh on relevant tabs where QR scan would affect the list
    if (statusFilter === "all" || statusFilter === "assigned") {
      autoRefreshIntervalRef.current = setInterval(() => {
        console.log("[DeliveryStatusUpdates] Auto-refresh triggered (QR scan / status change)");
        fetchJobs(1, false); // Force full refresh from page 1
      }, 8000);
    }

    // Cleanup on unmount or when filter changes
    return () => {
      if (autoRefreshIntervalRef.current) {
        clearInterval(autoRefreshIntervalRef.current);
      }
    };
  }, [statusFilter, fetchJobs]);

  useEffect(() => {
    if (statusFilter !== "all") {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const target = entries[0];
        if (target.isIntersecting && hasMoreJobs && !isLoadingMore) {
          const nextPage = currentPage + 1;
          setCurrentPage(nextPage);
          fetchJobs(nextPage, true);
        }
      },
      {
        root: null,
        rootMargin: "100px",
        threshold: 0.1,
      }
    );

    const currentTarget = observerTarget.current;
    if (currentTarget) {
      observer.observe(currentTarget);
    }

    return () => {
      if (currentTarget) {
        observer.unobserve(currentTarget);
      }
    };
  }, [statusFilter, currentPage, hasMoreJobs, isLoadingMore, fetchJobs]);

  const totalPages = Math.ceil(totalCount / pageSize);

  const formatAddress = useCallback((addr) => {
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
    return "";
  }, []);

  const isUrgentPickup = useCallback((scheduledPickupAt) => {
    if (!scheduledPickupAt) return false;
    const now = new Date();
    const pickupTime = new Date(scheduledPickupAt);
    const diffMinutes = (pickupTime - now) / (1000 * 60);
    return diffMinutes <= 30 && diffMinutes >= 0;
  }, []);

  const filteredJobs = useMemo(() => {
    return jobs.filter((job) => {
      const matchesSearch =
        (job.customer?.name?.toLowerCase() || "").includes(
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
  }, [jobs, searchTerm, formatAddress]);

  const updatableJobs = useMemo(() => {
    return selectedJobs.filter((jobId) => {
      const check = immutableChecks[jobId];
      return !check?.immutable;
    });
  }, [selectedJobs, immutableChecks]);

  const skippedCount = selectedJobs.length - updatableJobs.length;

  const handleJobSelect = useCallback((jobId) => {
    setSelectedJobs((prev) =>
      prev.includes(jobId)
        ? prev.filter((id) => id !== jobId)
        : [...prev, jobId]
    );
    setImmutableChecks((prev) => {
      const { [jobId]: _, ...rest } = prev;
      return rest;
    });
  }, []);

  const handleSelectAll = () => {
    if (selectedJobs.length === filteredJobs.length) {
      setSelectedJobs([]);
    } else {
      setSelectedJobs(filteredJobs.map((job) => job.id));
    }
  };

  const handleBulkStatusUpdate = useCallback(
    async (newStatus) => {
      await checkAllSelectedImmutable();
      if (updatableJobs.length === 0) {
        toast.error("No jobs can be updated—all selected are locked.");
        return;
      }

      // BLOCK: If trying to mark as "delivered", open Proof of Delivery instead
      if (newStatus === "delivered") {
        console.log("[DeliveryStatusUpdates] Blocking bulk delivered - opening ProofOfDelivery for each job");
        setPendingDeliveryJobs(updatableJobs);
        setShowProofModal(true);
        toast.info("You will need to submit proof of delivery for each job");
        return;
      }

      const confirmMsg =
        skippedCount > 0
          ? `Update ${updatableJobs.length} jobs to ${newStatus
              .toUpperCase()
              .replace("_", " ")}? (Skipping ${skippedCount} locked jobs)`
          : `Update ${selectedJobs.length} jobs to ${newStatus
              .toUpperCase()
              .replace("_", " ")}?`;

      if (!window.confirm(confirmMsg)) return;

      try {
        if (skippedCount > 0) {
          toast.warning(
            `Skipping ${skippedCount} locked jobs. Updating ${updatableJobs.length}.`
          );
        }
        await driverApi.bulkUpdateStatus(updatableJobs, newStatus);
        toast.success(
          `Updated ${updatableJobs.length} jobs to ${newStatus
            .toUpperCase()
            .replace("_", " ")}`
        );
        setSelectedJobs([]);
        setBulkActionOpen(false);
        setCurrentPage(1);
        await fetchJobs(1, false);
        if (onStatusUpdate) onStatusUpdate();
      } catch (error) {
        toast.error("Failed to update job statuses");
        console.error("[DeliveryStatusUpdates] Bulk status update error:", error);
      }
    },
    [checkAllSelectedImmutable, updatableJobs, skippedCount, selectedJobs.length, fetchJobs, onStatusUpdate]
  );

  const handleSingleStatusUpdate = useCallback(
    async (jobId, newStatus) => {
      // Step 1: Check if the job is locked (immutable)
      const check = await checkSingleImmutable(jobId);
      if (check.immutable) {
        toast.error(check.reason || "Job is locked—cannot update.");
        return;
      }

      // Step 2: Special handling for "delivered" status → open Proof of Delivery modal
      if (newStatus === "delivered") {
        console.log("[DeliveryStatusUpdates] Opening ProofOfDelivery for job:", jobId);
        setPendingDeliveryJob(jobId);
        setShowProofModal(true);
        return;
      }

      // Step 3: Confirm with user before updating
      if (
        !window.confirm(
          `Mark this job as ${newStatus.toUpperCase().replace("_", " ")}?`
        )
      ) {
        return;
      }

      try {
        // Step 4: Call backend to update status
        await driverApi.updateJobStatus(jobId, newStatus);

        // Step 5: Optimistic UI update + SMART removal
        // We remove the job from the list immediately when status becomes "at_hub"
        // because it means the pickup leg is complete (dropped at hub)
        setJobs((prev) =>
          prev
            .map((job) =>
              job.id === jobId
                ? {
                    ...job,
                    status: newStatus,
                    updated_at: new Date().toISOString(),
                  }
                : job
            )
            // Remove from UI if status changed to "at_hub" (completed pickup)
            .filter((job) => !(job.id === jobId && newStatus === "at_hub"))
        );

        // Step 6: Single success toast
        toast.success(
          `Job marked as ${newStatus.toUpperCase().replace("_", " ")}`
        );

        // Step 7: Notify parent component (triggers refresh if needed)
        if (onStatusUpdate) onStatusUpdate();
      } catch (error) {
        console.error("[DeliveryStatusUpdates] Single status update error:", error);
        toast.error("Failed to update job status");

        // Fallback: Refresh from server to keep UI in sync
        await fetchJobs(1, false);
      }
    },
    [checkSingleImmutable, onStatusUpdate, fetchJobs]
  );

  // NEW: Manual refresh button handler (great UX for QR scan confirmation)
  const handleManualRefresh = useCallback(() => {
    toast.loading("Refreshing jobs...", { id: "refresh-toast" });
    fetchJobs(1, false).finally(() => {
      toast.success("Jobs refreshed", { id: "refresh-toast" });
    });
  }, [fetchJobs]);

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
          setSelectedJobForQR(null);
          // Refresh the jobs list to show updated status
          await fetchJobs(1, false);
        } else {
          toast.error(
            result.message ||
              "Failed to scan QR. Please try again or manually update status."
          );
        }
      } catch (error) {
        console.error("[DeliveryStatusUpdates] QR scan error:", error);
        toast.error("QR scan failed. Please try again.");
      }
    },
    [fetchJobs]
  );

  // NEW: Handle Proof of Delivery submission
  // NEW: Handle Proof of Delivery submission
  // NOTE: submitProofOfDelivery now automatically updates status to "delivered" atomically
  const handleProofOfDeliverySubmit = useCallback(
    async (proofData) => {
      try {
        const jobId = pendingDeliveryJob || (pendingDeliveryJobs.length > 0 ? pendingDeliveryJobs[0] : null);
        console.log("[DeliveryStatusUpdates] Submitting proof of delivery for job:", jobId, {
          hasPhoto: !!proofData.photo,
          location: proofData.location,
        });

        // Single API call that submits proof AND updates status to "delivered" atomically
        const result = await driverApi.submitProofOfDelivery(jobId, proofData);

        if (!result.success) {
          throw new Error(result.message || "Failed to submit proof");
        }

        console.log("[DeliveryStatusUpdates] Proof submitted and status updated:", result);
        toast.success("Delivery completed successfully! ✓");
        
        // Close modal and reset state
        setShowProofModal(false);
        setPendingDeliveryJob(null);
        setPendingDeliveryJobs([]);
        setSelectedJobs([]);
        setBulkActionOpen(false);
        // FIX: Immediately remove the delivered job from the UI so it
        // disappears right away, without waiting for the network refresh.
        setJobs((prev) => prev.filter((job) => job.id !== jobId));
        setSelectedJobs((prev) => prev.filter((id) => id !== jobId));

        // Refresh the jobs list to show updated status
        await fetchJobs(1, false);
        if (onStatusUpdate) onStatusUpdate();
      } catch (error) {
        console.error("[DeliveryStatusUpdates] Proof submission error:", error);
        toast.error(error.message || "Failed to complete delivery");
      }
    },
    [pendingDeliveryJob, pendingDeliveryJobs, fetchJobs, onStatusUpdate]
  );

  const getNextStatus = (currentStatus) => {
    switch (currentStatus) {
      case "assigned":
        return "picked_up";
      case "picked_up":
        return "at_hub";
      case "at_hub":
        return "in_transit";
      case "in_transit":
        return "delivered";
      default:
        return null;
    }
  };

  const getStatusBadgeClass = (status) => {
    switch (status) {
      case "assigned":
        return "bg-blue-100 text-blue-700 border border-blue-200";
      case "picked_up":
        return "bg-amber-100 text-amber-700 border border-amber-200";
      case "at_hub":
        return "bg-purple-100 text-purple-700 border border-purple-200";
      case "in_transit":
        return "bg-indigo-100 text-indigo-700 border border-indigo-200";
      case "delivered":
        return "bg-green-100 text-green-700 border border-green-200";
      default:
        return "bg-gray-100 text-gray-700 border border-gray-200";
    }
  };

  const getStatusLabel = (status) => {
    return status?.replace("_", " ").toUpperCase() || "UNKNOWN";
  };

  const handleNextPage = () => {
    if (currentPage < totalPages) {
      setCurrentPage(currentPage + 1);
      fetchJobs(currentPage + 1, false);
    }
  };

  const handlePrevPage = () => {
    if (currentPage > 1) {
      setCurrentPage(currentPage - 1);
      fetchJobs(currentPage - 1, false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
      {/* Header */}
      <div className="sticky top-0 z-20 bg-white border-b border-slate-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold text-slate-900">Deliveries</h1>
              <p className="text-sm text-slate-600 mt-1">
                {totalCount} total jobs • {filteredJobs.length} visible
              </p>
            </div>

            {/* NEW: Manual Refresh Button (highly visible for QR scan confirmation) */}
            <button
              onClick={handleManualRefresh}
              className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-slate-300 text-slate-700 font-medium rounded-lg hover:bg-slate-50 transition-colors shadow-sm"
            >
              <RefreshCw className="h-4 w-4" />
              Refresh
            </button>

            {selectedJobs.length > 0 && (
              <div className="relative">
                <button
                  onClick={async () => {
                    await checkAllSelectedImmutable();
                    setBulkActionOpen(!bulkActionOpen);
                  }}
                  disabled={isCheckingImmutable}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
                >
                  Actions ({updatableJobs.length}/{selectedJobs.length})
                  <ChevronDown className="h-4 w-4" />
                </button>
                {bulkActionOpen && (
                  <div className="absolute right-0 mt-2 w-64 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-lg py-2 z-10">
                    {/* Warning Section */}
                    {skippedCount > 0 && (
                      <div className="px-4 py-3 text-xs text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-900/30 border-b border-amber-200 dark:border-amber-800 font-medium">
                        ⓘ Skipping {skippedCount} locked job{skippedCount > 1 ? "s" : ""}
                      </div>
                    )}

                    {/* Picked Up Option */}
                    {/* <button
                      onClick={() => handleBulkStatusUpdate("picked_up")}
                      className="w-full text-left px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors text-slate-900 dark:text-white border-b border-slate-100 dark:border-slate-700 text-sm font-medium"
                    >
                      ► Mark as Picked Up
                    </button> */}

                    {/* At Hub - RESTRICTED */}
                    {(() => {
                      const allSelectedPickedUp = selectedJobs.every((id) => {
                        const j = jobs.find((job) => job.id === id);
                        return j?.status === "picked_up";
                      });
                      return (
                        <>
                          {allSelectedPickedUp ? (
                            <button
                              onClick={() => handleBulkStatusUpdate("at_hub")}
                              className="w-full text-left px-4 py-3 hover:bg-purple-50 dark:hover:bg-purple-900/30 transition-colors text-slate-900 dark:text-white border-b border-slate-100 dark:border-slate-700 text-sm font-medium"
                            >
                              ◆ Mark as At Hub
                            </button>
                          ) : (
                            <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-700">
                              <div className="flex items-start gap-2">
                                <Lock className="h-4 w-4 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
                                <div>
                                  <p className="text-xs font-bold text-red-700 dark:text-red-300">
                                    ◆ At Hub Disabled
                                  </p>
                                  <p className="text-xs text-red-600 dark:text-red-400 mt-0.5">
                                    Only available when ALL are "Picked Up"
                                  </p>
                                </div>
                              </div>
                            </div>
                          )}
                        </>
                      );
                    })()}

                    {/* In Transit Option */}
                    {/* <button
                      onClick={() => handleBulkStatusUpdate("in_transit")}
                      className="w-full text-left px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors text-slate-900 dark:text-white text-sm font-medium"
                    >
                      ↗ Mark as In Transit
                    </button> */}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Filters & Search */}
      <div className="bg-white border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search by customer, address..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-lg text-slate-900 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
              />
            </div>
            <div className="relative">
              <Filter className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent appearance-none text-sm font-medium"
              >
                <option value="all">All Statuses</option>
                <option value="assigned">Assigned</option>
                <option value="picked_up">Picked Up</option>
                <option value="at_hub">At Hub</option>
                <option value="in_transit">In Transit</option>
                <option value="delivered">Delivered</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Jobs List - Modern Card Design */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Select All Row */}
        {filteredJobs.length > 0 && (
          <div className="mb-6 flex items-center gap-3 px-5 py-4 bg-gradient-to-r from-slate-50 to-slate-100 dark:from-slate-800 dark:to-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
            <button
              onClick={handleSelectAll}
              className="p-2 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-colors flex-shrink-0"
              aria-label="Select all jobs"
            >
              {selectedJobs.length === filteredJobs.length && filteredJobs.length > 0 ? (
                <CheckSquare className="h-5 w-5 text-orange-600" />
              ) : (
                <Square className="h-5 w-5 text-slate-400" />
              )}
            </button>
            <span className="text-sm font-semibold text-slate-900 dark:text-white">
              {selectedJobs.length > 0
                ? `${selectedJobs.length} selected`
                : `Select jobs (${filteredJobs.length} total)`}
            </span>
            {isCheckingImmutable && (
              <Loader2 className="h-4 w-4 animate-spin text-orange-600 ml-auto" />
            )}
          </div>
        )}

        {/* Bulk Action Restriction Notice */}
        {selectedJobs.length > 0 && (
          <div className="mb-6 p-4 bg-blue-50 dark:bg-blue-900/30 border-l-4 border-blue-500 rounded-lg">
            <p className="text-sm font-medium text-blue-900 dark:text-blue-200">
              ℹ️ Bulk "At Hub" is only available when ALL selected bookings are "Picked Up"
            </p>
          </div>
        )}

        {/* Jobs Grid */}
        {filteredJobs.length > 0 ? (
          <div className="space-y-6">
            {filteredJobs.map((job) => {
              const check = immutableChecks[job.id];
              const isImmutable = check?.immutable;
              const nextStatus = getNextStatus(job.status);
              const canUpdate = nextStatus && !isImmutable;
              const urgent = isUrgentPickup(job.scheduled_pickup_at);
              const isPickedUp = job.status === "picked_up";
              const allSelectedPickedUp = selectedJobs.length > 0 && selectedJobs.every((id) => {
                const j = jobs.find((job) => job.id === id);
                return j?.status === "picked_up";
              });

              return (
                <div
                  key={job.id}
                  onClick={() => onJobClick && onJobClick(job)}
                  className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl hover:shadow-xl transition-all cursor-pointer overflow-hidden group"
                >
                  <div className="p-6 sm:p-7">
                    {/* Top Row: Checkbox + Tracking Number + Status Badge + Urgent Badge */}
                    <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-6 pb-6 border-b border-slate-200 dark:border-slate-700">
                      <div className="flex gap-4 flex-1 min-w-0">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleJobSelect(job.id);
                          }}
                          className="mt-1 p-2.5 hover:bg-orange-50 dark:hover:bg-orange-900/20 rounded-lg transition-colors flex-shrink-0"
                          aria-label="Select job"
                        >
                          {selectedJobs.includes(job.id) ? (
                            <CheckSquare className="h-5 w-5 text-orange-600" />
                          ) : (
                            <Square className="h-5 w-5 text-slate-300 dark:text-slate-600" />
                          )}
                        </button>
                        <div className="min-w-0 flex-1">
                          {/* Large, bold tracking number */}
                          <div className="mb-2">
                            <p className="text-xs uppercase tracking-widest font-medium text-slate-500 dark:text-slate-400 mb-1">
                              Tracking #
                            </p>
                            <h3 className="text-2xl sm:text-3xl font-bold font-mono text-slate-900 dark:text-white break-all">
                              {job.tracking_number || job.id?.slice(-12) || "N/A"}
                            </h3>
                          </div>
                          {job.id && (
                            <p className="text-xs text-slate-500 dark:text-slate-400">
                              Job ID: {job.id.slice(-8)}
                            </p>
                          )}
                        </div>
                      </div>
                      
                      {/* Status & Urgent Badges */}
                      <div className="flex flex-wrap items-center gap-3 sm:items-start sm:justify-end">
                        <span
                          className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full text-xs font-bold uppercase tracking-wide ${getStatusBadgeClass(
                            job.status
                          )}`}
                        >
                          {getStatusLabel(job.status)}
                          {isImmutable && (
                            <Lock className="h-3.5 w-3.5" title="Locked" />
                          )}
                        </span>
                        {urgent && (
                          <span className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full text-xs font-bold uppercase tracking-wide bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300 border border-red-300 dark:border-red-700">
                            <AlertCircle className="h-3.5 w-3.5" />
                            URGENT
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Route Flow: Pickup → Delivery with Dotted Line & Arrow */}
                    <div className="mb-8">
                      {/* Pickup Section */}
                      <div className="mb-6 pb-6 border-b-2 border-dashed border-teal-200 dark:border-teal-800 relative">
                        <div className="flex gap-4">
                          <div className="flex flex-col items-center">
                            <div className="w-4 h-4 rounded-full bg-teal-500 mb-2" />
                            <div className="w-1 h-16 bg-gradient-to-b from-teal-300 to-teal-100 dark:from-teal-700 dark:to-teal-800" />
                          </div>
                          <div className="flex-1 min-w-0 pt-0.5">
                            <p className="text-xs uppercase tracking-widest font-bold text-teal-700 dark:text-teal-300 mb-1.5">
                              📦 Pickup Location
                            </p>
                            <p className="text-sm sm:text-base font-semibold text-slate-900 dark:text-white mb-2">
                              {formatAddress(job.pickup_address) || "N/A"}
                            </p>
                            {job.customer?.name && (
                              <p className="text-xs text-slate-600 dark:text-slate-400 flex items-center gap-1.5 mb-1">
                                <User className="h-3.5 w-3.5" />
                                {job.customer.name}
                              </p>
                            )}
                            {job.customer?.phone && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  window.location.href = `tel:${job.customer.phone.replace(/\D/g, "")}`;
                                }}
                                className="text-xs text-teal-600 dark:text-teal-300 hover:underline font-medium flex items-center gap-1.5"
                              >
                                <Phone className="h-3.5 w-3.5" />
                                {job.customer.phone}
                              </button>
                            )}
                          </div>
                        </div>

                        {/* Down Arrow Indicator */}
                        <div className="absolute left-1.5 top-20 text-teal-300 dark:text-teal-700 text-xl">
                          ↓
                        </div>
                      </div>

                      {/* Delivery Section */}
                      <div className="flex gap-4">
                        <div className="flex flex-col items-center">
                          <div className="w-4 h-4 rounded-full bg-blue-500" />
                        </div>
                        <div className="flex-1 min-w-0 pt-0.5">
                          <p className="text-xs uppercase tracking-widest font-bold text-blue-700 dark:text-blue-300 mb-1.5">
                            🎯 Delivery Location
                          </p>
                          <p className="text-sm sm:text-base font-semibold text-slate-900 dark:text-white mb-2">
                            {formatAddress(job.dropoff_address) || "N/A"}
                          </p>
                          {job.receiver_name && (
                            <p className="text-xs text-slate-600 dark:text-slate-400 flex items-center gap-1.5 mb-1">
                              <User className="h-3.5 w-3.5" />
                              {job.receiver_name}
                            </p>
                          )}
                          {job.receiver_phone && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                window.location.href = `tel:${job.receiver_phone.replace(/\D/g, "")}`;
                              }}
                              className="text-xs text-blue-600 dark:text-blue-300 hover:underline font-medium flex items-center gap-1.5"
                            >
                              <Phone className="h-3.5 w-3.5" />
                              {job.receiver_phone}
                            </button>
                          )}
                          {job.receiver_email && (
                            <p className="text-xs text-slate-600 dark:text-slate-400 break-all">
                              {job.receiver_email}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Route Metadata */}
                    {(job.route_number || job.estimated_hours || job.number_of_stops) && (
                      <div className="mb-6 pb-6 border-b border-slate-200 dark:border-slate-700 grid grid-cols-2 sm:grid-cols-3 gap-4">
                        {job.route_number && (
                          <div className="bg-slate-50 dark:bg-slate-700/50 rounded-lg p-3">
                            <p className="text-xs uppercase tracking-widest font-bold text-slate-600 dark:text-slate-400 mb-1">
                              Route
                            </p>
                            <p className="text-lg font-bold text-slate-900 dark:text-white">
                              #{job.route_number}
                            </p>
                          </div>
                        )}
                        {job.estimated_hours && (
                          <div className="bg-slate-50 dark:bg-slate-700/50 rounded-lg p-3">
                            <p className="text-xs uppercase tracking-widest font-bold text-slate-600 dark:text-slate-400 mb-1">
                              Est. Time
                            </p>
                            <p className="text-lg font-bold text-slate-900 dark:text-white">
                              {job.estimated_hours}h
                            </p>
                          </div>
                        )}
                        {job.number_of_stops && (
                          <div className="bg-slate-50 dark:bg-slate-700/50 rounded-lg p-3">
                            <p className="text-xs uppercase tracking-widest font-bold text-slate-600 dark:text-slate-400 mb-1">
                              Stops
                            </p>
                            <p className="text-lg font-bold text-slate-900 dark:text-white">
                              {job.number_of_stops}
                            </p>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Action Buttons Row */}
                    <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
                      <div className="flex flex-col sm:flex-row gap-3 flex-1">
                        {/* QR Scan button for assigned jobs */}
                        {job.status === "assigned" && !isImmutable && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedJobForQR(job);
                              setShowQRScanner(true);
                            }}
                            className="flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white font-bold rounded-xl transition-all shadow-md hover:shadow-lg active:scale-95"
                          >
                            <Camera className="h-5 w-5" />
                            <span>Scan Label</span>
                          </button>
                        )}

                        {/* Main Action Button */}
                        {canUpdate ? (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleSingleStatusUpdate(job.id, nextStatus);
                            }}
                            className="flex-1 px-6 py-3 bg-gradient-to-r from-orange-600 to-orange-700 hover:from-orange-700 hover:to-orange-800 text-white font-bold rounded-xl transition-all shadow-md hover:shadow-lg active:scale-95"
                          >
                            {nextStatus === "picked_up" && "► Pick Up"}
                            {nextStatus === "at_hub" && "◆ At Hub"}
                            {nextStatus === "in_transit" && "↗ In Transit"}
                            {nextStatus === "delivered" && "✓ Deliver"}
                          </button>
                        ) : isImmutable ? (
                          <div className="px-6 py-3 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-400 font-bold rounded-xl text-center flex items-center justify-center gap-2">
                            <Lock className="h-5 w-5" />
                            <span>Locked</span>
                          </div>
                        ) : (
                          <div className="px-6 py-3 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 font-bold rounded-xl text-center">
                            ✓ Completed
                          </div>
                        )}
                      </div>

                      {/* Secondary Actions */}
                      <div className="flex gap-2 sm:flex-col">
                        {/* Report Issue - Contextual */}
                        {job.status === "assigned" && !isImmutable && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setFailureJobId(job.id);
                              setFailureJobTitle(job.tracking_number || "Unknown");
                              setFailureType("pickup");
                              setShowFailureModal(true);
                            }}
                            className="p-3 sm:px-4 sm:py-2.5 bg-amber-500 hover:bg-amber-600 text-white font-semibold rounded-lg transition-colors shadow-sm text-sm flex items-center justify-center gap-1"
                            title="Report Pickup Issue"
                          >
                            <AlertTriangle className="h-4 w-4" />
                            <span className="hidden sm:inline">Pickup Issue</span>
                          </button>
                        )}
                        {job.status === "in_transit" && !isImmutable && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setFailureJobId(job.id);
                              setFailureJobTitle(job.tracking_number || "Unknown");
                              setFailureType("delivery");
                              setShowFailureModal(true);
                            }}
                            className="p-3 sm:px-4 sm:py-2.5 bg-orange-500 hover:bg-orange-600 text-white font-semibold rounded-lg transition-colors shadow-sm text-sm flex items-center justify-center gap-1"
                            title="Report Delivery Issue"
                          >
                            <AlertTriangle className="h-4 w-4" />
                            <span className="hidden sm:inline">Delivery Issue</span>
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-16">
            <Package className="h-16 w-16 text-slate-300 dark:text-slate-600 mx-auto mb-4" />
            <p className="text-lg font-bold text-slate-900 dark:text-white">No jobs found</p>
            <p className="text-sm text-slate-600 dark:text-slate-400 mt-2">
              {searchTerm ? "Try adjusting your search filters" : "No deliveries assigned yet"}
            </p>
          </div>
        )}

        {/* Pagination (only for filtered status) */}
        {statusFilter !== "all" && totalPages > 1 && (
          <div className="mt-6 flex items-center justify-center gap-2">
            <button
              onClick={handlePrevPage}
              disabled={currentPage === 1}
              className="p-2 border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              aria-label="Previous page"
            >
              <ChevronLeft className="h-5 w-5 text-slate-600" />
            </button>
            <span className="text-sm font-medium text-slate-900">
              Page {currentPage} of {totalPages}
            </span>
            <button
              onClick={handleNextPage}
              disabled={currentPage === totalPages}
              className="p-2 border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              aria-label="Next page"
            >
              <ChevronRight className="h-5 w-5 text-slate-600" />
            </button>
          </div>
        )}

        {/* Infinite scroll trigger */}
        {statusFilter === "all" && hasMoreJobs && (
          <div ref={observerTarget} className="mt-8 flex justify-center">
            {isLoadingMore && (
              <div className="flex items-center gap-2">
                <Loader2 className="h-5 w-5 animate-spin text-blue-600" />
                <span className="text-sm text-slate-600">Loading more...</span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* NEW: QR Scanner Modal */}
      {showQRScanner && (
        <QRScannerModal
          jobId={selectedJobForQR?.id}
          onClose={() => {
            setShowQRScanner(false);
            setSelectedJobForQR(null);
          }}
          onScanSuccess={handleQRScanSuccess}
        />
      )}

      {/* NEW: Proof of Delivery Modal */}
      {showProofModal && (
        <ProofOfDelivery
          jobId={pendingDeliveryJob || (pendingDeliveryJobs.length > 0 ? pendingDeliveryJobs[0] : null)}
          onClose={() => {
            setShowProofModal(false);
            setPendingDeliveryJob(null);
            setPendingDeliveryJobs([]);
          }}
          onSubmit={handleProofOfDeliverySubmit}
        />
      )}

      {/* NEW: Failure Report Modal - with contextual failure type */}
      <FailureReportModal
        isOpen={showFailureModal}
        jobId={failureJobId}
        jobTitle={failureJobTitle}
        failureType={failureType}
        onClose={() => {
          setShowFailureModal(false);
          setFailureJobId(null);
          setFailureJobTitle("");
          setFailureType("delivery"); // Reset to default
        }}
        onSuccess={(result) => {
          console.log("[DeliveryStatusUpdates] Failure reported successfully:", result);
          // Refresh jobs list to reflect status change
          fetchJobs(1, false);
          if (onStatusUpdate) onStatusUpdate();
        }}
      />
    </div>
  );
}
