"use client";
import { useNavigate } from "react-router-dom";
import apiConnection from "../../api/apiConnection";
import jsPDF from "jspdf";
import dayjs from "dayjs";
import { useState, useEffect, useRef, useCallback } from "react";
import {
  X,
  Package,
  Truck,
  FileText,
  MapPin,
  Shield,
  Calculator,
  ChevronLeft,
  ChevronRight,
  Check,
  AlertCircle,
  Download,
  Loader2,
} from "lucide-react";

// Shipment types as specified
const shipmentTypes = [
  {
    id: "parcels",
    title: "Parcels or Documents",
    icon: Package,
    description:
      "Small packages, documents, and lightweight items up to 31.5kg",
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
];

// Service offerings as specified
const services = [
  {
    id: "standard",
    title: "Standard",
    description:
      "Same/Next-Day Delivery: Reliable delivery with guaranteed timeframes.",
    price: "From $8",
    basePrice: 8,
  },
  {
    id: "express",
    title: "Express",
    description: "1-2 Hour Urban Drop: Ultra-fast delivery in urban areas.",
    price: "From $25",
    basePrice: 25,
  },
  {
    id: "business",
    title: "Business Solutions",
    description: "Recurring Pickups: Scheduled pickups for regular shipping.",
    price: "From $12",
    basePrice: 12,
  },
  {
    id: "specialized",
    title: "Specialized",
    description:
      "Temp-Sensitive Shipping: Climate-controlled shipping for sensitive items.",
    price: "From $30",
    basePrice: 30,
  },
];

const stepTitles = [
  "Shipment Type",
  "Service Offering",
  "Locations",
  "Parcel Details",
  "Insurance & Quote",
];

export default function GetQuoteModal({ isOpen, onClose }) {
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState(1);
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

  const [manualPickupStreet, setManualPickupStreet] = useState("");
  const [manualPickupCity, setManualPickupCity] = useState("");
  const [manualPickupPostcode, setManualPickupPostcode] = useState("");

  const [manualDropoffStreet, setManualDropoffStreet] = useState("");
  const [manualDropoffCity, setManualDropoffCity] = useState("");
  const [manualDropoffPostcode, setManualDropoffPostcode] = useState("");

  const firstInputRef = useRef(null);
  const debounceRef = useRef(null);

  const lookupPostcode = async (postcode, type) => {
    if (!postcode || postcode.length < 3) {
      setAddressSuggestions((prev) => ({ ...prev, [type]: [] }));
      return;
    }

    setIsLoadingAddresses(true);

    try {
      // Real API integration with getaddress.io
      const API_KEY = import.meta.env.VITE_GETADDRESS_API_KEY || "demo-api-key";

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
        // Use autocomplete suggestions
        addresses = data.suggestions.map((suggestion) => suggestion.address);
      } else {
        // Fallback to postcode lookup if autocomplete fails
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

      // Filter addresses to only show Milton Keynes and Oxford locations
      const filteredAddresses = addresses.filter((address) => {
        const addressLower = address.toLowerCase();
        return (
          addressLower.includes("milton keynes") ||
          addressLower.includes("oxford")
        );
      });

      // If no valid addresses found in operating areas, show all but with warning
      if (filteredAddresses.length === 0 && addresses.length > 0) {
        setAddressSuggestions((prev) => ({ ...prev, [type]: addresses }));
      } else {
        setAddressSuggestions((prev) => ({
          ...prev,
          [type]: filteredAddresses,
        }));
      }
    } catch (error) {
      console.error("Address lookup failed:", error);

      // Fallback to mock data for development/demo
      const mockAddresses = [
        `123 High Street, Milton Keynes, ${postcode.toUpperCase()}`,
        `456 Main Road, Oxford, ${postcode.toUpperCase()}`,
        `789 Church Lane, Milton Keynes, ${postcode.toUpperCase()}`,
      ];

      setAddressSuggestions((prev) => ({ ...prev, [type]: mockAddresses }));
    } finally {
      setIsLoadingAddresses(false);
    }
  };

  const handlePostcodeChange = (value, type) => {
    setFormData((prev) => ({ ...prev, [`${type}Postcode`]: value }));

    // Clear previous timeout
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    // Debounce API call
    debounceRef.current = setTimeout(() => {
      lookupPostcode(value, type);
    }, 500);
  };

  const validateStep = useCallback(
    (step) => {
      const errors = {};

      switch (step) {
        case 1: {
          if (!formData.shipmentType)
            errors.shipmentType = "Please select a shipment type";
          break;
        }
        case 2: {
          if (!formData.service) errors.service = "Please select a service";
          break;
        }
        case 3: {
          if (!formData.pickupAddress)
            errors.pickupAddress = "Please select pickup address";
          if (!formData.dropoffAddress)
            errors.dropoffAddress = "Please select dropoff address";

          // Handle both string and object address formats
          const getAddressString = (address) => {
            if (typeof address === "string") return address;
            if (typeof address === "object" && address.formatted_address)
              return address.formatted_address;
            if (typeof address === "object" && address.address)
              return address.address;
            return "";
          };

          const pickupStr = getAddressString(
            formData.pickupAddress
          ).toLowerCase();
          const dropoffStr = getAddressString(
            formData.dropoffAddress
          ).toLowerCase();

          const isPickupValid =
            pickupStr.includes("milton keynes") || pickupStr.includes("oxford");
          const isDropoffValid =
            dropoffStr.includes("milton keynes") ||
            dropoffStr.includes("oxford");

          if (formData.pickupAddress && !isPickupValid)
            errors.pickupAddress =
              "Sorry, this location is not within our operating areas (Milton Keynes or Oxford)";
          if (formData.dropoffAddress && !isDropoffValid)
            errors.dropoffAddress =
              "Sorry, this location is not within our operating areas (Milton Keynes or Oxford)";
          break;
        }
        case 4: {
          if (!formData.weight || formData.weight <= 0)
            errors.weight = "Please enter a valid weight";
          if (
            formData.shipmentType?.id === "parcels" &&
            formData.weight > 31.5
          ) {
            errors.weight = "Parcels must be 31.5kg or less";
          }
          if (formData.shipmentType?.id === "parcels") {
            if (!formData.width || formData.width <= 0)
              errors.width = "Please enter width";
            if (!formData.length || formData.length <= 0)
              errors.length = "Please enter length";
            if (
              formData.fragile &&
              (!formData.height || formData.height <= 0)
            ) {
              errors.height = "Height is required for fragile items";
            }
          }
          break;
        }
        case 5: {
          if (
            formData.insurance &&
            (!formData.insuranceAmount ||
              formData.insuranceAmount < 50 ||
              formData.insuranceAmount > 5000)
          ) {
            errors.insuranceAmount =
              "Insurance amount must be between $50 and $5000";
          }
          break;
        }
        default:
          break;
      }

      setValidation(errors);
      return Object.keys(errors).length === 0;
    },
    [formData]
  );

  const nextStep = useCallback(() => {
    if (validateStep(currentStep)) {
      if (currentStep < 5) {
        setCurrentStep(currentStep + 1);
      }
    }
  }, [currentStep, validateStep]);

  const prevStep = useCallback(() => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
      setValidation({}); // Clear validation errors when going back
    }
  }, [currentStep]);

  const handleShipmentTypeSelect = useCallback((type) => {
    setFormData((prev) => ({ ...prev, shipmentType: type }));
    setValidation({}); // Clear any validation errors
    // Auto-advance after a short delay
    setTimeout(() => {
      setCurrentStep(2);
    }, 300);
  }, []);

  const handleServiceSelect = useCallback((service) => {
    setFormData((prev) => ({ ...prev, service }));
    setValidation({}); // Clear any validation errors
    // Auto-advance after a short delay
    setTimeout(() => {
      setCurrentStep(3);
    }, 300);
  }, []);

  const checkStepValidity = useCallback(
    (data) => {
      switch (currentStep) {
        case 1: {
          return data.shipmentType && data.shipmentType.id;
        }
        case 2: {
          return data.service && data.service.id;
        }
        case 3: {
          // Enhanced address validation
          const getAddressString = (address) => {
            if (typeof address === "string") return address;
            if (typeof address === "object" && address?.formatted_address)
              return address.formatted_address;
            if (typeof address === "object" && address?.address)
              return address.address;
            if (typeof address === "object" && address?.line_1)
              return `${address.line_1}, ${address.line_2 || ""}, ${
                address.line_3 || ""
              }`;
            return "";
          };

          const pickupStr = getAddressString(data.pickupAddress).toLowerCase();
          const dropoffStr = getAddressString(
            data.dropoffAddress
          ).toLowerCase();

          const hasPickup = data.pickupAddress && pickupStr.length > 0;
          const hasDropoff = data.dropoffAddress && dropoffStr.length > 0;

          if (!hasPickup || !hasDropoff) return false;

          // Check if addresses are in operating areas
          const isPickupValid =
            pickupStr.includes("milton keynes") || pickupStr.includes("oxford");
          const isDropoffValid =
            dropoffStr.includes("milton keynes") ||
            dropoffStr.includes("oxford");

          return isPickupValid && isDropoffValid;
        }
        case 4: {
          const hasWeight = data.weight && Number.parseFloat(data.weight) > 0;
          if (!hasWeight) return false;

          // Check weight limits for parcels
          if (
            data.shipmentType?.id === "parcels" &&
            Number.parseFloat(data.weight) > 31.5
          ) {
            return false;
          }

          // For parcels, check dimensions
          if (data.shipmentType?.id === "parcels") {
            const hasWidth = data.width && Number.parseFloat(data.width) > 0;
            const hasLength = data.length && Number.parseFloat(data.length) > 0;
            return hasWidth && hasLength;
          }

          return true;
        }
        case 5: {
          if (data.insurance) {
            const amount = Number.parseFloat(data.insuranceAmount);
            return amount >= 50 && amount <= 5000;
          }
          return true;
        }
        default: {
          return false;
        }
      }
    },
    [currentStep]
  );

  // Auto-focus first input when step changes
  useEffect(() => {
    if (firstInputRef.current) {
      setTimeout(() => firstInputRef.current?.focus(), 100);
    }
  }, [currentStep]);

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
      setManualPickupStreet("");
      setManualPickupCity("");
      setManualPickupPostcode("");
      setManualDropoffStreet("");
      setManualDropoffCity("");
      setManualDropoffPostcode("");
    }
  }, [isOpen]);

  const handleManualAddressSave = useCallback(
    (type, street, city, postcode) => {
      const fullAddress = `${street}, ${city}, ${postcode}`;
      const cityLower = city.toLowerCase();

      // Validate that the city is within operating areas
      if (
        !cityLower.includes("milton keynes") &&
        !cityLower.includes("oxford")
      ) {
        setValidation((prev) => ({
          ...prev,
          [type === "pickup" ? "pickupAddress" : "dropoffAddress"]:
            "Sorry, this location is not within our operating areas (Milton Keynes or Oxford)",
        }));
        return;
      }

      // Clear any previous validation errors
      setValidation((prev) => {
        const newValidation = { ...prev };
        delete newValidation[
          type === "pickup" ? "pickupAddress" : "dropoffAddress"
        ];
        return newValidation;
      });

      // Save the address
      setFormData((prev) => ({
        ...prev,
        [type === "pickup" ? "pickupAddress" : "dropoffAddress"]: {
          address: fullAddress,
          formatted_address: fullAddress,
          street,
          city,
          postcode,
        },
        [type === "pickup" ? "pickupPostcode" : "dropoffPostcode"]: "",
      }));
    },
    []
  );

  useEffect(() => {
    if (currentStep === 3) {
      // Run validation when addresses change
      const timer = setTimeout(() => {
        validateStep(3);
      }, 300); // Debounce validation

      return () => clearTimeout(timer);
    }
  }, [
    currentStep,
    formData.pickupAddress,
    formData.dropoffAddress,
    validateStep,
  ]);

  const calculateQuote = async () => {
    setIsLoadingQuote(true);

    try {
      // Calculate distance between addresses
      const distance = await apiConnection.calculateDistance(
        formData.pickupAddress,
        formData.dropoffAddress
      );

      // Prepare quote data for backend
      const quoteData = {
        shipmentType: formData.shipmentType.id,
        serviceTier: formData.service.id,
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
        surge: 1.0, // Default surge multiplier
        discount: 0.0, // Default discount
      };

      // Call backend API to compute quote
      const result = await apiConnection.createQuote(quoteData);

      if (result.success) {
        const backendQuote = result.data;
        setQuote({
          id: backendQuote.id,
          subtotal: backendQuote.base_price,
          insuranceFee: formData.insurance
            ? Number.parseFloat(formData.insuranceAmount) * 0.02
            : 0,
          fragileCharge: formData.fragile ? backendQuote.base_price * 0.25 : 0,
          total: backendQuote.final_price,
          distanceKm: distance,
          backendData: backendQuote, // Store full backend response
        });
      } else {
        throw new Error(result.message);
      }
    } catch (error) {
      console.error("Quote calculation failed:", error);
      // Fallback to frontend calculation
      const service = formData.service;
      const basePrice = service?.basePrice || 15;
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
        subtotal,
        insuranceFee: Math.round(insuranceFee * 100) / 100,
        fragileCharge: formData.fragile
          ? Math.round((subtotal / fragileMultiplier) * 0.25 * 100) / 100
          : 0,
        total,
        distanceKm: 15, // Default distance
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
    doc.text("Shipping Quote", pageWidth / 2, 20, { align: "center" });

    // Quote details
    doc.setFontSize(12);
    let yPos = 40;

    doc.text(`Quote ID: ${quote.id || "N/A"}`, 20, yPos);
    yPos += 10;
    doc.text(`Date: ${dayjs().format("DD/MM/YYYY HH:mm")}`, 20, yPos);
    yPos += 20;

    // Shipment details
    doc.setFontSize(14);
    doc.text("Shipment Details:", 20, yPos);
    yPos += 10;

    doc.setFontSize(10);
    doc.text(`Type: ${formData.shipmentType?.title}`, 20, yPos);
    yPos += 8;
    doc.text(`Service: ${formData.service?.title}`, 20, yPos);
    yPos += 8;
    doc.text(`Weight: ${formData.weight} kg`, 20, yPos);
    yPos += 8;

    if (formData.width && formData.length) {
      doc.text(
        `Dimensions: ${formData.width} × ${formData.length}${
          formData.height ? ` × ${formData.height}` : ""
        } cm`,
        20,
        yPos
      );
      yPos += 8;
    }

    doc.text(`Fragile: ${formData.fragile ? "Yes" : "No"}`, 20, yPos);
    yPos += 8;
    doc.text(`Distance: ${quote.distanceKm} km`, 20, yPos);
    yPos += 15;

    // Addresses
    doc.text(
      `From: ${
        typeof formData.pickupAddress === "string"
          ? formData.pickupAddress
          : formData.pickupAddress?.formatted_address || "N/A"
      }`,
      20,
      yPos
    );
    yPos += 8;
    doc.text(
      `To: ${
        typeof formData.dropoffAddress === "string"
          ? formData.dropoffAddress
          : formData.dropoffAddress?.formatted_address || "N/A"
      }`,
      20,
      yPos
    );
    yPos += 20;

    // Pricing breakdown
    doc.setFontSize(14);
    doc.text("Pricing Breakdown:", 20, yPos);
    yPos += 10;

    doc.setFontSize(10);
    doc.text(`Base shipping cost: $${quote.subtotal}`, 20, yPos);
    yPos += 8;

    if (formData.insurance) {
      doc.text(`Insurance fee (2%): $${quote.insuranceFee}`, 20, yPos);
      yPos += 8;
    }

    if (formData.fragile) {
      doc.text(`Fragile handling (25%): $${quote.fragileCharge}`, 20, yPos);
      yPos += 8;
    }

    yPos += 5;
    doc.setFontSize(12);
    doc.text(`Total: $${quote.total}`, 20, yPos);

    // Footer
    doc.setFontSize(8);
    doc.text(
      "This quote is valid for 7 days from the date of issue.",
      pageWidth / 2,
      280,
      { align: "center" }
    );

    doc.save(`shipping-quote-${dayjs().format("YYYY-MM-DD")}.pdf`);
  };

  const handleSubmit = async () => {
    if (!validateStep(5)) return;

    await calculateQuote();

    // Wait for quote to be set
    setTimeout(() => {
      if (quote) {
        // Navigate to booking page with state
        navigate("/booking", {
          state: {
            formData: {
              ...formData,

              shipmentType: {
                id: formData.shipmentType.id,
                title: formData.shipmentType.title,
              }, // Only serializable fields
              service: {
                id: formData.service.id,
                title: formData.service.title,
              },

              // Transform addresses to consistent format
              pickupAddress:
                typeof formData.pickupAddress === "string"
                  ? {
                      formatted_address: formData.pickupAddress,
                      line1: formData.pickupAddress,
                    }
                  : formData.pickupAddress,
              dropoffAddress:
                typeof formData.dropoffAddress === "string"
                  ? {
                      formatted_address: formData.dropoffAddress,
                      line1: formData.dropoffAddress,
                    }
                  : formData.dropoffAddress,
            },
            quote: quote,
          },
        });
        onClose();
      }
    }, 100);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-gray-900 rounded-2xl max-w-4xl w-full max-h-[95vh] overflow-y-auto shadow-2xl">
        {/* Header */}
        <div className="flex justify-between items-center p-6 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
            Get Quote
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
          >
            <X size={24} />
          </button>
        </div>

        {/* Progress Indicator */}
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between mb-2">
            {stepTitles.map((title, index) => {
              const stepNum = index + 1;
              const isActive = currentStep === stepNum;
              const isCompleted = currentStep > stepNum;

              return (
                <div key={stepNum} className="flex items-center">
                  <div
                    className={`
                    w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold transition-all
                    ${
                      isCompleted
                        ? "bg-green-500 text-white"
                        : isActive
                        ? "bg-orange-500 text-white"
                        : "bg-gray-200 dark:bg-gray-700 text-gray-500 dark:text-gray-400"
                    }
                  `}
                  >
                    {isCompleted ? <Check size={16} /> : stepNum}
                  </div>
                  {index < stepTitles.length - 1 && (
                    <div
                      className={`
                      w-16 h-1 mx-2 transition-all
                      ${
                        currentStep > stepNum
                          ? "bg-green-500"
                          : "bg-gray-200 dark:bg-gray-700"
                      }
                    `}
                    />
                  )}
                </div>
              );
            })}
          </div>
          <div className="text-center">
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Step {currentStep} of 5: {stepTitles[currentStep - 1]}
            </p>
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

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {shipmentTypes.map((type) => {
                  const IconComponent = type.icon;
                  const isSelected = formData.shipmentType?.id === type.id;

                  return (
                    <button
                      key={type.id}
                      ref={type.id === "parcels" ? firstInputRef : null}
                      onClick={() => handleShipmentTypeSelect(type)}
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
                          {type.title}
                        </h4>
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                          {type.description}
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>

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
                    Selected: {formData.shipmentType?.title}
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

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {services.map((service) => {
                  const isSelected = formData.service?.id === service.id;

                  return (
                    <button
                      key={service.id}
                      ref={service.id === "standard" ? firstInputRef : null}
                      onClick={() => handleServiceSelect(service)}
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
                          {service.title}
                        </h4>
                        <span className="text-orange-500 font-bold">
                          {service.price}
                        </span>
                      </div>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        {service.description}
                      </p>
                    </button>
                  );
                })}
              </div>

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
                    Pickup and Drop-off Locations
                  </h3>
                  <p className="text-gray-600 dark:text-gray-400">
                    Enter postcode or full address for suggestions
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

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Pickup Location */}
                <div className="space-y-4">
                  <h4 className="font-semibold text-gray-900 dark:text-white flex items-center">
                    <MapPin size={20} className="mr-2 text-orange-500" />
                    Pickup Location
                  </h4>

                  {!formData.pickupAddress ? (
                    <div className="relative">
                      <div className="relative">
                        <input
                          ref={firstInputRef}
                          type="text"
                          value={formData.pickupPostcode}
                          onChange={(e) =>
                            handlePostcodeChange(e.target.value, "pickup")
                          }
                          placeholder="Enter postcode or address (e.g., MK9 1AA or 123 High Street)"
                          className="w-full pl-12 pr-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-colors"
                        />
                        <MapPin
                          size={20}
                          className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400"
                        />
                        {isLoadingAddresses && (
                          <div className="absolute right-4 top-1/2 transform -translate-y-1/2">
                            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-orange-500"></div>
                          </div>
                        )}
                      </div>

                      {/* Suggestions Dropdown */}
                      {addressSuggestions.pickup.length > 0 && (
                        <div className="absolute z-10 w-full mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                          {addressSuggestions.pickup.map((address, index) => (
                            <button
                              key={index}
                              onClick={() => {
                                setFormData((prev) => ({
                                  ...prev,
                                  pickupAddress: address,
                                  pickupPostcode: "",
                                }));
                                setAddressSuggestions((prev) => ({
                                  ...prev,
                                  pickup: [],
                                }));
                              }}
                              className="w-full text-left px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-700 border-b border-gray-100 dark:border-gray-700 last:border-b-0 transition-colors focus:outline-none focus:bg-gray-50 dark:focus:bg-gray-700"
                            >
                              <div className="text-sm font-medium text-gray-900 dark:text-white">
                                {address}
                              </div>
                              <div className="text-xs text-gray-500 dark:text-gray-400">
                                Click to select
                              </div>
                            </button>
                          ))}
                        </div>
                      )}

                      {/* No results message */}
                      {formData.pickupPostcode.length >= 3 &&
                        addressSuggestions.pickup.length === 0 &&
                        !isLoadingAddresses && (
                          <div className="absolute z-10 w-full mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg shadow-lg p-4">
                            <div className="text-center">
                              <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">
                                No results found
                              </p>
                              <button
                                onClick={() => {
                                  // Switch to manual entry mode
                                  setFormData((prev) => ({
                                    ...prev,
                                    pickupAddress: "manual_entry",
                                    pickupPostcode: "",
                                  }));
                                }}
                                className="text-orange-500 hover:text-orange-600 text-sm font-medium underline"
                              >
                                Can't find your address? Enter manually
                              </button>
                            </div>
                          </div>
                        )}
                    </div>
                  ) : formData.pickupAddress === "manual_entry" ? (
                    <div className="space-y-3 p-4 border border-gray-200 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-800">
                      <h5 className="font-medium text-gray-900 dark:text-white">
                        Enter address manually
                      </h5>
                      <input
                        type="text"
                        placeholder="Street address"
                        value={manualPickupStreet || ""}
                        onChange={(e) => setManualPickupStreet(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-orange-500"
                      />
                      <div className="grid grid-cols-2 gap-3">
                        <input
                          type="text"
                          placeholder="City (Milton Keynes or Oxford)"
                          value={manualPickupCity || ""}
                          onChange={(e) => setManualPickupCity(e.target.value)}
                          className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-orange-500"
                        />
                        <input
                          type="text"
                          placeholder="Postcode"
                          value={manualPickupPostcode || ""}
                          onChange={(e) =>
                            setManualPickupPostcode(e.target.value)
                          }
                          className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-orange-500"
                        />
                      </div>
                      <div className="flex space-x-2">
                        <button
                          onClick={() =>
                            handleManualAddressSave(
                              "pickup",
                              manualPickupStreet,
                              manualPickupCity,
                              manualPickupPostcode
                            )
                          }
                          disabled={
                            !manualPickupStreet ||
                            !manualPickupCity ||
                            !manualPickupPostcode
                          }
                          className="px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors text-sm"
                        >
                          Save Address
                        </button>
                        <button
                          onClick={() => {
                            setFormData((prev) => ({
                              ...prev,
                              pickupAddress: "",
                              pickupPostcode: "",
                            }));
                            setManualPickupStreet("");
                            setManualPickupCity("");
                            setManualPickupPostcode("");
                          }}
                          className="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors text-sm"
                        >
                          Back to Search
                        </button>
                      </div>
                    </div>
                  ) : (
                    // Selected address card
                    <div className="p-4 border border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-900/20 rounded-lg">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center mb-2">
                            <Check size={16} className="text-green-500 mr-2" />
                            <span className="text-sm font-medium text-green-700 dark:text-green-300">
                              Pickup Location Selected
                            </span>
                          </div>
                          <p className="text-gray-900 dark:text-white font-medium">
                            {formData.pickupAddress}
                          </p>
                        </div>
                        <button
                          onClick={() =>
                            setFormData((prev) => ({
                              ...prev,
                              pickupAddress: "",
                              pickupPostcode: "",
                            }))
                          }
                          className="ml-4 px-3 py-1 text-orange-500 hover:text-orange-600 border border-orange-500 rounded-lg hover:bg-orange-50 dark:hover:bg-orange-900/20 transition-colors text-sm font-medium"
                        >
                          Edit
                        </button>
                      </div>
                    </div>
                  )}

                  {validation.pickupAddress && (
                    <div className="flex items-center text-red-500 text-sm">
                      <AlertCircle size={16} className="mr-2" />
                      {validation.pickupAddress}
                    </div>
                  )}
                </div>

                {/* Drop-off Location */}
                <div className="space-y-4">
                  <h4 className="font-semibold text-gray-900 dark:text-white flex items-center">
                    <MapPin size={20} className="mr-2 text-orange-500" />
                    Drop-off Location
                  </h4>

                  {!formData.dropoffAddress ? (
                    <div className="relative">
                      <div className="relative">
                        <input
                          type="text"
                          value={formData.dropoffPostcode}
                          onChange={(e) =>
                            handlePostcodeChange(e.target.value, "dropoff")
                          }
                          placeholder="Enter postcode or address (e.g., OX1 1AA or 456 Main Road)"
                          className="w-full pl-12 pr-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-colors"
                        />
                        <MapPin
                          size={20}
                          className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400"
                        />
                        {isLoadingAddresses && (
                          <div className="absolute right-4 top-1/2 transform -translate-y-1/2">
                            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-orange-500"></div>
                          </div>
                        )}
                      </div>

                      {/* Suggestions Dropdown */}
                      {addressSuggestions.dropoff.length > 0 && (
                        <div className="absolute z-10 w-full mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                          {addressSuggestions.dropoff.map((address, index) => (
                            <button
                              key={index}
                              onClick={() => {
                                setFormData((prev) => ({
                                  ...prev,
                                  dropoffAddress: address,
                                  dropoffPostcode: "",
                                }));
                                setAddressSuggestions((prev) => ({
                                  ...prev,
                                  dropoff: [],
                                }));
                              }}
                              className="w-full text-left px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-700 border-b border-gray-100 dark:border-gray-700 last:border-b-0 transition-colors focus:outline-none focus:bg-gray-50 dark:focus:bg-gray-700"
                            >
                              <div className="text-sm font-medium text-gray-900 dark:text-white">
                                {address}
                              </div>
                              <div className="text-xs text-gray-500 dark:text-gray-400">
                                Click to select
                              </div>
                            </button>
                          ))}
                        </div>
                      )}

                      {/* No results message */}
                      {formData.dropoffPostcode.length >= 3 &&
                        addressSuggestions.dropoff.length === 0 &&
                        !isLoadingAddresses && (
                          <div className="absolute z-10 w-full mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg shadow-lg p-4">
                            <div className="text-center">
                              <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">
                                No results found
                              </p>
                              <button
                                onClick={() => {
                                  // Switch to manual entry mode
                                  setFormData((prev) => ({
                                    ...prev,
                                    dropoffAddress: "manual_entry",
                                    dropoffPostcode: "",
                                  }));
                                }}
                                className="text-orange-500 hover:text-orange-600 text-sm font-medium underline"
                              >
                                Can't find your address? Enter manually
                              </button>
                            </div>
                          </div>
                        )}
                    </div>
                  ) : formData.dropoffAddress === "manual_entry" ? (
                    <div className="space-y-3 p-4 border border-gray-200 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-800">
                      <h5 className="font-medium text-gray-900 dark:text-white">
                        Enter address manually
                      </h5>
                      <input
                        type="text"
                        placeholder="Street address"
                        value={manualDropoffStreet || ""}
                        onChange={(e) => setManualDropoffStreet(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-orange-500"
                      />
                      <div className="grid grid-cols-2 gap-3">
                        <input
                          type="text"
                          placeholder="City (Milton Keynes or Oxford)"
                          value={manualDropoffCity || ""}
                          onChange={(e) => setManualDropoffCity(e.target.value)}
                          className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-orange-500"
                        />
                        <input
                          type="text"
                          placeholder="Postcode"
                          value={manualDropoffPostcode || ""}
                          onChange={(e) =>
                            setManualDropoffPostcode(e.target.value)
                          }
                          className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-orange-500"
                        />
                      </div>
                      <div className="flex space-x-2">
                        <button
                          onClick={() =>
                            handleManualAddressSave(
                              "dropoff",
                              manualDropoffStreet,
                              manualDropoffCity,
                              manualDropoffPostcode
                            )
                          }
                          disabled={
                            !manualDropoffStreet ||
                            !manualDropoffCity ||
                            !manualDropoffPostcode
                          }
                          className="px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors text-sm"
                        >
                          Save Address
                        </button>
                        <button
                          onClick={() => {
                            setFormData((prev) => ({
                              ...prev,
                              dropoffAddress: "",
                              dropoffPostcode: "",
                            }));
                            setManualDropoffStreet("");
                            setManualDropoffCity("");
                            setManualDropoffPostcode("");
                          }}
                          className="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors text-sm"
                        >
                          Back to Search
                        </button>
                      </div>
                    </div>
                  ) : (
                    // Selected address card
                    <div className="p-4 border border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-900/20 rounded-lg">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center mb-2">
                            <Check size={16} className="text-green-500 mr-2" />
                            <span className="text-sm font-medium text-green-700 dark:text-green-300">
                              Drop-off Location Selected
                            </span>
                          </div>
                          <p className="text-gray-900 dark:text-white font-medium">
                            {formData.dropoffAddress}
                          </p>
                        </div>
                        <button
                          onClick={() =>
                            setFormData((prev) => ({
                              ...prev,
                              dropoffAddress: "",
                              dropoffPostcode: "",
                            }))
                          }
                          className="ml-4 px-3 py-1 text-orange-500 hover:text-orange-600 border border-orange-500 rounded-lg hover:bg-orange-50 dark:hover:bg-orange-900/20 transition-colors text-sm font-medium"
                        >
                          Edit
                        </button>
                      </div>
                    </div>
                  )}

                  {validation.dropoffAddress && (
                    <div className="flex items-center text-red-500 text-sm">
                      <AlertCircle size={16} className="mr-2" />
                      {validation.dropoffAddress}
                    </div>
                  )}
                </div>
              </div>

              <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                <p className="text-sm text-blue-800 dark:text-blue-200">
                  <strong>Note:</strong> We operate only in Milton Keynes and
                  Oxford areas. Enter at least 3 characters for address
                  suggestions.
                </p>
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
                    Provide accurate details for precise quote calculation
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
                      formData.shipmentType?.id === "parcels" ? "31.5" : "1000"
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

                {(formData.shipmentType?.id === "parcels" ||
                  formData.shipmentType?.id === "business") && (
                  <>
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
                          Extra handling for delicate items (may incur
                          additional fees)
                        </div>
                      </div>
                    </div>

                    <div className="space-y-4">
                      <h4 className="text-lg font-medium text-gray-900 dark:text-white">
                        Package Dimensions
                      </h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                            placeholder="Width in centimeters"
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
                            placeholder="Length in centimeters"
                            className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-colors"
                          />
                          {validation.length && (
                            <div className="flex items-center text-red-500 text-sm mt-2">
                              <AlertCircle size={16} className="mr-2" />
                              {validation.length}
                            </div>
                          )}
                        </div>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                          Height (cm) {formData.fragile ? "*" : ""}
                          {formData.fragile && (
                            <span className="text-orange-500 text-xs ml-1">
                              (Required for fragile items)
                            </span>
                          )}
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
                          placeholder="Height in centimeters"
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
                  </>
                )}

                <div className="bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                  <div className="flex items-start space-x-3">
                    <Package
                      size={20}
                      className="text-orange-500 mt-0.5 flex-shrink-0"
                    />
                    <div>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        <strong>Note:</strong> Accurate dimensions help
                        calculate precise quotes and ensure proper handling.
                      </p>
                      {formData.fragile && (
                        <div className="mt-3 p-3 bg-orange-100 dark:bg-orange-900/30 rounded-lg border border-orange-200 dark:border-orange-800">
                          <p className="text-sm text-orange-700 dark:text-orange-300">
                            <strong>Fragile Item Handling:</strong> Your package
                            will receive extra protection with specialized
                            packaging and careful handling. A 25% surcharge
                            applies for fragile items.
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {import.meta.env.NODE_ENV === "development" && (
                  <div className="text-xs text-gray-500 p-2 bg-gray-100 dark:bg-gray-800 rounded">
                    Debug: Step {currentStep}, Shipment Type:{" "}
                    {formData.shipmentType?.id || "none"}, Fragile:{" "}
                    {formData.fragile ? "yes" : "no"}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Step 5: Insurance & Quote */}
          {currentStep === 5 && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-2xl font-semibold text-gray-900 dark:text-white mb-2">
                    Insurance & Quote Summary
                  </h3>
                  <p className="text-gray-600 dark:text-gray-400">
                    Review your shipment details and add insurance if needed
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

              {/* Insurance Section */}
              <div className="bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6">
                <div className="flex items-center space-x-3 mb-4">
                  <input
                    ref={firstInputRef}
                    type="checkbox"
                    id="insurance"
                    checked={formData.insurance}
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
                    className="text-lg font-medium text-gray-900 dark:text-white flex items-center"
                  >
                    <Shield size={20} className="mr-2 text-orange-500" />
                    Add insurance to this shipment?
                  </label>
                </div>

                {formData.insurance && (
                  <div className="mt-4 animate-in slide-in-from-top duration-300">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Insurance Amount ($) *
                    </label>
                    <input
                      type="number"
                      min="50"
                      max="5000"
                      value={formData.insuranceAmount}
                      onChange={(e) =>
                        setFormData((prev) => ({
                          ...prev,
                          insuranceAmount: e.target.value,
                        }))
                      }
                      placeholder="Enter insurance amount (50-5000)"
                      className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-colors"
                    />
                    {validation.insuranceAmount && (
                      <div className="flex items-center text-red-500 text-sm mt-2">
                        <AlertCircle size={16} className="mr-2" />
                        {validation.insuranceAmount}
                      </div>
                    )}
                    <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">
                      Insurance covers loss or damage up to the selected amount.
                      Fee: 2% of insured value.
                    </p>
                  </div>
                )}
              </div>

              {/* Summary */}
              <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6">
                <h4 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                  Shipment Summary
                </h4>

                <div className="space-y-3 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">
                      Shipment Type:
                    </span>
                    <span className="font-medium text-gray-900 dark:text-white">
                      {formData.shipmentType?.title}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">
                      Service:
                    </span>
                    <span className="font-medium text-gray-900 dark:text-white">
                      {formData.service?.title}
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
                  {formData.shipmentType?.id === "parcels" && (
                    <>
                      <div className="flex justify-between">
                        <span className="text-gray-600 dark:text-gray-400">
                          Dimensions:
                        </span>
                        <span className="font-medium text-gray-900 dark:text-white">
                          {formData.width} × {formData.length} cm
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600 dark:text-gray-400">
                          Fragile:
                        </span>
                        <span className="font-medium text-gray-900 dark:text-white">
                          {formData.fragile ? "Yes" : "No"}
                        </span>
                      </div>
                    </>
                  )}
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
                </div>
              </div>

              {/* Quote Display */}
              {quote && (
                <div className="bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-lg p-6 animate-in slide-in-from-bottom duration-300">
                  <div className="flex items-center justify-between mb-4">
                    <h4 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center">
                      <Calculator size={20} className="mr-2 text-orange-500" />
                      Quote Breakdown
                    </h4>
                    <button
                      onClick={downloadQuotePDF}
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
                        ${quote.subtotal}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600 dark:text-gray-400">
                        Distance:
                      </span>
                      <span className="font-medium text-gray-900 dark:text-white">
                        {quote.distanceKm} km
                      </span>
                    </div>
                    {formData.insurance && (
                      <div className="flex justify-between">
                        <span className="text-gray-600 dark:text-gray-400">
                          Insurance fee (2%):
                        </span>
                        <span className="font-medium text-gray-900 dark:text-white">
                          ${quote.insuranceFee}
                        </span>
                      </div>
                    )}
                    {formData.fragile && (
                      <div className="flex justify-between">
                        <span className="text-gray-600 dark:text-gray-400">
                          Fragile handling (25%):
                        </span>
                        <span className="font-medium text-gray-900 dark:text-white">
                          ${quote.fragileCharge}
                        </span>
                      </div>
                    )}
                    <div className="border-t border-orange-200 dark:border-orange-800 pt-2 mt-2">
                      <div className="flex justify-between text-lg font-bold">
                        <span className="text-gray-900 dark:text-white">
                          Total Quote:
                        </span>
                        <span className="text-orange-500">${quote.total}</span>
                      </div>
                    </div>
                    {quote.fallback && (
                      <p className="text-xs text-orange-600 dark:text-orange-400 mt-2">
                        * Estimated pricing (backend calculation unavailable)
                      </p>
                    )}
                  </div>
                </div>
              )}

              {/* Loading state for quote calculation */}
              {isLoadingQuote && (
                <div className="bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6">
                  <div className="flex items-center justify-center">
                    <Loader2
                      size={20}
                      className="animate-spin mr-2 text-orange-500"
                    />
                    <span className="text-gray-600 dark:text-gray-400">
                      Calculating quote...
                    </span>
                  </div>
                </div>
              )}
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
                disabled={isLoadingQuote}
                className="flex items-center px-6 py-3 bg-orange-500 hover:bg-orange-600 disabled:bg-gray-400 disabled:cursor-not-allowed text-white font-bold rounded-lg transition-all transform hover:scale-105 disabled:transform-none focus:outline-none focus:ring-2 focus:ring-orange-500"
              >
                {isLoadingQuote ? (
                  <>
                    <Loader2 size={20} className="mr-2 animate-spin" />
                    Calculating...
                  </>
                ) : (
                  <>
                    <Calculator size={20} className="mr-2" />
                    Get Quote & Continue
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
