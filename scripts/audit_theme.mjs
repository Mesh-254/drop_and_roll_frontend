#!/usr/bin/env node
/**
 * scripts/audit_theme.mjs
 * ═══════════════════════════════════════════════════════════════════════════
 * Can every screen render in both themes?
 *
 * WHAT THIS USED TO ASK. Before the token migration this counted whether any
 * file flipped cleanly, and the answer was zero of 73 — which is why the toggle
 * was removed in 9e8d481. That question is settled, so the measurement moved.
 *
 * WHAT IT ASKS NOW. Does any file still name a COLOUR (bg-gray-900) instead of
 * a ROLE (bg-card)? A raw colour cannot flip: it renders the same in both
 * themes, so one unpaired `text-white` is enough to make a card illegible once
 * the page goes light. Zero is the only passing answer.
 *
 * HOW IT KNOWS. It runs the codemod's own analysis rather than re-implementing
 * the rules. Three outcomes per file:
 *
 *   mappable  the codemod WOULD rewrite it, so a token exists and the file
 *             simply has not been migrated. Always a failure.
 *   unmapped  a colour with no rule and no exemption. A human has to decide.
 *             Also a failure.
 *   exempt    deliberately literal, by the allow-list (PayPal's blue, decorative
 *             shadows, the purple category chips) or by a structural rule
 *             (multi-hue decorative gradients). Reported, never a failure.
 *
 * Reusing the codemod is the point: the audit and the migration cannot disagree
 * about what counts as themed, because there is only one implementation.
 *
 *   node scripts/audit_theme.mjs
 *   node scripts/audit_theme.mjs --files
 */

import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { migrateSource } from "./migrate_theme_tokens.mjs";

const ROOT = new URL("../src", import.meta.url).pathname;

/**
 * tokens.js holds the palette itself — it IS where colour values live, and its
 * comments name the literals each token replaced. Auditing it would be asking
 * the dictionary to stop containing words.
 */
const NOT_AUDITED = /styles[/\\]tokens\.js$/;

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.jsx?$/.test(p) && !/\.test\.jsx?$/.test(p)) out.push(p);
  }
  return out;
}

const rows = [];
let totalMappable = 0;
let totalUnmapped = 0;
let totalExempt = 0;

for (const file of walk(ROOT)) {
  if (NOT_AUDITED.test(file)) continue;
  const source = readFileSync(file, "utf8");
  const { changed, unmapped, exempt } = migrateSource(source);
  totalExempt += exempt.length;
  if (changed > 0 || unmapped.length > 0) {
    rows.push({
      file: relative(ROOT, file),
      mappable: changed,
      unmapped: unmapped.length,
      classes: [...new Set(unmapped)],
    });
    totalMappable += changed;
    totalUnmapped += unmapped.length;
  }
}

if (process.argv.includes("--files")) {
  console.log("mappable  unmapped  file");
  for (const r of rows.sort(
    (a, b) => b.mappable + b.unmapped - (a.mappable + a.unmapped),
  )) {
    console.log(
      String(r.mappable).padStart(8),
      String(r.unmapped).padStart(9),
      " ",
      r.file,
      r.classes.length ? `  [${r.classes.join(" ")}]` : "",
    );
  }
  console.log("");
}

console.log("THEME AUDIT");
console.log("  files still naming a colour        :", rows.length);
console.log("  occurrences a token already exists for:", totalMappable);
console.log("  occurrences with no rule (need a human):", totalUnmapped);
console.log("  deliberately literal (exempt)      :", totalExempt);
console.log("");

if (totalMappable > 0 || totalUnmapped > 0) {
  console.log("VERDICT: not themeable yet. A raw colour renders identically in both");
  console.log("         themes, so each of these is a spot that stays put when the page");
  console.log("         flips. For the mappable ones run:");
  console.log("");
  console.log("           npm run migrate:theme -- --write <path>");
  console.log("");
  console.log("         then read the diff. The unmapped ones need a decision — see");
  console.log("         /tmp/theme-migration/unmapped.tsv after a dry run. `--files`");
  console.log("         lists the worst offenders first.");
  process.exitCode = 1;
} else {
  console.log("VERDICT: every file names roles, not colours. Both themes render.");
}
