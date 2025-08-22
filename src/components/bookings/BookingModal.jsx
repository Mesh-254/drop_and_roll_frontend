"use client"

import { useState, useEffect, useRef } from "react"
import { X, Calendar, User, CreditCard, Package, AlertCircle, CheckCircle, ChevronLeft, Loader2 } from "lucide-react"

// Generate unique booking ID
const generateBookingId = () => {
  return "booking_" + Date.now() + "_" + Math.random().toString(36).substr(2, 9)
}

// Time slot generation based on service type
const generateTimeSlots = (serviceType) => {
  const now = new Date()
  const slots = []

  switch (serviceType) {
    case "standard":
      // Next 3 days, 2-hour windows
      for (let day = 0; day < 3; day++) {
        const date = new Date(now)
        date.setDate(date.getDate() + day + 1)
        const timeWindows = ["9:00 AM - 11:00 AM", "11:00 AM - 1:00 PM", "1:00 PM - 3:00 PM", "3:00 PM - 5:00 PM"]
        timeWindows.forEach((window) => {
          slots.push({
            id: `${date.toISOString().split("T")[0]}_${window.replace(/[:\s]/g, "")}`,
            date: date.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "short" }),
            time: window,
            value: `${date.toISOString().split("T")[0]} ${window}`,
          })
        })
      }
      break

    case "express":
      // Next 2 hours, 30-minute windows
      for (let i = 0; i < 4; i++) {
        const time = new Date(now)
        time.setHours(time.getHours() + 1 + i)
        const startTime = time.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })
        const endTime = new Date(time.getTime() + 30 * 60000).toLocaleTimeString("en-GB", {
          hour: "2-digit",
          minute: "2-digit",
        })
        slots.push({
          id: `express_${i}`,
          date: "Today",
          time: `${startTime} - ${endTime}`,
          value: `${time.toISOString().split("T")[0]} ${startTime} - ${endTime}`,
        })
      }
      break

    case "business":
      // Recurring weekly slots
      const weekdays = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"]
      weekdays.forEach((day, index) => {
        slots.push({
          id: `weekly_${index}`,
          date: `Every ${day}`,
          time: "10:00 AM - 12:00 PM",
          value: `weekly_${day.toLowerCase()}_10:00`,
        })
      })
      break

    case "specialized":
      // Same as standard but with climate note
      for (let day = 0; day < 3; day++) {
        const date = new Date(now)
        date.setDate(date.getDate() + day + 1)
        const timeWindows = ["9:00 AM - 11:00 AM", "11:00 AM - 1:00 PM", "1:00 PM - 3:00 PM", "3:00 PM - 5:00 PM"]
        timeWindows.forEach((window) => {
          slots.push({
            id: `climate_${date.toISOString().split("T")[0]}_${window.replace(/[:\s]/g, "")}`,
            date: date.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "short" }),
            time: `${window} (Climate-Controlled)`,
            value: `${date.toISOString().split("T")[0]} ${window} climate`,
          })
        })
      }
      break

    default:
      return []
  }

  return slots
}

