/* eslint-env jest */
// Verifies the Parcel Details validation TIMING:
//   • a valid pre-filled value (Length = "2") shows NO error, ever — this is
//     the exact false "Length is required" case from the bug report.
//   • an invalid value shows nothing while typing and only surfaces its inline
//     error after the field is blurred (touched).

import { render, screen, fireEvent, act } from "@testing-library/react";

// framer-motion animates via layout effects that add noise under jsdom — render
// its motion.* elements as plain tags so we can assert on the DOM directly.
jest.mock("framer-motion", () => {
  const React = require("react");
  const MOTION_PROPS = new Set([
    "layout", "initial", "animate", "exit", "transition",
    "whileHover", "whileTap", "whileFocus", "whileInView", "variants",
  ]);
  const passthrough = (tag) => (props) => {
    const domProps = {};
    for (const k of Object.keys(props)) {
      if (!MOTION_PROPS.has(k)) domProps[k] = props[k];
    }
    return React.createElement(tag, domProps, props.children);
  };
  return {
    __esModule: true,
    motion: new Proxy({}, { get: (_t, key) => passthrough(typeof key === "string" ? key : "div") }),
    AnimatePresence: ({ children }) => children,
  };
});

import ParcelCard from "./ParcelCard";

const validParcel = {
  id: 1,
  weightKg: "2",
  dimensions: { length: "2", width: "22", height: "21" },
  fragile: false,
};

const noop = () => {};

function renderCard(overrides = {}) {
  return render(
    <ParcelCard
      parcel={overrides.parcel || validParcel}
      parcelIndex={0}
      onUpdate={overrides.onUpdate || noop}
      onRemove={noop}
      validation={overrides.validation}
      canRemove={false}
      totalParcels={1}
    />,
  );
}

beforeEach(() => jest.useFakeTimers());
afterEach(() => jest.useRealTimers());

test('a valid pre-filled Length never shows "Length is required"', () => {
  renderCard();
  act(() => {
    jest.advanceTimersByTime(400);
  });
  expect(screen.queryByText(/length is required/i)).toBeNull();
  expect(screen.queryByRole("alert")).toBeNull();
});

test("an invalid value shows no error while typing, then an error after blur", () => {
  const cardWith = (length) => (
    <ParcelCard
      parcel={{ ...validParcel, dimensions: { ...validParcel.dimensions, length } }}
      parcelIndex={0}
      onUpdate={noop}
      onRemove={noop}
      canRemove={false}
      totalParcels={1}
    />
  );
  const { rerender } = render(cardWith("2"));

  // The parent updates the parcel to an invalid "0" as the user types.
  act(() => {
    rerender(cardWith("0"));
    jest.advanceTimersByTime(400);
  });
  // While typing (field not yet blurred) NO error must appear.
  expect(screen.queryByText(/length must be greater than 0/i)).toBeNull();

  // Blur → the field is now "touched" → inline error appears.
  act(() => {
    fireEvent.blur(screen.getByLabelText("Length"));
    jest.advanceTimersByTime(400);
  });
  expect(screen.getByText(/length must be greater than 0/i)).toBeInTheDocument();
});

test("parent on-submit error is shown immediately (Next was clicked)", () => {
  renderCard({
    parcel: { ...validParcel, dimensions: { length: "", width: "22", height: "21" } },
    validation: { 0: { length: "Length is required" } },
  });
  expect(screen.getByText(/length is required/i)).toBeInTheDocument();
});
