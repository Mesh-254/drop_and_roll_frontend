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
  mockCreate.mockResolvedValue({ id: uploadId, status: "processing", customer_type: "PREPAID" });
  mockGetStatus.mockResolvedValue({ status: terminalStatus, customer_type: "PREPAID" });

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
