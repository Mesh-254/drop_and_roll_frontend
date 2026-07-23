/* eslint-env jest */
// Unit tests for bookingApi.getInstantQuote — the client half of the homepage
// instant-quote widget. Verifies it normalizes the backend's three outcomes
// (price / out-of-area 200 / 4xx field error / 429) into one predictable shape
// the Hero widget can branch on.
//
// ApiBase is mocked so `request` is fully controllable and importing BookingApi
// never touches import.meta.env or the network.

const mockRequest = jest.fn();

jest.mock("./ApiBase", () => ({
  __esModule: true,
  ApiBase: class {
    constructor() {
      this.baseURL = "";
    }
    request(...args) {
      return mockRequest(...args);
    }
  },
}));

import { bookingApi } from "./BookingApi";

beforeEach(() => mockRequest.mockReset());

const PAYLOAD = {
  pickupPostalCode: "MK91AA",
  dropoffPostalCode: "OX11AA",
  parcelCount: 2,
  weightKg: "5",
  serviceTypeId: "svc-1",
};

test("in-area quote returns success with the price payload", async () => {
  mockRequest.mockResolvedValue({
    data: { in_service_area: true, currency: "GBP", price: 22.0, distance_km: 47.1 },
    status: 200,
  });

  const res = await bookingApi.getInstantQuote(PAYLOAD);

  expect(res.success).toBe(true);
  expect(res.data.price).toBe(22.0);
  // Postcode-only body, snake_case, service id included, no auth.
  const [url, opts] = mockRequest.mock.calls[0];
  expect(url).toBe("/api/booking/quotes/instant/");
  expect(opts.includeAuth).toBe(false);
  expect(opts.data).toMatchObject({
    pickup_postal_code: "MK91AA",
    dropoff_postal_code: "OX11AA",
    parcel_count: 2,
    weight_kg: "5",
    service_type_id: "svc-1",
  });
});

test("out-of-area (HTTP 200, in_service_area:false) maps to outOfArea, not success", async () => {
  mockRequest.mockResolvedValue({
    data: {
      in_service_area: false,
      reason: "out_of_service_area",
      field: "dropoff_postal_code",
      detail: "Delivery postcode is outside our service area.",
    },
    status: 200,
  });

  const res = await bookingApi.getInstantQuote(PAYLOAD);

  expect(res.success).toBe(false);
  expect(res.outOfArea).toBe(true);
  expect(res.field).toBe("dropoff_postal_code");
  expect(res.message).toMatch(/service area/i);
});

test("400 postcode-not-found surfaces the offending field", async () => {
  mockRequest.mockRejectedValue({
    status: 400,
    data: { reason: "postcode_not_found", field: "pickup_postal_code", detail: "Postcode 'ZZ99 9ZZ' not found." },
  });

  const res = await bookingApi.getInstantQuote(PAYLOAD);

  expect(res.success).toBe(false);
  expect(res.outOfArea).toBeUndefined();
  expect(res.field).toBe("pickup_postal_code");
  expect(res.reason).toBe("postcode_not_found");
});

test("429 rate limit yields a friendly rateLimited flag", async () => {
  mockRequest.mockRejectedValue({ status: 429, data: {} });

  const res = await bookingApi.getInstantQuote(PAYLOAD);

  expect(res.success).toBe(false);
  expect(res.rateLimited).toBe(true);
  expect(res.message).toMatch(/too many/i);
});

test("optional ids are omitted from the body when not provided", async () => {
  mockRequest.mockResolvedValue({ data: { in_service_area: true, price: 10, currency: "GBP", distance_km: 1 }, status: 200 });

  await bookingApi.getInstantQuote({
    pickupPostalCode: "MK91AA",
    dropoffPostalCode: "OX11AA",
    weightKg: "3",
  });

  const body = mockRequest.mock.calls[0][1].data;
  expect(body).not.toHaveProperty("service_type_id");
  expect(body).not.toHaveProperty("shipping_type_id");
  expect(body.parcel_count).toBe(1); // default
});
