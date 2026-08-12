/* eslint-env jest */
// Rendering tests for the two states BulkUploadDetail used to describe wrongly.
//
// 1. DRAFT — validated, never submitted. The page showed the "Processing" step
//    active with an animated "Processing: 0 / 0 rows" bar and a "Pending" pill,
//    for an upload with no Celery task behind it. That is the screenshot in the
//    bug report. It must now say it was never submitted and offer a way out.
//
// 2. ALL DUPLICATES — every valid row matched a booking the customer already
//    had. The batch was reported as FAILED under "Every row in this file failed
//    validation", and the list of matched bookings sat behind a Successful tab
//    that was disabled because successful === 0. The user was told to fix and
//    re-upload a file that was entirely correct, with no way to see why.

import { render, screen, fireEvent } from "@testing-library/react";

const mockNavigate = jest.fn();
jest.mock("react-router-dom", () => ({
  __esModule: true,
  useNavigate: () => mockNavigate,
  useParams: () => ({ id: "57213101" }),
}));

// framer-motion → plain host elements so roles and text survive.
jest.mock("framer-motion", () => ({
  __esModule: true,
  AnimatePresence: ({ children }) => children,
  motion: new Proxy(
    {},
    {
      get:
        (_target, tag) =>
        ({ children, ...props }) => {
          const React = require("react");
          for (const k of [
            "whileHover",
            "whileTap",
            "initial",
            "animate",
            "transition",
            "exit",
            "variants",
            "layout",
          ]) {
            delete props[k];
          }
          return React.createElement(String(tag), props, children);
        },
    },
  ),
}));

jest.mock("react-hot-toast", () => ({
  __esModule: true,
  default: { success: jest.fn(), error: jest.fn() },
}));

const mockSubmitDraft = jest.fn();
const mockDiscardDraft = jest.fn();
let mockHookState = {};

jest.mock("../../hooks/useBulkUploadDetail", () => ({
  __esModule: true,
  useBulkUploadDetail: () => mockHookState,
}));

import BulkUploadDetail from "./BulkUploadDetail";

const BASE_HOOK = {
  upload: null,
  isLoadingUpload: false,
  uploadError: null,
  refetchUpload: jest.fn(),
  errorRows: [],
  errorMeta: {},
  errorPage: 1,
  setErrorPage: jest.fn(),
  isFetchingErrors: false,
  successfulRows: [],
  successfulMeta: {},
  successfulPage: 1,
  setSuccessfulPage: jest.fn(),
  isFetchingSuccessful: false,
  skippedRows: [],
  handleRetryFailed: jest.fn(),
  handleDownloadErrorReport: jest.fn(),
  isRetrying: false,
  isDraft: false,
  isStalled: false,
  submitDraft: mockSubmitDraft,
  discardDraft: mockDiscardDraft,
  isSubmittingDraft: false,
  draftActionError: null,
  confirmContext: null,
  isLoadingConfirmContext: false,
};

/** confirm-context for a draft whose file repeats an earlier batch. */
const DIRTY_CONTEXT = {
  row_count: 43,
  duplicate_count: 14,
  duplicate_rows: [{ row_number: 7, reference: "VALID-STD-02", matched_by: "reference" }],
  duplicate_matched_upload: { id: "b1", batch_name: "bulk_upload_test_new" },
  correctable: [{ id: "b1", label: "bulk_upload_test_new · 30 failed · 11 Aug 2026" }],
};

/** The stuck upload from the report, byte for byte. */
const DRAFT_UPLOAD = {
  id: "57213101",
  status: "pending",
  celery_task_id: "",
  is_draft: true,
  payment_path: "prepaid",
  total_rows: 0,
  successful: 0,
  failed: 0,
  skipped: 0,
  progress_pct: 0,
  computed_total: "0.00",
  original_filename: "bulk_upload_test.xlsx",
  batch_name: "bulk_upload_test",
  created_at: "2026-08-06T11:33:29Z",
};

beforeEach(() => {
  mockNavigate.mockClear();
  mockSubmitDraft.mockClear();
  mockDiscardDraft.mockClear();
  mockHookState = { ...BASE_HOOK };
});

// ─── Draft ───────────────────────────────────────────────────────────────────

test("a draft says it was never submitted instead of claiming to be processing", () => {
  mockHookState = { ...BASE_HOOK, upload: DRAFT_UPLOAD, isDraft: true };
  render(<BulkUploadDetail />);

  expect(screen.getByText(/Not Submitted Yet/i)).toBeInTheDocument();
  expect(screen.getByText(/never sent for processing/i)).toBeInTheDocument();
  // The exact string from the screenshot must be gone.
  expect(screen.queryByText(/Processing: 0 \/ 0 rows/)).not.toBeInTheDocument();
});

