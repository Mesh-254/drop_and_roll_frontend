"use client";
import { useNavigate } from "react-router-dom";
import { bookingApi } from "../../api/BookingApi";
import jsPDF from "jspdf";
import dayjs from "dayjs";
import { useState, useEffect, useRef, useCallback } from "react";
import {
  X,
  Package,
  Truck,
  Calculator,
  ChevronLeft,
  ChevronRight,
  Check,
  AlertCircle,
  Download,
  Loader2,
  MapPin,
} from "lucide-react";
import MapComponent from "../map/MapComponent";

const stepTitles = [
  "Shipment Type",
  "Service Offering",
  "Locations",
  "Parcel Details",
  "Insurance & Quote",
];

const AddressInput = ({
  label,
  postcode,
  onPostcodeChange,
  address,
  onAddressSelect,
  suggestions,
  isLoading,
  validation,
  placeholder,
}) => {
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [isEditing, setIsEditing] = useState(!address);

  const handleAddressSelect = (selectedAddress) => {
    onAddressSelect(selectedAddress);
    setShowSuggestions(false);
    setIsEditing(false);
  };

  const handleEdit = () => {
    setIsEditing(true);
    setShowSuggestions(true);
  };

  // Show selected address display when address is selected and not editing
  if (address && !isEditing) {
    return (
      <div className="space-y-3">
        <div className="flex items-center space-x-2">
          <MapPin className="h-5 w-5 text-orange-500" />
          <h3 className="text-lg font-medium text-gray-900 dark:text-white">
            {label} Location
          </h3>
        </div>

        <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="flex items-center justify-center w-6 h-6 bg-green-500 rounded-full">
                <Check className="h-4 w-4 text-white" />
              </div>
              <div>
                <p className="text-sm font-medium text-green-800 dark:text-green-200">
                  {label} Location Selected
                </p>
                <p className="text-sm text-green-700 dark:text-green-300 mt-1">
                  {address}
                </p>
              </div>
            </div>
            <button
              onClick={handleEdit}
              className="px-3 py-1 text-sm font-medium text-orange-600 hover:text-orange-700 border border-orange-300 hover:border-orange-400 rounded-md hover:bg-orange-50 dark:hover:bg-orange-900/20 transition-colors"
            >
              Edit
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Show input form when editing or no address selected
  return (
    <div className="space-y-3">
      <div className="flex items-center space-x-2">
        <MapPin className="h-5 w-5 text-orange-500" />
        <h3 className="text-lg font-medium text-gray-900 dark:text-white">
          {label} Location
        </h3>
      </div>

      <div className="relative">
        <input
          type="text"
          value={postcode}
          onChange={(e) => {
            onPostcodeChange(e.target.value);
            setShowSuggestions(true);
          }}
          onFocus={() => setShowSuggestions(true)}
          placeholder={placeholder}
          className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-colors"
        />

        {isLoading && (
          <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
            <Loader2 size={16} className="animate-spin text-orange-500" />
          </div>
        )}

        {showSuggestions && suggestions.length > 0 && (
          <div className="absolute z-10 w-full mt-1 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg shadow-lg max-h-60 overflow-y-auto">
            {suggestions.map((suggestion, index) => (
              <button
                key={index}
                onClick={() => handleAddressSelect(suggestion)}
                className="w-full px-4 py-3 text-left hover:bg-gray-50 dark:hover:bg-gray-700 border-b border-gray-100 dark:border-gray-700 last:border-b-0 transition-colors"
              >
                <div className="text-sm text-gray-900 dark:text-white">
                  {suggestion}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {validation && (
        <div className="flex items-center text-red-500 text-sm">
          <AlertCircle size={16} className="mr-2" />
          {validation}
        </div>
      )}
    </div>
  );
};

const ShipmentTypeSelector = ({
  shipmentTypes,
  selectedType,
  onSelect,
  isLoading,
  error,
  firstInputRef,
}) => {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 size={32} className="animate-spin text-orange-500" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <AlertCircle size={48} className="mx-auto text-red-500 mb-4" />
        <p className="text-red-600 dark:text-red-400">{error}</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {shipmentTypes.map((type, index) => (
        <button
          key={type.id}
          ref={index === 0 ? firstInputRef : null}
          onClick={() => onSelect(type)}
          className={`
            p-6 rounded-xl border-2 transition-all transform hover:scale-105 text-left
            ${
              selectedType?.id === type.id
                ? "border-orange-500 bg-orange-50 dark:bg-orange-900/20"
                : "border-gray-200 dark:border-gray-700 hover:border-orange-300 dark:hover:border-orange-600"
            }
          `}
        >
          <div className="flex items-center mb-3">
            <Package className="h-8 w-8 text-orange-500 mr-3" />
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              {type.name}
            </h3>
          </div>
          <p className="text-gray-600 dark:text-gray-400 text-sm">
            {type.description}
          </p>
        </button>
      ))}
    </div>
  );
};

const ServiceSelector = ({
  services,
  selectedService,
  onSelect,
  isLoading,
  error,
  firstInputRef,
}) => {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 size={32} className="animate-spin text-orange-500" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <AlertCircle size={48} className="mx-auto text-red-500 mb-4" />
        <p className="text-red-600 dark:text-red-400">{error}</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {services.map((service, index) => (
        <button
          key={service.id}
          ref={index === 0 ? firstInputRef : null}
          onClick={() => onSelect(service)}
          className={`
            p-6 rounded-xl border-2 transition-all transform hover:scale-105 text-left
            ${
              selectedService?.id === service.id
                ? "border-orange-500 bg-orange-50 dark:bg-orange-900/20"
                : "border-gray-200 dark:border-gray-700 hover:border-orange-300 dark:hover:border-orange-600"
            }
          `}
        >
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center">
              <Truck className="h-8 w-8 text-orange-500 mr-3" />
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                {service.name}
              </h3>
            </div>
            <span className="text-lg font-bold text-orange-500">
              £{service.price}
            </span>
          </div>
          <p className="text-gray-600 dark:text-gray-400 text-sm">
            {service.description}
          </p>
        </button>
      ))}
    </div>
  );
};

const QuoteDisplay = ({ quote, onDownloadPDF, isLoading, formData }) => {
  if (isLoading) {
    return (
      <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-6">
        <div className="flex items-center justify-center py-8">
          <Loader2 size={32} className="animate-spin text-orange-500 mr-3" />
          <span className="text-gray-600 dark:text-gray-400">
            Calculating quote...
          </span>
        </div>
      </div>
    );
  }

  if (!quote) {
    return (
      <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-6">
        <div className="text-center py-8">
          <Calculator className="mx-auto h-12 w-12 text-gray-400 mb-4" />
          <p className="text-gray-600 dark:text-gray-400">
            Complete the form to see your quote
          </p>
        </div>
      </div>
    );
  }

  const breakdown = quote.meta || {};

  return (
    <div className="bg-gradient-to-br from-orange-50 to-orange-100 dark:from-orange-900/20 dark:to-orange-800/20 rounded-xl p-6 border border-orange-200 dark:border-orange-800">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center">
          <Calculator className="h-6 w-6 text-orange-500 mr-3" />
          <h3 className="text-xl font-bold text-gray-900 dark:text-white">
            Quote Breakdown
          </h3>
        </div>
        <button
          onClick={onDownloadPDF}
          className="flex items-center px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg transition-colors"
        >
          <Download size={16} className="mr-2" />
          Download PDF
        </button>
      </div>

      <div className="space-y-3">
        <div className="flex justify-between items-center py-2 border-b border-orange-200 dark:border-orange-700">
          <span className="text-gray-700 dark:text-gray-300">
            Base Price ({breakdown.service_type})
          </span>
          <span className="font-medium text-gray-900 dark:text-white">
            £{breakdown.base_price?.toFixed(2) || "0.00"}
          </span>
        </div>

        <div className="flex justify-between items-center py-2 border-b border-orange-200 dark:border-orange-700">
          <span className="text-gray-700 dark:text-gray-300">
            Weight Charge ({formData.weight}kg × £0.50)
          </span>
          <span className="font-medium text-gray-900 dark:text-white">
            £{breakdown.weight_charge?.toFixed(2) || "0.00"}
          </span>
        </div>

        <div className="flex justify-between items-center py-2 border-b border-orange-200 dark:border-orange-700">
          <span className="text-gray-700 dark:text-gray-300">
            Distance Charge ({quote.distance_km}km × £0.10)
          </span>
          <span className="font-medium text-gray-900 dark:text-white">
            £{breakdown.distance_charge?.toFixed(2) || "0.00"}
          </span>
        </div>

        <div className="flex justify-between items-center py-2 border-b border-orange-200 dark:border-orange-700">
          <span className="text-gray-700 dark:text-gray-300">Subtotal</span>
          <span className="font-medium text-gray-900 dark:text-white">
            £{breakdown.subtotal?.toFixed(2) || "0.00"}
          </span>
        </div>

        {breakdown.fragile_charge > 0 && (
          <div className="flex justify-between items-center py-2 border-b border-orange-200 dark:border-orange-700">
            <span className="text-gray-700 dark:text-gray-300">
              Fragile Surcharge (25%)
            </span>
            <span className="font-medium text-gray-900 dark:text-white">
              £{breakdown.fragile_charge?.toFixed(2) || "0.00"}
            </span>
          </div>
        )}

        {breakdown.insurance_fee > 0 && (
          <div className="flex justify-between items-center py-2 border-b border-orange-200 dark:border-orange-700">
            <span className="text-gray-700 dark:text-gray-300">
              Insurance Fee (2%)
            </span>
            <span className="font-medium text-gray-900 dark:text-white">
              £{breakdown.insurance_fee?.toFixed(2) || "0.00"}
            </span>
          </div>
        )}

        <div className="flex justify-between items-center py-3 bg-orange-100 dark:bg-orange-900/30 rounded-lg px-4 mt-4">
          <span className="text-lg font-bold text-gray-900 dark:text-white">
            Total Price
          </span>
          <span className="text-2xl font-bold text-orange-600 dark:text-orange-400">
            £{quote.final_price ? Number.parseFloat(quote.final_price).toFixed(2) : "0.00"}
          </span>
        </div>
      </div>
    </div>
  );
};

export default function GetQuoteModal({ isOpen, onClose }) {
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState(1);

  const [shipmentTypes, setShipmentTypes] = useState([]);
  const [services, setServices] = useState([]);
  const [isLoadingTypes, setIsLoadingTypes] = useState(false);
  const [isLoadingServices, setIsLoadingServices] = useState(false);
  const [typesError, setTypesError] = useState(null);
  const [servicesError, setServicesError] = useState(null);
  const [quoteId, setQuoteId] = useState(null);
  const [lastQuoteData, setLastQuoteData] = useState(null);

  const [formData, setFormData] = useState({
    shipmentType: null,
    service: null,
    pickupPostcode: "", // London dummy postcode
    pickupAddress: "",
    dropoffPostcode: "", // Oxford dummy postcode
    dropoffAddress: "",
    weight: "",
    fragile: false,
    width: "",
    length: "",
    height: "",
    insurance: false,
    insuranceAmount: "",
  });

  const [validation, setValidation] = useState({});
  const [addressSuggestions, setAddressSuggestions] = useState({
    pickup: [],
    dropoff: [],
  });
  const [isLoadingAddresses, setIsLoadingAddresses] = useState(false);
  const [quote, setQuote] = useState(null);
  const [isLoadingQuote, setIsLoadingQuote] = useState(false);

  const firstInputRef = useRef(null);
  const debounceRef = useRef(null);

  // Load shipping types on mount
  useEffect(() => {
    if (isOpen) {
      loadShipmentTypes();
      loadServices();
    }
  }, [isOpen]);

  const loadShipmentTypes = async () => {
    setIsLoadingTypes(true);
    setTypesError(null);
    try {
      const result = await bookingApi.getShippingTypes();
      if (result.success) {
        setShipmentTypes(result.data);
      } else {
        setTypesError(result.message);
      }
    } catch (error) {
      setTypesError("Failed to load shipment types");
    } finally {
      setIsLoadingTypes(false);
    }
  };

  const loadServices = async () => {
    setIsLoadingServices(true);
    setServicesError(null);
    try {
      const result = await bookingApi.getServiceTypes();
      if (result.success) {
        setServices(result.data);
      } else {
        setServicesError(result.message);
      }
    } catch (error) {
      setServicesError("Failed to load services");
    } finally {
      setIsLoadingServices(false);
    }
  };

  const lookupPostcode = useCallback(async (postcode, type) => {
    if (!postcode || postcode.length < 3) {
      setAddressSuggestions((prev) => ({ ...prev, [type]: [] }));
      return;
    }

    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    debounceRef.current = setTimeout(async () => {
      setIsLoadingAddresses(true);
      try {
        // Mock address lookup - replace with actual API
        const mockAddresses = [
          `${postcode.toUpperCase()}, Milton Keynes, MK1 1AA`,
          `${postcode.toUpperCase()}, Oxford, OX1 1AA`,
          `${postcode.toUpperCase()}, London, SW1A 1AA`,
        ];

        setAddressSuggestions((prev) => ({ ...prev, [type]: mockAddresses }));
      } catch (error) {
        console.error("Address lookup failed:", error);
      } finally {
        setIsLoadingAddresses(false);
      }
    }, 300);
  }, []);

  const calculateQuote = useCallback(async () => {
    if (
      !formData.shipmentType ||
      !formData.service ||
      !formData.weight ||
      !formData.pickupAddress ||
      !formData.dropoffAddress
    ) {
      return;
    }

    const quoteData = {
      shipmentType: formData.shipmentType,
      service: formData.service,
      weightKg: formData.weight,
      distanceKm: await bookingApi.calculateDistance(
        { city: formData.pickupAddress.split(",")[1]?.trim() },
        { city: formData.dropoffAddress.split(",")[1]?.trim() }
      ),
      fragile: formData.fragile,
      insuranceAmount: formData.insurance ? formData.insuranceAmount : 0,
      dimensions: {
        width: formData.width,
        length: formData.length,
        height: formData.height,
        unit: "cm",
      },
    };

    // Check if quote data has changed
    const quoteDataString = JSON.stringify(quoteData);
    if (quoteDataString === lastQuoteData) {
      return; // No change, don't recalculate
    }

    setIsLoadingQuote(true);
    try {
      const result = await bookingApi.createQuote(quoteData);
      if (result.success) {
        setQuote(result.data);
        setQuoteId(result.data.id);
        setLastQuoteData(quoteDataString);
      } else {
        console.error("Quote calculation failed:", result.message);
      }
    } catch (error) {
      console.error("Quote calculation error:", error);
    } finally {
      setIsLoadingQuote(false);
    }
  }, [formData, lastQuoteData]);

  // Auto-calculate quote when form data changes
  useEffect(() => {
    if (currentStep === 5) {
      calculateQuote();
    }
  }, [currentStep, calculateQuote]);

  const handleShipmentTypeSelect = (type) => {
    setFormData((prev) => ({ ...prev, shipmentType: type }));
    setValidation((prev) => ({ ...prev, shipmentType: null }));
  };

  const handleServiceSelect = (service) => {
    setFormData((prev) => ({ ...prev, service }));
    setValidation((prev) => ({ ...prev, service: null }));
  };

  const checkStepValidity = (data) => {
    switch (currentStep) {
      case 1:
        return data.shipmentType !== null;
      case 2:
        return data.service !== null;
      case 3:
        return data.pickupAddress && data.dropoffAddress;
      case 4:
        return data.weight && data.width && data.length && data.height;
      case 5:
        return quote !== null;
      default:
        return false;
    }
  };

  const validateStep = (step, data) => {
    const errors = {};

    switch (step) {
      case 1:
        if (!data.shipmentType) {
          errors.shipmentType = "Please select a shipment type";
        }
        break;
      case 2:
        if (!data.service) {
          errors.service = "Please select a service";
        }
        break;
      case 3:
        if (!data.pickupAddress) {
          errors.pickupAddress = "Please select a pickup address";
        }
        if (!data.dropoffAddress) {
          errors.dropoffAddress = "Please select a dropoff address";
        }
        break;
      case 4:
        if (!data.weight || Number.parseFloat(data.weight) <= 0) {
          errors.weight = "Please enter a valid weight";
        } else if (
          data.shipmentType?.name === "Parcels" &&
          Number.parseFloat(data.weight) > 31.5
        ) {
          errors.weight = "Parcel weight cannot exceed 31.5kg";
        }
        if (!data.width || Number.parseFloat(data.width) <= 0) {
          errors.width = "Please enter a valid width";
        }
        if (!data.length || Number.parseFloat(data.length) <= 0) {
          errors.length = "Please enter a valid length";
        }
        if (!data.height || Number.parseFloat(data.height) <= 0) {
          errors.height = "Please enter a valid height";
        }
        break;
    }

    return errors;
  };

  const nextStep = () => {
    const errors = validateStep(currentStep, formData);
    if (Object.keys(errors).length > 0) {
      setValidation(errors);
      return;
    }

    setValidation({});
    if (currentStep < 5) {
      setCurrentStep(currentStep + 1);
      setTimeout(() => firstInputRef.current?.focus(), 100);
    }
  };

  const prevStep = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
      setValidation({});
    }
  };

  const handleSubmit = () => {
    if (quote) {
      navigate("/booking", {
        state: {
          quote,
          formData: {
            ...formData,
            // Pass postcodes to BookingModal
            pickupPostcode: formData.pickupPostcode || "Enter postcode",
            dropoffPostcode: formData.dropoffPostcode || "Enter postcode",
            pickupAddress: {
              line1: formData.pickupAddress.split(",")[0]?.trim(),
              city: formData.pickupAddress.split(",")[1]?.trim(),
              postal_code: formData.pickupAddress.split(",")[2]?.trim(),
            },
            dropoffAddress: {
              line1: formData.dropoffAddress.split(",")[0]?.trim(),
              city: formData.dropoffAddress.split(",")[1]?.trim(),
              postal_code: formData.dropoffAddress.split(",")[2]?.trim(),
            },
          },
        },
      });
      onClose();
    }
  };

  const downloadQuotePDF = () => {
    if (!quote) return;

    const doc = new jsPDF();
    const breakdown = quote.meta || {};

    // Header
    doc.setFontSize(20);
    doc.text("Delivery Quote", 20, 30);

    // Quote details
    doc.setFontSize(12);
    let yPos = 50;

    doc.text(`Quote ID: ${quote.id}`, 20, yPos);
    yPos += 10;
    doc.text(`Date: ${dayjs().format("DD/MM/YYYY")}`, 20, yPos);
    yPos += 20;

    // Service details
    doc.text("Service Details:", 20, yPos);
    yPos += 10;
    doc.text(`Service Type: ${breakdown.service_type}`, 30, yPos);
    yPos += 8;
    doc.text(`Shipment Type: ${breakdown.shipment_type}`, 30, yPos);
    yPos += 8;
    doc.text(`Weight: ${formData.weight}kg`, 30, yPos);
    yPos += 8;
    doc.text(`Distance: ${quote.distance_km}km`, 30, yPos);
    yPos += 20;

    // Pricing breakdown
    doc.text("Pricing Breakdown:", 20, yPos);
    yPos += 10;
    doc.text(`Base Price: £${breakdown.base_price?.toFixed(2)}`, 30, yPos);
    yPos += 8;
    doc.text(
      `Weight Charge: £${breakdown.weight_charge?.toFixed(2)}`,
      30,
      yPos
    );
    yPos += 8;
    doc.text(
      `Distance Charge: £${breakdown.distance_charge?.toFixed(2)}`,
      30,
      yPos
    );
    yPos += 8;
    doc.text(`Subtotal: £${breakdown.subtotal?.toFixed(2)}`, 30, yPos);
    yPos += 8;

    if (breakdown.fragile_charge > 0) {
      doc.text(
        `Fragile Surcharge: £${breakdown.fragile_charge?.toFixed(2)}`,
        30,
        yPos
      );
      yPos += 8;
    }

    if (breakdown.insurance_fee > 0) {
      doc.text(
        `Insurance Fee: £${breakdown.insurance_fee?.toFixed(2)}`,
        30,
        yPos
      );
      yPos += 8;
    }

    yPos += 10;
    doc.setFontSize(14);
    doc.text(`Total: £${quote.final_price?.toFixed(2)}`, 30, yPos);

    doc.save(`quote-${quote.id}.pdf`);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-4xl max-h-[95vh] overflow-y-auto animate-in zoom-in-95 duration-300">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700 bg-orange-500 text-white rounded-t-2xl">
          <div>
            <h2 className="text-2xl font-bold">Get Quote & Book</h2>
            <p className="text-orange-100 text-sm">
              Step {currentStep} of 5: {stepTitles[currentStep - 1]}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-orange-600 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-orange-300"
            aria-label="Close modal"
          >
            <X size={24} />
          </button>
        </div>

        {/* Progress Bar */}
        <div className="px-6 py-4 bg-gray-50 dark:bg-gray-800">
          <div className="flex items-center justify-between">
            {stepTitles.map((title, index) => {
              const stepNumber = index + 1;
              const isActive = stepNumber === currentStep;
              const isCompleted = stepNumber < currentStep;

              return (
                <div key={stepNumber} className="flex items-center">
                  <div
                    className={`
                      w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-colors
                      ${
                        isCompleted
                          ? "bg-green-500 text-white"
                          : isActive
                          ? "bg-orange-500 text-white"
                          : "bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-400"
                      }
                    `}
                  >
                    {isCompleted ? <Check size={16} /> : stepNumber}
                  </div>
                  <span
                    className={`
                      ml-2 text-sm font-medium hidden sm:block
                      ${
                        isActive
                          ? "text-orange-500"
                          : isCompleted
                          ? "text-green-500"
                          : "text-gray-500 dark:text-gray-400"
                      }
                    `}
                  >
                    {title}
                  </span>
                  {index < stepTitles.length - 1 && (
                    <div className="w-8 h-0.5 bg-gray-200 dark:bg-gray-700 mx-4 hidden sm:block" />
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Content */}
        <div className="p-6">
          {/* Step 1: Shipment Type */}
          {currentStep === 1 && (
            <div className="space-y-6">
              <div className="text-center">
                <h3 className="text-2xl font-semibold text-gray-900 dark:text-white mb-2">
                  What are you shipping?
                </h3>
                <p className="text-gray-600 dark:text-gray-400">
                  Select the type of shipment to get started
                </p>
              </div>

              <ShipmentTypeSelector
                shipmentTypes={shipmentTypes}
                selectedType={formData.shipmentType}
                onSelect={handleShipmentTypeSelect}
                isLoading={isLoadingTypes}
                error={typesError}
                firstInputRef={firstInputRef}
              />

              {validation.shipmentType && (
                <div className="flex items-center text-red-500 text-sm">
                  <AlertCircle size={16} className="mr-2" />
                  {validation.shipmentType}
                </div>
              )}
            </div>
          )}

          {/* Step 2: Service Selection */}
          {currentStep === 2 && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-2xl font-semibold text-gray-900 dark:text-white mb-2">
                    Choose Core Service Offering
                  </h3>
                  <p className="text-gray-600 dark:text-gray-400">
                    Selected: {formData.shipmentType?.name}
                  </p>
                </div>
                <button
                  onClick={prevStep}
                  className="flex items-center text-orange-500 hover:text-orange-600 text-sm font-medium px-4 py-2 border border-orange-500 rounded-lg hover:bg-orange-50 dark:hover:bg-orange-900/20 transition-colors"
                >
                  <ChevronLeft size={16} className="mr-1" />
                  Change Type
                </button>
              </div>

              <ServiceSelector
                services={services}
                selectedService={formData.service}
                onSelect={handleServiceSelect}
                isLoading={isLoadingServices}
                error={servicesError}
                firstInputRef={firstInputRef}
              />

              {validation.service && (
                <div className="flex items-center text-red-500 text-sm">
                  <AlertCircle size={16} className="mr-2" />
                  {validation.service}
                </div>
              )}
            </div>
          )}

          {/* Step 3: Locations */}
          {currentStep === 3 && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-2xl font-semibold text-gray-900 dark:text-white mb-2">
                    Pickup & Dropoff Locations
                  </h3>
                  <p className="text-gray-600 dark:text-gray-400">
                    Service: {formData.service?.name}
                  </p>
                </div>
                <button
                  onClick={prevStep}
                  className="flex items-center text-orange-500 hover:text-orange-600 text-sm font-medium px-4 py-2 border border-orange-500 rounded-lg hover:bg-orange-50 dark:hover:bg-orange-900/20 transition-colors"
                >
                  <ChevronLeft size={16} className="mr-1" />
                  Change Service
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <AddressInput
                  label="Pickup"
                  postcode={formData.pickupPostcode}
                  onPostcodeChange={(value) => {
                    setFormData((prev) => ({ ...prev, pickupPostcode: value }));
                    lookupPostcode(value, "pickup");
                  }}
                  address={formData.pickupAddress}
                  onAddressSelect={(address) => {
                    setFormData((prev) => ({
                      ...prev,
                      pickupAddress: address,
                    }));
                    setValidation((prev) => ({ ...prev, pickupAddress: null }));
                  }}
                  suggestions={addressSuggestions.pickup}
                  isLoading={isLoadingAddresses}
                  validation={validation.pickupAddress}
                  placeholder="Enter pickup postcode"
                />

                <AddressInput
                  label="Dropoff"
                  postcode={formData.dropoffPostcode}
                  onPostcodeChange={(value) => {
                    setFormData((prev) => ({
                      ...prev,
                      dropoffPostcode: value,
                    }));
                    lookupPostcode(value, "dropoff");
                  }}
                  address={formData.dropoffAddress}
                  onAddressSelect={(address) => {
                    setFormData((prev) => ({
                      ...prev,
                      dropoffAddress: address,
                    }));
                    setValidation((prev) => ({
                      ...prev,
                      dropoffAddress: null,
                    }));
                  }}
                  suggestions={addressSuggestions.dropoff}
                  isLoading={isLoadingAddresses}
                  validation={validation.dropoffAddress}
                  placeholder="Enter dropoff postcode"
                />
              </div>

              {(formData.pickupAddress || formData.dropoffAddress) && (
                <div className="mt-6">
                  <h4 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
                    Route Preview
                  </h4>
                  <MapComponent
                    pickupAddress={formData.pickupAddress}
                    dropoffAddress={formData.dropoffAddress}
                    isLoading={isLoadingAddresses}
                    className="w-full h-64 rounded-lg border border-gray-300 dark:border-gray-600"
                  />
                </div>
              )}
            </div>
          )}

          {/* Step 4: Parcel Details */}
          {currentStep === 4 && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-2xl font-semibold text-gray-900 dark:text-white mb-2">
                    Parcel Details
                  </h3>
                  <p className="text-gray-600 dark:text-gray-400">
                    From: {formData.pickupAddress?.split(",")[1]?.trim()} → To:{" "}
                    {formData.dropoffAddress?.split(",")[1]?.trim()}
                  </p>
                </div>
                <button
                  onClick={prevStep}
                  className="flex items-center text-orange-500 hover:text-orange-600 text-sm font-medium px-4 py-2 border border-orange-500 rounded-lg hover:bg-orange-50 dark:hover:bg-orange-900/20 transition-colors"
                >
                  <ChevronLeft size={16} className="mr-1" />
                  Change Locations
                </button>
              </div>

              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Weight (kg) *
                  </label>
                  <input
                    ref={firstInputRef}
                    type="number"
                    step="0.1"
                    min="0.1"
                    max={
                      formData.shipmentType?.name === "Parcels"
                        ? "31.5"
                        : "1000"
                    }
                    value={formData.weight || ""}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        weight: e.target.value,
                      }))
                    }
                    placeholder="Enter weight in kilograms"
                    className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-colors"
                  />
                  {validation.weight && (
                    <div className="flex items-center text-red-500 text-sm mt-2">
                      <AlertCircle size={16} className="mr-2" />
                      {validation.weight}
                    </div>
                  )}
                </div>

                <div className="flex items-center space-x-3 p-4 bg-orange-50 dark:bg-orange-900/20 rounded-lg border border-orange-200 dark:border-orange-800">
                  <input
                    type="checkbox"
                    id="fragile"
                    checked={formData.fragile || false}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        fragile: e.target.checked,
                      }))
                    }
                    className="w-5 h-5 text-orange-500 border-gray-300 dark:border-gray-600 rounded focus:ring-orange-500 focus:ring-2"
                  />
                  <label
                    htmlFor="fragile"
                    className="text-sm font-medium text-gray-700 dark:text-gray-300 flex-1"
                  >
                    Is this parcel fragile?
                  </label>
                  <div className="group relative">
                    <AlertCircle
                      size={16}
                      className="text-gray-400 cursor-help"
                    />
                    <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 bg-gray-900 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-50">
                      Extra handling for delicate items (may incur additional
                      fees)
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <h4 className="text-lg font-medium text-gray-900 dark:text-white">
                    Package Dimensions
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Width (cm) *
                      </label>
                      <input
                        type="number"
                        min="1"
                        value={formData.width || ""}
                        onChange={(e) =>
                          setFormData((prev) => ({
                            ...prev,
                            width: e.target.value,
                          }))
                        }
                        placeholder="Width"
                        className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-colors"
                      />
                      {validation.width && (
                        <div className="flex items-center text-red-500 text-sm mt-2">
                          <AlertCircle size={16} className="mr-2" />
                          {validation.width}
                        </div>
                      )}
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Length (cm) *
                      </label>
                      <input
                        type="number"
                        min="1"
                        value={formData.length || ""}
                        onChange={(e) =>
                          setFormData((prev) => ({
                            ...prev,
                            length: e.target.value,
                          }))
                        }
                        placeholder="Length"
                        className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-colors"
                      />
                      {validation.length && (
                        <div className="flex items-center text-red-500 text-sm mt-2">
                          <AlertCircle size={16} className="mr-2" />
                          {validation.length}
                        </div>
                      )}
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Height (cm) *
                      </label>
                      <input
                        type="number"
                        min="1"
                        value={formData.height || ""}
                        onChange={(e) =>
                          setFormData((prev) => ({
                            ...prev,
                            height: e.target.value,
                          }))
                        }
                        placeholder="Height"
                        className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-colors"
                      />
                      {validation.height && (
                        <div className="flex items-center text-red-500 text-sm mt-2">
                          <AlertCircle size={16} className="mr-2" />
                          {validation.height}
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="flex items-center space-x-3">
                    <input
                      type="checkbox"
                      id="insurance"
                      checked={formData.insurance || false}
                      onChange={(e) =>
                        setFormData((prev) => ({
                          ...prev,
                          insurance: e.target.checked,
                        }))
                      }
                      className="w-5 h-5 text-orange-500 border-gray-300 dark:border-gray-600 rounded focus:ring-orange-500 focus:ring-2"
                    />
                    <label
                      htmlFor="insurance"
                      className="text-sm font-medium text-gray-700 dark:text-gray-300"
                    >
                      Add insurance coverage
                    </label>
                  </div>

                  {formData.insurance && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Insurance Amount (£)
                      </label>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={formData.insuranceAmount || ""}
                        onChange={(e) =>
                          setFormData((prev) => ({
                            ...prev,
                            insuranceAmount: e.target.value,
                          }))
                        }
                        placeholder="Enter insurance value"
                        className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-colors"
                      />
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Step 5: Insurance & Quote */}
          {currentStep === 5 && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-2xl font-semibold text-gray-900 dark:text-white mb-2">
                    Insurance & Quote
                  </h3>
                  <p className="text-gray-600 dark:text-gray-400">
                    Review your quote and proceed to booking
                  </p>
                </div>
                <button
                  onClick={prevStep}
                  className="flex items-center text-orange-500 hover:text-orange-600 text-sm font-medium px-4 py-2 border border-orange-500 rounded-lg hover:bg-orange-50 dark:hover:bg-orange-900/20 transition-colors"
                >
                  <ChevronLeft size={16} className="mr-1" />
                  Change Details
                </button>
              </div>

              <QuoteDisplay
                quote={quote}
                onDownloadPDF={downloadQuotePDF}
                isLoading={isLoadingQuote}
                formData={formData}
              />
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="flex justify-between items-center p-6 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 rounded-b-2xl">
          <div className="flex space-x-3">
            {currentStep > 1 && (
              <button
                onClick={prevStep}
                className="flex items-center px-4 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors focus:outline-none focus:ring-2 focus:ring-orange-500"
              >
                <ChevronLeft size={16} className="mr-1" />
                Back
              </button>
            )}
          </div>

          <div className="flex space-x-3">
            {currentStep < 5 ? (
              <button
                onClick={nextStep}
                disabled={!checkStepValidity(formData)}
                className="flex items-center px-6 py-3 bg-orange-500 hover:bg-orange-600 disabled:bg-gray-300 disabled:cursor-not-allowed text-white font-medium rounded-lg transition-all transform hover:scale-105 disabled:transform-none focus:outline-none focus:ring-2 focus:ring-orange-500"
              >
                Next
                <ChevronRight size={16} className="ml-1" />
              </button>
            ) : (
              <button
                onClick={handleSubmit}
                disabled={isLoadingQuote || !quote}
                className="flex items-center px-6 py-3 bg-orange-500 hover:bg-orange-600 disabled:bg-gray-400 disabled:cursor-not-allowed text-white font-bold rounded-lg transition-all transform hover:scale-105 disabled:transform-none focus:outline-none focus:ring-2 focus:ring-orange-500"
              >
                {isLoadingQuote ? (
                  <>
                    <Loader2 size={20} className="mr-2 animate-spin" />
                    Calculating...
                  </>
                ) : (
                  <>
                    Get Quote & Continue
                    <ChevronRight size={16} className="ml-1" />
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
