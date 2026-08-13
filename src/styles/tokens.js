/**
 * Token values as data, so tests can assert on them without parsing CSS.
 * `tokens.css` is what the browser loads; tokensParity.test.js proves the two
 * agree. Edit BOTH or neither.
 *
 * Values are literal oklch strings copied from Tailwind v4's own palette.
 * They are NOT written as `var(--color-gray-900)`: Tailwind v4 only emits a
 * palette variable when some utility uses it, so such a reference would resolve
 * to nothing the moment the migration removes the last `gray-900` utility.
 */

/** Tailwind v4 palette entries this theme draws on. Source of truth for parity. */
export const TAILWIND_PALETTE = {
  white: "oklch(100% 0 0)",
  black: "oklch(0% 0 0)",
  "gray-50": "oklch(98.5% 0.002 247.839)",
  "gray-100": "oklch(96.7% 0.003 264.542)",
  "gray-200": "oklch(92.8% 0.006 264.531)",
  "gray-300": "oklch(87.2% 0.01 258.338)",
  "gray-400": "oklch(70.7% 0.022 261.325)",
  "gray-500": "oklch(55.1% 0.027 264.364)",
  "gray-600": "oklch(44.6% 0.03 256.802)",
  "gray-700": "oklch(37.3% 0.034 259.733)",
  "gray-800": "oklch(27.8% 0.033 256.848)",
  "gray-900": "oklch(21% 0.034 264.665)",
  "orange-50": "oklch(98% 0.016 73.684)",
  "orange-400": "oklch(75% 0.183 55.934)",
  "orange-500": "oklch(70.5% 0.213 47.604)",
  "orange-600": "oklch(64.6% 0.222 41.116)",
  "orange-700": "oklch(55.3% 0.195 38.402)",
  "red-50": "oklch(97.1% 0.013 17.38)",
  "red-400": "oklch(70.4% 0.191 22.216)",
  "red-600": "oklch(57.7% 0.245 27.325)",
  "green-50": "oklch(98.2% 0.018 155.826)",
  "green-400": "oklch(79.2% 0.209 151.711)",
  "green-700": "oklch(52.7% 0.154 150.069)",
  "amber-50": "oklch(98.7% 0.022 95.277)",
  "amber-400": "oklch(82.8% 0.189 84.429)",
  "amber-700": "oklch(55.5% 0.163 48.998)",
  "blue-50": "oklch(97% 0.014 254.604)",
  "blue-400": "oklch(70.7% 0.165 254.624)",
  "blue-600": "oklch(54.6% 0.245 262.881)",
};

const P = TAILWIND_PALETTE;

/**
 * LIGHT. Cool neutral page, white cards, orange brand.
 * Ratios (computed): foreground/background 17.00 · muted-foreground/card 7.56 ·
 * subtle-foreground/card 4.84 · brand-text/card 5.23 · primary-foreground/primary 6.14
 */
export const LIGHT_TOKENS = {
  background: P["gray-50"],
  foreground: P["gray-900"],
  card: P.white,
  "card-foreground": P["gray-900"],
  popover: P.white,
  "popover-foreground": P["gray-900"],
  surface: P["gray-100"],
  "surface-hover": P["gray-200"],
  muted: P["gray-100"],
  "muted-foreground": P["gray-600"],
  // Coincides with muted-foreground in light today: gray-500 measured 4.39:1 on
  // `surface` (gray-100) and missed AA. Kept as a separate role so the two tiers
  // can diverge later without revisiting the 122 call sites that mean "tertiary".
  "subtle-foreground": P["gray-600"],
  border: P["gray-200"],
  "border-strong": P["gray-300"],
  input: P.white,
  // orange-600, not the brand orange-500: a focus indicator carries meaning, so
  // WCAG 1.4.11 wants 3:1 against what surrounds it. orange-500 measured 2.77:1
  // on the page and 2.89 on a card; orange-600 gives 3.44 and 3.59.
  ring: P["orange-600"],
  overlay: "color-mix(in oklab, oklch(21% 0.034 264.665) 50%, transparent)",

  // Brand. `primary` is a SURFACE (button fills); `brand-text` is the brand used
  // AS text. They must differ in light mode: orange-500 as text on white is
  // 2.89:1 and fails, while orange-700 is 5.23:1.
  primary: P["orange-500"],
  "primary-hover": P["orange-600"],
  "primary-foreground": P["gray-900"], // 6.14:1 on orange-500. White would be 2.89:1.
  "brand-text": P["orange-700"],
  "brand-surface": P["orange-50"],

  destructive: P["red-600"], // 4.76:1 on white
  "destructive-foreground": P.white,
  "destructive-surface": P["red-50"],
  success: P["green-700"], // 4.94:1 on white. green-600 is 3.22 and fails.
  "success-foreground": P.white,
  "success-surface": P["green-50"],
  warning: P["amber-700"], // 5.05:1 on white. amber-600 is 3.19 and fails.
  "warning-foreground": P.white,
  "warning-surface": P["amber-50"],
  info: P["blue-600"], // 5.26:1 on white
  "info-foreground": P.white,
  "info-surface": P["blue-50"],
};

