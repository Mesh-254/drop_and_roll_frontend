import { useState, useEffect } from "react";
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
  ChevronRight,
  LogOut,
  Upload,
  CheckCircle,
  Eye,
} from "lucide-react";
import { PerformanceMetrics } from "./performance-metrics";
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
    totalDeliveries: 0,
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

  const navigate = useNavigate();

  // Check if driver is logged in
  const isLoggedIn = !!localStorage.getItem("access_token");

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    const token = localStorage.getItem("access_token");
    if (!token) {
      toast.error("Please log in to view the dashboard");
      navigate("/login");
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const [profResp, jbsResp, earnsResp, ratsResp, metricsResp, docsResp] =
        await Promise.all([
          driverApi.getProfile(),
          driverApi.getAssignedJobs(),
          driverApi.getEarnings(),
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
          }
      );
      setDocuments(allDocuments);

      // Compute metrics with null-safe access

      if (metricsResp.success) {
        const m = metricsResp.data;
        setMetrics({
          totalDeliveries: m.total_deliveries, // Successful jobs (delivered)
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
            : d
        )
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
    { name: "Earnings", icon: DollarSign, key: "earnings" },
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
            <div className="space-y-6 max-w-none">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6">
                <div className="bg-card border border-border rounded-lg p-4 lg:p-6 mobile-card shadow-sm">
                  <div className="flex items-center justify-between">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-muted-foreground">
                        Total Deliveries
                      </p>
                      <p className="text-2xl lg:text-3xl font-bold text-foreground">
                        {metrics.totalDeliveries}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Completed: {metrics.totalDeliveries}
                      </p>
                    </div>
                    <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center flex-shrink-0">
                      <Package className="h-6 w-6 text-primary" />
                    </div>
                  </div>
                </div>

                <div className="bg-card border border-border rounded-lg p-4 lg:p-6 mobile-card shadow-sm">
                  <div className="flex items-center justify-between">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-muted-foreground">
                        Today's Earnings
                      </p>
                      <p className="text-2xl lg:text-3xl font-bold text-foreground">
                        {formatCurrency(metrics.earningsToday)}
                      </p>
                      <p className="text-xs text-green-600 mt-1">
                        From {metrics.completedToday} deliveries
                      </p>
                    </div>
                    <div className="w-12 h-12 bg-green-500/10 rounded-full flex items-center justify-center flex-shrink-0">
                      <DollarSign className="h-6 w-6 text-green-600" />
                    </div>
                  </div>
                </div>

                <div className="bg-card border border-border rounded-lg p-4 lg:p-6 mobile-card shadow-sm">
                  <div className="flex items-center justify-between">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-muted-foreground">
                        Average Rating
                      </p>
                      <p className="text-2xl lg:text-3xl font-bold text-foreground">
                        {metrics.averageRating.toFixed(1)}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Out of 5 stars
                      </p>
                    </div>
                    <div className="w-12 h-12 bg-yellow-500/10 rounded-full flex items-center justify-center flex-shrink-0">
                      <Star className="h-6 w-6 text-yellow-500" />
                    </div>
                  </div>
                </div>

                <div className="bg-card border border-border rounded-lg p-4 lg:p-6 mobile-card shadow-sm">
                  <div className="flex items-center justify-between">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-muted-foreground">
                        Active Jobs
                      </p>
                      <p className="text-2xl lg:text-3xl font-bold text-foreground">
                        {metrics.activeJobs}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        In progress
                      </p>
                    </div>
                    <div className="w-12 h-12 bg-blue-500/10 rounded-full flex items-center justify-center flex-shrink-0">
                      <Clock className="h-6 w-6 text-blue-600" />
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 max-w-none">
                <EarningsChart earnings={earnings} detailed={false} />
                <PerformanceMetrics
                  rating={metrics.averageRating}
                  completedJobs={metrics.totalDeliveries}
                  totalJobs={metrics.totalJobs}
                  ratings={ratings}
                />
              </div>

              <div className="bg-card border border-border rounded-lg shadow-sm">
                <div className="p-4 lg:p-6 border-b border-border">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-semibold text-foreground">
                      Recent Jobs
                    </h3>
                    <button
                      onClick={() => setActiveTab("jobs")}
                      className="text-primary hover:text-primary/80 text-sm font-medium flex items-center gap-1 transition-colors"
                    >
                      View all
                      <ChevronRight className="h-4 w-4" />
                    </button>
                  </div>
                </div>
                <div className="p-4 lg:p-6">
                  <div className="space-y-3">
                    {Array.isArray(jobs) && jobs.length > 0 ? (
                      jobs.slice(0, 4).map((job) => (
                        <div
                          key={job.id}
                          className="flex items-center justify-between p-4 border border-border rounded-lg hover:bg-muted/50 cursor-pointer transition-all duration-200 mobile-card"
                          onClick={() => handleJobClick(job)}
                        >
                          <div className="flex items-center gap-3 flex-1 min-w-0">
                            <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center flex-shrink-0">
                              <MapPin className="h-5 w-5 text-primary" />
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="font-medium text-foreground truncate">
                                {job.customer.name || job.guest_email || "N/A"}
                              </p>
                              <p className="text-sm text-muted-foreground truncate">
                                {job.pickup_address.city || "N/A"} →{" "}
                                {job.dropoff_address.city || "N/A"}
                              </p>
                            </div>
                          </div>
                          <div className="text-right flex-shrink-0 ml-3">
                            <span
                              className={`px-2 py-1 rounded-full text-xs font-medium border ${getStatusColor(
                                job.status
                              )}`}
                            >
                              {job.status?.replace("_", " ").toUpperCase() ||
                                "UNKNOWN"}
                            </span>
                            <p className="text-sm font-medium text-foreground mt-1">
                              {formatCurrency(job.driver_fee || 0)}
                            </p>
                          </div>
                        </div>
                      ))
                    ) : (
                      <p className="text-sm text-muted-foreground text-center">
                        No recent jobs available
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

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

          {activeTab === "earnings" && (
            <div className="space-y-6 max-w-none">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 lg:gap-6">
                <div className="bg-card border border-border rounded-lg p-4 lg:p-6 mobile-card shadow-sm">
                  <h3 className="text-lg font-semibold text-foreground mb-2">
                    Today
                  </h3>
                  <p className="text-2xl lg:text-3xl font-bold text-primary">
                    {formatCurrency(earnings.today)}
                  </p>
                </div>
                <div className="bg-card border border-border rounded-lg p-4 lg:p-6 mobile-card shadow-sm">
                  <h3 className="text-lg font-semibold text-foreground mb-2">
                    This Week
                  </h3>
                  <p className="text-2xl lg:text-3xl font-bold text-green-600">
                    {formatCurrency(earnings.weekly)}
                  </p>
                </div>
                <div className="bg-card border border-border rounded-lg p-4 lg:p-6 mobile-card shadow-sm">
                  <h3 className="text-lg font-semibold text-foreground mb-2">
                    This Month
                  </h3>
                  <p className="text-2xl lg:text-3xl font-bold text-blue-600">
                    {formatCurrency(earnings.monthly)}
                  </p>
                </div>
              </div>
              <div className="max-w-none">
                <EarningsChart earnings={earnings} detailed={true} />
              </div>
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
                                : ""
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