test("a draft's status pill reads Not Submitted, not Pending", () => {
  mockHookState = { ...BASE_HOOK, upload: DRAFT_UPLOAD, isDraft: true };
  render(<BulkUploadDetail />);

  expect(screen.getByText("Not Submitted")).toBeInTheDocument();
});

test("a draft offers Submit and Discard", () => {
  mockHookState = { ...BASE_HOOK, upload: DRAFT_UPLOAD, isDraft: true };
  render(<BulkUploadDetail />);

  fireEvent.click(
    screen.getByRole("button", { name: /Submit for Processing/i }),
  );
  expect(mockSubmitDraft).toHaveBeenCalled();

  fireEvent.click(screen.getByRole("button", { name: /^Discard$/i }));
  expect(mockDiscardDraft).toHaveBeenCalled();
});

// ─── Draft: the Review & Confirm question, asked here ────────────────────────
//
// A draft resumed through "Continue setup" used to submit with no answer at
// all. When the file held already-booked rows the backend refused — correctly,
// since it must not decide whether 14 parcels ship and are charged for twice —
// and the page had no way to supply one. The batch was unsubmittable.

test("a draft asks the same question the wizard asks", () => {
  mockHookState = {
    ...BASE_HOOK,
    upload: DRAFT_UPLOAD,
    isDraft: true,
    confirmContext: DIRTY_CONTEXT,
  };
  render(<BulkUploadDetail />);

  expect(screen.getByText(/what is this upload\?/i)).toBeInTheDocument();
  expect(screen.getByText(/14 rows already booked/i)).toBeInTheDocument();
  expect(screen.getByRole("radio", { name: /a new batch/i })).toBeInTheDocument();
  expect(screen.getByRole("radio", { name: /corrections/i })).toBeInTheDocument();
});

test("submit is blocked until the duplicate question is answered", () => {
  mockHookState = {
    ...BASE_HOOK,
    upload: DRAFT_UPLOAD,
    isDraft: true,
    confirmContext: DIRTY_CONTEXT,
  };
  render(<BulkUploadDetail />);

  const submit = () => screen.getByRole("button", { name: /Submit for Processing/i });
  expect(submit()).toBeDisabled();

  fireEvent.click(screen.getByRole("radio", { name: /a new batch/i }));

  // Re-queried: the banner re-mounts its subtree on state change, so a node
  // captured before the click is a detached copy that never updates.
  expect(submit()).toBeEnabled();
});

test("the answer travels with the submit", () => {
  mockHookState = {
    ...BASE_HOOK,
    upload: DRAFT_UPLOAD,
    isDraft: true,
    confirmContext: DIRTY_CONTEXT,
  };
  render(<BulkUploadDetail />);

  fireEvent.click(screen.getByRole("radio", { name: /a new batch/i }));
  fireEvent.click(screen.getByRole("button", { name: /Submit for Processing/i }));

  expect(mockSubmitDraft).toHaveBeenCalledWith({ duplicatePolicy: "book_again" });
});

test("a corrections answer names the batch it corrects", () => {
  mockHookState = {
    ...BASE_HOOK,
    upload: DRAFT_UPLOAD,
    isDraft: true,
    confirmContext: DIRTY_CONTEXT,
  };
  render(<BulkUploadDetail />);

  // The matched batch is preselected, so choosing corrections is one click.
  fireEvent.click(screen.getByRole("radio", { name: /corrections/i }));
  fireEvent.click(screen.getByRole("button", { name: /Submit for Processing/i }));

  expect(mockSubmitDraft).toHaveBeenCalledWith({ correctsUpload: "b1" });
});

test("a clean draft submits in one click with no policy attached", () => {
  mockHookState = {
    ...BASE_HOOK,
    upload: DRAFT_UPLOAD,
    isDraft: true,
    confirmContext: { ...DIRTY_CONTEXT, duplicate_count: 0, duplicate_rows: [], duplicate_matched_upload: null },
  };
  render(<BulkUploadDetail />);

  const submit = screen.getByRole("button", { name: /Submit for Processing/i });
  expect(submit).toBeEnabled();

  fireEvent.click(submit);

  expect(mockSubmitDraft).toHaveBeenCalledWith({});
});

test("submit waits for the context rather than submitting a default answer", () => {
  // Until it lands duplicateCount reads 0, so the question looks answered.
  // Clicking in that window sends no answer and earns a 400 the customer did
  // nothing to cause.
  mockHookState = {
    ...BASE_HOOK,
    upload: DRAFT_UPLOAD,
    isDraft: true,
    confirmContext: null,
    isLoadingConfirmContext: true,
  };
  render(<BulkUploadDetail />);

  expect(screen.getByRole("button", { name: /Submit for Processing/i })).toBeDisabled();
});

