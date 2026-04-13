"use client";

import { useState, useEffect, useRef } from "react";
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
  Zap,
} from "lucide-react";
import { PerformanceMetrics } from "./performance-metrics";
import { ActiveJobsOverviewCard } from "./active-jobs-overview-card";
import { EarningsChart } from "./earnings-chart";
import { DeliveryStatusUpdates } from "./delivery-status-updates";
import { JobDetailsModal } from "./job-details-modal";
import { JobDetailPage } from "./job-detail-page";
import driverApi from "../../api/driver-api";

export default function DriverDashboard() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [selectedJob, setSelectedJob] = useState(null);
  const [showJobModal, setShowJobModal] = useState(false);
  const [showJobDetail, setShowJobDetail] = useState(false);
  const [selectedJobId, setSelectedJobId] = useState(null);
  const [profile, setProfile] = useState(null);
  const [jobs, setJobs] = useState([]);
  const [documents, setDocuments] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [earnings, setEarnings] = useState({
    today: 0,
    weekly: 0,
    monthly: 0,
    chartData: [],
    available: 0,
    pending: 0,
  });
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
  const [backendTrackingStatus, setBackendTrackingStatus] = useState(false);
  const routePollIntervalRef = useRef(null);
  const routeCheckTimeRef = useRef(null);

  const wsRef = useRef(null); // New: For per-driver WS
  const pollIntervalRef = useRef(null); // For polling

  const navigate = useNavigate();

  // Check if driver is logged in
  const isLoggedIn = !!localStorage.getItem("access_token");

  useEffect(() => {
    fetchData();
    startRoutePoll();
    // Cleanup on unmount
    return () => {
      stopRoutePoll();
      driverApi.stopLocationTracking();
    };
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
            toast.info("Tracking deactivated");
          }
        }
      } catch (err) {
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
      if (wsRef.current) wsRef.current.close();
    };
  }, []);

  // New: WS for real-time tracking toggle (per-driver group)
  useEffect(() => {
    if (!profile?.id) return;

    const token = localStorage.getItem("access_token");
    wsRef.current = new WebSocket(
      `ws://127.0.0.1:8000/ws/driver/${profile.id}/?token=${token}`,
    );
    wsRef.current.onopen = () =>
      console.log("[DriverDashboard] Per-driver WS connected");
    wsRef.current.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.type === "tracking.toggle") {
        if (data.enabled) {
          driverApi.startLocationTracking();
          toast.success("Tracking enabled via server update");
        } else {
          driverApi.stopLocationTracking();
          toast.info("Tracking disabled via server update");
        }
      }
    };

    wsRef.current.onclose = (event) => {
      console.log("[DriverDashboard] Per-driver WS disconnected:", event);
      if (event.code === 1006 || event.code !== 1000) {
        setTimeout(() => {
          // Reconnect
          wsRef.current = new WebSocket(
            `ws://127.0.0.1:8000/ws/driver/${profile.id}/?token=${localStorage.getItem("access_token")}`,
          );
          // Re-add listeners
        }, 5000); // 5s delay
      }
    };

    wsRef.current.onerror = (error) =>
      console.error("[DriverDashboard] Per-driver WS error:", error);

    return () => {
      if (wsRef.current) wsRef.current.close();
    };
  }, [profile?.id]);

  const startRoutePoll = () => {
    // Poll for active route every 60 seconds
    routePollIntervalRef.current = setInterval(async () => {
      try {
        // Only poll if we have profile with driver_id
        if (!profile?.driver_profile) {
          console.log("[DriverDashboard] Waiting for profile to load...");
          return;
        }

        const result = await driverApi.getCurrentRoute(profile.driver_profile);
        console.log("[DriverDashboard] Route poll result:", result);

        if (result.success && result.data) {
          const route = result.data;
          const hasActiveRoute =
            route.status && ["assigned", "in_progress"].includes(route.status);

          console.log("[DriverDashboard] Active route check:", {
            hasRoute: !!route,
            status: route?.status,
            isActive: hasActiveRoute,
            isTracking,
            manualEnabled: manualTrackingEnabled,
          });

          if (hasActiveRoute && !isTracking && !manualTrackingEnabled) {
            console.log(
              "[DriverDashboard] Auto-starting tracking due to active route",
            );
            startTracking();
          } else if (!hasActiveRoute && isTracking && !manualTrackingEnabled) {
            console.log(
              "[DriverDashboard] Stopping tracking - no active route and manual not enabled",
            );
            stopTracking();
          }
        } else if (!isTracking && !manualTrackingEnabled) {
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
  };

  const stopRoutePoll = () => {
    if (routePollIntervalRef.current) {
      clearInterval(routePollIntervalRef.current);
      routePollIntervalRef.current = null;
    }
  };

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
      setIsTracking(false);
      setTrackingStatus("idle");
      toast.success("Location tracking stopped");
    } catch (error) {
      console.error("[DriverDashboard] Tracking stop error:", error);
      toast.error("Failed to stop tracking");
    }
  };

  // Toggle tracking via backend API
  const handleToggleTracking = async () => {
    if (toggleLoading) return;

    setToggleLoading(true);
    console.log("[DriverDashboard] Initiating toggle tracking...");

    try {
      const result = await driverApi.toggleTracking();
      console.log("[DriverDashboard] Toggle tracking result:", result);

      if (result.success) {
        const newStatus = result.isEnabled;
        setBackendTrackingStatus(newStatus);

        if (newStatus) {
          console.log("[DriverDashboard] Tracking enabled via backend");
          await startTracking();
          toast.success(result.message || "Tracking enabled successfully");
        } else {
          console.log("[DriverDashboard] Tracking disabled via backend");
          await stopTracking();
          toast.success(result.message || "Tracking disabled successfully");
        }
      } else {
        console.error(
          "[DriverDashboard] Toggle tracking failed:",
          result.message,
        );
        toast.error(result.message || "Failed to toggle tracking");
      }
    } catch (error) {
      console.error("[DriverDashboard] Toggle tracking error:", error);
      toast.error("An error occurred while toggling tracking");
    } finally {
      setToggleLoading(false);
    }
  };

  // Toggle tracking with manual override
  const toggleManualTracking = async () => {
    const newState = !manualTrackingEnabled;
    setManualTrackingEnabled(newState);

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
  };

  const fetchData = async () => {
    const token = localStorage.getItem("access_token");
    if (!token) {
      toast.error("Please log in to view the dashboard");
      navigate("/login");
      return;
    }

    setLoading(true);
    try {
      const [
        profResp,
        jbsResp,
        earnsResp,
        ratsResp,
        metricsResp,
        docsResp,
        trackingResp,
      ] = await Promise.all([
        driverApi.getProfile(),
        driverApi.getAssignedJobs(1, 10, "all"),
        driverApi.getEarnings(),
        driverApi.getRatings(),
        driverApi.getMetrics(),
        driverApi.getDocuments(),
        driverApi.getTrackingStatus(),
      ]);

      // Handle profile response
      if (!profResp.success) {
        throw new Error(profResp.message || "Failed to fetch profile");
      }
      setProfile(profResp.data || null);

      // Handle tracking status response
      if (trackingResp.success) {
        setBackendTrackingStatus(trackingResp.isEnabled);
        console.log(
          "[DriverDashboard] Initial tracking status:",
          trackingResp.isEnabled,
        );
      }

      // Handle jobs response: Extract results array from paginated response
      const jobsData =
        jbsResp.ordered_bookings || (Array.isArray(jbsResp) ? jbsResp : []);
      setJobs(jobsData); // Set to array of jobs

      // Handle earnings response
      if (!earnsResp.success) {
        console.warn("[DriverDashboard] Failed to fetch earnings:", {
          message: earnsResp.message || "No error message provided",
          status: earnsResp.status || "No status provided",
          response: earnsResp,
        });
      }
      const earningsData = earnsResp.success
        ? earnsResp.data || {
            today: 0,
            weekly: 0,
            monthly: 0,
            chartData: [],
            available: 0,
            pending: 0,
          }
        : {
            today: 0,
            weekly: 0,
            monthly: 0,
            chartData: [],
            available: 0,
            pending: 0,
          };
      // console.log("[DriverDashboard] Earnings data:", earningsData);
      setEarnings(earningsData);

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
          earningsToday: earningsData.today,
          earningsWeek: earningsData.weekly,
          earningsMonth: earningsData.monthly,
          averageRating: m.average_rating,
          pendingPayouts: earningsData.pending,
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
  };

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
    { name: "Documents", icon: FileText, key: "documents" },
    { name: "Profile", icon: User, key: "profile" },
  ];

  const handleJobClick = (job) => {
    setSelectedJobId(job.id);
    setShowJobDetail(true);
  };

  // Handle logout
  const handleLogout = async () => {
    if (!window.confirm("Are you sure you want to log out?")) {
      return;
    }
    try {
      await driverApi.logout();
      toast.success("Logged out successfully");
      navigate("/login");
    } catch (error) {
      toast.error("Failed to log out");
      console.error("[DriverDashboard] Logout error:", error);
    }
  };

  const handleJobModalOpen = (job) => {
    setSelectedJob(job);
    setShowJobModal(true);
  };

  const formatCurrency = (amount) => {
    return `GB ${amount.toLocaleString()}`;
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
              {/* <button
                onClick={handleToggleTracking}
                disabled={toggleLoading}
                className={`flex-1 sm:flex-none px-4 py-2 rounded-lg font-medium transition-all flex items-center justify-center gap-2 ${
                  toggleLoading
                    ? "bg-gray-400 text-white cursor-not-allowed opacity-60"
                    : backendTrackingStatus
                      ? "bg-red-500 text-white hover:bg-red-600 active:scale-95"
                      : "bg-green-500 text-white hover:bg-green-600 active:scale-95"
                }`}
              >
                {toggleLoading ? (
                  <>
                    <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full" />
                    <span>Updating...</span>
                  </>
                ) : (
                  <>
                    <Activity className="w-4 h-4" />
                    <span>
                      {backendTrackingStatus
                        ? "Stop Tracking"
                        : "Start Tracking"}
                    </span>
                  </>
                )}
              </button> */}
              <button
                onClick={toggleManualTracking}
                disabled={toggleLoading}
                className={`flex-1 sm:flex-none px-4 py-2 rounded-lg font-medium transition-all flex items-center justify-center gap-2 ${
                  toggleLoading
                    ? "bg-gray-400 text-white cursor-not-allowed opacity-60"
                    : manualTrackingEnabled
                      ? "bg-orange-500 text-white hover:bg-orange-600 active:scale-95"
                      : "bg-slate-600 text-white hover:bg-slate-700 active:scale-95"
                }`}
              >
                <Zap className="w-4 h-4" />
                <span>
                  {manualTrackingEnabled ? "Manual ON" : "Manual OFF"}
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
            {/* <div className="p-3 bg-muted rounded-lg">
              <p className="text-xs text-muted-foreground mb-1">
                Backend Status
              </p>
              <p
                className={`font-semibold text-sm ${backendTrackingStatus ? "text-green-600" : "text-slate-600"}`}
              >
                {backendTrackingStatus ? "ACTIVE" : "INACTIVE"}
              </p>
            </div> */}
            <div className="p-3 bg-muted rounded-lg">
              <p className="text-xs text-muted-foreground mb-1">
                Manual Override
              </p>
              <p className="font-semibold text-foreground text-sm">
                {manualTrackingEnabled ? "ON" : "OFF"}
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
        onBack={() => setShowJobDetail(false)}
        usingMockData={false}
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

          {activeTab === "jobs" && (
            <div className="max-w-none">
              <DeliveryStatusUpdates
                jobs={jobs}
                onJobClick={handleJobClick}
                onStatusUpdate={() => {
                  toast.success("Jobs updated");
                  fetchData(); // Refresh jobs after status update
                }}
                isAuthenticated={isLoggedIn}
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

      {showJobModal && selectedJob && (
        <JobDetailsModal
          job={selectedJob}
          isOpen={showJobModal}
          onClose={() => setShowJobModal(false)}
          onUpdateBookingStatus={(bookingId, status) => {
            toast.success(`Booking ${bookingId} updated to ${status}`);
            fetchData(); // Refresh data after status update
          }}
          onBulkDelivery={(formData) => {
            toast.success("Bulk delivery completed");
            fetchData(); // Refresh data after bulk delivery
          }}
        />
      )}
    </div>
  );
}
