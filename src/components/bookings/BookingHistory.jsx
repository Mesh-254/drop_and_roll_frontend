"use client";
import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  Calendar,
  Package,
  Clock,
  MapPin,
  CreditCard,
  Search,
  Plus,
  Loader2,
  AlertCircle,
  Eye,
  MoreVertical,
  CheckCircle,
  XCircle,
  X,
  FileText,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { useAuth } from "../../contexts/AuthContext";
import { bookingApi } from "../../api/BookingApi";
import TrackParcelModal from "../track/TrackParcelModal";
import dayjs from "dayjs";

// MODERN DESIGN UPGRADE: Premium dark-mode booking history with tabs, cards, filters
// NAVIGATION & PROFILE UPGRADE: Added modal state for booking details view
export default function BookingHistory() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { isAuthenticated, user } = useAuth();
  const [activeTab, setActiveTab] = useState("bookings");
  const [bookings, setBookings] = useState([]);
  const [quotes, setQuotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedBooking, setSelectedBooking] = useState(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [isDownloadingInvoice, setIsDownloadingInvoice] = useState(false);
  // Inline "Copied!" feedback for the tracking number field in the Booking
  // Details modal, replacing the old alert() popup.
  const [trackingCopied, setTrackingCopied] = useState(false);
  // "Track Now" opens the shared tracking modal prefilled with this booking's
  // tracking number, instead of the old dead /tracking?track= link.
  const [showTrackModal, setShowTrackModal] = useState(false);
  const [trackNumberToShow, setTrackNumberToShow] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [filters, setFilters] = useState({
    dateFrom: "",
    dateTo: "",
    status: "",
    // Deep-link support: BulkUploadDetail's Successful tab links here with
    // ?search=<booking id> so tapping "View" lands directly on that booking
    // instead of a generic, unfiltered history page.
    search: searchParams.get("search") || "",
  });

  // Pagination constants
  const ITEMS_PER_PAGE = 10;

  useEffect(() => {
    if (!isAuthenticated) {
      navigate("/login");
      return;
    }
  }, [isAuthenticated, navigate]);

  useEffect(() => {
    if (isAuthenticated) {
      fetchData();
    }
  }, [isAuthenticated]);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);
      setCurrentPage(1);

      const [bookingsResponse, quotesResponse] = await Promise.all([
        bookingApi.getBookingHistory(),
        bookingApi.getQuotes(),
      ]);

      // Handle both array and paginated responses
      let bookingsList = [];
      if (Array.isArray(bookingsResponse.data)) {
        bookingsList = bookingsResponse.data;
        console.log("[BookingHistory] API returned array format. Total:", bookingsList.length);
      } else if (bookingsResponse.data?.results) {
        bookingsList = bookingsResponse.data.results;
        console.log("[BookingHistory] API returned paginated format. Total:", bookingsResponse.data.count);
      }

      setBookings(bookingsList);
      setQuotes(quotesResponse.data || []);
    } catch (err) {
      console.error("Failed to fetch data:", err);
      setError("Failed to load your booking history. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleBookNow = (quote) => {
    navigate("/booking", { state: { quote } });
  };

  const handleDownloadInvoice = async (bookingId) => {
    try {
      setIsDownloadingInvoice(true);
      const result = await bookingApi.downloadInvoice(bookingId);
      if (!result.success) {
        alert(result.message || "Failed to download invoice");
      }
    } catch (err) {
      console.error("[BookingHistory] Invoice download error:", err);
      alert("Failed to download invoice. Please try again.");
    } finally {
      setIsDownloadingInvoice(false);
    }
  };

  // Calculate pagination
  const canDownloadInvoice = (status) => {
    if (!status) return false;
    const statusLower = status.toLowerCase();
    return statusLower !== "pending" && statusLower !== "cancelled";
  };

  const getPaginatedBookings = () => {
    const startIdx = (currentPage - 1) * ITEMS_PER_PAGE;
    const endIdx = startIdx + ITEMS_PER_PAGE;
    return filteredBookings.slice(startIdx, endIdx);
  };

  const getTotalPages = () => {
    return Math.ceil(filteredBookings.length / ITEMS_PER_PAGE) || 1;
  };

  const getStatusIcon = (status) => {
    switch (status?.toLowerCase()) {
      case "pending":
      case "scheduled":
        return <Clock className="text-warning" size={16} />;
      case "in-progress":
      case "assigned":
        return <Package className="text-brand-text" size={16} />;
      case "completed":
      case "delivered":
        return <CheckCircle className="text-success" size={16} />;
      case "cancelled":
      case "failed":
        return <XCircle className="text-destructive" size={16} />;
      default:
        return <Package className="text-muted-foreground" size={16} />;
    }
  };

  const getStatusColor = (status) => {
    switch (status?.toLowerCase()) {
      case "pending":
      case "scheduled":
        return "bg-warning/20 text-warning border-warning/30";
      case "in-progress":
      case "assigned":
        return "bg-primary/20 text-brand-text border-primary/30";
      case "completed":
      case "delivered":
        return "bg-success/20 text-success border-success/30";
      case "cancelled":
      case "failed":
        return "bg-destructive/20 text-destructive border-destructive/30";
      default:
        return "bg-surface-hover/20 text-muted-foreground border-border-strong/30";
    }
  };

  const filteredBookings = bookings.filter((booking) => {
    const matchesSearch =
      !filters.search ||
      booking.id.toLowerCase().includes(filters.search.toLowerCase()) ||
      booking.pickup_address?.city
        ?.toLowerCase()
        .includes(filters.search.toLowerCase()) ||
      booking.dropoff_address?.city
        ?.toLowerCase()
        .includes(filters.search.toLowerCase());

    const matchesStatus = !filters.status || booking.status === filters.status;

    const matchesDate =
      (!filters.dateFrom ||
        dayjs(booking.created_at).isAfter(dayjs(filters.dateFrom))) &&
      (!filters.dateTo ||
        dayjs(booking.created_at).isBefore(dayjs(filters.dateTo)));

    return matchesSearch && matchesStatus && matchesDate;
  })
    // Defensive newest-first sort. The backend already returns bookings ordered
    // by -created_at (see getBookingHistory), but sorting here keeps history
    // correct even if a future endpoint change regresses that ordering.
    .sort((a, b) => dayjs(b.created_at).valueOf() - dayjs(a.created_at).valueOf());

  const filteredQuotes = quotes.filter((quote) => {
    const matchesSearch =
      !filters.search ||
      quote.id.toLowerCase().includes(filters.search.toLowerCase()) ||
      quote.service_type?.name
        ?.toLowerCase()
        .includes(filters.search.toLowerCase());

    const matchesDate =
      (!filters.dateFrom ||
        dayjs(quote.created_at).isAfter(dayjs(filters.dateFrom))) &&
      (!filters.dateTo ||
        dayjs(quote.created_at).isBefore(dayjs(filters.dateTo)));

    return matchesSearch && matchesDate;
  });

  if (!isAuthenticated) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-card to-background pt-24 pb-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <h1 className="text-4xl font-bold text-foreground mb-2">Booking History</h1>
          <p className="text-muted-foreground">Manage your bookings and quotes</p>
        </motion.div>

        {/* MODERN DESIGN UPGRADE: Segmented control tabs */}
        {/* NAVIGATION & PROFILE UPGRADE: Removed quotes tab - quotes can be created fresh via /quote route */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex space-x-1 mb-6 bg-card/50 border border-border p-1 rounded-xl w-fit"
        >
          {[
            { id: "bookings", label: `Bookings (${filteredBookings.length})` },
          ].map((tab) => (
            <motion.button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className={`px-6 py-3 rounded-lg font-bold transition-all duration-300 ${
                activeTab === tab.id
                  ? "bg-gradient-to-r from-primary to-primary-hover text-primary-foreground shadow-lg shadow-primary/30"
                  : "text-muted-foreground hover:text-primary-foreground hover:bg-surface/50"
              }`}
            >
              {tab.label}
            </motion.button>
          ))}
        </motion.div>

        {/* Filters */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-card/50 border border-border rounded-xl p-4 sm:p-6 mb-6"
        >
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {/* Search */}
            <div className="relative">
              <Search
                className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground"
                size={18}
              />
              <input
                type="text"
                placeholder="Search by ID or location..."
                value={filters.search}
                onChange={(e) =>
                  setFilters({ ...filters, search: e.target.value })
                }
                className="w-full pl-10 pr-4 py-3 bg-background border border-border hover:border-primary/30 rounded-lg text-foreground placeholder-subtle-foreground focus:outline-none focus:ring-2 focus:ring-ring/20 focus:border-primary transition-all"
              />
            </div>

            {/* Date From */}
            <div>
              <input
                type="date"
                value={filters.dateFrom}
                onChange={(e) =>
                  setFilters({ ...filters, dateFrom: e.target.value })
                }
                className="w-full px-4 py-3 bg-background border border-border hover:border-primary/30 rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-ring/20 focus:border-primary transition-all"
              />
            </div>

            {/* Date To */}
            <div>
              <input
                type="date"
                value={filters.dateTo}
                onChange={(e) =>
                  setFilters({ ...filters, dateTo: e.target.value })
                }
                className="w-full px-4 py-3 bg-background border border-border hover:border-primary/30 rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-ring/20 focus:border-primary transition-all"
              />
            </div>

            {/* Status Filter (only for bookings) */}
            {activeTab === "bookings" && (
              <div>
                <select
                  value={filters.status}
                  onChange={(e) =>
                    setFilters({ ...filters, status: e.target.value })
                  }
                  className="w-full px-4 py-3 bg-background border border-border hover:border-primary/30 rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-ring/20 focus:border-primary transition-all"
                >
                  <option value="">All Statuses</option>
                  <option value="pending">Pending</option>
                  <option value="scheduled">Scheduled</option>
                  <option value="assigned">Assigned</option>
                  <option value="picked_up">Picked Up</option>
                  <option value="at_hub">At Hub</option>
                  <option value="in_transit">In Transit</option>
                  <option value="delivered">Delivered</option>
                  <option value="cancelled">Cancelled</option>
                  <option value="failed">Failed</option>
                  <option value="refunded">Refunded</option>
                </select>
              </div>
            )}
          </div>
        </motion.div>

        {/* Loading State */}
        {loading && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex items-center justify-center py-12"
          >
            <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity }}>
              <Loader2 className="text-brand-text" size={32} />
            </motion.div>
            <span className="ml-4 text-muted-foreground">Loading your history...</span>
          </motion.div>
        )}

        {/* Error State */}
        {error && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-destructive/10 border border-destructive/20 rounded-xl p-6 mb-6"
          >
            <div className="flex items-start gap-4">
              <AlertCircle className="text-destructive flex-shrink-0" size={24} />
              <div className="flex-1">
                <h3 className="text-destructive font-bold mb-2">Error</h3>
                <p className="text-destructive mb-4">{error}</p>
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  onClick={fetchData}
                  className="bg-destructive hover:bg-destructive text-destructive-foreground px-4 py-2 rounded-lg font-bold transition-colors"
                >
                  Try Again
                </motion.button>
              </div>
            </div>
          </motion.div>
        )}

        {/* Content */}
        {!loading && !error && (
          <div className="space-y-4">
            <AnimatePresence mode="wait">
              {activeTab === "bookings" && (
                <motion.div
                  key="bookings"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="space-y-4"
                >
                  {filteredBookings.length === 0 ? (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="text-center py-12"
                    >
                      <Package className="mx-auto text-muted-foreground mb-4" size={56} />
                      <h3 className="text-xl font-bold text-foreground mb-2">
                        No bookings yet
                      </h3>
                      <p className="text-muted-foreground mb-6">
                        Start by getting a quote for your delivery
                      </p>
                      <motion.button
                        whileHover={{ scale: 1.05 }}
                        onClick={() => navigate("/")}
                        className="bg-gradient-to-r from-primary to-primary-hover hover:from-primary-hover hover:to-primary-hover text-primary-foreground px-6 py-3 rounded-lg font-bold transition-all inline-flex items-center gap-2 shadow-lg hover:shadow-primary/30"
                      >
                        <Plus size={18} />
                        Get a Quote
                      </motion.button>
                    </motion.div>
                  ) : (
                    getPaginatedBookings().map((booking, idx) => (
                      <motion.div
                        key={booking.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: idx * 0.05 }}
                        whileHover={{ y: -2 }}
                        className="bg-card/50 border border-border hover:border-primary/30 rounded-xl p-6 transition-all duration-300 hover:shadow-lg hover:shadow-primary/10"
                      >
                        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                          <div className="flex-1">
                            <div className="flex items-center gap-3 mb-4">
                              <h3 className="text-foreground font-bold text-lg">
                                #{booking.id.slice(0, 8)}
                              </h3>
                              <motion.span
                                initial={{ scale: 0 }}
                                animate={{ scale: 1 }}
                                className={`flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold border ${getStatusColor(
                                  booking.status
                                )}`}
                              >
                                {getStatusIcon(booking.status)}
                                {booking.status}
                              </motion.span>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                              <div className="flex items-start gap-3">
                                <MapPin className="text-success mt-1 flex-shrink-0" size={16} />
                                <div>
                                  <p className="text-muted-foreground text-sm">Pickup</p>
                                  <p className="text-foreground font-medium">
                                    {booking.pickup_address?.line1}
                                  </p>
                                  <p className="text-muted-foreground text-sm">
                                    {booking.pickup_address?.city}
                                  </p>
                                </div>
                              </div>

                              <div className="flex items-start gap-3">
                                <MapPin className="text-destructive mt-1 flex-shrink-0" size={16} />
                                <div>
                                  <p className="text-muted-foreground text-sm">Dropoff</p>
                                  <p className="text-foreground font-medium">
                                    {booking.dropoff_address?.line1}
                                  </p>
                                  <p className="text-muted-foreground text-sm">
                                    {booking.dropoff_address?.city}
                                  </p>
                                </div>
                              </div>
                            </div>

                            <div className="flex flex-wrap items-center gap-6 text-sm text-muted-foreground">
                              <div className="flex items-center gap-2">
                                <Clock size={16} />
                                <span>
                                  {dayjs(booking.created_at).format(
                                    "MMM D, YYYY h:mm A"
                                  )}
                                </span>
                              </div>
                              <div className="flex items-center gap-2">
                                <CreditCard size={16} />
                                <span className="text-foreground font-semibold">
                                  £{booking.final_price}
                                </span>
                              </div>
                            </div>
                          </div>

                          {/* Action Buttons: View Details & Download Invoice */}
                          <div className="flex flex-col sm:flex-row gap-3 lg:ml-auto w-full sm:w-auto">
                            <motion.button
                              whileHover={{ scale: 1.05 }}
                              whileTap={{ scale: 0.95 }}
                              onClick={() => {
                                setSelectedBooking(booking);
                                setShowDetailsModal(true);
                                setTrackingCopied(false);
                              }}
                              className="flex-1 sm:flex-none bg-primary hover:bg-primary-hover text-primary-foreground px-6 py-2 rounded-lg font-bold transition-colors flex items-center justify-center gap-2 whitespace-nowrap"
                            >
                              <Eye size={16} />
                              View Details
                            </motion.button>

                            {canDownloadInvoice(booking.status) && (
                              <motion.button
                                whileHover={{ scale: 1.05 }}
                                whileTap={{ scale: 0.95 }}
                                disabled={isDownloadingInvoice}
                                onClick={() => handleDownloadInvoice(booking.id)}
                                className="flex-1 sm:flex-none bg-info hover:bg-info disabled:bg-info/50 text-info-foreground px-6 py-2 rounded-lg font-bold transition-colors flex items-center justify-center gap-2 whitespace-nowrap"
                              >
                                {isDownloadingInvoice ? (
                                  <>
                                    <Loader2 size={16} className="animate-spin" />
                                    Downloading...
                                  </>
                                ) : (
                                  <>
                                    <FileText size={16} />
                                    Invoice
                                  </>
                                )}
                              </motion.button>
                            )}
                          </div>
                        </div>
                      </motion.div>
                    ))
                  )}

                  {/* Pagination Controls */}
                  {filteredBookings.length > ITEMS_PER_PAGE && (
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="flex items-center justify-between bg-card/50 border border-border rounded-xl p-4 mt-8"
                    >
                      <div className="text-muted-foreground text-sm">
                        Showing {(currentPage - 1) * ITEMS_PER_PAGE + 1} to {Math.min(currentPage * ITEMS_PER_PAGE, filteredBookings.length)} of {filteredBookings.length} bookings
                      </div>

                      <div className="flex items-center gap-2">
                        <motion.button
                          whileHover={{ scale: 1.05 }}
                          whileTap={{ scale: 0.95 }}
                          disabled={currentPage === 1}
                          onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                          className="p-2 rounded-lg bg-surface hover:bg-primary/20 text-muted-foreground hover:text-brand-text disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                          <ChevronLeft size={18} />
                        </motion.button>

                        <div className="flex items-center gap-2">
                          {Array.from({ length: getTotalPages() }, (_, i) => i + 1).map((page) => (
                            <motion.button
                              key={page}
                              whileHover={{ scale: 1.05 }}
                              whileTap={{ scale: 0.95 }}
                              onClick={() => setCurrentPage(page)}
                              className={`w-10 h-10 rounded-lg font-semibold transition-all ${
                                currentPage === page
                                  ? "bg-gradient-to-r from-primary to-primary-hover text-primary-foreground shadow-lg shadow-primary/30"
                                  : "bg-surface text-muted-foreground hover:text-primary-foreground hover:bg-surface-hover"
                              }`}
                            >
                              {page}
                            </motion.button>
                          ))}
                        </div>

                        <motion.button
                          whileHover={{ scale: 1.05 }}
                          whileTap={{ scale: 0.95 }}
                          disabled={currentPage === getTotalPages()}
                          onClick={() => setCurrentPage((p) => Math.min(getTotalPages(), p + 1))}
                          className="p-2 rounded-lg bg-surface hover:bg-primary/20 text-muted-foreground hover:text-brand-text disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                          <ChevronRight size={18} />
                        </motion.button>
                      </div>
                    </motion.div>
                  )}
                </motion.div>
              )}

              {/* NAVIGATION & PROFILE UPGRADE: Quotes tab removed - create quotes via /quote route */}
            </AnimatePresence>
          </div>
        )}

        {/* NAVIGATION & PROFILE UPGRADE: Booking Details Modal */}
        <AnimatePresence>
          {showDetailsModal && selectedBooking && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowDetailsModal(false)}
              // Mobile fix: the overlay itself must scroll. `100vh` on mobile
              // browsers doesn't match the real visible viewport (address
              // bar/toolbar), so a purely `items-center` overlay with no
              // scroll of its own can clip the modal above/below the visible
              // screen with no way to reach the rest of it.
              className="fixed inset-0 bg-overlay z-50 overflow-y-auto"
            >
              <div className="min-h-full flex items-center justify-center p-4">
                <motion.div
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  onClick={(e) => e.stopPropagation()}
                  // max-h-[85dvh] (dynamic viewport height) overrides the vh
                  // value on browsers that support it, keeping the modal
                  // within the real visible area on mobile. min-w-0 is
                  // required because this is a flex item: flex items default
                  // to min-width:auto, so without it the card refuses to
                  // shrink below its content's natural width and gets pushed
                  // off-screen on narrow phones instead of respecting
                  // max-w-2xl/w-full.
                  className="bg-gradient-to-br from-card to-background border-2 border-primary/30 rounded-2xl max-w-2xl w-full min-w-0 my-8 max-h-[85vh] max-h-[85dvh] overflow-y-auto overflow-x-hidden"
                >
                {/* Modal Header */}
                <div className="sticky top-0 bg-gradient-to-r from-card to-background border-b border-border px-4 py-4 sm:px-6 sm:py-6 flex items-center justify-between">
                  <div>
                    <h2 className="text-2xl font-bold text-foreground">
                      Booking #{selectedBooking.id.slice(0, 8)}
                    </h2>
                    <p className="text-sm text-muted-foreground mt-1">
                      {dayjs(selectedBooking.created_at).format(
                        "MMMM D, YYYY h:mm A"
                      )}
                    </p>
                  </div>
                  <motion.button
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => setShowDetailsModal(false)}
                    className="text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <X size={24} />
                  </motion.button>
                </div>

                {/* Modal Content */}
                <div className="p-4 sm:p-6 space-y-6">
                  {/* Status */}
                  <div className="flex items-center gap-3">
                    <h3 className="text-muted-foreground text-sm uppercase tracking-wider">Status</h3>
                    <motion.span
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-bold border ${getStatusColor(
                        selectedBooking.status
                      )}`}
                    >
                      {getStatusIcon(selectedBooking.status)}
                      {selectedBooking.status}
                    </motion.span>
                  </div>

                  {/* Tracking Number */}
                  {selectedBooking.tracking_number && (
                    <div className="bg-surface/30 border border-border/30 rounded-lg p-4">
                      <p className="text-muted-foreground text-sm uppercase tracking-wider mb-2">
                        Tracking Number
                      </p>
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="text-lg font-bold text-foreground font-mono break-all">
                          {selectedBooking.tracking_number}
                        </p>
                        <button
                          onClick={() => {
                            navigator.clipboard.writeText(
                              selectedBooking.tracking_number
                            );
                            setTrackingCopied(true);
                            setTimeout(() => setTrackingCopied(false), 2000);
                          }}
                          className={`text-sm font-bold transition-colors ${
                            trackingCopied
                              ? "text-success"
                              : "text-brand-text hover:text-brand-text"
                          }`}
                        >
                          {trackingCopied ? "Copied!" : "Copy"}
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Addresses */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="bg-surface/30 border border-border/30 rounded-lg p-4">
                      <p className="text-success text-sm uppercase tracking-wider font-bold mb-3">
                        Pickup Location
                      </p>
                      <p className="text-foreground font-medium">
                        {selectedBooking.pickup_address?.line1}
                      </p>
                      {selectedBooking.pickup_address?.line2 && (
                        <p className="text-muted-foreground text-sm">
                          {selectedBooking.pickup_address.line2}
                        </p>
                      )}
                      <p className="text-muted-foreground text-sm">
                        {selectedBooking.pickup_address?.city},{" "}
                        {selectedBooking.pickup_address?.postal_code}
                      </p>
                    </div>

                    <div className="bg-surface/30 border border-border/30 rounded-lg p-4">
                      <p className="text-destructive text-sm uppercase tracking-wider font-bold mb-3">
                        Delivery Location
                      </p>
                      <p className="text-foreground font-medium">
                        {selectedBooking.dropoff_address?.line1}
                      </p>
                      {selectedBooking.dropoff_address?.line2 && (
                        <p className="text-muted-foreground text-sm">
                          {selectedBooking.dropoff_address.line2}
                        </p>
                      )}
                      <p className="text-muted-foreground text-sm">
                        {selectedBooking.dropoff_address?.city},{" "}
                        {selectedBooking.dropoff_address?.postal_code}
                      </p>
                    </div>
                  </div>

                  {/* Price and Distance */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="bg-surface/30 border border-border/30 rounded-lg p-4">
                      <p className="text-muted-foreground text-xs uppercase tracking-wider mb-2">
                        Price
                      </p>
                      <p className="text-brand-text font-bold text-lg">
                        £{selectedBooking.final_price}
                      </p>
                    </div>

                    <div className="bg-surface/30 border border-border/30 rounded-lg p-4">
                      <p className="text-muted-foreground text-xs uppercase tracking-wider mb-2">
                        Distance
                      </p>
                      <p className="text-foreground font-semibold">
                        {selectedBooking.quote?.distance_km != null
                          ? `${Number(selectedBooking.quote.distance_km).toFixed(1)} km`
                          : "—"}
                      </p>
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex flex-col sm:flex-row gap-3 pt-4 border-t border-border">
                    {canDownloadInvoice(selectedBooking.status) && (
                      <motion.button
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        disabled={isDownloadingInvoice}
                        onClick={() => handleDownloadInvoice(selectedBooking.id)}
                        className="flex-1 px-4 py-3 bg-info hover:bg-info disabled:bg-info/50 text-info-foreground font-bold rounded-lg transition-all flex items-center justify-center gap-2"
                      >
                        {isDownloadingInvoice ? (
                          <>
                            <Loader2 size={16} className="animate-spin" />
                            Downloading...
                          </>
                        ) : (
                          <>
                            <FileText size={16} />
                            Download Invoice
                          </>
                        )}
                      </motion.button>
                    )}
                    <motion.button
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => setShowDetailsModal(false)}
                      className="flex-1 px-4 py-3 bg-gradient-to-r from-primary to-primary-hover hover:from-primary-hover hover:to-primary-hover text-primary-foreground font-bold rounded-lg transition-all"
                    >
                      Close
                    </motion.button>
                    {selectedBooking.tracking_number && (
                      <motion.button
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={() => {
                          setShowDetailsModal(false);
                          setTrackNumberToShow(selectedBooking.tracking_number);
                          setShowTrackModal(true);
                        }}
                        className="flex-1 px-4 py-3 border-2 border-primary/30 text-brand-text font-bold rounded-lg hover:border-primary/60 transition-all"
                      >
                        Track Now
                      </motion.button>
                    )}
                  </div>
                </div>
                </motion.div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <TrackParcelModal
          isOpen={showTrackModal}
          onClose={() => setShowTrackModal(false)}
          initialTrackingNumber={trackNumberToShow}
        />
      </div>
    </div>
  );
}