// Behaviour tests for the postcode-ONLY address search (spec §A + §E):
//   • free-text queries never call the backend proxy and show the
//     postcode-only hint instead;
//   • postcode-shaped queries do call the proxy and render suggestions;
//   • a proxy failure (upstream_error) switches to the Google fallback tier
//     instead of dead-ending — the §E regression;
//   • the confirmation modal shows the provenance badge and full premise
//     detail from the lookup.

import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";

const mockAutocomplete = jest.fn();
const mockDetails = jest.fn();

jest.mock("../../api/BookingApi", () => ({
  bookingApi: {
    autocompleteAddress: (...a) => mockAutocomplete(...a),
    getPostcodeAddressDetails: (...a) => mockDetails(...a),
    validateAddressInServiceArea: () => ({ valid: true }),
  },
}));

// Google fallback tier: the maps library never loads in jsdom — return null
// so the Google effect stays dormant. Mode switching is still observable via
// the fallback notice text.
jest.mock("@vis.gl/react-google-maps", () => ({ useMapsLibrary: () => null }));

import PostcodeFirstAutocomplete from "./PostcodeFirstAutocomplete";

const type = (value) => {
  fireEvent.change(screen.getByRole("combobox"), { target: { value } });
  act(() => {
    jest.advanceTimersByTime(350); // past the 300ms debounce
  });
};

describe("PostcodeFirstAutocomplete — postcode-only gate", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    mockAutocomplete.mockReset();
    mockDetails.mockReset();
  });
  afterEach(() => {
    jest.useRealTimers();
  });

  test("free-text query never hits the API and shows the postcode-only hint", async () => {
    render(<PostcodeFirstAutocomplete label="Pickup Address" onSelect={jest.fn()} />);
    type("Central Milton Keynes");

    expect(mockAutocomplete).not.toHaveBeenCalled();
    expect(await screen.findByText(/works by postcode only/i)).toBeInTheDocument();
  });

  test("postcode-shaped query calls the proxy and renders suggestions", async () => {
    mockAutocomplete.mockResolvedValue({
      success: true,
      results: [{ id: "paf_1", suggestion: "1 Midsummer Boulevard, MK9 1AA" }],
    });
    render(<PostcodeFirstAutocomplete label="Pickup Address" onSelect={jest.fn()} />);
    type("MK9 1AA");

    await waitFor(() => expect(mockAutocomplete).toHaveBeenCalledWith("MK9 1AA"));
    expect(await screen.findByText(/1 Midsummer Boulevard/)).toBeInTheDocument();
  });

  test("upstream_error from the proxy engages the Google fallback tier (§E)", async () => {
    mockAutocomplete.mockResolvedValue({
      success: false,
      reason: "upstream_error",
      message: "Address lookup service is temporarily unavailable.",
    });
    render(<PostcodeFirstAutocomplete label="Pickup Address" onSelect={jest.fn()} />);
    type("MK9 1AA");

    // The component must switch modes and tell the user — not show an error
    // and stop.
    expect(
      await screen.findByText(/switching to Google Maps/i),
    ).toBeInTheDocument();
  });

  test("confirmation modal shows premise detail and the Ideal Postcodes badge", async () => {
    mockAutocomplete.mockResolvedValue({
      success: true,
      results: [{ id: "paf_1", suggestion: "Unit 3, Sunrise Parkway, MK14 6LS" }],
    });
    mockDetails.mockResolvedValue({
      success: true,
      in_service_area: true,
      address: {
        line1: "Unit 3, Sunrise Parkway",
        line2: "Linford Wood",
        city: "Milton Keynes",
        region: "Buckinghamshire",
        postal_code: "MK14 6LS",
        country: "GB",
        latitude: 52.06,
        longitude: -0.77,
        detail: {
          organisation_name: "Acme Ltd",
          line_2: "Linford Wood",
          line_3: "East Block",
          county: "Buckinghamshire",
        },
        meta: { source: "ideal_postcodes" },
      },
    });
    const onSelect = jest.fn();
    render(<PostcodeFirstAutocomplete label="Pickup Address" onSelect={onSelect} />);
    type("MK14 6LS");

    fireEvent.click(await screen.findByText(/Unit 3, Sunrise Parkway, MK14 6LS/));

    expect(await screen.findByText("Is this correct?")).toBeInTheDocument();
    expect(screen.getByTestId("address-source-badge")).toHaveTextContent("Ideal Postcodes");
    expect(screen.getByText("Acme Ltd")).toBeInTheDocument();
    expect(screen.getByText("East Block")).toBeInTheDocument();

    fireEvent.click(screen.getByText(/Yes, that's right/));
    expect(onSelect).toHaveBeenCalledWith(
      expect.objectContaining({
        line1: "Unit 3, Sunrise Parkway",
        postal_code: "MK14 6LS",
        latitude: 52.06,
        longitude: -0.77,
      }),
    );
    // detail is display-only — never handed to the parent/Address model
    expect(onSelect.mock.calls[0][0].detail).toBeUndefined();
  });
});

describe("PostcodeFirstAutocomplete — paid resolve is cached per session (spec §B)", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    mockAutocomplete.mockReset();
    mockDetails.mockReset();
  });
  afterEach(() => {
    jest.useRealTimers();
  });

  test("re-selecting an already-resolved suggestion does not burn a second paid lookup", async () => {
    mockAutocomplete.mockResolvedValue({
      success: true,
      results: [{ id: "paf_15068916", suggestion: "1 Midsummer Boulevard, MK9 1AA" }],
    });
    mockDetails.mockResolvedValue({
      success: true,
      in_service_area: true,
      address: {
        line1: "1 Midsummer Boulevard",
        city: "Milton Keynes",
        postal_code: "MK9 1AA",
        country: "GB",
        latitude: 52.04,
        longitude: -0.76,
        detail: {},
        meta: { source: "ideal_postcodes" },
      },
    });

    render(<PostcodeFirstAutocomplete label="Pickup Address" onSelect={jest.fn()} />);
    type("MK9 1AA");

    // First selection — resolves via the API (the paid call)
    fireEvent.click(await screen.findByText(/1 Midsummer Boulevard, MK9 1AA/));
    expect(await screen.findByText("Is this correct?")).toBeInTheDocument();
    expect(mockDetails).toHaveBeenCalledTimes(1);
    expect(mockDetails).toHaveBeenCalledWith("paf_15068916");

    // User cancels the confirm modal, reopens the dropdown, re-picks the
    // same suggestion — served from cache, NOT a second paid resolve.
    fireEvent.click(screen.getByText("Cancel"));
    fireEvent.focus(screen.getByRole("combobox"));
    fireEvent.click(await screen.findByText(/1 Midsummer Boulevard, MK9 1AA/));

    expect(await screen.findByText("Is this correct?")).toBeInTheDocument();
    expect(mockDetails).toHaveBeenCalledTimes(1);
  });
});
