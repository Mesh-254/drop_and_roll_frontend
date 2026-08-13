"use client"

import { useEffect, useState, useRef } from "react"
import { Map as GoogleMap, AdvancedMarker, useMap, useMapsLibrary } from "@vis.gl/react-google-maps"
import { Loader2, AlertCircle } from "lucide-react"

const containerStyle = { width: "100%", height: "100%" }
const center = { lat: 51.9, lng: -1.0 } // Center between Milton Keynes and Oxford

// Custom component to render google.maps.Polyline
const GooglePolyline = ({ path, strokeColor = "#f97316", strokeOpacity = 0.7, strokeWeight = 3 }) => {
  const map = useMap()
  const polylineRef = useRef(null)

  useEffect(() => {
    if (!map || !path || path.length < 2) return

    // Create a new Google Maps Polyline
    polylineRef.current = new google.maps.Polyline({
      path,
      strokeColor,
      strokeOpacity,
      strokeWeight,
      map,
    })

    // Cleanup on unmount
    return () => {
      if (polylineRef.current) {
        polylineRef.current.setMap(null)
        polylineRef.current = null
      }
    }
  }, [map, path, strokeColor, strokeOpacity, strokeWeight])

  return null
}

const MapComponent = ({
  pickupAddress,
  dropoffAddress,
  isLoading = false,
  error = null,
  className = "w-full h-64 rounded-lg border border-border-strong",
}) => {
  const [mapLoadError, setMapLoadError] = useState(null)
  const [directions, setDirections] = useState(null)
  const [directionsRenderer, setDirectionsRenderer] = useState(null)
  const [path, setPath] = useState([])

  if (mapLoadError || error) {
    console.error("Google Maps load error:", mapLoadError || error)
    return (
      <div className={`${className} bg-destructive-surface flex items-center justify-center`}>
        <AlertCircle className="h-12 w-12 text-destructive mb-4" />
        <p className="text-destructive">{mapLoadError?.message || error || "Failed to load map"}</p>
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className={`${className} bg-muted dark:bg-surface flex items-center justify-center`}>
        <Loader2 className="h-12 w-12 text-brand-text animate-spin" />
      </div>
    )
  }

  return (
    <GoogleMap
      mapId="quote-map"
      style={containerStyle}
      className={className}
      defaultCenter={center}
      defaultZoom={8}
      disableDefaultUI={true}
      zoomControl={true}
      styles={[{ featureType: "poi", stylers: [{ visibility: "off" }] }]}
    >
      <MapContent
        pickupAddress={pickupAddress}
        dropoffAddress={dropoffAddress}
        setDirections={setDirections}
        setDirectionsRenderer={setDirectionsRenderer}
        directions={directions}
        directionsRenderer={directionsRenderer}
        path={path}
        setPath={setPath}
        setLoadError={setMapLoadError}
      />
    </GoogleMap>
  )
}

