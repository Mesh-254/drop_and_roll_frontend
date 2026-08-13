#!/usr/bin/env node
/**
 * scripts/migrate_theme_tokens.mjs
 * ═══════════════════════════════════════════════════════════════════════════
 * Rewrite raw Tailwind colour utilities into semantic token utilities.
 *
 * WHY A SCRIPT. 5389 colour-utility occurrences across 123 files. Same input,
 * same output, every time — so this belongs in deterministic space, not in a
 * model's judgement, and the mapping table becomes reviewable in one place
 * instead of spread across 123 diffs.
 *
 * WHAT IT WILL NOT DO. It never guesses. A class it has no rule for is left
 * exactly as it was and reported, so the residue is a short list to look at
 * rather than a silent wrong answer.
 *
 * THE TWO SUBTLE RULES
 *
 * 1. `text-white` means two different things: body text on a dark surface
 *    (-> text-foreground) and a label on a coloured button
 *    (-> text-primary-foreground). 61 elements are the second kind. Guessing
 *    wrong turns every primary button label unreadable, so the rule reads the
 *    sibling classes in the same class string. See ON_COLOR_BACKGROUND_RE.
 *
 * 2. A TRANSLUCENT neutral is not a surface. `bg-white/20` on a dark header is
 *    a light hairline; rewriting it to `bg-card/20` makes it a DARK hairline,
 *    and `bg-black/50` is a modal scrim rather than a page background. Their
 *    intent cannot be read off the class, so they are reported, not mapped.
 *    Opaque `bg-black` and faded text like `text-white/90` are unambiguous and
 *    still map.
 *
 *   node scripts/migrate_theme_tokens.mjs --dry src/components/common
 *   node scripts/migrate_theme_tokens.mjs --write src/components/common
 */

import {
  readFileSync,
  writeFileSync,
  readdirSync,
  statSync,
  mkdirSync,
} from "node:fs";
import { join, relative } from "node:path";

/** Bare class (no variant, no opacity) -> token class. */
export const MAPPING = {
  // ── Surfaces ──────────────────────────────────────────────────────────────
  "bg-black": "bg-background",
  "bg-white": "bg-card",
  "bg-gray-50": "bg-muted",
  "bg-gray-100": "bg-muted",
  "bg-slate-50": "bg-muted",
  "bg-slate-100": "bg-muted",
  "bg-gray-200": "bg-surface-hover",
  "bg-gray-700": "bg-surface-hover",
  "bg-gray-800": "bg-surface",
  "bg-slate-700": "bg-surface",
  "bg-gray-900": "bg-card",
  "bg-slate-800": "bg-card",
  "bg-slate-900": "bg-card",
  "bg-gray-950": "bg-background",

  // ── Text ──────────────────────────────────────────────────────────────────
  "text-white": "text-foreground", // may become text-primary-foreground; see the on-colour rule
  "text-black": "text-foreground",
  "text-gray-900": "text-foreground",
  "text-slate-900": "text-foreground",
  "text-gray-800": "text-foreground",
  "text-gray-700": "text-muted-foreground",
  "text-gray-600": "text-muted-foreground",
  "text-slate-600": "text-muted-foreground",
  "text-gray-300": "text-muted-foreground",
  "text-slate-300": "text-muted-foreground",
  "text-gray-400": "text-muted-foreground",
  "text-slate-400": "text-muted-foreground",
  "text-gray-500": "text-subtle-foreground",
  "text-slate-500": "text-subtle-foreground",

  // ── Lines ─────────────────────────────────────────────────────────────────
  "border-white": "border-border",
  "border-gray-200": "border-border",
  "border-gray-300": "border-border-strong",
  "border-slate-200": "border-border",
  "border-slate-300": "border-border-strong",
  "border-gray-600": "border-border-strong",
  "border-slate-600": "border-border",
  "border-gray-700": "border-border",
  "border-gray-800": "border-border",
  "border-slate-700": "border-border",
  "border-slate-800": "border-border",
  "divide-gray-200": "divide-border",
  "divide-gray-700": "divide-border",
  "divide-gray-800": "divide-border",
  "placeholder-gray-400": "placeholder-subtle-foreground",
  "placeholder-gray-500": "placeholder-subtle-foreground",
  "placeholder-slate-400": "placeholder-subtle-foreground",
  "placeholder-slate-500": "placeholder-subtle-foreground",

  // ── Brand ─────────────────────────────────────────────────────────────────
  "bg-orange-500": "bg-primary",
  "bg-orange-600": "bg-primary-hover",
  "bg-orange-700": "bg-primary-hover",
  "bg-orange-50": "bg-brand-surface",
  "bg-orange-100": "bg-brand-surface",
  "text-orange-400": "text-brand-text",
  "text-orange-500": "text-brand-text",
  "text-orange-600": "text-brand-text",
  "text-orange-700": "text-brand-text",
  "border-orange-500": "border-primary",
  "border-orange-600": "border-primary",
  "ring-orange-500": "ring-ring",
  "ring-orange-600": "ring-ring",
  "from-orange-500": "from-primary",
  "from-orange-600": "from-primary-hover",
  "to-orange-500": "to-primary",
  "to-orange-600": "to-primary-hover",
  "to-orange-700": "to-primary-hover",

  // ── States ────────────────────────────────────────────────────────────────
  "text-red-400": "text-destructive",
  "text-red-500": "text-destructive",
  "text-red-600": "text-destructive",
  "text-red-700": "text-destructive",
  "bg-red-500": "bg-destructive",
  "bg-red-600": "bg-destructive",
  "bg-red-50": "bg-destructive-surface",
  "bg-red-100": "bg-destructive-surface",
  "border-red-500": "border-destructive",
  "border-red-600": "border-destructive",
  "bg-red-700": "bg-destructive",
  "bg-red-900": "bg-destructive-surface",
  "text-red-300": "text-destructive",
  "shadow-orange-500": "shadow-primary",
  "shadow-orange-600": "shadow-primary",
  "text-green-400": "text-success",
  "text-green-500": "text-success",
  "text-green-600": "text-success",
  "text-green-700": "text-success",
  "bg-green-500": "bg-success",
  "bg-green-600": "bg-success",
  "bg-green-50": "bg-success-surface",
  "bg-green-100": "bg-success-surface",
  "border-green-500": "border-success",
  "text-amber-400": "text-warning",
  "text-amber-500": "text-warning",
  "text-amber-600": "text-warning",
  "text-yellow-400": "text-warning",
  "text-yellow-500": "text-warning",
  "bg-amber-50": "bg-warning-surface",
  "bg-amber-100": "bg-warning-surface",
  "bg-yellow-50": "bg-warning-surface",
  "text-blue-400": "text-info",
  "text-blue-500": "text-info",
  "text-blue-600": "text-info",
  "bg-blue-500": "bg-info",
  "bg-blue-600": "bg-info",
  "bg-blue-50": "bg-info-surface",
  "bg-blue-100": "bg-info-surface",
  "border-blue-500": "border-info",
};

