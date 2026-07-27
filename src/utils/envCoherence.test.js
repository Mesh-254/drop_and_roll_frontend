/**
 * src/utils/envCoherence.test.js — gate test keeping .env, .env.example and the code aligned.
 *
 * The failure this prevents is specific and silent. Vite INLINES `import.meta.env.VITE_*`
 * at build time, so a variable that is read by a component but missing from the build
 * environment does not throw — it evaluates to `undefined` and the feature quietly
 * degrades (a map that never loads, a Stripe form that never mounts). Nothing fails
 * loudly, and the deploy looks green.
 *
 * So: every VITE_ name the source reads must be documented in .env.example, and
 * .env.example must never carry a real credential (it is committed).
 *
 * Pure filesystem + regex. No network, no DOM, no build.
 */

import fs from "node:fs";
import path from "node:path";

// NOT `import.meta.url`: jest/babel-plugin-import-meta.cjs rewrites `import.meta` to a
// plain stub object so Vite-env-reading modules import cleanly under Jest, which leaves
// `.url` undefined. Babel's CommonJS transform gives us __dirname instead.
const REPO_ROOT = path.resolve(__dirname, "..", "..");
const SRC_DIR = path.join(REPO_ROOT, "src");
const EXAMPLE_PATH = path.join(REPO_ROOT, ".env.example");
const ENV_PATH = path.join(REPO_ROOT, ".env");

/** Names Vite provides itself — never declared in a .env file. */
const VITE_BUILTINS = new Set([
  "MODE",
  "BASE_URL",
  "PROD",
  "DEV",
  "SSR",
  "NODE_ENV",
]);

/**
 * Feature flags whose empty value is a real setting, not a var someone forgot to fill.
 *
 * The blank check below exists to catch `VITE_GOOGLE_MAPS_API_KEY=` — a name that is
 * present, so the missing-vars check passes, while the feature it configures is dead. But
 * a few vars branch on truthiness by design, and "" is how you turn them off. Listing a
 * name here is a claim about the code, so each entry names the branch that makes it true.
 *
 * Keep this set small. If a name is here and the code does NOT tolerate an empty value,
 * the blank check silently stops protecting it.
 */
const BLANK_MEANS_OFF = new Set([
  // TurnstileWidget.jsx:19 — `TURNSTILE_ENABLED = Boolean(SITE_KEY)`, and the component
  // renders null without one, so the bot check is simply off. assertProductionEnv.js:81
  // agrees: it only objects to Cloudflare's always-passes TEST key, never to absence.
  "VITE_TURNSTILE_SITE_KEY",
]);

function walk(dir, acc = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (
      entry.name === "node_modules" ||
      entry.name === "__tests__" ||
      entry.name.startsWith(".")
    )
      continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, acc);
    // Skip test files: they are not shipped, and this very file mentions
    // `import.meta.env.VITE_*` in its prose, which the scanner would otherwise read as a
    // variable named "VITE_".
    else if (
      /\.(js|jsx|mjs|ts|tsx)$/.test(entry.name) &&
      !/\.test\.(js|jsx|mjs|ts|tsx)$/.test(entry.name)
    ) {
      acc.push(full);
    }
  }
  return acc;
}

/**
 * Strip comments so prose about env vars is not mistaken for a read.
 *
 * Several modules legitimately document `import.meta.env.VITE_*` in a JSDoc block; matching
 * that yields a phantom variable literally named "VITE_". Stripping comments is the general
 * fix — narrower filename exclusions only postpone the problem to the next file that
 * explains itself well.
 */
function stripComments(text) {
  return text
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:])\/\/.*$/gm, "$1");
}

/** Every `import.meta.env.X` actually read in src/, excluding Vite's own builtins. */
function referencedVars() {
  const found = new Set();
  for (const file of walk(SRC_DIR)) {
    const text = stripComments(fs.readFileSync(file, "utf8"));
    for (const m of text.matchAll(
      /import\.meta\.env\.([A-Za-z_][A-Za-z0-9_]*)/g,
    )) {
      if (!VITE_BUILTINS.has(m[1])) found.add(m[1]);
    }
  }
  return found;
}

/**
 * Parse a .env file into { set, documented }. A commented `# KEY=value` counts as
 * documented (the idiomatic way to record an optional setting) but sets nothing.
 */
