"use client";

/**
 * The driver's job board.
 *
 * WHAT A CARD IS ALLOWED TO SAY
 * -----------------------------
 * A card answers one question: what do I do at THIS door? So it carries the
 * stop's own fixed field set and nothing else —
 *
 *   leg (Collection / Delivery)   which end of the shipment this is
 *   job status                    assigned / picked up / in transit / …
 *   same-day tag                  on BOTH halves of a same-day pair
 *   contact name + phone          the sender at a collection, the receiver at
 *                                 a delivery — never both, never the wrong one
 *   parcel count                  how many pieces to hand over
 *   postcode (bold) + address     the postcode is what a driver navigates by
 *   actions                       advance status, scan label, report an issue
 *
 * Everything else — tracking number, job id, the other end's address, weight,
 * dimensions, service type, route metadata — lives on the detail page. Those
 * fields were on the card and they buried the six that matter under a
 * full-screen block of text per job.
 *
 * The card renders the STOP the driver is at, which is why `stop_address` and
 * `contact_*` come from the server. A same-day booking is one row and two jobs
 * at two different doors; the client cannot tell them apart, and a collection
 * card showing the receiver's name is a parcel handed to a stranger.
 */

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { toast } from "react-hot-toast";
import {
  Package,
  Filter,
  Search,
  AlertTriangle,
  Loader2,
  Lock,
  ChevronLeft,
  ChevronRight,
  AlertCircle,
  RefreshCw,
  Camera,
  User,
  Phone,
  ShieldCheck,
  Zap,
  ChevronRight as ChevronRightIcon,
} from "lucide-react";
import { driverApi } from "../../api/driver-api";
import { QRScannerModal } from "./QRScannerModal";
import { ProofOfDelivery } from "./proof-of-delivery";
import { FailureReportModal } from "./FailureReportModal";
import { publishJobStatus, subscribeJobStatus } from "../../lib/driver-events";
import { openDirections } from "../../lib/map-links";

/**
 * Identity of a job in this list.
 *
 * The STOP, not the booking. A same-day booking is two stops on one route, so a
 * booking-keyed identity gives React two children with the same key — it
 * reconciles them as one element and the collection and the delivery fight over
 * a single card. Falls back to the booking id for standalone jobs, which have
 * no stop.
 */
const jobKey = (job) => job.stop_id || job.id;

/** Slow poll. The floor under the live socket, not the primary path. */
const BACKGROUND_REFRESH_MS = 45000;

/** How long to let live messages settle before re-reading. */
const LIVE_REFRESH_DEBOUNCE_MS = 400;

const STATUS_BADGE = {
  assigned: "bg-info-surface text-info border-info/30",
  picked_up: "bg-warning-surface text-warning border-warning/30",
  at_hub: "bg-purple-100 text-purple-700 border-purple-200",
  in_transit: "bg-info-surface text-info border-info/30",
  delivered: "bg-success-surface text-success border-success/30",
};

const ACTION_LABEL = {
  picked_up: "Mark Picked Up",
  at_hub: "Mark At Hub",
  in_transit: "Start Delivery",
  delivered: "Complete Delivery",
};

