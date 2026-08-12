/**
 * utils/checkoutStrategy.js
 * ══════════════════════════════════════════════════════════════════════════════
 * What can a payment intent actually be used to pay with?
 *
 * ── Why this is a function, and why it has three answers ─────────────────────
 * It used to be one line inside BulkPaymentPage — `if (!intent.client_secret)
 * show "Payment Unavailable"` — and that line was the whole of the reported
 * bug.
 *
 * The server has two code paths for a bulk intent. The CREATE path returns
 * client_secret. The CACHED path — taken whenever a PENDING transaction with
 * gateway credentials already exists for this batch, which is every visit after
 * the first — returned checkout_url and no client_secret, because it predates
 * the switch from hosted to embedded Stripe checkout.
 *
 * So the payment page worked exactly once per batch. The wizard's
 * auto-navigation hits the create path and mounts fine; the dashboard "Pay"
 * button and the "Pay Now to Schedule Pickup" link in the payment email — both
 * of which are, by definition, later visits — hit the cached path and rendered
 * "Payment Unavailable" every single time. Which is why the fault looked like it
 * belonged to those two buttons rather than to the page they both open.
 *
 * The server side is fixed (PaymentService._bulk_intent_from_cached now returns
 * client_secret). This stays because a screen that takes money should not have
 * one point of failure, and because a hosted URL is a WORSE experience but a
 * working one — strictly better than refusing money a customer is offering.
 */

/**
 * @param {object|null} intent  the /initiate-bulk/ response
 * @returns {{kind: "embedded"|"hosted"|"error", value: string|null}}
 *
 * Precedence is deliberate: embedded first (the customer stays on Drop & Roll),
 * hosted only as a fallback, error only when there is genuinely nothing to pay
 * with.
 */
export function chooseCheckoutStrategy(intent) {
  if (intent?.client_secret)
    return { kind: "embedded", value: intent.client_secret };
  if (intent?.checkout_url)
    return { kind: "hosted", value: intent.checkout_url };
  return { kind: "error", value: null };
}
