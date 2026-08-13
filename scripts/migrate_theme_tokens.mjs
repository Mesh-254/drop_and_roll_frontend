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

/**
 * THE MAPPING IS GENERATED FROM RULES, NOT TYPED OUT.
 * ───────────────────────────────────────────────────────────────────────────
 * A first pass at this was a hand-written table. It reached about 100 entries
 * covering `common/`, and the remaining streams then reported 650 unmapped
 * classes needing roughly 180 more — the same handful of decisions repeated
 * across nine colour families, twelve shades and fourteen property prefixes.
 * Typing that out invites exactly the kind of silent transposition
 * (`text-blue-700` -> success) that no test would catch.
 *
 * So the decisions live in RULES, and the table is derived. Two ideas only:
 *
 *   FAMILY -> ROLE   gray/slate/zinc/... are neutral surfaces and text;
 *                    red/rose mean destructive; green/emerald/teal success;
 *                    amber/yellow warning; blue/sky/indigo/cyan info;
 *                    orange is the brand.
 *
 *   SHADE -> TIER    within a role, how light or dark the shade is says which
 *                    token it wanted: gray-900 is a card, gray-800 a panel,
 *                    gray-500 tertiary text, red-50 an error surface, red-600
 *                    the error colour itself.
 *
 * OVERRIDES holds the judgement calls that the rules get wrong, each with its
 * reason. Everything the tests pin is reproduced exactly by this construction —
 * that is what the test suite is for.
 */

const NEUTRAL_FAMILIES = ["gray", "slate", "zinc", "neutral", "stone"];

/** family -> role token stem. Orange is handled separately: it has three stems. */
const STATE_FAMILIES = {
  red: "destructive",
  rose: "destructive",
  green: "success",
  emerald: "success",
  teal: "success",
  amber: "warning",
  yellow: "warning",
  blue: "info",
  sky: "info",
  indigo: "info",
  cyan: "info",
};

const SHADES = [
  "50", "100", "200", "300", "400", "500", "600", "700", "800", "900", "950",
];

/** Neutral shade -> token, per property group. */
const NEUTRAL = {
  bg: {
    50: "muted", 100: "muted", 200: "surface-hover", 300: "surface-hover",
    400: "surface-hover", 500: "surface-hover", 600: "surface-hover",
    700: "surface-hover", 800: "surface", 900: "card", 950: "background",
    white: "card", black: "background",
  },
  text: {
    50: "foreground", 100: "foreground", 200: "foreground",
    300: "muted-foreground", 400: "muted-foreground", 500: "subtle-foreground",
    600: "muted-foreground", 700: "muted-foreground", 800: "foreground",
    900: "foreground", 950: "foreground", white: "foreground",
    black: "foreground",
  },
  border: {
    50: "border", 100: "border", 200: "border", 300: "border-strong",
    400: "border-strong", 500: "border-strong", 600: "border-strong",
    700: "border", 800: "border", 900: "border", 950: "border",
    white: "border", black: "border",
  },
  ring: {
    50: "border-strong", 100: "border-strong", 200: "border-strong",
    300: "border-strong", 400: "border-strong", 500: "border-strong",
    600: "border-strong", 700: "border-strong", 800: "border-strong",
    900: "border-strong", 950: "border-strong", white: "border-strong",
    black: "border-strong",
  },
  placeholder: {
    300: "subtle-foreground", 400: "subtle-foreground", 500: "subtle-foreground",
    600: "subtle-foreground",
  },
  divide: {
    50: "border", 100: "border", 200: "border", 300: "border", 400: "border",
    500: "border", 600: "border", 700: "border", 800: "border", 900: "border",
  },
};
// Gradient stops follow surfaces.
NEUTRAL.from = NEUTRAL.bg;
NEUTRAL.via = NEUTRAL.bg;
NEUTRAL.to = NEUTRAL.bg;

/** Which shades of a state family mean "the tinted surface" rather than "the colour". */
const SURFACE_SHADES = new Set(["50", "100", "200", "900", "950"]);
/** Which shades of a state family want a subtle tinted BORDER rather than a solid one. */
const SUBTLE_BORDER_SHADES = new Set(["50", "100", "200", "300", "700", "800", "900", "950"]);

/** Brand (orange) needs three stems, so it gets its own shade tables. */
const BRAND = {
  bg: {
    50: "brand-surface", 100: "brand-surface", 200: "brand-surface",
    300: "primary", 400: "primary", 500: "primary", 600: "primary-hover",
    700: "primary-hover", 800: "primary-hover", 900: "brand-surface",
    950: "brand-surface",
  },
  text: Object.fromEntries(SHADES.map((s) => [s, "brand-text"])),
  ring: Object.fromEntries(SHADES.map((s) => [s, "ring"])),
  accent: Object.fromEntries(SHADES.map((s) => [s, "primary"])),
  shadow: Object.fromEntries(SHADES.map((s) => [s, "primary"])),
  fill: Object.fromEntries(SHADES.map((s) => [s, "brand-text"])),
  stroke: Object.fromEntries(SHADES.map((s) => [s, "brand-text"])),
};
BRAND.border = Object.fromEntries(
  SHADES.map((s) => [s, SUBTLE_BORDER_SHADES.has(s) ? "primary/30" : "primary"]),
);
BRAND.from = BRAND.bg;
BRAND.via = BRAND.bg;
BRAND.to = BRAND.bg;

