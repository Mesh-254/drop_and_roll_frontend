"use client";
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
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
} from "lucide-react";
import { useAuth } from "../../contexts/AuthContext";
import { bookingApi } from "../../api/BookingApi";
import dayjs from "dayjs";

// MODERN DESIGN UPGRADE: Premium dark-mode booking history with tabs, cards, filters
// NAVIGATION & PROFILE UPGRADE: Added modal state for booking details view
export default function BookingHistory() {
  const navigate = useNavigate();
  const { isAuthenticated, user } = useAuth();
  const [activeTab, setActiveTab] = useState("bookings");
  const [bookings, setBookings] = useState([]);
  const [quotes, setQuotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedBooking, setSelectedBooking] = useState(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [filters, setFilters] = useState({
    dateFrom: "",
    dateTo: "",
    status: "",
    search: "",
  });

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

      const [bookingsResponse, quotesResponse] = await Promise.all([
        bookingApi.getBookings(),
        bookingApi.getQuotes(),
      ]);
      setBookings(bookingsResponse.data || []);
      setQuotes(quotesResponse.data || []);
      console.log("Fetched bookings:", bookingsResponse.data);
      console.log("Fetched quotes:", quotesResponse.data);
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

  const getStatusIcon = (status) => {
    switch (status?.toLowerCase()) {
      case "pending":
      case "scheduled":
        return <Clock className="text-yellow-400" size={16} />;
      case "in-progress":
      case "assigned":
        return <Package className="text-orange-400" size={16} />;
      case "completed":
      case "delivered":
        return <CheckCircle className="text-green-400" size={16} />;
      case "cancelled":
      case "failed":
        return <XCircle className="text-red-400" size={16} />;
      default:
        return <Package className="text-gray-400" size={16} />;
    }
  };

  const getStatusColor = (status) => {
    switch (status?.toLowerCase()) {
      case "pending":
      case "scheduled":
        return "bg-yellow-500/20 text-yellow-400 border-yellow-500/30";
      case "in-progress":
      case "assigned":
        return "bg-orange-500/20 text-orange-400 border-orange-500/30";
      case "completed":
      case "delivered":
        return "bg-green-500/20 text-green-400 border-green-500/30";
      case "cancelled":
      case "failed":
        return "bg-red-500/20 text-red-400 border-red-500/30";
      default:
        return "bg-gray-500/20 text-gray-400 border-gray-500/30";
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
  });

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
    <div className="min-h-screen bg-gradient-to-br from-black via-gray-900 to-black pt-24 pb-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <h1 className="text-4xl font-bold text-white mb-2">Booking History</h1>
          <p className="text-gray-400">Manage your bookings and quotes</p>
        </motion.div>

        {/* MODERN DESIGN UPGRADE: Segmented control tabs */}
        {/* NAVIGATION & PROFILE UPGRADE: Removed quotes tab - quotes can be created fresh via /quote route */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex space-x-1 mb-6 bg-gray-900/50 border border-gray-800 p-1 rounded-xl w-fit"
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
                  ? "bg-gradient-to-r from-orange-500 to-orange-600 text-white shadow-lg shadow-orange-500/30"
                  : "text-gray-400 hover:text-white hover:bg-gray-800/50"
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
          className="bg-gray-900/50 border border-gray-800 rounded-xl p-4 sm:p-6 mb-6"
        >
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {/* Search */}
            <div className="relative">
              <Search
                className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400"
                size={18}
              />
              <input
                type="text"
                placeholder="Search by ID or location..."
                value={filters.search}
                onChange={(e) =>
                  setFilters({ ...filters, search: e.target.value })
                }
                className="w-full pl-10 pr-4 py-3 bg-black border border-gray-700 hover:border-orange-500/30 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-all"
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
                className="w-full px-4 py-3 bg-black border border-gray-700 hover:border-orange-500/30 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-all"
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
                className="w-full px-4 py-3 bg-black border border-gray-700 hover:border-orange-500/30 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-all"
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
                  className="w-full px-4 py-3 bg-black border border-gray-700 hover:border-orange-500/30 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-all"
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
              <Loader2 className="text-orange-500" size={32} />
            </motion.div>
            <span className="ml-4 text-gray-400">Loading your history...</span>
          </motion.div>
        )}

        {/* Error State */}
        {error && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-red-500/10 border border-red-500/20 rounded-xl p-6 mb-6"
          >
            <div className="flex items-start gap-4">
              <AlertCircle className="text-red-400 flex-shrink-0" size={24} />
              <div className="flex-1">
                <h3 className="text-red-400 font-bold mb-2">Error</h3>
                <p className="text-red-300 mb-4">{error}</p>
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  onClick={fetchData}
                  className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-lg font-bold transition-colors"
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
                      <Package className="mx-auto text-gray-600 mb-4" size={56} />
                      <h3 className="text-xl font-bold text-white mb-2">
                        No bookings yet
                      </h3>
                      <p className="text-gray-400 mb-6">
                        Start by getting a quote for your delivery
                      </p>
                      <motion.button
                        whileHover={{ scale: 1.05 }}
                        onClick={() => navigate("/")}
                        className="bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white px-6 py-3 rounded-lg font-bold transition-all inline-flex items-center gap-2 shadow-lg hover:shadow-orange-500/30"
                      >
                        <Plus size={18} />
                        Get a Quote
                      </motion.button>
                    </motion.div>
                  ) : (
                    filteredBookings.map((booking, idx) => (
                      <motion.div
                        key={booking.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: idx * 0.05 }}
                        whileHover={{ y: -2 }}
                        className="bg-gray-900/50 border border-gray-800 hover:border-orange-500/30 rounded-xl p-6 transition-all duration-300 hover:shadow-lg hover:shadow-orange-500/10"
                      >
                        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                          <div className="flex-1">
                            <div className="flex items-center gap-3 mb-4">
                              <h3 className="text-white font-bold text-lg">
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
                                <MapPin className="text-green-400 mt-1 flex-shrink-0" size={16} />
                                <div>
                                  <p className="text-gray-400 text-sm">Pickup</p>
                                  <p className="text-white font-medium">
                                    {booking.pickup_address?.line1}
                                  </p>
                                  <p className="text-gray-400 text-sm">
                                    {booking.pickup_address?.city}
                                  </p>
                                </div>
                              </div>

                              <div className="flex items-start gap-3">
                                <MapPin className="text-red-400 mt-1 flex-shrink-0" size={16} />
                                <div>
                                  <p className="text-gray-400 text-sm">Dropoff</p>
                                  <p className="text-white font-medium">
                                    {booking.dropoff_address?.line1}
                                  </p>
                                  <p className="text-gray-400 text-sm">
                                    {booking.dropoff_address?.city}
                                  </p>
                                </div>
                              </div>
                            </div>

                            <div className="flex flex-wrap items-center gap-6 text-sm text-gray-400">
                              <div className="flex items-center gap-2">
                                <Clock size={16} />
                                <span>
                                  {dayjs(booking.scheduled_pickup_at).format(
                                    "MMM D, YYYY h:mm A"
                                  )}
                                </span>
                              </div>
                              <div className="flex items-center gap-2">
                                <CreditCard size={16} />
                                <span className="text-white font-semibold">
                                  £{booking.final_price}
                                </span>
                              </div>
                            </div>
                          </div>

                          {/* NAVIGATION & PROFILE UPGRADE: View Details button opens modal */}
                          <motion.button
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                            onClick={() => {
                              setSelectedBooking(booking);
                              setShowDetailsModal(true);
                            }}
                            className="lg:ml-auto bg-orange-500 hover:bg-orange-600 text-white px-6 py-2 rounded-lg font-bold transition-colors flex items-center gap-2 whitespace-nowrap"
                          >
                            <Eye size={16} />
                            View Details
                          </motion.button>
                        </div>
                      </motion.div>
                    ))
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
              className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
            >
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                onClick={(e) => e.stopPropagation()}
                className="bg-gradient-to-br from-gray-900 to-black border-2 border-orange-500/30 rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto"
              >
                {/* Modal Header */}
                <div className="sticky top-0 bg-gradient-to-r from-gray-900 to-black border-b border-gray-800 px-6 py-6 flex items-center justify-between">
                  <div>
                    <h2 className="text-2xl font-bold text-white">
                      Booking #{selectedBooking.id.slice(0, 8)}
                    </h2>
                    <p className="text-sm text-gray-400 mt-1">
                      {dayjs(selectedBooking.created_at).format(
                        "MMMM D, YYYY h:mm A"
                      )}
                    </p>
                  </div>
                  <motion.button
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => setShowDetailsModal(false)}
                    className="text-gray-400 hover:text-white transition-colors"
                  >
                    <X size={24} />
                  </motion.button>
                </div>

                {/* Modal Content */}
                <div className="p-6 space-y-6">
                  {/* Status */}
                  <div className="flex items-center gap-3">
                    <h3 className="text-gray-400 text-sm uppercase tracking-wider">Status</h3>
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
                    <div className="bg-gray-800/30 border border-gray-700/30 rounded-lg p-4">
                      <p className="text-gray-400 text-sm uppercase tracking-wider mb-2">
                        Tracking Number
                      </p>
                      <div className="flex items-center justify-between">
                        <p className="text-lg font-bold text-white font-mono">
                          {selectedBooking.tracking_number}
                        </p>
                        <button
                          onClick={() => {
                            navigator.clipboard.writeText(
                              selectedBooking.tracking_number
                            );
                            alert("Tracking number copied!");
                          }}
                          className="text-orange-400 hover:text-orange-300 text-sm font-bold"
                        >
                          Copy
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Addresses */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="bg-gray-800/30 border border-gray-700/30 rounded-lg p-4">
                      <p className="text-green-400 text-sm uppercase tracking-wider font-bold mb-3">
                        Pickup Location
                      </p>
                      <p className="text-white font-medium">
                        {selectedBooking.pickup_address?.line1}
                      </p>
                      {selectedBooking.pickup_address?.line2 && (
                        <p className="text-gray-400 text-sm">
                          {selectedBooking.pickup_address.line2}
                        </p>
                      )}
                      <p className="text-gray-400 text-sm">
                        {selectedBooking.pickup_address?.city},{" "}
                        {selectedBooking.pickup_address?.postal_code}
                      </p>
                    </div>

                    <div className="bg-gray-800/30 border border-gray-700/30 rounded-lg p-4">
                      <p className="text-red-400 text-sm uppercase tracking-wider font-bold mb-3">
                        Delivery Location
                      </p>
                      <p className="text-white font-medium">
                        {selectedBooking.dropoff_address?.line1}
                      </p>
                      {selectedBooking.dropoff_address?.line2 && (
                        <p className="text-gray-400 text-sm">
                          {selectedBooking.dropoff_address.line2}
                        </p>
                      )}
                      <p className="text-gray-400 text-sm">
                        {selectedBooking.dropoff_address?.city},{" "}
                        {selectedBooking.dropoff_address?.postal_code}
                      </p>
                    </div>
                  </div>

                  {/* Dates and Price */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="bg-gray-800/30 border border-gray-700/30 rounded-lg p-4">
                      <p className="text-gray-400 text-xs uppercase tracking-wider mb-2">
                        Scheduled Pickup
                      </p>
                      <p className="text-white font-semibold">
                        {dayjs(selectedBooking.scheduled_pickup_at).format(
                          "MMM D, h:mm A"
                        )}
                      </p>
                    </div>

                    <div className="bg-gray-800/30 border border-gray-700/30 rounded-lg p-4">
                      <p className="text-gray-400 text-xs uppercase tracking-wider mb-2">
                        Price
                      </p>
                      <p className="text-orange-400 font-bold text-lg">
                        £{selectedBooking.final_price}
                      </p>
                    </div>

                    <div className="bg-gray-800/30 border border-gray-700/30 rounded-lg p-4">
                      <p className="text-gray-400 text-xs uppercase tracking-wider mb-2">
                        Distance
                      </p>
                      <p className="text-white font-semibold">
                        {selectedBooking.distance_km?.toFixed(1) || "—"} km
                      </p>
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex gap-3 pt-4 border-t border-gray-800">
                    <motion.button
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => setShowDetailsModal(false)}
                      className="flex-1 px-4 py-3 bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white font-bold rounded-lg transition-all"
                    >
                      Close
                    </motion.button>
                    {selectedBooking.tracking_number && (
                      <motion.button
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={() => {
                          setShowDetailsModal(false);
                          // TODO: Open track modal with tracking number
                          navigate(`/tracking?track=${selectedBooking.tracking_number}`);
                        }}
                        className="flex-1 px-4 py-3 border-2 border-orange-500/30 text-orange-400 font-bold rounded-lg hover:border-orange-500/60 transition-all"
                      >
                        Track Now
                      </motion.button>
                    )}
                  </div>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
