/* eslint-env jest */
/**
 * Gate tests for the client-side service-area mirror.
 *
 * WHAT BROKE
 * ──────────
 * validateAddressInServiceArea() used a bare startsWith("MK") / startsWith("OX")
 * test, and let the radius rescue a prefix failure. The backend
 * (check_service_area) uses a curated outward-code allow-list and treats Tier 1
 * as a gate. So the client showed a green tick for postcodes the server would
 * refuse: the customer filled in the whole form and was rejected on submit.
 *
 * This mirror is a UX affordance and the backend stays authoritative — but a
 * mirror that disagrees with the authority is worse than no mirror. These tests
 * pin the agreement. Set membership itself is checked against the backend's real
 * frozenset by tests/bookings/test_service_area_mirror_parity.py.
 */

import { ALLOWED_OUTWARD_CODES, OUT_OF_AREA_MESSAGE, bookingApi, extractOutwardCode } from "./BookingApi";

const MK_CENTRE = { latitude: 52.0406, longitude: -0.7594 };
const OXFORD_CENTRE = { latitude: 51.752, longitude: -1.2577 };
// ~24 km from the MK hub: inside the radius, outside the service area.
const NORTHAMPTON = { latitude: 52.2405, longitude: -0.9027 };
const AYLESBURY = { latitude: 51.8156, longitude: -0.8084 };
const MANCHESTER = { latitude: 53.4808, longitude: -2.2426 };

const addr = (postal_code, coords = {}) => ({ postal_code, ...coords });

describe("extractOutwardCode", () => {
  test.each([
    ["MK9 1AA", "MK9"],
    ["OX49 5RJ", "OX49"],
    ["mk9 1aa", "MK9"],
    // No space: anchoring on the inward code is the only way to get this right.
    // A greedy front-match reads "MK91AA" as "MK91", which is not on the list —
    // that bug silently rejected every single-digit MK/OX postcode.
    ["MK91AA", "MK9"],
    ["OX495RJ", "OX49"],
    ["  MK9   1AA  ", "MK9"],
  ])("%s → %s", (input, expected) => {
    expect(extractOutwardCode(input)).toBe(expected);
  });

  test.each(["", "   ", "NOTAPOSTCODE", "12345", null, undefined])(
    "%p → null",
    (input) => {
      expect(extractOutwardCode(input)).toBeNull();
    }
  );
});

describe("validateAddressInServiceArea — Tier 1 is a gate", () => {
  test.each([
    ["NN1 1AA", NORTHAMPTON, "Northampton, ~24km from the MK hub"],
    ["HP20 1AA", AYLESBURY, "Aylesbury, ~28km from the MK hub"],
    ["LU1 1AA", { latitude: 51.8787, longitude: -0.42 }, "Luton, ~26km from the MK hub"],
  ])("%s is rejected despite being inside a hub radius (%s)", (postcode, coords) => {
    const result = bookingApi.validateAddressInServiceArea(addr(postcode, coords));
    expect(result.valid).toBe(false);
    expect(result.message).toBe(OUT_OF_AREA_MESSAGE);
  });

  test("an MK district that is not served is rejected", () => {
    // The old startsWith("MK") check accepted this. The backend never did.
    const result = bookingApi.validateAddressInServiceArea(addr("MK20 1AA", MK_CENTRE));
    expect(result.valid).toBe(false);
    expect(result.message).toBe(OUT_OF_AREA_MESSAGE);
  });

  test("an OX district that is not served is rejected", () => {
    expect(
      bookingApi.validateAddressInServiceArea(addr("OX21 1AA", OXFORD_CENTRE)).valid
    ).toBe(false);
  });

  test.each(["", "NOTAPOSTCODE", "12345"])(
    "unparseable postcode %p is rejected rather than let through",
    (postcode) => {
      expect(bookingApi.validateAddressInServiceArea(addr(postcode)).valid).toBe(false);
    }
  );
});

describe("validateAddressInServiceArea — accepted addresses", () => {
  test.each(["MK9 1AA", "MK1 1AA", "MK46 4AA", "OX1 1AA", "OX49 5RJ"])(
    "%s with no coordinates is accepted on Tier 1 alone",
    (postcode) => {
      expect(bookingApi.validateAddressInServiceArea(addr(postcode)).valid).toBe(true);
    }
  );

  test("MK postcode inside the MK hub radius is accepted", () => {
    expect(bookingApi.validateAddressInServiceArea(addr("MK9 1AA", MK_CENTRE)).valid).toBe(true);
  });

  test("Oxford is accepted even though it is ~47km from the MK hub", () => {
    expect(bookingApi.validateAddressInServiceArea(addr("OX1 1AA", OXFORD_CENTRE)).valid).toBe(true);
  });
});

describe("validateAddressInServiceArea — Tier 2 only narrows", () => {
  test("an allow-listed postcode with far-away coordinates is rejected", () => {
    const result = bookingApi.validateAddressInServiceArea(addr("MK9 1AA", MANCHESTER));
    expect(result.valid).toBe(false);
    expect(result.message).toMatch(/service radius/);
  });

  test("Tier 2 can never admit what Tier 1 rejected", () => {
    // Northampton coordinates are inside the MK radius; the postcode is not on
    // the list. There is no combination that makes this valid.
    expect(bookingApi.validateAddressInServiceArea(addr("NN1 1AA", NORTHAMPTON)).valid).toBe(false);
  });
});

describe("the allow-list itself", () => {
  test("contains the served districts and excludes the unserved ones", () => {
    for (const code of ["MK1", "MK9", "MK19", "MK40", "MK46", "OX1", "OX20", "OX49"]) {
      expect(ALLOWED_OUTWARD_CODES.has(code)).toBe(true);
    }
    for (const code of ["MK20", "MK39", "OX21", "OX24", "NN1", "HP20", "LU1", "M1", "SW1A"]) {
      expect(ALLOWED_OUTWARD_CODES.has(code)).toBe(false);
    }
  });
});
