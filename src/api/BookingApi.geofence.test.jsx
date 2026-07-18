/* eslint-env jest */
// Strict Milton Keynes + Oxford service-area gating on the client mirror
// (BookingApi.validateAddressInServiceArea). Mirrors the authoritative backend
// check in bookings/utils/service_area.py — corridor prefixes (NN/HP/LU) and
// the old CV47/SP4 extras are no longer accepted.
//
// ApiBase is mocked so importing BookingApi never touches import.meta.env.

jest.mock("./ApiBase", () => ({
  __esModule: true,
  ApiBase: class {
    constructor() {
      this.baseURL = "";
    }
    request() {
      return Promise.resolve({ data: {} });
    }
  },
}));

import { bookingApi } from "./BookingApi";

// MK town-centre-ish and Oxford coords (within the 40km radius of an anchor).
const MK = { latitude: 52.0406, longitude: -0.7594 };
const OX = { latitude: 51.752, longitude: -1.2577 };
const LONDON = { latitude: 51.5074, longitude: -0.1278 };

test("MK postcode with in-area coords is accepted", () => {
  const res = bookingApi.validateAddressInServiceArea({ postal_code: "MK9 1AA", ...MK });
  expect(res.valid).toBe(true);
});

test("OX postcode with in-area coords is accepted", () => {
  const res = bookingApi.validateAddressInServiceArea({ postal_code: "OX1 2JD", ...OX });
  expect(res.valid).toBe(true);
});

test("out-of-area postcode with no coords is rejected (LE17 from the bug report)", () => {
  const res = bookingApi.validateAddressInServiceArea({ postal_code: "LE17 6AP" });
  expect(res.valid).toBe(false);
  expect(res.message).toMatch(/Milton Keynes|Oxford/i);
});

test("corridor prefixes are no longer accepted (NN/HP/LU removed)", () => {
  for (const pc of ["NN12 7AA", "HP18 0AA", "LU7 0AA"]) {
    expect(bookingApi.validateAddressInServiceArea({ postal_code: pc }).valid).toBe(false);
  }
});

test("an MK-prefixed postcode whose coords are far away is rejected by the radius (Tier 2)", () => {
  const res = bookingApi.validateAddressInServiceArea({ postal_code: "MK9 1AA", ...LONDON });
  expect(res.valid).toBe(false);
  expect(res.message).toMatch(/service radius/i);
});
