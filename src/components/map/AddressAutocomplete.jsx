"use client"

import { useRef, useState, useEffect } from "react"
import { useMapsLibrary } from "@vis.gl/react-google-maps"
import { AlertCircle, Loader2 } from "lucide-react"

const AddressAutocomplete = ({
  label,
  value,
  onSelect,
  disabled = false,
  postcode,
  onPostcodeChange,
  suggestions = [],
  isLoading = false,
  validation,
  placeholder,
}) => {
  const autocompleteRef = useRef(null)
  const inputRef = useRef(null)
  const places = useMapsLibrary("places")

  useEffect(() => {
    if (!places || !inputRef.current) return

    const options = {
      bounds: new window.google.maps.LatLngBounds(
        new window.google.maps.LatLng(51.65, -1.35),
        new window.google.maps.LatLng(52.1, -0.65)
      ),
      strictBounds: true,
      componentRestrictions: { country: "gb" },
      types: ["address"],
      fields: ["address_components", "geometry", "name"],
    }

    const autocomplete = new places.Autocomplete(inputRef.current, options)
    autocompleteRef.current = autocomplete

    const listener = autocomplete.addListener("place_changed", handlePlaceChanged)

    return () => {
      google.maps.event.removeListener(listener)
      autocompleteRef.current = null
    }
  }, [places])

  const handlePlaceChanged = () => {
    if (!autocompleteRef.current) return
    const place = autocompleteRef.current.getPlace()
    if (!place?.geometry?.location) return

    const components = place.address_components.reduce((acc, comp) => {
      const type = comp.types[0]
      if (type === "street_number") acc.street_number = comp.long_name
      if (type === "route") acc.route = comp.long_name
      if (type === "locality") acc.city = comp.long_name
      if (type === "postal_town") acc.city = acc.city || comp.long_name
      if (type === "administrative_area_level_1") acc.region = comp.long_name
      if (type === "postal_code") acc.postal_code = comp.long_name
      if (type === "country") acc.country = comp.short_name
      if (type === "sublocality" || type === "neighborhood") acc.line2 = comp.long_name
      if (!acc.city && type === "administrative_area_level_2") acc.city = comp.long_name
      return acc
    }, {})

    const address = {
      line1: `${components.street_number || ""} ${components.route || ""}`.trim() || place.name,
      line2: components.line2 || "",
      city: components.city || "",
      region: components.region || "",
      postal_code: components.postal_code || "",
      country: components.country || "GB",
      latitude: place.geometry.location.lat(),
      longitude: place.geometry.location.lng(),
      validated: true,
    }

    const isWithinBounds =
      address.latitude >= 51.65 && address.latitude <= 52.1 &&
      address.longitude >= -1.35 && address.longitude <= -0.65
    if (!isWithinBounds) {
      alert("Selected address is outside our service area (Milton Keynes/Oxford). Please choose another.")
      return
    }

    if (typeof onSelect === "function") {
      onSelect(address)
    } else {
      console.error("onSelect is not a function:", onSelect)
    }

    if (typeof onPostcodeChange === "function" && components.postal_code) {
      onPostcodeChange(components.postal_code)
    }
  }

  if (!places || isLoading) {
    return (
      <div className="space-y-2">
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">{label}</label>
        <div className="flex items-center justify-center h-10">
          <Loader2 className="h-5 w-5 text-orange-500 animate-spin" />
          <span className="ml-2 text-sm text-gray-500">Loading autocomplete...</span>
        </div>
        {validation && (
          <div className="flex items-center text-red-500 text-sm">
            <AlertCircle size={16} className="mr-2" />
            {validation}
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">{label}</label>
      <input
        ref={inputRef}
        type="text"
        value={value || postcode || ""}
        onChange={(e) => typeof onPostcodeChange === "function" && onPostcodeChange(e.target.value)}
        placeholder={placeholder || `Enter ${label.toLowerCase()} address`}
        disabled={disabled}
        className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-colors disabled:opacity-50"
      />
      {suggestions.length > 0 && (
        <ul className="mt-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800">
          {suggestions.map((suggestion, index) => (
            <li
              key={index}
              className="px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer"
              onClick={() => typeof onSelect === "function" && onSelect(suggestion)}
            >
              {suggestion.line1}, {suggestion.city}
            </li>
          ))}
        </ul>
      )}
      {validation && (
        <div className="flex items-center text-red-500 text-sm">
          <AlertCircle size={16} className="mr-2" />
          {validation}
        </div>
      )}
    </div>
  )
}

export default AddressAutocomplete