// UPDATED: Context for managing quick quote data across Hero and GetQuoteBook

import { createContext, useState, useCallback, useContext } from "react";

export const QuoteContext = createContext();

export function QuoteProvider({ children }) {
  const [quickQuoteData, setQuickQuoteData] = useState({
    pickupPostcode: "",
    dropoffPostcode: "",
  });

  const setQuickQuotePostcodes = useCallback((pickupPostcode, dropoffPostcode) => {
    setQuickQuoteData({
      pickupPostcode,
      dropoffPostcode,
    });
  }, []);

  const clearQuickQuoteData = useCallback(() => {
    setQuickQuoteData({
      pickupPostcode: "",
      dropoffPostcode: "",
    });
  }, []);

  return (
    <QuoteContext.Provider
      value={{
        quickQuoteData,
        setQuickQuotePostcodes,
        clearQuickQuoteData,
      }}
    >
      {children}
    </QuoteContext.Provider>
  );
}

export function useQuoteContext() {
  const context = useContext(QuoteContext);
  if (!context) {
    throw new Error("useQuoteContext must be used within a QuoteProvider");
  }
  return context;
}
