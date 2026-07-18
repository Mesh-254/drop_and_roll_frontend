"use client";

import BookingModal from "./BookingModal";
import { useNavigate, useLocation } from "react-router-dom";

export default function BookingPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const {
    formData,
    quote,
    // Present when the user came here via "Back" from the payment page —
    // BookingModal cancels the stale payment session and a fresh one is
    // created on the next "Proceed to Payment".
    existingBookingId,
    existingTransactionId,
    guestEmail,
  } = location.state || { formData: {}, quote: {} };

  // "Back" from the booking modal returns to the quote wizard WITH the full
  // draft (addresses, parcels, contact info, promo code, active quote) so the
  // wizard restores every step's values instead of starting blank.
  const handleBack = (draft) => {
    navigate("/quote", {
      state: {
        quoteWizardState: {
          formData: draft?.formData || formData || {},
          quote: draft?.quote || quote || null,
        },
      },
    });
  };

  return (
    <BookingModal
      isOpen={true}
      onClose={() => navigate("/")}
      onBack={handleBack}
      initialFormData={formData}
      quote={quote}
      existingBookingId={existingBookingId}
      existingTransactionId={existingTransactionId}
      resumeGuestEmail={guestEmail}
    />
  );
}
