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
});
