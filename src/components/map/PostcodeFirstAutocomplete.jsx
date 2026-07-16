"use client"
/**
 * components/map/PostcodeFirstAutocomplete.jsx
 * ════════════════════════════════════════════════════════════════════════
 * Postcode-first UK address selection with graceful multi-tier fallback.
 *
 *   Ideal Postcodes (primary)  →  Google Places (fallback)  →  manual entry
 *
 * Drop-in replacement for the old Google-only AddressAutocomplete — it
 * accepts the SAME props (label, value, postcode, onPostcodeChange, onSelect,
 * validation, disabled, placeholder) so swapping it into GetQuoteBook.jsx is
 * a one-line import change. See the bottom of this file for the exact prop
 * contract.
 *
 * FLOW
 * ────
 *   1. User types into a single input ("MK9 1AA" or "Central Milton Keynes").
 *   2. Debounced 300ms → bookingApi.autocompleteAddress(query) (Ideal
 *      Postcodes, proxied server-side — see BookingApi.js).
 *   3. Results render in a keyboard-navigable, ARIA-compliant dropdown.
 *      Only the first PAGE_SIZE (20) results render as real DOM nodes at
 *      once; scrolling near the bottom or clicking "Show more" reveals the
 *      next page. This keeps the dropdown responsive without pulling in a
 *      virtualization library the project doesn't already depend on — for
 *      Ideal Postcodes' typical result volumes (≤ ~40) this is effectively
 *      as smooth as full virtualization, at zero new dependencies. Swap in
 *      react-window/@tanstack/react-virtual here if result sets ever grow
 *      into the hundreds.
 *   4. On selection → bookingApi.getPostcodeAddressDetails(id) fetches the
 *      full premise → confirmation modal ("Is this correct?") → onSelect().
 *   5. If Ideal Postcodes is unavailable (not configured / rate-limited /
 *      upstream error) or returns zero results for a query that still looks
 *      postcode-like, we fall back to Google Places Autocomplete
 *      (bounded + biased to the MK/OX corridor, same as before).
 *   6. If Google also fails (or the user just wants to type it in), a
 *      "Enter address manually" link reveals plain form fields.
 *
 * Every path funnels through the same onSelect(address) contract, tagging
 * `address.meta = { source: "ideal_postcodes" | "google" | "manual" }` so
 * the backend can record provenance (Address.source / Address.meta).
 */

import { useRef, useState, useEffect, useCallback, useId } from "react"
import { useMapsLibrary } from "@vis.gl/react-google-maps"
import { AlertCircle, Loader2, MapPin, CheckCircle2, Pencil, ChevronDown } from "lucide-react"
import toast from "react-hot-toast"
import { bookingApi } from "../../api/BookingApi"

const DEBOUNCE_MS = 300
const PAGE_SIZE = 20 // rendered per "page" in the dropdown — see file header

// Feature flag: default TRUE. Set VITE_USE_IDEAL_POSTCODES_PRIMARY=false to
// force Google-first (e.g. temporarily, if Ideal Postcodes has an outage
// affecting the whole fleet rather than just one request).
const USE_IDEAL_POSTCODES_PRIMARY =
  (import.meta.env.VITE_USE_IDEAL_POSTCODES_PRIMARY ?? "true") !== "false"

// Loose "does this look like it could resolve to a UK postcode" check, used
// only to decide whether an empty Ideal Postcodes result set should still
// try Google (a postcode-shaped query that returns nothing might be a typo
// Google's fuzzier matching can rescue) or go straight to "no results".
const LOOKS_POSTCODE_ISH = /^[A-Z]{1,2}[0-9]/i

function useDebouncedValue(value, delayMs) {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const handle = setTimeout(() => setDebounced(value), delayMs)
    return () => clearTimeout(handle)
  }, [value, delayMs])
  return debounced
}

