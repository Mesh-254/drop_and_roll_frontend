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
 * @param {Record<string, string>} env - full env map (loadEnv(mode, cwd, "")).
 * @returns {string[]} human-readable problems; empty means the build may proceed.
 */
export function collectProductionEnvProblems(env) {
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
  } else if (env.VITE_STRIPE_PUBLISHABLE_KEY.startsWith("pk_test_")) {
    problems.push(
      "VITE_STRIPE_PUBLISHABLE_KEY is a pk_test_ key — production needs the pk_live_ key.",
    );
  }

  for (const name of Object.keys(env)) {
    if (SERVER_SECRET_RE.test(name)) {
      problems.push(
        `${name} looks like a server-side secret; anything VITE_-prefixed is inlined into the public bundle.`,
      );
    }
  }

  return problems;
}

/** Throws with an actionable message if the production env is unfit to build from. */
export function assertProductionEnv(env) {
  const problems = collectProductionEnvProblems(env);
  if (!problems.length) return;

  throw new Error(
    "\n\nProduction build blocked — the bundle would ship development configuration:\n" +
      problems.map((p) => `  - ${p}`).join("\n") +
      "\n\nSet these in .env.production (gitignored) or pass them as build env, e.g.\n" +
      "  VITE_NEXT_PUBLIC_BACKEND_URL=https://dropnroll.co.uk npm run build\n" +
      "See .env.example and DEPLOY.md.\n",
  );
}
