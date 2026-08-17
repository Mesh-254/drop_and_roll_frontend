/**
 * Turns the /api/driver/live-tracking/current-route/ response (as returned
 * by driverApi.getCurrentRoute(driverId)) into map points for the ADMIN
 * live-tracking view.
 *
 * This is deliberately the admin counterpart of
 * frontend/src/lib/route-points.js: that helper FILTERS OUT closed stops
 * because the driver's own map should only ever show what they still have
 * to do. The admin map needs the opposite — every stop the selected driver
 * has, closed or open, so it can colour completed stops green and remaining
 * stops red. Filtering happens on the DRIVER side (route-points.js); this
 * module intentionally keeps everything and just classifies it.
 */

import { TERMINAL_JOB_STATUSES } from "./route-points";

/**
 * @param {string} status - stop_status / status / job_status / delivery_status
 * @returns {"completed"|"remaining"} classification used for marker colour
 */
export function classifyStopStatus(status) {
  if (!status) return "remaining";
  return TERMINAL_JOB_STATUSES.has(String(status).toLowerCase()) ? "completed" : "remaining";
}

/**
 * @param {Array} bookings - entries from the admin current-route response.
 *   Route-backed entries carry stop_status/stop_address/job_number/leg
 *   (see driver/api_views.py DriverTrackingViewSet.current_route); direct
 *   (non-route) bookings carry only booking-level fields.
 * @returns {Array<{
 *   id: string, lat: number, lng: number, label: string, postcode: string,
 *   status: string, statusGroup: "completed"|"remaining", sequence: number,
 *   leg: string|null, bookingId: string|null,
 * }>} points, in the order the backend returned them (route sequence order
 *   for route-backed stops, creation order for direct bookings).
 */
export function buildAdminRoutePoints(bookings) {
  if (!Array.isArray(bookings)) return [];

  const points = [];
  bookings.forEach((stop, idx) => {
    const addr = stop.stop_address || stop.pickup_address || stop.dropoff_address || stop.address;
    const lat = addr?.latitude ?? addr?.lat ?? addr?.location?.lat ?? null;
    const lng = addr?.longitude ?? addr?.lng ?? addr?.location?.lng ?? null;
    if (lat == null || lng == null) return;

    const status = stop.stop_status ?? stop.status ?? stop.job_status ?? stop.delivery_status ?? null;
    const jobNumber = stop.job_number ?? null;

    points.push({
      id: stop.stop_id || stop.id || `${stop.booking_id || idx}-${idx}`,
      lat: Number(lat),
      lng: Number(lng),
      label: jobNumber != null ? `Job ${jobNumber}` : stop.job_number_display || `Stop ${idx + 1}`,
      postcode: addr?.postal_code || addr?.postal || "",
      status,
      statusGroup: classifyStopStatus(status),
      sequence: stop.route_position ?? idx + 1,
      leg: stop.leg ?? null,
      bookingId: stop.id ?? stop.booking_id ?? null,
    });
  });

  return points;
}

/** Rounds a coordinate to ~1.1m precision so stops at "the same address" group together
 * even with tiny floating-point/geocoder jitter. */
function coordKey(lat, lng) {
  return `${Number(lat).toFixed(5)},${Number(lng).toFixed(5)}`;
}

/**
 * Groups points that share (near-)identical coordinates — e.g. several bulk
 * jobs sharing one pickup address — into a single map marker entry, so the
 * map shows one pin with a count/label instead of stacked overlapping pins.
 *
 * @param {Array} points - output of buildAdminRoutePoints
 * @returns {Array<{
 *   lat: number, lng: number, points: Array, statusGroup: "completed"|"remaining"|"mixed",
 *   label: string, sequence: number,
 * }>}
 */
export function groupPointsByLocation(points) {
  if (!Array.isArray(points) || points.length === 0) return [];

  const groups = new Map();
  const order = [];

  points.forEach((p) => {
    const key = coordKey(p.lat, p.lng);
    if (!groups.has(key)) {
      groups.set(key, []);
      order.push(key);
    }
    groups.get(key).push(p);
  });

  return order.map((key) => {
    const groupPoints = groups.get(key).sort((a, b) => a.sequence - b.sequence);
    const first = groupPoints[0];
    const allCompleted = groupPoints.every((p) => p.statusGroup === "completed");
    const allRemaining = groupPoints.every((p) => p.statusGroup === "remaining");
    const statusGroup = allCompleted ? "completed" : allRemaining ? "remaining" : "mixed";

    return {
      lat: first.lat,
      lng: first.lng,
      points: groupPoints,
      statusGroup,
      label:
        groupPoints.length > 1
          ? `${groupPoints.length} stops`
          : first.label,
      sequence: Math.min(...groupPoints.map((p) => p.sequence)),
    };
  });
}