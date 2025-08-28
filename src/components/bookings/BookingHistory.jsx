"use client"
import { useState, useEffect } from "react"
import { useNavigate } from "react-router-dom"
import { Calendar, Package, Clock, MapPin, CreditCard, Search, Plus, Loader2, AlertCircle } from "lucide-react"
import { useAuth } from "../../contexts/AuthContext"
import { bookingApi } from "../../api/BookingApi"
import dayjs from "dayjs"

export default function BookingHistory() {
  const navigate = useNavigate()
  const { isAuthenticated, user } = useAuth()
  const [activeTab, setActiveTab] = useState("bookings")
  const [bookings, setBookings] = useState([])
  const [quotes, setQuotes] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [filters, setFilters] = useState({
    dateFrom: "",
    dateTo: "",
    status: "",
    search: "",
  })

  // Redirect if not authenticated
  useEffect(() => {
    if (!isAuthenticated) {
      navigate("/login")
      return
    }
  }, [isAuthenticated, navigate])

  // Fetch data on component mount
  useEffect(() => {
    if (isAuthenticated) {
      fetchData()
    }
  }, [isAuthenticated])

  const fetchData = async () => {
    try {
      setLoading(true)
      setError(null)

      const [bookingsResponse, quotesResponse] = await Promise.all([bookingApi.getBookings(), bookingApi.getQuotes()])

      setBookings(bookingsResponse.data || [])
      setQuotes(quotesResponse.data || [])
    } catch (err) {
      console.error("Failed to fetch data:", err)
      setError("Failed to load your booking history. Please try again.")
    } finally {
      setLoading(false)
    }
  }

  const handleBookNow = (quote) => {
    navigate("/booking", { state: { quote } })
  }

  const getStatusColor = (status) => {
    const colors = {
      pending: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
      "in-progress": "bg-blue-500/20 text-blue-400 border-blue-500/30",
      completed: "bg-green-500/20 text-green-400 border-green-500/30",
      cancelled: "bg-red-500/20 text-red-400 border-red-500/30",
    }
    return colors[status?.toLowerCase()] || "bg-gray-500/20 text-gray-400 border-gray-500/30"
  }

  const filteredBookings = bookings.filter((booking) => {
    const matchesSearch =
      !filters.search ||
      booking.id.toLowerCase().includes(filters.search.toLowerCase()) ||
      booking.pickup_address?.city?.toLowerCase().includes(filters.search.toLowerCase()) ||
      booking.dropoff_address?.city?.toLowerCase().includes(filters.search.toLowerCase())

    const matchesStatus = !filters.status || booking.status === filters.status

    const matchesDate =
      (!filters.dateFrom || dayjs(booking.created_at).isAfter(dayjs(filters.dateFrom))) &&
      (!filters.dateTo || dayjs(booking.created_at).isBefore(dayjs(filters.dateTo)))

    return matchesSearch && matchesStatus && matchesDate
  })

  const filteredQuotes = quotes.filter((quote) => {
    const matchesSearch =
      !filters.search ||
      quote.id.toLowerCase().includes(filters.search.toLowerCase()) ||
      quote.service_type?.name?.toLowerCase().includes(filters.search.toLowerCase())

    const matchesDate =
      (!filters.dateFrom || dayjs(quote.created_at).isAfter(dayjs(filters.dateFrom))) &&
      (!filters.dateTo || dayjs(quote.created_at).isBefore(dayjs(filters.dateTo)))

    return matchesSearch && matchesDate
  })

  if (!isAuthenticated) {
    return null // Will redirect
  }

  return (
    <div className="min-h-screen bg-black pt-24 pb-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">Booking History</h1>
          <p className="text-gray-400">Manage your bookings and quotes</p>
        </div>

        {/* Tabs */}
        <div className="flex space-x-1 mb-6 bg-gray-900 p-1 rounded-lg w-fit">
          <button
            onClick={() => setActiveTab("bookings")}
            className={`px-6 py-2 rounded-md font-medium transition-all duration-200 ${
              activeTab === "bookings" ? "bg-orange-500 text-white" : "text-gray-400 hover:text-white hover:bg-gray-800"
            }`}
          >
            Bookings ({filteredBookings.length})
          </button>
          <button
            onClick={() => setActiveTab("quotes")}
            className={`px-6 py-2 rounded-md font-medium transition-all duration-200 ${
              activeTab === "quotes" ? "bg-orange-500 text-white" : "text-gray-400 hover:text-white hover:bg-gray-800"
            }`}
          >
            Quotes ({filteredQuotes.length})
          </button>
        </div>

        {/* Filters */}
        <div className="bg-gray-900 rounded-lg p-6 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
              <input
                type="text"
                placeholder="Search by ID or location..."
                value={filters.search}
                onChange={(e) => setFilters({ ...filters, search: e.target.value })}
                className="w-full pl-10 pr-4 py-2 bg-black border border-gray-700 rounded-lg text-white placeholder-gray-400 focus:border-orange-500 focus:outline-none"
              />
            </div>

            {/* Date From */}
            <div>
              <input
                type="date"
                value={filters.dateFrom}
                onChange={(e) => setFilters({ ...filters, dateFrom: e.target.value })}
                className="w-full px-4 py-2 bg-black border border-gray-700 rounded-lg text-white focus:border-orange-500 focus:outline-none"
              />
            </div>

            {/* Date To */}
            <div>
              <input
                type="date"
                value={filters.dateTo}
                onChange={(e) => setFilters({ ...filters, dateTo: e.target.value })}
                className="w-full px-4 py-2 bg-black border border-gray-700 rounded-lg text-white focus:border-orange-500 focus:outline-none"
              />
            </div>

            {/* Status Filter (only for bookings) */}
            {activeTab === "bookings" && (
              <div>
                <select
                  value={filters.status}
                  onChange={(e) => setFilters({ ...filters, status: e.target.value })}
                  className="w-full px-4 py-2 bg-black border border-gray-700 rounded-lg text-white focus:border-orange-500 focus:outline-none"
                >
                  <option value="">All Statuses</option>
                  <option value="pending">Pending</option>
                  <option value="in-progress">In Progress</option>
                  <option value="completed">Completed</option>
                  <option value="cancelled">Cancelled</option>
                </select>
              </div>
            )}
          </div>
        </div>

        {/* Loading State */}
        {loading && (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="animate-spin text-orange-500" size={32} />
            <span className="ml-3 text-gray-400">Loading your history...</span>
          </div>
        )}

        {/* Error State */}
        {error && (
          <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-6 mb-6">
            <div className="flex items-center space-x-3">
              <AlertCircle className="text-red-400" size={24} />
              <div>
                <h3 className="text-red-400 font-medium">Error</h3>
                <p className="text-red-300">{error}</p>
              </div>
            </div>
            <button
              onClick={fetchData}
              className="mt-4 bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-lg transition-colors"
            >
              Try Again
            </button>
          </div>
        )}

        {/* Content */}
        {!loading && !error && (
          <>
            {/* Bookings Tab */}
            {activeTab === "bookings" && (
              <div className="space-y-4">
                {filteredBookings.length === 0 ? (
                  <div className="text-center py-12">
                    <Package className="mx-auto text-gray-600 mb-4" size={48} />
                    <h3 className="text-xl font-medium text-white mb-2">No bookings yet</h3>
                    <p className="text-gray-400 mb-6">Start by getting a quote for your delivery</p>
                    <button
                      onClick={() => navigate("/")}
                      className="bg-orange-500 hover:bg-orange-600 text-white px-6 py-3 rounded-lg font-medium transition-colors inline-flex items-center space-x-2"
                    >
                      <Plus size={18} />
                      <span>Get a Quote</span>
                    </button>
                  </div>
                ) : (
                  filteredBookings.map((booking) => (
                    <div
                      key={booking.id}
                      className="bg-gray-900 rounded-lg p-6 border border-gray-800 hover:border-orange-500/30 transition-colors"
                    >
                      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between">
                        <div className="flex-1">
                          <div className="flex items-center space-x-3 mb-3">
                            <h3 className="text-white font-medium">#{booking.id.slice(0, 8)}</h3>
                            <span
                              className={`px-3 py-1 rounded-full text-xs font-medium border ${getStatusColor(booking.status)}`}
                            >
                              {booking.status}
                            </span>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                            <div className="flex items-start space-x-3">
                              <MapPin className="text-green-400 mt-1" size={16} />
                              <div>
                                <p className="text-gray-400 text-sm">Pickup</p>
                                <p className="text-white">{booking.pickup_address?.line1}</p>
                                <p className="text-gray-400 text-sm">{booking.pickup_address?.city}</p>
                              </div>
                            </div>

                            <div className="flex items-start space-x-3">
                              <MapPin className="text-red-400 mt-1" size={16} />
                              <div>
                                <p className="text-gray-400 text-sm">Dropoff</p>
                                <p className="text-white">{booking.dropoff_address?.line1}</p>
                                <p className="text-gray-400 text-sm">{booking.dropoff_address?.city}</p>
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center space-x-6 text-sm text-gray-400">
                            <div className="flex items-center space-x-2">
                              <Clock size={16} />
                              <span>{dayjs(booking.scheduled_pickup_at).format("MMM D, YYYY h:mm A")}</span>
                            </div>
                            <div className="flex items-center space-x-2">
                              <CreditCard size={16} />
                              <span>£{booking.final_price}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}

            {/* Quotes Tab */}
            {activeTab === "quotes" && (
              <div className="space-y-4">
                {filteredQuotes.length === 0 ? (
                  <div className="text-center py-12">
                    <Package className="mx-auto text-gray-600 mb-4" size={48} />
                    <h3 className="text-xl font-medium text-white mb-2">No quotes yet</h3>
                    <p className="text-gray-400 mb-6">Get started by requesting a quote</p>
                    <button
                      onClick={() => navigate("/")}
                      className="bg-orange-500 hover:bg-orange-600 text-white px-6 py-3 rounded-lg font-medium transition-colors inline-flex items-center space-x-2"
                    >
                      <Plus size={18} />
                      <span>Get a Quote</span>
                    </button>
                  </div>
                ) : (
                  filteredQuotes.map((quote) => (
                    <div
                      key={quote.id}
                      className="bg-gray-900 rounded-lg p-6 border border-gray-800 hover:border-orange-500/30 transition-colors"
                    >
                      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between">
                        <div className="flex-1">
                          <div className="flex items-center space-x-3 mb-3">
                            <h3 className="text-white font-medium">#{quote.id.slice(0, 8)}</h3>
                            <span className="px-3 py-1 rounded-full text-xs font-medium bg-blue-500/20 text-blue-400 border border-blue-500/30">
                              Quote
                            </span>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                            <div>
                              <p className="text-gray-400 text-sm">Service Type</p>
                              <p className="text-white">{quote.service_type?.name || "Standard"}</p>
                            </div>
                            <div>
                              <p className="text-gray-400 text-sm">Shipping Type</p>
                              <p className="text-white">{quote.shipping_type?.name || "Regular"}</p>
                            </div>
                            <div>
                              <p className="text-gray-400 text-sm">Price</p>
                              <p className="text-white font-medium">£{quote.final_price}</p>
                            </div>
                          </div>

                          <div className="flex items-center space-x-6 text-sm text-gray-400">
                            <div className="flex items-center space-x-2">
                              <Calendar size={16} />
                              <span>{dayjs(quote.created_at).format("MMM D, YYYY")}</span>
                            </div>
                          </div>
                        </div>

                        <div className="mt-4 lg:mt-0 lg:ml-6">
                          <button
                            onClick={() => handleBookNow(quote)}
                            className="bg-orange-500 hover:bg-orange-600 text-white px-6 py-2 rounded-lg font-medium transition-colors"
                          >
                            Book Now
                          </button>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
