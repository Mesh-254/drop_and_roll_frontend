/* eslint-env jest */
// Verifies the quote breakdown renders the DATA-DRIVEN pricing engine's
// breakdown (bookings/utils/pricing.py):
//   • no "Service Adjustment" row — service type has zero effect on price
//     by client requirement, so the UI must not imply otherwise;
//   • the distance row uses the miles-based keys the backend actually emits
//     (extra_distance_miles / free_miles), not the removed extra_distance_km;
//   • base price, parcel fee, insurance and total render from the breakdown.

import { render, screen } from "@testing-library/react";

// GetQuoteBook pulls in the whole booking flow (maps, router, auth, PDF).
// The breakdown component under test needs none of it — mock the heavy deps.
jest.mock("react-router-dom", () => ({ useNavigate: () => jest.fn() }));
jest.mock("../../api/BookingApi", () => ({ bookingApi: {} }));
jest.mock("jspdf", () => jest.fn());
jest.mock("../../contexts/AuthContext", () => ({ useAuth: () => ({ isAuthenticated: false, user: null }) }));
jest.mock("../map/MapComponent", () => () => null);
jest.mock("../map/PostcodeFirstAutocomplete", () => () => null);
jest.mock("@vis.gl/react-google-maps", () => ({ APIProvider: ({ children }) => children }));
jest.mock("framer-motion", () => ({
  __esModule: true,
  motion: new Proxy({}, { get: () => (props) => props.children ?? null }),
  AnimatePresence: ({ children }) => children,
}));

import { QuoteDisplay } from "./GetQuoteBook";

const quote = {
  meta: {
    tier: "5-10kg",
    base_price: 12.0,
    extra_parcels: 2,
    extra_parcel_charge_per: 4.0,
    extra_parcel_fee: 8.0,
    extra_distance_miles: 37.1,
    free_miles: 25,
    extra_distance_charge: 29.71,
    insurance_fee: 2.0,
    total_before_discount: 51.71,
    discount: 0,
    final_price: 51.71,
    service_type: "Express",
  },
};

describe("QuoteDisplay breakdown", () => {
  it("renders the pricing-engine breakdown rows", () => {
    render(<QuoteDisplay quote={quote} onDownloadPDF={jest.fn()} isLoading={false} formData={{}} />);

    expect(screen.getByText("Base Price")).toBeInTheDocument();
    expect(screen.getByText("£12.00")).toBeInTheDocument();
    expect(screen.getByText(/Extra Parcels \(2 × £4\.00\)/)).toBeInTheDocument();
    expect(screen.getByText("£8.00")).toBeInTheDocument();
    expect(screen.getByText(/37\.1 miles beyond 25 free/)).toBeInTheDocument();
    expect(screen.getByText("£29.71")).toBeInTheDocument();
    expect(screen.getByText("Insurance Fee")).toBeInTheDocument();
    expect(screen.getAllByText("£51.71").length).toBeGreaterThan(0);
  });

  it("never renders a service adjustment row — service type has no price effect", () => {
    render(<QuoteDisplay quote={quote} onDownloadPDF={jest.fn()} isLoading={false} formData={{}} />);
    expect(screen.queryByText(/Service Adjustment/)).not.toBeInTheDocument();
  });

  it("hides the distance row when the trip is inside the free miles", () => {
    const shortTrip = { meta: { ...quote.meta, extra_distance_miles: 0, extra_distance_charge: 0 } };
    render(<QuoteDisplay quote={shortTrip} onDownloadPDF={jest.fn()} isLoading={false} formData={{}} />);
    expect(screen.queryByText(/miles beyond/)).not.toBeInTheDocument();
  });
});