/** Confirmation modal — "Is this correct?" */
function ConfirmAddressModal({ address, onConfirm, onEdit, onCancel }) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-address-heading"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onCancel}
    >
      <div
        className="w-full max-w-sm rounded-xl bg-white dark:bg-gray-800 p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h3
          id="confirm-address-heading"
          className="text-lg font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2"
        >
          <MapPin className="h-5 w-5 text-orange-500" />
          Is this correct?
        </h3>
        <div className="rounded-lg bg-gray-50 dark:bg-gray-900 p-3 text-sm text-gray-700 dark:text-gray-300 mb-4">
          <p className="font-medium">{address.line1}</p>
          {address.line2 && <p>{address.line2}</p>}
          <p>
            {address.city}
            {address.region ? `, ${address.region}` : ""}
          </p>
          <p className="font-medium">{address.postal_code}</p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onEdit}
            className="flex-1 flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 text-sm font-medium transition-colors"
          >
            <Pencil className="h-4 w-4" />
            Edit
          </button>
          <button
            type="button"
            onClick={onConfirm}
            autoFocus
            className="flex-1 flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg bg-orange-500 hover:bg-orange-600 text-white text-sm font-medium transition-colors"
          >
            <CheckCircle2 className="h-4 w-4" />
            Yes, that's right
          </button>
        </div>
      </div>
    </div>
  )
}

/** Plain manual-entry fields — last-resort fallback. */
function ManualAddressForm({ initial, onSubmit, onCancel }) {
  const [fields, setFields] = useState({
    line1: initial?.line1 || "",
    line2: initial?.line2 || "",
    city: initial?.city || "",
    region: initial?.region || "",
    postal_code: initial?.postal_code || "",
  })

  const update = (key) => (e) => setFields((prev) => ({ ...prev, [key]: e.target.value }))

  const canSubmit = fields.line1.trim() && fields.city.trim() && fields.postal_code.trim()

  return (
    <div className="space-y-3 rounded-lg border border-gray-300 dark:border-gray-600 p-4 bg-white dark:bg-gray-800">
      <p className="text-sm text-gray-600 dark:text-gray-400">
        Enter the address manually. We'll verify the postcode before confirming your booking.
      </p>
      <input
        aria-label="Address line 1"
        value={fields.line1}
        onChange={update("line1")}
        placeholder="Address line 1 *"
        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-sm text-gray-900 dark:text-white"
      />
      <input
        aria-label="Address line 2"
        value={fields.line2}
        onChange={update("line2")}
        placeholder="Address line 2 (optional)"
        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-sm text-gray-900 dark:text-white"
      />
      <div className="grid grid-cols-2 gap-2">
        <input
          aria-label="Town or city"
          value={fields.city}
          onChange={update("city")}
          placeholder="Town / City *"
          className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-sm text-gray-900 dark:text-white"
        />
        <input
          aria-label="Postcode"
          value={fields.postal_code}
          onChange={update("postal_code")}
          placeholder="Postcode *"
          className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-sm text-gray-900 dark:text-white"
        />
      </div>
      <input
        aria-label="County"
        value={fields.region}
        onChange={update("region")}
        placeholder="County (optional)"
        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-sm text-gray-900 dark:text-white"
      />
      <div className="flex gap-2 pt-1">
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-700"
        >
          Back to search
        </button>
        <button
          type="button"
          disabled={!canSubmit}
          onClick={() => onSubmit(fields)}
          className="flex-1 px-4 py-2 rounded-lg bg-orange-500 hover:bg-orange-600 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-medium"
        >
          Use this address
        </button>
      </div>
    </div>
  )
}

