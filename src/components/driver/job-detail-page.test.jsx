/**
 * Gate tests for the job detail page.
 *
 * WHAT THIS PAGE IS FOR
 * ---------------------
 * The card answers "what do I do at this door" and shows six fields. This page
 * answers "what is this shipment" and shows everything the card left out. So
 * the assertions run in both directions: the detail fields must be HERE, and
 * both ends of the route must be here even though the card shows one.
 *
 * THE LEG COMES FROM THE STOP
 * ---------------------------
 * `/api/booking/bookings/<id>/` returns a BOOKING. A same-day booking is one
 * booking row and two jobs at two different doors, so the detail response alone
 * cannot say which one the driver tapped. The list already resolved it and
 * hands it down as `stopContext` — re-deriving it here from the booking's
 * status is exactly the guess that used to send same-day parcels to the hub.
 */

import { render, screen, waitFor, within } from "@testing-library/react";

jest.mock("react-hot-toast", () => ({
  toast: Object.assign(jest.fn(), {
    success: jest.fn(),
    error: jest.fn(),
    loading: jest.fn(),
    dismiss: jest.fn(),
  }),
}));

const mockGetJob = jest.fn();
jest.mock("../../api/driver-api", () => ({
  driverApi: {
    getJob: (...a) => mockGetJob(...a),
    checkImmutable: jest.fn(() => Promise.resolve({ success: true, immutable: false })),
    getProofOfDelivery: jest.fn(() => Promise.resolve({ success: false })),
    getCurrentLocation: jest.fn(() => Promise.resolve(null)),
    updateJobStatus: jest.fn(),
    submitProofOfDelivery: jest.fn(),
    scanQr: jest.fn(),
  },
}));

jest.mock("./proof-of-delivery", () => ({ ProofOfDelivery: () => null }));
jest.mock("./QRScannerModal", () => ({ QRScannerModal: () => null }));
jest.mock("./FailureReportModal", () => ({ FailureReportModal: () => null }));

import { JobDetailPage } from "./job-detail-page";

const BOOKING = {
  id: "booking-1",
  tracking_number: "BK-J7OCUNIJ",
  status: "assigned",
  notes: "Leave with the neighbour if out",
  routing_note: "Access via the rear gate",
  scheduled_pickup_at: "2026-08-05T09:00:00Z",
  scheduled_dropoff_at: "2026-08-05T17:00:00Z",
  customer: { id: "cust-1", name: "Sam Sender", phone: "+447700900999" },
  receiver_name: "Rita Receiver",
  receiver_phone: "+447700900123",
  receiver_email: "rita@example.com",
  pickup_address: { line1: "12 Elm St", city: "Milton Keynes", postal_code: "MK9 1AA" },
  dropoff_address: { line1: "8 Oak Rd", city: "Oxford", postal_code: "OX1 2BB" },
  quote: {
    num_parcels: 3,
    weight_kg: 7.5,
    dimensions: [{ dimensions: { length: 30, width: 20, height: 10 } }],
    fragile: true,
    service_type: { name: "Same Day", routing_bucket: "same_day" },
    shipping_type: { name: "Parcel" },
  },
};

beforeEach(() => {
  jest.clearAllMocks();
  mockGetJob.mockResolvedValue({ success: true, data: BOOKING });
});

async function renderDetail(stopContext = null) {
  render(<JobDetailPage jobId="booking-1" onBack={() => {}} stopContext={stopContext} />);
  // getAllByText: the tracking number appears twice on purpose — as the header
  // subtitle, and as a copyable reference in the shipment grid.
  await waitFor(() => expect(screen.getAllByText("BK-J7OCUNIJ").length).toBeGreaterThan(0));
}

describe("both ends of the route", () => {
  test("shows the collection AND the delivery address", async () => {
    // The card deliberately shows one. This page is where a driver answers
    // "where is this parcel going after I hand it over".
    await renderDetail();

    expect(screen.getByText("MK9 1AA")).toBeInTheDocument();
    expect(screen.getByText("OX1 2BB")).toBeInTheDocument();
    expect(screen.getByText(/12 Elm St/)).toBeInTheDocument();
    expect(screen.getByText(/8 Oak Rd/)).toBeInTheDocument();
  });

  test("shows the contact at each end", async () => {
    await renderDetail();

    expect(screen.getByText("Sam Sender")).toBeInTheDocument();
    expect(screen.getByText("Rita Receiver")).toBeInTheDocument();
  });

  test("both phones are tap-to-call", async () => {
    await renderDetail();

    expect(screen.getByRole("link", { name: /\+447700900999/ })).toHaveAttribute(
      "href",
      "tel:+447700900999"
    );
    expect(screen.getByRole("link", { name: /\+447700900123/ })).toHaveAttribute(
      "href",
      "tel:+447700900123"
    );
  });

  test("marks the collection as the current stop when that is the leg tapped", async () => {
    await renderDetail({ stop_leg: "pickup", job_number: 4, next_status: "picked_up" });

    const here = screen.getByText("You are here").closest("div").parentElement;
    expect(within(here).getByText("MK9 1AA")).toBeInTheDocument();
  });

  test("marks the delivery as the current stop for the other half of the pair", async () => {
    // Same booking, same status, different stop. Only `stopContext` differs —
    // if the page were deriving the leg from the booking it could not tell
    // these two apart at all.
    await renderDetail({ stop_leg: "delivery", job_number: 5, next_status: null });

    const here = screen.getByText("You are here").closest("div").parentElement;
    expect(within(here).getByText("OX1 2BB")).toBeInTheDocument();
  });
});

