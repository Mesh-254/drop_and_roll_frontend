// Single source of truth for vehicle emoji/colour, shared between the admin
// live-tracking driver list and the Leaflet map markers so the two never
// drift out of sync with each other.
export const VEHICLE_ICONS = {
  bike: "🏍️",
  car: "🚗",
  van: "🚐",
  truck: "🚚",
};

export const VEHICLE_COLORS = {
  bike: "#FF6B6B",
  car: "#4ECDC4",
  van: "#45B7D1",
  truck: "#FFA07A",
};

export function vehicleIcon(vehicleType) {
  return VEHICLE_ICONS[vehicleType] || "📍";
}

export function vehicleColor(vehicleType) {
  return VEHICLE_COLORS[vehicleType] || "#4ECDC4";
}