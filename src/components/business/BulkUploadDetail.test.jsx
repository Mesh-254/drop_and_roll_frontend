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

  expect(screen.getByText(/Processing: 0 \/ 43 rows/)).toBeInTheDocument();
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
