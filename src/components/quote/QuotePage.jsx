"use client";

import GetQuoteModal from "./GetQuoteBook";
import { useNavigate, useLocation } from "react-router-dom";

export default function QuotePage() {
  const navigate = useNavigate();
  const location = useLocation();
  // Set when the user pressed "Back" on the booking modal — restores the
  // wizard (addresses, parcels, insurance, contact info) exactly where they
  // left it instead of starting from a blank step 1.
  const restore = location.state?.quoteWizardState || null;

  return (
    <GetQuoteModal
      isOpen={true}
      onClose={() => navigate("/")}
      initialState={restore}
    />
  );
}
