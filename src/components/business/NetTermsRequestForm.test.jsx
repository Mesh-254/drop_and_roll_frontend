/* eslint-env jest */
// The "Apply for NET Payment Terms" modal must render its package cards from the
// admin-managed NetTermsPackage catalogue (GET /net-terms-packages/), not the
// hardcoded fallback. On fetch failure it must still render the fallback cards
// so the modal never breaks.

import { render, screen, act } from "@testing-library/react";

// framer-motion: render motion.* as plain tags (see ParcelCard.test.jsx).
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

jest.mock("../../api/BusinessApi", () => ({
  __esModule: true,
  default: {
    getNetTermsPackages: jest.fn(),
    submitNetTermsRequest: jest.fn(),
  },
}));

import BusinessApi from "../../api/BusinessApi";
import NetTermsRequestForm from "./NetTermsRequestForm";

const noop = () => {};

// One admin package with values that could NOT come from the hardcoded fallback
// (Gold / Net 90 / £50,000 / 0.75%), proving the cards are DB-driven.
const API_PACKAGES = [
  {
    id: "abc",
    slug: "gold",
    label: "Gold",
    credit_limit: "50000.00",
    fee_percentage: "0.75",
    net_terms_slug: "net_90",
    net_terms_label: "Net 90",
    net_terms_days: 90,
    is_default: true,
    display_order: 1,
  },
];

async function renderForm() {
  await act(async () => {
    render(
      <NetTermsRequestForm onClose={noop} onSuccess={noop} existingRequest={null} />
    );
  });
}

afterEach(() => jest.clearAllMocks());

test("renders package cards from the admin API, not the hardcoded fallback", async () => {
  BusinessApi.getNetTermsPackages.mockResolvedValue(API_PACKAGES);
  await renderForm();

  expect(BusinessApi.getNetTermsPackages).toHaveBeenCalledTimes(1);
  // Admin-sourced label / terms / limit / fee are on screen…
  expect(await screen.findByText("Gold")).toBeInTheDocument();
  expect(screen.getByText(/NET 90/)).toBeInTheDocument();
  expect(screen.getByText(/£50,000/)).toBeInTheDocument();
  expect(screen.getByText(/0\.75%/)).toBeInTheDocument();
  // …and the hardcoded fallback tiers are NOT.
  expect(screen.queryByText("Starter")).not.toBeInTheDocument();
  expect(screen.queryByText("Enterprise")).not.toBeInTheDocument();
});

test("falls back to the built-in cards when the API call fails", async () => {
  BusinessApi.getNetTermsPackages.mockRejectedValue(new Error("network"));
  await renderForm();

  expect(await screen.findByText("Starter")).toBeInTheDocument();
  expect(screen.getByText("Pro")).toBeInTheDocument();
  expect(screen.getByText("Enterprise")).toBeInTheDocument();
});

test("falls back when the API returns an empty list", async () => {
  BusinessApi.getNetTermsPackages.mockResolvedValue([]);
  await renderForm();

  expect(await screen.findByText("Starter")).toBeInTheDocument();
  expect(screen.getByText("Pro")).toBeInTheDocument();
});