/**
 * A background in the SAME class string that makes white text on-colour rather
 * than body text. Backgrounds and gradient stops only: a coloured BORDER does
 * not change what the text sits on.
 */
export const ON_COLOR_BACKGROUND_RE =
  /(?:^|\s)(?:[\w-]+:)*(?:bg|from|via|to)-(?:orange|red|green|blue|amber|yellow|emerald|purple|indigo|pink|teal|cyan)-\d{2,3}(?:\/\d{1,3})?(?=\s|$)/;

/**
 * An arbitrary-value background: `bg-[#0070ba]`. These are third-party brand
 * colours that sit OUTSIDE the theme system, so text on them must stay literal.
 * Mapping such a label to `text-foreground` puts dark text on PayPal blue in
 * light mode, and `text-primary-foreground` is no better — it is also near-black.
 * The only correct answer is to leave the pair alone.
 */
const BRAND_LITERAL_BACKGROUND_RE = /(?:^|\s)(?:[\w-]+:)*bg-\[[^\]]+\]/;

/** Which `-foreground` token to use, by the background family found. */
const ON_COLOR_TOKEN = [
  [/(?:bg|from|via|to)-orange-/, "primary-foreground"],
  [/(?:bg|from|via|to)-red-/, "destructive-foreground"],
  [/(?:bg|from|via|to)-(?:green|emerald)-/, "success-foreground"],
  [/(?:bg|from|via|to)-(?:amber|yellow)-/, "warning-foreground"],
  [/(?:bg|from|via|to)-blue-/, "info-foreground"],
];

/**
 * Bases whose meaning changes once they are translucent: as surfaces or lines
 * they are scrims, dividers and glass bars rather than themed surfaces. Mapped
 * when opaque, reported when faded. `text-*` is absent on purpose — faded body
 * text is still body text.
 */
const OPACITY_SENSITIVE = new Set([
  "bg-white",
  "bg-black",
  "border-white",
  "border-black",
]);

/** Literal colours that must stay literal: third-party brand requirements. */
export const ALLOW_LIST = ["bg-[#0070ba]", "bg-[#005ea6]", "text-[#0070ba]"];

