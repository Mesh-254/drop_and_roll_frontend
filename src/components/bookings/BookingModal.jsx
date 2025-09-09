"use client";
import { useState, useCallback, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { bookingApi } from "../../api/BookingApi";
import { useAuth } from "../../contexts/AuthContext";
import dayjs from "dayjs";
import {
  X,
  Calendar,
  User,
  MapPin,
  Package,
  CreditCard,
  AlertCircle,
  Loader2,
} from "lucide-react";

const ContactInfo = ({ formData, onUpdate, validation, isAuthenticated }) => {
  if (isAuthenticated) {
    return null;
  }

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center">
        <User className="h-5 w-5 text-orange-500 mr-2" />
        Contact Information
      </h3>
      <p className="text-sm text-gray-600 dark:text-gray-400">
        We'll use your email to send you booking updates and confirmations.
      </p>

      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Email Address *
        </label>
        <input
          type="email"
          value={formData.guestEmail || ""}
          onChange={(e) => onUpdate({ guestEmail: e.target.value })}
          placeholder="Enter your email address"
          className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-colors"
        />
        {validation.guestEmail && (
          <div className="flex items-center text-red-500 text-sm mt-2">
            <AlertCircle size={16} className="mr-2" />
            {validation.guestEmail}
          </div>
        )}
      </div>
    </div>
  );
};

const generateTimeSlots = (serviceType) => {
  const slots = [];
  const now = dayjs();
  const startDate = now.add(1, "hour");

  for (let day = 0; day < 7; day++) {
    const date = startDate.add(day, "day");

    let startHour = 8;
    let endHour = 18;
    let interval = 2;

    if (serviceType?.name?.toLowerCase().includes("express")) {
      startHour = 8;
      endHour = 20;
      interval = 1;
    }

    for (let hour = startHour; hour < endHour; hour += interval) {
      const slotTime = date.hour(hour).minute(0).second(0);

      if (day === 0 && slotTime.isBefore(now)) {
        continue;
      }

      slots.push({
        value: slotTime.toISOString(),
        label: slotTime.format("ddd, MMM D - h:mm A"),
        date: slotTime.format("YYYY-MM-DD"),
        time: slotTime.format("HH:mm"),
      });
    }
  }

  return slots;
};

