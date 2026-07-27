#!/usr/bin/env node
/**
 * scripts/resolve-build-env.mjs — resolve and validate the build env the way Vite will.
 *
 * WHY THIS EXISTS
 *
 * deploy.sh used to guard its inputs with bash parameter expansion:
 *
 *     : "${VITE_NEXT_PUBLIC_BACKEND_URL:?set it, e.g. https://dropnroll.co.uk}"
 *
 * That reads the SHELL environment. The values actually live in .env / .env.production,
 * which are Vite files — bash never opens them. So the guard was wrong in both directions:
 * it aborted on a correctly configured checkout (the common case, and the reason you are
 * reading this), and it would have passed on a shell that merely had the name exported
 * while .env.production held a stale or placeholder value.
 *
 * Rather than reimplement Vite's file precedence in bash (.env, .env.local, .env.[mode],
 * .env.[mode].local, then process.env winning over all of them — four files and an
 * override rule, each an opportunity to drift from what the build does), ask Vite. This
 * script calls the same loadEnv() that vite.config.js calls, with the same arguments, and
 * runs the same collectProductionEnvProblems() guard. A failure here is therefore exactly
 * the failure `npm run build` would produce, reported before the build starts and before
 * anything is rsynced over the live site.
 *
 * Usage:
 *   node scripts/resolve-build-env.mjs [mode]     # mode defaults to "production"
 *
 * Exit 0: prints the resolved VITE_NEXT_PUBLIC_BACKEND_URL on stdout (nothing else, so it
 *         is safe to capture in a shell substitution).
 * Exit 1: prints the list of problems on stderr, prints nothing on stdout.
 */

import { loadEnv } from "vite";
import {
  collectProductionEnvProblems,
  TEST_STRIPE_OVERRIDE_VAR,
  TEST_STRIPE_OVERRIDE_WARNING,
} from "../src/config/assertProductionEnv.js";

const mode = process.argv[2] || "production";

// From process.env only, and only the exact string "1". Mirrors vite.config.js so this
// pre-check and the build agree; see TEST_STRIPE_OVERRIDE_VAR for why it must not be
// readable from an env file.
const allowTestStripeKey = process.env[TEST_STRIPE_OVERRIDE_VAR] === "1";

// Identical call to vite.config.js. Third arg "" loads every var rather than only the
// VITE_-prefixed ones, so the guard can also see a server secret that was mistakenly
// given a VITE_ prefix. loadEnv layers process.env on top of the files, which is what
// makes `VITE_NEXT_PUBLIC_BACKEND_URL=... ./deploy.sh` keep working as an override.
const env = loadEnv(mode, process.cwd(), "");

const problems = collectProductionEnvProblems(env, { allowTestStripeKey });

// Before the problems check: an open hatch is worth seeing even on a run that fails for
// some other reason.
if (
  allowTestStripeKey &&
  String(env.VITE_STRIPE_PUBLISHABLE_KEY ?? "").startsWith("pk_test_")
) {
  process.stderr.write(TEST_STRIPE_OVERRIDE_WARNING);
}

if (problems.length) {
  process.stderr.write(
    `\nBuild env for mode "${mode}" is unfit — deploy would ship a broken bundle:\n` +
      problems.map((p) => `  - ${p}`).join("\n") +
      "\n\nThese are read from .env / .env." +
      mode +
      " (both gitignored), not from your shell.\n" +
      "Fix the file, or override for one run:\n" +
      "  VITE_STRIPE_PUBLISHABLE_KEY=pk_live_... ./deploy.sh\n" +
      "See .env.example.\n\n",
  );
  process.exit(1);
}

process.stdout.write(`${env.VITE_NEXT_PUBLIC_BACKEND_URL}\n`);
