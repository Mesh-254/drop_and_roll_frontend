/**
 * utils/timeRemaining.js
 * Deterministic countdown formatting for payment-expiry displays.
 * Pure function — inject `nowMs` for exact assertions in tests.
 */

/** "2d 4h left" / "3h 12m left" / "25m left" / "under a minute left" / "expired". */
export function formatTimeRemaining(expiresAtIso, nowMs = Date.now()) {
  if (!expiresAtIso) return null;
  const diffMs = new Date(expiresAtIso).getTime() - nowMs;
  if (Number.isNaN(diffMs) || diffMs <= 0) return "expired";
  const totalMinutes = Math.floor(diffMs / 60000);
  if (totalMinutes < 1) return "under a minute left";
  const days = Math.floor(totalMinutes / 1440);
  const hours = Math.floor((totalMinutes % 1440) / 60);
  const minutes = totalMinutes % 60;
  if (days > 0) return `${days}d ${hours}h left`;
  if (hours > 0) return `${hours}h ${minutes}m left`;
  return `${minutes}m left`;
}
