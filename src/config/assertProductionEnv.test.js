/**
 * Tests for the production-build configuration guard.
 *
 * The guard exists because a misconfigured production build fails silently: Vite inlines
 * env at build time, so a build that falls back to .env produces a valid bundle pointed at
 * localhost. It deploys cleanly and the site is simply dead. These tests pin each condition
 * that must block a release, and — just as importantly — pin that a correct production env
 * passes, since a guard that rejects valid config would block every deploy.
 */

import {
  collectProductionEnvProblems,
  assertProductionEnv,
  TURNSTILE_TEST_KEY_PREFIX,
  TEST_STRIPE_OVERRIDE_VAR,
  TEST_STRIPE_OVERRIDE_WARNING,
} from "./assertProductionEnv";

/** A fully valid production environment; individual tests break one field at a time. */
const VALID = {
  VITE_NEXT_PUBLIC_BACKEND_URL: "https://dropnroll.co.uk",
  VITE_PUBLIC_GOOGLE_CLIENT_ID: "740445555278-abc.apps.googleusercontent.com",
  VITE_GOOGLE_MAPS_API_KEY: "AIzaSyExampleBrowserKeyValue0000000000000",
  VITE_STRIPE_PUBLISHABLE_KEY: "pk_live_realkey",
  VITE_TURNSTILE_SITE_KEY: "0x4AAAAAAArealsitekey",
};

const problemsFor = (overrides) =>
  collectProductionEnvProblems({ ...VALID, ...overrides });

