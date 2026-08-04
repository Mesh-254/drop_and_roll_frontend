/**
 * In-app bus for driver events that arrive on the WebSocket.
 *
 * WHY A BUS AND NOT A PROP
 * ------------------------
 * The socket is owned by DriverDashboard — it is per-driver, it has to survive
 * tab switches, and it carries tracking toggles that only the dashboard acts
 * on. The job list is a child that renders on one tab. Passing a live message
 * down as a prop means the dashboard re-renders on every message, and every
 * re-render there recreates the callbacks the list depends on, which is exactly
 * the churn that made the list reset itself.
 *
 * So the socket publishes here and the list subscribes. One writer, any number
 * of readers, no re-render of anything in between.
 *
 * This is a notification, not a data channel. A message says "booking X is now
 * Y"; whoever cares re-reads the real endpoint. Putting job payloads on here
 * would make it a second, thinner copy of the list API, and the two would drift.
 */

const bus = new EventTarget();

export const JOB_STATUS_EVENT = "dnr:job-status";

/**
 * Announce that a booking changed status.
 *
 * Called from the WS handler and ALSO straight after a local action (a QR scan,
 * a status tap). The local call is not redundant: it is the floor. If the socket
 * is down, mid-reconnect, or the broadcast never went out, the driver still sees
 * their own action land immediately instead of waiting for the slow poll.
 *
 * @param {{booking_id: string, status: string, from_status?: string,
 *          tracking_number?: string, reason?: string}} detail
 */
export function publishJobStatus(detail) {
  bus.dispatchEvent(new CustomEvent(JOB_STATUS_EVENT, { detail }));
}

/**
 * Subscribe to job status changes. Returns the unsubscribe function, so a
 * caller can hand it straight back from a useEffect.
 */
export function subscribeJobStatus(handler) {
  const listener = (event) => handler(event.detail);
  bus.addEventListener(JOB_STATUS_EVENT, listener);
  return () => bus.removeEventListener(JOB_STATUS_EVENT, listener);
}
