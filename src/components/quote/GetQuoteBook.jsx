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
import PostcodeFirstAutocomplete from "../map/PostcodeFirstAutocomplete";
import ParcelCard from "./ParcelCard";
import { APIProvider } from "@vis.gl/react-google-maps";
import { useDebouncedValidation } from "../../hooks/useDebouncedValidation";
import {
  validateParcelFields,
  validateField,
  insuranceSchema,
  PARCEL_LIMITS,
} from "../../utils/parcelValidation";
import {
  isValidUkPhone,
  normalizeUkPhone,
  UK_PHONE_ERROR,
} from "../../utils/ukPhone";

const apiKey = import.meta.env.VITE_GOOGLE_MAPS_BROWSER_KEY;

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
        <Loader2 size={32} className="animate-spin text-brand-text" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <AlertCircle size={48} className="mx-auto text-destructive mb-4" />
        <p className="text-destructive">{error}</p>
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
                ? "border-primary bg-brand-surface"
                : "border-border hover:border-primary/30 dark:hover:border-primary"
            }
          `}
        >
          <div className="flex items-center mb-3">
            <Package className="h-8 w-8 text-brand-text mr-3" />
            <h3 className="text-lg font-semibold text-foreground">
              {type.name}
            </h3>
          </div>
          <p className="text-muted-foreground text-sm">
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
        <Loader2 size={32} className="animate-spin text-brand-text" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <AlertCircle size={48} className="mx-auto text-destructive mb-4" />
        <p className="text-destructive">{error}</p>
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
                ? "border-primary bg-brand-surface"
                : "border-border hover:border-primary/30 dark:hover:border-primary"
            }
          `}
        >
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center">
              <Truck className="h-8 w-8 text-brand-text mr-3" />
              <h3 className="text-lg font-semibold text-foreground">
                {service.name}
              </h3>
            </div>
            <span className="text-lg font-bold text-brand-text">
              £{service.price}
            </span>
          </div>
          <p className="text-muted-foreground text-sm">
            {service.description}
          </p>
        </button>
      ))}
    </div>
  );
};

