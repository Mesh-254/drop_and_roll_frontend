/**
 * Gate tests for the driver job board.
 *
 * FOUR GROUPS, FOUR BUGS
 * ----------------------
 *
 * C6 — same-day dual stop. The endpoint used to serialise a list of BOOKINGS,
 * discarding the stop it had just ordered by sequence. A same-day booking is
 * one booking row and TWO jobs at two different doors, so the same object
 * arrived twice with nothing to distinguish it — and this component rendered
 * `key={job.id}`, giving React two children with an identical key. React
 * reconciles those as one element: the collection and the delivery fight over a
 * single card.
 *
 * C8 / Finding 5 — where the action button sends the parcel, and when it must
 * offer nothing at all.
 *
 * THE CARD'S FIXED FIELD SET — a card answers "what do I do at THIS door", so
 * it shows the leg, the status, the same-day tag, the contact AT that door, the
 * parcel count and the postcode. Everything else belongs on the detail page.
 *
 * LAZY LOADING — the list got permanently stuck at ten jobs. Two independent
 * causes, one test each; see the `pagination` block for the mechanism.
 */

import { render, screen, waitFor, act, within } from "@testing-library/react";

jest.mock("react-hot-toast", () => ({
  toast: Object.assign(jest.fn(), {
    success: jest.fn(),
    error: jest.fn(),
    loading: jest.fn(),
    dismiss: jest.fn(),
  }),
}));

const mockGetAssignedJobs = jest.fn();
jest.mock("../../api/driver-api", () => ({
  driverApi: {
    getAssignedJobs: (...a) => mockGetAssignedJobs(...a),
    batchCheckImmutable: jest.fn(() => Promise.resolve({ results: {} })),
    checkImmutable: jest.fn(() => Promise.resolve({ success: true, immutable: false })),
    updateJobStatus: jest.fn(() => Promise.resolve({ id: "x" })),
    scanQr: jest.fn(),
    submitProofOfDelivery: jest.fn(),
  },
}));

jest.mock("./QRScannerModal", () => ({ QRScannerModal: () => null }));
jest.mock("./proof-of-delivery", () => ({ ProofOfDelivery: () => null }));
jest.mock("./FailureReportModal", () => ({ FailureReportModal: () => null }));

import { DeliveryStatusUpdates } from "./delivery-status-updates";
import { publishJobStatus } from "../../lib/driver-events";

/**
 * A controllable IntersectionObserver.
 *
 * The global stub in jest.setup.js is deliberately inert, which is right for
 * components that merely mount one. Infinite scroll is the behaviour under test
 * here, so it has to be drivable: `scrollToBottom()` fires every live
 * observer's callback as if its sentinel had come into view.
 */
const observers = new Set();

beforeAll(() => {
  globalThis.IntersectionObserver = class {
    constructor(callback) {
      this.callback = callback;
      this.elements = new Set();
      observers.add(this);
    }
    observe(el) {
      this.elements.add(el);
    }
    unobserve(el) {
      this.elements.delete(el);
      if (this.elements.size === 0) observers.delete(this);
    }
    disconnect() {
      this.elements.clear();
      observers.delete(this);
    }
    takeRecords() {
      return [];
    }
  };
});