const PostcodeFirstAutocomplete = ({
  label,
  value,
  onSelect,
  disabled = false,
  postcode,
  onPostcodeChange,
  validation,
  placeholder,
}) => {
  const inputRef = useRef(null)
  const listboxId = useId()

  const [query, setQuery] = useState(postcode || value || "")
  const debouncedQuery = useDebouncedValue(query, DEBOUNCE_MS)

  const [suggestions, setSuggestions] = useState([]) // Ideal Postcodes hits
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE)
  const [isSearching, setIsSearching] = useState(false)
  const [isOpen, setIsOpen] = useState(false)
  const [highlightedIndex, setHighlightedIndex] = useState(-1)

  // "idealPostcodes" | "google" | "manual" — which source is currently
  // driving the dropdown / input behaviour.
  const [mode, setMode] = useState(USE_IDEAL_POSTCODES_PRIMARY ? "idealPostcodes" : "google")
  const [fallbackNotice, setFallbackNotice] = useState(null)
  const [pendingConfirm, setPendingConfirm] = useState(null) // address awaiting Yes/Edit
  const [areaWarning, setAreaWarning] = useState(null)

  const requestIdRef = useRef(0)

  // Keep the input in sync if the parent resets postcode externally
  // (e.g. clearing the form after a successful booking).
  useEffect(() => {
    if (postcode !== undefined && postcode !== query) {
      setQuery(postcode || "")
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [postcode])

  // ── Ideal Postcodes search (primary) ──────────────────────────────────
  useEffect(() => {
    if (mode !== "idealPostcodes") return
    const trimmed = debouncedQuery.trim()
    if (trimmed.length < 2) {
      setSuggestions([])
      setIsOpen(false)
      return
    }

    const thisRequestId = ++requestIdRef.current
    setIsSearching(true)

    bookingApi.autocompleteAddress(trimmed).then((res) => {
      if (thisRequestId !== requestIdRef.current) return // stale response, ignore
      setIsSearching(false)

      if (res.success) {
        const hits = res.results || []
        setSuggestions(hits)
        setVisibleCount(PAGE_SIZE)
        setHighlightedIndex(-1)
        setIsOpen(true)

        if (hits.length === 0 && LOOKS_POSTCODE_ISH.test(trimmed)) {
          // Looks like a postcode but Ideal Postcodes drew a blank — worth
          // letting Google's fuzzier matching have a shot before we give up.
          setFallbackNotice(
            "No exact matches found. Showing suggestions from Google Maps instead."
          )
          setMode("google")
        }
        return
      }

      // Ideal Postcodes failed outright (not configured / rate-limited /
      // upstream error) — fall back to Google immediately.
      setSuggestions([])
      setFallbackNotice(
        res.reason === "not_configured"
          ? "Using Google Maps for address search."
          : "Address search is running slowly — switching to Google Maps."
      )
      setMode("google")
    })
  }, [debouncedQuery, mode])

  // ── Google Places fallback ─────────────────────────────────────────────
  const places = useMapsLibrary("places")
  const googleAutocompleteRef = useRef(null)

  useEffect(() => {
    if (mode !== "google" || !places || !inputRef.current) return

    const options = {
      bounds: new window.google.maps.LatLngBounds(
        new window.google.maps.LatLng(51.65, -1.35),
        new window.google.maps.LatLng(52.1, -0.65)
      ),
      strictBounds: false, // biased, not hard-limited — service-area check does the real enforcement
      componentRestrictions: { country: "gb" },
      types: ["address"],
      fields: ["address_components", "geometry", "name"],
    }

    const autocomplete = new places.Autocomplete(inputRef.current, options)
    googleAutocompleteRef.current = autocomplete

    const listener = autocomplete.addListener("place_changed", () => {
      const place = autocomplete.getPlace()
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
        meta: { source: "google", confidence: 0.8 },
      }

      setPendingConfirm(address)
      setIsOpen(false)
    })

    return () => {
      window.google?.maps?.event?.removeListener(listener)
      googleAutocompleteRef.current = null
    }
  }, [places, mode])

  // ── Selecting an Ideal Postcodes suggestion ───────────────────────────
  const handleSelectSuggestion = useCallback(async (hit) => {
    setIsOpen(false)
    setIsSearching(true)
    const addressId = hit.id ?? hit.udprn ?? hit.relative_url
    const res = await bookingApi.getPostcodeAddressDetails(addressId)
    setIsSearching(false)

    if (!res.success) {
      setFallbackNotice("Couldn't load that address's details. Switching to Google Maps.")
      setMode("google")
      return
    }

    if (!res.in_service_area) {
      setAreaWarning(res.service_area_message)
      toast.error(
        res.service_area_message ||
          "We don't currently operate in this area. Please choose an address in Milton Keynes, Oxford or surrounding postcodes.",
        { id: `service-area-${label || "address"}` }
      )
    } else {
      setAreaWarning(null)
    }

    setPendingConfirm(res.address)
  }, [label])

  const closeConfirm = () => setPendingConfirm(null)

  const confirmSelectedAddress = () => {
    if (!pendingConfirm) return
    if (typeof onSelect === "function") onSelect(pendingConfirm)
    if (typeof onPostcodeChange === "function" && pendingConfirm.postal_code) {
      onPostcodeChange(pendingConfirm.postal_code)
    }
    setQuery(pendingConfirm.postal_code || pendingConfirm.line1 || "")
    setPendingConfirm(null)
  }

  const editSelectedAddress = () => {
    setMode("manual")
    setPendingConfirm(null)
  }

  // ── Manual entry ────────────────────────────────────────────────────────
  const handleManualSubmit = (fields) => {
    const address = {
      ...fields,
      country: "GB",
      latitude: null,
      longitude: null,
      meta: { source: "manual", confidence: 0 },
    }
    const check = bookingApi.validateAddressInServiceArea(address)
    setAreaWarning(check.valid ? null : check.message)
    if (!check.valid) {
      toast.error(
        check.message ||
          "We don't currently operate in this area. Please choose an address in Milton Keynes, Oxford or surrounding postcodes.",
        { id: `service-area-${label || "address"}` }
      )
    }
    if (typeof onSelect === "function") onSelect(address)
    if (typeof onPostcodeChange === "function") onPostcodeChange(fields.postal_code)
    setQuery(fields.postal_code)
    setMode(USE_IDEAL_POSTCODES_PRIMARY ? "idealPostcodes" : "google")
  }

  // ── Keyboard navigation ────────────────────────────────────────────────
  const visibleSuggestions = suggestions.slice(0, visibleCount)

  const handleKeyDown = (e) => {
    if (mode !== "idealPostcodes" || !isOpen || visibleSuggestions.length === 0) return
    if (e.key === "ArrowDown") {
      e.preventDefault()
      setHighlightedIndex((i) => Math.min(i + 1, visibleSuggestions.length - 1))
    } else if (e.key === "ArrowUp") {
      e.preventDefault()
      setHighlightedIndex((i) => Math.max(i - 1, 0))
    } else if (e.key === "Enter") {
      e.preventDefault()
      if (highlightedIndex >= 0) handleSelectSuggestion(visibleSuggestions[highlightedIndex])
    } else if (e.key === "Escape") {
      setIsOpen(false)
    }
  }

  const handleListScroll = (e) => {
    const el = e.target
    if (el.scrollTop + el.clientHeight >= el.scrollHeight - 40) {
      setVisibleCount((c) => Math.min(c + PAGE_SIZE, suggestions.length))
    }
  }

  const inputId = `${listboxId}-input`

  return (
    <div className="space-y-2 relative">
      <label htmlFor={inputId} className="block text-sm font-medium text-gray-700 dark:text-gray-300">
        {label}
      </label>

      {mode === "manual" ? (
        <ManualAddressForm
          initial={{ postal_code: query }}
          onSubmit={handleManualSubmit}
          onCancel={() => setMode(USE_IDEAL_POSTCODES_PRIMARY ? "idealPostcodes" : "google")}
        />
      ) : (
        <>
          <div className="relative">
            <input
              id={inputId}
              ref={inputRef}
              type="text"
              role="combobox"
              aria-expanded={isOpen}
              aria-controls={listboxId}
              aria-autocomplete="list"
              aria-activedescendant={
                highlightedIndex >= 0 ? `${listboxId}-option-${highlightedIndex}` : undefined
              }
              autoComplete="off"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value)
                if (typeof onPostcodeChange === "function") onPostcodeChange(e.target.value)
              }}
              onFocus={() => suggestions.length > 0 && mode === "idealPostcodes" && setIsOpen(true)}
              onKeyDown={handleKeyDown}
              disabled={disabled}
              placeholder={
                placeholder || `Postcode or location name (e.g. MK9 1AA or Central Milton Keynes)`
              }
              className="w-full px-4 py-3 pr-10 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-colors disabled:opacity-50"
            />
            <div className="absolute right-3 top-1/2 -translate-y-1/2">
              {isSearching ? (
                <Loader2 className="h-4 w-4 text-orange-500 animate-spin" aria-hidden="true" />
              ) : (
                <ChevronDown className="h-4 w-4 text-gray-400" aria-hidden="true" />
              )}
            </div>
          </div>

          {mode === "idealPostcodes" && isOpen && visibleSuggestions.length > 0 && (
            <ul
              id={listboxId}
              role="listbox"
              aria-label={`${label} suggestions`}
              onScroll={handleListScroll}
              className="max-h-72 overflow-y-auto border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 shadow-lg divide-y divide-gray-100 dark:divide-gray-700"
            >
              {visibleSuggestions.map((hit, index) => (
                <li
                  key={hit.id ?? hit.udprn ?? index}
                  id={`${listboxId}-option-${index}`}
                  role="option"
                  aria-selected={index === highlightedIndex}
                  onMouseEnter={() => setHighlightedIndex(index)}
                  onClick={() => handleSelectSuggestion(hit)}
                  className={`px-4 py-2.5 text-sm cursor-pointer flex items-start gap-2 ${
                    index === highlightedIndex
                      ? "bg-orange-50 dark:bg-orange-900/30"
                      : "hover:bg-gray-50 dark:hover:bg-gray-700"
                  }`}
                >
                  <MapPin className="h-4 w-4 mt-0.5 text-gray-400 shrink-0" aria-hidden="true" />
                  <span className="text-gray-800 dark:text-gray-200">
                    {hit.suggestion || hit.line_1 || hit.address || "Address"}
                  </span>
                </li>
              ))}
              {visibleCount < suggestions.length && (
                <li className="px-4 py-2 text-center">
                  <button
                    type="button"
                    onClick={() =>
                      setVisibleCount((c) => Math.min(c + PAGE_SIZE, suggestions.length))
                    }
                    className="text-xs font-medium text-orange-600 hover:text-orange-700"
                  >
                    Show more ({suggestions.length - visibleCount} more)
                  </button>
                </li>
              )}
            </ul>
          )}

          {mode === "idealPostcodes" &&
            isOpen &&
            !isSearching &&
            debouncedQuery.trim().length >= 2 &&
            suggestions.length === 0 && (
              <div className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400 border border-gray-200 dark:border-gray-700 rounded-lg">
                No matches for "{debouncedQuery}". Did you mean to include the full postcode (e.g. MK9 1AA)?
              </div>
            )}

          <button
            type="button"
            onClick={() => setMode("manual")}
            className="text-xs font-medium text-gray-500 hover:text-orange-600 dark:text-gray-400 underline underline-offset-2"
          >
            Can't find your address? Enter it manually
          </button>
        </>
      )}

      {fallbackNotice && mode !== "idealPostcodes" && mode !== "manual" && (
        <p className="text-xs text-gray-500 dark:text-gray-400">{fallbackNotice}</p>
      )}

      {areaWarning && (
        <div className="flex items-start gap-2 text-sm text-red-700 dark:text-red-300 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg px-3 py-2">
          <AlertCircle size={16} className="mt-0.5 shrink-0" />
          <span>{areaWarning}</span>
        </div>
      )}

      {validation && (
        <div className="flex items-center text-red-500 text-sm">
          <AlertCircle size={16} className="mr-2" />
          {validation}
        </div>
      )}

      {pendingConfirm && (
        <ConfirmAddressModal
          address={pendingConfirm}
          onConfirm={confirmSelectedAddress}
          onEdit={editSelectedAddress}
          onCancel={closeConfirm}
        />
      )}
    </div>
  )
}

export default PostcodeFirstAutocomplete

/*
PROP CONTRACT (matches the old AddressAutocomplete so call sites need only
change their import):
  label            string   — field label, e.g. "Pickup Address"
  value            string?  — optional controlled display value
  postcode         string   — current postcode/search text (controlled)
  onPostcodeChange (text) => void
  onSelect         (address) => void
      address = {
        line1, line2, city, region, postal_code, country,
        latitude, longitude,      // null for unverified manual entries
        meta: { source: "ideal_postcodes" | "google" | "manual", confidence },
      }
  validation       string?  — external validation error to display
  disabled         boolean
  placeholder      string?
*/