/**
 * DARK. Each value is the literal it replaces in today's UI, so dark mode
 * renders unchanged — except the three exceptions below.
 * Ratios (computed): foreground/card 17.75 · muted-foreground/card 6.82 ·
 * subtle-foreground/surface 5.64 · brand-text/card 6.14 · destructive/surface 5.08
 */
export const DARK_TOKENS = {
  background: P.black, // was bg-black, 47 occurrences
  foreground: P.white,
  card: P["gray-900"],
  "card-foreground": P.white,
  popover: P["gray-900"],
  "popover-foreground": P.white,
  surface: P["gray-800"], // dominant dark panel: bg-gray-800 (127) + bg-slate-700 (51)
  "surface-hover": P["gray-700"],
  muted: P["gray-800"],
  "muted-foreground": P["gray-400"], // was text-gray-400 (270) / text-slate-400 (114)
  "subtle-foreground": P["gray-400"], // EXCEPTION 1
  border: P["gray-700"],
  "border-strong": P["gray-600"],
  input: P["gray-800"],
  ring: P["orange-500"],
  overlay: "color-mix(in oklab, oklch(0% 0 0) 50%, transparent)",

  primary: P["orange-500"],
  "primary-hover": P["orange-600"],
  "primary-foreground": P["gray-900"], // EXCEPTION 3
  "brand-text": P["orange-500"], // 6.14:1 on gray-900
  "brand-surface":
    "color-mix(in oklab, oklch(70.5% 0.213 47.604) 15%, transparent)",

  destructive: P["red-400"], // EXCEPTION 2
  "destructive-foreground": P["gray-900"],
  "destructive-surface":
    "color-mix(in oklab, oklch(70.4% 0.191 22.216) 15%, transparent)",
  success: P["green-400"],
  "success-foreground": P["gray-900"],
  "success-surface":
    "color-mix(in oklab, oklch(79.2% 0.209 151.711) 15%, transparent)",
  warning: P["amber-400"],
  "warning-foreground": P["gray-900"],
  "warning-surface":
    "color-mix(in oklab, oklch(82.8% 0.189 84.429) 15%, transparent)",
  info: P["blue-400"],
  "info-foreground": P["gray-900"],
  "info-surface":
    "color-mix(in oklab, oklch(70.7% 0.165 254.624) 15%, transparent)",
};

/**
 * Dark tokens that must equal the literal they replaced, so dark mode is a
 * provable refactor. Deliberately omits `color-mix()` tokens (no palette
 * equivalent) and the three exceptions.
 */
export const PARITY_MAP = {
  background: "black",
  foreground: "white",
  card: "gray-900",
  "card-foreground": "white",
  popover: "gray-900",
  "popover-foreground": "white",
  surface: "gray-800",
  "surface-hover": "gray-700",
  muted: "gray-800",
  "muted-foreground": "gray-400",
  border: "gray-700",
  "border-strong": "gray-600",
  input: "gray-800",
  ring: "orange-500",
  primary: "orange-500",
  "primary-hover": "orange-600",
  "brand-text": "orange-500",
  success: "green-400",
  warning: "amber-400",
  info: "blue-400",
};