test("a draft states its row count instead of the zero the record holds", () => {
  // total_rows is 0 until processing creates rows, so the page read
  // "TOTAL ROWS 0" over a 43-row file.
  mockHookState = {
    ...BASE_HOOK,
    upload: DRAFT_UPLOAD,
    isDraft: true,
    confirmContext: DIRTY_CONTEXT,
  };
  render(<BulkUploadDetail />);

  expect(screen.getByText(/43 rows were uploaded and checked/i)).toBeInTheDocument();
});

test("a draft surfaces a failed submit rather than swallowing it", () => {
  mockHookState = {
    ...BASE_HOOK,
    upload: DRAFT_UPLOAD,
    isDraft: true,
    draftActionError: "Request was throttled. Try again in 5 minutes.",
  };
  render(<BulkUploadDetail />);

  expect(screen.getByText(/Request was throttled/i)).toBeInTheDocument();
});

test("a genuinely queued upload still shows processing progress", () => {
  mockHookState = {
    ...BASE_HOOK,
    upload: {
      ...DRAFT_UPLOAD,
      celery_task_id: "task-1",
      is_draft: false,
      total_rows: 43,
    },
    isDraft: false,
  };
  render(<BulkUploadDetail />);

  // One wording across both screens now: BulkUploadProgressBar owns the
  // counts, so the detail page and the wizard cannot drift apart.
  expect(screen.getByText("0 of 43 rows processed")).toBeInTheDocument();
  expect(screen.queryByText(/Not Submitted Yet/i)).not.toBeInTheDocument();
});

// ─── Stalled ─────────────────────────────────────────────────────────────────

test("a stalled upload says so and offers a manual re-check", () => {
  const refetch = jest.fn();
  mockHookState = {
    ...BASE_HOOK,
    upload: {
      ...DRAFT_UPLOAD,
      celery_task_id: "task-1",
      is_draft: false,
      status: "processing",
    },
    isDraft: false,
    isStalled: true,
    refetchUpload: refetch,
  };
  render(<BulkUploadDetail />);

  expect(screen.getByText(/Taking Longer Than Expected/i)).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: /Check Again/i }));
  expect(refetch).toHaveBeenCalled();
});

// ─── All duplicates ──────────────────────────────────────────────────────────

const DUPLICATE_UPLOAD = {
  ...DRAFT_UPLOAD,
  status: "partial",
  celery_task_id: "task-1",
  is_draft: false,
  total_rows: 43,
  successful: 0,
  failed: 29,
  skipped: 14,
  progress_pct: 100,
};

const SKIPPED_ROWS = [
  { id: "r1", row_number: 4, row_reference: "VALID-STD-02" },
  { id: "r2", row_number: 5, row_reference: "VALID-STD-03" },
];

test("a batch with zero new bookings but skips is framed as already booked, not failed", () => {
  mockHookState = {
    ...BASE_HOOK,
    upload: DUPLICATE_UPLOAD,
    isDraft: false,
    skippedRows: SKIPPED_ROWS,
  };
  render(<BulkUploadDetail />);

  expect(
    screen.getByRole("heading", {
      name: /Already Booked — No New Bookings Created/i,
    }),
  ).toBeInTheDocument();
  expect(
    screen.getByText(/nothing was duplicated and nothing was charged/i),
  ).toBeInTheDocument();
  expect(
    screen.queryByText(/Every row in this file failed validation/i),
  ).not.toBeInTheDocument();
});

test("the Successful tab opens when there are skips but no new bookings", () => {
  mockHookState = {
    ...BASE_HOOK,
    upload: DUPLICATE_UPLOAD,
    isDraft: false,
    skippedRows: SKIPPED_ROWS,
  };
  render(<BulkUploadDetail />);

  const tab = screen.getByRole("button", { name: /Already booked \(14\)/i });
  expect(tab).not.toBeDisabled();

  fireEvent.click(tab);

  // The matched bookings are reachable — this list IS the explanation.
  expect(screen.getByText("VALID-STD-02")).toBeInTheDocument();
  expect(screen.getByText("VALID-STD-03")).toBeInTheDocument();
});

test("a batch with nothing resolved is still shown as failed", () => {
  mockHookState = {
    ...BASE_HOOK,
    upload: { ...DUPLICATE_UPLOAD, status: "failed", failed: 43, skipped: 0 },
    isDraft: false,
    skippedRows: [],
  };
  render(<BulkUploadDetail />);

  expect(
    screen.getByText(/Every row in this file failed validation/i),
  ).toBeInTheDocument();
  expect(
    screen.queryByRole("heading", {
      name: /Already Booked — No New Bookings Created/i,
    }),
  ).not.toBeInTheDocument();
});