async function scrollToBottom() {
  await act(async () => {
    observers.forEach((o) => {
      if (o.elements.size > 0) o.callback([{ isIntersecting: true }], o);
    });
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  observers.clear();
  mockGetAssignedJobs.mockResolvedValue({ ordered_bookings: [], count: 0 });
});

/** A job exactly as the list endpoint sends it. */
function job(overrides = {}) {
  return {
    id: "booking-1",
    tracking_number: "DNR-1042",
    status: "assigned",
    stop_id: "stop-1",
    job_number: 4,
    leg: "pickup",
    stop_leg: "pickup",
    stop_status: "pending",
    contact_name: "Sam Sender",
    contact_phone: "+447700900999",
    contact_role: "sender",
    num_parcels: 1,
    is_same_day: false,
    next_status: "picked_up",
    blocked_reason: null,
    stop_address: { line1: "12 Elm St", city: "Milton Keynes", postal_code: "MK9 1AA" },
    pickup_address: { line1: "12 Elm St", city: "Milton Keynes", postal_code: "MK9 1AA" },
    dropoff_address: { line1: "8 Oak Rd", city: "Oxford", postal_code: "OX1 2BB" },
    ...overrides,
  };
}

/** The two halves of one same-day booking, as the endpoint sends them. */
const SAME_DAY_PAIR = [
  job({
    stop_id: "stop-pickup",
    job_number: 4,
    leg: "pickup",
    stop_leg: "pickup",
    is_same_day: true,
    contact_name: "Sam Sender",
    contact_role: "sender",
    stop_address: { line1: "12 Elm St", city: "Milton Keynes", postal_code: "MK9 1AA" },
  }),
  job({
    stop_id: "stop-delivery",
    job_number: 5,
    leg: "delivery",
    stop_leg: "delivery",
    is_same_day: true,
    contact_name: "Rita Receiver",
    contact_phone: "+447700900123",
    contact_role: "receiver",
    next_status: null,
    blocked_reason: "Collect at job 4 first.",
    stop_address: { line1: "8 Oak Rd", city: "Oxford", postal_code: "OX1 2BB" },
  }),
];

/**
 * The component refetches on mount and replaces whatever came in via props, so
 * the fixture has to arrive through the API mock — driving it through the prop
 * only would test a state the app never actually reaches.
 */
async function renderJobs(jobs, { count } = {}) {
  mockGetAssignedJobs.mockResolvedValue({
    ordered_bookings: jobs,
    count: count ?? jobs.length,
    is_optimized_route: true,
  });
  render(<DeliveryStatusUpdates jobs={[]} />);
  await waitFor(() => expect(mockGetAssignedJobs).toHaveBeenCalled());
  if (jobs.length) {
    await screen.findByText(jobs[0].stop_address.postal_code);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// C6 — the two halves of a same-day job
// ─────────────────────────────────────────────────────────────────────────────

describe("same-day dual stop", () => {
  test("renders BOTH halves as separate cards", async () => {
    await renderJobs(SAME_DAY_PAIR);

    // Keyed on booking id, React collapses these into one card.
    expect(screen.getByText("#4")).toBeInTheDocument();
    expect(screen.getByText("#5")).toBeInTheDocument();
  });

  test("labels which end of the shipment each card is", async () => {
    await renderJobs(SAME_DAY_PAIR);

    expect(screen.getByText("Collection")).toBeInTheDocument();
    expect(screen.getByText("Delivery")).toBeInTheDocument();
  });

  test("each card shows the postcode of its OWN door", async () => {
    await renderJobs(SAME_DAY_PAIR);

    expect(screen.getByText("MK9 1AA")).toBeInTheDocument();
    expect(screen.getByText("OX1 2BB")).toBeInTheDocument();
  });

  test("each card shows the contact at its OWN door", async () => {
    // The failure mode this prevents is not cosmetic: a collection card showing
    // the receiver's name is a parcel handed to a stranger.
    await renderJobs(SAME_DAY_PAIR);

    const collection = screen.getByText("Collection").closest("div.bg-white, div");
    expect(within(collection.closest("button")).getByText("Sam Sender")).toBeInTheDocument();
    expect(screen.getByText("Rita Receiver")).toBeInTheDocument();
    expect(screen.getByText("Sender")).toBeInTheDocument();
    expect(screen.getByText("Receiver")).toBeInTheDocument();
  });

  test("job numbers come from the backend, never from the list index", async () => {
    // Page 2 of a route: the backend sends the true sequence. An index-derived
    // number would render #1 / #2 and silently desync from the driver's actual
    // position in the route.
    await renderJobs(SAME_DAY_PAIR);

    expect(screen.queryByText("#1")).not.toBeInTheDocument();
    expect(screen.queryByText("#2")).not.toBeInTheDocument();
  });

  test("the same-day tag is on BOTH halves", async () => {
    // Not only the collection card. A driver holding a collected same-day
    // parcel must not route it via the hub, and that decision is taken at the
    // delivery card just as often.
    await renderJobs(SAME_DAY_PAIR);

    expect(screen.getAllByText("Same Day")).toHaveLength(2);
  });

  test("an ordinary job carries no same-day tag", async () => {
    await renderJobs([job()]);

    expect(screen.queryByText("Same Day")).not.toBeInTheDocument();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// The card's fixed field set
// ─────────────────────────────────────────────────────────────────────────────

describe("what a card is allowed to say", () => {
  test("shows the postcode, the address, the contact and the parcel count", async () => {
    await renderJobs([job({ num_parcels: 3, contact_name: "Sam Sender" })]);

    expect(screen.getByText("MK9 1AA")).toBeInTheDocument();
    expect(screen.getByText(/12 Elm St/)).toBeInTheDocument();
    expect(screen.getByText("Sam Sender")).toBeInTheDocument();
    expect(screen.getByText("3")).toBeInTheDocument();
    expect(screen.getByText("parcels")).toBeInTheDocument();
  });

  test("says 'parcel' for one and 'parcels' for more", async () => {
    await renderJobs([job({ num_parcels: 1 })]);
    expect(screen.getByText("parcel")).toBeInTheDocument();
  });

  test("the detail-only fields are NOT on the card", async () => {
    // These are what buried the six fields that matter under a full screen of
    // text per job. They live on the detail page now.
    await renderJobs([job()]);

    expect(screen.queryByText(/Tracking #/i)).not.toBeInTheDocument();
    expect(screen.queryByText("DNR-1042")).not.toBeInTheDocument();
    expect(screen.queryByText(/Job ID/i)).not.toBeInTheDocument();
    // The other end of the shipment is detail, not card.
    expect(screen.queryByText(/8 Oak Rd/)).not.toBeInTheDocument();
  });

  test("there is no bulk-update surface", async () => {
    // Bulk "At Hub" applied ONE status to every selected job, so a same-day
    // parcel caught in the selection was sent to a depot it is meant to skip.
    // The per-job button asks the server; a bulk one cannot.
    await renderJobs([job()]);

    expect(screen.queryByRole("button", { name: /Actions \(/ })).not.toBeInTheDocument();
    expect(screen.queryByText(/select all/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Select job")).not.toBeInTheDocument();
  });

  test("the refresh button is kept", async () => {
    await renderJobs([job()]);

    expect(screen.getByRole("button", { name: /Refresh/ })).toBeInTheDocument();
  });

  test("offers tap-to-call when there is a number, and nothing when there is not", async () => {
    await renderJobs([job({ contact_phone: "+447700900999", contact_name: "Sam Sender" })]);
    const call = screen.getByLabelText("Call Sam Sender");
    expect(call).toHaveAttribute("href", "tel:+447700900999");
  });

  test("renders no call button for a job with no phone", async () => {
    await renderJobs([job({ contact_phone: "", contact_name: "Sam Sender" })]);

    // A call button that does nothing is worse at a door than no call button.
    expect(screen.queryByLabelText(/^Call /)).not.toBeInTheDocument();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// C8 — where the button sends a collected parcel
// ─────────────────────────────────────────────────────────────────────────────
//
// The component derived the next status from a hardcoded chain in which
// `picked_up` is always followed by `at_hub`. A driver collecting a same-day
// parcel was therefore offered "Mark At Hub", the app posted `at_hub`, and the
// parcel went to a depot the customer had paid for it to skip.
//
// The client cannot compute the right answer: it depends on the booking having
// an open delivery stop on this driver's route.

describe("next status for a collected parcel", () => {
  const collected = (next_status) =>
    job({ id: "b2", status: "picked_up", stop_id: `stop-${next_status}`, next_status });

  test("a same-day parcel offers In Transit, never At Hub", async () => {
    await renderJobs([collected("in_transit")]);

    expect(screen.getByRole("button", { name: "Start Delivery" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Mark At Hub" })).not.toBeInTheDocument();
  });

  test("an ordinary parcel still offers At Hub", async () => {
    await renderJobs([collected("at_hub")]);

    expect(screen.getByRole("button", { name: "Mark At Hub" })).toBeInTheDocument();
  });

  test("the server's answer overrides the local chain", async () => {
    // Identical status on both fixtures; only next_status differs. If the
    // component were still using its own chain both would render "Mark At Hub".
    await renderJobs([collected("in_transit")]);

    expect(screen.queryByRole("button", { name: "Mark At Hub" })).not.toBeInTheDocument();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Finding 5 — a delivery stop whose parcel is not collected yet
// ─────────────────────────────────────────────────────────────────────────────

describe("a blocked delivery stop", () => {
  test("shows why it is blocked instead of claiming it is completed", async () => {
    await renderJobs(SAME_DAY_PAIR);

    expect(screen.getByText("Collect at job 4 first.")).toBeInTheDocument();
    // The specific lie: an untouched job rendered as done.
    expect(screen.queryByText("✓ Completed")).not.toBeInTheDocument();
  });

  test("offers exactly one action button across the pair", async () => {
    await renderJobs(SAME_DAY_PAIR);

    expect(screen.getAllByRole("button", { name: "Mark Picked Up" })).toHaveLength(1);
  });

  test("suppresses Scan Label on the blocked card", async () => {
    // The booking IS `assigned`, so the scan button's own condition is met.
    // Scanning there is a collection action on the wrong half of the pair.
    await renderJobs(SAME_DAY_PAIR);

    expect(screen.getAllByLabelText("Scan label")).toHaveLength(1);
  });

  test("a genuinely finished job still reads as completed", async () => {
    // blocked_reason absent — the fallback must be unchanged for every job with
    // no action because the work is done, not because it is out of order.
    await renderJobs([
      job({ id: "b9", stop_id: "s9", status: "delivered", next_status: null, blocked_reason: null }),
    ]);

    expect(screen.getByText("✓ Completed")).toBeInTheDocument();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Lazy loading — THE STUCK-AT-TEN BUG
// ─────────────────────────────────────────────────────────────────────────────

describe("pagination", () => {
  /** 15 jobs over two pages of 10, matching the reported route. */
  const page1 = Array.from({ length: 10 }, (_, i) =>
    job({ id: `b${i}`, stop_id: `s${i}`, job_number: i + 1 })
  );
  const page2 = Array.from({ length: 5 }, (_, i) =>
    job({ id: `b${10 + i}`, stop_id: `s${10 + i}`, job_number: 11 + i })
  );

  function serveTwoPages() {
    mockGetAssignedJobs.mockImplementation((page) =>
      Promise.resolve({
        ordered_bookings: page === 1 ? page1 : page === 2 ? page2 : [],
        count: 15,
      })
    );
  }

  test("scrolling to the bottom loads the rest of the route", async () => {
    serveTwoPages();
    render(<DeliveryStatusUpdates jobs={[]} />);
    await waitFor(() => expect(screen.getAllByText("MK9 1AA")).toHaveLength(10));

    await scrollToBottom();

    await waitFor(() => expect(screen.getAllByText("MK9 1AA")).toHaveLength(15));
  });

  test("a background refresh keeps the pages already loaded", async () => {
    /**
     * THE BUG, EXACTLY.
     *
     * The auto-refresh called fetchJobs(1, false), which REPLACED the list with
     * page 1's ten jobs but left `currentPage` at 2. The sentinel was on screen
     * again, the observer fired, and it asked for currentPage + 1 = page 3 —
     * which is empty, and set hasMoreJobs to `3 < 2` = false. From there the
     * list was ten jobs, the sentinel was gone, and nothing would ever fetch the
     * other five.
     *
     * Driven through the manual Refresh button because it takes the same
     * `refreshLoadedPages` path as the interval, without needing fake timers.
     */
    serveTwoPages();
    render(<DeliveryStatusUpdates jobs={[]} />);
    await waitFor(() => expect(screen.getAllByText("MK9 1AA")).toHaveLength(10));

    await scrollToBottom();
    await waitFor(() => expect(screen.getAllByText("MK9 1AA")).toHaveLength(15));

    await act(async () => {
      screen.getByRole("button", { name: /Refresh/ }).click();
    });

    // Still all 15 — a refresh must not rewind a driver who has scrolled.
    await waitFor(() => expect(screen.getAllByText("MK9 1AA")).toHaveLength(15));
  });

  test("the observer never asks for a page past the end", async () => {
    serveTwoPages();
    render(<DeliveryStatusUpdates jobs={[]} />);
    await waitFor(() => expect(screen.getAllByText("MK9 1AA")).toHaveLength(10));

    await scrollToBottom();
    await waitFor(() => expect(screen.getAllByText("MK9 1AA")).toHaveLength(15));
    // Keep scrolling at the end of a fully loaded list.
    await scrollToBottom();
    await scrollToBottom();

    const requested = mockGetAssignedJobs.mock.calls.map(([page]) => page);
    expect(requested).not.toContain(3);
  });

  test("stops asking for more once every job is loaded", async () => {
    serveTwoPages();
    render(<DeliveryStatusUpdates jobs={[]} />);
    await waitFor(() => expect(screen.getAllByText("MK9 1AA")).toHaveLength(10));

    await scrollToBottom();

    await waitFor(() => expect(screen.getByText("All 15 jobs loaded")).toBeInTheDocument());
  });

  test("does not reset when the parent re-renders with a new callback identity", async () => {
    /**
     * THE SECOND CAUSE. `onStatusUpdate` is an inline arrow in DriverDashboard,
     * so it had a new identity on every parent render — and it was in the mount
     * effect's dependency list, which blanked the list and refetched page 1
     * whenever anything at all re-rendered the dashboard.
     */
    serveTwoPages();
    const { rerender } = render(<DeliveryStatusUpdates jobs={[]} onStatusUpdate={() => {}} />);
    await waitFor(() => expect(screen.getAllByText("MK9 1AA")).toHaveLength(10));

    await scrollToBottom();
    await waitFor(() => expect(screen.getAllByText("MK9 1AA")).toHaveLength(15));

    // A fresh arrow, exactly as an inline prop produces on every render.
    await act(async () => {
      rerender(<DeliveryStatusUpdates jobs={[]} onStatusUpdate={() => {}} />);
    });

    await waitFor(() => expect(screen.getAllByText("MK9 1AA")).toHaveLength(15));
  });

  test("overlapping pages do not duplicate a job", async () => {
    // The list is ordered by status priority then updated_at, so a status change
    // between two page fetches shifts every job after it by one position and the
    // same job can appear on both pages.
    mockGetAssignedJobs.mockImplementation((page) =>
      Promise.resolve({
        ordered_bookings: page === 1 ? page1 : [page1[9], ...page2],
        count: 15,
      })
    );
    render(<DeliveryStatusUpdates jobs={[]} />);
    await waitFor(() => expect(screen.getAllByText("MK9 1AA")).toHaveLength(10));

    await scrollToBottom();

    await waitFor(() => expect(screen.getAllByText("MK9 1AA")).toHaveLength(15));
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Live updates
// ─────────────────────────────────────────────────────────────────────────────

describe("live status updates", () => {
  test("re-reads the board when a status change arrives", async () => {
    // The board used to learn about its own writes by polling page 1 every 8
    // seconds. A driver who scanned a label at a door waited up to 8s for the
    // card to agree with them.
    await renderJobs([job()]);
    const callsBefore = mockGetAssignedJobs.mock.calls.length;

    await act(async () => {
      publishJobStatus({ booking_id: "booking-1", status: "picked_up", reason: "scan" });
      // Past the debounce that coalesces a burst of messages into one re-read.
      await new Promise((resolve) => setTimeout(resolve, 600));
    });

    await waitFor(() =>
      expect(mockGetAssignedJobs.mock.calls.length).toBeGreaterThan(callsBefore)
    );
  });

  test("a burst of messages produces one re-read, not one per message", async () => {
    await renderJobs([job()]);
    const callsBefore = mockGetAssignedJobs.mock.calls.length;

    await act(async () => {
      publishJobStatus({ booking_id: "a", status: "picked_up" });
      publishJobStatus({ booking_id: "b", status: "picked_up" });
      publishJobStatus({ booking_id: "c", status: "in_transit" });
      await new Promise((resolve) => setTimeout(resolve, 600));
    });

    // One page loaded, so one request per settled burst.
    expect(mockGetAssignedJobs.mock.calls.length).toBe(callsBefore + 1);
  });
});
