/**
 * Production-build configuration guard.
 *
 * Vite INLINES import.meta.env.VITE_* at build time, so whatever is loaded during the build
 * is frozen into the bundle. `npm run build` runs in mode "production", which loads
 * .env.production (and .env.production.local) on top of .env — but if neither exists the
 * build silently falls back to .env, i.e. the developer's local values. That produced a
 * dist/ hardcoded to http://127.0.0.1:8000 with a pk_test_ Stripe key: a deploy that looks
 * entirely successful and yields a site that cannot reach its own API.
 *
 * Nothing downstream catches it — the bundle is valid, the rsync succeeds, nginx serves it
 * happily, and the failure only shows up as a dead site. So fail at build time instead.
 *
 * Lives in its own module (rather than inline in vite.config.js) so it is unit-testable
 * without loading the Vite plugin chain.
 */

/** Cloudflare's documented always-passes Turnstile test key prefix. */
export const TURNSTILE_TEST_KEY_PREFIX = "1x00000000000000000000";

const LOCAL_ADDRESS_RE = /localhost|127\.0\.0\.1|0\.0\.0\.0|\[::1\]/;

/** Names that must never carry a VITE_ prefix — that would publish them to every visitor. */
const SERVER_SECRET_RE = /^VITE_.*(SECRET|PASSWORD|PRIVATE|IDEAL_POSTCODES)/i;

/**
 * The shape every placeholder in .env.example takes ("your-google-maps-browser-key").
 * Copying that file to .env.production and building from it produces a bundle that passes
 * every presence check and works for nothing — the placeholder is a non-empty string, so
 * only its content gives it away.
 *
 * `\b` is wrong here: the placeholders appear as `pk_test_your-stripe-publishable-key`,
 * and `_` is a word character, so there is no boundary before `your`. Match on anything
 * that is not alphanumeric instead.
 */
const PLACEHOLDER_RE = /(^|[^a-z0-9])your-/i;

/**
 * The one deliberate escape hatch: a client demo needs the site up before the live Stripe
 * account exists. Set ALLOW_TEST_STRIPE_KEY=1 and a pk_test_ key stops being fatal.
 *
 * Three properties make this safe to have at all, and all three are load-bearing:
 *
 *   1. It is read from process.env by the CALLER, never from the loadEnv map. Put it in
 *      .env.production and it does nothing — see vite.config.js. An escape hatch that can
 *      live in a file is not an escape hatch, it is a permanent silent downgrade that
 *      outlives the demo it was added for.
 *   2. It must be exactly "1". Not "true", not "yes", not any truthy string. Someone has
 *      to mean it.
 *   3. It relaxes THIS check and nothing else. A localhost origin, a missing Maps key, a
 *      leaked secret and an .env.example placeholder all stay fatal with the flag set.
 *
 * A test-mode key on a public site is not cosmetic: Stripe test mode rejects real cards,
 * so anyone who is not the client gets a payment step that cannot succeed.
 */
export const TEST_STRIPE_OVERRIDE_VAR = "ALLOW_TEST_STRIPE_KEY";

/** The banner assertProductionEnv prints when the hatch is used. */
export const TEST_STRIPE_OVERRIDE_WARNING =
  `\n!! ${TEST_STRIPE_OVERRIDE_VAR}=1 — building with a pk_test_ Stripe key.\n` +
  "!! Test mode REJECTS real cards: every visitor who is not demoing hits a payment\n" +
  "!! step that cannot complete. Bookings will not take money.\n" +
  "!! Demo builds only. Rebuild with the pk_live_ key before the site takes traffic.\n";

/**
 * @param {Record<string, string>} env - full env map (loadEnv(mode, cwd, "")).
 * @param {{allowTestStripeKey?: boolean}} [options] - see TEST_STRIPE_OVERRIDE_VAR. Passed
 *   in by the caller from process.env, deliberately not read off `env`.
 * @returns {string[]} human-readable problems; empty means the build may proceed.
 */
