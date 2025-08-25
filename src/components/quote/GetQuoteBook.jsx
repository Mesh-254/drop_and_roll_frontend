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
  FileText,
  Shield,
  Calculator,
  ChevronLeft,
  ChevronRight,
  Check,
  AlertCircle,
  Download,
  Loader2,
} from "lucide-react";

const stepTitles = [
  "Shipment Type",
  "Service Offering",
  "Locations",
  "Parcel Details",
  "Insurance & Quote",
];

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
        <Loader2 size={24} className="animate-spin mr-2 text-orange-500" />
        <span className="text-gray-600 dark:text-gray-400">
          Loading shipment types...
        </span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
        <div className="flex items-center text-red-700 dark:text-red-300">
          <AlertCircle size={20} className="mr-2" />
          <span>Failed to load shipment types: {error}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {shipmentTypes.map((type, index) => {
        const IconComponent =
          type.name === "Parcels"
            ? Package
            : type.name === "Cargo"
            ? Truck
            : FileText;
        const isSelected = selectedType?.id === type.id;

        return (
          <button
            key={type.id}
            ref={index === 0 ? firstInputRef : null}
            onClick={() => onSelect(type)}
            className={`
              p-6 border-2 rounded-xl transition-all text-center hover:scale-105 focus:outline-none focus:ring-2 focus:ring-orange-500
              ${
                isSelected
                  ? "border-orange-500 bg-orange-50 dark:bg-orange-900/20"
                  : "border-gray-200 dark:border-gray-700 hover:border-orange-500 hover:bg-gray-50 dark:hover:bg-gray-800"
              }
            `}
          >
            <div className="flex flex-col items-center">
              <div
                className={`
                w-12 h-12 rounded-full flex items-center justify-center mb-4 transition-colors
                ${
                  isSelected
                    ? "bg-orange-500 text-white"
                    : "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400"
                }
              `}
              >
                <IconComponent size={24} />
              </div>
              <h4 className="font-semibold text-gray-900 dark:text-white mb-2">
                {type.name}
              </h4>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                {type.description}
              </p>
            </div>
          </button>
        );
      })}
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
        <Loader2 size={24} className="animate-spin mr-2 text-orange-500" />
        <span className="text-gray-600 dark:text-gray-400">
          Loading services...
        </span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
        <div className="flex items-center text-red-700 dark:text-red-300">
          <AlertCircle size={20} className="mr-2" />
          <span>Failed to load services: {error}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {services.map((service, index) => {
        const isSelected = selectedService?.id === service.id;

        return (
          <button
            key={service.id}
            ref={index === 0 ? firstInputRef : null}
            onClick={() => onSelect(service)}
            className={`
              p-6 border-2 rounded-xl transition-all text-left hover:scale-105 focus:outline-none focus:ring-2 focus:ring-orange-500
              ${
                isSelected
                  ? "border-orange-500 bg-orange-50 dark:bg-orange-900/20"
                  : "border-gray-200 dark:border-gray-700 hover:border-orange-500 hover:bg-gray-50 dark:hover:bg-gray-800"
              }
            `}
          >
            <div className="flex justify-between items-start mb-3">
              <h4 className="font-semibold text-gray-900 dark:text-white">
                {service.name}
              </h4>
              <span className="text-orange-500 font-bold">
                From ${service.price}
              </span>
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              {service.description}
            </p>
          </button>
        );
      })}
    </div>
  );
};

