"use client"

import { useState, lazy, Suspense } from "react"
import { X, Package, FileText, Truck, MapPin, Calculator, Clock, Zap, Calendar } from "lucide-react"

// Lazy load the map component for better performance
const MapComponent = lazy(() => import("../map/MapComponent"))

const shipmentTypes = [
  {
    id: "parcels",
    title: "Parcels or Documents",
    icon: Package,
    description: "Small packages, documents, and lightweight items up to 31.5kg",
  },
  {
    id: "cargo",
    title: "Cargo/Freight (More than 31.5 kg)",
    icon: Truck,
    description: "Heavy items, bulk shipments, and freight over 31.5kg",
  },
  {
    id: "business",
    title: "Business Mail",
    icon: FileText,
    description: "Corporate mail, contracts, and business documents",
  },
]

const coreServices = [
  {
    id: "same-day",
    title: "Same Day Delivery",
    icon: Zap,
    description: "Urgent delivery within the same day",
    price: "From $15",
    timeframe: "2-6 hours",
    features: ["Real-time tracking", "Priority handling", "Signature confirmation"],
  },
  {
    id: "next-day",
    title: "Next Day Delivery",
    icon: Package,
    description: "Reliable next business day delivery",
    price: "From $8",
    timeframe: "Next business day",
    features: ["Before 12 PM delivery", "Tracking included", "Insurance available"],
  },
  {
    id: "weekend",
    title: "Weekend Express",
    icon: Calendar,
    description: "Weekend and holiday delivery service",
    price: "From $20",
    timeframe: "Weekend delivery",
    features: ["Saturday/Sunday delivery", "Holiday service", "Premium tracking"],
  },
  {
    id: "overnight",
    title: "Overnight Logistics",
    icon: Clock,
    description: "Overnight delivery for time-sensitive items",
    price: "From $25",
    timeframe: "By 9 AM next day",
    features: ["Early morning delivery", "Temperature control", "Special handling"],
  },
]

const locations = [
  "Halifax, NS",
  "Dartmouth, NS",
  "Bedford, NS",
  "Sackville, NS",
  "Cole Harbour, NS",
  "Eastern Passage, NS",
  "Timberlea, NS",
  "Fall River, NS",
  "Spryfield, NS",
  "Clayton Park, NS",
]

