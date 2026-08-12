#!/usr/bin/env node
/**
 * scripts/audit_theme.mjs
 * ═══════════════════════════════════════════════════════════════════════════
 * Is "light mode" a thing this app can actually render?
 *
 * WHY THIS EXISTS. `dark:` used to resolve from the visitor's OS, so the
 * Profile page's light/dark toggle wrote a `.dark` class that nothing read and
 * the button did nothing. Pinning `dark:` to that class (index.css) made the
 * toggle work — which is only an improvement if the light side of every pair
 * exists. This counts whether it does, rather than leaving it to whoever
 * happens to press the button.
 *
 * WHAT IT COUNTS. Two independent facts per file:
 *
 *   dark-only    a dark-surface utility (bg-slate-800, text-white, …) with NO
 *                `dark:`-prefixed sibling anywhere in the file. In light mode
 *                these keep their dark styling while their neighbours flip, so
 *                a file with many of them renders as a mixture of both themes.
 *
 *   paired       a `dark:` utility. A file made of these flips cleanly.
 *
 * A file that is 100% dark-only is not a bug — it is a deliberately dark
 * component, and it is fine as long as the app is dark. The damage is the
 * MIXTURE: a file with both is a file that half-flips.
 *
 * Deterministic on purpose: same tree, same answer, no judgement calls. Run it
 * before changing how `dark:` resolves, and after.
 *
 *   node scripts/audit_theme.mjs          # summary
 *   node scripts/audit_theme.mjs --files  # per-file table
 */

import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const ROOT = new URL("../src", import.meta.url).pathname;

// Utilities that only make sense on a dark ground. Deliberately narrow: these
// are the ones that become invisible or garish on white, not every colour.
const DARK_ONLY = [
  /\bbg-(?:slate|gray|zinc|neutral|stone)-(?:700|800|900|950)\b/g,
  /\bbg-black\b/g,
  /\btext-white\b/g,
  /\btext-(?:slate|gray|zinc)-(?:200|300|400)\b/g,
  /\bborder-(?:slate|gray|zinc)-(?:700|800)\b/g,
];

const PAIRED = /\bdark:/g;

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.jsx?$/.test(p) && !/\.test\.jsx?$/.test(p)) out.push(p);
  }
  return out;
}

const rows = [];
for (const file of walk(ROOT)) {
  const src = readFileSync(file, "utf8");
  const paired = (src.match(PAIRED) || []).length;
  let darkOnly = 0;
  for (const re of DARK_ONLY) darkOnly += (src.match(re) || []).length;
  if (darkOnly || paired) {
    rows.push({ file: relative(ROOT, file), darkOnly, paired });
  }
}

const mixed = rows.filter((r) => r.darkOnly > 0 && r.paired > 0);
const darkOnlyFiles = rows.filter((r) => r.darkOnly > 0 && r.paired === 0);
const pairedFiles = rows.filter((r) => r.paired > 0 && r.darkOnly === 0);

const totalDarkOnly = rows.reduce((n, r) => n + r.darkOnly, 0);
const totalPaired = rows.reduce((n, r) => n + r.paired, 0);

if (process.argv.includes("--files")) {
  console.log("dark-only  paired  file");
  for (const r of [...mixed, ...darkOnlyFiles].sort(
    (a, b) => b.darkOnly - a.darkOnly,
  )) {
    console.log(
      String(r.darkOnly).padStart(9),
      String(r.paired).padStart(7),
      " ",
      r.file,
    );
  }
  console.log("");
}

console.log("THEME AUDIT");
console.log(
  "  files with dark-only styling and NO dark: pair :",
  darkOnlyFiles.length,
);
console.log(
  "  files that flip cleanly (dark: only)           :",
  pairedFiles.length,
);
console.log("  MIXED files (half-flip in light mode)          :", mixed.length);
console.log(
  "  dark-only utility occurrences (total)          :",
  totalDarkOnly,
);
console.log("  dark: utility occurrences (total)              :", totalPaired);
console.log("");
// THE DECISIVE SIGNAL IS `pairedFiles`, NOT THE RATIO.
//
// A first pass at this compared totals (dark-only vs dark:) and called 1700 vs
// 1153 "plausible". That was the wrong question. What decides whether a theme
// can flip is not how many utilities are paired — it is whether any FILE is
// fully paired. One unpaired `text-white` is enough to make a card illegible on
// white, so a file is only safe if it has zero of them.
//
// Zero clean files means every screen half-flips, and no amount of favourable
// ratio changes that.
const cleanlyFlippable = pairedFiles.length;
if (cleanlyFlippable === 0) {
  console.log(
    "VERDICT: light mode cannot render. NOT ONE file in src/ flips cleanly —",
  );
  console.log(
    "         every file carrying dark: pairs also carries unpaired dark-only",
  );
  console.log(
    "         utilities, and `body` is unconditionally bg-black text-white.",
  );
  console.log(
    "         Implementing it means re-theming " +
      rows.length +
      " files. Until then the app is",
  );
  console.log(
    "         dark-only and must not offer a toggle that half-flips a screen.",
  );
  process.exitCode = 1;
} else {
  console.log(
    "VERDICT: " +
      cleanlyFlippable +
      " file(s) flip cleanly; " +
      mixed.length +
      " mixed files need auditing.",
  );
}