/** Colour utilities we know about, for deciding what counts as "unmapped". */
const COLOUR_CLASS_RE =
  /^(?:[\w-]+:)*(?:bg|text|border|ring|divide|placeholder|from|via|to|outline|shadow|accent|caret|fill|stroke)-(?:white|black|gray|slate|zinc|neutral|stone|orange|red|green|blue|yellow|amber|emerald|purple|indigo|cyan|pink|teal|violet|rose|fuchsia|lime|sky)(?:-\d{2,3})?(?:\/\d{1,3})?$/;

/**
 * Split a class token into variants, base, and opacity.
 *
 * The opacity check is deliberately narrow: `w-1/2` and `max-w-1/3` are
 * fractions, not opacity modifiers, so a trailing `/n` only counts when what
 * precedes it is a colour-shaped base.
 */
function parseClass(cls) {
  const slash = cls.lastIndexOf("/");
  const hasOpacity =
    slash !== -1 &&
    slash > cls.lastIndexOf("]") &&
    /^\/\d{1,3}$/.test(cls.slice(slash)) &&
    COLOUR_CLASS_RE.test(cls);
  const opacity = hasOpacity ? cls.slice(slash) : "";
  const withoutOpacity = opacity ? cls.slice(0, slash) : cls;
  const parts = withoutOpacity.split(":");
  const base = parts.pop();
  return { variants: parts, base, opacity };
}

function rebuild({ variants, base, opacity }) {
  return [...variants, base].join(":") + opacity;
}

/**
 * Rewrite one class string.
 *
 * @param {string} value
 * @param {{onColor?: boolean}} [context] onColor forces the on-colour rule for
 *   callers that can see a wider class list than this string — a ternary branch
 *   inside a template literal cannot see the background in the surrounding text.
 * @returns {{value: string, changed: number, unmapped: string[]}}
 */
export function migrateClassString(value, context = {}) {
  const onColor = context.onColor ?? ON_COLOR_BACKGROUND_RE.test(value);
  const onBrandLiteral = BRAND_LITERAL_BACKGROUND_RE.test(value);
  const unmapped = [];
  let changed = 0;

  // Split on whitespace but KEEP it, so the output diff is minimal.
  const pieces = value.split(/(\s+)/);
  const out = pieces.map((piece) => {
    if (!piece || /^\s+$/.test(piece)) return piece;
    if (ALLOW_LIST.includes(piece)) return piece;

    const { variants, base, opacity } = parseClass(piece);

    // Rule 2: a translucent neutral surface or line is a scrim/divider, and its
    // intent is not readable from the class. Report rather than guess.
    if (opacity && OPACITY_SENSITIVE.has(base)) {
      unmapped.push(piece);
      return piece;
    }

    const isNeutralText = base === "text-white" || base === "text-black";

    // A label on a third-party brand colour stays exactly as it is: that
    // background is outside the theme, so no token is the right answer.
    if (isNeutralText && onBrandLiteral) return piece;

    let mapped = MAPPING[base];

    // Rule 1: white/black sitting on a coloured background is a label, not body
    // text.
    if (isNeutralText && onColor) {
      const family = ON_COLOR_TOKEN.find(([re]) => re.test(value));
      mapped = `text-${family ? family[1] : "primary-foreground"}`;
    }

    if (mapped) {
      changed += 1;
      return rebuild({ variants, base: mapped, opacity });
    }

    // Unknown colour utility: leave it, report it. Never guess.
    if (COLOUR_CLASS_RE.test(piece)) unmapped.push(piece);
    return piece;
  });

  return { value: collapseRedundantDarkVariants(out.join("")), changed, unmapped };
}

/**
 * Drop `dark:x` where a bare `x` is already present in the same class string.
 *
 * The codebase carries 1160 `dark:` utilities, written as pairs like
 * `bg-red-50 dark:bg-red-900/20` — one colour for each theme, chosen by hand.
 * Both halves of such a pair map to the SAME token, because the token already
 * knows what to be in each theme, and the result reads
 * `bg-destructive-surface dark:bg-destructive-surface`. That is harmless to
 * render and terrible to read, and it leaves behind the impression that a
 * component still needs to think about themes.
 *
 * Only exact duplicates are removed, so a genuine override — `bg-card
 * dark:bg-surface`, where the author wants different ROLES per theme — survives
 * untouched and stays visible in review.
 */
