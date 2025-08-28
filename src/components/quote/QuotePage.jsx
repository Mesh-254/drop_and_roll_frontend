"use client";

import GetQuoteModal from "./GetQuoteBook";
import { useNavigate } from "react-router-dom";

export default function QuotePage() {
  const navigate = useNavigate();
  return <GetQuoteModal isOpen={true} onClose={() => navigate("/")} />;
}
