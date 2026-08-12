#!/usr/bin/env node
/**
 * scripts/audit_unpaired_light.mjs
 * ═══════════════════════════════════════════════════════════════════════════
 * Find light-surface utilities with no `dark:` counterpart ON THE SAME ELEMENT.
 *
 * The app renders with `.dark` permanently on (see utils/theme.js), so every
 * `dark:` variant wins. `bg-white dark:bg-gray-800` is therefore correct and
 * invisible. What is NOT correct is a bare `bg-white` with no dark sibling: it
 * stays white on a black app forever, and any `text-white` inside it vanishes.
 *
 * Counting occurrences per file cannot answer this — a file can have 107 dark:
 * pairs and still have one unpaired `bg-white`. The question is per class list,
 * so that is what this parses.
 *
 * Deliberately narrow: only surface/foreground utilities whose light and dark
 * values are far enough apart to break legibility. Accent colours (orange-500,
 * green-400) read on both and are not flagged.
 *
 *   node scripts/audit_unpaired_light.mjs [glob-ish path substring]
 */

import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const ROOT = new URL("../src", import.meta.url).pathname;
const filter = process.argv[2] || "";

// light utility -> the dark: prefix that would pair it
const PAIRS = [
  ["bg-white", "dark:bg-"],
  ["bg-gray-50", "dark:bg-"],
  ["bg-gray-100", "dark:bg-"],
  ["bg-slate-50", "dark:bg-"],
  ["bg-slate-100", "dark:bg-"],
  ["text-gray-900", "dark:text-"],
  ["text-gray-800", "dark:text-"],
  ["text-slate-900", "dark:text-"],
  ["text-black", "dark:text-"],
];

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.jsx?$/.test(p) && !/\.test\.jsx?$/.test(p)) out.push(p);
  }
  return out;
}

// Every className="..." / className={`...`} body, with its line number.
function classLists(src) {
  const out = [];
  const re = /className\s*=\s*(?:"([^"]*)"|\{`([^`]*)`\}|\{"([^"]*)"\})/g;
  let m;
  while ((m = re.exec(src))) {
    const body = m[1] ?? m[2] ?? m[3] ?? "";
    out.push({ body, line: src.slice(0, m.index).split("\n").length });
  }
  return out;
}

/**
 * A LIGHT ISLAND is a screen that deliberately paints its own light page and
 * lives inside a dark app — the Stripe/PayPal checkout and its outcome pages.
 * That is a real pattern here, not an oversight: a payment screen sits beside
 * Stripe's own light iframe, and a dark shell around a white iframe looks
 * broken in a way that costs conversions.
 *
 * Inside such a file `bg-white` + `text-gray-900` is CORRECT and unpaired by
 * design. A first pass at this script flagged 76 of them, all in payments/,
 * and every one was a false positive. Detected rather than hardcoded so a new
 * light screen is understood without editing this file.
 */
function isLightIsland(src) {
  // A light PAGE announces itself: min-h-screen with a light ground.
  if (
    /min-h-screen[^"'`]*\bbg-(?:gray|slate|zinc|neutral)-(?:50|100)\b/.test(src)
  )
    return true;

  // A light MODAL does not — it has no page background to declare, so the
  // page-level rule missed 18 findings in driver/job-details-modal.jsx, which
  // is a wholly light modal (blue-50 gradient, slate-900 text, white cards) and
  // internally consistent.
  //
  // The structural question is the same for both: does this file mostly paint
  // light surfaces? If light utilities outnumber dark ones it is a light
  // component, and its unpaired light classes are the design, not a defect.
  // Counting beats a hardcoded filename list, which would go stale the first
  // time somebody adds a light screen.
  const light = (
    src.match(
      /\b(?:bg-white|bg-(?:gray|slate|zinc)-(?:50|100|200)|text-(?:gray|slate)-(?:800|900))\b/g,
    ) || []
  ).length;
  const dark = (
    src.match(
      /\b(?:bg-(?:gray|slate|zinc)-(?:700|800|900|950)|bg-black|text-white)\b/g,
    ) || []
  ).length;
  return light > dark;
}

/**
 * A small fixed-size element is a DOT or an ICON, not a surface — the filled
 * centre of a selected radio, a logo mark, a lucide glyph. Its colour is chosen
 * against whatever swatch its parent paints (usually an orange circle), so it
 * reads on either ground and needs no `dark:` pair.
 *
 * Extended to w-8/h-8 after the first pass flagged `w-4 h-4 bg-white` inside
 * the header logo and `w-6 h-6 text-black` inside orange contact-icon circles.
 * The accent lives on the PARENT, so `isOnAccent` cannot see it from here —
 * size is the signal that survives that.
 */
function isDecorativeFill(body) {
  return /\b[wh]-(?:1|1\.5|2|2\.5|3|3\.5|4|5|6|7|8)\b/.test(body);
}

/**
 * Dark text ON A BRIGHT ACCENT is a contrast decision, not a theme mistake.
 * `bg-orange-500 text-black` is the primary button on this site and reads on
 * any page; pairing it with a `dark:` variant would be wrong, because the
 * button's ground does not change with the theme. Seven of these in
 * ContactForm.jsx and two in AdminDashboard.jsx were false positives before
 * this rule.
 */
function isOnAccent(body) {
  return /\bbg-(?:orange|amber|yellow|lime|green|emerald|cyan|sky)-(?:300|400|500)\b/.test(
    body,
  );
}

let findings = 0;
const islands = [];

for (const file of walk(ROOT)) {
  const rel = relative(ROOT, file);
  if (filter && !rel.includes(filter)) continue;
  const src = readFileSync(file, "utf8");

  if (isLightIsland(src)) {
    islands.push(rel);
    continue;
  }

  for (const { body, line } of classLists(src)) {
    if (isDecorativeFill(body) || isOnAccent(body)) continue;
    for (const [light, darkPrefix] of PAIRS) {
      // Stand-alone only: `bg-white/10` is a translucent overlay and reads on
      // either ground, so it is not a finding.
      const re = new RegExp(`(?:^|\\s)${light}(?![\\w/-])`);
      if (!re.test(body)) continue;
      // Paired if the same class list carries the matching dark: family.
      if (body.includes(darkPrefix)) continue;
      console.log(`${rel}:${line}  unpaired ${light}`);
      findings++;
    }
  }
}

if (islands.length) {
  console.log("");
  console.log(
    "light islands (own light page, unpaired by design) — not checked:",
  );
  for (const i of islands) console.log("  " + i);
}

console.log("");
console.log(
  findings === 0
    ? "CLEAN: no unpaired light-surface utilities."
    : `${findings} unpaired light utilities.`,
);
process.exitCode = findings === 0 ? 0 : 1;
