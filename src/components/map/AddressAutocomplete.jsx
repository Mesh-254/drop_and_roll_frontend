"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import {
  useAutocomplete,
  usePlacesService,
} from "@vis.gl/react-google-maps";
import {
  AlertCircle,
  Loader2,
  MapPin,
  Search,
  X,
  Check,
  Edit2,
} from "lucide-react";
import { toast } from "react-hot-toast";

// Service areas: MK (Milton Keynes) and OX (Oxford)
const SERVICE_AREAS = ["MK", "OX"];

const BOUNDS = {
  southWest: { lat: 51.65, lng: -1.35 },
  northEast: { lat: 52.1, lng: -0.65 },
};

/**
 * AddressAutocomplete Component
 * Uses Google Places Autocomplete API to search real UK addresses
 * Returns full structured Address object compatible with Django backend
 *
 * Props:
 * - label: Form field label
 * - onSelect: Callback when address is selected (receives full Address object)
 * - postcode: Controlled postcode value (for backward compatibility)
 * - onPostcodeChange: Callback for postcode changes
 * - validation: Validation error message to display
 * - placeholder: Input placeholder text
 */
const AddressAutocomplete = ({
  label,
  onSelect,
  postcode = "",
  onPostcodeChange,
  validation,
  placeholder = "Search by postcode or address",
}) => {
  const [inputValue, setInputValue] = useState(postcode);
  const [suggestions, setSuggestions] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedAddress, setSelectedAddress] = useState(null);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [showEditForm, setShowEditForm] = useState(false);
  const [editingAddress, setEditingAddress] = useState(null);

  const wrapperRef = useRef(null);
  const inputRef = useRef(null);
  const debounceTimer = useRef(null);

  // Get the Google Maps API key
  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;

  // Use Google Places Autocomplete service
  const { getPlacePredictions, isLoading: isAutocompleteLoading } =
    useAutocomplete({
      apiKey,
      options: {
        bounds: BOUNDS,
        componentRestrictions: { country: "gb" },
        types: ["geocode"],
      },
    });

  // Use Google Places service to get place details
  const placesService = usePlacesService({
    apiKey,
  });

  // Sync external postcode prop
  useEffect(() => {
    setInputValue(postcode);
  }, [postcode]);

  // Auto-lookup when postcode is pre-filled
  useEffect(() => {
    if (postcode && !selectedAddress) {
      const timer = setTimeout(() => {
        handleSearch(postcode);
      }, 150);
      return () => clearTimeout(timer);
    }
  }, [postcode, selectedAddress]);

  /**
   * Search for addresses using Google Places Autocomplete
   * Filters results to MK and OX postcodes only
   */
  const handleSearch = useCallback(async (query) => {
    if (debounceTimer.current) clearTimeout(debounceTimer.current);

    debounceTimer.current = setTimeout(async () => {
      const trimmed = query.trim();
      if (trimmed.length < 2) {
        setSuggestions([]);
        return;
      }

      setIsLoading(true);

      try {
        const predictions = await getPlacePredictions({ input: trimmed });

        if (predictions && predictions.length > 0) {
          // Filter to service areas (MK and OX postcodes)
          const filtered = predictions.filter((pred) => {
            const text = pred.description.toUpperCase();
            return (
              text.includes("MK ") ||
              text.includes("MK1") ||
              text.includes("OX ") ||
              text.includes("OX1")
            );
          });

          setSuggestions(filtered.slice(0, 8)); // Limit to 8 results
        } else {
          setSuggestions([]);
        }
      } catch (error) {
        console.error("[AddressAutocomplete] Search error:", error);
        setSuggestions([]);
        toast.error("Failed to search addresses");
      } finally {
        setIsLoading(false);
      }
    }, 300);
  }, [getPlacePredictions]);

  const handleInputChange = (e) => {
    const value = e.target.value;
    setInputValue(value);
    onPostcodeChange?.(value);
    setShowSuggestions(true);
    if (value.trim().length >= 2) {
      handleSearch(value);
    }
  };

  /**
   * Get full address details from Google Places
   * Returns structured address compatible with Django backend
   */
  const getAddressDetails = useCallback(
    async (placeId) => {
      return new Promise((resolve) => {
        if (!placesService || !placesService.getDetails) {
          toast.error("Places service unavailable");
          resolve(null);
          return;
        }

        placesService.getDetails(
          { placeId, fields: ["formatted_address", "geometry", "address_components"] },
          (place, status) => {
            if (status !== "OK" || !place) {
              toast.error("Could not retrieve address details");
              resolve(null);
              return;
            }

            // Extract address components
            const addressComponents = place.address_components || [];
            let line1 = "";
            let city = "";
            let postal_code = "";
            let region = "";

            addressComponents.forEach((component) => {
              const types = component.types || [];
              if (types.includes("street_number")) {
                line1 = component.long_name + " ";
              }
              if (types.includes("route")) {
                line1 += component.long_name;
              }
              if (types.includes("postal_town")) {
                city = component.long_name;
              }
              if (types.includes("postal_code")) {
                postal_code = component.long_name;
              }
              if (types.includes("administrative_area_level_2")) {
                region = component.long_name;
              }
            });

            // Validate postcode is in service area
            const postcodeTrimmed = postal_code.replace(/\s+/g, "").toUpperCase();
            if (
              !SERVICE_AREAS.some((area) => postcodeTrimmed.startsWith(area))
            ) {
              toast.error(
                "We only deliver in Milton Keynes (MK) and Oxford (OX) areas"
              );
              resolve(null);
              return;
            }

            // Check if within bounds
            const lat = place.geometry?.location?.lat?.();
            const lng = place.geometry?.location?.lng?.();

            if (
              !lat ||
              !lng ||
              lat < BOUNDS.southWest.lat ||
              lat > BOUNDS.northEast.lat ||
              lng < BOUNDS.southWest.lng ||
              lng > BOUNDS.northEast.lng
            ) {
              toast.error("Address is outside our service area");
              resolve(null);
              return;
            }

            const address = {
              line1: line1 || "Unknown Street",
              line2: "", // Can be edited by user
              city: city || region || "",
              region: region || "",
              postal_code: postal_code,
              country: "GB",
              latitude: lat,
              longitude: lng,
              validated: true,
            };

            resolve(address);
          }
        );
      });
    },
    [placesService]
  );

  /**
   * Handle address selection from dropdown
   */
  const handleSuggestionSelect = async (suggestion) => {
    setShowSuggestions(false);
    setInputValue(suggestion.description);
    onPostcodeChange?.(suggestion.description);

    setIsLoading(true);

    try {
      const address = await getAddressDetails(suggestion.place_id);

      if (address) {
        setSelectedAddress(address);
        setEditingAddress({ ...address });
        onSelect(address);
        toast.success(`Address selected: ${address.line1}`);
      }
    } catch (error) {
      console.error("[AddressAutocomplete] Selection error:", error);
      toast.error("Failed to select address");
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Handle manual search/lookup with Enter key
   */
  const handleKeyDown = (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleSearch(inputValue);
    }
  };

  /**
   * Clear selection and reset form
   */
  const clearSelection = () => {
    setSelectedAddress(null);
    setEditingAddress(null);
    setInputValue("");
    onPostcodeChange?.("");
    onSelect(null);
    setShowEditForm(false);
  };

  /**
   * Handle address edit/confirmation
   */
  const handleEditConfirm = () => {
    if (editingAddress) {
      setSelectedAddress(editingAddress);
      onSelect(editingAddress);
      setShowEditForm(false);
      toast.success("Address updated");
    }
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
    <div className="space-y-3" ref={wrapperRef}>
      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
        {label} <span className="text-red-500">*</span>
      </label>

      {/* Search Input */}
      {!selectedAddress && (
        <div className="relative">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400">
                <Search size={18} />
              </div>
              <input
                ref={inputRef}
                type="text"
                value={inputValue}
                onChange={handleInputChange}
                onKeyDown={handleKeyDown}
                onFocus={() => setShowSuggestions(true)}
                placeholder={placeholder}
                className="w-full pl-11 pr-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-orange-500 transition-all"
              />
              {inputValue && !isLoading && (
                <button
                  onClick={() => {
                    setInputValue("");
                    onPostcodeChange?.("");
                    setSuggestions([]);
                  }}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                >
                  <X size={18} />
                </button>
              )}
            </div>
          </div>

          {/* Suggestions Dropdown */}
          {showSuggestions && suggestions.length > 0 && (
            <ul className="absolute z-50 mt-2 w-full bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-xl shadow-2xl max-h-80 overflow-auto py-1">
              {suggestions.map((suggestion, idx) => (
                <li
                  key={idx}
                  onClick={() => handleSuggestionSelect(suggestion)}
                  className="px-4 py-3 hover:bg-orange-50 dark:hover:bg-orange-900/30 cursor-pointer flex items-start gap-3 group border-b border-gray-100 dark:border-gray-700 last:border-none transition-colors"
                >
                  <MapPin
                    size={18}
                    className="text-orange-500 flex-shrink-0 mt-1"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-gray-900 dark:text-white group-hover:text-orange-600 dark:group-hover:text-orange-400">
                      {suggestion.main_text || ""}
                    </div>
                    <div className="text-sm text-gray-600 dark:text-gray-400 truncate">
                      {suggestion.secondary_text || ""}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}

          {/* Loading State */}
          {(isLoading || isAutocompleteLoading) && suggestions.length === 0 && (
            <div className="absolute z-50 mt-2 w-full bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-xl shadow-xl p-6 text-center">
              <Loader2
                size={22}
                className="animate-spin mx-auto text-orange-500"
              />
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-3">
                Searching addresses...
              </p>
            </div>
          )}

          {/* No Results */}
          {showSuggestions &&
            inputValue.length >= 2 &&
            suggestions.length === 0 &&
            !isLoading && (
              <div className="absolute z-50 mt-2 w-full bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-xl shadow-xl p-6 text-center">
                <AlertCircle
                  size={22}
                  className="mx-auto text-orange-500 mb-2"
                />
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  No addresses found. Try a different search or postcode.
                </p>
              </div>
            )}
        </div>
      )}

      {/* Selected Address Box */}
      {selectedAddress && !showEditForm && (
        <div className="bg-green-50 dark:bg-green-900/20 border-2 border-green-200 dark:border-green-800 rounded-xl p-4 space-y-3">
          <div className="flex items-start justify-between">
            <div className="flex items-start gap-3 flex-1">
              <Check size={20} className="text-green-600 mt-0.5 flex-shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-green-900 dark:text-green-100">
                  Address Selected
                </p>
                <div className="mt-2 space-y-1 text-sm text-green-800 dark:text-green-200">
                  <p className="font-medium">{selectedAddress.line1}</p>
                  {selectedAddress.line2 && <p>{selectedAddress.line2}</p>}
                  <p>
                    {selectedAddress.city}
                    {selectedAddress.region && `, ${selectedAddress.region}`}
                  </p>
                  <p className="font-medium">{selectedAddress.postal_code}</p>
                </div>
              </div>
            </div>
            <button
              onClick={() => setShowEditForm(true)}
              className="flex items-center gap-1 px-3 py-2 rounded-lg hover:bg-green-100 dark:hover:bg-green-900/50 text-green-700 dark:text-green-300 font-medium transition-colors text-sm flex-shrink-0"
            >
              <Edit2 size={16} />
              Edit
            </button>
          </div>
          <button
            onClick={clearSelection}
            className="text-sm text-green-600 hover:text-green-700 dark:text-green-400 dark:hover:text-green-300 font-medium"
          >
            Change address
          </button>
        </div>
      )}

      {/* Edit Address Form */}
      {showEditForm && editingAddress && (
        <div className="bg-gray-50 dark:bg-gray-800 border-2 border-orange-200 dark:border-orange-800 rounded-xl p-4 space-y-3">
          <h4 className="font-semibold text-gray-900 dark:text-white">
            Edit Address
          </h4>

          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Street Address
              </label>
              <input
                type="text"
                value={editingAddress.line1}
                onChange={(e) =>
                  setEditingAddress({ ...editingAddress, line1: e.target.value })
                }
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Additional Address (Optional)
              </label>
              <input
                type="text"
                value={editingAddress.line2 || ""}
                onChange={(e) =>
                  setEditingAddress({ ...editingAddress, line2: e.target.value })
                }
                placeholder="Apartment, suite, etc."
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-orange-500"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  City
                </label>
                <input
                  type="text"
                  value={editingAddress.city}
                  onChange={(e) =>
                    setEditingAddress({ ...editingAddress, city: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Postcode
                </label>
                <input
                  type="text"
                  value={editingAddress.postal_code}
                  onChange={(e) =>
                    setEditingAddress({
                      ...editingAddress,
                      postal_code: e.target.value,
                    })
                  }
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-500"
                />
              </div>
            </div>
          </div>

          <div className="flex gap-2">
            <button
              onClick={handleEditConfirm}
              className="flex-1 px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white font-medium rounded-lg transition-colors"
            >
              Confirm Changes
            </button>
            <button
              onClick={() => {
                setShowEditForm(false);
                setEditingAddress(selectedAddress);
              }}
              className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 font-medium rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Validation Error */}
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
