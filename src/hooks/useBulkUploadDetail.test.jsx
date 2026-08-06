/* eslint-env jest */
// Regression tests for the "stuck on Processing" report.
//
// BulkUpload 57213101 sat at status=pending with celery_task_id="" — a DRAFT:
// /validate/ created the row, the user never submitted it, so no Celery task
// ever existed. This hook could not tell that apart from a genuinely queued
// upload, so it polled /:id/ every 3 seconds while the page rendered
// "Processing: 0 / 0 rows" — for the full 24 hours until the backend reaper's
// draft sweep cancelled the row.
//
// Pinned here:
//   1. A draft is never polled — no task exists, so no poll can ever change it.
//   2. A submitted PENDING upload IS polled — it is genuinely queued.
//   3. is_draft is derived from celery_task_id when the backend field is absent
//      (older/cached payload), so the fix degrades safely.
//   4. A submitted upload whose status has not moved for minutes stops polling
//      and reports itself stalled instead of animating a dead progress bar.
//   5. submitDraft / discardDraft give the user a way out that isn't
//      re-uploading the same file.

import { renderHook, act, waitFor } from "@testing-library/react";

const mockGetDetail = jest.fn();
const mockGetErrors = jest.fn();
const mockGetSuccessful = jest.fn();
const mockGetSkipped = jest.fn();
const mockCreate = jest.fn();
const mockCancelUpload = jest.fn();

jest.mock("../api/BulkUploadApi", () => ({
  __esModule: true,
  default: {
    getDetail: (...a) => mockGetDetail(...a),
    getErrors: (...a) => mockGetErrors(...a),
    getSuccessful: (...a) => mockGetSuccessful(...a),
    getSkipped: (...a) => mockGetSkipped(...a),
    create: (...a) => mockCreate(...a),
    cancelUpload: (...a) => mockCancelUpload(...a),
    retryFailed: jest.fn(),
    downloadErrorReport: jest.fn(),
  },
}));

import { useBulkUploadDetail } from "./useBulkUploadDetail";

const EMPTY_PAGE = { results: [], count: 0 };

/** The stuck upload, exactly as the DB held it. */
const DRAFT = {
  id: "57213101",
  status: "pending",
  celery_task_id: "",
  is_draft: true,
  total_rows: 0,
  successful: 0,
  failed: 0,
  skipped: 0,
  progress_pct: 0,
  payment_path: "prepaid",
};

/** Submitted, waiting on a worker to pick it up. */
const QUEUED = { ...DRAFT, celery_task_id: "task-abc", is_draft: false };

beforeEach(() => {
  jest.useFakeTimers();
  mockGetDetail.mockReset();
  mockGetErrors.mockReset().mockResolvedValue(EMPTY_PAGE);
  mockGetSuccessful.mockReset().mockResolvedValue(EMPTY_PAGE);
  mockGetSkipped.mockReset().mockResolvedValue(EMPTY_PAGE);
  mockCreate.mockReset();
  mockCancelUpload.mockReset();
});

afterEach(() => {
  jest.useRealTimers();
});

/** Render the hook and wait for its initial fetch to land. */
async function renderWith(detail) {
  mockGetDetail.mockResolvedValue(detail);
  const view = renderHook(() => useBulkUploadDetail("57213101"));
  await act(async () => {
    await Promise.resolve();
  });
  return view;
}

/** Advance past N poll intervals, flushing promises between each. */
async function advancePolls(count) {
  for (let i = 0; i < count; i++) {
    await act(async () => {
      jest.advanceTimersByTime(3000);
      await Promise.resolve();
    });
  }
}

test("a draft is flagged as such and is never polled", async () => {
  const view = await renderWith(DRAFT);

  expect(view.result.current.isDraft).toBe(true);

  const callsAfterInitialFetch = mockGetDetail.mock.calls.length;
  await advancePolls(5);

  expect(mockGetDetail.mock.calls.length).toBe(callsAfterInitialFetch);
});