describe("production env guard", () => {
  test("a correct production environment passes", () => {
    expect(collectProductionEnvProblems(VALID)).toEqual([]);
    expect(() => assertProductionEnv(VALID)).not.toThrow();
  });

  describe("backend origin", () => {
    // The exact failure that shipped: .env.production absent, so the build used .env.
    test.each([
      ["http://127.0.0.1:8000"],
      ["http://localhost:8000"],
      ["https://localhost"],
      ["http://0.0.0.0:8000"],
    ])("rejects the local address %s", (url) => {
      expect(problemsFor({ VITE_NEXT_PUBLIC_BACKEND_URL: url }).join()).toMatch(
        /local address/,
      );
    });

    test("rejects a missing origin", () => {
      expect(problemsFor({ VITE_NEXT_PUBLIC_BACKEND_URL: "" }).join()).toMatch(
        /not set/,
      );
    });

    test("rejects a non-https public origin", () => {
      // WS URLs derive from this; http:// bakes in a ws:// socket that an https page blocks.
      expect(
        problemsFor({
          VITE_NEXT_PUBLIC_BACKEND_URL: "http://dropnroll.co.uk",
        }).join(),
      ).toMatch(/https:\/\//);
    });

    test("does not mistake a legitimate host containing the word local", () => {
      expect(
        problemsFor({
          VITE_NEXT_PUBLIC_BACKEND_URL:
            "https://local-delivery.dropnroll.co.uk",
        }),
      ).toEqual([]);
    });
  });

  describe("placeholder credentials that would silently disable protection", () => {
    test("rejects Cloudflare's always-passes Turnstile test key", () => {
      const problems = problemsFor({
        VITE_TURNSTILE_SITE_KEY: `${TURNSTILE_TEST_KEY_PREFIX}AA`,
      });
      expect(problems.join()).toMatch(/always-passes TEST key/);
    });

    test("rejects a Stripe test publishable key", () => {
      expect(
        problemsFor({ VITE_STRIPE_PUBLISHABLE_KEY: "pk_test_abc" }).join(),
      ).toMatch(/pk_live_/);
    });

    test("allows an unset Turnstile key (widget hidden, not silently bypassed)", () => {
      expect(problemsFor({ VITE_TURNSTILE_SITE_KEY: "" })).toEqual([]);
    });

    test("rejects an unset Stripe key", () => {
      // Both payment routes call loadStripe(...) at module scope, so unset is not
      // "payments disabled", it is "the payment pages throw".
      expect(problemsFor({ VITE_STRIPE_PUBLISHABLE_KEY: "" }).join()).toMatch(
        /not set/,
      );
    });
  });

  describe("server-side secrets given a VITE_ prefix", () => {
    test.each([
      "VITE_STRIPE_SECRET_KEY",
      "VITE_TURNSTILE_SECRET_KEY",
      "VITE_POSTGRES_PASSWORD",
      "VITE_IDEAL_POSTCODES_API_KEY",
      "VITE_SOME_PRIVATE_KEY",
    ])("rejects %s", (name) => {
      expect(problemsFor({ [name]: "x" }).join()).toMatch(/server-side secret/);
    });

    test("ignores unprefixed server vars, which Vite never exposes", () => {
      // loadEnv(mode, cwd, "") returns the whole environment, so backend names routinely
      // appear here. Only a VITE_ prefix actually publishes them.
      expect(
        problemsFor({
          STRIPE_SECRET_KEY: "sk_live_x",
          POSTGRES_PASSWORD: "hunter2",
        }),
      ).toEqual([]);
    });
  });

  describe("Google Maps browser key", () => {
    test("rejects a missing key", () => {
      // GetQuoteBook.jsx passes it to <APIProvider apiKey={...}> and the admin dashboard
      // builds the Maps script URL from it. Empty takes out the address step of the
      // booking flow, which is the revenue path.
      expect(problemsFor({ VITE_GOOGLE_MAPS_API_KEY: "" }).join()).toMatch(
        /VITE_GOOGLE_MAPS_API_KEY is not set/,
      );
    });

    test("accepts a real browser key", () => {
      expect(
        problemsFor({
          VITE_GOOGLE_MAPS_API_KEY: "AIzaSyAnotherPlausibleBrowserKey00000000",
        }),
      ).toEqual([]);
    });
  });

  describe(".env.example placeholders", () => {
    // The whole file is placeholders. Copying it to .env.production is the obvious way to
    // "set" production values, and every presence check then passes on strings that are
    // not credentials.
    test.each([
      ["VITE_GOOGLE_MAPS_API_KEY", "your-google-maps-browser-key"],
      [
        "VITE_PUBLIC_GOOGLE_CLIENT_ID",
        "your-google-oauth-client-id.apps.googleusercontent.com",
      ],
      ["VITE_STRIPE_PUBLISHABLE_KEY", "pk_live_your-stripe-publishable-key"],
    ])("rejects %s left as %s", (name, value) => {
      expect(problemsFor({ [name]: value }).join()).toMatch(/placeholder/);
    });

    test("names the offending variable, not just 'a placeholder'", () => {
      expect(
        problemsFor({
          VITE_GOOGLE_MAPS_API_KEY: "your-google-maps-browser-key",
        }).join(),
      ).toMatch(/VITE_GOOGLE_MAPS_API_KEY/);
    });

    test("ignores a placeholder in an unprefixed variable", () => {
      // loadEnv returns the whole environment; only VITE_ names reach the bundle.
      expect(problemsFor({ SOME_BACKEND_THING: "your-placeholder" })).toEqual(
        [],
      );
    });

    test("does not flag a legitimate value containing the word", () => {
      // The pattern is `your-`, hyphenated, not the bare word.
      expect(
        problemsFor({
          VITE_NEXT_PUBLIC_BACKEND_URL: "https://youryard.dropnroll.co.uk",
        }),
      ).toEqual([]);
    });
  });

  test("reports every problem at once, not just the first", () => {
    const problems = problemsFor({
      VITE_NEXT_PUBLIC_BACKEND_URL: "http://127.0.0.1:8000",
      VITE_STRIPE_PUBLISHABLE_KEY: "pk_test_abc",
      VITE_PUBLIC_GOOGLE_CLIENT_ID: "",
    });
    expect(problems.length).toBeGreaterThanOrEqual(3);
  });

  test("the thrown message names the fix, not just the fault", () => {
    expect(() =>
      assertProductionEnv({
        ...VALID,
        VITE_NEXT_PUBLIC_BACKEND_URL: "http://127.0.0.1:8000",
      }),
    ).toThrow(/\.env\.production/);
  });

  describe("ALLOW_TEST_STRIPE_KEY demo hatch", () => {
    // Added so a client walkthrough can go live before the Stripe live account exists.
    // Every test here is about keeping the hatch narrow: the moment it excuses a second
    // condition, or survives past the command line, it stops being a hatch and becomes
    // the guard's new (much weaker) default.
    const TEST_KEY = { VITE_STRIPE_PUBLISHABLE_KEY: "pk_test_abc" };
    const allow = { allowTestStripeKey: true };

    test("still fatal by default — nobody gets it by accident", () => {
      expect(problemsFor(TEST_KEY).join()).toMatch(/pk_live_/);
    });

    test("lets a pk_test_ key through when opened", () => {
      expect(collectProductionEnvProblems({ ...VALID, ...TEST_KEY }, allow)).toEqual(
        [],
      );
    });

    test("the blocking message tells you the hatch exists", () => {
      // Otherwise the next person hits the wall and either invents a workaround or edits
      // the guard, which is how guards die.
      expect(problemsFor(TEST_KEY).join()).toContain(TEST_STRIPE_OVERRIDE_VAR);
    });

    test.each([
      [
        "a localhost origin",
        { VITE_NEXT_PUBLIC_BACKEND_URL: "http://127.0.0.1:8000" },
        /local address/,
      ],
      [
        "a missing Maps key",
        { VITE_GOOGLE_MAPS_API_KEY: "" },
        /VITE_GOOGLE_MAPS_API_KEY is not set/,
      ],
      [
        "a missing Stripe key",
        { VITE_STRIPE_PUBLISHABLE_KEY: "" },
        /not set/,
      ],
      [
        "the Turnstile test key",
        { VITE_TURNSTILE_SITE_KEY: `${TURNSTILE_TEST_KEY_PREFIX}AA` },
        /always-passes TEST key/,
      ],
      [
        "a leaked server secret",
        { VITE_STRIPE_SECRET_KEY: "sk_live_x" },
        /server-side secret/,
      ],
      [
        "an .env.example placeholder",
        { VITE_GOOGLE_MAPS_API_KEY: "your-google-maps-browser-key" },
        /placeholder/,
      ],
    ])("does not excuse %s", (_label, overrides, expected) => {
      const problems = collectProductionEnvProblems(
        { ...VALID, ...TEST_KEY, ...overrides },
        allow,
      );
      expect(problems.join()).toMatch(expected);
    });

    test("an absent Stripe key is not a test key — the hatch does not cover it", () => {
      // "" and "pk_test_..." fail for different reasons. Unset means loadStripe(undefined)
      // and both payment routes throw on import, which no demo wants either.
      expect(
        collectProductionEnvProblems(
          { ...VALID, VITE_STRIPE_PUBLISHABLE_KEY: "" },
          allow,
        ).join(),
      ).toMatch(/not set/);
    });

    test("assertProductionEnv warns loudly instead of throwing", () => {
      const warn = jest.spyOn(console, "warn").mockImplementation(() => {});
      try {
        expect(() =>
          assertProductionEnv({ ...VALID, ...TEST_KEY }, allow),
        ).not.toThrow();
        expect(warn).toHaveBeenCalledWith(TEST_STRIPE_OVERRIDE_WARNING);
        // The warning has to say what breaks, not just that a flag is set.
        expect(TEST_STRIPE_OVERRIDE_WARNING).toMatch(/REJECTS real cards/);
      } finally {
        warn.mockRestore();
      }
    });

    test("warns even when the build is going to fail anyway", () => {
      // A throw for an unrelated reason must not swallow the notice; otherwise the hatch
      // is discovered one run later, after it has already shipped.
      const warn = jest.spyOn(console, "warn").mockImplementation(() => {});
      try {
        expect(() =>
          assertProductionEnv(
            {
              ...VALID,
              ...TEST_KEY,
              VITE_NEXT_PUBLIC_BACKEND_URL: "http://127.0.0.1:8000",
            },
            allow,
          ),
        ).toThrow(/local address/);
        expect(warn).toHaveBeenCalledWith(TEST_STRIPE_OVERRIDE_WARNING);
      } finally {
        warn.mockRestore();
      }
    });

    test("stays quiet when the key is already pk_live_", () => {
      // Flag set out of habit on a properly configured build: no warning, because there is
      // nothing wrong. A banner that cries wolf gets tuned out.
      const warn = jest.spyOn(console, "warn").mockImplementation(() => {});
      try {
        assertProductionEnv(VALID, allow);
        expect(warn).not.toHaveBeenCalled();
      } finally {
        warn.mockRestore();
      }
    });
  });
});