export const QuoteDisplay = ({ quote, onDownloadPDF, isLoading, formData }) => {
  if (isLoading) {
    return (
      <div className="bg-muted dark:bg-surface rounded-xl p-6">
        <div className="flex items-center justify-center py-8">
          <Loader2 size={32} className="animate-spin text-brand-text mr-3" />
          <span className="text-muted-foreground">
            Calculating quote...
          </span>
        </div>
      </div>
    );
  }

  if (!quote) {
    return (
      <div className="bg-muted dark:bg-surface rounded-xl p-6">
        <div className="text-center py-8">
          <Calculator className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
          <p className="text-muted-foreground">
            Complete the form to see your quote
          </p>
        </div>
      </div>
    );
  }

  const breakdown = quote.meta || {};

  return (
    <div className="bg-gradient-to-br from-brand-surface to-brand-surface dark:from-brand-surface/20 dark:to-primary-hover/20 rounded-xl p-6 border border-primary/30">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center">
          <Calculator className="h-6 w-6 text-brand-text mr-3" />
          <h3 className="text-xl font-bold text-foreground">
            Quote Breakdown
          </h3>
        </div>
        <button
          onClick={onDownloadPDF}
          className="flex items-center px-4 py-2 bg-primary hover:bg-primary-hover text-primary-foreground rounded-lg transition-colors"
        >
          <Download size={16} className="mr-2" />
          Download PDF
        </button>
      </div>

      <div className="space-y-3">
        <div className="flex justify-between items-center py-2 border-b border-primary/30">
          <span className="text-muted-foreground">
            Base Price
          </span>
          <span className="font-medium text-foreground">
            £{breakdown.base_price?.toFixed(2) || "0.00"}
          </span>
        </div>

        {breakdown.extra_parcels > 0 && (
          <div className="flex justify-between items-center py-2 border-b border-primary/30">
            <span className="text-muted-foreground">
              Extra Parcels ({breakdown.extra_parcels} × £{breakdown.extra_parcel_charge_per?.toFixed(2)})
            </span>
            <span className="font-medium text-foreground">
              £{breakdown.extra_parcel_fee?.toFixed(2) || "0.00"}
            </span>
          </div>
        )}

        {breakdown.extra_distance_miles > 0 && (
          <div className="flex justify-between items-center py-2 border-b border-primary/30">
            <span className="text-muted-foreground">
              Distance Charge ({breakdown.extra_distance_miles?.toFixed(1)} miles beyond {breakdown.free_miles?.toFixed(0)} free)
            </span>
            <span className="font-medium text-foreground">
              £{breakdown.extra_distance_charge?.toFixed(2) || "0.00"}
            </span>
          </div>
        )}

        {breakdown.insurance_fee > 0 && (
          <div className="flex justify-between items-center py-2 border-b border-primary/30">
            <span className="text-muted-foreground">
              Insurance Fee
            </span>
            <span className="font-medium text-foreground">
              £{breakdown.insurance_fee?.toFixed(2) || "0.00"}
            </span>
          </div>
        )}

        <div className="flex justify-between items-center py-3 bg-brand-surface rounded-lg px-4 mt-4">
          <span className="text-lg font-bold text-foreground">
            Total Price
          </span>
          <span className="text-2xl font-bold text-brand-text">
            £{breakdown.final_price?.toFixed(2) || "0.00"}
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
  // Draft restore (spec §B4): set when the user pressed "Back" on the
  // booking modal. { formData, quote } — the wizard re-opens on the review
  // step with every field (addresses, parcels, insurance, contact info)
  // exactly as they left it.
  initialState = null,
}) {
  const navigate = useNavigate();
  const { isAuthenticated, user } = useAuth();
  // A full draft (has shipmentType + parcels) re-opens on the review step;
  // a partial one (e.g. routed back from the payment page, which carries no
  // parcel detail) restarts at step 1 with whatever fields it has.
  const [currentStep, setCurrentStep] = useState(
    initialState?.formData?.shipmentType && initialState?.formData?.parcels ? 5 : 1,
  );

  const [shipmentTypes, setShipmentTypes] = useState([]);
  const [services, setServices] = useState([]);
  const [isLoadingTypes, setIsLoadingTypes] = useState(false);
  const [isLoadingServices, setIsLoadingServices] = useState(false);
  const [typesError, setTypesError] = useState(null);
  const [servicesError, setServicesError] = useState(null);
  const [quoteId, setQuoteId] = useState(null);
  const [lastQuoteData, setLastQuoteData] = useState(null);
  // The last payload that FAILED. Without this, only successes were memoized,
  // so a failing payload was re-sent on every re-render with no backoff.
  const [lastFailedQuoteData, setLastFailedQuoteData] = useState(null);

  const [pickupPostcode, setPickupPostcode] = useState(
    initialState?.formData?.pickupAddress?.postal_code || initialPickupPostcode || "",
  );
  const [dropoffPostcode, setDropoffPostcode] = useState(
    initialState?.formData?.dropoffAddress?.postal_code || initialDropoffPostcode || "",
  );

  // UPDATED: Multi-parcel formData structure. When a draft restore is
  // present (Back from the booking modal), its fields merge over the
  // defaults so a partial restore (e.g. from the payment page, which has no
  // parcel detail) still yields a fully-formed state object.
  const [formData, setFormData] = useState(() => ({
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
    ...(initialState?.formData || {}),
  }));

  const [validation, setValidation] = useState({});
  const [quote, setQuote] = useState(initialState?.quote || null);
  const [isLoadingQuote, setIsLoadingQuote] = useState(false);

  const firstInputRef = useRef(null);

  // Calculate total weight from all parcels
  const totalWeight = useMemo(() => {
    return formData.parcels.reduce((sum, parcel) => {
      const weight = Number.parseFloat(parcel.weightKg) || 0;
      return sum + weight;
    }, 0);
  }, [formData.parcels]);

  // Debounced (300ms) insurance amount validity. No toast-on-type: the error is
  // surfaced inline only after the field is blurred or on submit, matching the
  // parcel fields — no annoying real-time errors while the person is typing.
  const [insuranceTouched, setInsuranceTouched] = useState(false);
  const insuranceLive = useDebouncedValidation(
    formData.insuranceAmount,
    (v) => validateField(insuranceSchema, v),
    {
      skip: !formData.insurance,
    },
  );
  const insuranceError = formData.insurance
    ? validation.insuranceAmount || (insuranceTouched ? insuranceLive.error : null)
    : null;
  const insuranceValid =
    formData.insurance &&
    !insuranceLive.error &&
    !validation.insuranceAmount &&
    formData.insuranceAmount !== "" &&
    !insuranceLive.isValidating;

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
    // Failures were not memoized, only successes — so a payload that failed was
    // re-sent on every re-render of the effect below, forever, with no backoff.
    // On 2026-08-03 that was one request per second against an endpoint that
    // could not succeed. Remembering the failing payload makes the retry
    // condition "the user changed something", which is the only change that can
    // plausibly fix a rejected quote.
    if (quoteDataString === lastFailedQuoteData) {
      return;
    }

    setIsLoadingQuote(true);
    try {
      const result = await bookingApi.createQuote(quoteData);
      if (result.success) {
        setQuote(result.data);
        setQuoteId(result.data.id);
        setLastQuoteData(quoteDataString);
        setLastFailedQuoteData(null);
        setValidation((prev) => ({ ...prev, quoteError: null }));
      } else {
        console.error("Quote calculation failed:", result.message);
        setLastFailedQuoteData(quoteDataString);
        setValidation((prev) => ({
          ...prev,
          quoteError: result.message || "Failed to calculate quote",
        }));
      }
    } catch (error) {
      console.error("Quote calculation error:", error);
      setLastFailedQuoteData(quoteDataString);
      setValidation((prev) => ({
        ...prev,
        quoteError: error.message || "Quote calculation error",
      }));
    } finally {
      setIsLoadingQuote(false);
    }
  }, [formData, lastQuoteData, lastFailedQuoteData]);

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
        // Validate all parcels (min AND max — mirrors backend ParcelValidator /
        // DimensionsValidator in bookings/serializers.py so nothing that would
        // be rejected server-side can slip past this step).
        const parcelErrors = {};
        data.parcels.forEach((parcel, idx) => {
          const pErrors = validateParcelFields(parcel);
          if (Object.keys(pErrors).length > 0) {
            parcelErrors[idx] = pErrors;
          }
        });
        if (Object.keys(parcelErrors).length > 0) {
          errors.parcels = parcelErrors;
        }
        // Insurance amount, only when the person has opted in.
        if (data.insurance) {
          const insuranceCheck = validateField(insuranceSchema, data.insuranceAmount);
          if (!insuranceCheck.valid) {
            errors.insuranceAmount = insuranceCheck.error;
          }
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
        } else if (!isValidUkPhone(data.receiverPhone)) {
          errors.receiverPhone = UK_PHONE_ERROR;
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
        const parcelsValid = data.parcels.every(
          (p) => Object.keys(validateParcelFields(p)).length === 0,
        );
        const insuranceValid =
          !data.insurance ||
          validateField(insuranceSchema, data.insuranceAmount).valid;
        return parcelsValid && insuranceValid;
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
            receiverPhone:
              normalizeUkPhone(formData.receiverPhone) || formData.receiverPhone,
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
      <div className="fixed inset-0 bg-overlay flex items-center justify-center z-50 p-4">
        <div className="bg-card rounded-2xl shadow-2xl w-full max-w-4xl max-h-[95vh] overflow-y-auto animate-in zoom-in-95 duration-300">
          <div className="flex items-center justify-between p-6 border-b border-border bg-primary text-primary-foreground rounded-t-2xl">
            <div>
              <h2 className="text-2xl font-bold">Get Quote & Book</h2>
              <p className="text-brand-text text-sm">
                Step {currentStep} of 5: {stepTitles[currentStep - 1]}
              </p>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-primary-hover rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-ring"
              aria-label="Close modal"
            >
              <X size={24} />
            </button>
          </div>

          <div className="px-6 py-4 bg-muted dark:bg-surface">
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
                          ? "bg-success text-foreground"
                          : isActive
                            ? "bg-primary text-foreground"
                            : "bg-surface-hover text-muted-foreground"
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
                          ? "text-brand-text"
                          : isCompleted
                            ? "text-success"
                            : "text-subtle-foreground dark:text-muted-foreground"
                      }
                    `}
                    >
                      {title}
                    </span>
                    {index < stepTitles.length - 1 && (
                      <div className="w-8 h-0.5 bg-surface-hover mx-4 hidden sm:block" />
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
                  <h3 className="text-2xl font-semibold text-foreground mb-2">
                    What are you shipping?
                  </h3>
                  <p className="text-muted-foreground">
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
                  <div className="flex items-center text-destructive text-sm">
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
                    <h3 className="text-2xl font-semibold text-foreground mb-2">
                      Choose Core Service Offering
                    </h3>
                    <p className="text-muted-foreground">
                      Selected: {formData.shipmentType?.name}
                    </p>
                  </div>
                  <button
                    onClick={prevStep}
                    className="flex items-center text-brand-text hover:text-brand-text text-sm font-medium px-4 py-2 border border-primary rounded-lg hover:bg-brand-surface transition-colors"
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
                  <div className="flex items-center text-destructive text-sm">
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
                    <h3 className="text-2xl font-semibold text-foreground mb-2">
                      Your Parcels
                    </h3>
                    <p className="text-muted-foreground">
                      Service: {formData.service?.name} • (Maximum 5 parcels per
                      booking)
                    </p>
                  </div>
                  <button
                    onClick={prevStep}
                    className="flex items-center text-brand-text hover:text-brand-text text-sm font-medium px-4 py-2 border border-primary rounded-lg hover:bg-brand-surface transition-colors"
                  >
                    <ChevronLeft size={16} className="mr-1" />
                    Change Service
                  </button>
                </div>

                {/* Total Weight Display */}
                <div className="bg-brand-surface border border-primary/30 rounded-lg p-4">
                  <p className="text-sm text-muted-foreground">
                    Total weight:{" "}
                    <span className="font-bold text-brand-text">
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
                    className="w-full py-3 px-4 rounded-lg border-2 border-dashed border-primary/30 text-brand-text hover:bg-brand-surface font-medium transition-colors flex items-center justify-center gap-2"
                  >
                    <Plus size={20} />
                    Add Another Parcel
                  </button>
                )}

                {/* Insurance Option */}
                <div className="space-y-4 mt-6 pt-6 border-t border-border">
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
                      className="w-5 h-5 text-brand-text border-border-strong rounded focus:ring-ring focus:ring-2"
                    />
                    <label
                      htmlFor="insurance"
                      className="text-sm font-medium text-muted-foreground"
                    >
                      Add insurance coverage for all parcels
                    </label>
                  </div>

                  {formData.insurance && (
                    <div>
                      <label
                        htmlFor="insuranceAmount"
                        className="block text-sm font-medium text-muted-foreground mb-2"
                      >
                        Total Insurance Amount (£)
                      </label>
                      <div className="relative">
                        <input
                          id="insuranceAmount"
                          type="number"
                          min={PARCEL_LIMITS.INSURANCE_MIN_GBP}
                          max={PARCEL_LIMITS.INSURANCE_MAX_GBP}
                          step="0.01"
                          value={formData.insuranceAmount || ""}
                          onChange={(e) =>
                            setFormData((prev) => ({
                              ...prev,
                              insuranceAmount: e.target.value,
                            }))
                          }
                          onBlur={() => setInsuranceTouched(true)}
                          placeholder="Enter insurance value"
                          aria-invalid={!!insuranceError}
                          aria-describedby={insuranceError ? "insuranceAmount-error" : undefined}
                          className={`w-full px-4 py-3 pr-10 border-2 rounded-lg bg-card dark:bg-surface text-foreground placeholder-subtle-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent transition-colors ${
                            insuranceError
                              ? "border-destructive"
                              : insuranceValid
                                ? "border-success"
                                : "border-border-strong"
                          }`}
                        />
                        {insuranceValid && (
                          <Check
                            size={18}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-success"
                            aria-hidden="true"
                          />
                        )}
                      </div>
                      {insuranceError && (
                        <div
                          id="insuranceAmount-error"
                          role="alert"
                          className="flex items-center text-destructive text-sm mt-2"
                        >
                          <AlertCircle size={16} className="mr-2 shrink-0" />
                          {insuranceError}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}

            {currentStep === 4 && (
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-2xl font-semibold text-foreground mb-2">
                      Pickup & Dropoff Locations
                    </h3>
                    <p className="text-muted-foreground">
                      Total Weight: {totalWeight.toFixed(1)}kg •{" "}
                      {formData.parcels.length} parcel
                      {formData.parcels.length !== 1 ? "s" : ""}
                    </p>
                  </div>
                  <button
                    onClick={prevStep}
                    className="flex items-center text-brand-text hover:text-brand-text text-sm font-medium px-4 py-2 border border-primary rounded-lg hover:bg-brand-surface transition-colors"
                  >
                    <ChevronLeft size={16} className="mr-1" />
                    Change Details
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <PostcodeFirstAutocomplete
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

                  <PostcodeFirstAutocomplete
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
                  <div className="bg-success-surface border border-success/30 rounded-lg p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <div className="flex items-center justify-center w-6 h-6 bg-success rounded-full">
                          <Check className="h-4 w-4 text-foreground" />
                        </div>
                        <div>
                          <p className="text-sm font-medium text-success">
                            Pickup Location Selected
                          </p>
                          <p className="text-sm text-success mt-1">
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
                        className="text-sm text-success hover:text-success font-medium"
                      >
                        Edit
                      </button>
                    </div>
                  </div>
                )}

                {formData.dropoffAddress && (
                  <div className="bg-success-surface border border-success/30 rounded-lg p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <div className="flex items-center justify-center w-6 h-6 bg-success rounded-full">
                          <Check className="h-4 w-4 text-foreground" />
                        </div>
                        <div>
                          <p className="text-sm font-medium text-success">
                            Dropoff Location Selected
                          </p>
                          <p className="text-sm text-success mt-1">
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
                        className="text-sm text-success hover:text-success font-medium"
                      >
                        Edit
                      </button>
                    </div>
                  </div>
                )}

                {formData.pickupAddress && formData.dropoffAddress && (
                  <div className="mt-6">
                    <div className="flex items-center justify-between mb-4">
                      <h4 className="text-lg font-medium text-foreground">
                        Route Preview
                      </h4>
                      {formData.distanceKm > 0 && (
                        <span className="text-sm font-medium text-brand-text">
                          Distance: {formData.distanceKm}km
                        </span>
                      )}
                    </div>

                    {/* <MapComponent
                      pickupAddress={formData.pickupAddress}
                      dropoffAddress={formData.dropoffAddress}
                      className="w-full h-64 rounded-lg border border-border-strong"
                    /> */}
                  </div>
                )}
              </div>
            )}

            {currentStep === 5 && (
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-2xl font-semibold text-foreground mb-2">
                      Insurance & Quote
                    </h3>
                    <p className="text-muted-foreground">
                      Review your quote and provide contact details
                    </p>
                  </div>
                  <button
                    onClick={prevStep}
                    className="flex items-center text-brand-text hover:text-brand-text text-sm font-medium px-4 py-2 border border-primary rounded-lg hover:bg-brand-surface transition-colors"
                  >
                    <ChevronLeft size={16} className="mr-1" />
                    Change Locations
                  </button>
                </div>

                {validation.quoteError && (
                  <div className="bg-destructive-surface border border-destructive/30 rounded-lg p-4">
                    <div className="flex items-center text-destructive">
                      <AlertCircle size={16} className="mr-2" />
                      <span>{validation.quoteError}</span>
                    </div>
                  </div>
                )}

                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-foreground flex items-center">
                    <User className="h-5 w-5 text-brand-text mr-2" />
                    Receiver Contact Information
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    Provide contact details for the person receiving the parcel
                  </p>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-muted-foreground mb-2">
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
                        className="w-full px-4 py-3 border border-border-strong rounded-lg bg-card dark:bg-surface text-foreground placeholder-subtle-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent transition-colors"
                      />
                      {validation.receiverEmail && (
                        <div className="flex items-center text-destructive text-sm mt-2">
                          <AlertCircle size={16} className="mr-2" />
                          {validation.receiverEmail}
                        </div>
                      )}
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-muted-foreground mb-2">
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
                        placeholder="e.g., 07123 456789"
                        className="w-full px-4 py-3 border border-border-strong rounded-lg bg-card dark:bg-surface text-foreground placeholder-subtle-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent transition-colors"
                      />
                      {validation.receiverPhone && (
                        <div className="flex items-center text-destructive text-sm mt-2">
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

          <div className="flex justify-between items-center p-6 border-t border-border bg-muted dark:bg-surface rounded-b-2xl">
            <div className="flex space-x-3">
              {currentStep > 1 && (
                <button
                  onClick={prevStep}
                  className="flex items-center px-4 py-2 text-muted-foreground hover:text-foreground border border-border-strong rounded-lg hover:bg-muted dark:hover:bg-surface-hover transition-colors focus:outline-none focus:ring-2 focus:ring-ring"
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
                  className="flex items-center px-6 py-3 bg-primary hover:bg-primary-hover disabled:bg-surface-hover disabled:cursor-not-allowed text-primary-foreground font-medium rounded-lg transition-all transform hover:scale-105 disabled:transform-none focus:outline-none focus:ring-2 focus:ring-ring"
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
                  className="flex items-center px-6 py-3 bg-primary hover:bg-primary-hover disabled:bg-surface-hover disabled:cursor-not-allowed text-primary-foreground font-bold rounded-lg transition-all transform hover:scale-105 disabled:transform-none focus:outline-none focus:ring-2 focus:ring-ring"
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