function parseEnv(filePath) {
  const set = new Map();
  const documented = new Set();
  if (!fs.existsSync(filePath)) return { set, documented };

  for (const raw of fs.readFileSync(filePath, "utf8").split("\n")) {
    const line = raw.trim();
    if (!line) continue;
    if (line.startsWith("#")) {
      const m = line.match(/^#\s*([A-Za-z_][A-Za-z0-9_]*)\s*=/);
      if (m) documented.add(m[1]);
      continue;
    }
    const m = line.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*=(.*)$/);
    if (m) {
      set.set(m[1], m[2].trim());
      documented.add(m[1]);
    }
  }
  return { set, documented };
}

/** Patterns that indicate a live credential rather than a placeholder. */
const REAL_SECRET_PATTERNS = [
  /\bAIza[0-9A-Za-z_-]{30,}/, // Google API key
  /\bpk_live_[0-9a-zA-Z]{10,}/, // Stripe live publishable
  /\bsk_(?:live|test)_[0-9a-zA-Z]{10,}/, // Stripe SECRET — never belongs in frontend at all
  /\bghp_[0-9a-zA-Z]{20,}/, // GitHub PAT
  /-----BEGIN[ A-Z]*PRIVATE KEY-----/,
];

describe("frontend env coherence", () => {
  test(".env.example exists", () => {
    // Without it there is no record of what a fresh checkout needs, and the CI deploy
    // job's required build-time vars are undiscoverable.
    expect(fs.existsSync(EXAMPLE_PATH)).toBe(true);
  });

  test("every VITE_ var read by src/ is documented in .env.example", () => {
    const { documented } = parseEnv(EXAMPLE_PATH);
    const missing = [...referencedVars()]
      .filter((name) => !documented.has(name))
      .sort();
    expect(missing).toEqual([]);
  });

  test("only VITE_-prefixed vars are read from import.meta.env", () => {
    // Vite silently drops non-VITE_ names, so reading one always yields undefined.
    const bad = [...referencedVars()]
      .filter((name) => !name.startsWith("VITE_"))
      .sort();
    expect(bad).toEqual([]);
  });

  test(".env.example contains no real credentials", () => {
    const text = fs.readFileSync(EXAMPLE_PATH, "utf8");
    const offenders = [];
    for (const line of text.split("\n")) {
      // Skip prose comments; only inspect actual assignments.
      if (line.trim().startsWith("#")) continue;
      for (const pattern of REAL_SECRET_PATTERNS) {
        if (pattern.test(line)) offenders.push(line.split("=")[0]);
      }
    }
    expect(offenders).toEqual([]);
  });

  test("no server-side secret names leak into the frontend env", () => {
    // These are backend-only. A VITE_ prefix on any of them would ship it to every
    // visitor's browser, since Vite inlines VITE_ vars into the bundle.
    const forbidden = [
      "VITE_STRIPE_SECRET_KEY",
      "VITE_TURNSTILE_SECRET_KEY",
      "VITE_IDEAL_POSTCODES_API_KEY",
      "VITE_DJANGO_SECRET_KEY",
      "VITE_POSTGRES_PASSWORD",
      "VITE_EMAIL_HOST_PASSWORD",
      "VITE_PAYPAL_CLIENT_SECRET",
    ];
    const { documented: exampleDocs } = parseEnv(EXAMPLE_PATH);
    const { documented: envDocs } = parseEnv(ENV_PATH);
    const present = forbidden.filter(
      (n) => exampleDocs.has(n) || envDocs.has(n),
    );
    expect(present).toEqual([]);
  });

  const maybe = fs.existsSync(ENV_PATH) ? test : test.skip;

  maybe("local .env defines every var the code requires", () => {
    // Skipped in CI, where .env is absent by design.
    const { set } = parseEnv(ENV_PATH);
    const optional = new Set(["VITE_USE_IDEAL_POSTCODES_PRIMARY"]); // has an in-code default
    const missing = [...referencedVars()]
      .filter((name) => !optional.has(name) && !set.has(name))
      .sort();
    expect(missing).toEqual([]);
  });

  maybe("local .env has no blank values for required vars", () => {
    const { set } = parseEnv(ENV_PATH);
    const blank = [...set.entries()]
      .filter(([name, v]) => v === "" && !BLANK_MEANS_OFF.has(name))
      .map(([k]) => k)
      .sort();
    expect(blank).toEqual([]);
  });
});
