// C6 behaviour tests — the driver can tell the two halves of a same-day job apart.
//
// THE BUG THESE GUARD
// -------------------
// The backend endpoint used to serialise a list of BOOKINGS, discarding the
// stop it had just ordered by sequence. A same-day booking is one booking row
// and TWO jobs at two different doors, so the same object arrived twice with
// nothing to distinguish it — and this component rendered `key={job.id}`, giving
// React two children with an identical key. React reconciles those as one
// element: the collection and the delivery fight over a single card, and the
// driver has no way to know which door they are being sent to.
//
// The backend now sends stop_id, job_number, leg and stop_address per job.
// These assert the component actually uses them.

import { render, screen, waitFor, within } from "@testing-library/react";

jest.mock("react-hot-toast", () => ({
  toast: {
    success: jest.fn(),
    error: jest.fn(),
    loading: jest.fn(),
    dismiss: jest.fn(),
  },
}));

const mockGetAssignedJobs = jest.fn();
jest.mock("../../api/driver-api", () => ({
  driverApi: {
    getAssignedJobs: (...a) => mockGetAssignedJobs(...a),
    batchCheckImmutable: jest.fn(() => Promise.resolve({ results: {} })),
    checkImmutable: jest.fn(() => Promise.resolve({ immutable: false })),
    bulkUpdateStatus: jest.fn(),
    updateJobStatus: jest.fn(),
    scanQr: jest.fn(),
    submitProofOfDelivery: jest.fn(),
  },
}));

jest.mock("./QRScannerModal", () => ({ QRScannerModal: () => null }));
jest.mock("./proof-of-delivery", () => ({ ProofOfDelivery: () => null }));
jest.mock("./FailureReportModal", () => ({ FailureReportModal: () => null }));

import { DeliveryStatusUpdates } from "./delivery-status-updates";

/** The two halves of one same-day booking, exactly as the endpoint sends them. */
const SAME_DAY_PAIR = [
  {
    id: "booking-1",
    tracking_number: "DNR-1042",
    status: "assigned",
    stop_id: "stop-pickup",
    job_number: 4,
    leg: "pickup",
    stop_status: "pending",
    stop_address: { id: "addr-a", line1: "12 Elm St", city: "Milton Keynes", postal_code: "MK9 1AA" },
    pickup_address: { id: "addr-a", line1: "12 Elm St", city: "Milton Keynes", postal_code: "MK9 1AA" },
    dropoff_address: { id: "addr-b", line1: "8 Oak Rd", city: "Milton Keynes", postal_code: "MK9 2BB" },
  },
  {
    id: "booking-1",
    tracking_number: "DNR-1042",
    status: "assigned",
    stop_id: "stop-delivery",
    job_number: 5,
    leg: "delivery",
    stop_status: "pending",
    stop_address: { id: "addr-b", line1: "8 Oak Rd", city: "Milton Keynes", postal_code: "MK9 2BB" },
    pickup_address: { id: "addr-a", line1: "12 Elm St", city: "Milton Keynes", postal_code: "MK9 1AA" },
    dropoff_address: { id: "addr-b", line1: "8 Oak Rd", city: "Milton Keynes", postal_code: "MK9 2BB" },
  },
];

beforeEach(() => {
  jest.clearAllMocks();
  mockGetAssignedJobs.mockResolvedValue({ ordered_bookings: [], count: 0 });
});

/**
 * The component refetches on mount and replaces whatever came in via props, so
 * the fixture has to arrive through the API mock — driving it through the prop
 * only would test a state the app never actually reaches.
 */
async function renderJobs(jobs) {
  mockGetAssignedJobs.mockResolvedValue({
    ordered_bookings: jobs,
    count: jobs.length,
    is_optimized_route: true,
  });
  render(<DeliveryStatusUpdates jobs={jobs} />);
  await waitFor(() => expect(mockGetAssignedJobs).toHaveBeenCalled());
  // findAllByText, not findByText: the two halves of a same-day job carry the
  // SAME tracking number — that is the whole reason the driver needs a job
  // number to tell them apart, and a singular query would throw here.
  return screen.findAllByText(jobs[0].tracking_number);
}

describe("same-day dual stop", () => {
  test("renders BOTH halves of a same-day booking as separate cards", async () => {
    await renderJobs(SAME_DAY_PAIR);

    // Keyed on booking id, React collapses these into one card.
    expect(screen.getByText("Job 4")).toBeInTheDocument();
    expect(screen.getByText("Job 5")).toBeInTheDocument();
  });

  test("labels which end of the shipment each card is", async () => {
    await renderJobs(SAME_DAY_PAIR);

    expect(screen.getByText("Collection")).toBeInTheDocument();
    expect(screen.getByText("Delivery")).toBeInTheDocument();
  });

  test("the pickup card shows a lower job number than its own delivery", async () => {
    await renderJobs(SAME_DAY_PAIR);

    const numbers = screen
      .getAllByText(/^Job \d+$/)
      .map((el) => parseInt(el.textContent.replace("Job ", ""), 10));

    expect(numbers).toEqual([4, 5]);
  });

  test("each card names the door THIS job is at, not both doors", async () => {
    await renderJobs(SAME_DAY_PAIR);

    // "Collect from" appears on the pickup card, "Deliver to" on the delivery
    // card. Without stop_address both cards showed the identical pair of
    // addresses and the driver could not tell them apart.
    const collect = screen.getByText("Collect from").closest("div");
    expect(within(collect).getByText(/12 Elm St/)).toBeInTheDocument();

    const deliver = screen.getByText("Deliver to").closest("div");
    expect(within(deliver).getByText(/8 Oak Rd/)).toBeInTheDocument();
  });

  test("job numbers come from the backend, never from the list index", async () => {
    // Page 2 of a route: the backend sends the true sequence. An index-derived
    // number would render "Job 1" / "Job 2" here and silently desync from the
    // driver's actual position in the route.
    await renderJobs(SAME_DAY_PAIR);

    expect(screen.queryByText("Job 1")).not.toBeInTheDocument();
    expect(screen.queryByText("Job 2")).not.toBeInTheDocument();
  });
});

describe("standalone jobs", () => {
  const STANDALONE = [
    {
      id: "booking-9",
      tracking_number: "DNR-9001",
      status: "assigned",
      stop_id: null,
      job_number: null,
      leg: null,
      stop_status: null,
      stop_address: null,
      pickup_address: { id: "addr-x", line1: "1 High St", city: "Oxford", postal_code: "OX1 1AA" },
      dropoff_address: { id: "addr-y", line1: "2 Low St", city: "Oxford", postal_code: "OX1 2BB" },
    },
  ];

  test("a booking with no stop shows no job number and no leg badge", async () => {
    await renderJobs(STANDALONE);

    expect(screen.getByText("DNR-9001")).toBeInTheDocument();
    expect(screen.queryByText(/^Job \d+$/)).not.toBeInTheDocument();
    expect(screen.queryByText("Collection")).not.toBeInTheDocument();
    expect(screen.queryByText("Deliver to")).not.toBeInTheDocument();
  });
});
