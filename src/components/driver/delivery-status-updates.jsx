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
  const [jobs, setJobs] = useState(Array.isArray(initialJobs) ? initialJobs : []);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize] = useState(10);
  const [totalCount, setTotalCount] = useState(0);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMoreJobs, setHasMoreJobs] = useState(true);
  const [immutableChecks, setImmutableChecks] = useState({});
  const [isCheckingImmutable, setIsCheckingImmutable] = useState(false);
  const observerTarget = useRef(null);

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
      const check = await checkSingleImmutable(jobId);
      if (check.immutable) {
        toast.error(check.reason || "Job is locked—cannot update.");
        return;
      }

      if (
        !window.confirm(
          `Mark this job as ${newStatus.toUpperCase().replace("_", " ")}?`
        )
      )
        return;

      try {
        await driverApi.updateJobStatus(jobId, newStatus);
        toast.success(
          `Job status updated to ${newStatus.toUpperCase().replace("_", " ")}`
        );
        setJobs((prev) =>
          prev.map((job) =>
            job.id === jobId
              ? {
                  ...job,
                  status: newStatus,
                  updated_at: new Date().toISOString(),
                }
              : job
          )
        );
        if (onStatusUpdate) onStatusUpdate();
      } catch (error) {
        toast.error("Failed to update job status");
        console.error("[DeliveryStatusUpdates] Single status update error:", error);
      }
    },
    [checkSingleImmutable, onStatusUpdate]
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
                  <div className="absolute right-0 mt-2 w-56 bg-white border border-slate-200 rounded-lg shadow-lg py-2 z-10">
                    {skippedCount > 0 && (
                      <div className="px-4 py-2 text-xs text-amber-700 bg-amber-50 border-b border-amber-100">
                        ⓘ Skipping {skippedCount} locked job{skippedCount > 1 ? "s" : ""}
                      </div>
                    )}
                    <button
                      onClick={() => handleBulkStatusUpdate("picked_up")}
                      className="w-full text-left px-4 py-2.5 hover:bg-slate-50 transition-colors text-slate-900 border-b border-slate-100 text-sm"
                    >
                      ► Mark as Picked Up
                    </button>
                    <button
                      onClick={() => handleBulkStatusUpdate("at_hub")}
                      className="w-full text-left px-4 py-2.5 hover:bg-slate-50 transition-colors text-slate-900 border-b border-slate-100 text-sm"
                    >
                      ◆ Mark as At Hub
                    </button>
                    <button
                      onClick={() => handleBulkStatusUpdate("in_transit")}
                      className="w-full text-left px-4 py-2.5 hover:bg-slate-50 transition-colors text-slate-900 text-sm"
                    >
                      ↗ Mark as In Transit
                    </button>
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

      {/* Jobs List */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Select All Row */}
        {filteredJobs.length > 0 && (
          <div className="mb-4 flex items-center gap-3 px-4 py-3 bg-slate-50 rounded-lg border border-slate-200">
            <button
              onClick={handleSelectAll}
              className="p-1 hover:bg-slate-200 rounded transition-colors"
              aria-label="Select all jobs"
            >
              {selectedJobs.length === filteredJobs.length && filteredJobs.length > 0 ? (
                <CheckSquare className="h-5 w-5 text-blue-600" />
              ) : (
                <Square className="h-5 w-5 text-slate-400" />
              )}
            </button>
            <span className="text-sm font-medium text-slate-700">
              {selectedJobs.length > 0
                ? `${selectedJobs.length} selected`
                : `Select all (${filteredJobs.length})`}
            </span>
            {isCheckingImmutable && (
              <Loader2 className="h-4 w-4 animate-spin text-blue-600 ml-auto" />
            )}
          </div>
        )}

        {/* Jobs Grid */}
        {filteredJobs.length > 0 ? (
          <div className="space-y-3">
            {filteredJobs.map((job) => {
              const check = immutableChecks[job.id];
              const isImmutable = check?.immutable;
              const nextStatus = getNextStatus(job.status);
              const canUpdate = nextStatus && !isImmutable;
              const urgent = isUrgentPickup(job.scheduled_pickup_at);

              return (
                <div
                  key={job.id}
                  onClick={() => onJobClick && onJobClick(job)}
                  className="bg-white border border-slate-200 rounded-lg hover:shadow-md transition-all cursor-pointer overflow-hidden"
                >
                  <div className="p-4 sm:p-5">
                    <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                      {/* Left: Checkbox + Job Info */}
                      <div className="flex gap-4 flex-1 min-w-0">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleJobSelect(job.id);
                          }}
                          className="mt-0.5 p-1 hover:bg-slate-100 rounded transition-colors flex-shrink-0"
                        >
                          {selectedJobs.includes(job.id) ? (
                            <CheckSquare className="h-5 w-5 text-blue-600" />
                          ) : (
                            <Square className="h-5 w-5 text-slate-300" />
                          )}
                        </button>

                        <div className="min-w-0 flex-1">
                          {/* Header Row */}
                          <div className="flex flex-col sm:flex-row sm:items-baseline gap-2 mb-3">
                            <div>
                              <h3 className="text-sm font-bold text-slate-900">
                                Job #{job.id?.slice(-8) || "N/A"}
                              </h3>
                              {job.tracking_number && (
                                <p className="text-xs text-slate-500 mt-0.5">
                                  Track: {job.tracking_number}
                                </p>
                              )}
                            </div>
                            <div className="flex flex-wrap items-center gap-2">
                              <span
                                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${getStatusBadgeClass(
                                  job.status
                                )}`}
                              >
                                {getStatusLabel(job.status)}
                                {isImmutable && (
                                  <Lock className="h-3 w-3" title="Locked" />
                                )}
                              </span>
                              {urgent && (
                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-red-100 text-red-700 border border-red-200">
                                  <AlertCircle className="h-3 w-3" />
                                  Urgent
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Addresses */}
                          <div className="space-y-2 text-xs">
                            <div className="flex gap-2">
                              <MapPin className="h-4 w-4 text-slate-400 flex-shrink-0 mt-0.5" />
                              <div>
                                <p className="text-slate-600 font-medium">
                                  From: {formatAddress(job.pickup_address) || "N/A"}
                                </p>
                              </div>
                            </div>
                            <div className="flex gap-2">
                              <MapPin className="h-4 w-4 text-slate-400 flex-shrink-0 mt-0.5" />
                              <div>
                                <p className="text-slate-600 font-medium">
                                  To: {formatAddress(job.dropoff_address) || "N/A"}
                                </p>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Right: Action Button */}
                      <div className="flex flex-col gap-2 sm:items-end">
                        {canUpdate ? (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleSingleStatusUpdate(job.id, nextStatus);
                            }}
                            className="px-4 py-2.5 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 transition-colors shadow-sm whitespace-nowrap"
                          >
                            {nextStatus === "picked_up" && "► Pick Up"}
                            {nextStatus === "at_hub" && "◆ At Hub"}
                            {nextStatus === "in_transit" && "↗ In Transit"}
                            {nextStatus === "delivered" && "✓ Deliver"}
                          </button>
                        ) : isImmutable ? (
                          <div className="px-4 py-2.5 bg-slate-100 text-slate-600 text-xs font-medium rounded-lg text-center">
                            <Lock className="h-4 w-4 inline mr-1" />
                            Locked
                          </div>
                        ) : (
                          <div className="px-4 py-2.5 bg-slate-100 text-slate-500 text-xs font-medium rounded-lg text-center">
                            Completed
                          </div>
                        )}
                        {job.customer?.phone && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              window.location.href = `tel:${job.customer.phone.replace(
                                /\D/g,
                                ""
                              )}`;
                            }}
                            className="text-xs text-blue-600 hover:text-blue-700 font-medium"
                          >
                            Call Customer
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
          <div className="text-center py-12">
            <Package className="h-12 w-12 text-slate-300 mx-auto mb-3" />
            <p className="text-slate-600 font-medium">No jobs found</p>
            <p className="text-sm text-slate-500">
              {searchTerm ? "Try adjusting your search" : "No deliveries assigned yet"}
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
    </div>
  );
}
