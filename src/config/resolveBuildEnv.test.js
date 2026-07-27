/**
 * src/config/resolveBuildEnv.test.js — gate tests for the deploy-time env resolver.
 *
 * The bug this locks out: deploy.sh guarded its inputs with bash parameter expansion
 * (`: "${VITE_NEXT_PUBLIC_BACKEND_URL:?...}"`), which reads the SHELL environment. The
 * values live in .env / .env.production — Vite files that bash never opens. So the guard
 * failed on a correctly configured checkout, and (worse, because it is silent) would have
 * passed on a shell that merely had the name exported while the file held a stale value.
 *
 * Two lanes here:
 *   1. Static assertions on deploy.sh, so the bash guard cannot come back.
 *   2. Spawning the real resolver against fixture .env directories, so its exit codes and
 *      its agreement with the Vite build are checked, not assumed.
 *
 * Lane 2 shells out to node. It is still a gate test: no network, no build, no LLM, and
 * the fixtures are written to a temp dir that is removed afterwards.
 */

import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

// NOT `import.meta.url` — jest rewrites `import.meta` to a stub, leaving `.url` undefined.
// See the same note in envCoherence.test.js.
const REPO_ROOT = path.resolve(__dirname, "..", "..");
const DEPLOY_SH = path.join(REPO_ROOT, "deploy.sh");
const RESOLVER = path.join(REPO_ROOT, "scripts", "resolve-build-env.mjs");

/** A .env whose every value clears collectProductionEnvProblems(). */
const GOOD_ENV = [
  "VITE_NEXT_PUBLIC_BACKEND_URL=https://dropnroll.co.uk",
  "VITE_PUBLIC_GOOGLE_CLIENT_ID=740445555278-example.apps.googleusercontent.com",
  "VITE_GOOGLE_MAPS_API_KEY=AIza-not-a-real-key",
  "VITE_STRIPE_PUBLISHABLE_KEY=pk_live_notarealkey",
].join("\n");

/**
 * Runs the resolver with `cwd` pointed at a fixture directory. The resolver reads env
 * files from process.cwd() (exactly as Vite does) while resolving its own imports
 * relative to the script file, so the fixture needs no node_modules of its own.
 *
 * @returns {{status: number, stdout: string, stderr: string}}
 */
function runResolver(cwd, extraEnv = {}) {
  // spawnSync, not execFileSync: execFileSync only hands back stderr by throwing, so a
  // successful run's stderr is unreachable — and the demo-hatch banner is printed to
  // stderr on an exit-0 run, which is exactly the case that needs asserting.
  const { status, stdout, stderr } = spawnSync("node", [RESOLVER, "production"], {
    cwd,
    encoding: "utf8",
    // Drop any VITE_ or ALLOW_ vars the developer running the suite happens to have
    // exported; loadEnv layers process.env over the files and would otherwise leak them
    // in, making these results depend on whose machine ran them.
    env: Object.fromEntries([
      ...Object.entries(process.env).filter(
        ([k]) => !k.startsWith("VITE_") && k !== "ALLOW_TEST_STRIPE_KEY",
      ),
      ...Object.entries(extraEnv),
    ]),
  });
  return { status, stdout, stderr };
}

let fixtureDir;

beforeAll(() => {
  fixtureDir = fs.mkdtempSync(path.join(os.tmpdir(), "dnr-buildenv-"));
});

afterAll(() => {
  fs.rmSync(fixtureDir, { recursive: true, force: true });
});

/** Writes a fixture .env (and optional .env.production) into a fresh subdirectory. */
function fixture(name, files) {
  const dir = path.join(fixtureDir, name);
  fs.mkdirSync(dir, { recursive: true });
  for (const [file, body] of Object.entries(files)) {
    fs.writeFileSync(path.join(dir, file), `${body}\n`);
  }
  return dir;
}

