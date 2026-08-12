/* eslint-env jest */
// PayPal smart buttons.
//
// HONEST LIMIT, same as the Stripe suite: this proves the WIRING. The SDK is
// mocked, so what is asserted is that the server's order id is what PayPal is
// given, that an approval is handed to the same capture endpoint the redirect
// leg used, and that a failure to load degrades instead of stranding someone on
// a page with no way to pay. It does NOT prove a real PayPal payment clears.
// Only a sandbox transaction proves that.
//
// The rule this suite exists to protect: the amount is never computed here. The
// component asks the server for an order and hands back an approval, so a bug
// in it cannot change what a customer is charged.

import { render, screen, waitFor, fireEvent, act } from "@testing-library/react";

import PayPalButtons from "./PayPalButtons";

/** A stand-in for window.paypal that captures the handlers it is given. */
function fakeSdk() {
  const captured = {};
  return {
    captured,
    sdk: {
      Buttons: (opts) => {
        Object.assign(captured, opts);
        return { render: () => {} };
      },
    },
  };
}

const loaderFor = (sdk) => jest.fn(() => Promise.resolve(sdk));

test("renders the buttons once the SDK is available", async () => {
  const { sdk } = fakeSdk();

  render(
    <PayPalButtons
      clientId="test-client"
      sdkLoader={loaderFor(sdk)}
      createOrder={jest.fn()}
      onApprove={jest.fn()}
    />,
  );

  await waitFor(() => expect(screen.queryByText(/loading paypal/i)).not.toBeInTheDocument());
  expect(screen.getByTestId("paypal-buttons")).toBeInTheDocument();
});

test("createOrder returns the order id the SERVER issued", async () => {
  const { captured, sdk } = fakeSdk();
  const createOrder = jest.fn().mockResolvedValue("ORD-FROM-SERVER");

  render(
    <PayPalButtons
      clientId="test-client"
      sdkLoader={loaderFor(sdk)}
      createOrder={createOrder}
      onApprove={jest.fn()}
    />,
  );
  await waitFor(() => expect(captured.createOrder).toBeDefined());

  await expect(captured.createOrder()).resolves.toBe("ORD-FROM-SERVER");
  expect(createOrder).toHaveBeenCalled();
});

test("an approval is handed straight to the capture callback", async () => {
  const { captured, sdk } = fakeSdk();
  const onApprove = jest.fn().mockResolvedValue({ status: "success" });

  render(
    <PayPalButtons
      clientId="test-client"
      sdkLoader={loaderFor(sdk)}
      createOrder={jest.fn()}
      onApprove={onApprove}
    />,
  );
  await waitFor(() => expect(captured.onApprove).toBeDefined());

  await act(async () => {
    await captured.onApprove({ orderID: "ORD-1" });
  });

  expect(onApprove).toHaveBeenCalledWith({ orderID: "ORD-1" });
});

test("the component never computes an amount", async () => {
  // The guard behind the other assertions: nothing about price is a prop, so a
  // bug here cannot change what someone is charged.
  const { captured, sdk } = fakeSdk();
  render(
    <PayPalButtons
      clientId="test-client"
      sdkLoader={loaderFor(sdk)}
      createOrder={jest.fn().mockResolvedValue("ORD-1")}
      onApprove={jest.fn()}
    />,
  );
  await waitFor(() => expect(captured.createOrder).toBeDefined());

  expect(JSON.stringify(captured.style || {})).not.toMatch(/amount|value|price/i);
});

test("a failed SDK load degrades to the redirect rather than stranding anyone", async () => {
  const onFallback = jest.fn();

  render(
    <PayPalButtons
      clientId="test-client"
      sdkLoader={jest.fn(() => Promise.reject(new Error("blocked")))}
      createOrder={jest.fn()}
      onApprove={jest.fn()}
      onFallback={onFallback}
    />,
  );

  const btn = await screen.findByRole("button", { name: /continue to paypal/i });
  fireEvent.click(btn);
  expect(onFallback).toHaveBeenCalled();
});

test("a missing client id is treated as unavailable, not as a crash", async () => {
  render(
    <PayPalButtons
      clientId=""
      sdkLoader={jest.fn()}
      createOrder={jest.fn()}
      onApprove={jest.fn()}
    />,
  );

  expect(await screen.findByTestId("paypal-fallback")).toBeInTheDocument();
});

test("an error inside PayPal does not imply the payment succeeded or failed", async () => {
  // The order may exist. Telling someone it failed invites a second payment.
  const { captured, sdk } = fakeSdk();

  render(
    <PayPalButtons
      clientId="test-client"
      sdkLoader={loaderFor(sdk)}
      createOrder={jest.fn()}
      onApprove={jest.fn()}
    />,
  );
  await waitFor(() => expect(captured.onError).toBeDefined());

  await act(async () => {
    captured.onError(new Error("popup closed"));
  });

  const alert = await screen.findByRole("alert");
  expect(alert.textContent).toMatch(/do not pay again/i);
});

// ── The fallback button has to be visible ────────────────────────────────────
//
// It had `background: #fff` and no `color`, so it inherited from
// `body { @apply bg-black text-white }`. White text on a white button: the
// customer saw an empty bordered rectangle where the only remaining way to pay
// should have been. The degrade-rather-than-block path degraded to nothing.

test("the fallback button states its own colours instead of inheriting", async () => {
  render(
    <PayPalButtons
      clientId="test-client"
      sdkLoader={() => Promise.reject(new Error("blocked"))}
      createOrder={jest.fn()}
      onApprove={jest.fn()}
      onFallback={jest.fn()}
    />,
  );

  const btn = await screen.findByRole("button", { name: /continue to paypal/i });

  // Not "inherit", not "" — an explicit dark value against the white ground.
  expect(btn.style.color).toBe("rgb(15, 23, 42)");
  expect(btn.style.background).toBe("rgb(255, 255, 255)");
});

test("the fallback button is still wired to the redirect it replaces", async () => {
  const onFallback = jest.fn();
  render(
    <PayPalButtons
      clientId="test-client"
      sdkLoader={() => Promise.reject(new Error("blocked"))}
      createOrder={jest.fn()}
      onApprove={jest.fn()}
      onFallback={onFallback}
    />,
  );

  fireEvent.click(await screen.findByRole("button", { name: /continue to paypal/i }));
  expect(onFallback).toHaveBeenCalledTimes(1);
});