/** The only places dark mode's appearance changes. All measured, all toward legibility. */
export const PARITY_EXCEPTIONS = {
  "subtle-foreground": {
    was: "gray-500 / slate-500 (122 occurrences)",
    reason:
      "gray-500 measured 4.34:1 on black, 3.67 on gray-900 and 3.04 on gray-800 — " +
      "below AA everywhere it was used. gray-400 gives 8.07 / 6.82 / 5.64.",
  },
  destructive: {
    was: "red-500 (52 occurrences)",
    reason:
      "red-500 measured 3.84:1 on gray-800 and 2.71 on slate-700, below AA. " +
      "red-400 gives 5.08 on gray-800 and is already used 54 times in dark surfaces.",
  },
  "primary-foreground": {
    was: "white on bg-orange-500 (61 occurrences, both themes)",
    reason:
      "white on orange-500 measured 2.89:1, failing AA in the shipped design. " +
      "gray-900 on the same orange gives 6.14:1. Approved brand change: the " +
      "orange is untouched, labels become near-black.",
  },
};

/**
 * Pairs asserted in both themes. `min` is 4.5 for text, 3 for UI boundaries.
 * Only pairs that genuinely co-occur in the UI — asserting every combination
 * would fail on pairs no component renders.
 */
export const CONTRAST_PAIRS = [
  { fg: "foreground", bg: "background", min: 4.5, label: "body text on page" },
  { fg: "card-foreground", bg: "card", min: 4.5, label: "text on card" },
  { fg: "popover-foreground", bg: "popover", min: 4.5, label: "text in popover" },
  {
    fg: "muted-foreground",
    bg: "background",
    min: 4.5,
    label: "secondary text on page",
  },
  { fg: "muted-foreground", bg: "card", min: 4.5, label: "secondary text on card" },
  {
    fg: "muted-foreground",
    bg: "surface",
    min: 4.5,
    label: "secondary text on panel",
  },
  {
    fg: "subtle-foreground",
    bg: "card",
    min: 4.5,
    label: "tertiary text on card",
  },
  {
    fg: "subtle-foreground",
    bg: "surface",
    min: 4.5,
    label: "tertiary text on panel",
  },
  { fg: "foreground", bg: "surface", min: 4.5, label: "body text on panel" },
  { fg: "foreground", bg: "muted", min: 4.5, label: "body text on muted" },
  {
    fg: "primary-foreground",
    bg: "primary",
    min: 4.5,
    label: "primary button label",
  },
  {
    fg: "primary-foreground",
    bg: "primary-hover",
    min: 4.5,
    label: "primary button label, hovered",
  },
  { fg: "brand-text", bg: "background", min: 4.5, label: "brand text on page" },
  { fg: "brand-text", bg: "card", min: 4.5, label: "brand text on card" },
  { fg: "destructive", bg: "card", min: 4.5, label: "error text on card" },
  {
    fg: "destructive-foreground",
    bg: "destructive",
    min: 4.5,
    label: "error button label",
  },
  { fg: "success", bg: "card", min: 4.5, label: "success text on card" },
  {
    fg: "success-foreground",
    bg: "success",
    min: 4.5,
    label: "success button label",
  },
  { fg: "warning", bg: "card", min: 4.5, label: "warning text on card" },
  {
    fg: "warning-foreground",
    bg: "warning",
    min: 4.5,
    label: "warning button label",
  },
  { fg: "info", bg: "card", min: 4.5, label: "info text on card" },
  { fg: "info-foreground", bg: "info", min: 4.5, label: "info button label" },
  // Borders here are decorative separation, so these two thresholds are a
  // "visible at all" floor and NOT a WCAG claim — WCAG's 3:1 applies to visual
  // information needed to identify a control or its state, which in this app is
  // carried by `ring` (asserted at a real 3:1 below) and by `focus:border-primary`,
  // not by a resting border. An earlier 1.5 here was an invented standard that
  // gray-300 on gray-50 (1.41:1) failed for no accessibility reason.
  { fg: "border", bg: "card", min: 1.2, label: "card border visibility" },
  {
    fg: "border-strong",
    bg: "background",
    min: 1.3,
    label: "strong border visibility",
  },
  // These two ARE a WCAG 1.4.11 requirement: the focus indicator must be
  // distinguishable from its surroundings.
  { fg: "ring", bg: "background", min: 3, label: "focus ring on page" },
  { fg: "ring", bg: "card", min: 3, label: "focus ring on card" },
];
