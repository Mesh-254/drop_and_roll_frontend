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

// ── C8: where the button sends a collected same-day parcel ──────────────────
//
// The component derived the next status from a hardcoded chain in which
// `picked_up` is always followed by `at_hub`. A driver collecting a same-day
// parcel was therefore offered "Mark At Hub", the app posted `at_hub`, and the
// parcel went to a depot the customer had paid for it to skip.
//
// The client cannot compute the right answer: it depends on the booking having
// an open delivery stop on this driver's route. The backend sends `next_status`
// and the component now uses it.

const COLLECTED_SAME_DAY = [
  {
    id: "booking-2",
    tracking_number: "DNR-2001",
    status: "picked_up",
    stop_id: "stop-p2",
    job_number: 1,
    leg: "pickup",
    stop_status: "pending",
    next_status: "in_transit", // server says: skip the hub
    stop_address: { id: "a1", line1: "5 Sender Rd", city: "MK", postal_code: "MK1 1AA" },
    pickup_address: { id: "a1", line1: "5 Sender Rd", city: "MK", postal_code: "MK1 1AA" },
    dropoff_address: { id: "a2", line1: "9 Recipient Ave", city: "MK", postal_code: "MK2 2BB" },
  },
];

const COLLECTED_NEXT_DAY = [
  {
    ...COLLECTED_SAME_DAY[0],
    id: "booking-3",
    tracking_number: "DNR-3001",
    stop_id: "stop-p3",
    next_status: "at_hub", // server says: via the hub, as normal
  },
];

describe("next status for a collected parcel", () => {
  test("a same-day parcel offers In Transit, never At Hub", async () => {
    await renderJobs(COLLECTED_SAME_DAY);

    // Scoped to the action button: "In Transit" also appears as a value in the
    // status filter dropdown, which says nothing about what the button does.
    expect(screen.getByRole("button", { name: /In Transit/ })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /At Hub/ })).not.toBeInTheDocument();
  });

  test("an ordinary parcel still offers At Hub", async () => {
    await renderJobs(COLLECTED_NEXT_DAY);

    expect(screen.getByRole("button", { name: /At Hub/ })).toBeInTheDocument();
  });

  test("the server's answer overrides the local chain", async () => {
    // Identical status on both fixtures; only next_status differs. If the
    // component were still using its own chain both would render "At Hub".
    const { unmount } = render(<div />);
    unmount();

    await renderJobs(COLLECTED_SAME_DAY);
    expect(screen.queryByRole("button", { name: /At Hub/ })).not.toBeInTheDocument();
  });
});
