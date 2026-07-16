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
    // lets BookingModal detect and reuse the still-pending transaction.
    existingBookingId,
    existingTransactionId,
    guestEmail,
  } = location.state || { formData: {}, quote: {} };

  const handleBack = () => {
    navigate("/quote"); // Back to quote page
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