/* eslint-env jest */
// The last hop of the corrections-declaration chain: what goes on the wire.
//
// The confirm step asks "new batch or corrections to an earlier upload?" and
// this is where that answer becomes a request field. Drop it here and the
// customer marks an upload as corrections, the backend never hears about it,
// duplicate_policy is not forced to skip, and every row they already booked
// books a second time. The question would be worse than theatre: it would be a
// promise the system does not keep.
//
// The omission case matters as much. An ordinary upload must send NO
// corrects_upload key at all — an empty string would reach the backend as a
// declaration with no parent and be rejected, turning every normal submit into
// a 400.

const mockPatch = jest.fn();
const mockGet = jest.fn();

jest.mock("./ApiBase", () => {
  class ApiBase {
    constructor() {
      this.axiosInstance = {
        patch: (...a) => mockPatch(...a),
        get: (...a) => mockGet(...a),
      };
    }
  }
  return { __esModule: true, ApiBase, default: ApiBase };
});

import BulkUploadApi from "./BulkUploadApi";

beforeEach(() => {
  mockPatch.mockReset().mockResolvedValue({ data: { id: "u1", status: "pending" } });
  mockGet.mockReset().mockResolvedValue({ data: { results: [] } });
});

test("create() sends the declared parent batch", async () => {
  await BulkUploadApi.create("u1", { correctsUpload: "parent-1" });

  expect(mockPatch).toHaveBeenCalledWith("/api/booking/bulk-uploads/u1/", {
    status: "submitted",
    corrects_upload: "parent-1",
  });
});

test("an ordinary upload sends no corrects_upload key at all", async () => {
  await BulkUploadApi.create("u1", {});

  const [, payload] = mockPatch.mock.calls[0];
  expect(payload).toEqual({ status: "submitted" });
  expect("corrects_upload" in payload).toBe(false);
});

test("an empty parent is treated as absent, never sent as an empty string", async () => {
  await BulkUploadApi.create("u1", { correctsUpload: "" });

  const [, payload] = mockPatch.mock.calls[0];
  expect("corrects_upload" in payload).toBe(false);
});

test("a corrections submit does not also send a duplicate policy", async () => {
  // The backend rejects a conflicting policy alongside the declaration, and the
  // declaration already forces skip. Sending both is at best redundant and at
  // worst a 400 on a submit the customer filled in correctly.
  await BulkUploadApi.create("u1", {
    correctsUpload: "parent-1",
    duplicatePolicy: "book_again",
  });

  const [, payload] = mockPatch.mock.calls[0];
  expect(payload).toEqual({
    status: "submitted",
    corrects_upload: "parent-1",
  });
});

test("listCorrectable() reads the picker endpoint", async () => {
  mockGet.mockResolvedValue({
    data: { results: [{ id: "p1", label: "March Week 2 · 30 failed · 04 Aug 2026" }] },
  });

  const out = await BulkUploadApi.listCorrectable();

  expect(mockGet).toHaveBeenCalledWith("/api/booking/bulk-uploads/correctable/");
  expect(out.results).toHaveLength(1);
});
