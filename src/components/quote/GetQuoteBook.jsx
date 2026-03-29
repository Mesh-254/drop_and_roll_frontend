// UPDATED: Multi-parcel support - Step 3 completely rewritten
"use client";
import { useNavigate } from "react-router-dom";
import { bookingApi } from "../../api/BookingApi";
import jsPDF from "jspdf";
import dayjs from "dayjs";
import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useAuth } from "../../contexts/AuthContext";
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
  User,
  Mail,
  Phone,
  Plus,
} from "lucide-react";
import MapComponent from "../map/MapComponent";
import AddressAutocomplete from "../map/AddressAutocomplete";
import ParcelCard from "./ParcelCard";
import { APIProvider } from "@vis.gl/react-google-maps";

const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;

const libraries = ["places", "maps", "geometry", "routes"];

const stepTitles = [
  "Shipment Type",
  "Service Offering",
  "Parcel Details",
  "Locations",
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
            Weight Charge ({formData.weightKg}kg × £0.50)
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
            £
            {quote.final_price
              ? Number.parseFloat(quote.final_price).toFixed(2)
              : "0.00"}
          </span>
        </div>
      </div>
    </div>
  );
};

export default function GetQuoteModal({
  isOpen,
  onClose,
  initialPickupPostcode,
  initialDropoffPostcode,
}) {
  const navigate = useNavigate();
  const { isAuthenticated, user } = useAuth();
  const [currentStep, setCurrentStep] = useState(1);

  const [shipmentTypes, setShipmentTypes] = useState([]);
  const [services, setServices] = useState([]);
  const [isLoadingTypes, setIsLoadingTypes] = useState(false);
  const [isLoadingServices, setIsLoadingServices] = useState(false);
  const [typesError, setTypesError] = useState(null);
  const [servicesError, setServicesError] = useState(null);
  const [quoteId, setQuoteId] = useState(null);
  const [lastQuoteData, setLastQuoteData] = useState(null);

  const [pickupPostcode, setPickupPostcode] = useState(
    initialPickupPostcode || "",
  );
  const [dropoffPostcode, setDropoffPostcode] = useState(
    initialDropoffPostcode || "",
  );

  // UPDATED: Multi-parcel formData structure
  const [formData, setFormData] = useState({
    shipmentType: null,
    service: null,
    parcels: [
      {
        id: 1,
        weightKg: "",
        dimensions: { length: "", width: "", height: "" },
        fragile: false,
      },
    ],
    pickupAddress: null,
    dropoffAddress: null,
    insurance: false,
    insuranceAmount: "",
    distanceKm: 0,
    receiverEmail: isAuthenticated ? user?.email || "" : "",
    receiverPhone: isAuthenticated ? user?.phone || "" : "",
  });

  const [validation, setValidation] = useState({});
  const [quote, setQuote] = useState(null);
  const [isLoadingQuote, setIsLoadingQuote] = useState(false);

  const firstInputRef = useRef(null);

  // Calculate total weight from all parcels
  const totalWeight = useMemo(() => {
    return formData.parcels.reduce((sum, parcel) => {
      const weight = Number.parseFloat(parcel.weightKg) || 0;
      return sum + weight;
    }, 0);
  }, [formData.parcels]);

  // Load shipping types and services on mount
  useEffect(() => {
    if (isOpen) {
      loadShipmentTypes();
      loadServices();
    }
  }, [isOpen]);

  // // Auto-fill from hero (runs once when modal opens)
  useEffect(() => {
    if (initialPickupPostcode && currentStep === 4) {
      setPickupPostcode(initialPickupPostcode);
    }
    if (initialDropoffPostcode && currentStep === 4) {
      setDropoffPostcode(initialDropoffPostcode);
    }
  }, [currentStep, initialPickupPostcode, initialDropoffPostcode]);

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

  // Calculate distance when addresses change
  useEffect(() => {
    const calculateAndSetDistance = async () => {
      if (formData.pickupAddress && formData.dropoffAddress) {
        try {
          const dist = await bookingApi.calculateDistance(
            formData.pickupAddress,
            formData.dropoffAddress,
          );
          setFormData((prev) => ({ ...prev, distanceKm: dist }));
          setValidation((prev) => ({ ...prev, distance: null }));
        } catch (error) {
          console.error("Failed to calculate distance:", error);
          setValidation((prev) => ({
            ...prev,
            distance: "Invalid coordinates for distance calculation",
          }));
          setFormData((prev) => ({ ...prev, distanceKm: 0 }));
        }
      } else {
        setFormData((prev) => ({ ...prev, distanceKm: 0 }));
        setValidation((prev) => ({ ...prev, distance: null }));
      }
    };

    calculateAndSetDistance();
  }, [formData.pickupAddress, formData.dropoffAddress]);

  const calculateQuote = useCallback(async () => {
    if (
      !formData.shipmentType ||
      !formData.service ||
      !formData.pickupAddress ||
      !formData.dropoffAddress ||
      formData.parcels.length === 0
    ) {
      setValidation((prev) => ({
        ...prev,
        quoteError: "Missing required fields for quote calculation",
      }));
      return;
    }

    // ─── Build proper multi-parcel payload for backend ─────────────────────
    const parcelsPayload = formData.parcels.map((p) => ({
      weightKg: Number.parseFloat(p.weightKg) || 0,
      dimensions: {
        length: Number.parseFloat(p.dimensions.length) || 0,
        width: Number.parseFloat(p.dimensions.width) || 0,
        height: Number.parseFloat(p.dimensions.height) || 0,
      },
      fragile: !!p.fragile,
    }));

    // Calculate average weight for quote (backend should handle per-parcel logic)
    const totalWeight = formData.parcels.reduce(
      (sum, p) => sum + (Number.parseFloat(p.weightKg) || 0),
      0,
    );
    const fragileCount = formData.parcels.filter((p) => p.fragile).length;

    const quoteData = {
      shipmentType: formData.shipmentType,
      service: formData.service,
      weightKg: totalWeight,
      distanceKm: formData.distanceKm,
      fragile: fragileCount > 0,
      insuranceAmount: Number.parseFloat(formData.insuranceAmount) || 0,
      parcels: parcelsPayload
    };

    const quoteDataString = JSON.stringify(quoteData);
    if (quoteDataString === lastQuoteData) {
      return;
    }

    setIsLoadingQuote(true);
    try {
      const result = await bookingApi.createQuote(quoteData);
      if (result.success) {
        setQuote(result.data);
        setQuoteId(result.data.id);
        setLastQuoteData(quoteDataString);
        setValidation((prev) => ({ ...prev, quoteError: null }));
      } else {
        console.error("Quote calculation failed:", result.message);
        setValidation((prev) => ({
          ...prev,
          quoteError: result.message || "Failed to calculate quote",
        }));
      }
    } catch (error) {
      console.error("Quote calculation error:", error);
      setValidation((prev) => ({
        ...prev,
        quoteError: error.message || "Quote calculation error",
      }));
    } finally {
      setIsLoadingQuote(false);
    }
  }, [formData, lastQuoteData]);

  useEffect(() => {
    if (currentStep === 5) {
      calculateQuote();
    }
  }, [currentStep, formData, calculateQuote]);

  const handleShipmentTypeSelect = (type) => {
    setFormData((prev) => ({ ...prev, shipmentType: type }));
    setValidation((prev) => ({ ...prev, shipmentType: null }));
  };

  const handleServiceSelect = (service) => {
    setFormData((prev) => ({ ...prev, service }));
    setValidation((prev) => ({ ...prev, service: null }));
  };

  // UPDATED: Multi-parcel validation
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
        // Validate all parcels
        const parcelErrors = {};
        data.parcels.forEach((parcel, idx) => {
          const pErrors = {};
          if (!parcel.weightKg || Number.parseFloat(parcel.weightKg) <= 0) {
            pErrors.weightKg = "Enter valid weight";
          }
          if (
            !parcel.dimensions.length ||
            Number.parseFloat(parcel.dimensions.length) <= 0
          ) {
            pErrors.length = "Required";
          }
          if (
            !parcel.dimensions.width ||
            Number.parseFloat(parcel.dimensions.width) <= 0
          ) {
            pErrors.width = "Required";
          }
          if (
            !parcel.dimensions.height ||
            Number.parseFloat(parcel.dimensions.height) <= 0
          ) {
            pErrors.height = "Required";
          }
          if (Object.keys(pErrors).length > 0) {
            parcelErrors[idx] = pErrors;
          }
        });
        if (Object.keys(parcelErrors).length > 0) {
          errors.parcels = parcelErrors;
        }
        break;
      case 4:
        if (!data.pickupAddress) {
          errors.pickupAddress = "Please select a pickup address";
        }
        if (!data.dropoffAddress) {
          errors.dropoffAddress = "Please select a dropoff address";
        }
        break;
      case 5:
        if (!data.receiverEmail) {
          errors.receiverEmail = "Receiver email is required";
        } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.receiverEmail)) {
          errors.receiverEmail = "Please enter a valid email address";
        }
        if (!data.receiverPhone) {
          errors.receiverPhone = "Receiver phone is required";
        } else if (!/^[\+]?[\d\-\s]{10,15}$/.test(data.receiverPhone)) {
          errors.receiverPhone =
            "Please enter a valid phone number (digits, +, -, spaces only; e.g., +1234567890)";
        }
        if (validation.quoteError) {
          errors.quoteError = validation.quoteError;
        }
        break;
    }

    return errors;
  };

  const checkStepValidity = (data) => {
    switch (currentStep) {
      case 1:
        return data.shipmentType !== null;
      case 2:
        return data.service !== null;
      case 3:
        return data.parcels.every(
          (p) =>
            p.weightKg &&
            Number.parseFloat(p.weightKg) > 0 &&
            p.dimensions.width &&
            Number.parseFloat(p.dimensions.width) > 0 &&
            p.dimensions.length &&
            Number.parseFloat(p.dimensions.length) > 0 &&
            p.dimensions.height &&
            Number.parseFloat(p.dimensions.height) > 0,
        );
      case 4:
        return data.pickupAddress && data.dropoffAddress;
      case 5:
        const errors = validateStep(5, data);
        return quote !== null && Object.keys(errors).length === 0;
      default:
        return false;
    }
  };

  const handleReceiverInputChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    const errors = validateStep(5, { ...formData, [field]: value });
    setValidation((prev) => ({
      ...prev,
      receiverEmail: errors.receiverEmail || null,
      receiverPhone: errors.receiverPhone || null,
    }));
  };

  // UPDATED: Parcel management handlers
  const handleParcelUpdate = (index, updatedParcel) => {
    setFormData((prev) => {
      const newParcels = [...prev.parcels];
      newParcels[index] = updatedParcel;
      return { ...prev, parcels: newParcels };
    });
    setValidation((prev) => {
      const newValidation = { ...prev };
      if (newValidation.parcels && newValidation.parcels[index]) {
        delete newValidation.parcels[index];
      }
      return newValidation;
    });
  };

  const handleAddParcel = () => {
    if (formData.parcels.length < 5) {
      const newParcel = {
        id: Math.max(...formData.parcels.map((p) => p.id), 0) + 1,
        weightKg: "",
        dimensions: { length: "", width: "", height: "" },
        fragile: false,
      };
      setFormData((prev) => ({
        ...prev,
        parcels: [...prev.parcels, newParcel],
      }));
    }
  };

  const handleRemoveParcel = (index) => {
    if (formData.parcels.length > 1) {
      setFormData((prev) => ({
        ...prev,
        parcels: prev.parcels.filter((_, i) => i !== index),
      }));
    }
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
    const errors = validateStep(5, formData);
    if (Object.keys(errors).length > 0) {
      setValidation(errors);
      return;
    }
    if (quote) {
      navigate("/booking", {
        state: {
          quote,
          formData: {
            ...formData,
            weightKg: totalWeight, // For backward compatibility
            receiverEmail: formData.receiverEmail,
            receiverPhone: formData.receiverPhone,
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

    doc.setFontSize(20);
    doc.text("Delivery Quote", 20, 30);

    doc.setFontSize(12);
    let yPos = 50;

    doc.text(`Quote ID: ${quote.id}`, 20, yPos);
    yPos += 10;
    doc.text(`Date: ${dayjs().format("DD/MM/YYYY")}`, 20, yPos);
    yPos += 20;

    doc.text("Service Details:", 20, yPos);
    yPos += 10;
    doc.text(`Service Type: ${breakdown.service_type}`, 30, yPos);
    yPos += 8;
    doc.text(`Total Weight: ${totalWeight}kg`, 30, yPos);
    yPos += 8;
    doc.text(`Number of Parcels: ${formData.parcels.length}`, 30, yPos);
    yPos += 8;
    doc.text(
      `Pickup: ${formData.pickupAddress?.line1 || "N/A"}, ${
        formData.pickupAddress?.city || "N/A"
      }`,
      30,
      yPos,
    );
    yPos += 8;
    doc.text(
      `Dropoff: ${formData.dropoffAddress?.line1 || "N/A"}, ${
        formData.dropoffAddress?.city || "N/A"
      }`,
      30,
      yPos,
    );
    yPos += 8;
    doc.text(`Distance: ${quote.distance_km}km`, 30, yPos);
    yPos += 20;

    doc.text("Pricing Breakdown:", 20, yPos);
    yPos += 10;
    doc.text(`Base Price: £${breakdown.base_price?.toFixed(2)}`, 30, yPos);
    yPos += 8;
    doc.text(
      `Weight Charge: £${breakdown.weight_charge?.toFixed(2)}`,
      30,
      yPos,
    );
    yPos += 8;
    doc.text(
      `Distance Charge: £${breakdown.distance_charge?.toFixed(2)}`,
      30,
      yPos,
    );
    yPos += 8;
    doc.text(`Subtotal: £${breakdown.subtotal?.toFixed(2)}`, 30, yPos);
    yPos += 8;

    if (breakdown.fragile_charge > 0) {
      doc.text(
        `Fragile Surcharge: £${breakdown.fragile_charge?.toFixed(2)}`,
        30,
        yPos,
      );
      yPos += 8;
    }

    if (breakdown.insurance_fee > 0) {
      doc.text(
        `Insurance Fee: £${breakdown.insurance_fee?.toFixed(2)}`,
        30,
        yPos,
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
    <APIProvider apiKey={apiKey} libraries={libraries}>
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
        <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-4xl max-h-[95vh] overflow-y-auto animate-in zoom-in-95 duration-300">
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

          <div className="p-6">
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

            {/* UPDATED: Step 3 - Multi-parcel form */}
            {currentStep === 3 && (
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-2xl font-semibold text-gray-900 dark:text-white mb-2">
                      Your Parcels
                    </h3>
                    <p className="text-gray-600 dark:text-gray-400">
                      Service: {formData.service?.name} • (Maximum 5 parcels per
                      booking)
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

                {/* Total Weight Display */}
                <div className="bg-orange-50 dark:bg-orange-900/10 border border-orange-200 dark:border-orange-800 rounded-lg p-4">
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Total weight:{" "}
                    <span className="font-bold text-orange-600 dark:text-orange-400">
                      {totalWeight.toFixed(1)} kg
                    </span>
                  </p>
                </div>

                {/* Parcels List */}
                <div className="space-y-4">
                  {formData.parcels.map((parcel, index) => (
                    <ParcelCard
                      key={parcel.id}
                      parcel={parcel}
                      parcelIndex={index}
                      onUpdate={handleParcelUpdate}
                      onRemove={handleRemoveParcel}
                      validation={validation.parcels}
                      canRemove={formData.parcels.length > 1}
                      totalParcels={formData.parcels.length}
                    />
                  ))}
                </div>

                {/* Add Parcel Button */}
                {formData.parcels.length < 5 && (
                  <button
                    onClick={handleAddParcel}
                    className="w-full py-3 px-4 rounded-lg border-2 border-dashed border-orange-300 dark:border-orange-700 text-orange-500 dark:text-orange-400 hover:bg-orange-50 dark:hover:bg-orange-900/10 font-medium transition-colors flex items-center justify-center gap-2"
                  >
                    <Plus size={20} />
                    Add Another Parcel
                  </button>
                )}

                {/* Insurance Option */}
                <div className="space-y-4 mt-6 pt-6 border-t border-gray-200 dark:border-gray-700">
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
                      Add insurance coverage for all parcels
                    </label>
                  </div>

                  {formData.insurance && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Total Insurance Amount (£)
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
            )}

            {currentStep === 4 && (
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-2xl font-semibold text-gray-900 dark:text-white mb-2">
                      Pickup & Dropoff Locations
                    </h3>
                    <p className="text-gray-600 dark:text-gray-400">
                      Total Weight: {totalWeight.toFixed(1)}kg •{" "}
                      {formData.parcels.length} parcel
                      {formData.parcels.length !== 1 ? "s" : ""}
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

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <AddressAutocomplete
                    label="Pickup Address"
                    postcode={pickupPostcode}
                    onPostcodeChange={setPickupPostcode}
                    onSelect={(address) => {
                      setFormData((prev) => ({
                        ...prev,
                        pickupAddress: address,
                      }));
                      setValidation((prev) => ({
                        ...prev,
                        pickupAddress: null,
                      }));
                    }}
                    validation={validation.pickupAddress}
                    placeholder="Enter pickup address"
                  />

                  <AddressAutocomplete
                    label="Dropoff Address"
                    postcode={dropoffPostcode}
                    onPostcodeChange={setDropoffPostcode}
                    onSelect={(address) => {
                      setFormData((prev) => ({
                        ...prev,
                        dropoffAddress: address,
                      }));
                      setValidation((prev) => ({
                        ...prev,
                        dropoffAddress: null,
                      }));
                    }}
                    validation={validation.dropoffAddress}
                    placeholder="Enter dropoff address"
                  />
                </div>

                {formData.pickupAddress && (
                  <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <div className="flex items-center justify-center w-6 h-6 bg-green-500 rounded-full">
                          <Check className="h-4 w-4 text-white" />
                        </div>
                        <div>
                          <p className="text-sm font-medium text-green-800 dark:text-green-200">
                            Pickup Location Selected
                          </p>
                          <p className="text-sm text-green-700 dark:text-green-300 mt-1">
                            {formData.pickupAddress.line1},{" "}
                            {formData.pickupAddress.city}{" "}
                            {formData.pickupAddress.postal_code}
                          </p>
                        </div>
                      </div>
                      <button
                        onClick={() => {
                          setFormData((prev) => ({
                            ...prev,
                            pickupAddress: null,
                          }));
                          setPickupPostcode("");
                        }}
                        className="text-sm text-green-600 hover:text-green-800 font-medium"
                      >
                        Edit
                      </button>
                    </div>
                  </div>
                )}

                {formData.dropoffAddress && (
                  <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <div className="flex items-center justify-center w-6 h-6 bg-green-500 rounded-full">
                          <Check className="h-4 w-4 text-white" />
                        </div>
                        <div>
                          <p className="text-sm font-medium text-green-800 dark:text-green-200">
                            Dropoff Location Selected
                          </p>
                          <p className="text-sm text-green-700 dark:text-green-300 mt-1">
                            {formData.dropoffAddress.line1},{" "}
                            {formData.dropoffAddress.city}{" "}
                            {formData.dropoffAddress.postal_code}
                          </p>
                        </div>
                      </div>
                      <button
                        onClick={() => {
                          setFormData((prev) => ({
                            ...prev,
                            dropoffAddress: null,
                          }));
                          setDropoffPostcode("");
                        }}
                        className="text-sm text-green-600 hover:text-green-800 font-medium"
                      >
                        Edit
                      </button>
                    </div>
                  </div>
                )}

                {formData.pickupAddress && formData.dropoffAddress && (
                  <div className="mt-6">
                    <div className="flex items-center justify-between mb-4">
                      <h4 className="text-lg font-medium text-gray-900 dark:text-white">
                        Route Preview
                      </h4>
                      {formData.distanceKm > 0 && (
                        <span className="text-sm font-medium text-orange-600 dark:text-orange-400">
                          Distance: {formData.distanceKm}km
                        </span>
                      )}
                    </div>

                    {/* <MapComponent
                      pickupAddress={formData.pickupAddress}
                      dropoffAddress={formData.dropoffAddress}
                      className="w-full h-64 rounded-lg border border-gray-300 dark:border-gray-600"
                    /> */}
                  </div>
                )}
              </div>
            )}

            {currentStep === 5 && (
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-2xl font-semibold text-gray-900 dark:text-white mb-2">
                      Insurance & Quote
                    </h3>
                    <p className="text-gray-600 dark:text-gray-400">
                      Review your quote and provide contact details
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

                {validation.quoteError && (
                  <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
                    <div className="flex items-center text-red-600 dark:text-red-400">
                      <AlertCircle size={16} className="mr-2" />
                      <span>{validation.quoteError}</span>
                    </div>
                  </div>
                )}

                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center">
                    <User className="h-5 w-5 text-orange-500 mr-2" />
                    Receiver Contact Information
                  </h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Provide contact details for the person receiving the parcel
                  </p>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        <Mail className="h-4 w-4 inline mr-1" />
                        Receiver Email *
                      </label>
                      <input
                        ref={firstInputRef}
                        type="email"
                        value={formData.receiverEmail}
                        onChange={(e) =>
                          handleReceiverInputChange(
                            "receiverEmail",
                            e.target.value,
                          )
                        }
                        placeholder="Enter receiver's email address"
                        className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-colors"
                      />
                      {validation.receiverEmail && (
                        <div className="flex items-center text-red-500 text-sm mt-2">
                          <AlertCircle size={16} className="mr-2" />
                          {validation.receiverEmail}
                        </div>
                      )}
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        <Phone className="h-4 w-4 inline mr-1" />
                        Receiver Phone *
                      </label>
                      <input
                        type="tel"
                        value={formData.receiverPhone}
                        onChange={(e) =>
                          handleReceiverInputChange(
                            "receiverPhone",
                            e.target.value,
                          )
                        }
                        onKeyPress={(e) => {
                          const char = e.key;
                          if (!/[\d\+\-\s]/.test(char) && char.length === 1) {
                            e.preventDefault();
                          }
                        }}
                        placeholder="e.g., +1234567890"
                        className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-colors"
                      />
                      {validation.receiverPhone && (
                        <div className="flex items-center text-red-500 text-sm mt-2">
                          <AlertCircle size={16} className="mr-2" />
                          {validation.receiverPhone}
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <QuoteDisplay
                  quote={quote}
                  onDownloadPDF={downloadQuotePDF}
                  isLoading={isLoadingQuote}
                  formData={{ ...formData, weightKg: totalWeight }}
                />
              </div>
            )}
          </div>

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
                  disabled={
                    isLoadingQuote || !quote || !checkStepValidity(formData)
                  }
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
    </APIProvider>
  );
}
