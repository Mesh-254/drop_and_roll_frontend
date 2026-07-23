/* eslint-env jest */
// Tests for the label-download client methods (spec §1): filename comes from
// the server's Content-Disposition (never hard-coded), X-Labels-* counts are
// surfaced, and a 409 "still generating" is reported cleanly.

const mockAxios = jest.fn();

jest.mock("./ApiBase", () => ({
  __esModule: true,
  ApiBase: class {
    constructor() {
      // Delegate so mockAxios is read at call time, not at import (avoids TDZ).
      this.axiosInstance = (...args) => mockAxios(...args);
    }
  },
}));

import { bookingApi } from "./BookingApi";

let lastLink;
beforeEach(() => {
  mockAxios.mockReset();
  lastLink = null;
  // jsdom implements neither createObjectURL nor anchor-click navigation.
  window.URL.createObjectURL = jest.fn(() => "blob:mock");
  window.URL.revokeObjectURL = jest.fn();
  const realCreate = document.createElement.bind(document);
  jest.spyOn(document, "createElement").mockImplementation((tag) => {
    const el = realCreate(tag);
    if (tag === "a") {
      el.click = jest.fn();
      lastLink = el;
    }
    return el;
  });
});

afterEach(() => document.createElement.mockRestore?.());

test("downloadAllBulkLabels parses the Content-Disposition filename and surfaces counts", async () => {
  mockAxios.mockResolvedValue({
    data: new Blob(["%PDF-1.4"], { type: "application/pdf" }),
    headers: {
      "content-disposition": 'attachment; filename="labels_abc123.pdf"',
      "x-labels-ready": "2",
      "x-labels-pending": "1",
    },
  });

  const res = await bookingApi.downloadAllBulkLabels("abc123");

  expect(res.success).toBe(true);
  expect(res.ready).toBe(2);
  expect(res.pending).toBe(1);
  // filename came from the header, not a client-side guess
  expect(lastLink.download).toBe("labels_abc123.pdf");
  const [cfg] = mockAxios.mock.calls[0];
  expect(cfg.url).toBe("/api/booking/bulk-uploads/abc123/labels/");
  expect(cfg.responseType).toBe("blob");
});

test("downloadBookingLabel falls back to a default name when no header", async () => {
  mockAxios.mockResolvedValue({ data: new Blob(["%PDF"]), headers: {} });
  const res = await bookingApi.downloadBookingLabel("bk-1");
  expect(res.success).toBe(true);
  expect(lastLink.download).toBe("label-bk-1.pdf");
});

test("a 409 (labels still generating) is reported, not thrown", async () => {
  mockAxios.mockRejectedValue({ response: { status: 409 } });
  const res = await bookingApi.downloadAllBulkLabels("abc123");
  expect(res.success).toBe(false);
  expect(res.status).toBe(409);
  expect(res.message).toMatch(/still generating/i);
});