describe("deploy.sh env guard", () => {
  const deploy = fs.readFileSync(DEPLOY_SH, "utf8");

  test("does not guard VITE_ vars with bash parameter expansion", () => {
    // `: "${VITE_...:?msg}"` — the original bug. bash cannot see .env, so this is always
    // either a false alarm or a false pass.
    expect(deploy).not.toMatch(/\$\{VITE_[A-Z0-9_]*:[?-]/);
  });

  test("delegates the check to the resolver script, which exists", () => {
    expect(deploy).toContain("scripts/resolve-build-env.mjs");
    expect(fs.existsSync(RESOLVER)).toBe(true);
  });

  test("aborts the whole script when the resolver fails", () => {
    // Without `set -e` (or an explicit check) a failed substitution would print an empty
    // URL and rsync a stale dist/ over the live site.
    expect(deploy).toMatch(/^set -euo pipefail$/m);
    expect(deploy).toMatch(/BACKEND_URL="\$\(node scripts\/resolve-build-env\.mjs/);
  });

  test("still refuses to rsync an empty build", () => {
    // Pre-existing protection; asserted here so this edit cannot quietly drop it.
    expect(deploy).toContain("dist/index.html");
    expect(deploy).toMatch(/rsync[^\n]*--delete/);
  });
});

describe("scripts/resolve-build-env.mjs", () => {
  test("prints only the backend URL on a healthy .env", () => {
    const dir = fixture("good", { ".env": GOOD_ENV });
    const { status, stdout, stderr } = runResolver(dir);

    expect(stderr).toBe("");
    expect(status).toBe(0);
    // Exactly the URL and nothing else — deploy.sh captures this in a substitution.
    expect(stdout).toBe("https://dropnroll.co.uk\n");
  });

  test("reads .env, which is the file bash could not see", () => {
    // The regression in one assertion: nothing is exported into the child's shell env,
    // so a pass here can only have come from reading the file.
    const dir = fixture("file-only", { ".env": GOOD_ENV });
    expect(runResolver(dir).status).toBe(0);
  });

  test("layers .env.production over .env, like the real build", () => {
    const dir = fixture("layered", {
      ".env": GOOD_ENV.replace(
        "https://dropnroll.co.uk",
        "http://127.0.0.1:8000",
      ),
      ".env.production": "VITE_NEXT_PUBLIC_BACKEND_URL=https://dropnroll.co.uk",
    });
    const { status, stdout } = runResolver(dir);

    expect(status).toBe(0);
    expect(stdout.trim()).toBe("https://dropnroll.co.uk");
  });

  test("lets a shell override win over the files", () => {
    const dir = fixture("override", {
      ".env": GOOD_ENV.replace("pk_live_notarealkey", "pk_test_notarealkey"),
    });
    const blocked = runResolver(dir);
    expect(blocked.status).toBe(1);

    const overridden = runResolver(dir, {
      VITE_STRIPE_PUBLISHABLE_KEY: "pk_live_notarealkey",
    });
    expect(overridden.status).toBe(0);
  });

  test.each([
    [
      "missing backend URL",
      GOOD_ENV.split("\n").slice(1).join("\n"),
      /VITE_NEXT_PUBLIC_BACKEND_URL is not set/,
    ],
    [
      "localhost backend URL",
      GOOD_ENV.replace("https://dropnroll.co.uk", "http://localhost:8000"),
      /local address/,
    ],
    [
      "test Stripe key",
      GOOD_ENV.replace("pk_live_", "pk_test_"),
      /pk_test_ key/,
    ],
    [
      "missing Maps key",
      GOOD_ENV.replace("VITE_GOOGLE_MAPS_API_KEY=AIza-not-a-real-key", ""),
      /VITE_GOOGLE_MAPS_API_KEY is not set/,
    ],
  ])("exits 1 and explains: %s", (_label, body, expected) => {
    const dir = fixture(`bad-${_label.replace(/\W+/g, "-")}`, { ".env": body });
    const { status, stdout, stderr } = runResolver(dir);

    expect(status).toBe(1);
    expect(stderr).toMatch(expected);
    // Nothing on stdout, so a caller capturing the URL gets an empty string, never a
    // half-valid value it might go on to deploy with.
    expect(stdout).toBe("");
  });

  describe("ALLOW_TEST_STRIPE_KEY demo hatch, end to end", () => {
    const DEMO_ENV = GOOD_ENV.replace("pk_live_", "pk_test_");

    test("blocks a pk_test_ key by default and points at the hatch", () => {
      const dir = fixture("demo-closed", { ".env": DEMO_ENV });
      const { status, stderr } = runResolver(dir);

      expect(status).toBe(1);
      expect(stderr).toContain("ALLOW_TEST_STRIPE_KEY=1");
    });

    test("passes with the flag, and still prints the URL cleanly on stdout", () => {
      const dir = fixture("demo-open", { ".env": DEMO_ENV });
      const { status, stdout, stderr } = runResolver(dir, {
        ALLOW_TEST_STRIPE_KEY: "1",
      });

      expect(status).toBe(0);
      // The banner goes to stderr, so `BACKEND_URL="$(...)"` in deploy.sh stays clean.
      expect(stdout).toBe("https://dropnroll.co.uk\n");
      expect(stderr).toMatch(/REJECTS real cards/);
    });

    test.each([["true"], ["yes"], ["0"], [""], ["1 "]])(
      "ignores ALLOW_TEST_STRIPE_KEY=%p — only the exact string 1 opens it",
      (value) => {
        const dir = fixture(`demo-strict-${value.trim() || "empty"}`, {
          ".env": DEMO_ENV,
        });
        expect(
          runResolver(dir, { ALLOW_TEST_STRIPE_KEY: value }).status,
        ).toBe(1);
      },
    );

    test("CANNOT be enabled from an env file", () => {
      // The property the whole design rests on. loadEnv with the "" prefix would happily
      // return this name out of .env, so if the guard read the flag off that map instead
      // of process.env, one line in .env.production would permanently disable the check
      // and no future deploy would ever mention it again.
      const dir = fixture("demo-from-file", {
        ".env": `${DEMO_ENV}\nALLOW_TEST_STRIPE_KEY=1`,
      });
      const { status, stderr } = runResolver(dir);

      expect(status).toBe(1);
      expect(stderr).toMatch(/pk_test_ key/);
    });

    test("does not excuse a second problem", () => {
      const dir = fixture("demo-not-a-skeleton-key", {
        ".env": DEMO_ENV.replace(
          "https://dropnroll.co.uk",
          "http://127.0.0.1:8000",
        ),
      });
      const { status, stderr } = runResolver(dir, {
        ALLOW_TEST_STRIPE_KEY: "1",
      });

      expect(status).toBe(1);
      expect(stderr).toMatch(/local address/);
    });
  });

  test("tells the reader the values come from files, not the shell", () => {
    // The error message is the whole point of the fix: the previous one sent people to
    // export a shell variable, which is what made the bug survive.
    const dir = fixture("message", {
      ".env": GOOD_ENV.replace("pk_live_", "pk_test_"),
    });
    const { stderr } = runResolver(dir);

    expect(stderr).toContain(".env");
    expect(stderr).toMatch(/not from your shell/i);
  });
});
