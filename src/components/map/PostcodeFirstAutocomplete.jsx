"use client"
/**
 * components/map/PostcodeFirstAutocomplete.jsx
 * ════════════════════════════════════════════════════════════════════════
 * Postcode-first UK address selection with a graceful two-tier fallback.
 *
 *   Ideal Postcodes (primary)  →  Google Places (fallback)
 *
 * There is deliberately NO free-text manual-entry path: every address must
 * come from a real lookup (Ideal or Google) so we always have a verified,
 * geocoded premise and can enforce the Milton Keynes / Oxford service area
 * before the user proceeds. If both services are unavailable the user is asked
 * to retry rather than typing an unverifiable address.
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
 *      postcode-like, we fall back to Google's PlaceAutocompleteElement
 *      (postcode-only via includedPrimaryTypes, biased to the MK/OX area).
 *      The legacy places.Autocomplete widget is gone — deprecated by Google
 *      and unavailable to new billing accounts since March 2025.
 *   6. Every selected address — Ideal OR Google — is checked against the
 *      Milton Keynes / Oxford service area BEFORE it can be confirmed. An
 *      out-of-area address shows a red banner, disables the confirm button,
 *      and is never handed to onSelect, so the parent step stays blocked.
 *
 * Both paths funnel through the same onSelect(address) contract, tagging
 * `address.meta = { source: "ideal_postcodes" | "google" }` so the backend
 * can record provenance (Address.source / Address.meta).
 */

import { useRef, useState, useEffect, useCallback, useId } from "react"
import { useMapsLibrary } from "@vis.gl/react-google-maps"
import { AlertCircle, Loader2, MapPin, CheckCircle2, ChevronDown } from "lucide-react"
import { bookingApi } from "../../api/BookingApi"
import { isPostcodeQuery, formatPostcode } from "../../utils/ukPostcode"

const DEBOUNCE_MS = 300
const PAGE_SIZE = 20 // rendered per "page" in the dropdown — see file header

// Feature flag: default TRUE. Set VITE_USE_IDEAL_POSTCODES_PRIMARY=false to
// force Google-first (e.g. temporarily, if Ideal Postcodes has an outage
// affecting the whole fleet rather than just one request).
const USE_IDEAL_POSTCODES_PRIMARY =
  (import.meta.env.VITE_USE_IDEAL_POSTCODES_PRIMARY ?? "true") !== "false"

// Human labels for the provenance badge in the confirmation modal.
const SOURCE_LABELS = {
  ideal_postcodes: "Ideal Postcodes",
  google: "Google Places",
  manual: "Manual",
}

function useDebouncedValue(value, delayMs) {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const handle = setTimeout(() => setDebounced(value), delayMs)
    return () => clearTimeout(handle)
  }, [value, delayMs])
  return debounced
}

/** Confirmation modal — "Is this correct?"
 *  `pending` = { address, inServiceArea, areaMessage }. When the address is
 *  outside the Milton Keynes / Oxford service area the confirm button is
 *  disabled and a red banner explains why, so an out-of-area address can never
 *  be handed back to the parent.
 *
 *  Shows the full premise detail (line 1/2/3, organisation, town, county,
 *  postcode) plus a provenance badge (Ideal Postcodes / Google Places).
 *  Google's search is postcode-only (types: ['postal_code']), so a
 *  Google-sourced selection has a verified, geocoded postcode but no
 *  premise line — the modal asks for "Address line 1" before confirming.
 *  This is NOT free-text manual entry: postcode, town and coordinates all
 *  come from the verified lookup; only the premise line is typed. */
