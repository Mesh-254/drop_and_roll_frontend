/* eslint-env jest */
// The last hop of the duplicate-policy chain: what actually goes on the wire.
//
// The confirm step asks "retry or new batch?", the hook forwards the answer,
// and this is where it becomes a request field. Drop it here and the customer
// answers "book them again" while the backend applies its safe default and
// skips everything — the question would be theatre.
//
// The omission case matters just as much: every path that never asks (the admin
// one-shot API, an older client) must send NO duplicate_policy at all, so the
// backend default stands rather than being overwritten with a guess.

const mockPatch = jest.fn();

// ApiBase is a NAMED export and BulkUploadApi extends it, so the mock has to
// provide a real constructible class under that same name.
jest.mock("./ApiBase", () => {
  class ApiBase {
    constructor() {
      this.axiosInstance = { patch: (...a) => mockPatch(...a) };
    }
  }
  return { __esModule: true, ApiBase, default: ApiBase };
});

import BulkUploadApi from "./BulkUploadApi";

beforeEach(() => {
  mockPatch
    .mockReset()
    .mockResolvedValue({ data: { id: "u1", status: "pending" } });
});

test("create() sends the chosen policy alongside the submit", async () => {
  await BulkUploadApi.create("u1", { duplicatePolicy: "book_again" });

  expect(mockPatch).toHaveBeenCalledWith("/api/booking/bulk-uploads/u1/", {
    status: "submitted",
    duplicate_policy: "book_again",
  });
});

test("create() sends skip when that is the choice", async () => {
  await BulkUploadApi.create("u1", { duplicatePolicy: "skip" });

  expect(mockPatch).toHaveBeenCalledWith("/api/booking/bulk-uploads/u1/", {
    status: "submitted",
    duplicate_policy: "skip",
  });
});

test("create() omits the field entirely when no policy is given", async () => {
  await BulkUploadApi.create("u1");

  expect(mockPatch).toHaveBeenCalledWith("/api/booking/bulk-uploads/u1/", {
    status: "submitted",
  });
  const [, payload] = mockPatch.mock.calls[0];
  expect(payload).not.toHaveProperty("duplicate_policy");
});

test("create() still returns the response body", async () => {
  const result = await BulkUploadApi.create("u1", { duplicatePolicy: "skip" });

  expect(result).toEqual({ id: "u1", status: "pending" });
});