export function DeliveryStatusUpdates({
  jobs: initialJobs = [],
  onJobClick,
  onStatusUpdate,
}) {
  const [statusFilter, setStatusFilter] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [jobs, setJobs] = useState(
    Array.isArray(initialJobs) ? initialJobs : [],
  );
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize] = useState(10);
  const [totalCount, setTotalCount] = useState(0);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [hasMoreJobs, setHasMoreJobs] = useState(true);
  const [immutableChecks, setImmutableChecks] = useState({});
  const [showQRScanner, setShowQRScanner] = useState(false);
  const [selectedJobForQR, setSelectedJobForQR] = useState(null);
  const [showProofModal, setShowProofModal] = useState(false);
  const [pendingDeliveryJob, setPendingDeliveryJob] = useState(null);
  const [showFailureModal, setShowFailureModal] = useState(false);
  const [failureJobId, setFailureJobId] = useState(null);
  const [failureJobTitle, setFailureJobTitle] = useState("");
  const [failureType, setFailureType] = useState("delivery");
  const observerTarget = useRef(null);

  // `currentPage` read from inside callbacks that must not be recreated when it
  // changes. A callback that closes over the state value would either be stale
  // or would re-subscribe every effect that depends on it on every page load.
  const currentPageRef = useRef(1);
  useEffect(() => {
    currentPageRef.current = currentPage;
  }, [currentPage]);

  /**
   * Load one page.
   *
   * `page` is ALWAYS the page being fetched, and `currentPage` ALWAYS reflects
   * the highest page currently in `jobs`. The two used to be allowed to
   * disagree, and that is the whole of the "stuck at ten jobs" bug:
   *
   *   1. the driver scrolls, page 2 appends → 20 jobs, currentPage = 2;
   *   2. the 8-second auto-refresh called fetchJobs(1, false), which REPLACED
   *      the list with page 1's ten jobs and left currentPage at 2;
   *   3. the sentinel was on screen again, so the observer fired and asked for
   *      currentPage + 1 = page 3;
   *   4. page 3 of a 15-job list is empty, and `hasMoreJobs = 3 < 2` is false.
   *
   * From there the list was ten jobs, the sentinel was gone, and nothing would
   * ever fetch the other five. Every refresh restarted the same cycle, which is
   * why it read as "the refresh starts all over again".
   *
   * The fix is that the cursor follows the data unconditionally, below.
   */
  const fetchJobs = useCallback(
    async (page, append = false) => {
      try {
        if (append) setIsLoadingMore(true);

        const statusParam = statusFilter !== "all" ? statusFilter : "all";
        const response = await driverApi.getAssignedJobs(
          page,
          pageSize,
          statusParam,
        );

        const newJobs = response.ordered_bookings || [];
        const count = response.count || 0;

        if (append) {
          // Dedupe on the stop. Pages can genuinely overlap: the list is ordered
          // by status priority then updated_at, so a status change between two
          // page fetches shifts every job after it by one position.
          setJobs((prev) => {
            const seen = new Set(prev.map(jobKey));
            return [...prev, ...newJobs.filter((j) => !seen.has(jobKey(j)))];
          });
        } else {
          setJobs(newJobs);
        }

        setTotalCount(count);
        setCurrentPage(page);
        setHasMoreJobs(page < Math.ceil(count / pageSize));
        return true;
      } catch (error) {
        console.error("[DeliveryStatusUpdates] Error fetching jobs:", error);
        toast.error("Failed to fetch jobs");
        if (!append) {
          setJobs([]);
          setTotalCount(0);
          setCurrentPage(page);
          setHasMoreJobs(false);
        }
        return false;
      } finally {
        if (append) setIsLoadingMore(false);
      }
    },
    [statusFilter, pageSize],
  );

  /**
   * Refresh everything the driver has already scrolled to, in place.
   *
   * The old auto-refresh called `fetchJobs(1, false)`, which threw away pages
   * 2..N on every tick — a driver who had scrolled was yanked back to the top
   * ten jobs every 8 seconds while they were reading one. Re-requesting the
   * loaded range keeps both the visible list and the cursor intact.
   *
   * If the list has shrunk (jobs completed), the later pages come back short or
   * empty and the list simply ends there, with `hasMoreJobs` recomputed from
   * the real count each time.
   */
  const refreshLoadedPages = useCallback(async () => {
    const pagesLoaded = Math.max(1, currentPageRef.current);
    const ok = await fetchJobs(1, false);
    if (!ok) return;
    for (let page = 2; page <= pagesLoaded; page += 1) {
      // Sequential on purpose: each append reads the accumulated list, so the
      // dedupe above needs the previous page already in state.
      await fetchJobs(page, true);
    }
  }, [fetchJobs]);

  const checkSingleImmutable = useCallback(
    async (jobId) => {
      const cached = immutableChecks[jobId];
      if (cached !== undefined) return cached;
      const result = await driverApi.checkImmutable(jobId);
      if (result.success) {
        const value = { immutable: result.immutable, reason: result.reason };
        setImmutableChecks((prev) => ({ ...prev, [jobId]: value }));
        return value;
      }
      return { immutable: false };
    },
    [immutableChecks],
  );

  // First load, and a full reset whenever the driver changes the status filter.
  //
  // `onStatusUpdate` used to be in this dependency list. It is an inline arrow
  // in DriverDashboard, so it had a new identity on every parent render — this
  // effect therefore blanked `jobs` and refetched page 1 whenever anything at
  // all re-rendered the dashboard. That is the second half of the "it keeps
  // starting over" report, and it is not fixed by anything in fetchJobs.
  useEffect(() => {
    setJobs([]);
    setCurrentPage(1);
    setHasMoreJobs(true);
    fetchJobs(1, false);
  }, [statusFilter, fetchJobs]);

  // LIVE: a status change on this driver's board arrives on the WebSocket.
  //
  // Debounced because one action can produce several messages in a burst (a
  // same-day collection closes a stop and re-plans the route), and because a
  // refresh of N loaded pages is N requests. One re-read per settled burst.
  useEffect(() => {
    let timer = null;
    const unsubscribe = subscribeJobStatus(() => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        timer = null;
        refreshLoadedPages();
      }, LIVE_REFRESH_DEBOUNCE_MS);
    });
    return () => {
      if (timer) clearTimeout(timer);
      unsubscribe();
    };
  }, [refreshLoadedPages]);

  // The floor under the socket. Was every 8 seconds and reset the list each
  // time; the socket now carries the urgent case, so this only has to catch
  // changes made somewhere the broadcast could not reach (an admin edit while
  // the socket was down).
  useEffect(() => {
    const interval = setInterval(refreshLoadedPages, BACKGROUND_REFRESH_MS);
    return () => clearInterval(interval);
  }, [refreshLoadedPages]);

  // Infinite scroll. Only on the unfiltered board — a status filter gets real
  // pagination controls instead, because "load more" over a filter that the
  // driver's own actions keep changing is disorienting.
  useEffect(() => {
    if (statusFilter !== "all") return undefined;

    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries[0].isIntersecting) return;
        if (!hasMoreJobs || isLoadingMore) return;
        fetchJobs(currentPageRef.current + 1, true);
      },
      { root: null, rootMargin: "200px", threshold: 0 },
    );

    const target = observerTarget.current;
    if (target) observer.observe(target);
    return () => {
      if (target) observer.unobserve(target);
    };
  }, [statusFilter, hasMoreJobs, isLoadingMore, fetchJobs]);

  const totalPages = Math.ceil(totalCount / pageSize);

  const formatAddress = useCallback((addr) => {
    if (typeof addr === "string") return addr;
    if (typeof addr === "object" && addr !== null) {
      return [addr.line1, addr.line2, addr.city, addr.region]
        .filter(Boolean)
        .join(", ");
    }
    return "";
  }, []);

  const isUrgentPickup = useCallback((scheduledPickupAt) => {
    if (!scheduledPickupAt) return false;
    const diffMinutes =
      (new Date(scheduledPickupAt) - new Date()) / (1000 * 60);
    return diffMinutes <= 30 && diffMinutes >= 0;
  }, []);

  // Search covers what the card actually shows: the contact and the address the
  // driver is being sent to. Searching fields the card hides returns matches the
  // driver cannot see the reason for.
  const filteredJobs = useMemo(() => {
    const needle = searchTerm.trim().toLowerCase();
    if (!needle) return jobs;
    return jobs.filter((job) => {
      const haystack = [
        job.contact_name,
        job.contact_phone,
        job.stop_address?.postal_code,
        formatAddress(job.stop_address),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(needle);
    });
  }, [jobs, searchTerm, formatAddress]);

  /**
   * Where this job goes next.
   *
   * C8: PREFER THE SERVER'S ANSWER. The chain below is wrong for same-day: it
   * sends every `picked_up` booking to `at_hub`, so a driver collecting a
   * same-day parcel was offered "Mark At Hub", the app posted `at_hub`, and the
   * parcel went to a depot the customer had paid for it to skip.
   *
   * The client cannot compute this. The correct answer depends on whether the
   * booking has an OPEN DELIVERY STOP on this driver's route, which only the
   * backend can see. The chain stays only as a fallback for a stale cached
   * response from before the field existed.
   */
  const getNextStatus = (job) => {
    if (job && job.next_status !== undefined) return job.next_status;
    switch (job?.status) {
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

  const handleSingleStatusUpdate = useCallback(
    async (jobId, newStatus) => {
      const check = await checkSingleImmutable(jobId);
      if (check.immutable) {
        toast.error(check.reason || "Job is locked — cannot update.");
        return;
      }

      // Delivered is never a bare status flip: the backend rejects it without a
      // proof of delivery on file (POD_REQUIRED), so go straight to capture.
      if (newStatus === "delivered") {
        setPendingDeliveryJob(jobId);
        setShowProofModal(true);
        return;
      }

      // NO CONFIRMATION DIALOG.
      //
      // This used to raise `window.confirm("Mark this job as Mark Picked
      // Up?")`. A driver standing at a door with a parcel in one hand taps the
      // only button on the card and then has to dismiss a modal to make the tap
      // count. It guarded nothing — the transition is recoverable through the
      // issue-report flow beside it — and a native dialog blocks the entire
      // page while it is open, including the live socket's re-render.
      //
      // `delivered` never reached here anyway: it returns above, into proof
      // capture, because the backend rejects it without a POD on file. That
      // remains the one action with a step in front of it, and it is a step
      // that does real work rather than asking "are you sure".
      try {
        const result = await driverApi.updateJobStatus(jobId, newStatus);

        if (result?.queued) {
          toast("Saved offline — will sync once you're back online", {
            icon: "📶",
          });
          // Offline: no broadcast is coming, so reflect it locally and stop.
          setJobs((prev) =>
            prev.map((job) =>
              job.id === jobId ? { ...job, status: newStatus } : job,
            ),
          );
        } else {
          toast.success(`Job marked ${newStatus.replace("_", " ")}`);
          // The floor under the socket: announce our own write so the board
          // re-reads even if the broadcast never arrives.
          publishJobStatus({
            booking_id: jobId,
            status: newStatus,
            reason: "local",
          });
        }

        if (onStatusUpdate) onStatusUpdate();
      } catch (error) {
        console.error(
          "[DeliveryStatusUpdates] Single status update error:",
          error,
        );
        toast.error("Failed to update job status");
        await refreshLoadedPages();
      }
    },
    [checkSingleImmutable, onStatusUpdate, refreshLoadedPages],
  );

  const handleManualRefresh = useCallback(async () => {
    setIsRefreshing(true);
    toast.loading("Refreshing jobs...", { id: "refresh-toast" });
    try {
      await refreshLoadedPages();
      toast.success("Jobs refreshed", { id: "refresh-toast" });
    } finally {
      setIsRefreshing(false);
    }
  }, [refreshLoadedPages]);

  /**
   * Label scanned.
   *
   * The backend marks the booking PICKED_UP through the state machine and
   * broadcasts the change to this driver's socket, so the card updates itself.
   * `publishJobStatus` here is the floor: if the socket is down or reconnecting,
   * the driver still sees their own scan land immediately.
   */
  const handleQRScanSuccess = useCallback(
    async (qrContent) => {
      try {
        const result = await driverApi.scanQr(qrContent);
        if (result.success) {
          toast.success("Label scanned — job picked up");
          setShowQRScanner(false);
          setSelectedJobForQR(null);
          publishJobStatus({
            booking_id: result.data?.booking_id,
            status: result.data?.new_status || "picked_up",
            reason: "scan",
          });
          if (onStatusUpdate) onStatusUpdate();
        } else {
          toast.error(
            result.message || "Scan failed. Update the status manually.",
          );
        }
      } catch (error) {
        console.error("[DeliveryStatusUpdates] QR scan error:", error);
        toast.error("QR scan failed. Please try again.");
      }
    },
    [onStatusUpdate],
  );

  const handleProofOfDeliverySubmit = useCallback(
    async (proofData) => {
      const jobId = pendingDeliveryJob;
      try {
        // One call: submits the proof AND moves the booking to delivered.
        const result = await driverApi.submitProofOfDelivery(jobId, proofData);
        if (!result.success)
          throw new Error(result.message || "Failed to submit proof");

        setShowProofModal(false);
        setPendingDeliveryJob(null);
        // Drop the card right away rather than waiting for the network round
        // trip — the driver is standing at the door and the job is done.
        setJobs((prev) => prev.filter((job) => job.id !== jobId));

        if (result.queued) {
          toast("Saved offline — proof will sync automatically", {
            icon: "📶",
          });
        } else {
          toast.success("Delivery completed");
          publishJobStatus({
            booking_id: jobId,
            status: "delivered",
            reason: "pod",
          });
        }
        if (onStatusUpdate) onStatusUpdate();
      } catch (error) {
        console.error("[DeliveryStatusUpdates] Proof submission error:", error);
        toast.error(error.message || "Failed to complete delivery");
      }
    },
    [pendingDeliveryJob, onStatusUpdate],
  );

  const openFailureReport = useCallback((job, type) => {
    setFailureJobId(job.id);
    setFailureJobTitle(
      job.job_number != null
        ? `Job ${job.job_number}`
        : job.tracking_number || "this job",
    );
    setFailureType(type);
    setShowFailureModal(true);
  }, []);

  const handlePageChange = (page) => {
    if (page < 1 || page > totalPages) return;
    fetchJobs(page, false);
  };

  return (
    <div className="min-h-screen bg-muted dark:bg-background">
      {/* Header */}
      <div className="sticky top-0 z-20 bg-card/95 backdrop-blur border-b border-border">
        <div className="max-w-3xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h1 className="text-xl font-bold text-foreground">
                My Jobs
              </h1>
              <p className="text-xs text-subtle-foreground dark:text-muted-foreground mt-0.5">
                {filteredJobs.length} of {totalCount} shown
              </p>
            </div>
            <button
              onClick={handleManualRefresh}
              disabled={isRefreshing}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-card text-foreground text-sm font-semibold disabled:opacity-60 active:scale-95 transition"
            >
              <RefreshCw
                className={`h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`}
              />
              Refresh
            </button>
          </div>

          {/* Search + filter */}
          <div className="flex gap-2 mt-3">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search postcode, name, phone..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-3 py-2.5 rounded-xl bg-muted dark:bg-surface border border-transparent focus:border-border-strong dark:focus:border-border text-sm text-foreground placeholder-subtle-foreground focus:outline-none"
              />
            </div>
            <div className="relative">
              <Filter className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                aria-label="Filter by status"
                className="pl-9 pr-8 py-2.5 rounded-xl bg-muted dark:bg-surface border border-transparent text-sm font-medium text-foreground appearance-none focus:outline-none"
              >
                <option value="all">All</option>
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

      {/* Job cards */}
      <div className="max-w-3xl mx-auto px-4 py-4">
        {filteredJobs.length > 0 ? (
          <div className="space-y-3">
            {filteredJobs.map((job) => {
              const isDelivery = (job.stop_leg || job.leg) === "delivery";
              const isImmutable = immutableChecks[job.id]?.immutable;
              const nextStatus = getNextStatus(job);
              const canUpdate = nextStatus && !isImmutable;
              // A delivery stop whose parcel has not been collected yet. The
              // server names the job that has to happen first; without it this
              // card fell through to "Completed" and told the driver a job they
              // had not started was already done.
              const blockedReason =
                !canUpdate && !isImmutable ? job.blocked_reason : null;
              const address = job.stop_address;
              const postcode = address?.postal_code || "";
                const addrLat = address?.latitude ?? address?.lat ?? address?.location?.lat ?? null;
                const addrLng = address?.longitude ?? address?.lng ?? address?.location?.lng ?? null;
              const urgent =
                !isDelivery && isUrgentPickup(job.scheduled_pickup_at);
              const parcels = job.num_parcels || 1;

              return (
                <div
                  key={jobKey(job)}
                  className={`bg-card rounded-2xl border-l-4 border border-border overflow-hidden shadow-sm ${
                    isDelivery ? "border-l-emerald-500" : "border-l-sky-500"
                  }`}
                >
                  {/* Tap the body to open the details; the action row below
                      stops propagation so a mis-tap never fires an action. */}
                  <button
                    type="button"
                    onClick={() => onJobClick && onJobClick(job)}
                    className="w-full text-left p-4 active:bg-muted dark:active:bg-surface/60 transition"
                  >
                    {/* Job number: its own fixed column, OUTSIDE the tag row.
                        It used to be the last child of that row with `ml-auto`,
                        and the row is `flex-wrap` — so on a card carrying four
                        tags (Delivery + status + Same Day + Urgent) the number
                        wrapped onto a second line and landed under a different
                        tag on every card. A driver following a sequence had to
                        hunt for the number on each one.

                        Fixed width and tabular numerals so #7 and #17 occupy
                        the same box and the digits line up vertically down the
                        list, which is what makes the sequence scannable. */}
                    <div className="flex items-start gap-3 mb-3">
                      <div className="flex-shrink-0 w-14 text-center">
                        {job.job_number != null ? (
                          <>
                            <div className="text-[10px] uppercase tracking-wide font-semibold text-muted-foreground dark:text-subtle-foreground leading-none">
                              Job
                            </div>
                            <div className="text-2xl font-extrabold tabular-nums leading-tight text-foreground">
                              {job.job_number}
                            </div>
                          </>
                        ) : job.stop_id ? (
                          // On a route, but no number: a booking dispatch added
                          // AFTER this route was under way. It is deliberately
                          // unnumbered so the sequence the driver is already
                          // working to stays ascending and unchanged — see
                          // RouteStopService.plan_policy, under INSERT *or*
                          // FROZEN (route_stops.py:741 numbers only under FREE).
                          // This said "(INSERT)" alone, which understated it:
                          // absorption appends to a live route under FROZEN and
                          // lands here too. "NEW" rather
                          // than a dash because the two say different things:
                          // this job HAS a position in the list, it just has no
                          // permanent label.
                          <>
                            <div className="text-[10px] uppercase tracking-wide font-semibold text-muted-foreground dark:text-subtle-foreground leading-none">
                              Job
                            </div>
                            <div className="text-sm font-extrabold leading-tight tracking-tight text-brand-text pt-1.5">
                              NEW
                            </div>
                          </>
                        ) : (
                          // Not on a route at all — a standalone job has no stop
                          // and therefore no route position to label.
                          <div className="text-2xl font-extrabold tabular-nums leading-tight text-muted-foreground">
                            –
                          </div>
                        )}
                      </div>

                      {/* Tag row: leg, status, same-day, urgent. Wraps freely
                          now without dragging the job number around with it. */}
                      <div className="flex flex-wrap items-center gap-1.5 min-w-0 flex-1">
                        <span
                          className={`inline-flex items-center px-2.5 py-1 rounded-lg text-[11px] font-bold uppercase tracking-wide ${
                            isDelivery
                              ? "bg-success-surface text-success"
                              : "bg-info-surface text-info"
                          }`}
                        >
                          {isDelivery ? "Delivery" : "Collection"}
                        </span>
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border text-[11px] font-bold uppercase tracking-wide ${
                            STATUS_BADGE[job.status] ||
                            "bg-muted text-muted-foreground border-border"
                          }`}
                        >
                          {(job.status || "unknown").replace("_", " ")}
                          {isImmutable && <Lock className="h-3 w-3" />}
                        </span>
                        {/* Same-day tag, on BOTH halves of the pair — a driver
                          holding a same-day parcel must not route it via the
                          hub, and the delivery card is where that gets decided
                          just as often as the collection card. */}
                        {job.is_same_day && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold uppercase tracking-wide bg-brand-surface text-brand-text">
                            <Zap className="h-3 w-3" />
                            Same Day
                          </span>
                        )}
                        {urgent && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold uppercase tracking-wide bg-destructive-surface text-destructive">
                            <AlertCircle className="h-3 w-3" />
                            Urgent
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Postcode first, big and bold — it is what a driver
                        navigates by and what they read at speed. The full
                        address sits under it for the last hundred metres. */}
                    <div className="mb-3">
                      <div className="flex items-baseline gap-2">
                        {/* Postcode clickable: open native Google Maps directions. Stop propagation so
                            the card's onClick (open details) does not fire when the postcode is tapped. */}
                        {postcode ? (
                          <span
                            role="link"
                            tabIndex={0}
                            onClick={(e) => {
                              e.stopPropagation();
                              try {
                                openDirections({ postcode, lat: addrLat, lng: addrLng, label: postcode });
                              } catch (err) {
                                const url = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(postcode)}`;
                                window.open(url, "_blank", "noopener,noreferrer");
                              }
                            }}
                            onKeyDown={(e) => {
                              if (e.key === "Enter" || e.key === " ") {
                                e.preventDefault();
                                e.stopPropagation();
                                try {
                                  openDirections({ postcode, lat: addrLat, lng: addrLng, label: postcode });
                                } catch (err) {
                                  const url = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(postcode)}`;
                                  window.open(url, "_blank", "noopener,noreferrer");
                                }
                              }
                            }}
                            className="text-2xl font-extrabold tracking-tight text-foreground underline-offset-2 hover:underline cursor-pointer"
                          >
                            {postcode}
                          </span>
                        ) : (
                          <span className="text-2xl font-extrabold tracking-tight text-foreground">No postcode</span>
                        )}
                        <ChevronRightIcon className="h-4 w-4 text-muted-foreground" />
                      </div>
                      <p className="text-sm text-muted-foreground mt-0.5 leading-snug">
                        {formatAddress(address) || "Address unavailable"}
                      </p>
                    </div>

                    {/* Contact + parcels */}
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="text-[11px] uppercase tracking-wide font-semibold text-muted-foreground dark:text-subtle-foreground">
                          {isDelivery ? "Receiver" : "Sender"}
                        </p>
                        <p className="text-sm font-semibold text-foreground flex items-center gap-1.5 truncate">
                          <User className="h-3.5 w-3.5 flex-shrink-0 text-muted-foreground" />
                          {job.contact_name || "Not provided"}
                        </p>
                        {/* The NUMBER, not just a call icon.
                            The card carried a green call button and nothing
                            else, so the digits existed in the payload but were
                            unreadable — a driver could not check they were
                            about to ring the right person, read it out, or use
                            it at all without tapping through. Rendered as text
                            here and left tappable in the action row below. */}
                        <p className="text-sm font-semibold text-muted-foreground dark:text-foreground flex items-center gap-1.5 mt-0.5 tabular-nums">
                          <Phone className="h-3.5 w-3.5 flex-shrink-0 text-muted-foreground" />
                          {job.contact_phone || (
                            <span className="font-medium text-muted-foreground dark:text-subtle-foreground">
                              No phone number
                            </span>
                          )}
                        </p>
                      </div>
                      <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-muted dark:bg-surface text-sm font-bold text-muted-foreground dark:text-foreground flex-shrink-0">
                        <Package className="h-4 w-4" />
                        {parcels}
                        <span className="font-medium text-subtle-foreground dark:text-muted-foreground">
                          {parcels === 1 ? "parcel" : "parcels"}
                        </span>
                      </span>
                    </div>

                    {/* Leave-safe authorisation.
                        Without this on the card the only way to learn the
                        customer had authorised a safe-spot drop was to open the
                        details modal — which a driver at an unanswered door
                        does not do. They knock, wait, and mark it failed for a
                        delivery they were allowed to complete.

                        Amber and full-width because it CHANGES THE JOB: it is
                        an instruction, not a detail, and it has to survive being
                        read at arm's length in the rain. */}
                    {job.leave_safe_spot && (
                      <div className="mt-3 flex items-start gap-2 rounded-xl border border-warning/30 bg-warning-surface px-3 py-2">
                        <ShieldCheck className="h-4 w-4 flex-shrink-0 mt-0.5 text-warning" />
                        <div className="min-w-0">
                          <p className="text-[11px] uppercase tracking-wide font-bold text-warning leading-none">
                            Leave safe authorised
                          </p>
                          <p className="text-sm font-semibold text-warning mt-1 leading-snug">
                            {job.safe_spot_location?.trim()
                              ? job.safe_spot_location
                              : "No spot given — leave in a safe place and photograph it."}
                          </p>
                        </div>
                      </div>
                    )}
                  </button>

                  {/* Actions */}
                  <div className="flex items-stretch gap-2 px-4 pb-4">
                    {/* Tap-to-call. Rendered only when there is a number to
                        dial — a call button that does nothing is worse at a
                        door than no call button. */}
                    {job.contact_phone ? (
                      <a
                        href={`tel:${job.contact_phone.replace(/[^\d+]/g, "")}`}
                        aria-label={`Call ${job.contact_name || "contact"}`}
                        className="flex items-center justify-center w-12 rounded-xl bg-success hover:bg-success text-success-foreground active:scale-95 transition flex-shrink-0"
                      >
                        <Phone className="h-5 w-5" />
                      </a>
                    ) : null}

                    {/* Scan Label: a collection action, so it is suppressed on a
                        blocked delivery stop. The booking there IS `assigned`,
                        but scanning is the wrong half of a same-day pair. */}
                    {job.status === "assigned" &&
                      !isImmutable &&
                      !blockedReason && (
                        <button
                          onClick={() => {
                            setSelectedJobForQR(job);
                            setShowQRScanner(true);
                          }}
                          className="flex items-center justify-center w-12 rounded-xl bg-card text-foreground active:scale-95 transition flex-shrink-0"
                          aria-label="Scan label"
                          title="Scan label"
                        >
                          <Camera className="h-5 w-5" />
                        </button>
                      )}

                    {canUpdate ? (
                      <button
                        onClick={() =>
                          handleSingleStatusUpdate(job.id, nextStatus)
                        }
                        className="flex-1 px-4 py-3 rounded-xl bg-primary-hover hover:bg-primary-hover text-primary-foreground font-bold text-sm active:scale-95 transition"
                      >
                        {ACTION_LABEL[nextStatus] || "Update"}
                      </button>
                    ) : isImmutable ? (
                      <div className="flex-1 px-4 py-3 rounded-xl bg-muted dark:bg-surface text-subtle-foreground dark:text-muted-foreground font-bold text-sm text-center flex items-center justify-center gap-2">
                        <Lock className="h-4 w-4" />
                        Locked
                      </div>
                    ) : blockedReason ? (
                      <div className="flex-1 px-4 py-3 rounded-xl bg-warning-surface text-warning font-semibold text-sm text-center flex items-center justify-center gap-2">
                        <Lock className="h-4 w-4 flex-shrink-0" />
                        {blockedReason}
                      </div>
                    ) : (
                      <div className="flex-1 px-4 py-3 rounded-xl bg-success-surface text-success font-bold text-sm text-center">
                        ✓ Completed
                      </div>
                    )}

                    {/* Report an issue. Available on every job the driver can
                        still act on: a failure can happen at a collection or a
                        delivery, and the old card only offered it at two
                        specific statuses. */}
                    {!isImmutable && nextStatus && (
                      <button
                        onClick={() =>
                          openFailureReport(
                            job,
                            isDelivery ? "delivery" : "pickup",
                          )
                        }
                        className="flex items-center justify-center w-12 rounded-xl bg-warning hover:bg-warning text-warning-foreground active:scale-95 transition flex-shrink-0"
                        aria-label={
                          isDelivery
                            ? "Report delivery issue"
                            : "Report pickup issue"
                        }
                        title="Report an issue"
                      >
                        <AlertTriangle className="h-5 w-5" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-20">
            <Package className="h-14 w-14 text-muted-foreground mx-auto mb-3" />
            <p className="text-base font-bold text-foreground">
              No jobs found
            </p>
            <p className="text-sm text-subtle-foreground dark:text-muted-foreground mt-1">
              {searchTerm
                ? "Try a different search"
                : "Nothing assigned right now"}
            </p>
          </div>
        )}

        {/* Pagination for a filtered board */}
        {statusFilter !== "all" && totalPages > 1 && (
          <div className="mt-6 flex items-center justify-center gap-3">
            <button
              onClick={() => handlePageChange(currentPage - 1)}
              disabled={currentPage === 1}
              className="p-2.5 rounded-xl bg-card border border-border disabled:opacity-40 active:scale-95 transition"
              aria-label="Previous page"
            >
              <ChevronLeft className="h-5 w-5 text-muted-foreground" />
            </button>
            <span className="text-sm font-semibold text-muted-foreground dark:text-foreground">
              Page {currentPage} of {totalPages}
            </span>
            <button
              onClick={() => handlePageChange(currentPage + 1)}
              disabled={currentPage === totalPages}
              className="p-2.5 rounded-xl bg-card border border-border disabled:opacity-40 active:scale-95 transition"
              aria-label="Next page"
            >
              <ChevronRight className="h-5 w-5 text-muted-foreground" />
            </button>
          </div>
        )}

        {/* Infinite-scroll sentinel. Rendered whenever there is more to load, so
            the observer always has something to watch; it disappears only when
            the real count says the list is complete. */}
        {statusFilter === "all" && hasMoreJobs && (
          <div ref={observerTarget} className="mt-6 py-6 flex justify-center">
            <div className="flex items-center gap-2 text-sm text-subtle-foreground dark:text-muted-foreground">
              <Loader2
                className={`h-4 w-4 text-brand-text ${isLoadingMore ? "animate-spin" : "opacity-40"}`}
              />
              {isLoadingMore
                ? "Loading more..."
                : `${totalCount - jobs.length} more`}
            </div>
          </div>
        )}

        {statusFilter === "all" && !hasMoreJobs && jobs.length > 0 && (
          <p className="mt-6 py-4 text-center text-xs font-medium text-muted-foreground">
            All {totalCount} jobs loaded
          </p>
        )}
      </div>

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

      {showProofModal && (
        <ProofOfDelivery
          jobId={pendingDeliveryJob}
          onClose={() => {
            setShowProofModal(false);
            setPendingDeliveryJob(null);
          }}
          onSubmit={handleProofOfDeliverySubmit}
        />
      )}

      <FailureReportModal
        isOpen={showFailureModal}
        jobId={failureJobId}
        jobTitle={failureJobTitle}
        failureType={failureType}
        onClose={() => {
          setShowFailureModal(false);
          setFailureJobId(null);
          setFailureJobTitle("");
          setFailureType("delivery");
        }}
        onSuccess={() => {
          refreshLoadedPages();
          if (onStatusUpdate) onStatusUpdate();
        }}
      />
    </div>
  );
}