export default function BookingModal({
  isOpen,
  onClose,
  quote,
  initialFormData = {},
}) {
  const navigate = useNavigate();
  const location = useLocation();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(null);
  const [validation, setValidation] = useState({});

  const { isAuthenticated, user } = useAuth();

  const [formData, setFormData] = useState({
    scheduledPickupAt: "",
    scheduledDropoffAt: "",
    promoCode: "",
    notes: "",
    guestEmail: user?.email || "",
    pickupPostcode:
      location.state?.formData?.pickupPostcode ||
      initialFormData.pickupPostcode ||
      "SW1A 1AA",
    dropoffPostcode:
      location.state?.formData?.dropoffPostcode ||
      initialFormData.dropoffPostcode ||
      "OX1 4AJ",
    ...initialFormData,
  });

  useEffect(() => {
    if (location.state?.formData) {
      setFormData((prev) => ({
        ...prev,
        pickupPostcode: location.state.formData.pickupPostcode || "SW1A 1AA",
        dropoffPostcode: location.state.formData.dropoffPostcode || "OX1 4AJ",
        ...location.state.formData,
      }));
    }
  }, [location.state]);

  const [timeSlots] = useState(() => generateTimeSlots(quote?.service_type));

  const updateFormData = useCallback((updates) => {
    setFormData((prev) => ({ ...prev, ...updates }));
    setValidation((prev) => {
      const newValidation = { ...prev };
      Object.keys(updates).forEach((key) => {
        delete newValidation[key];
      });
      return newValidation;
    });
  }, []);

  const validateEmail = (email) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const validateForm = () => {
    const errors = {};

    if (!formData.scheduledPickupAt) {
      errors.scheduledPickupAt = "Please select a pickup time";
    }

    if (!isAuthenticated) {
      if (!formData.guestEmail?.trim()) {
        errors.guestEmail = "Email is required";
      } else if (!validateEmail(formData.guestEmail)) {
        errors.guestEmail = "Please enter a valid email address";
      }
    }

    return errors;
  };

  const handleSubmit = async () => {
    const errors = validateForm();
    if (Object.keys(errors).length > 0) {
      setValidation(errors);
      return;
    }

    setIsSubmitting(true);
    setSubmitError(null);

    try {
      const defaultAddress = {
        line1: "Default Street",
        city: "Default City",
        country: "GB",
        latitude: 123,
        longitude: 123,
      };

      const payload = {
        quoteId: quote.id,
        pickupAddress: initialFormData.pickupAddress || defaultAddress,
        dropoffAddress: initialFormData.dropoffAddress || defaultAddress,
        scheduledPickupAt: formData.scheduledPickupAt,
        scheduledDropoffAt: formData.scheduledDropoffAt || null,
        promoCode: formData.promoCode || null,
        notes: formData.notes || null,
      };

      if (!isAuthenticated && formData.guestEmail) {
        payload.guestEmail = formData.guestEmail.trim();
      }

      console.log("Booking payload:", payload);

      const result = await bookingApi.createBooking(payload);

      if (result.success) {
        const transaction = result.data;
        console.log("Transaction:", transaction);

        // Ensure transaction has an id
        if (!transaction.id) {
          throw new Error("Transaction ID is missing");
        }

        // Navigate to payment page for all bookings (even if amount is 0, to handle edge cases)
        navigate(`/pay/${transaction.id}`, {
          state: {
            transaction,
            quote,
            booking: transaction.booking,
            guestEmail: payload.guestEmail, // Pass guest_email to PaymentPage
          },
        });
      } else {
        throw new Error(result.message || "Failed to create booking");
      }
    } catch (error) {
      console.error("Booking error:", error);
      setSubmitError(
        error.message || "An error occurred while creating the booking"
      );
    } finally {
      setIsSubmitting(false);
    }
  };
  if (!isOpen || !quote) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-4xl max-h-[95vh] overflow-y-auto animate-in zoom-in-95 duration-300">
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700 bg-orange-500 text-white rounded-t-2xl">
          <div>
            <h2 className="text-2xl font-bold">Complete Your Booking</h2>
            <p className="text-orange-100 text-sm">
              Total: KSh{" "}
              {quote.final_price
                ? Number.parseFloat(quote.final_price).toFixed(2)
                : "0.00"}
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

        <div className="p-6 space-y-6">
          <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3 flex items-center">
              <Package className="h-5 w-5 text-orange-500 mr-2" />
              Booking Summary
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-gray-600 dark:text-gray-400">
                  Service:
                </span>
                <span className="ml-2 font-medium text-gray-900 dark:text-white">
                  {quote.service_type?.name}
                </span>
              </div>
              <div>
                <span className="text-gray-600 dark:text-gray-400">
                  Weight:
                </span>
                <span className="ml-2 font-medium text-gray-900 dark:text-white">
                  {quote.weight_kg}kg
                </span>
              </div>

              <div className="md:col-span-2">
                <div className="flex items-start space-x-2">
                  <MapPin className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                  <div>
                    <span className="text-gray-600 dark:text-gray-400">
                      From:
                    </span>
                    <span className="ml-2 font-medium text-gray-900 dark:text-white">
                      {initialFormData.pickupAddress?.line1},{" "}
                      {initialFormData.pickupAddress?.city}{" "}
                      {formData.pickupPostcode}
                    </span>
                  </div>
                </div>
              </div>
              <div className="md:col-span-2">
                <div className="flex items-start space-x-2">
                  <MapPin className="h-4 w-4 text-red-500 mt-0.5 flex-shrink-0" />
                  <div>
                    <span className="text-gray-600 dark:text-gray-400">
                      To:
                    </span>
                    <span className="ml-2 font-medium text-gray-900 dark:text-white">
                      {initialFormData.dropoffAddress?.line1},{" "}
                      {initialFormData.dropoffAddress?.city}{" "}
                      {formData.dropoffPostcode}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <ContactInfo
            formData={formData}
            onUpdate={updateFormData}
            validation={validation}
            isAuthenticated={isAuthenticated}
          />

          {/* ... existing scheduling and additional options code ... */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center">
              <Calendar className="h-5 w-5 text-orange-500 mr-2" />
              Schedule Pickup
            </h3>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Pickup Time *
              </label>
              <select
                value={formData.scheduledPickupAt}
                onChange={(e) =>
                  updateFormData({ scheduledPickupAt: e.target.value })
                }
                className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-colors"
              >
                <option value="">Select pickup time</option>
                {timeSlots.map((slot) => (
                  <option key={slot.value} value={slot.value}>
                    {slot.label}
                  </option>
                ))}
              </select>
              {validation.scheduledPickupAt && (
                <div className="flex items-center text-red-500 text-sm mt-2">
                  <AlertCircle size={16} className="mr-2" />
                  {validation.scheduledPickupAt}
                </div>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Dropoff Time (Optional)
              </label>
              <select
                value={formData.scheduledDropoffAt}
                onChange={(e) =>
                  updateFormData({ scheduledDropoffAt: e.target.value })
                }
                className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-colors"
              >
                <option value="">Select dropoff time (optional)</option>
                {timeSlots.map((slot) => (
                  <option key={slot.value} value={slot.value}>
                    {slot.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              Additional Options
            </h3>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Promo Code
              </label>
              <input
                type="text"
                value={formData.promoCode}
                onChange={(e) => updateFormData({ promoCode: e.target.value })}
                placeholder="Enter promo code (optional)"
                className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-colors"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Special Instructions
              </label>
              <textarea
                value={formData.notes}
                onChange={(e) => updateFormData({ notes: e.target.value })}
                placeholder="Any special instructions for pickup or delivery (optional)"
                rows={3}
                className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-colors resize-none"
              />
            </div>
          </div>

          {submitError && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
              <div className="flex items-center">
                <AlertCircle className="h-5 w-5 text-red-500 mr-2" />
                <span className="text-red-700 dark:text-red-300">
                  {submitError}
                </span>
              </div>
            </div>
          )}
        </div>

        <div className="flex justify-between items-center p-6 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 rounded-b-2xl">
          <div className="text-sm text-gray-600 dark:text-gray-400">
            Total:{" "}
            <span className="font-bold text-gray-900 dark:text-white">
              KSh{" "}
              {quote.final_price
                ? Number.parseFloat(quote.final_price).toFixed(2)
                : "0.00"}
            </span>
          </div>

          <div className="flex space-x-3">
            <button
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors focus:outline-none focus:ring-2 focus:ring-orange-500 disabled:opacity-50"
            >
              Cancel
            </button>

            <button
              onClick={handleSubmit}
              disabled={isSubmitting}
              className="flex items-center px-6 py-3 bg-orange-500 hover:bg-orange-600 disabled:bg-gray-400 disabled:cursor-not-allowed text-white font-bold rounded-lg transition-all transform hover:scale-105 disabled:transform-none focus:outline-none focus:ring-2 focus:ring-orange-500"
            >
              {isSubmitting ? (
                <>
                  <Loader2 size={20} className="mr-2 animate-spin" />
                  Creating Booking...
                </>
              ) : (
                <>
                  <CreditCard size={20} className="mr-2" />
                  Proceed to Payment
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