function ConfirmAddressModal({ pending, onConfirm, onCancel }) {
  const { address, inServiceArea, areaMessage } = pending
  const detail = address.detail || {}
  const needsLine1 = !address.line1
  const [line1Draft, setLine1Draft] = useState("")
  const line1Ok = !needsLine1 || line1Draft.trim().length > 0
  const sourceLabel = SOURCE_LABELS[address.meta?.source] || SOURCE_LABELS.manual

  const handleConfirm = () => {
    if (!inServiceArea || !line1Ok) return
    onConfirm(needsLine1 ? { ...address, line1: line1Draft.trim() } : address)
  }

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
          className="text-lg font-semibold text-gray-900 dark:text-white mb-3 flex items-center justify-between gap-2"
        >
          <span className="flex items-center gap-2">
            <MapPin className="h-5 w-5 text-orange-500" />
            Is this correct?
          </span>
          <span
            data-testid="address-source-badge"
            className="text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300"
          >
            {sourceLabel}
          </span>
        </h3>
        <div className="rounded-lg bg-gray-50 dark:bg-gray-900 p-3 text-sm text-gray-700 dark:text-gray-300 mb-4">
          {detail.organisation_name && <p className="font-medium">{detail.organisation_name}</p>}
          {needsLine1 ? (
            <div className="mb-2">
              <label
                htmlFor="confirm-address-line1"
                className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1"
              >
                Address line 1 (house number and street) *
              </label>
              <input
                id="confirm-address-line1"
                type="text"
                value={line1Draft}
                onChange={(e) => setLine1Draft(e.target.value)}
                placeholder="e.g. 12 Midsummer Boulevard"
                autoFocus
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-orange-500"
              />
            </div>
          ) : (
            <p className="font-medium">{address.line1}</p>
          )}
          {detail.line_2 ? <p>{detail.line_2}</p> : address.line2 && <p>{address.line2}</p>}
          {detail.line_3 && <p>{detail.line_3}</p>}
          <p>
            {address.city}
            {address.region ? `, ${address.region}` : ""}
          </p>
          <p className="font-medium">{formatPostcode(address.postal_code)}</p>
        </div>

        {!inServiceArea && (
          <div
            role="alert"
            className="flex items-start gap-2 text-sm text-red-700 dark:text-red-300 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg px-3 py-2 mb-4"
          >
            <AlertCircle size={16} className="mt-0.5 shrink-0" />
            <span>
              {areaMessage ||
                "Sorry, we currently only operate in Milton Keynes and Oxford. Please enter a postcode from these areas."}
            </span>
          </div>
        )}

        <div className="flex gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 text-sm font-medium transition-colors"
          >
            {inServiceArea ? "Cancel" : "Choose another"}
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            autoFocus={inServiceArea && !needsLine1}
            disabled={!inServiceArea || !line1Ok}
            className="flex-1 flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg bg-orange-500 hover:bg-orange-600 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-medium transition-colors"
          >
            <CheckCircle2 className="h-4 w-4" />
            Yes, that's right
          </button>
        </div>
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

  // "idealPostcodes" | "google" — which source is currently driving the
  // dropdown / input behaviour. (No manual mode: all addresses come from a
  // verified lookup so we can enforce the service area.)
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
  // POSTCODE-ONLY (spec §A): the query must match a progressive UK postcode
  // shape before we call the backend proxy. Free-text/name queries never
  // leave the browser — the metered Ideal Postcodes quota is only spent on
  // queries that can actually resolve to a postcode. The backend applies
  // the same gate server-side as a backstop.
  const trimmedQuery = debouncedQuery.trim()
  const queryIsPostcode = isPostcodeQuery(trimmedQuery)

  useEffect(() => {
    if (mode !== "idealPostcodes") return
    if (trimmedQuery.length < 2 || !queryIsPostcode) {
      setSuggestions([])
      setIsOpen(false)
      return
    }

    const thisRequestId = ++requestIdRef.current
    setIsSearching(true)

    bookingApi.autocompleteAddress(trimmedQuery).then((res) => {
      if (thisRequestId !== requestIdRef.current) return // stale response, ignore
      setIsSearching(false)

      if (res.success) {
        const hits = res.results || []
        setSuggestions(hits)
        setVisibleCount(PAGE_SIZE)
        setHighlightedIndex(-1)
        setIsOpen(true)

        if (hits.length === 0) {
          // A postcode-shaped query that Ideal Postcodes can't match might
          // be a typo Google's fuzzier matching can rescue.
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
  }, [trimmedQuery, queryIsPostcode, mode])

  // ── Google Places fallback (PlaceAutocompleteElement) ──────────────────
  // MIGRATION (spec §C): google.maps.places.Autocomplete is unavailable to
  // new customers since March 2025 and only receives regression fixes. The
  // replacement, PlaceAutocompleteElement, is a self-contained custom
  // element (its own input + dropdown) mounted into googleContainerRef —
  // our text input is hidden while it's active. Its event model also
  // differs: selection fires "gmp-select" (older builds: "gmp-placeselect")
  // with a Place that must be hydrated via an explicit fetchFields() call,
  // and its addressComponents use camelCase longText/shortText instead of
  // long_name/short_name — normalizeGooglePlace handles both shapes.
  const places = useMapsLibrary("places")
  const googleContainerRef = useRef(null)

  /** Convert a (fetched) Place into our shared address shape. Exported for
   *  tests via PostcodeFirstAutocomplete.normalizeGooglePlace. */
  const handleGooglePlace = useCallback((place) => {
    const lat =
      typeof place.location?.lat === "function" ? place.location.lat() : place.location?.lat
    const lng =
      typeof place.location?.lng === "function" ? place.location.lng() : place.location?.lng
    if (lat === undefined || lat === null || lng === undefined || lng === null) return

    const components = (place.addressComponents || []).reduce((acc, comp) => {
      const type = comp.types?.[0]
      const long = comp.longText ?? comp.long_name
      const short = comp.shortText ?? comp.short_name
      if (type === "street_number") acc.street_number = long
      if (type === "route") acc.route = long
      if (type === "locality") acc.city = long
      if (type === "postal_town") acc.city = acc.city || long
      if (type === "administrative_area_level_2") acc.county = long
      if (type === "administrative_area_level_1") acc.region = long
      if (type === "postal_code") acc.postal_code = long
      if (type === "country") acc.country = short
      if (type === "sublocality" || type === "neighborhood") acc.line2 = long
      if (!acc.city && type === "administrative_area_level_2") acc.city = long
      return acc
    }, {})

    const address = {
      // A postal_code place has no street/premise — line1 stays empty and
      // the confirmation modal collects it before allowing confirm.
      line1: `${components.street_number || ""} ${components.route || ""}`.trim(),
      line2: components.line2 || "",
      city: components.city || "",
      region: components.county || components.region || "",
      postal_code: components.postal_code || place.displayName || "",
      country: components.country || "GB",
      latitude: lat,
      longitude: lng,
      detail: {
        post_town: components.city || "",
        county: components.county || "",
      },
      meta: { source: "google", confidence: 0.8 },
    }

    // Google's suggestions are only *biased* to MK/OX, so out-of-area picks
    // are possible. Enforce the service area exactly like the Ideal path —
    // the client mirror of the backend's authoritative two-tier check.
    const check = bookingApi.validateAddressInServiceArea(address)
    setAreaWarning(check.valid ? null : check.message)
    setPendingConfirm({
      address,
      inServiceArea: check.valid,
      areaMessage: check.valid ? null : check.message,
    })
    setIsOpen(false)
  }, [])

  useEffect(() => {
    if (mode !== "google" || !places || !googleContainerRef.current) return

    // PlaceAutocompleteElement may be absent on old Maps JS versions —
    // there is no legacy fallback anymore (Autocomplete is deprecated and
    // unavailable to new billing accounts), so surface a retry instead.
    if (!places.PlaceAutocompleteElement) {
      setFallbackNotice("Address search is temporarily unavailable. Please try again shortly.")
      return
    }

    const element = new places.PlaceAutocompleteElement({
      // POSTCODE-ONLY (spec §A): the new API's equivalent of types:
      // ['postal_code'] — venue/business/name matches can't appear.
      includedPrimaryTypes: ["postal_code"],
      includedRegionCodes: ["gb"],
      // Bias (not restrict) to the MK/OX service corridor — the service-area
      // check above does the real enforcement.
      locationBias: { west: -1.35, south: 51.65, east: -0.65, north: 52.1 },
    })
    element.style.width = "100%"
    googleContainerRef.current.appendChild(element)

    const onSelect = async (event) => {
      try {
        // gmp-select delivers a PlacePrediction; the older gmp-placeselect
        // delivered event.place directly. Support both.
        const place = event.placePrediction ? event.placePrediction.toPlace() : event.place
        if (!place) return
        // The new API returns a skeletal Place — fields must be requested
        // explicitly (this is the metered "details" call, fired only on
        // selection, never per keystroke).
        await place.fetchFields({
          fields: ["addressComponents", "location", "displayName", "formattedAddress"],
        })
        handleGooglePlace(place)
      } catch (err) {
        console.error("[PostcodeFirstAutocomplete] Google place fetch failed:", err)
        setFallbackNotice("Couldn't load that address's details. Please try another postcode.")
      }
    }

    element.addEventListener("gmp-select", onSelect)
    element.addEventListener("gmp-placeselect", onSelect)

    return () => {
      element.removeEventListener("gmp-select", onSelect)
      element.removeEventListener("gmp-placeselect", onSelect)
      element.remove()
    }
  }, [places, mode, handleGooglePlace])

  // ── Selecting an Ideal Postcodes suggestion ───────────────────────────
  // Resolving a suggestion is the PAID Ideal Postcodes call (autocomplete
  // itself is free) — so it fires only on explicit selection, and a
  // suggestion the user already resolved this session is served from this
  // cache instead of decrementing the paid lookup balance again (e.g. user
  // picks an address, cancels the confirm modal, then re-picks it).
  const resolvedCacheRef = useRef(new Map())

  const handleSelectSuggestion = useCallback(async (hit) => {
    setIsOpen(false)
    // The id is used EXACTLY as Ideal Postcodes returned it (e.g.
    // "paf_15068916") — the backend resolve endpoint requires it verbatim.
    const addressId = hit.id ?? hit.udprn ?? hit.relative_url

    let res = resolvedCacheRef.current.get(addressId)
    if (!res) {
      setIsSearching(true)
      res = await bookingApi.getPostcodeAddressDetails(addressId)
      setIsSearching(false)
      if (res.success) {
        resolvedCacheRef.current.set(addressId, res)
      }
    }

    if (!res.success) {
      setFallbackNotice("Couldn't load that address's details. Switching to Google Maps.")
      setMode("google")
      return
    }

    const inArea = res.in_service_area !== false
    setAreaWarning(inArea ? null : res.service_area_message)
    setPendingConfirm({
      address: res.address,
      inServiceArea: inArea,
      areaMessage: inArea ? null : res.service_area_message,
    })
  }, [])

  const closeConfirm = () => setPendingConfirm(null)

  // Confirm hands the address to the parent — but only for in-area addresses.
  // Out-of-area selections keep the confirm button disabled (see
  // ConfirmAddressModal), so onSelect never fires and the step stays blocked.
  // The modal passes back the final address (with the typed premise line for
  // Google-sourced postcode picks). `detail` is display-only — strip it so
  // the parent gets exactly the Address-model shape.
  const confirmSelectedAddress = (finalAddress) => {
    if (!pendingConfirm || !pendingConfirm.inServiceArea || !finalAddress?.line1) return
    const { detail: _display, ...address } = finalAddress
    if (typeof onSelect === "function") onSelect(address)
    if (typeof onPostcodeChange === "function" && address.postal_code) {
      onPostcodeChange(address.postal_code)
    }
    setQuery(formatPostcode(address.postal_code) || address.line1 || "")
    setAreaWarning(null)
    setPendingConfirm(null)
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

      {/* Google fallback mount point — PlaceAutocompleteElement brings its own
          input + dropdown, so our text input hides while it's active. The
          container must always be in the DOM (the effect appends into it). */}
      <div
        ref={googleContainerRef}
        data-testid="google-autocomplete-container"
        className={mode === "google" ? "block" : "hidden"}
      />

      <div className={mode === "google" ? "hidden" : "relative"}>
        <input
          id={inputId}
          ref={inputRef}
          type="text"
          role="combobox"
          aria-expanded={isOpen}
          aria-controls={listboxId}
          aria-autocomplete="list"
          aria-invalid={!!areaWarning || !!validation}
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
          placeholder={placeholder || `Enter a postcode (e.g. MK9 1AA)`}
          className={`w-full px-4 py-3 pr-10 border rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-colors disabled:opacity-50 ${
            areaWarning || validation
              ? "border-red-500"
              : "border-gray-300 dark:border-gray-600"
          }`}
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
            queryIsPostcode &&
            suggestions.length === 0 && (
              <div className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400 border border-gray-200 dark:border-gray-700 rounded-lg">
                No matches for "{debouncedQuery}". Did you mean to include the full postcode (e.g. MK9 1AA)?
              </div>
            )}

          {/* Postcode-only search: tell the user why free text gets no results
              instead of silently doing nothing. */}
          {mode === "idealPostcodes" &&
            !isSearching &&
            trimmedQuery.length >= 2 &&
            !queryIsPostcode && (
              <div className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400 border border-gray-200 dark:border-gray-700 rounded-lg">
                Address search works by postcode only — start typing a UK postcode (e.g. MK9 1AA
                or OX1 2JD).
              </div>
            )}

      {fallbackNotice && mode !== "idealPostcodes" && (
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
          pending={pendingConfirm}
          onConfirm={confirmSelectedAddress}
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
        latitude, longitude,      // always present — every address is geocoded
        meta: { source: "ideal_postcodes" | "google", confidence },
      }
  validation       string?  — external validation error to display
  disabled         boolean
  placeholder      string?
*/
