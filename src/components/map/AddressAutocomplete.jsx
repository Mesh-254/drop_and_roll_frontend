"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { AlertCircle, Loader2, MapPin, Search, X } from "lucide-react";
import { toast } from "react-hot-toast";
import { bookingApi } from "../../api/BookingApi";

const SERVICE_AREAS = {
  MILTON_KEYNES: "MK",
  OXFORD: "OX",
};

const BOUNDS = {
  southWest: { lat: 51.65, lng: -1.35 },
  northEast: { lat: 52.1, lng: -0.65 },
};

const UK_POSTCODE_REGEX = /^[A-Z]{1,2}\d[A-Z\d]?\s?\d[A-Z]{2}$/i;

const AddressAutocomplete = ({
  label,
  onSelect,
  postcode = "", // ← NEW: controlled value
  onPostcodeChange,
  validation,
  placeholder = "Enter postcode (e.g. MK10 1AA)",
}) => {
  const [inputValue, setInputValue] = useState(postcode); // ← NEW: initialize with prop
  const [suggestions, setSuggestions] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedAddress, setSelectedAddress] = useState(null);
  const [showSuggestions, setShowSuggestions] = useState(false);

  const debounceTimer = useRef(null);
  const wrapperRef = useRef(null);


  // Sync external postcode prop (from hero or parent state)
  useEffect(() => {
    setInputValue(postcode);
  }, [postcode]);

  // Auto-verify + lookup when a postcode is pre-filled from hero
  useEffect(() => {
    if (postcode && UK_POSTCODE_REGEX.test(postcode) && !selectedAddress) {
      // Small delay so the input is rendered first
      const timer = setTimeout(() => {
        handleManualLookup();
      }, 150);
      return () => clearTimeout(timer);
    }
  }, [postcode, selectedAddress]);


  // Filter to ONLY MK and OX
  const filterToServiceArea = (results) => {
    return results.filter((sugg) => {
      const outcode = (sugg.outcode || sugg.postcode || "")
        .split(" ")[0]
        .toUpperCase();
      return (
        outcode.startsWith(SERVICE_AREAS.MILTON_KEYNES) ||
        outcode.startsWith(SERVICE_AREAS.OXFORD)
      );
    });
  };

  
  // Debounced search
  const searchPostcodes = useCallback(async (query) => {
    if (debounceTimer.current) clearTimeout(debounceTimer.current);

    debounceTimer.current = setTimeout(async () => {
      const trimmed = query.trim().toUpperCase();
      if (trimmed.length < 2) {
        setSuggestions([]);
        return;
      }

      setIsLoading(true);
      const result = await bookingApi.searchPostcodes(trimmed);
      setIsLoading(false);

      if (result.success && result.data) {
        const filtered = filterToServiceArea(result.data);
        const sorted = [...filtered].sort((a, b) =>
          a.postcode.localeCompare(b.postcode),
        );
        setSuggestions(sorted);
      } else {
        setSuggestions([]);
      }
    }, 250);
  }, []);

  const handleInputChange = (e) => {
    const value = e.target.value.toUpperCase();
    setInputValue(value);
    onPostcodeChange?.(value);           // ← update parent state
    setShowSuggestions(true);
    searchPostcodes(value);
  };

  // Safe mapping to Django Address model
  const mapToAddress = (postcodeData) => {
    const outcode = postcodeData.outcode || "";

    const isInServiceArea =
      outcode.startsWith(SERVICE_AREAS.MILTON_KEYNES) ||
      outcode.startsWith(SERVICE_AREAS.OXFORD);

    const lat = parseFloat(postcodeData.latitude);
    const lng = parseFloat(postcodeData.longitude);

    const withinBounds =
      lat >= BOUNDS.southWest.lat &&
      lat <= BOUNDS.northEast.lat &&
      lng >= BOUNDS.southWest.lng &&
      lng <= BOUNDS.northEast.lng;

    if (!isInServiceArea || !withinBounds) {
      toast.error(
        "We only deliver in Milton Keynes (MK) and Oxford (OX) areas.",
        {
          duration: 4000,
        },
      );
      return null;
    }

    return {
      line1:
        `${postcodeData.admin_ward || ""} ${postcodeData.parish ? postcodeData.parish.split(",")[0] : ""}`.trim() ||
        postcodeData.admin_district ||
        "Unknown Street",
      line2: postcodeData.admin_district || "",
      city: postcodeData.admin_district || postcodeData.region || "",
      region: postcodeData.admin_county || "",
      postal_code: postcodeData.postcode,
      country: "GB",
      latitude: lat,
      longitude: lng,
      validated: true,
    };
  };

  const handleSuggestionSelect = async (suggestion) => {
    setShowSuggestions(false);
    setInputValue(suggestion.postcode);
    onPostcodeChange?.(suggestion.postcode);

    setIsLoading(true);
    const result = await bookingApi.lookupPostcode(suggestion.postcode);
    setIsLoading(false);

    if (result.success && result.data) {
      const address = mapToAddress(result.data);
      if (address) {
        setSelectedAddress(address);
        onSelect(address);
      }
    } else {
      toast.error("Could not retrieve full address details.", { duration: 3000 });
    }
  };

  const handleManualLookup = async () => {
    const trimmed = inputValue.trim();
    if (!trimmed || !UK_POSTCODE_REGEX.test(trimmed)) {
      toast.error("Please enter a valid UK postcode (e.g. MK10 1AA)", { duration: 3000 });
      return;
    }
    setShowSuggestions(false);
    await handleSuggestionSelect({ postcode: trimmed });
  };

  const clearSelection = () => {
    setSelectedAddress(null);
    setInputValue("");
    onPostcodeChange?.("");
    onSelect(null);
  };

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className="space-y-2" ref={wrapperRef}>
      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
        {label} <span className="text-red-500">*</span>
      </label>

      <div className="relative">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400">
              <Search size={18} />
            </div>
            <input
              type="text"
              value={inputValue}
              onChange={handleInputChange}
              placeholder={placeholder}
              className="w-full pl-11 pr-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-orange-500 transition-all"
              onFocus={() => setShowSuggestions(true)}
            />
          </div>

          <button
            onClick={handleManualLookup}
            disabled={isLoading || !inputValue.trim()}
            className="px-6 py-3 bg-orange-500 hover:bg-orange-600 disabled:bg-gray-300 text-white font-medium rounded-lg transition-colors flex items-center gap-2 whitespace-nowrap"
          >
            {isLoading ? (
              <Loader2 size={18} className="animate-spin" />
            ) : (
              <MapPin size={18} />
            )}
            Lookup
          </button>
        </div>

        {/* Suggestions – ONLY MK/OX */}
        {showSuggestions && suggestions.length > 0 && (
          <ul className="absolute z-50 mt-1 w-full bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-xl shadow-2xl max-h-72 overflow-auto py-1">
            {suggestions.map((sugg, idx) => (
              <li
                key={idx}
                onClick={() => handleSuggestionSelect(sugg)}
                className="px-4 py-3 hover:bg-orange-50 dark:hover:bg-orange-900/30 cursor-pointer flex items-center gap-3 group border-b border-gray-100 last:border-none"
              >
                <MapPin size={18} className="text-orange-500 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-gray-900 dark:text-white group-hover:text-orange-600">
                    {sugg.postcode}
                  </div>
                  <div className="text-sm text-gray-600 dark:text-gray-400 truncate">
                    {sugg.admin_district ||
                      sugg.region ||
                      "Milton Keynes / Oxford"}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}

        {/* Loading */}
        {showSuggestions && isLoading && suggestions.length === 0 && (
          <div className="absolute z-50 mt-1 w-full bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-xl shadow-xl p-6 text-center">
            <Loader2
              size={22}
              className="animate-spin mx-auto text-orange-500"
            />
            <p className="text-sm text-gray-500 mt-3">Searching postcodes...</p>
          </div>
        )}
      </div>

      {/* Green Selected Box (only one toast-like feedback) */}
      {/* {selectedAddress && (
        <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-xl p-4 text-sm">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <p className="font-medium text-green-800 dark:text-green-200 flex items-center gap-2">
                <MapPin size={16} /> Address Selected
              </p>
              <p className="mt-1 text-green-700 dark:text-green-300">
                {selectedAddress.line1}, {selectedAddress.city}{" "}
                <span className="font-medium">{selectedAddress.postal_code}</span>
              </p>
            </div>
            <button
              onClick={clearSelection}
              className="text-green-600 hover:text-green-800 p-1 -mt-1"
            >
              <X size={18} />
            </button>
          </div>
        </div>
      )} */}

      {validation && (
        <div className="flex items-center text-red-500 text-sm mt-1">
          <AlertCircle size={16} className="mr-2" />
          {validation}
        </div>
      )}
    </div>
  );
};

export default AddressAutocomplete;