const AddressInput = ({
  label,
  postcode,
  onPostcodeChange,
  address,
  onAddressSelect,
  suggestions,
  isLoading,
  validation,
  placeholder = "Enter postcode",
}) => {
  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          {label} Postcode *
        </label>
        <div className="relative">
          <input
            type="text"
            value={postcode}
            onChange={(e) => onPostcodeChange(e.target.value)}
            placeholder={placeholder}
            className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-colors"
          />
          {isLoading && (
            <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
              <Loader2 size={16} className="animate-spin text-orange-500" />
            </div>
          )}
        </div>
        {validation && (
          <div className="flex items-center text-red-500 text-sm mt-2">
            <AlertCircle size={16} className="mr-2" />
            {validation}
          </div>
        )}
      </div>

      {suggestions.length > 0 && (
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Select {label} Address *
          </label>
          <div className="space-y-2 max-h-40 overflow-y-auto">
            {suggestions.map((suggestion, index) => (
              <button
                key={index}
                onClick={() => onAddressSelect(suggestion)}
                className={`
                  w-full p-3 text-left border rounded-lg transition-colors hover:bg-gray-50 dark:hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-orange-500
                  ${
                    address === suggestion
                      ? "border-orange-500 bg-orange-50 dark:bg-orange-900/20"
                      : "border-gray-200 dark:border-gray-700"
                  }
                `}
              >
                <span className="text-sm text-gray-900 dark:text-white">
                  {suggestion}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

const QuoteDisplay = ({ quote, onDownloadPDF, isLoading, formData }) => {
  if (isLoading) {
    return (
      <div className="bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6">
        <div className="flex items-center justify-center">
          <Loader2 size={20} className="animate-spin mr-2 text-orange-500" />
          <span className="text-gray-600 dark:text-gray-400">
            Calculating quote...
          </span>
        </div>
      </div>
    );
  }

  if (!quote) return null;

  return (
    <div className="bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-lg p-6 animate-in slide-in-from-bottom duration-300">
      <div className="flex items-center justify-between mb-4">
        <h4 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center">
          <Calculator size={20} className="mr-2 text-orange-500" />
          Quote Breakdown
        </h4>
        <button
          onClick={onDownloadPDF}
          className="flex items-center px-3 py-2 text-orange-600 hover:text-orange-700 border border-orange-300 rounded-lg hover:bg-orange-100 dark:hover:bg-orange-900/30 transition-colors text-sm"
        >
          <Download size={16} className="mr-1" />
          Download PDF
        </button>
      </div>

      <div className="space-y-2 text-sm">
        <div className="flex justify-between">
          <span className="text-gray-600 dark:text-gray-400">
            Base shipping cost:
          </span>
          <span className="font-medium text-gray-900 dark:text-white">
            ${quote.base_price || quote.subtotal}
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-600 dark:text-gray-400">Distance:</span>
          <span className="font-medium text-gray-900 dark:text-white">
            {quote.distance_km || quote.distanceKm} km
          </span>
        </div>
        {formData.insurance && (
          <div className="flex justify-between">
            <span className="text-gray-600 dark:text-gray-400">
              Insurance fee:
            </span>
            <span className="font-medium text-gray-900 dark:text-white">
              $
              {quote.insuranceFee ||
                (Number.parseFloat(formData.insuranceAmount) * 0.02).toFixed(2)}
            </span>
          </div>
        )}
        {formData.fragile && (
          <div className="flex justify-between">
            <span className="text-gray-600 dark:text-gray-400">
              Fragile handling:
            </span>
            <span className="font-medium text-gray-900 dark:text-white">
              $
              {quote.fragileCharge ||
                ((quote.base_price || quote.subtotal) * 0.25).toFixed(2)}
            </span>
          </div>
        )}
        <div className="border-t border-orange-200 dark:border-orange-800 pt-2 mt-2">
          <div className="flex justify-between text-lg font-bold">
            <span className="text-gray-900 dark:text-white">Total Quote:</span>
            <span className="text-orange-500">
              ${quote.final_price || quote.total}
            </span>
          </div>
        </div>
        {quote.fallback && (
          <p className="text-xs text-orange-600 dark:text-orange-400 mt-2">
            * Estimated pricing (backend calculation unavailable)
          </p>
        )}
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
  const [quoteId, setQuoteId] = useState(null); // Store quote ID to prevent duplicates
  const [lastQuoteData, setLastQuoteData] = useState(null); // Track form data changes

  const [formData, setFormData] = useState({
    shipmentType: null,
    service: null,
    pickupPostcode: "",
    pickupAddress: "",
    dropoffPostcode: "",
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

  useEffect(() => {
    if (isOpen) {
      fetchShipmentTypes();
      fetchServiceTypes();
    }
  }, [isOpen]);

  const fetchShipmentTypes = async () => {
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
      console.error("Failed to fetch shipment types:", error);
      setTypesError("Failed to load shipment types");
    } finally {
      setIsLoadingTypes(false);
    }
  };

  const fetchServiceTypes = async () => {
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
      console.error("Failed to fetch service types:", error);
      setServicesError("Failed to load service types");
    } finally {
      setIsLoadingServices(false);
    }
  };

  const lookupPostcode = useCallback(async (postcode, type) => {
    if (!postcode || postcode.length < 3) {
      setAddressSuggestions((prev) => ({ ...prev, [type]: [] }));
      return;
    }

    // Clear previous debounce
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    // Debounce the API call
    debounceRef.current = setTimeout(async () => {
      setIsLoadingAddresses(true);

      try {
        const API_KEY =
          import.meta.env.VITE_GETADDRESS_API_KEY || "demo-api-key";

        // First try autocomplete endpoint
        let response = await fetch(
          `https://api.getAddress.io/autocomplete/${encodeURIComponent(
            postcode
          )}?api-key=${API_KEY}`
        );

        if (!response.ok) {
          throw new Error(`API Error: ${response.status}`);
        }

        let data = await response.json();
        let addresses = [];

        if (data.suggestions && data.suggestions.length > 0) {
          addresses = data.suggestions.map((suggestion) => suggestion.address);
        } else {
          // Fallback to postcode lookup
          try {
            response = await fetch(
              `https://api.getAddress.io/get/${encodeURIComponent(
                postcode
              )}?api-key=${API_KEY}`
            );
            if (response.ok) {
              data = await response.json();
              if (data.addresses && data.addresses.length > 0) {
                addresses = data.addresses.map(
                  (addr) => `${addr}, ${postcode.toUpperCase()}`
                );
              }
            }
          } catch (fallbackError) {
            console.warn("Fallback API call failed:", fallbackError);
          }
        }

        // Filter addresses for operating areas
        const filteredAddresses = addresses.filter((address) => {
          const addressLower = address.toLowerCase();
          return (
            addressLower.includes("milton keynes") ||
            addressLower.includes("oxford")
          );
        });

        setAddressSuggestions((prev) => ({
          ...prev,
          [type]: filteredAddresses.length > 0 ? filteredAddresses : addresses,
        }));
      } catch (error) {
        console.error("Address lookup failed:", error);

        // Fallback to mock data
        const mockAddresses = [
          `123 High Street, Milton Keynes, ${postcode.toUpperCase()}`,
          `456 Oxford Road, Oxford, ${postcode.toUpperCase()}`,
          `789 Main Street, Milton Keynes, ${postcode.toUpperCase()}`,
        ];
        setAddressSuggestions((prev) => ({ ...prev, [type]: mockAddresses }));
      } finally {
        setIsLoadingAddresses(false);
      }
    }, 300); // 300ms debounce
  }, []);

  const calculateQuote = async () => {
    if (!formData.shipmentType || !formData.service) {
      console.error("Missing shipment type or service");
      return;
    }

    // Check if form data has changed significantly
    const currentQuoteData = {
      shipmentType: formData.shipmentType.id,
      service: formData.service.id,
      weight: formData.weight,
      pickupAddress: formData.pickupAddress,
      dropoffAddress: formData.dropoffAddress,
      fragile: formData.fragile,
      insurance: formData.insurance,
      insuranceAmount: formData.insuranceAmount,
      dimensions: {
        width: formData.width,
        length: formData.length,
        height: formData.height,
      },
    };

    // If we have an existing quote and data hasn't changed, reuse it
    if (
      quoteId &&
      lastQuoteData &&
      JSON.stringify(currentQuoteData) === JSON.stringify(lastQuoteData)
    ) {
      console.log("[v0] Reusing existing quote:", quoteId);
      return;
    }

    setIsLoadingQuote(true);

    try {
      const distance = await bookingApi.calculateDistance(
        {
          city:
            formData.pickupAddress?.split(",")[1]?.trim() || "Milton Keynes",
          latitude: null,
          longitude: null,
        },
        {
          city: formData.dropoffAddress?.split(",")[1]?.trim() || "Oxford",
          latitude: null,
          longitude: null,
        }
      );

      // Prepare quote data for backend
      const quoteData = {
        shipmentType: formData.shipmentType,
        service: formData.service,
        weightKg: Number.parseFloat(formData.weight),
        distanceKm: distance,
        fragile: formData.fragile,
        insuranceAmount: formData.insurance
          ? Number.parseFloat(formData.insuranceAmount)
          : 0,
        dimensions: {
          width: Number.parseFloat(formData.width) || null,
          length: Number.parseFloat(formData.length) || null,
          height: Number.parseFloat(formData.height) || null,
        },
        surge: 1.0,
        discount: 0.0,
      };

      console.log("[v0] Creating new quote with data:", quoteData);

      // Call backend API to compute quote
      const result = await bookingApi.createQuote(quoteData);

      if (result.success) {
        const backendQuote = result.data;
        setQuote(backendQuote);
        setQuoteId(backendQuote.id); // Store quote ID
        setLastQuoteData(currentQuoteData); // Store form data snapshot
        console.log("[v0] Quote created successfully:", backendQuote.id);
      } else {
        throw new Error(result.message);
      }
    } catch (error) {
      console.error("Quote calculation failed:", error);

      // Enhanced fallback calculation
      const service = formData.service;
      const basePrice = service?.price || 15;
      const weight = Number.parseFloat(formData.weight) || 1;
      const weightMultiplier = weight > 5 ? 1 + (weight - 5) * 0.1 : 1;
      const fragileMultiplier = formData.fragile ? 1.25 : 1;
      const insuranceFee = formData.insurance
        ? Number.parseFloat(formData.insuranceAmount) * 0.02
        : 0;

      const subtotal =
        Math.round(basePrice * weightMultiplier * fragileMultiplier * 100) /
        100;
      const total = Math.round((subtotal + insuranceFee) * 100) / 100;

      setQuote({
        base_price: subtotal,
        final_price: total,
        distance_km: 15,
        insuranceFee: Math.round(insuranceFee * 100) / 100,
        fragileCharge: formData.fragile
          ? Math.round((subtotal / fragileMultiplier) * 0.25 * 100) / 100
          : 0,
        fallback: true,
      });
    } finally {
      setIsLoadingQuote(false);
    }
  };

  const downloadQuotePDF = () => {
    if (!quote) return;

    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.width;

    // Header
    doc.setFontSize(20);
    doc.setTextColor(255, 87, 34); // Orange color
    doc.text("Drop & Roll - Shipping Quote", pageWidth / 2, 30, {
      align: "center",
    });

    // Quote ID and date
    doc.setFontSize(12);
    doc.setTextColor(0, 0, 0);
    doc.text(`Quote ID: ${quote.id || "FALLBACK-" + Date.now()}`, 20, 50);
    doc.text(`Generated: ${dayjs().format("DD/MM/YYYY HH:mm")}`, 20, 60);

    // Shipment details
    doc.setFontSize(14);
    doc.text("Shipment Details:", 20, 80);
    doc.setFontSize(11);
    doc.text(`Type: ${formData.shipmentType?.name || "N/A"}`, 20, 95);
    doc.text(`Service: ${formData.service?.name || "N/A"}`, 20, 105);
    doc.text(`Weight: ${formData.weight} kg`, 20, 115);
    doc.text(
      `Dimensions: ${formData.width}×${formData.length}×${formData.height} cm`,
      20,
      125
    );
    doc.text(`Fragile: ${formData.fragile ? "Yes" : "No"}`, 20, 135);

    // Addresses
    doc.text("Addresses:", 20, 155);
    doc.text(`From: ${formData.pickupAddress}`, 20, 170);
    doc.text(`To: ${formData.dropoffAddress}`, 20, 180);
    doc.text(`Distance: ${quote.distance_km || quote.distanceKm} km`, 20, 190);

    // Quote breakdown
    doc.setFontSize(14);
    doc.text("Quote Breakdown:", 20, 210);
    doc.setFontSize(11);
    doc.text(
      `Base shipping cost: $${quote.base_price || quote.subtotal}`,
      20,
      225
    );

    if (formData.insurance) {
      doc.text(
        `Insurance fee: $${
          quote.insuranceFee ||
          (Number.parseFloat(formData.insuranceAmount) * 0.02).toFixed(2)
        }`,
        20,
        235
      );
    }

    if (formData.fragile) {
      doc.text(
        `Fragile handling: $${
          quote.fragileCharge ||
          ((quote.base_price || quote.subtotal) * 0.25).toFixed(2)
        }`,
        20,
        245
      );
    }

    // Total
    doc.setFontSize(16);
    doc.setTextColor(255, 87, 34);
    doc.text(`Total: $${quote.final_price || quote.total}`, 20, 265);

    if (quote.fallback) {
      doc.setFontSize(10);
      doc.setTextColor(255, 0, 0);
      doc.text(
        "* Estimated pricing (backend calculation unavailable)",
        20,
        280
      );
    }

    doc.save(`drop-roll-quote-${quote.id || Date.now()}.pdf`);
  };

  const validateStep = (step) => {
    const errors = {};

    switch (step) {
      case 1:
        if (!formData.shipmentType) {
          errors.shipmentType = "Please select a shipment type";
        }
        break;
      case 2:
        if (!formData.service) {
          errors.service = "Please select a service";
        }
        break;
      case 3:
        if (!formData.pickupPostcode.trim()) {
          errors.pickupPostcode = "Pickup postcode is required";
        }
        if (!formData.pickupAddress.trim()) {
          errors.pickupAddress = "Please select a pickup address";
        }
        if (!formData.dropoffPostcode.trim()) {
          errors.dropoffPostcode = "Dropoff postcode is required";
        }
        if (!formData.dropoffAddress.trim()) {
          errors.dropoffAddress = "Please select a dropoff address";
        }
        break;
      case 4:
        if (!formData.weight || Number.parseFloat(formData.weight) <= 0) {
          errors.weight = "Weight must be greater than 0";
        }
        if (
          formData.shipmentType?.name === "Parcels" &&
          Number.parseFloat(formData.weight) > 31.5
        ) {
          errors.weight = "Parcels must be 31.5kg or less";
        }
        if (!formData.width || Number.parseFloat(formData.width) <= 0) {
          errors.width = "Width is required";
        }
        if (!formData.length || Number.parseFloat(formData.length) <= 0) {
          errors.length = "Length is required";
        }
        if (
          formData.insurance &&
          (!formData.insuranceAmount ||
            Number.parseFloat(formData.insuranceAmount) <= 0)
        ) {
          errors.insuranceAmount = "Insurance amount must be greater than 0";
        }
        break;
    }

    setValidation(errors);
    return Object.keys(errors).length === 0;
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
        return (
          data.weight &&
          data.width &&
          data.length &&
          (!data.insurance || data.insuranceAmount)
        );
      case 5:
        return quote !== null;
      default:
        return false;
    }
  };

  const nextStep = () => {
    if (validateStep(currentStep)) {
      if (currentStep === 4) {
        calculateQuote();
      }
      setCurrentStep((prev) => Math.min(prev + 1, 5));
    }
  };

  const prevStep = () => {
    setCurrentStep((prev) => Math.max(prev - 1, 1));
  };

  const handleShipmentTypeSelect = (type) => {
    setFormData((prev) => ({ ...prev, shipmentType: type }));
    setValidation((prev) => ({ ...prev, shipmentType: null }));
  };

  const handleServiceSelect = (service) => {
    setFormData((prev) => ({ ...prev, service: service }));
    setValidation((prev) => ({ ...prev, service: null }));
  };

  const handleSubmit = () => {
    if (!quote || !quoteId) {
      console.error("No quote available for booking");
      return;
    }

    // Structure form data for booking API compatibility
    const structuredFormData = {
      shipmentType: formData.shipmentType,
      service: formData.service,
      weightKg: Number.parseFloat(formData.weight),
      distanceKm: quote.distance_km || quote.distanceKm,
      fragile: formData.fragile,
      insuranceAmount: formData.insurance
        ? Number.parseFloat(formData.insuranceAmount)
        : 0,
      dimensions: {
        width: Number.parseFloat(formData.width) || null,
        length: Number.parseFloat(formData.length) || null,
        height: Number.parseFloat(formData.height) || null,
      },
      pickupAddress: {
        line1: formData.pickupAddress.split(",")[0]?.trim(),
        city: formData.pickupAddress.split(",")[1]?.trim() || "Milton Keynes",
        postalCode: formData.pickupPostcode,
        country: "GB",
      },
      dropoffAddress: {
        line1: formData.dropoffAddress.split(",")[0]?.trim(),
        city: formData.dropoffAddress.split(",")[1]?.trim() || "Oxford",
        postalCode: formData.dropoffPostcode,
        country: "GB",
      },
    };

    console.log("[v0] Navigating to booking with:", {
      structuredFormData,
      quote,
      quoteId,
    });

    navigate("/booking", {
      state: {
        formData: structuredFormData,
        quote: quote,
        quoteId: quoteId,
      },
    });
  };

  // Reset form when modal closes
  useEffect(() => {
    if (!isOpen) {
      setCurrentStep(1);
      setFormData({
        shipmentType: null,
        service: null,
        pickupPostcode: "",
        pickupAddress: "",
        dropoffPostcode: "",
        dropoffAddress: "",
        weight: "",
        fragile: false,
        width: "",
        length: "",
        height: "",
        insurance: false,
        insuranceAmount: "",
      });
      setValidation({});
      setQuote(null);
      setQuoteId(null);
      setLastQuoteData(null);
      setAddressSuggestions({ pickup: [], dropoff: [] });
    }
  }, [isOpen]);

  // Focus management
  useEffect(() => {
    if (isOpen && firstInputRef.current) {
      setTimeout(() => firstInputRef.current?.focus(), 100);
    }
  }, [isOpen, currentStep]);

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
                        Height (cm)
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
                        placeholder="Height (optional)"
                        className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-colors"
                      />
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="flex items-center space-x-3 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
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
                      className="w-5 h-5 text-blue-500 border-gray-300 dark:border-gray-600 rounded focus:ring-blue-500 focus:ring-2"
                    />
                    <label
                      htmlFor="insurance"
                      className="text-sm font-medium text-gray-700 dark:text-gray-300 flex-1"
                    >
                      Add insurance coverage
                    </label>
                    <div className="group relative">
                      <Shield size={16} className="text-blue-500 cursor-help" />
                      <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 bg-gray-900 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-50">
                        Protect your shipment with insurance coverage (2% of
                        declared value)
                      </div>
                    </div>
                  </div>

                  {formData.insurance && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Declared Value ($) *
                      </label>
                      <input
                        type="number"
                        min="1"
                        step="0.01"
                        value={formData.insuranceAmount || ""}
                        onChange={(e) =>
                          setFormData((prev) => ({
                            ...prev,
                            insuranceAmount: e.target.value,
                          }))
                        }
                        placeholder="Enter the value of your shipment"
                        className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-colors"
                      />
                      {validation.insuranceAmount && (
                        <div className="flex items-center text-red-500 text-sm mt-2">
                          <AlertCircle size={16} className="mr-2" />
                          {validation.insuranceAmount}
                        </div>
                      )}
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
                    Quote Summary
                  </h3>
                  <p className="text-gray-600 dark:text-gray-400">
                    Review your shipment details and get your quote
                  </p>
                </div>
                <button
                  onClick={prevStep}
                  className="flex items-center text-orange-500 hover:text-orange-600 text-sm font-medium px-4 py-2 border border-orange-500 rounded-lg hover:bg-orange-50 dark:hover:bg-orange-900/20 transition-colors"
                >
                  <ChevronLeft size={16} className="mr-1" />
                  Edit Details
                </button>
              </div>

              {/* Summary */}
              <div className="bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6">
                <h4 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center">
                  <Package size={20} className="mr-2 text-orange-500" />
                  Shipment Summary
                </h4>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">
                      Type:
                    </span>
                    <span className="font-medium text-gray-900 dark:text-white">
                      {formData.shipmentType?.name}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">
                      Service:
                    </span>
                    <span className="font-medium text-gray-900 dark:text-white">
                      {formData.service?.name}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">
                      Weight:
                    </span>
                    <span className="font-medium text-gray-900 dark:text-white">
                      {formData.weight} kg
                    </span>
                  </div>
                  {formData.width && formData.length && (
                    <div className="flex justify-between">
                      <span className="text-gray-600 dark:text-gray-400">
                        Dimensions:
                      </span>
                      <span className="font-medium text-gray-900 dark:text-white">
                        {formData.width} × {formData.length}{" "}
                        {formData.height && `× ${formData.height}`} cm
                      </span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">
                      Fragile:
                    </span>
                    <span className="font-medium text-gray-900 dark:text-white">
                      {formData.fragile ? "Yes" : "No"}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">
                      From:
                    </span>
                    <span className="font-medium text-gray-900 dark:text-white text-right">
                      {formData.pickupAddress}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">
                      To:
                    </span>
                    <span className="font-medium text-gray-900 dark:text-white text-right">
                      {formData.dropoffAddress}
                    </span>
                  </div>
                  {formData.insurance && (
                    <div className="flex justify-between">
                      <span className="text-gray-600 dark:text-gray-400">
                        Insurance:
                      </span>
                      <span className="font-medium text-gray-900 dark:text-white">
                        ${formData.insuranceAmount}
                      </span>
                    </div>
                  )}
                </div>
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