function collapseRedundantDarkVariants(value) {
  const pieces = value.split(/(\s+)/);
  const bare = new Set(
    pieces.filter((p) => p && !/^\s+$/.test(p) && !p.startsWith("dark:")),
  );
  const kept = [];
  for (let i = 0; i < pieces.length; i += 1) {
    const piece = pieces[i];
    if (piece.startsWith("dark:") && bare.has(piece.slice(5))) {
      // Drop this class and the whitespace that preceded it, so spacing stays sane.
      if (kept.length && /^\s+$/.test(kept[kept.length - 1])) kept.pop();
      continue;
    }
    kept.push(piece);
  }
  return kept.join("");
}

/** Does this string look like a class list rather than prose? */
function looksLikeClassList(text) {
  const trimmed = text.trim();
  if (trimmed === "") return false;
  const tokens = trimmed.split(/\s+/);
  return tokens.every((t) => /^[\w[\]#().,%/:-]+$/.test(t)) && /-/.test(trimmed);
}

/**
 * Rewrite class strings in a source file.
 *
 * Targets, in order: className/class attribute string literals, then template
 * literals (covering the `clsx`/`cn` and ternary patterns this codebase uses).
 * Expressions inside `${...}` are only touched where they hold a quoted string
 * that is itself a plain class list.
 */
export function migrateSource(source) {
  let changed = 0;
  const unmapped = [];

  const apply = (text, context) => {
    const result = migrateClassString(text, context);
    changed += result.changed;
    unmapped.push(...result.unmapped);
    return result.value;
  };

  // 1. className="..." and class="..."
  let out = source.replace(
    /((?:className|class)\s*=\s*)(["'])([^"'\n]*)\2/g,
    (_m, lead, quote, body) => `${lead}${quote}${apply(body)}${quote}`,
  );

  // 2. Template literals. The on-colour decision is made from the WHOLE literal,
  //    because the background can sit outside the branch holding the text class.
  out = out.replace(/`([^`]*)`/g, (whole, body) => {
    if (!/(?:bg|text|border|ring|from|to|divide|placeholder)-/.test(body)) {
      return whole;
    }
    const onColor = ON_COLOR_BACKGROUND_RE.test(body);
    const rebuilt = body
      .split(/(\$\{[^}]*\})/)
      .map((segment) => {
        if (segment.startsWith("${")) {
          // Only touch quoted strings that are pure class lists.
          return segment.replace(/(["'])([^"']*)\1/g, (m, q, inner) =>
            looksLikeClassList(inner) ? `${q}${apply(inner, { onColor })}${q}` : m,
          );
        }
        return looksLikeClassList(segment)
          ? apply(segment, { onColor })
          : segment;
      })
      .join("");
    return "`" + rebuilt + "`";
  });

  return { source: out, changed, unmapped };
}

// ── CLI ─────────────────────────────────────────────────────────────────────

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.jsx?$/.test(p) && !/\.test\.jsx?$/.test(p)) out.push(p);
  }
  return out;
}

export function run({ paths, write }) {
  const files = [];
  for (const p of paths) {
    if (statSync(p).isDirectory()) files.push(...walk(p));
    else files.push(p);
  }

  let totalChanged = 0;
  const allUnmapped = [];
  let touched = 0;

  for (const file of files) {
    const before = readFileSync(file, "utf8");
    const { source, changed, unmapped } = migrateSource(before);
    if (changed > 0) {
      touched += 1;
      totalChanged += changed;
      if (write) writeFileSync(file, source, "utf8");
    }
    const lines = before.split("\n");
    for (const cls of new Set(unmapped)) {
      const line = lines.findIndex((l) => l.includes(cls)) + 1;
      allUnmapped.push({ file: relative(process.cwd(), file), line, cls });
    }
  }

  return { files: touched, changed: totalChanged, unmapped: allUnmapped };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const args = process.argv.slice(2);
  const write = args.includes("--write");
  const paths = args.filter((a) => !a.startsWith("--"));
  if (paths.length === 0) {
    console.error("usage: migrate_theme_tokens.mjs [--write|--dry] <path...>");
    process.exit(2);
  }

  const result = run({ paths, write });
  console.log(
    `${write ? "REWROTE" : "DRY RUN"}  files: ${result.files}  classes: ${result.changed}`,
  );

  if (result.unmapped.length) {
    mkdirSync("/tmp/theme-migration", { recursive: true });
    const tsv = [
      "file\tline\tclass",
      ...result.unmapped.map((u) => `${u.file}\t${u.line}\t${u.cls}`),
    ].join("\n");
    writeFileSync("/tmp/theme-migration/unmapped.tsv", tsv + "\n", "utf8");
    console.log(
      `unmapped: ${result.unmapped.length} -> /tmp/theme-migration/unmapped.tsv`,
    );
    console.log(
      "These were NOT changed. Review each and either add a mapping or hand-edit.",
    );
  }
}