export default function GetQuoteBook({ isOpen, onClose }) {
  const [step, setStep] = useState(1)
  const [selectedShipment, setSelectedShipment] = useState(null)
  const [selectedService, setSelectedService] = useState(null)
  const [showMap, setShowMap] = useState(false)
  const [formData, setFormData] = useState({
    weight: "",
    pickupLocation: "",
    destinationLocation: "",
    pickupCoords: null,
    destinationCoords: null,
  })

  const handleShipmentSelect = (shipment) => {
    setSelectedShipment(shipment)
    setStep(2)
  }

  const handleServiceSelect = (service) => {
    setSelectedService(service)
    setStep(3)
  }

  const handleInputChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
  }

  const calculateQuote = () => {
    const weight = Number.parseFloat(formData.weight) || 1
    const basePrice = Number.parseInt(selectedService?.price?.match(/\d+/)?.[0]) || 15
    const weightMultiplier = weight > 5 ? 1 + (weight - 5) * 0.15 : 1
    const distance = Math.random() * 50 + 10 // Simulated distance
    const distanceMultiplier = distance > 20 ? 1.3 : 1
    const serviceMultiplier =
      selectedService?.id === "same-day"
        ? 1.5
        : selectedService?.id === "weekend"
          ? 1.4
          : selectedService?.id === "overnight"
            ? 1.6
            : 1

    const totalPrice = Math.round(basePrice * weightMultiplier * distanceMultiplier * serviceMultiplier)

    const quoteData = {
      shipmentType: selectedShipment?.title,
      service: selectedService?.title,
      weight: formData.weight,
      pickupLocation: formData.pickupLocation,
      destinationLocation: formData.destinationLocation,
      estimatedPrice: totalPrice,
      estimatedDistance: Math.round(distance),
      timeframe: selectedService?.timeframe,
    }

    console.log("Quote Data:", quoteData)

    // Show quote modal
    const quoteMessage = `
🚚 DELIVERY QUOTE GENERATED

Service: ${selectedService?.title}
Shipment: ${selectedShipment?.title}
Weight: ${formData.weight}kg
From: ${formData.pickupLocation}
To: ${formData.destinationLocation}

💰 Estimated Price: $${totalPrice}
📏 Distance: ~${Math.round(distance)}km
⏱️ Timeframe: ${selectedService?.timeframe}

Ready to book this delivery?
    `

    if (confirm(quoteMessage + "\n\nClick OK to proceed with booking, or Cancel to modify quote.")) {
      alert("🎉 Booking initiated! You'll be redirected to our secure booking platform.")
    }
  }

  const resetForm = () => {
    setStep(1)
    setSelectedShipment(null)
    setSelectedService(null)
    setFormData({
      weight: "",
      pickupLocation: "",
      destinationLocation: "",
      pickupCoords: null,
      destinationCoords: null,
    })
    setShowMap(false)
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/90 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-gray-900 rounded-2xl max-w-5xl w-full max-h-[95vh] overflow-y-auto border border-gray-700 shadow-2xl">
        {/* Header */}
        <div className="flex justify-between items-center p-6 border-b border-gray-700 bg-gray-800 rounded-t-2xl">
          <div className="flex items-center space-x-3">
            <img src="/images/logo-clean.jpeg" alt="Logo" className="w-8 h-8 rounded" />
            <h2 className="text-2xl font-bold text-white">Get Quote & Book</h2>
          </div>
          <button
            onClick={() => {
              onClose()
              resetForm()
            }}
            className="text-gray-400 hover:text-white transition-colors p-2 hover:bg-gray-700 rounded-lg"
          >
            <X size={24} />
          </button>
        </div>

        {/* Step Indicator */}
        <div className="px-6 py-4 border-b border-gray-700 bg-gray-800/50">
          <div className="flex items-center justify-center space-x-4">
            {[1, 2, 3].map((stepNum) => (
              <div key={stepNum} className="flex items-center">
                <div
                  className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold transition-all ${
                    step >= stepNum ? "bg-orange-500 text-black" : "bg-gray-700 text-gray-400"
                  }`}
                >
                  {stepNum}
                </div>
                {stepNum < 3 && (
                  <div className={`w-16 h-1 mx-3 transition-all ${step > stepNum ? "bg-orange-500" : "bg-gray-700"}`} />
                )}
              </div>
            ))}
          </div>
          <div className="mt-3 text-center text-sm text-gray-400">
            {step === 1 && "Select Type of Shipment"}
            {step === 2 && "Choose Core Service Offering"}
            {step === 3 && "Enter Shipment Details & Get Quote"}
          </div>
        </div>

        {/* Content */}
        <div className="p-6">
          {/* Step 1: Shipment Type Selection */}
          {step === 1 && (
            <div className="space-y-6">
              <div className="text-center">
                <h3 className="text-2xl font-semibold text-white mb-2">What are you shipping?</h3>
                <p className="text-gray-400">Select the type of shipment to get started</p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {shipmentTypes.map((type) => {
                  const IconComponent = type.icon
                  return (
                    <button
                      key={type.id}
                      onClick={() => handleShipmentSelect(type)}
                      className="p-6 border-2 border-gray-700 rounded-xl hover:border-orange-500 hover:bg-gray-800 transition-all group text-left transform hover:scale-105"
                    >
                      <div className="flex flex-col items-center text-center">
                        <div className="w-16 h-16 bg-orange-500/10 rounded-full flex items-center justify-center mb-4 group-hover:bg-orange-500/20 transition-colors">
                          <IconComponent className="w-8 h-8 text-orange-500 group-hover:scale-110 transition-transform" />
                        </div>
                        <h4 className="text-white font-semibold mb-2 group-hover:text-orange-500 transition-colors">
                          {type.title}
                        </h4>
                        <p className="text-gray-400 text-sm leading-relaxed">{type.description}</p>
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {/* Step 2: Service Selection */}
          {step === 2 && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-2xl font-semibold text-white mb-2">Choose Core Service Offering</h3>
                  <p className="text-gray-400">Selected: {selectedShipment?.title}</p>
                </div>
                <button
                  onClick={() => setStep(1)}
                  className="text-orange-500 hover:text-orange-400 text-sm font-medium px-4 py-2 border border-orange-500 rounded-lg hover:bg-orange-500/10 transition-colors"
                >
                  ← Change Type
                </button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {coreServices.map((service) => {
                  const IconComponent = service.icon
                  return (
                    <button
                      key={service.id}
                      onClick={() => handleServiceSelect(service)}
                      className="p-6 border-2 border-gray-700 rounded-xl hover:border-orange-500 hover:bg-gray-800 transition-all group text-left transform hover:scale-105"
                    >
                      <div className="flex items-start space-x-4">
                        <div className="w-12 h-12 bg-orange-500/10 rounded-lg flex items-center justify-center group-hover:bg-orange-500/20 transition-colors">
                          <IconComponent className="w-6 h-6 text-orange-500" />
                        </div>
                        <div className="flex-1">
                          <div className="flex justify-between items-start mb-2">
                            <h4 className="text-white font-semibold group-hover:text-orange-500 transition-colors">
                              {service.title}
                            </h4>
                            <span className="text-orange-500 font-bold text-sm">{service.price}</span>
                          </div>
                          <p className="text-gray-400 text-sm mb-2">{service.description}</p>
                          <p className="text-orange-400 text-xs font-medium mb-3">⏱️ {service.timeframe}</p>
                          <ul className="space-y-1">
                            {service.features.map((feature, index) => (
                              <li key={index} className="text-gray-500 text-xs flex items-center">
                                <span className="w-1.5 h-1.5 bg-orange-500 rounded-full mr-2"></span>
                                {feature}
                              </li>
                            ))}
                          </ul>
                        </div>
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {/* Step 3: Quote Form */}
          {step === 3 && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-2xl font-semibold text-white mb-2">Enter Shipment Details</h3>
                  <p className="text-gray-400">Fill in the details to get your quote</p>
                </div>
                <button
                  onClick={() => setStep(2)}
                  className="text-orange-500 hover:text-orange-400 text-sm font-medium px-4 py-2 border border-orange-500 rounded-lg hover:bg-orange-500/10 transition-colors"
                >
                  ← Change Service
                </button>
              </div>

              {/* Selected Service Summary */}
              <div className="bg-gray-800 p-4 rounded-xl border border-gray-700">
                <div className="flex justify-between items-center">
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 bg-orange-500/10 rounded-lg flex items-center justify-center">
                      {selectedService?.icon && <selectedService.icon className="w-5 h-5 text-orange-500" />}
                    </div>
                    <div>
                      <h4 className="text-white font-semibold">{selectedService?.title}</h4>
                      <p className="text-gray-400 text-sm">
                        {selectedShipment?.title} • {selectedService?.timeframe}
                      </p>
                    </div>
                  </div>
                  <span className="text-orange-500 font-bold text-lg">{selectedService?.price}</span>
                </div>
              </div>

              {/* Form */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Weight Input */}
                <div className="md:col-span-2">
                  <label className="block text-white font-medium mb-2">Package Weight (kg) *</label>
                  <input
                    type="number"
                    step="0.1"
                    min="0.1"
                    value={formData.weight}
                    onChange={(e) => handleInputChange("weight", e.target.value)}
                    placeholder="Enter weight in kilograms"
                    className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-orange-500 transition-colors"
                  />
                </div>

                {/* Pickup Location */}
                <div>
                  <label className="block text-white font-medium mb-2">Pickup Location *</label>
                  <select
                    value={formData.pickupLocation}
                    onChange={(e) => handleInputChange("pickupLocation", e.target.value)}
                    className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-orange-500 transition-colors"
                  >
                    <option value="">Select pickup location</option>
                    {locations.map((location) => (
                      <option key={location} value={location}>
                        {location}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Destination Location */}
                <div>
                  <label className="block text-white font-medium mb-2">Destination Location *</label>
                  <select
                    value={formData.destinationLocation}
                    onChange={(e) => handleInputChange("destinationLocation", e.target.value)}
                    className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-orange-500 transition-colors"
                  >
                    <option value="">Select destination</option>
                    {locations.map((location) => (
                      <option key={location} value={location}>
                        {location}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Map Toggle */}
              <div className="flex justify-center">
                <button
                  onClick={() => setShowMap(!showMap)}
                  className="flex items-center space-x-2 px-6 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white hover:border-orange-500 hover:bg-gray-700 transition-colors"
                >
                  <MapPin size={20} />
                  <span>{showMap ? "Hide Map" : "Use Interactive Map"}</span>
                </button>
              </div>

              {/* Map Component */}
              {showMap && (
                <div className="bg-gray-800 p-6 rounded-xl border border-gray-700">
                  <h4 className="text-white font-medium mb-4 flex items-center">
                    <MapPin className="w-5 h-5 mr-2 text-orange-500" />
                    Select Locations on Map
                  </h4>
                  <Suspense
                    fallback={
                      <div className="h-80 bg-gray-700 rounded-lg flex items-center justify-center text-gray-400">
                        <div className="text-center">
                          <div className="animate-spin w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full mx-auto mb-2"></div>
                          Loading interactive map...
                        </div>
                      </div>
                    }
                  >
                    <MapComponent
                      onLocationSelect={(coords, type) => {
                        setFormData((prev) => ({ ...prev, [`${type}Coords`]: coords }))
                      }}
                    />
                  </Suspense>
                </div>
              )}

              {/* Get Quote Button */}
              <div className="pt-6 border-t border-gray-700">
                <button
                  onClick={calculateQuote}
                  disabled={!formData.weight || !formData.pickupLocation || !formData.destinationLocation}
                  className="w-full bg-orange-500 hover:bg-orange-600 disabled:bg-gray-700 disabled:text-gray-400 disabled:cursor-not-allowed text-black font-bold py-4 px-6 rounded-lg transition-all duration-300 transform hover:scale-105 flex items-center justify-center space-x-2 text-lg"
                >
                  <Calculator size={24} />
                  <span>Get Quote & Book Now</span>
                </button>
                <p className="text-gray-400 text-sm text-center mt-2">
                  * All fields are required to generate an accurate quote
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
