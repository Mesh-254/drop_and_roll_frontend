"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { toast } from "react-hot-toast";
import { useNavigate } from "react-router-dom";
import {
  Menu,
  X,
  Home,
  Briefcase,
  DollarSign,
  FileText,
  User,
  Bell,
  Search,
  Package,
  Clock,
  Star,
  MapPin,
  LogOut,
  Upload,
  CheckCircle,
  Eye,
  AlertCircle,
  Activity,
} from "lucide-react";
import { PerformanceMetrics } from "./performance-metrics";
import { ActiveJobsOverviewCard } from "./active-jobs-overview-card";
// EarningsChart import removed — earnings feature disabled for now. Re-add this
// import (and the render/fetch/state below) to restore. getEarnings() is left
// intact in driver-api.js for that re-enablement.
import { DeliveryStatusUpdates } from "./delivery-status-updates";
import { JobDetailPage } from "./job-detail-page";
import { OfflineStatusBar } from "./offline/OfflineStatusBar";
import * as syncEngine from "../../offline/syncEngine";
import driverApi from "../../api/driver-api";
import { publishJobStatus } from "../../lib/driver-events";

export default function DriverDashboard() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showJobDetail, setShowJobDetail] = useState(false);
  const [selectedJobId, setSelectedJobId] = useState(null);
  // The list row that was tapped, carrying the stop context (leg, job number,
  // next_status, blocked_reason) that the booking detail endpoint cannot supply.
  const [selectedJobStop, setSelectedJobStop] = useState(null);
  const [profile, setProfile] = useState(null);
  const [jobs, setJobs] = useState([]);
  const [documents, setDocuments] = useState([]);
  const [uploading, setUploading] = useState(false);
  // Earnings state removed — earnings feature disabled for now (see fetchData).
  // Re-add `const [earnings, setEarnings] = useState({ today: 0, weekly: 0,
  // monthly: 0, chartData: [], available: 0, pending: 0 })` to restore.
  const [ratings, setRatings] = useState([]);
  const [metrics, setMetrics] = useState({
    // totalDeliveries: 0,
    completedToday: 0,
    earningsToday: 0,
    earningsWeek: 0,
    earningsMonth: 0,
    averageRating: 0,
    pendingPayouts: 0,
    activeJobs: 0,
    totalJobs: 0,
    failedJobs: 0,
    completionRate: 0,
  });
  const [loading, setLoading] = useState(true);

  const [activeTab, setActiveTab] = useState(() => {
    // Load activeTab from localStorage, default to "overview" if not set
    return localStorage.getItem("activeTab") || "overview";
  });

  // Save activeTab to localStorage whenever it changes
  useEffect(() => {
    localStorage.setItem("activeTab", activeTab);
  }, [activeTab]);

  const [isTracking, setIsTracking] = useState(false);
  const [manualTrackingEnabled, setManualTrackingEnabled] = useState(false);
  const [trackingStatus, setTrackingStatus] = useState("idle"); // idle, tracking, error
  const [currentLocation, setCurrentLocation] = useState(null);
  const [geolocationError, setGeolocationError] = useState(null);
  const [toggleLoading, setToggleLoading] = useState(false);
  const routePollIntervalRef = useRef(null);
  const routeCheckTimeRef = useRef(null);

  const wsRef = useRef(null); // New: For per-driver WS
  const pollIntervalRef = useRef(null); // For polling

  // Mirror fast-changing state in refs so the setInterval callback inside
  // startRoutePoll always reads current values instead of the values that
  // were in scope the one time startRoutePoll() was invoked (stale closure).
  const profileRef = useRef(profile);
  const isTrackingRef = useRef(isTracking);
  const manualTrackingEnabledRef = useRef(manualTrackingEnabled);

  useEffect(() => {
    profileRef.current = profile;
  }, [profile]);

  useEffect(() => {
    isTrackingRef.current = isTracking;
  }, [isTracking]);

  useEffect(() => {
    manualTrackingEnabledRef.current = manualTrackingEnabled;
  }, [manualTrackingEnabled]);

  const navigate = useNavigate();

  // Check if driver is logged in
  const isLoggedIn = !!localStorage.getItem("access_token");

  useEffect(() => {
    fetchData();
    startRoutePoll();
    // Starts watching connectivity and flushing the offline queue whenever
    // a connection is available. Cheap to call once per dashboard mount —
    // it's a no-op loop when the queue is empty.
    const stopSyncEngine = syncEngine.init(driverApi);
    // Cleanup on unmount
    return () => {
      stopRoutePoll();
      driverApi.stopLocationTracking();
      stopSyncEngine();
    };
    // fetchData/startRoutePoll/stopRoutePoll are stable (useCallback, no reactive
    // deps) and are intentionally only invoked once on mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // New: Poll profile to detect tracking changes (every 60s)
  useEffect(() => {
    const fetchProfileAndCheckTracking = async () => {
      try {
        const profileData = await driverApi.getProfile();
        if (profileData.success) {
          setProfile(profileData.data);
          const hasRecentLocation = await checkRecentLocation(); // New helper below
          if (
            profileData.data.is_tracking_enabled &&
            hasRecentLocation &&
            !driverApi.locationWatcher
          ) {
            driverApi.startLocationTracking();
            toast.success(
              "Tracking activated - assignments detected and you're online",
            );
          } else if (
            !profileData.data.is_tracking_enabled &&
            driverApi.locationWatcher
          ) {
            driverApi.stopLocationTracking();
            // react-hot-toast has no `.info` — calling it threw a TypeError that
            // the catch below turned into a permanent 10s "Tracking check failed"
            // retry loop. Use the base toast with an icon, as elsewhere here.
            toast("Tracking deactivated", { icon: "📴" });
          }
        }
      } catch (err) {
        console.error("[DriverDashboard] Tracking check failed:", err);
        toast.error("Tracking check failed - retrying...");
        setTimeout(fetchProfileAndCheckTracking, 10000); // Retry on error
      }
    };

    const checkRecentLocation = async () => {
      // Optional: Fetch last location timestamp from API to confirm "online"
      // Or assume if geolocation permission granted
      const permission = await navigator.permissions.query({
        name: "geolocation",
      });
      return permission.state === "granted"; // Simple online check
    };
    
    fetchProfileAndCheckTracking(); // Initial fetch

    // Poll every 60s
    pollIntervalRef.current = setInterval(fetchProfileAndCheckTracking, 60000);

    // Handle visibility (background/foreground)
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        fetchProfileAndCheckTracking(); // Immediate check on focus
      }
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      clearInterval(pollIntervalRef.current);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      // NOTE: the WS is owned and closed by the per-driver WS effect (with code
      // 1000). Closing it here too fired a spurious non-1000 close → reconnect on
      // unmount, so it's intentionally not touched here.
    };
  }, []);

  // Refresh-survival: if the driver was live before a reload, resume tracking on
  // mount without requiring a re-tap. Cleared only on explicit stop/logout, so a
  // plain refresh (unmount → remount) lands here and picks tracking back up.
  useEffect(() => {
    if (!profile?.id) return;
    if (driverApi.isLiveTrackingActive() && !driverApi.locationWatcher) {
      driverApi.startLocationTracking();
      setManualTrackingEnabled(true);
      setTrackingStatus("tracking");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.id]);

  // Per-driver WS (tracking-toggle channel) with a REAL reconnect loop.
  // The old version created a bare socket in onclose but never re-attached its
  // handlers ("// Re-add listeners" was a comment, not code), so after the first
  // drop — e.g. a refresh (code 1006) — the socket was permanently dead. This
  // rebuilds a fully-wired socket, backs off exponentially, pauses while offline,
  // refreshes the token before each attempt, and stays quiet on expected closes.
  useEffect(() => {
    // The WS group is keyed by DriverProfile.id (see /ws/driver/<id>/ consumer),
    // NOT the user id. profile.driver_profile carries that id; without it the
    // handshake is rejected 4003 and reconnects forever, so don't open at all.
    if (!profile?.driver_profile) return;

    let closedByCleanup = false;
    let reconnectTimer = null;
    let attempt = 0;
    const MAX_BACKOFF_MS = 30000;

    const scheduleReconnect = () => {
      if (closedByCleanup) return;
      // Don't stack reconnects while the device is offline — the 'online' event
      // (handleOnline) fires an immediate retry when connectivity returns.
      if (typeof navigator !== "undefined" && navigator.onLine === false) return;
      const delay = Math.min(MAX_BACKOFF_MS, 1000 * 2 ** attempt);
      attempt += 1;
      reconnectTimer = setTimeout(connect, delay);
    };

    async function connect() {
      if (closedByCleanup) return;
      // Refresh the access token first so the handshake never uses a stale one.
      // Shares the axios interceptor's de-duped rotating refresh — no duplicate
      // token logic in the WS layer. If refresh fails the token is truly dead and
      // reconnecting would just 4401-loop, so stop and let the API layer redirect.
      try {
        await driverApi.refreshAccessTokenOnce();
      } catch {
        return;
      }
      if (closedByCleanup) return;

      const ws = new WebSocket(driverApi.driverWsUrl(profile.driver_profile));
      wsRef.current = ws;

      ws.onopen = () => {
        attempt = 0; // reset backoff after a good connection
      };

      ws.onmessage = (event) => {
        let data;
        try {
          data = JSON.parse(event.data);
        } catch {
          return;
        }
        // A booking on this driver's board changed status, server-side. Put it
        // on the bus and stop — the dashboard itself has nothing to do with it,
        // and re-rendering here to deliver it would recreate every callback the
        // job list depends on. The list subscribes and re-reads.
        //
        // The message carries the identity of the change, not the job: what a
        // job looks like on the board depends on its stop, its leg and whether
        // its collection is still open, none of which a socket frame can know.
        if (data.type === "job.status") {
          publishJobStatus(data);
          return;
        }
        if (data.type === "tracking.toggle") {
          if (data.enabled) {
            driverApi.startLocationTracking();
            setManualTrackingEnabled(true);
            toast.success("Tracking enabled via server update");
          } else {
            driverApi.stopLocationTracking();
            driverApi.clearLiveTrackingActive();
            setManualTrackingEnabled(false);
            toast("Tracking disabled via server update", { icon: "📴" });
          }
        }
      };

      ws.onclose = (event) => {
        // Clean/intentional close (unmount, or server code 1000) → no reconnect.
        if (closedByCleanup || event.code === 1000) return;
        // Everything else (1006 refresh/drop, 4401 token-expiry) → reconnect.
        // The token refresh at the top of connect() handles the expiry case.
        scheduleReconnect();
      };

      // The raw WS error Event carries nothing actionable and previously spammed
      // the console; onclose drives reconnect, so swallow it quietly.
      ws.onerror = () => {};
    }

    const handleOnline = () => {
      // Connectivity is back — retry now instead of waiting out the backoff.
      if (reconnectTimer) {
        clearTimeout(reconnectTimer);
        reconnectTimer = null;
      }
      attempt = 0;
      const sock = wsRef.current;
      if (!closedByCleanup && (!sock || sock.readyState > WebSocket.OPEN)) {
        connect();
      }
    };
    window.addEventListener("online", handleOnline);

    connect();

    return () => {
      closedByCleanup = true;
      window.removeEventListener("online", handleOnline);
      if (reconnectTimer) clearTimeout(reconnectTimer);
      if (wsRef.current) {
        try {
          wsRef.current.close(1000, "component unmounted");
        } catch {
          /* noop */
        }
      }
    };
  }, [profile?.driver_profile]);

  const stopRoutePoll = useCallback(() => {
    if (routePollIntervalRef.current) {
      clearInterval(routePollIntervalRef.current);
      routePollIntervalRef.current = null;
    }
  }, []);

  const startRoutePoll = useCallback(() => {
    // Poll for active route every 60 seconds
    routePollIntervalRef.current = setInterval(async () => {
      try {
        // Read latest values via refs (this closure is created once, so plain
        // state variables here would always reflect their value at mount time).
        const currentProfile = profileRef.current;
        const currentlyTracking = isTrackingRef.current;
        const manualEnabled = manualTrackingEnabledRef.current;

        // Only poll if we have profile with driver_id
        if (!currentProfile?.driver_profile) {
          console.log("[DriverDashboard] Waiting for profile to load...");
          return;
        }

        // No argument: a driver polls their OWN route, and the endpoint
        // defaults to the authenticated profile. Passing the id explicitly is
        // the admin case (read another driver's route), and doing it here was
        // what made every driver's poll look like a cross-driver read.
        const result = await driverApi.getCurrentRoute();
        console.log("[DriverDashboard] Route poll result:", result);

        if (result.success && result.data) {
          // The endpoint returns {route, bookings}, not a bare route. This read
          // `result.data.status`, which is undefined on that envelope — so
          // `hasActiveRoute` was permanently false and the auto-start branch
          // below was unreachable. A driver mid-route never had tracking turned
          // on for them; it only ever worked when they toggled it by hand.
          const route = result.data.route ?? null;
          const hasActiveRoute =
            !!route && ["assigned", "in_progress"].includes(route.status);

          console.log("[DriverDashboard] Active route check:", {
            hasRoute: !!route,
            status: route?.status,
            isActive: hasActiveRoute,
            isTracking: currentlyTracking,
            manualEnabled,
          });

          if (hasActiveRoute && !currentlyTracking && !manualEnabled) {
            console.log(
              "[DriverDashboard] Auto-starting tracking due to active route",
            );
            startTracking();
          } else if (!hasActiveRoute && currentlyTracking && !manualEnabled) {
            console.log(
              "[DriverDashboard] Stopping tracking - no active route and manual not enabled",
            );
            stopTracking();
          }
        } else if (!currentlyTracking && !manualEnabled) {
          console.log(
            "[DriverDashboard] No active route and not tracking - ensuring stopped",
          );
          stopTracking();
        }
      } catch (error) {
        console.error("[DriverDashboard] Route poll error:", error);
      }
    }, 60000); // 60 seconds

    routeCheckTimeRef.current = Date.now();
    // startTracking/stopTracking are stable identities are not required here since
    // they're re-created each render but startRoutePoll itself is only ever invoked
    // once on mount; the interval body always reads fresh state via the refs above.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const startTracking = async () => {
    if (isTracking) return;

    try {
      setTrackingStatus("tracking");
      setGeolocationError(null);

      if (!navigator.geolocation) {
        throw new Error("Geolocation is not supported by your browser");
      }

      const geolocationOptions = { enableHighAccuracy: true, timeout: 60000 };

      let position;
      try {
        position = await new Promise((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(
            resolve,
            reject,
            geolocationOptions,
          );
        });
      } catch (error) {
        if (error.code === error.TIMEOUT) {
          console.warn(
            "[DriverDashboard] High accuracy timeout - trying low accuracy",
          );
          position = await new Promise((resolve, reject) => {
            navigator.geolocation.getCurrentPosition(resolve, reject, {
              enableHighAccuracy: false,
              timeout: 30000,
            });
          });
        } else {
          throw error;
        }
      }

      const location = {
        lat: position.coords.latitude,
        lng: position.coords.longitude,
        accuracy: position.coords.accuracy,
      };
      setCurrentLocation(location);

      driverApi.startLocationTracking(30000);
      setIsTracking(true);
      toast.success("Location tracking started");
    } catch (error) {
      console.error("[DriverDashboard] Tracking start error:", error);
      let errorMsg = "Unable to access your location";
      if (error.code === error.PERMISSION_DENIED) {
        errorMsg =
          "Location permission denied. Please enable location access in settings.";
      } else if (error.code === error.POSITION_UNAVAILABLE) {
        errorMsg = "Location information is unavailable.";
      } else if (error.code === error.TIMEOUT) {
        errorMsg =
          "Location request timed out. Please check your connection or try moving to a better signal area.";
      }
      setGeolocationError(errorMsg);
      setTrackingStatus("error");
      toast.error(errorMsg);
    }
  };

  const stopTracking = async () => {
    try {
      driverApi.stopLocationTracking();
      // Explicit driver-off: clear the refresh-survival flag so a later reload
      // does NOT auto-resume (only startLocationTracking re-sets it).
      driverApi.clearLiveTrackingActive();
      setIsTracking(false);
      setTrackingStatus("idle");
      toast.success("Location tracking stopped");
    } catch (error) {
      console.error("[DriverDashboard] Tracking stop error:", error);
      toast.error("Failed to stop tracking");
    }
  };

  // Toggle tracking with manual override
  const toggleManualTracking = async () => {
    if (toggleLoading) return;
    setToggleLoading(true);
    const newState = !manualTrackingEnabled;
    setManualTrackingEnabled(newState);

    try {
      if (newState) {
        // Turn on manual tracking
        await startTracking();
        // Optionally update availability if backend supports
        try {
          await driverApi.updateAvailability({ available: false });
        } catch (error) {
          console.warn("[DriverDashboard] Availability update failed:", error);
        }
      } else {
        // Turn off manual tracking, let route polling control it
        await stopTracking();
      }
    } finally {
      setToggleLoading(false);
    }
  };

  const fetchData = useCallback(async () => {
    const token = localStorage.getItem("access_token");
    if (!token) {
      toast.error("Please log in to view the dashboard");
      navigate("/login");
      return;
    }

    setLoading(true);
    try {
      // Earnings fetch removed for now — getEarnings() no longer fires on dashboard
      // load (it was failing silently and logging a warning). The other calls stay
      // independent members of this Promise.all, so dropping one does not affect them.
      const [profResp, jbsResp, ratsResp, metricsResp, docsResp] =
        await Promise.all([
          driverApi.getProfile(),
          driverApi.getAssignedJobs(1, 10, "all"),
          driverApi.getRatings(),
          driverApi.getMetrics(),
          driverApi.getDocuments(),
        ]);

      // Handle profile response
      if (!profResp.success) {
        throw new Error(profResp.message || "Failed to fetch profile");
      }
      setProfile(profResp.data || null);

      // Handle jobs response: Extract results array from paginated response
      const jobsData =
        jbsResp.ordered_bookings || (Array.isArray(jbsResp) ? jbsResp : []);
      setJobs(jobsData); // Set to array of jobs

      // Earnings response handling removed — earnings feature disabled for now.

      // Handle ratings response
      if (!ratsResp.success) {
        console.warn("[DriverDashboard] Failed to fetch ratings:", {
          message: ratsResp.message || "No error message provided",
          status: ratsResp.status || "No status provided",
          response: ratsResp,
        });
      }
      const ratingsData = ratsResp.success ? ratsResp.data || [] : [];
      console.log("[DriverDashboard] Ratings data:", ratingsData);
      setRatings(ratingsData);

      // Handle documents response
      const requiredDocs = [
        "Driver's License",
        "Vehicle Registration",
        "Insurance",
      ];
      const fetchedDocs = Array.isArray(docsResp) ? docsResp : [];
      const docsMap = new Map(fetchedDocs.map((d) => [d.doc_type, d]));
      const allDocuments = requiredDocs.map(
        (type) =>
          docsMap.get(type) || {
            id: type.replace(/\s/g, "-").toLowerCase(), // Fake ID for key
            doc_type: type,
            uploaded_at: null,
            file: null,
            verified: false,
            notes: null,
          },
      );
      setDocuments(allDocuments);

      // Compute metrics with null-safe access

      if (metricsResp.success) {
        const m = metricsResp.data;
        setMetrics({
          // totalDeliveries: m.total_deliveries, // Successful jobs (delivered)
          completedToday: m.completed_today,
          // earnings* / pendingPayouts omitted — earnings feature disabled for now.
          // PerformanceMetrics does not render these; metrics-state defaults keep them 0.
          averageRating: m.average_rating,
          activeJobs: m.active_jobs,
          totalJobs: m.total_jobs,
          failedJobs: m.failed_jobs, // Added
          completionRate: m.completion_rate, // Added: Successful rate considering failed
        });
      } else {
        console.warn("Failed to fetch metrics:", metricsResp);
      }
    } catch (error) {
      console.error("[DriverDashboard] Error fetching data:", error);
      toast.error("Failed to load dashboard data");
    } finally {
      setLoading(false);
    }
  }, [navigate]);

  // Add document upload handler
  const handleDocumentUpload = async (docType, event) => {
    const file = event.target.files[0];
    if (!file) return;
    console.log("File type:", file.type);

    const allowedTypes = ["application/pdf", "image/jpeg", "image/png"];
    const maxSize = 5 * 1024 * 1024;
    if (!allowedTypes.includes(file.type)) {
      toast.error(`Invalid file type for ${docType}. Use PDF, JPEG, or PNG.`);
      return;
    }
    if (file.size > maxSize) {
      toast.error(`File size exceeds 5MB limit for ${docType}.`);
      return;
    }

    setUploading(true);
    try {
      const response = await driverApi.uploadDocument({ file, type: docType });
      console.log("DOCUMENT UPLOAD", response.data);

      toast.success(`${docType} uploaded successfully`);
      setDocuments((prev) =>
        prev.map((d) =>
          d.doc_type === docType
            ? {
                ...d,
                file: response.file,
                uploaded_at: new Date(),
                verified: response.verified || false,
              }
            : d,
        ),
      );
    } catch (error) {
      console.error("[DriverDashboard] Document upload error:", error);
      const errorMessage = error.message || `Failed to upload ${docType}`;
      toast.error(errorMessage);
    } finally {
      setUploading(false);
    }
  };

  const navigation = [
    { name: "Overview", icon: Home, key: "overview" },
    { name: "Jobs", icon: Briefcase, key: "jobs" },
    { name: "Map", icon: MapPin, key: "map" },
    // The Earnings tab had a full render branch (EarningsChart), header, state
    // and a getEarnings() fetch, but no nav entry — so it was unreachable. Add
    // the missing item so drivers can actually open it.
    { name: "Earnings", icon: DollarSign, key: "earnings" },
    { name: "Documents", icon: FileText, key: "documents" },
    { name: "Profile", icon: User, key: "profile" },
  ];

  // The whole job object is kept, not just its id. `/api/booking/bookings/<id>/`
  // returns a BOOKING, and a same-day booking is one booking row with two jobs
  // at two different doors — so the detail page cannot tell which one was tapped
  // from the id alone. The list already resolved the leg, the job number and the
  // next status; handing that down is cheaper and more correct than re-deriving
  // it there from the booking's status (which is the guess that used to send
  // same-day parcels to the hub).
  const handleJobClick = useCallback((job) => {
    setSelectedJobId(job.id);
    setSelectedJobStop(job);
    setShowJobDetail(true);
  }, []);

  // Stable identity. This used to be an inline arrow passed to
  // DeliveryStatusUpdates, which had it in a useEffect dependency list — so a
  // new identity on every dashboard render blanked the job list and refetched
  // page 1, and the driver's scroll position went with it. Half of the "lazy
  // loading keeps starting over" report was this, not the pagination.
  // `fetchData` is itself a useCallback with only `navigate` in its deps, so
  // this identity is stable for the life of the component.
  const handleJobStatusUpdate = useCallback(() => {
    fetchData();
  }, [fetchData]);

  // Handle logout
  const handleLogout = async () => {
    if (!window.confirm("Are you sure you want to log out?")) {
      return;
    }
    try {
      // Explicit logout ends tracking for good — stop the watcher AND clear the
      // refresh-survival flag so the next session doesn't auto-resume.
      driverApi.stopLocationTracking();
      driverApi.clearLiveTrackingActive();
      await driverApi.logout();
      toast.success("Logged out successfully");
      navigate("/login");
    } catch (error) {
      toast.error("Failed to log out");
      console.error("[DriverDashboard] Logout error:", error);
    }
  };

  const renderMapTab = () => {
    if (typeof window === "undefined" || !window.google) {
      return (
        <div className="bg-card border border-border rounded-lg p-6 h-96 flex items-center justify-center">
          <p className="text-muted-foreground">
            Google Maps not loaded. Check your API key in index.html
          </p>
        </div>
      );
    }

    return (
      <div className="space-y-6 max-w-none">
        {/* Tracking Status Card */}
        <div className="bg-card border border-border rounded-lg p-4 lg:p-6 shadow-sm">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-4">
            <h3 className="text-lg font-semibold text-foreground">
              Live Tracking
            </h3>
            <div className="flex gap-2 w-full sm:w-auto">
              {/* GPS location sharing — a DIFFERENT control from the "Work Offline"
                  data-queue toggle in the OfflineStatusBar. Labelled explicitly so a
                  driver never confuses "am I broadcasting my position" with "am I
                  queueing actions for a dead zone". min-h-[44px] for tap target. */}
              <button
                onClick={toggleManualTracking}
                disabled={toggleLoading}
                className={`flex-1 sm:flex-none min-h-[44px] px-4 py-2 rounded-lg font-medium transition-all flex items-center justify-center gap-2 ${
                  toggleLoading
                    ? "bg-gray-400 text-white cursor-not-allowed opacity-60"
                    : manualTrackingEnabled
                      ? "bg-orange-500 text-white hover:bg-orange-600 active:scale-95"
                      : "bg-slate-600 text-white hover:bg-slate-700 active:scale-95"
                }`}
              >
                <MapPin className="w-4 h-4" />
                <span>
                  {manualTrackingEnabled
                    ? "Sharing Location"
                    : "Location Off"}
                </span>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="p-3 bg-muted rounded-lg">
              <p className="text-xs text-muted-foreground mb-1">App Status</p>
              <p
                className={`font-semibold capitalize text-sm ${
                  trackingStatus === "tracking"
                    ? "text-green-600"
                    : trackingStatus === "error"
                      ? "text-red-600"
                      : "text-yellow-600"
                }`}
              >
                {trackingStatus}
              </p>
            </div>
            <div className="p-3 bg-muted rounded-lg">
              <p className="text-xs text-muted-foreground mb-1">
                Location Sharing
              </p>
              <p className="font-semibold text-foreground text-sm">
                {manualTrackingEnabled ? "On" : "Off"}
              </p>
            </div>
            <div className="p-3 bg-muted rounded-lg">
              <p className="text-xs text-muted-foreground mb-1">
                Current Location
              </p>
              <p className="text-xs font-mono text-foreground">
                {currentLocation
                  ? `${currentLocation.lat.toFixed(4)}, ${currentLocation.lng.toFixed(4)}`
                  : "—"}
              </p>
            </div>
          </div>

          {geolocationError && (
            <div className="mt-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg flex gap-2">
              <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-red-600">{geolocationError}</p>
            </div>
          )}
        </div>

      </div>
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-4 border-primary border-t-transparent mx-auto mb-4"></div>
          <p className="text-foreground">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  if (showJobDetail) {
    return (
      <JobDetailPage
        jobId={selectedJobId}
        stopContext={selectedJobStop}
        onBack={() => {
          setShowJobDetail(false);
          setSelectedJobStop(null);
        }}
      />
    );
  }

  return (
    <div className="flex flex-col lg:flex-row min-h-screen bg-background">
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/60 lg:hidden backdrop-blur-sm"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <div
        className={`fixed inset-y-0 left-0 z-50 w-72 bg-sidebar border-r border-sidebar-border shadow-xl transform transition-transform duration-300 ease-in-out lg:translate-x-0 lg:w-64 lg:shadow-none ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        } lg:static lg:flex-shrink-0`}
      >
        <div className="flex h-full flex-col">
          <div className="flex h-16 items-center justify-between px-6 border-b border-sidebar-border bg-sidebar">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 bg-primary rounded-lg flex items-center justify-center shadow-sm">
                <Package className="h-5 w-5 text-primary-foreground" />
              </div>
              <span className="text-xl font-bold text-sidebar-foreground">
                Drop N Roll
              </span>
            </div>
            <button
              onClick={() => setSidebarOpen(false)}
              className="lg:hidden p-2 hover:bg-sidebar-accent rounded-lg transition-colors"
            >
              <X className="h-5 w-5 text-sidebar-foreground" />
            </button>
          </div>

          <nav className="flex-1 px-4 py-6 space-y-1 overflow-y-auto">
            {navigation.map((item) => (
              <button
                key={item.key}
                onClick={() => {
                  setActiveTab(item.key);
                  setSidebarOpen(false);
                }}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-left transition-all duration-200 mobile-nav ${
                  activeTab === item.key
                    ? "bg-sidebar-primary text-sidebar-primary-foreground shadow-sm"
                    : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                }`}
              >
                <item.icon className="h-5 w-5 flex-shrink-0" />
                <span className="font-medium">{item.name}</span>
              </button>
            ))}
            {isLoggedIn && (
              <li>
                <button
                  onClick={handleLogout}
                  className="w-full flex items-center px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-100 dark:text-red-400 dark:hover:bg-red-900"
                >
                  <LogOut className="h-5 w-5 mr-3" />
                  Log Out
                </button>
              </li>
            )}
          </nav>

          <div className="p-4 border-t border-sidebar-border bg-sidebar">
            <div className="flex items-center gap-3 p-2">
              <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center border-2 border-primary/20">
                <User className="h-6 w-6 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-sidebar-foreground truncate">
                  {profile ? profile.full_name : "Loading..."}
                </p>
                <div className="flex items-center gap-1">
                  <Star className="h-4 w-4 text-yellow-500 fill-current flex-shrink-0" />
                  <span className="text-sm font-medium text-sidebar-foreground">
                    {metrics.averageRating.toFixed(1) || "0.0"}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 flex flex-col min-w-0">
        <header className="bg-card border-b border-border sticky top-0 z-30 shadow-sm">
          <div className="flex h-16 items-center justify-between px-4 lg:px-6 max-w-none">
            <div className="flex items-center gap-3 flex-1 min-w-0">
              <button
                onClick={() => setSidebarOpen(true)}
                className="lg:hidden p-2 hover:bg-muted rounded-lg transition-colors"
              >
                <Menu className="h-6 w-6 text-foreground" />
              </button>
              <div className="min-w-0 flex-1">
                <h1 className="text-lg lg:text-xl font-bold text-foreground truncate mobile-header">
                  {activeTab === "overview" && "Dashboard Overview"}
                  {activeTab === "jobs" && "My Jobs"}
                  {activeTab === "map" && "Live Map"}
                  {activeTab === "earnings" && "Earnings"}
                  {activeTab === "documents" && "Documents"}
                  {activeTab === "profile" && "Profile"}
                </h1>
                <p className="text-sm text-muted-foreground truncate hidden sm:block">
                  Welcome back, {profile ? profile.full_name : "Loading..."}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 lg:gap-4">
              <div className="relative hidden sm:block">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Search..."
                  className="pl-10 pr-4 py-2 bg-muted border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent w-48 lg:w-64"
                />
              </div>
              <button className="p-2 hover:bg-muted rounded-lg relative transition-colors">
                <Bell className="h-5 w-5 text-muted-foreground" />
                <span className="absolute -top-1 -right-1 w-3 h-3 bg-primary rounded-full"></span>
              </button>
            </div>
          </div>
        </header>

        <OfflineStatusBar />

        <main className="flex-1 p-4 lg:p-6 max-w-none">
          {activeTab === "overview" && (
            <div className="space-y-5 max-w-none">
              {/* Welcome Message */}
              <div className="mb-6">
                <h1 className="text-2xl md:text-3xl font-bold text-slate-900 dark:text-white">
                  Welcome back, {profile?.first_name || "Driver"}!
                </h1>
              </div>

              {/* Performance Metrics Card */}
              <PerformanceMetrics metrics={metrics} />

              {/* Active Jobs Card */}
              <ActiveJobsOverviewCard
                jobs={jobs}
                onJobClick={handleJobClick}
                onViewAll={() => setActiveTab("jobs")}
              />

            
            </div>
          )}

          {activeTab === "map" && renderMapTab()}

          {activeTab === "earnings" && (
            <div className="space-y-5 max-w-none">
              {/* EarningsChart removed — earnings feature disabled for now.
                  Re-add <EarningsChart earnings={earnings} detailed /> plus the
                  getEarnings() fetch + earnings state to restore. The Recent
                  Ratings card below is unrelated to earnings and stays. */}
              <div className="bg-card border border-border rounded-lg p-6">
                <h3 className="text-lg font-semibold text-foreground mb-4">
                  Recent Ratings
                </h3>
                {ratings.length > 0 ? (
                  <div className="space-y-3">
                    {ratings.map((rating) => (
                      <div
                        key={rating.id}
                        className="flex items-center justify-between border-b border-border pb-3 last:border-b-0 last:pb-0"
                      >
                        <div className="flex items-center gap-2">
                          <Star className="h-4 w-4 text-yellow-500 fill-yellow-500" />
                          <span className="font-semibold text-foreground">
                            {rating.score ?? rating.rating ?? "N/A"}
                          </span>
                        </div>
                        {rating.comment && (
                          <p className="text-sm text-muted-foreground truncate max-w-xs">
                            {rating.comment}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    No ratings yet.
                  </p>
                )}
              </div>
            </div>
          )}

          {activeTab === "jobs" && (
            <div className="max-w-none">
              <DeliveryStatusUpdates
                jobs={jobs}
                onJobClick={handleJobClick}
                onStatusUpdate={handleJobStatusUpdate}
              />
            </div>
          )}

          {activeTab === "documents" && (
            <div className="max-w-none">
              <div className="bg-card border border-border rounded-lg p-6">
                <h3 className="text-lg font-semibold text-foreground mb-4">
                  Document Status
                </h3>
                <div className="space-y-4">
                  {documents.map((doc) => (
                    <div
                      key={doc.id}
                      className="flex items-center justify-between p-4 border border-border rounded-lg"
                    >
                      <div>
                        <p className="font-medium text-foreground">
                          {doc.doc_type}
                        </p>
                        {/* FIXED: Conditional date handling */}
                        {doc.uploaded_at ? (
                          <p className="text-sm text-muted-foreground">
                            Uploaded on{" "}
                            {new Date(doc.uploaded_at).toLocaleDateString()}
                          </p>
                        ) : (
                          <p className="text-sm text-muted-foreground">
                            Not uploaded yet
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-3">
                        <span
                          className={`px-3 py-1 rounded-full text-sm font-medium ${
                            doc.verified
                              ? "bg-green-500/10 text-green-600"
                              : "bg-red-500/10 text-red-600"
                          }`}
                        >
                          {doc.verified ? "Verified" : "Not Verified"}
                        </span>
                        {!doc.file && (
                          <label
                            htmlFor={`upload-${doc.doc_type}`}
                            className={`cursor-pointer p-2 rounded-lg transition-colors ${
                              uploading
                                ? "opacity-50 cursor-not-allowed"
                                : "hover:bg-muted"
                            }`}
                          >
                            <input
                              id={`upload-${doc.doc_type}`}
                              type="file"
                              accept=".pdf,.jpg,.jpeg,.png"
                              className="hidden"
                              onChange={(e) =>
                                handleDocumentUpload(doc.doc_type, e)
                              }
                              disabled={uploading}
                            />
                            {uploading ? (
                              <div className="animate-spin h-5 w-5 border-2 border-primary border-t-transparent"></div>
                            ) : (
                              <Upload className="h-5 w-5 text-primary" />
                            )}
                          </label>
                        )}
                        {doc.file && (
                          <div className="flex items-center gap-2">
                            <CheckCircle className="h-5 w-5 text-green-600" />
                            {/* NEW: View link */}
                            <a
                              href={doc.file}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="cursor-pointer p-2 hover:bg-muted rounded-lg transition-colors"
                              title="View Document"
                            >
                              <Eye className="h-5 w-5 text-blue-600" />
                            </a>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {activeTab === "profile" && profile && (
            <div className="max-w-4xl space-y-6">
              <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-8 shadow-sm transition-all duration-300 hover:shadow-md">
                <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-6">
                  Profile Information
                </h3>
                <div className="space-y-6">
                  <div className="flex items-center justify-between p-4 bg-teal-50 dark:bg-teal-900 rounded-lg border border-gray-200 dark:border-gray-600">
                    <span className="text-sm font-medium text-gray-600 dark:text-gray-300">
                      Full Name
                    </span>
                    <p className="text-base font-normal text-gray-900 dark:text-white">
                      {profile.full_name
                        ? profile.full_name
                            .split(" ")
                            .map((name) =>
                              name
                                ? name.charAt(0).toUpperCase() + name.slice(1)
                                : "",
                            )
                            .join(" ")
                        : "N/A"}
                    </p>
                  </div>
                  <div className="flex items-center justify-between p-4 bg-teal-50 dark:bg-teal-900 rounded-lg border border-gray-200 dark:border-gray-600">
                    <span className="text-sm font-medium text-gray-600 dark:text-gray-300">
                      Email
                    </span>
                    <p className="text-base font-normal text-gray-900 dark:text-white">
                      {profile.email
                        ? profile.email.charAt(0).toUpperCase() +
                          profile.email.slice(1)
                        : "N/A"}
                    </p>
                  </div>
                  <div className="flex items-center justify-between p-4 bg-teal-50 dark:bg-teal-900 rounded-lg border border-gray-200 dark:border-gray-600">
                    <span className="text-sm font-medium text-gray-600 dark:text-gray-300">
                      Role
                    </span>
                    <p className="text-base font-normal text-gray-900 dark:text-white">
                      {profile.role
                        ? profile.role.charAt(0).toUpperCase() +
                          profile.role.slice(1)
                        : "N/A"}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
