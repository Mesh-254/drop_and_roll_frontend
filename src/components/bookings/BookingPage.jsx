"use client";

import BookingModal from "./BookingModal";
import { useNavigate, useLocation } from "react-router-dom";

export default function BookingPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { formData, quote } = location.state || { formData: {}, quote: {} };

  const handleBack = () => {
    navigate("/quote"); // Back to quote page
  };

  return (
    <BookingModal
      isOpen={true}
      onClose={() => navigate("/")}
      onBack={handleBack}
      formData={formData}
      quote={quote}
    />
  );
}
