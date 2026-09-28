/**
 * Single source of truth for turning job/stop payloads into Route Overview
 * map points.
 *
 * The dashboard builds `routePoints` from every page of the driver's
 * current-route jobs, both on mount and on the 60s refresh. This helper keeps
 * the map limited to the same remaining stops shown in the My Jobs list.
 */

// Statuses that mean a stop is done and should never appear on the map.
// Two different vocabularies feed this: Booking.status (BookingStatus in
// bookings/models.py — assigned/picked_up/in_transit/delivered/cancelled/
// failed/refunded/...) and RouteStop.status (StopStatus — pending/arrived/
// completed/failed/skipped/removed). A stop-level payload can carry either
// depending on which endpoint produced it, so both closed sets are covered
// here rather than just one.
export const TERMINAL_JOB_STATUSES = new Set([
  // Booking-level (BookingStatus)
  "delivered",
  "cancelled",
  "refunded",
  "expired",
  // Stop-level (StopStatus)
  "completed",
  "skipped",
  "removed",
  // Shared
  "failed",
]);

export function isRemainingJob(status) {
  if (!status) return true; // unknown status: don't hide it, backend should already exclude it
  return !TERMINAL_JOB_STATUSES.has(String(status).toLowerCase());
}

/**
 * @param {Array} stops - job/booking/stop objects. Accepts the shapes
 *   returned by both getAssignedJobs (job_number, stop_address) and
 *   getCurrentRoute (route.stops / bookings, possibly nested address).
 * @returns {Array<{lat:number,lng:number,label:string,postcode:string}>}
 */
export function buildRoutePoints(stops) {
  if (!Array.isArray(stops)) return [];

  const points = [];
  stops.forEach((stop, idx) => {
    // `stop_status` is what /driver-routes/current-route/ actually sends
    // (see driver/api_views.py DriverRouteViewSet.current_route — it's
    // injected from the RouteStop row, not the Booking). `status`/`job_status`/
    // `delivery_status` are kept as fallbacks for other stop-shaped payloads,
    // but stop_status must be checked first: a Booking's own top-level
    // `status` (e.g. "in_transit") stays non-terminal even after its pickup
    // leg is closed, so checking that field alone would never filter out a
    // completed pickup stop on a still-open same-day booking.
    const status = stop.stop_status ?? stop.status ?? stop.job_status ?? stop.delivery_status;
    if (!isRemainingJob(status)) return; // exclude completed/cancelled/failed stops

    const addr =
      stop.stop_address || stop.pickup_address || stop.dropoff_address || stop.address || stop;
    const lat = addr?.latitude ?? addr?.lat ?? addr?.location?.lat ?? null;
    const lng = addr?.longitude ?? addr?.lng ?? addr?.location?.lng ?? null;
    if (
      lat == null ||
      lng == null ||
      (typeof lat === "string" && !lat.trim()) ||
      (typeof lng === "string" && !lng.trim())
    ) return;

    const latitude = Number(lat);
    const longitude = Number(lng);
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return;

    points.push({
      lat: latitude,
      lng: longitude,
      label: stop.job_number || stop.name || `Stop ${idx + 1}`,
      postcode: addr?.postal_code || addr?.postal || "",
      status,
    });
  });

  return points;
}