export default function BookingModal({ isOpen, onClose, onBack, formData, quote }) {
  const [contactInfo, setContactInfo] = useState({
    name: "",
    email: "",
    phone: "",
  })
  const [selectedPickupTime, setSelectedPickupTime] = useState("")
  const [validation, setValidation] = useState({})
  const [isLoading, setIsLoading] = useState(false)
  const [bookingStatus, setBookingStatus] = useState(null) // 'success', 'error', null
  const [errorMessage, setErrorMessage] = useState("")

  const firstInputRef = useRef(null)

  // Focus management
  useEffect(() => {
    if (isOpen && firstInputRef.current) {
      setTimeout(() => firstInputRef.current?.focus(), 100)
    }
  }, [isOpen])

  // Reset form when modal closes
  useEffect(() => {
    if (!isOpen) {
      setContactInfo({ name: "", email: "", phone: "" })
      setSelectedPickupTime("")
      setValidation({})
      setBookingStatus(null)
      setErrorMessage("")
    }
  }, [isOpen])

  // Validation functions
  const validateEmail = (email) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    return emailRegex.test(email)
  }

  const validatePhone = (phone) => {
    if (!phone) return true // Optional field
    const phoneRegex = /^[+]?[0-9\s\-$$$$]{10,}$/
    return phoneRegex.test(phone)
  }

  const validateForm = () => {
    const errors = {}

    if (!contactInfo.name.trim()) {
      errors.name = "Full name is required"
    }

    if (!contactInfo.email.trim()) {
      errors.email = "Email address is required"
    } else if (!validateEmail(contactInfo.email)) {
      errors.email = "Please enter a valid email address"
    }

    if (contactInfo.phone && !validatePhone(contactInfo.phone)) {
      errors.phone = "Please enter a valid phone number"
    }

    if (!selectedPickupTime) {
      errors.pickupTime = "Please select a pickup time"
    }

    setValidation(errors)
    return Object.keys(errors).length === 0
  }

  // Handle booking confirmation
  const handleConfirmBooking = async () => {
    if (!validateForm()) {
      return
    }

    setIsLoading(true)
    setErrorMessage("")

    try {
      // Create booking record
      const bookingData = {
        bookingId: generateBookingId(),
        shipmentType: formData.shipmentType?.id,
        service: formData.service?.id,
        pickupAddress: formData.pickupAddress,
        dropoffAddress: formData.dropoffAddress,
        weight: Number.parseFloat(formData.weight),
        dimensions: {
          width: Number.parseFloat(formData.width) || null,
          length: Number.parseFloat(formData.length) || null,
          height: Number.parseFloat(formData.height) || null,
        },
        fragile: formData.fragile || false,
        insurance: {
          enabled: formData.insurance || false,
          amount: Number.parseFloat(formData.insuranceAmount) || 0,
        },
        quote: {
          subtotal: quote?.subtotal || 0,
          insuranceFee: quote?.insuranceFee || 0,
          fragileCharge: quote?.fragileCharge || 0,
          total: quote?.total || 0,
        },
        pickupTime: selectedPickupTime,
        contact: {
          name: contactInfo.name.trim(),
          email: contactInfo.email.trim(),
          phone: contactInfo.phone.trim() || null,
        },
        status: "pending",
        createdAt: new Date().toISOString(),
      }

      // Simulate API call to create booking
      console.log("[v0] Creating booking:", bookingData)

      // In a real implementation, you would call your API here:
      // const result = await apiConnection.createBooking(bookingData);

      // Simulate API delay
      await new Promise((resolve) => setTimeout(resolve, 1500))

      setBookingStatus("success")

      // Simulate payment redirect after success
      setTimeout(() => {
        console.log("[v0] Redirecting to payment gateway...")
        alert(`Booking confirmed! Redirecting to payment for $${quote?.total || 0}...`)
        onClose()
      }, 2000)
    } catch (error) {
      console.error("[v0] Booking creation failed:", error)
      setErrorMessage(error.message || "Failed to create booking. Please try again.")
      setBookingStatus("error")
    } finally {
      setIsLoading(false)
    }
  }

  if (!isOpen) return null

  const timeSlots = generateTimeSlots(formData.service?.id)

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-background rounded-2xl shadow-2xl w-full max-w-4xl max-h-[95vh] overflow-y-auto animate-in zoom-in-95 duration-300">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-border bg-primary text-primary-foreground rounded-t-2xl">
          <h2 className="text-2xl font-bold">Confirm Your Booking</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-primary/80 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-primary-foreground/20"
            aria-label="Close modal"
          >
            <X size={24} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-8">
          {/* Booking Details Summary */}
          <div className="bg-card border border-border rounded-lg p-6">
            <h3 className="text-xl font-semibold text-card-foreground mb-4 flex items-center">
              <Package size={20} className="mr-2 text-primary" />
              Shipment Summary
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Type:</span>
                  <span className="font-medium text-card-foreground">{formData.shipmentType?.title}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Service:</span>
                  <span className="font-medium text-card-foreground">{formData.service?.title}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Weight:</span>
                  <span className="font-medium text-card-foreground">{formData.weight} kg</span>
                </div>
                {formData.width && formData.length && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Dimensions:</span>
                    <span className="font-medium text-card-foreground">
                      {formData.width} × {formData.length} {formData.height && `× ${formData.height}`} cm
                    </span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Fragile:</span>
                  <span className="font-medium text-card-foreground">{formData.fragile ? "Yes" : "No"}</span>
                </div>
              </div>

              <div className="space-y-3">
                <div>
                  <span className="text-muted-foreground block mb-1">From:</span>
                  <span className="font-medium text-card-foreground text-sm">{formData.pickupAddress}</span>
                </div>
                <div>
                  <span className="text-muted-foreground block mb-1">To:</span>
                  <span className="font-medium text-card-foreground text-sm">{formData.dropoffAddress}</span>
                </div>
                {formData.insurance && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Insurance:</span>
                    <span className="font-medium text-card-foreground">${formData.insuranceAmount}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Quote Breakdown */}
            {quote && (
              <div className="mt-6 pt-6 border-t border-border">
                <h4 className="font-semibold text-card-foreground mb-3">Quote Breakdown</h4>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Base shipping cost:</span>
                    <span className="font-medium text-card-foreground">${quote.subtotal}</span>
                  </div>
                  {formData.insurance && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Insurance fee (2%):</span>
                      <span className="font-medium text-card-foreground">${quote.insuranceFee}</span>
                    </div>
                  )}
                  {formData.fragile && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Fragile handling (25%):</span>
                      <span className="font-medium text-card-foreground">${quote.fragileCharge}</span>
                    </div>
                  )}
                  <div className="border-t border-border pt-2 mt-2">
                    <div className="flex justify-between text-lg font-bold">
                      <span className="text-card-foreground">Total:</span>
                      <span className="text-primary">${quote.total}</span>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Pickup Time Selection */}
          <div className="bg-card border border-border rounded-lg p-6">
            <h3 className="text-xl font-semibold text-card-foreground mb-4 flex items-center">
              <Calendar size={20} className="mr-2 text-primary" />
              Select Pickup Time
            </h3>

            {formData.service?.id === "specialized" && (
              <div className="mb-4 p-3 bg-accent/20 border border-accent/30 rounded-lg">
                <p className="text-sm text-accent-foreground">
                  <strong>Climate-Controlled Scheduling:</strong> All time slots include temperature-controlled handling
                  for sensitive items.
                </p>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 max-h-60 overflow-y-auto">
              {timeSlots.map((slot) => (
                <button
                  key={slot.id}
                  ref={slot.id === timeSlots[0]?.id ? firstInputRef : null}
                  onClick={() => setSelectedPickupTime(slot.value)}
                  className={`
                    p-4 border-2 rounded-lg text-left transition-all hover:scale-105 focus:outline-none focus:ring-2 focus:ring-ring
                    ${
                      selectedPickupTime === slot.value
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border hover:border-primary/50 hover:bg-accent/50"
                    }
                  `}
                >
                  <div className="font-medium text-sm">{slot.date}</div>
                  <div className="text-xs text-muted-foreground mt-1">{slot.time}</div>
                </button>
              ))}
            </div>

            {validation.pickupTime && (
              <div className="flex items-center text-destructive text-sm mt-3">
                <AlertCircle size={16} className="mr-2" />
                {validation.pickupTime}
              </div>
            )}
          </div>

          {/* Contact Information */}
          <div className="bg-card border border-border rounded-lg p-6">
            <h3 className="text-xl font-semibold text-card-foreground mb-4 flex items-center">
              <User size={20} className="mr-2 text-primary" />
              Contact Information
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-card-foreground mb-2">Full Name *</label>
                <input
                  type="text"
                  value={contactInfo.name}
                  onChange={(e) => setContactInfo((prev) => ({ ...prev, name: e.target.value }))}
                  placeholder="Enter your full name"
                  className="w-full px-4 py-3 border border-input rounded-lg bg-input text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent transition-colors"
                />
                {validation.name && (
                  <div className="flex items-center text-destructive text-sm mt-2">
                    <AlertCircle size={16} className="mr-2" />
                    {validation.name}
                  </div>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-card-foreground mb-2">Email Address *</label>
                <input
                  type="email"
                  value={contactInfo.email}
                  onChange={(e) => setContactInfo((prev) => ({ ...prev, email: e.target.value }))}
                  placeholder="Enter your email address"
                  className="w-full px-4 py-3 border border-input rounded-lg bg-input text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent transition-colors"
                />
                {validation.email && (
                  <div className="flex items-center text-destructive text-sm mt-2">
                    <AlertCircle size={16} className="mr-2" />
                    {validation.email}
                  </div>
                )}
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-card-foreground mb-2">Phone Number (Optional)</label>
                <input
                  type="tel"
                  value={contactInfo.phone}
                  onChange={(e) => setContactInfo((prev) => ({ ...prev, phone: e.target.value }))}
                  placeholder="Enter your phone number"
                  className="w-full px-4 py-3 border border-input rounded-lg bg-input text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent transition-colors"
                />
                {validation.phone && (
                  <div className="flex items-center text-destructive text-sm mt-2">
                    <AlertCircle size={16} className="mr-2" />
                    {validation.phone}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Error Display */}
          {errorMessage && (
            <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4">
              <div className="flex items-center text-destructive">
                <AlertCircle size={20} className="mr-2" />
                <span className="font-medium">{errorMessage}</span>
              </div>
            </div>
          )}

          {/* Success Display */}
          {bookingStatus === "success" && (
            <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4 animate-in slide-in-from-bottom duration-300">
              <div className="flex items-center text-green-700 dark:text-green-300">
                <CheckCircle size={20} className="mr-2" />
                <span className="font-medium">Booking confirmed successfully! Redirecting to payment...</span>
              </div>
            </div>
          )}

          {/* Development Debug */}
          {process.env.NODE_ENV === "development" && (
            <div className="text-xs text-muted-foreground p-3 bg-muted rounded border">
              <strong>Debug Info:</strong>
              <pre className="mt-2 whitespace-pre-wrap">
                {JSON.stringify(
                  {
                    formData: formData,
                    contactInfo: contactInfo,
                    selectedPickupTime: selectedPickupTime,
                    quote: quote,
                  },
                  null,
                  2,
                )}
              </pre>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="flex justify-between items-center p-6 border-t border-border bg-muted rounded-b-2xl">
          <button
            onClick={onBack}
            disabled={isLoading}
            className="flex items-center px-4 py-2 text-muted-foreground hover:text-foreground border border-border rounded-lg hover:bg-background transition-colors focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <ChevronLeft size={16} className="mr-1" />
            Back to Quote
          </button>

          <div className="flex space-x-3">
            <button
              onClick={onClose}
              disabled={isLoading}
              className="px-4 py-2 text-muted-foreground hover:text-foreground border border-border rounded-lg hover:bg-background transition-colors focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Cancel
            </button>

            <button
              onClick={handleConfirmBooking}
              disabled={isLoading || bookingStatus === "success"}
              className="flex items-center px-6 py-3 bg-primary hover:bg-primary/90 disabled:bg-primary/50 text-primary-foreground font-bold rounded-lg transition-all transform hover:scale-105 disabled:transform-none focus:outline-none focus:ring-2 focus:ring-ring disabled:cursor-not-allowed"
            >
              {isLoading ? (
                <>
                  <Loader2 size={20} className="mr-2 animate-spin" />
                  Creating Booking...
                </>
              ) : bookingStatus === "success" ? (
                <>
                  <CheckCircle size={20} className="mr-2" />
                  Booking Confirmed
                </>
              ) : (
                <>
                  <CreditCard size={20} className="mr-2" />
                  Confirm Booking
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