function stateTokenFor(prefix, stem, shade) {
  switch (prefix) {
    case "bg":
    case "from":
    case "via":
    case "to":
      return SURFACE_SHADES.has(shade) ? `${stem}-surface` : stem;
    case "border":
      return SUBTLE_BORDER_SHADES.has(shade) ? `${stem}/30` : stem;
    case "text":
    case "ring":
    case "fill":
    case "stroke":
    case "shadow":
    case "accent":
    case "outline":
      return stem;
    case "divide":
      return "border";
    default:
      return null;
  }
}

/**
 * Judgement calls the rules get wrong. Each one is a place where the shade does
 * not tell the truth about the role.
 */
const OVERRIDES = {
  // These two are the dominant DARK PANEL in this codebase (127 + 51 uses),
  // used as a raised surface rather than the hover state the 700/800 rule
  // would infer.
  "bg-slate-700": "bg-surface",
  "bg-gray-800": "bg-surface",
  // slate-600 borders are the standard resting border on dark cards here, not
  // the emphasis border that shade 600 normally implies.
  "border-slate-600": "border-border",
  // Read as an input surface rather than a page background.
  "bg-gray-700": "bg-surface-hover",
  // The brand gradient's two stops: keep them distinct so the gradient stays a
  // gradient rather than collapsing to a flat fill.
  "from-orange-500": "from-primary",
  "to-orange-600": "to-primary-hover",
};

/** Bare class (no variant, no opacity) -> token class. Generated; see above. */
export const MAPPING = (() => {
  const table = {};
  const add = (cls, token) => {
    if (token) table[cls] = token;
  };

  for (const family of NEUTRAL_FAMILIES) {
    for (const [prefix, shades] of Object.entries(NEUTRAL)) {
      for (const shade of SHADES) {
        add(`${prefix}-${family}-${shade}`, shades[shade] && `${prefix}-${shades[shade]}`);
      }
    }
  }

  // white and black are neutrals without a shade number.
  for (const [prefix, shades] of Object.entries(NEUTRAL)) {
    for (const bare of ["white", "black"]) {
      add(`${prefix}-${bare}`, shades[bare] && `${prefix}-${shades[bare]}`);
    }
  }

  for (const [family, stem] of Object.entries(STATE_FAMILIES)) {
    for (const prefix of [
      "bg", "text", "border", "ring", "from", "via", "to", "divide", "fill",
      "stroke", "shadow", "accent", "outline",
    ]) {
      for (const shade of SHADES) {
        const token = stateTokenFor(prefix, stem, shade);
        add(`${prefix}-${family}-${shade}`, token && `${prefix}-${token}`);
      }
    }
  }

  for (const [prefix, shades] of Object.entries(BRAND)) {
    for (const shade of SHADES) {
      add(`${prefix}-orange-${shade}`, shades[shade] && `${prefix}-${shades[shade]}`);
    }
  }

  return { ...table, ...OVERRIDES };
})();

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

/**
 * A full-bleed translucent black is a modal scrim, and every one in this
 * codebase is written `fixed inset-0 bg-black/50` (or /40, /60, /80). The
 * `--overlay` token already encodes the translucency, so the opacity modifier
 * is dropped rather than compounded. Scrims stay dark in BOTH themes, which is
 * what a scrim is for — `--overlay` is a dark mix in the light theme too.
 *
 * Requiring `inset-0` is what keeps this honest: the mobile menu's `bg-black/95`
 * is a glass bar rather than a scrim, has no inset-0, and is still reported for
 * a human to place.
 */
const SCRIM_CONTEXT_RE = /(?:^|\s)inset-0(?:\s|$)/;

/**
 * Tokens that already carry their own translucency, so an incoming opacity
 * modifier must be discarded instead of multiplied. The dark halves of state
 * pairs are written `dark:bg-green-900/20`; the token is a 15% mix already, and
 * `bg-success-surface/20` would fade that to almost nothing. Dropping the
 * modifier also lets the pair collapse against its light half.
 */
const SELF_TRANSLUCENT_TOKENS = new Set([
  "bg-destructive-surface",
  "bg-success-surface",
  "bg-warning-surface",
  "bg-info-surface",
  "bg-brand-surface",
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
    // intent is not readable from the class alone — with one exception that IS
    // readable, a full-bleed translucent black, which is always a modal scrim.
    if (opacity && OPACITY_SENSITIVE.has(base)) {
      if (base === "bg-black" && SCRIM_CONTEXT_RE.test(value)) {
        changed += 1;
        return rebuild({ variants, base: "bg-overlay", opacity: "" });
      }
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
      // A token that is already translucent must not have an incoming opacity
      // multiplied onto it, and a mapping that carries its own opacity (the
      // subtle state borders) keeps the source's modifier when there is one.
      const keepOpacity = SELF_TRANSLUCENT_TOKENS.has(mapped)
        ? ""
        : mapped.includes("/") && opacity
          ? ""
          : opacity;
      return rebuild({ variants, base: mapped, opacity: keepOpacity });
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