export function collectProductionEnvProblems(env, options = {}) {
  const { allowTestStripeKey = false } = options;
  const problems = [];
  const backendUrl = env.VITE_NEXT_PUBLIC_BACKEND_URL;

  if (!backendUrl) {
    problems.push(
      "VITE_NEXT_PUBLIC_BACKEND_URL is not set — the bundle would have no API origin.",
    );
  } else if (LOCAL_ADDRESS_RE.test(backendUrl)) {
    problems.push(
      `VITE_NEXT_PUBLIC_BACKEND_URL is "${backendUrl}", a local address. ` +
        "A production bundle must point at the public origin (https://dropnroll.co.uk).",
    );
  } else if (!backendUrl.startsWith("https://")) {
    // WebSocket URLs derive from this (https -> wss). An http:// origin also bakes in an
    // insecure ws:// socket, which browsers block from an https page.
    problems.push(
      `VITE_NEXT_PUBLIC_BACKEND_URL must use https:// in production (got "${backendUrl}").`,
    );
  }

  if (!env.VITE_PUBLIC_GOOGLE_CLIENT_ID) {
    problems.push(
      "VITE_PUBLIC_GOOGLE_CLIENT_ID is not set — Google sign-in would fail silently.",
    );
  }

  // Passed straight into <APIProvider apiKey={...}> in GetQuoteBook.jsx. Unset means the
  // quote-and-book address step (the Places fallback) renders Google's "this page can't
  // load Google Maps correctly" overlay instead of the address step on a build that
  // deploys perfectly. The admin live-tracking map was migrated to Leaflet and no longer
  // depends on this key.
  const mapsKey = env.VITE_GOOGLE_MAPS_BROWSER_KEY || env.VITE_GOOGLE_MAPS_API_KEY;
  if (!mapsKey) {
    problems.push(
      "VITE_GOOGLE_MAPS_API_KEY is not set — the quote/booking address step (Places fallback) fails to load.",
    );
  }

  if (
    env.VITE_TURNSTILE_SITE_KEY &&
    env.VITE_TURNSTILE_SITE_KEY.startsWith(TURNSTILE_TEST_KEY_PREFIX)
  ) {
    problems.push(
      "VITE_TURNSTILE_SITE_KEY is Cloudflare's always-passes TEST key — use the real site key.",
    );
  }

  // Required, not merely non-test: PaymentPage and InvoiceDetailPage both call
  // loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY) at module scope. Unset means
  // loadStripe(undefined), which fails and takes both payment routes with it — a deploy
  // that looks green while nobody can pay.
  if (!env.VITE_STRIPE_PUBLISHABLE_KEY) {
    problems.push(
      "VITE_STRIPE_PUBLISHABLE_KEY is not set — loadStripe(undefined) breaks the payment and invoice pages.",
    );
  } else if (
    env.VITE_STRIPE_PUBLISHABLE_KEY.startsWith("pk_test_") &&
    !allowTestStripeKey
  ) {
    problems.push(
      "VITE_STRIPE_PUBLISHABLE_KEY is a pk_test_ key — production needs the pk_live_ key.\n" +
        `    For a client demo before the live account exists: ${TEST_STRIPE_OVERRIDE_VAR}=1 ./deploy.sh`,
    );
  }

  for (const [name, value] of Object.entries(env)) {
    if (SERVER_SECRET_RE.test(name)) {
      problems.push(
        `${name} looks like a server-side secret; anything VITE_-prefixed is inlined into the public bundle.`,
      );
    }
    if (name.startsWith("VITE_") && PLACEHOLDER_RE.test(String(value ?? ""))) {
      problems.push(
        `${name} is still the .env.example placeholder ("${value}") — it is a real string, ` +
          "so every presence check passes and nothing works.",
      );
    }
  }

  return problems;
}

/**
 * Throws with an actionable message if the production env is unfit to build from.
 *
 * @param {Record<string, string>} env
 * @param {{allowTestStripeKey?: boolean}} [options]
 */
export function assertProductionEnv(env, options = {}) {
  const problems = collectProductionEnvProblems(env, options);

  // Printed whether or not other problems exist, and before the throw: if the build is
  // about to fail for an unrelated reason, the operator should still see that the hatch
  // is open, not discover it on the next run.
  if (
    options.allowTestStripeKey &&
    String(env.VITE_STRIPE_PUBLISHABLE_KEY ?? "").startsWith("pk_test_")
  ) {
    console.warn(TEST_STRIPE_OVERRIDE_WARNING);
  }

  if (!problems.length) return;

  throw new Error(
    "\n\nProduction build blocked — the bundle would ship development configuration:\n" +
      problems.map((p) => `  - ${p}`).join("\n") +
      "\n\nSet these in .env.production (gitignored) or pass them as build env, e.g.\n" +
      "  VITE_NEXT_PUBLIC_BACKEND_URL=https://dropnroll.co.uk npm run build\n" +
      "See .env.example and DEPLOY.md.\n",
  );
}