describe("the detail the card no longer carries", () => {
  test("shows the tracking number, parcel count, weight and dimensions", async () => {
    await renderDetail();

    expect(screen.getAllByText("BK-J7OCUNIJ").length).toBeGreaterThan(0);
    expect(screen.getByText("3")).toBeInTheDocument();
    expect(screen.getByText("7.5 kg")).toBeInTheDocument();
    expect(screen.getByText("30×20×10 cm")).toBeInTheDocument();
  });

  test("renders a multi-parcel manifest, not the first parcel only", async () => {
    // `dimensions` is a LIST of parcels, each with its own measurements. It was
    // read as a single {length,width,height} object, so every multi-parcel
    // booking rendered "0×0×0 cm".
    mockGetJob.mockResolvedValue({
      success: true,
      data: {
        ...BOOKING,
        quote: {
          ...BOOKING.quote,
          dimensions: [
            { dimensions: { length: 30, width: 20, height: 10 } },
            { dimensions: { length: 40, width: 15, height: 5 } },
          ],
        },
      },
    });
    await renderDetail();

    expect(screen.getByText("30×20×10, 40×15×5 cm")).toBeInTheDocument();
  });

  test("shows the service type, the fragile warning and both note fields", async () => {
    await renderDetail();

    // Twice on purpose: the header tag a driver reads at a glance, and the
    // Service fact in the shipment grid.
    expect(screen.getAllByText("Same Day")).toHaveLength(2);
    expect(screen.getByText(/Fragile/)).toBeInTheDocument();
    expect(screen.getByText("Leave with the neighbour if out")).toBeInTheDocument();
    expect(screen.getByText("Access via the rear gate")).toBeInTheDocument();
  });

  test("survives a booking with no dimensions recorded", async () => {
    mockGetJob.mockResolvedValue({
      success: true,
      data: { ...BOOKING, quote: { ...BOOKING.quote, dimensions: [] } },
    });
    await renderDetail();

    expect(screen.getByText("Not recorded")).toBeInTheDocument();
  });
});

describe("the action bar", () => {
  test("offers the server's next status, not a locally derived one", async () => {
    // C8: the local chain maps picked_up → at_hub unconditionally, which sends
    // a same-day parcel to a depot the customer paid for it to skip.
    mockGetJob.mockResolvedValue({
      success: true,
      data: { ...BOOKING, status: "picked_up" },
    });
    await renderDetail({ stop_leg: "pickup", next_status: "in_transit" });

    expect(screen.getByRole("button", { name: "Start Delivery" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Mark At Hub" })).not.toBeInTheDocument();
  });

  test("offers Scan on an assigned job", async () => {
    await renderDetail({ stop_leg: "pickup", next_status: "picked_up" });

    expect(screen.getByRole("button", { name: /Scan/ })).toBeInTheDocument();
  });

  test("explains a blocked delivery stop instead of offering an action", async () => {
    await renderDetail({
      stop_leg: "delivery",
      next_status: null,
      blocked_reason: "Collect at job 4 first.",
    });

    expect(screen.getByText("Collect at job 4 first.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Mark Picked Up" })).not.toBeInTheDocument();
  });

  test("locks every action once the job is immutable", async () => {
    const { driverApi } = require("../../api/driver-api");
    driverApi.checkImmutable.mockResolvedValue({
      success: true,
      immutable: true,
      reason: "Delivery completed with POD submitted.",
    });
    mockGetJob.mockResolvedValue({ success: true, data: { ...BOOKING, status: "delivered" } });

    await renderDetail({ stop_leg: "delivery", next_status: null });

    expect(screen.getByText("Job locked")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Scan/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Report an issue/ })).not.toBeInTheDocument();
  });
});
