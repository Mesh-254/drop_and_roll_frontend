/* eslint-env jest */
// Regression tests for the bulk-upload poller's terminal-state handling.
//
// Same class of bug as the earlier missing `partial` state: if `failed` is not
// in TERMINAL_STATES the poller spins forever on a stuck/failed upload. And if
// `failed` were (wrongly) in SUCCESS_STATES it would navigate away from an
// errored upload. These tests pin both, driving the hook through its public
// validate → upload → poll flow:
//   1. failed  → polling stops, NO navigation (error UI drives off status).
//   2. payment_pending → polling stops, navigates to /pay/bulk/:id (success).

import { renderHook, act, waitFor } from "@testing-library/react";

const mockNavigate = jest.fn();
jest.mock("react-router-dom", () => ({
  __esModule: true,
  useNavigate: () => mockNavigate,
}));

const mockValidate = jest.fn();
const mockCreate = jest.fn();
const mockGetStatus = jest.fn();
jest.mock("../api/BulkUploadApi", () => ({
  __esModule: true,
  default: {
    validate: (...a) => mockValidate(...a),
    create: (...a) => mockCreate(...a),
    getStatus: (...a) => mockGetStatus(...a),
    getReceivable: jest.fn(),
  },
}));

import { useBulkUpload } from "./useBulkUpload";

async function driveToTerminal(uploadId, terminalStatus) {
  mockValidate.mockResolvedValue({ id: "validated-1" });
  mockCreate.mockResolvedValue({
    id: uploadId,
    status: "processing",
    customer_type: "PREPAID",
  });
  mockGetStatus.mockResolvedValue({
    status: terminalStatus,
    customer_type: "PREPAID",
  });

  const view = renderHook(() => useBulkUpload());
  const file = new File(["reference\n"], "batch.csv", { type: "text/csv" });

  await act(async () => {
    await view.result.current.validateFile(file);
  });
  await act(async () => {
    await view.result.current.startUpload();
  });
  return view;
}

beforeEach(() => {
  mockNavigate.mockClear();
  mockValidate.mockReset();
  mockCreate.mockReset();
  mockGetStatus.mockReset();
});

test("`failed` is terminal: polling stops and no navigation happens", async () => {
  const { result } = await driveToTerminal("upload-123", "failed");

  await waitFor(() => {
    expect(result.current.latestUpload?.status).toBe("failed");
  });

  // Terminal → stopped polling, and failed is NOT a success state → no nav.
  await waitFor(() => expect(result.current.isPolling).toBe(false));
  expect(result.current.isAutoNavQueued).toBe(false);
  expect(mockNavigate).not.toHaveBeenCalled();
});

test("`payment_pending` is a success terminal state: navigates to payment", async () => {
  const { result } = await driveToTerminal("upload-456", "payment_pending");

  await waitFor(() => {
    expect(mockNavigate).toHaveBeenCalledWith(
      "/pay/bulk/upload-456",
      expect.objectContaining({ replace: true }),
    );
  });
  await waitFor(() => expect(result.current.isPolling).toBe(false));
});

// ─── 429 handling ────────────────────────────────────────────────────────────
//
// The user hit "Failed to load resource: 429" on /validate/ with no usable
// message. DRF's body is "Request was throttled. Expected available in 1893
// seconds." — a raw second count, and no hint that a file they already
// validated is still sitting there waiting to be submitted. Both of those
// mattered: their batch was validated and strandable, and they did not know it.

test("a throttled validate explains the wait in minutes and points at the saved file", async () => {
  mockValidate.mockRejectedValue({
    response: {
      status: 429,
      data: {
        detail: "Request was throttled. Expected available in 1893 seconds.",
      },
    },
  });

  const view = renderHook(() => useBulkUpload());
  await act(async () => {
    await view.result.current.validateFile(new File(["x"], "batch.csv"));
  });

  const err = view.result.current.uploadError;
  expect(err).toMatch(/about 32 minutes/);
  expect(err).toMatch(/already validated is saved/i);
  // The raw second count must not reach the user.
  expect(err).not.toMatch(/1893 seconds/);
});

test("a throttled submit gets the same explanation, not a bare 'Upload failed'", async () => {
  mockValidate.mockResolvedValue({ id: "validated-1" });
  mockCreate.mockRejectedValue({
    response: {
      status: 429,
      data: {
        detail: "Request was throttled. Expected available in 60 seconds.",
      },
    },
  });

  const view = renderHook(() => useBulkUpload());
  await act(async () => {
    await view.result.current.validateFile(new File(["x"], "batch.csv"));
  });
  await act(async () => {
    await view.result.current.startUpload();
  });

  expect(view.result.current.uploadError).toMatch(/Too many upload attempts/);
  expect(view.result.current.uploadError).toMatch(/about 1 minute\b/);
});

test("a non-429 validate error is untouched by the throttle path", async () => {
  mockValidate.mockRejectedValue({
    response: {
      status: 400,
      data: { detail: "Missing required column: reference" },
    },
  });

  const view = renderHook(() => useBulkUpload());
  await act(async () => {
    await view.result.current.validateFile(new File(["x"], "batch.csv"));
  });

  expect(view.result.current.uploadError).toBe(
    "Validation failed: Missing required column: reference",
  );
});
