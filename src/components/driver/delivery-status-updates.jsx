"use client"

import { useState, useEffect, useRef, useCallback, useMemo } from "react"
import { toast } from "react-hot-toast"
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
  Loader2,
  Lock,
} from "lucide-react"
import { driverApi } from "../../api/driver-api"

export function DeliveryStatusUpdates({ jobs: initialJobs = [], onJobClick, onStatusUpdate }) {
  const [selectedJobs, setSelectedJobs] = useState([])
  const [statusFilter, setStatusFilter] = useState("all")
  const [searchTerm, setSearchTerm] = useState("")
  const [bulkActionOpen, setBulkActionOpen] = useState(false)
  const [jobs, setJobs] = useState(Array.isArray(initialJobs) ? initialJobs : [])
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize] = useState(10)
  const [totalCount, setTotalCount] = useState(0)
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const [hasMoreJobs, setHasMoreJobs] = useState(true)
  const [immutableChecks, setImmutableChecks] = useState({}) // Cached: { jobId: { immutable: bool, reason?: string } }
  const [isCheckingImmutable, setIsCheckingImmutable] = useState(false)
  const observerTarget = useRef(null)

  const fetchJobs = useCallback(
    async (page, append = false) => {
      try {
        if (append) {
          setIsLoadingMore(true)
        }

        const statusParam = statusFilter !== "all" ? statusFilter : ""
        const response = await driverApi.getAssignedJobs(page, pageSize, statusParam)

        const newJobs = response.ordered_bookings || []
        const count = response.count || 0

        if (append) {
          // Append new jobs to existing list for lazy loading
          setJobs((prevJobs) => [...prevJobs, ...newJobs])
        } else {
          // Replace jobs for initial load or filter change
          setJobs(newJobs)
        }

        setTotalCount(count)

        // Check if there are more jobs to load
        const totalPages = Math.ceil(count / pageSize)
        setHasMoreJobs(page < totalPages)
      } catch (error) {
        toast.error("Failed to fetch jobs")
        console.error("[DeliveryStatusUpdates] Error fetching jobs:", error)
        if (!append) {
          setJobs([])
          setTotalCount(0)
        }
      } finally {
        if (append) {
          setIsLoadingMore(false)
        }
      }
    },
    [statusFilter, pageSize],
  )

  // UPDATED: Batch check all selected (called only on bulk click)
  const checkAllSelectedImmutable = useCallback(async () => {
    if (selectedJobs.length === 0 || isCheckingImmutable) return
    setIsCheckingImmutable(true)
    try {
      // Assume batch endpoint; fallback to parallel if not
      const response = await driverApi.batchCheckImmutable(selectedJobs) // NEW: Implement in driver-api.js
      setImmutableChecks((prev) => ({ ...prev, ...response.data })) // {jobId: {immutable, reason}}
    } catch (error) {
      console.error("[DeliveryStatusUpdates] Batch immutable check error:", error)
      toast.error("Failed to check job statuses")
      // Fallback: Parallel single checks (but limit to avoid spam)
      await Promise.allSettled(
        selectedJobs.slice(0, 5).map((id) =>
          driverApi.checkImmutable(id).then((res) => {
            if (res.success)
              setImmutableChecks((prev) => ({ ...prev, [id]: { immutable: res.immutable, reason: res.reason } }))
          }),
        ),
      )
    } finally {
      setIsCheckingImmutable(false)
    }
  }, [selectedJobs, isCheckingImmutable])

  // UPDATED: Single check (for single updates)
  const checkSingleImmutable = useCallback(
    async (jobId) => {
      const cached = immutableChecks[jobId]
      if (cached !== undefined) return cached
      const result = await driverApi.checkImmutable(jobId)
      if (result.success) {
        setImmutableChecks((prev) => ({ ...prev, [jobId]: { immutable: result.immutable, reason: result.reason } }))
        return { immutable: result.immutable, reason: result.reason }
      }
      return { immutable: false }
    },
    [immutableChecks],
  )

  useEffect(() => {
    setCurrentPage(1)
    setJobs([])
    fetchJobs(1, false)
  }, [statusFilter, onStatusUpdate, fetchJobs])

  useEffect(() => {
    if (statusFilter !== "all") {
      // Disable lazy loading for specific status filters
      return
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const target = entries[0]
        if (target.isIntersecting && hasMoreJobs && !isLoadingMore) {
          // Load next page when user scrolls near bottom
          const nextPage = currentPage + 1
          setCurrentPage(nextPage)
          fetchJobs(nextPage, true)
        }
      },
      {
        root: null,
        rootMargin: "100px", // Trigger 100px before reaching the bottom
        threshold: 0.1,
      },
    )

    const currentTarget = observerTarget.current
    if (currentTarget) {
      observer.observe(currentTarget)
    }

    return () => {
      if (currentTarget) {
        observer.unobserve(currentTarget)
      }
    }
  }, [statusFilter, currentPage, hasMoreJobs, isLoadingMore, fetchJobs])

  const totalPages = Math.ceil(totalCount / pageSize)

  // Format address (handles string or object)
  const formatAddress = useCallback((addr) => {
    if (typeof addr === "string") return addr
    if (typeof addr === "object" && addr !== null) {
      const parts = [addr.line1 || "", addr.city || "", addr.region || "", addr.postal_code || ""].filter(Boolean)
      return parts.join(", ")
    }
    return ""
  }, [])

  // Format dimensions
  const formatDimensions = useCallback((dimensions) => {
    if (!dimensions || !dimensions.length || !dimensions.width || !dimensions.height) {
      return "N/A"
    }
    return `${dimensions.length}x${dimensions.width}x${dimensions.height} cm`
  }, [])

  // Check if pickup is within 30 minutes
  const isUrgentPickup = useCallback((scheduledPickupAt) => {
    if (!scheduledPickupAt) return false
    const now = new Date()
    const pickupTime = new Date(scheduledPickupAt)
    const diffMinutes = (pickupTime - now) / (1000 * 60)
    return diffMinutes <= 30 && diffMinutes >= 0
  }, [])

  // Apply search filter client-side (status filter is now server-side)
  const filteredJobs = useMemo(() => {
    return jobs.filter((job) => {
      const matchesSearch =
        (job.customer?.name?.toLowerCase() || "").includes(searchTerm.toLowerCase()) ||
        formatAddress(job.pickup_address).toLowerCase().includes(searchTerm.toLowerCase()) ||
        formatAddress(job.dropoff_address).toLowerCase().includes(searchTerm.toLowerCase())
      return matchesSearch
    })
  }, [jobs, searchTerm, formatAddress])

  // Updatable selected jobs (exclude immutable)
  const updatableJobs = useMemo(() => {
    return selectedJobs.filter((jobId) => {
      const check = immutableChecks[jobId]
      return !check?.immutable
    })
  }, [selectedJobs, immutableChecks])

  const skippedCount = selectedJobs.length - updatableJobs.length

  const handleJobSelect = useCallback((jobId) => {
    setSelectedJobs((prev) => (prev.includes(jobId) ? prev.filter((id) => id !== jobId) : [...prev, jobId]))
    // Clear cache for changed ID to force re-check if needed
    setImmutableChecks((prev) => {
      const { [jobId]: _, ...rest } = prev
      return rest
    })
  }, [])

  const handleSelectAll = () => {
    if (selectedJobs.length === filteredJobs.length) {
      setSelectedJobs([])
    } else {
      setSelectedJobs(filteredJobs.map((job) => job.id))
    }
  }

  const handleBulkStatusUpdate = useCallback(
    async (newStatus) => {
      await checkAllSelectedImmutable() // Batch check here
      if (updatableJobs.length === 0) {
        toast.error("No jobs can be updated—all selected are delivered with POD submitted.")
        return
      }

      const confirmMsg =
        skippedCount > 0
          ? `Update ${updatableJobs.length} jobs to ${newStatus.toUpperCase().replace("_", " ")}? Skipping ${skippedCount} delivered jobs (POD submitted).`
          : `Update ${selectedJobs.length} jobs to ${newStatus.toUpperCase().replace("_", " ")}?`

      if (!window.confirm(confirmMsg)) return

      try {
        if (skippedCount > 0) {
          toast.warning(`Skipping ${skippedCount} delivered jobs with POD. Updating ${updatableJobs.length}.`)
        }
        const response = await driverApi.bulkUpdateStatus(updatableJobs, newStatus)
        toast.success(`Updated ${updatableJobs.length} jobs to ${newStatus.toUpperCase().replace("_", " ")}`)
        setSelectedJobs([])
        setBulkActionOpen(false)
        setCurrentPage(1)
        setJobs([])
        await fetchJobs(1, false)
        if (onStatusUpdate) onStatusUpdate()
      } catch (error) {
        toast.error("Failed to update job statuses")
        console.error("[DeliveryStatusUpdates] Bulk status update error:", error)
      }
    },
    [checkAllSelectedImmutable, updatableJobs, skippedCount, selectedJobs.length, fetchJobs, onStatusUpdate],
  )

  const handleSingleStatusUpdate = useCallback(
    async (jobId, newStatus) => {
      const check = await checkSingleImmutable(jobId)
      if (check.immutable) {
        toast.error(check.reason || "Job is delivered with POD submitted—cannot update.")
        return
      }

      if (!window.confirm(`Mark this job as ${newStatus.toUpperCase().replace("_", " ")}?`)) return

      try {
        await driverApi.updateJobStatus(jobId, newStatus)
        toast.success(`Job status updated to ${newStatus.toUpperCase().replace("_", " ")}`)
        setJobs((prev) =>
          prev.map((job) =>
            job.id === jobId ? { ...job, status: newStatus, updated_at: new Date().toISOString() } : job,
          ),
        )
        if (onStatusUpdate) onStatusUpdate()
      } catch (error) {
        toast.error("Failed to update job status")
        console.error("[DeliveryStatusUpdates] Single status update error:", error)
      }
    },
    [checkSingleImmutable, onStatusUpdate],
  )

  const getNextStatus = (currentStatus) => {
    switch (currentStatus) {
      case "assigned":
        return "picked_up"
      case "picked_up":
        return "at_hub"
      case "at_hub":
        return "in_transit"
      case "in_transit":
        return "delivered"
      default:
        return null
    }
  }

  const getStatusColor = (status) => {
    switch (status) {
      case "assigned":
        return "bg-blue-500/10 text-blue-600 border-blue-500/20"
      case "picked_up":
        return "bg-yellow-500/10 text-yellow-600 border-yellow-500/20"
      case "at_hub":
        return "bg-purple-500/10 text-purple-600 border-purple-500/20"
      case "in_transit":
        return "bg-primary/10 text-primary border-primary/20"
      case "delivered":
        return "bg-green-500/10 text-green-600 border-green-500/20"
      default:
        return "bg-muted text-muted-foreground border-border"
    }
  }

  const getStatusLabel = (status) => {
    return status?.replace("_", " ").toUpperCase() || "UNKNOWN"
  }

  const handleMarkDeliveredClick = useCallback(
    (e, job) => {
      e.stopPropagation()
      onJobClick(job)
    },
    [onJobClick],
  )

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-sans font-bold text-foreground">Jobs</h2>
          <p className="text-muted-foreground">Manage your delivery assignments and track progress</p>
        </div>
        {selectedJobs.length > 0 && (
          <div className="relative">
            <button
              onClick={async () => {
                await checkAllSelectedImmutable()
                setBulkActionOpen(!bulkActionOpen)
              }}
              disabled={isCheckingImmutable}
              className="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-lg font-medium hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Bulk Actions ({updatableJobs.length}/{selectedJobs.length})
              {skippedCount > 0 && <AlertTriangle className="h-4 w-4 text-destructive" />}
              <MoreVertical className="h-4 w-4" />
            </button>
            {bulkActionOpen && (
              <div className="absolute right-0 mt-2 w-48 bg-card border border-border rounded-lg shadow-lg py-2 z-10">
                {skippedCount > 0 && (
                  <div className="px-4 py-2 text-xs text-destructive bg-destructive/5 rounded-t-lg">
                    Skipping {skippedCount} delivered jobs (POD submitted)
                  </div>
                )}
                <button
                  onClick={() => handleBulkStatusUpdate("picked_up")}
                  className="w-full text-left px-4 py-2 hover:bg-muted transition-colors text-foreground"
                >
                  Mark as Picked Up
                </button>
                <button
                  onClick={() => handleBulkStatusUpdate("at_hub")}
                  className="w-full text-left px-4 py-2 hover:bg-muted transition-colors text-foreground"
                >
                  Mark as At Hub
                </button>
                <button
                  onClick={() => handleBulkStatusUpdate("in_transit")}
                  className="w-full text-left px-4 py-2 hover:bg-muted transition-colors text-foreground"
                >
                  Mark as In Transit
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
            <option value="at_hub">At Hub</option>
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
        <button onClick={handleSelectAll} className="p-1 hover:bg-muted rounded">
          {selectedJobs.length === filteredJobs.length ? (
            <CheckSquare className="h-4 w-4 text-primary" />
          ) : (
            <Square className="h-4 w-4 text-muted-foreground" />
          )}
        </button>
        <span className="text-sm text-muted-foreground">Select All ({filteredJobs.length})</span>
        {isCheckingImmutable && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground ml-2" />}
      </div>

      {/* Jobs List */}
      <div className="space-y-4">
        {filteredJobs.length > 0 ? (
          filteredJobs.map((job) => {
            const check = immutableChecks[job.id]
            const isImmutable = check?.immutable
            const nextStatus = getNextStatus(job.status)
            const canUpdate = nextStatus && !isImmutable

            return (
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
                          e.stopPropagation()
                          handleJobSelect(job.id)
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
                        <h3 className="font-sans font-semibold text-foreground">Job #{job.id.slice(-6)}</h3>
                        <p className="text-xs text-muted-foreground">{new Date(job.created_at).toLocaleTimeString()}</p>
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
                        className={`px-3 py-1 rounded-full text-xs font-medium border ${getStatusColor(job.status)}`}
                      >
                        {getStatusLabel(job.status)}
                        {isImmutable && (
                          <Lock className="h-3 w-3 inline ml-1 text-destructive" title="Immutable - POD Submitted" />
                        )}
                      </span>
                      {/* <span className="text-sm font-medium text-foreground">
                        KES {job.driver_fee?.toLocaleString()}
                      </span> */}
                    </div>
                  </div>

                  <div className="space-y-4 mb-4">
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 bg-green-500/20 rounded-full flex items-center justify-center">
                          <MapPin className="h-3 w-3 text-green-500" />
                        </div>
                        <span className="text-sm font-medium text-foreground">Pickup</span>
                      </div>
                      <p className="text-sm text-muted-foreground ml-8">{formatAddress(job.pickup_address)}</p>
                      {job.customer?.phone && (
                        <p className="text-sm text-muted-foreground ml-8">
                          Contact: {job.customer.phone}
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              window.location.href = `tel:${job.customer.phone}`
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
                        <span className="text-sm font-medium text-foreground">Delivery</span>
                      </div>
                      <p className="text-sm text-muted-foreground ml-8">{formatAddress(job.dropoff_address)}</p>
                      {job.receiver_phone && (
                        <p className="text-sm text-muted-foreground ml-8">
                          Receiver Contact: {job.receiver_phone}
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              window.location.href = `tel:${job.receiver_phone}`
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
                      <span className="text-sm font-medium text-foreground">Package Details</span>
                      {job.quote?.fragile && (
                        <span className="text-xs text-red-500 font-medium" title="Handle with care">
                          Fragile
                        </span>
                      )}
                      {job.quote?.service_type?.name && (
                        <span className="text-xs text-blue-500 font-medium ml-2">{job.quote.service_type.name}</span>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground ml-8">
                      Weight: {job.quote?.weight_kg || "N/A"} kg, Dimensions: {formatDimensions(job.quote?.dimensions)}
                    </p>
                    {(job.notes || job.quote?.meta?.special_instructions) && (
                      <div className="flex items-center gap-2 ml-8">
                        <FileText className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm text-muted-foreground truncate max-w-[300px]">
                          {job.notes || job.quote?.meta?.special_instructions}
                        </span>
                        {(job.notes || job.quote?.meta?.special_instructions)?.length > 50 && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              toast(job.notes || job.quote?.meta?.special_instructions, { duration: 5000 })
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
                      <span className="text-sm text-foreground">{job.customer?.name || job.guest_email || "N/A"}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Clock className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm text-muted-foreground">{job.estimated_duration || "N/A"} min</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Package className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm text-muted-foreground">{job.bookings?.length || 1} package(s)</span>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2 pt-2">
                    {nextStatus && (
                      <button
                        onClick={async (e) => {
                          e.stopPropagation()
                          if (
                            job.status === "in_transit" ||
                            (job.status === "picked_up" && job.route?.leg_type === "pickup")
                          ) {
                            handleMarkDeliveredClick(e, job)
                          } else {
                            await handleSingleStatusUpdate(job.id, nextStatus)
                          }
                        }}
                        disabled={!canUpdate}
                        className="px-3 py-1 bg-primary text-primary-foreground text-sm rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        title={isImmutable ? "Status locked - POD submitted" : undefined}
                      >
                        {job.status === "assigned" && "Mark Picked Up"}
                        {job.status === "picked_up" && job.route?.leg_type === "pickup" && "Mark At Hub"}
                        {job.status === "at_hub" && job.route?.leg_type !== "pickup" && "Start Transit"}
                        {job.status === "in_transit" && "Mark Delivered"}
                        {isImmutable && " (Locked)"}
                      </button>
                    )}
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        if (job.customer?.phone) {
                          window.location.href = `tel:${job.customer.phone}`
                        } else {
                          toast.error("No customer phone number available")
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
            )
          })
        ) : (
          <p className="text-muted-foreground">No jobs found.</p>
        )}
      </div>

      {statusFilter === "all" && (
        <>
          {isLoadingMore && (
            <div className="flex items-center justify-center py-6">
              <Loader2 className="h-6 w-6 animate-spin text-primary mr-2" />
              <span className="text-muted-foreground">Loading more jobs...</span>
            </div>
          )}

          {!hasMoreJobs && jobs.length > 0 && (
            <div className="text-center py-6">
              <p className="text-muted-foreground">No more jobs to load</p>
            </div>
          )}

          {/* Observer target element */}
          <div ref={observerTarget} className="h-4" />
        </>
      )}

      {statusFilter !== "all" && totalPages > 1 && (
        <div className="flex items-center justify-between mt-4">
          <button
            onClick={() => {
              const prevPage = Math.max(1, currentPage - 1)
              setCurrentPage(prevPage)
              fetchJobs(prevPage, false)
            }}
            disabled={currentPage === 1}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Previous
          </button>
          <span className="text-muted-foreground">
            Page {currentPage} of {totalPages} ({totalCount} total)
          </span>
          <button
            onClick={() => {
              const nextPage = Math.min(totalPages, currentPage + 1)
              setCurrentPage(nextPage)
              fetchJobs(nextPage, false)
            }}
            disabled={currentPage === totalPages}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Next
          </button>
        </div>
      )}
    </div>
  )
}
