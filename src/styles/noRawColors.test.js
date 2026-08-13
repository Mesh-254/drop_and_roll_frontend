/* global __dirname */
/**
 * The theme audit, as a gate test.
 *
 * `npm run audit:theme` answers the same question, but only when someone runs
 * it. This makes a regression fail on commit instead: the moment a new component
 * names a colour rather than a role, it is half-themed, and that is invisible
 * until somebody flips the theme on the one page nobody checked.
 *
 * It calls the codemod's own analysis, so the audit, this test and the migration
 * cannot disagree about what counts as themed.
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { migrateSource } from "../../scripts/migrate_theme_tokens.mjs";

const SRC = join(__dirname, "..");

// tokens.js IS the palette; its comments name the literals each token replaced.
const NOT_AUDITED = /styles[/\\]tokens\.js$/;

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.jsx?$/.test(p) && !/\.test\.jsx?$/.test(p)) out.push(p);
  }
  return out;
}

describe("every component names a role, not a colour", () => {
  const files = walk(SRC).filter((f) => !NOT_AUDITED.test(f));

  it("finds source files to audit", () => {
    expect(files.length).toBeGreaterThan(50);
  });

  it("has no raw colour that a token already exists for", () => {
    const offenders = [];
    for (const file of files) {
      const { changed } = migrateSource(readFileSync(file, "utf8"));
      if (changed > 0) {
        offenders.push(`${relative(SRC, file)} (${changed} occurrence(s))`);
      }
    }
    // Fix with: npm run migrate:theme -- --write <path>
    expect(offenders).toEqual([]);
  });

  it("has no colour left that nobody has decided about", () => {
    const offenders = [];
    for (const file of files) {
      const { unmapped } = migrateSource(readFileSync(file, "utf8"));
      for (const cls of new Set(unmapped)) {
        offenders.push(`${relative(SRC, file)}  ${cls}`);
      }
    }
    // Each of these needs either a mapping rule or an entry in ALLOW_LIST with a
    // reason. Deliberately literal colours belong in one of those two places, so
    // that the decision is written down rather than merely tolerated.
    expect(offenders).toEqual([]);
  });
});