test("a submitted PENDING upload is still polled", async () => {
  const view = await renderWith(QUEUED);

  expect(view.result.current.isDraft).toBe(false);

  const callsAfterInitialFetch = mockGetDetail.mock.calls.length;
  await advancePolls(2);

  expect(mockGetDetail.mock.calls.length).toBeGreaterThan(
    callsAfterInitialFetch,
  );
});

test("is_draft falls back to celery_task_id when the backend omits the field", async () => {
  // An older or cached payload. The fix must not silently start polling a
  // draft again just because one field is missing.
  const legacy = { ...DRAFT };
  delete legacy.is_draft;

  const view = await renderWith(legacy);

  expect(view.result.current.isDraft).toBe(true);
});

test("a terminal upload is not polled", async () => {
  await renderWith({ ...DRAFT, status: "completed", is_draft: false });

  const callsAfterInitialFetch = mockGetDetail.mock.calls.length;
  await advancePolls(5);

  expect(mockGetDetail.mock.calls.length).toBe(callsAfterInitialFetch);
});

test("a queued upload that never moves goes stalled and stops polling", async () => {
  const view = await renderWith(QUEUED);

  // Five minutes of the same status, polled every 3s.
  await act(async () => {
    jest.advanceTimersByTime(5 * 60 * 1000);
    await Promise.resolve();
  });
  await advancePolls(2);

  await waitFor(() => expect(view.result.current.isStalled).toBe(true));

  const callsWhenStalled = mockGetDetail.mock.calls.length;
  await advancePolls(5);
  expect(mockGetDetail.mock.calls.length).toBe(callsWhenStalled);
});

test("progress on the status resets the stall clock", async () => {
  const view = await renderWith(QUEUED);

  await act(async () => {
    jest.advanceTimersByTime(4 * 60 * 1000);
    await Promise.resolve();
  });

  // The worker picked it up — status moved.
  mockGetDetail.mockResolvedValue({ ...QUEUED, status: "processing" });
  await advancePolls(2);

  await act(async () => {
    jest.advanceTimersByTime(2 * 60 * 1000);
    await Promise.resolve();
  });
  await advancePolls(1);

  // 6 minutes total elapsed, but only 2 on the current status.
  expect(view.result.current.isStalled).toBe(false);
});

test("submitDraft dispatches the upload and refreshes it", async () => {
  const view = await renderWith(DRAFT);

  mockCreate.mockResolvedValue({ ...QUEUED, status: "processing" });
  mockGetDetail.mockResolvedValue({ ...QUEUED, status: "processing" });

  await act(async () => {
    await view.result.current.submitDraft();
  });

  expect(mockCreate).toHaveBeenCalledWith("57213101");
  await waitFor(() => expect(view.result.current.isDraft).toBe(false));
});

test("a failed submitDraft surfaces the reason and leaves the draft submittable", async () => {
  const view = await renderWith(DRAFT);

  mockCreate.mockRejectedValue({
    response: { status: 429, data: { detail: "Request was throttled." } },
  });

  await act(async () => {
    await view.result.current.submitDraft();
  });

  expect(view.result.current.draftActionError).toBe("Request was throttled.");
  expect(view.result.current.isDraft).toBe(true);
  expect(view.result.current.isSubmittingDraft).toBe(false);
});

test("discardDraft cancels the upload", async () => {
  const view = await renderWith(DRAFT);

  mockCancelUpload.mockResolvedValue({
    ...DRAFT,
    status: "cancelled",
    is_draft: false,
  });
  mockGetDetail.mockResolvedValue({
    ...DRAFT,
    status: "cancelled",
    is_draft: false,
  });

  await act(async () => {
    await view.result.current.discardDraft();
  });

  expect(mockCancelUpload).toHaveBeenCalledWith("57213101");
  await waitFor(() =>
    expect(view.result.current.upload.status).toBe("cancelled"),
  );
});