const MapContent = ({
  pickupAddress,
  dropoffAddress,
  setDirections,
  setDirectionsRenderer,
  directions,
  directionsRenderer,
  path,
  setPath,
  setLoadError,
}) => {
  const map = useMap()
  const routesLibrary = useMapsLibrary("routes")
  const markerLibrary = useMapsLibrary("marker")

  // Update path based on addresses
  useEffect(() => {
    const newPath = []
    if (pickupAddress?.latitude && pickupAddress?.longitude) {
      const lat = Number.parseFloat(pickupAddress.latitude)
      const lng = Number.parseFloat(pickupAddress.longitude)
      // Restrict to Milton Keynes/Oxford bounds (lat: 51.65 to 52.1, lng: -1.35 to -0.65)
      if (lat >= 51.65 && lat <= 52.1 && lng >= -1.35 && lng <= -0.65) {
        newPath.push({ lat, lng })
      }
    }
    if (dropoffAddress?.latitude && dropoffAddress?.longitude) {
      const lat = Number.parseFloat(dropoffAddress.latitude)
      const lng = Number.parseFloat(dropoffAddress.longitude)
      if (lat >= 51.65 && lat <= 52.1 && lng >= -1.35 && lng <= -0.65) {
        newPath.push({ lat, lng })
      }
    }
    setPath(newPath)
  }, [pickupAddress, dropoffAddress, setPath])

  // Initialize DirectionsRenderer
  useEffect(() => {
    if (!routesLibrary || !map) return

    const renderer = new routesLibrary.DirectionsRenderer({
      polylineOptions: {
        strokeColor: "#f97316",
        strokeOpacity: 0.7,
        strokeWeight: 3,
      },
    })
    renderer.setMap(map)
    setDirectionsRenderer(renderer)

    return () => {
      renderer.setMap(null)
    }
  }, [routesLibrary, map, setDirectionsRenderer])

  // Fetch directions and fit bounds
  useEffect(() => {
    if (!map || !routesLibrary || path.length !== 2) return

    try {
      const bounds = new google.maps.LatLngBounds()
      path.forEach((coord) => bounds.extend(coord))
      map.fitBounds(bounds, 50)

      const directionsService = new routesLibrary.DirectionsService()
      directionsService.route(
        {
          origin: path[0],
          destination: path[1],
          travelMode: google.maps.TravelMode.DRIVING,
        },
        (result, status) => {
          if (status === google.maps.DirectionsStatus.OK) {
            setDirections(result)
          } else {
            console.error("Directions request failed:", status, result)
            setDirections(null)
          }
        }
      )
    } catch (err) {
      setLoadError(err)
    }
  }, [map, path, routesLibrary, setDirections, setLoadError])

  // Update directions on the renderer
  useEffect(() => {
    if (!directionsRenderer || !directions) return
    directionsRenderer.setDirections(directions)
  }, [directionsRenderer, directions])

  const pickupPosition = pickupAddress?.latitude
    ? { lat: parseFloat(pickupAddress.latitude), lng: parseFloat(pickupAddress.longitude) }
    : null

  const dropoffPosition = dropoffAddress?.latitude
    ? { lat: parseFloat(dropoffAddress.latitude), lng: parseFloat(dropoffAddress.longitude) }
    : null

  return (
    <>
      {pickupPosition && pickupPosition.lat >= 51.65 && pickupPosition.lat <= 52.1 && pickupPosition.lng >= -1.35 && pickupPosition.lng <= -0.65 && (
        <AdvancedMarker position={pickupPosition} title="Pickup">
          <div style={{ transform: "translate(-50%, -100%)", textAlign: "center" }}>
            <span style={{ fontSize: "32px", color: "green" }}>🚚</span>
            <div style={{
              position: "absolute",
              left: "50%",
              transform: "translate(-50%, -10px)",
              background: "black",
              padding: "2px 6px",
              borderRadius: "4px",
              boxShadow: "0 2px 4px rgba(0,0,0,0.2)",
              whiteSpace: "nowrap",
              fontSize: "12px",
              fontWeight: "bold"
            }}>
              Pickup
            </div>
          </div>
        </AdvancedMarker>
      )}
      {dropoffPosition && dropoffPosition.lat >= 51.65 && dropoffPosition.lat <= 52.1 && dropoffPosition.lng >= -1.35 && dropoffPosition.lng <= -0.65 && (
        <AdvancedMarker position={dropoffPosition} title="Dropoff">
          <div style={{ transform: "translate(-50%, -100%)", textAlign: "center" }}>
            <span style={{ fontSize: "32px", color: "red" }}>🏠</span>
            <div style={{
              position: "absolute",
              left: "50%",
              transform: "translate(-50%, -10px)",
              background: "black",
              padding: "2px 6px",
              borderRadius: "4px",
              boxShadow: "0 2px 4px rgba(0,0,0,0.2)",
              whiteSpace: "nowrap",
              fontSize: "12px",
              fontWeight: "bold"
            }}>
              Dropoff
            </div>
          </div>
        </AdvancedMarker>
      )}
      {!directions && path.length === 2 && (
        <GooglePolyline
          path={path}
          strokeColor="#f97316"
          strokeOpacity={0.7}
          strokeWeight={3}
        />
      )}
    </>
  )
}

export default MapComponent