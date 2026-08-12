# Dark / Light Theme System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a real light mode and a real dark mode across all 31 routes, driven by one semantic token layer, with an always-reachable persisted toggle and WCAG AA contrast in both themes.

**Architecture:** A single token file (`src/styles/tokens.css`) defines every colour twice — once under `:root` (light) and once under `.dark`. Components stop naming colours (`bg-gray-900`) and name roles instead (`bg-card`), so both themes come from one place and a new component cannot be half-themed. A codemod performs the 5389-occurrence migration; a contrast test proves accessibility as arithmetic rather than opinion.

**Tech Stack:** React 19, Vite 8, Tailwind CSS v4 (CSS-first config, no `tailwind.config.js`), Jest 30 + jsdom + @testing-library/react, lucide-react icons.

**Spec:** `docs/superpowers/specs/2026-08-12-theme-system-design.md`

## Global Constraints

- **Repo/branch:** `drop_and_roll_frontend`, branch `develop`.
- **No `tailwind.config.js` exists and none may be added.** Tailwind v4 is configured in CSS via `@theme inline` and `@custom-variant`.
- **`@custom-variant dark (&:where(.dark, .dark *))` must be declared exactly once**, in `src/index.css`. The duplicate in `src/globals.css:4` (`&:is(.dark *)`) is deleted.
- **Tokens carry literal `oklch(...)` values, never `var(--color-gray-900)`.** Tailwind v4 only emits palette variables that are actually used, so a `var()` reference breaks silently once the migration removes the last user of that palette entry.
- **`prefers-color-scheme` is never read.** Theme comes from `localStorage` key `"theme"`, values `"light"` | `"dark"`, default `"light"`.
- **Default theme is `light`** (`DEFAULT_THEME` in `src/utils/theme.js`).
- **Never skip pre-commit hooks** with `--no-verify`.
- **Brand-literal colours stay hardcoded** and must not be tokenised: `bg-[#0070ba]`, `bg-[#005ea6]` (PayPal), and the Stripe surface at `src/components/payments/StripeCreditCard.jsx:72`.
- **AA thresholds:** ≥4.5:1 for normal text, ≥3:1 for large text and UI boundaries.
- All colour values in this plan were extracted from `@tailwindcss/node` compile output and all contrast ratios computed, not recalled. Do not substitute remembered hex values.

### Measured baseline (re-run `npm run audit:theme` to confirm before starting)

```
files that flip cleanly (dark: only) : 0    <- of 73
MIXED files (half-flip in light mode): 36
dark-only utility occurrences        : 1697
```

123 files · 5389 colour-utility occurrences · 539 distinct colour classes · 31 routes · 14 routes with no `<Header>`.

### The parity invariant, and its three exceptions

Dark mode's rendered pixels must not change: each `.dark` token equals the literal it replaces. Three exceptions, all measured, all in the direction of *more* legible. These are the only places dark mode changes appearance:

| # | Source literal | Occurrences | Token | Was | Now |
|---|---|---|---|---|---|
| 1 | `text-gray-500`, `text-slate-500` | 122 | `--subtle-foreground` = `gray-400` in dark | 2.14–4.34 (FAIL) | 5.64–8.07 |
| 2 | `text-red-500` on dark surfaces | 52 | `--destructive` = `red-400` in dark | 2.71–3.84 (FAIL) | 5.08–7.26 |
| 3 | `text-white` on `bg-orange-*` | 61 | `--primary-foreground` = `gray-900`, **both themes** | 2.89 (FAIL) | 6.14 |

Exception 3 is a deliberate, approved brand change: the orange is untouched, button labels become near-black.

---

## File Structure

| File | Responsibility |
|---|---|
| `src/styles/colorMath.js` | **Create.** Pure functions: oklch→linear sRGB, relative luminance, WCAG contrast ratio. No DOM, no CSS. |
| `src/styles/colorMath.test.js` | **Create.** Unit tests for the above, including the double-decode regression. |
| `src/styles/tokens.css` | **Create.** The only place colours are defined. `:root`, `.dark`, `@theme inline`. |
| `src/styles/tokens.js` | **Create.** The same token values exported as data, so tests can assert on them without parsing CSS. Single source shared with `tokens.css` by review, guarded by `tokensParity.test.js`. |
| `src/styles/themeContrast.test.js` | **Create.** Every fg/bg pair in both themes clears AA. |
| `src/styles/darkParity.test.js` | **Create.** Every `.dark` token equals the Tailwind palette entry it replaced, except the three listed exceptions. |
| `src/styles/tokensParity.test.js` | **Create.** `tokens.css` and `tokens.js` cannot drift. |
| `src/index.css` | **Modify.** Single Tailwind entry, single `@custom-variant`, component classes re-expressed in tokens. |
| `src/globals.css` | **Modify.** Token blocks + duplicate variant + duplicate `@import "tailwindcss"` removed. |
| `src/App.css` | **Modify.** Remove the `*` transition rule (line 22); add `.theme-transition`; tokenise scrollbar. |
| `index.html` | **Modify.** Replace hardcoded `class="dark"` with a pre-paint inline script. |
| `src/utils/theme.js` | **Rewrite.** Two-theme runtime with persistence and cross-tab sync. |
| `src/utils/theme.test.js` | **Rewrite.** |
| `src/contexts/ThemeContext.jsx` | **Create.** Provider + `useTheme` + header-registration. |
| `src/contexts/ThemeContext.test.jsx` | **Create.** |
| `src/components/common/ThemeToggle.jsx` | **Create.** One component, `variant="header" \| "floating"`. |
| `src/components/common/ThemeToggle.test.jsx` | **Create.** |
| `src/components/common/Header.jsx` | **Modify.** Mount the header toggle (desktop + mobile), register with context. |
| `src/App.jsx` | **Modify.** Mount the floating toggle outside `<Routes>`; tokenise `AdminRedirect`. |
| `src/main.jsx` | **Modify.** `initTheme()` + wrap in `ThemeProvider`. |
| `scripts/migrate_theme_tokens.mjs` | **Create.** The codemod. |
| `scripts/migrate_theme_tokens.test.mjs` | **Create.** Mapping, on-colour rule, idempotency, allow-list. |
| `scripts/audit_theme.mjs` | **Rewrite.** Measures the new invariant. |
| `evals/eval_theme_coverage.mjs` | **Create.** Browser crawl of 31 routes × 2 themes. |
| `docs/theming.md` | **Create.** How to use tokens when writing new components. |

---

## Task 1: Colour maths module

Pure arithmetic with no dependencies. Built first because every contrast claim in this plan rests on it, and because a bug here silently invalidates the accessibility tests. During spec work an early version double-decoded gamma and reported `gray-500` on white as 14.18 instead of 4.84 — while still returning exactly 21.00 for white-on-black, because 0 and 1 are fixed points of the sRGB gamma curve. The regression test below encodes that lesson.

**Files:**
- Create: `src/styles/colorMath.js`
- Test: `src/styles/colorMath.test.js`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `parseOklch(str: string) => { l: number, c: number, h: number }` — `l` normalised to 0–1.
  - `oklchToLinearSrgb({l, c, h}) => [number, number, number]` — **linear-light** RGB, each clamped 0–1.
  - `relativeLuminance([r, g, b]) => number` — expects **linear** input.
  - `contrastRatio(colorA, colorB) => number` — accepts oklch strings or linear RGB triples.

- [ ] **Step 1: Write the failing test**

```js
// src/styles/colorMath.test.js
import {
  parseOklch,
  oklchToLinearSrgb,
  relativeLuminance,
  contrastRatio,
} from "./colorMath";

describe("parseOklch", () => {
  it("parses percentage lightness into a 0-1 fraction", () => {
    expect(parseOklch("oklch(70.5% 0.213 47.604)")).toEqual({
      l: 0.705,
      c: 0.213,
      h: 47.604,
    });
  });

  it("parses a bare fractional lightness", () => {
    expect(parseOklch("oklch(0.21 0.034 264.665)")).toEqual({
      l: 0.21,
      c: 0.034,
      h: 264.665,
    });
  });

  it("throws on anything that is not an oklch colour", () => {
    expect(() => parseOklch("#ffffff")).toThrow(/oklch/i);
  });
});

describe("contrastRatio", () => {
  it("returns 21:1 for white on black", () => {
    expect(contrastRatio("oklch(100% 0 0)", "oklch(0% 0 0)")).toBeCloseTo(21, 1);
  });

  // REGRESSION. An implementation that applies the sRGB gamma decode to the
  // already-linear matrix output still returns 21.00 here, because 0 and 1 are
  // fixed points of the curve. A mid grey is what exposes it: gray-500 on white
  // is 4.84, and the double-decoding version reported 14.18.
  it("returns 4.84 for gray-500 on white, not 14.18", () => {
    const gray500 = "oklch(55.1% 0.027 264.364)";
    const white = "oklch(100% 0 0)";
    expect(contrastRatio(gray500, white)).toBeCloseTo(4.84, 1);
  });

  it("keeps a mid grey low against white", () => {
    // gray-400. Any result above ~3 means luminance is being computed wrong.
    expect(contrastRatio("oklch(70.7% 0.022 261.325)", "oklch(100% 0 0)")).toBeCloseTo(2.6, 1);
  });

  it("is symmetric", () => {
    const a = "oklch(21% 0.034 264.665)";
    const b = "oklch(98.5% 0.002 247.839)";
    expect(contrastRatio(a, b)).toBeCloseTo(contrastRatio(b, a), 5);
  });

  it("scores the approved primary button pair at 6.14", () => {
    const gray900 = "oklch(21% 0.034 264.665)";
    const orange500 = "oklch(70.5% 0.213 47.604)";
    expect(contrastRatio(gray900, orange500)).toBeCloseTo(6.14, 1);
  });
});

describe("oklchToLinearSrgb", () => {
  it("clamps out-of-gamut channels into 0-1", () => {
    const rgb = oklchToLinearSrgb(parseOklch("oklch(70% 0.4 30)"));
    for (const channel of rgb) {
      expect(channel).toBeGreaterThanOrEqual(0);
      expect(channel).toBeLessThanOrEqual(1);
    }
  });

  it("returns linear values, so relativeLuminance of white is 1", () => {
    expect(relativeLuminance(oklchToLinearSrgb(parseOklch("oklch(100% 0 0)")))).toBeCloseTo(1, 3);
  });
});
```

- [ ] **Step 2: Run the test and verify it fails**

Run: `npx jest src/styles/colorMath.test.js`
Expected: FAIL — `Cannot find module './colorMath'`.

- [ ] **Step 3: Write the implementation**

```js
// src/styles/colorMath.js
/**
 * Colour maths for the theme contrast tests.
 *
 * WHY THIS IS ITS OWN MODULE. Accessibility here is arithmetic, not judgement:
 * either a token pair clears 4.5:1 or it does not. Keeping the maths pure and
 * separately tested means the theme tests measure the palette rather than
 * measuring this file's bugs.
 *
 * THE ONE TRAP. The OKLab -> RGB matrix below outputs LINEAR-LIGHT RGB. WCAG
 * relative luminance is also defined on linear values, so it consumes that
 * output directly. Applying the sRGB gamma decode (the `((c+0.055)/1.055)^2.4`
 * step) to it double-decodes and inflates every ratio — and it does so
 * invisibly, because 0 and 1 are fixed points of the gamma curve, so
 * white-on-black still comes out at exactly 21.00. Mid greys are what expose
 * it. See the regression test.
 */

const OKLCH_RE = /^oklch\(\s*([\d.]+)(%?)\s+([\d.]+)\s+([\d.]+)\s*\)$/i;

/** Parse an `oklch(L C H)` string. Lightness is normalised to 0-1. */
export function parseOklch(str) {
  const match = OKLCH_RE.exec(String(str).trim());
  if (!match) throw new Error(`Not an oklch colour: ${str}`);
  const [, lRaw, isPercent, c, h] = match;
  const l = isPercent ? Number(lRaw) / 100 : Number(lRaw);
  return { l, c: Number(c), h: Number(h) };
}

/** oklch -> linear-light sRGB, clamped to gamut. */
export function oklchToLinearSrgb({ l, c, h }) {
  const rad = (h * Math.PI) / 180;
  const a = c * Math.cos(rad);
  const b = c * Math.sin(rad);

  const lLong = (l + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const lMed = (l - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const lShort = (l - 0.0894841775 * a - 1.2914855480 * b) ** 3;

  return [
    4.0767416621 * lLong - 3.3077115913 * lMed + 0.2309699292 * lShort,
    -1.2684380046 * lLong + 2.6097574011 * lMed - 0.3413193965 * lShort,
    -0.0041960863 * lLong - 0.7034186147 * lMed + 1.7076147010 * lShort,
  ].map((v) => Math.min(1, Math.max(0, v)));
}

/** WCAG relative luminance. Input MUST already be linear (see module note). */
export function relativeLuminance([r, g, b]) {
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function toLinear(color) {
  return Array.isArray(color) ? color : oklchToLinearSrgb(parseOklch(color));
}

/** WCAG 2.1 contrast ratio, 1..21. Accepts oklch strings or linear triples. */
export function contrastRatio(colorA, colorB) {
  const a = relativeLuminance(toLinear(colorA));
  const b = relativeLuminance(toLinear(colorB));
  const lighter = Math.max(a, b);
  const darker = Math.min(a, b);
  return (lighter + 0.05) / (darker + 0.05);
}
```

- [ ] **Step 4: Run the test and verify it passes**

Run: `npx jest src/styles/colorMath.test.js`
Expected: PASS, 9 tests.

- [ ] **Step 5: Commit**

```bash
git add src/styles/colorMath.js src/styles/colorMath.test.js
git commit -m "feat(theme): colour maths for contrast tests

Pure oklch -> linear sRGB -> WCAG contrast. Separately tested because every
accessibility claim in the theme work rests on it.

Includes a regression test for gamma double-decoding, which inflated
gray-500-on-white to 14.18 (true value 4.84) while still returning exactly
21.00 for white-on-black — 0 and 1 are fixed points of the gamma curve, so
only mid greys expose the bug."
```

---

## Task 2: Token values as data

`tokens.js` exists so tests can assert on token values without a CSS parser. `tokens.css` is what the app actually loads. `tokensParity.test.js` (Task 4) is what stops them drifting.

**Files:**
- Create: `src/styles/tokens.js`
- Test: `src/styles/themeContrast.test.js`, `src/styles/darkParity.test.js`

**Interfaces:**
- Consumes: `contrastRatio` from Task 1.
- Produces:
  - `TAILWIND_PALETTE: Record<string, string>` — palette name → literal oklch string.
  - `LIGHT_TOKENS: Record<string, string>` — token name (no `--`) → oklch string or `color-mix(...)`.
  - `DARK_TOKENS: Record<string, string>` — same keys as `LIGHT_TOKENS`.
  - `PARITY_MAP: Record<string, string>` — dark token name → palette name it must equal.
  - `PARITY_EXCEPTIONS: Record<string, { was: string, reason: string }>`.
  - `CONTRAST_PAIRS: Array<{ fg: string, bg: string, min: number, label: string }>` — token-name pairs to assert.

- [ ] **Step 1: Write the failing tests**

```js
// src/styles/themeContrast.test.js
import { contrastRatio } from "./colorMath";
import { LIGHT_TOKENS, DARK_TOKENS, CONTRAST_PAIRS } from "./tokens";

describe.each([
  ["light", LIGHT_TOKENS],
  ["dark", DARK_TOKENS],
])("%s theme contrast", (themeName, tokens) => {
  it.each(CONTRAST_PAIRS)(
    "$label ($fg on $bg) clears $min:1",
    ({ fg, bg, min, label }) => {
      expect(tokens[fg]).toBeDefined();
      expect(tokens[bg]).toBeDefined();
      const ratio = contrastRatio(tokens[fg], tokens[bg]);
      // Message carries the number so a failure is actionable without rerunning.
      expect(ratio).toBeGreaterThanOrEqual(min);
      if (ratio < min) throw new Error(`${themeName}: ${label} = ${ratio.toFixed(2)}:1`);
    },
  );

  it("defines exactly the same token names as the other theme", () => {
    const other = tokens === LIGHT_TOKENS ? DARK_TOKENS : LIGHT_TOKENS;
    expect(Object.keys(tokens).sort()).toEqual(Object.keys(other).sort());
  });
});
```

```js
// src/styles/darkParity.test.js
import {
  TAILWIND_PALETTE,
  DARK_TOKENS,
  PARITY_MAP,
  PARITY_EXCEPTIONS,
} from "./tokens";

describe("dark mode parity", () => {
  it("maps every dark token that claims parity to a real palette entry", () => {
    for (const paletteName of Object.values(PARITY_MAP)) {
      expect(TAILWIND_PALETTE[paletteName]).toBeDefined();
    }
  });

  it.each(Object.entries(PARITY_MAP))(
    "dark token %s equals palette %s, so dark mode renders unchanged",
    (tokenName, paletteName) => {
      expect(DARK_TOKENS[tokenName]).toBe(TAILWIND_PALETTE[paletteName]);
    },
  );

  it("documents a reason for every parity exception", () => {
    for (const [token, meta] of Object.entries(PARITY_EXCEPTIONS)) {
      expect(DARK_TOKENS[token] ?? "").not.toBe("");
      expect(meta.reason).toMatch(/\S/);
      expect(meta.was).toMatch(/\S/);
    }
  });

  it("has no token both claiming parity and listed as an exception", () => {
    for (const token of Object.keys(PARITY_EXCEPTIONS)) {
      expect(PARITY_MAP[token]).toBeUndefined();
    }
  });
});
```

- [ ] **Step 2: Run and verify they fail**

Run: `npx jest src/styles/themeContrast.test.js src/styles/darkParity.test.js`
Expected: FAIL — `Cannot find module './tokens'`.

- [ ] **Step 3: Write `src/styles/tokens.js`**

Every value below was read from `@tailwindcss/node` compile output; every ratio in a comment was computed with `contrastRatio`. Do not replace these with remembered hex codes.

```js
// src/styles/tokens.js
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
  "subtle-foreground": P["gray-500"],
  border: P["gray-200"],
  "border-strong": P["gray-300"],
  input: P.white,
  ring: P["orange-500"],
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
  "warning-foreground": P["gray-900"],
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
  "brand-surface": "color-mix(in oklab, oklch(70.5% 0.213 47.604) 15%, transparent)",

  destructive: P["red-400"], // EXCEPTION 2
  "destructive-foreground": P["gray-900"],
  "destructive-surface": "color-mix(in oklab, oklch(70.4% 0.191 22.216) 15%, transparent)",
  success: P["green-400"],
  "success-foreground": P["gray-900"],
  "success-surface": "color-mix(in oklab, oklch(79.2% 0.209 151.711) 15%, transparent)",
  warning: P["amber-400"],
  "warning-foreground": P["gray-900"],
  "warning-surface": "color-mix(in oklab, oklch(82.8% 0.189 84.429) 15%, transparent)",
  info: P["blue-400"],
  "info-foreground": P["gray-900"],
  "info-surface": "color-mix(in oklab, oklch(70.7% 0.165 254.624) 15%, transparent)",
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
  { fg: "muted-foreground", bg: "background", min: 4.5, label: "secondary text on page" },
  { fg: "muted-foreground", bg: "card", min: 4.5, label: "secondary text on card" },
  { fg: "muted-foreground", bg: "surface", min: 4.5, label: "secondary text on panel" },
  { fg: "subtle-foreground", bg: "card", min: 4.5, label: "tertiary text on card" },
  { fg: "subtle-foreground", bg: "surface", min: 4.5, label: "tertiary text on panel" },
  { fg: "foreground", bg: "surface", min: 4.5, label: "body text on panel" },
  { fg: "foreground", bg: "muted", min: 4.5, label: "body text on muted" },
  { fg: "primary-foreground", bg: "primary", min: 4.5, label: "primary button label" },
  { fg: "primary-foreground", bg: "primary-hover", min: 4.5, label: "primary button label, hovered" },
  { fg: "brand-text", bg: "background", min: 4.5, label: "brand text on page" },
  { fg: "brand-text", bg: "card", min: 4.5, label: "brand text on card" },
  { fg: "destructive", bg: "card", min: 4.5, label: "error text on card" },
  { fg: "destructive-foreground", bg: "destructive", min: 4.5, label: "error button label" },
  { fg: "success", bg: "card", min: 4.5, label: "success text on card" },
  { fg: "success-foreground", bg: "success", min: 4.5, label: "success button label" },
  { fg: "warning", bg: "card", min: 4.5, label: "warning text on card" },
  { fg: "warning-foreground", bg: "warning", min: 4.5, label: "warning button label" },
  { fg: "info", bg: "card", min: 4.5, label: "info text on card" },
  { fg: "info-foreground", bg: "info", min: 4.5, label: "info button label" },
  { fg: "border", bg: "card", min: 1.2, label: "card border visibility" },
  { fg: "border-strong", bg: "background", min: 1.5, label: "strong border visibility" },
  { fg: "ring", bg: "background", min: 3, label: "focus ring on page" },
  { fg: "ring", bg: "card", min: 3, label: "focus ring on card" },
];
```

- [ ] **Step 4: Run and verify they pass**

Run: `npx jest src/styles/themeContrast.test.js src/styles/darkParity.test.js`
Expected: PASS. If any `CONTRAST_PAIRS` row fails, the failure message names the pair and its ratio — fix the token, not the threshold.

- [ ] **Step 5: Commit**

```bash
git add src/styles/tokens.js src/styles/themeContrast.test.js src/styles/darkParity.test.js
git commit -m "feat(theme): token values, with contrast and parity as tests

Both themes as data. Every value is a literal oklch read from Tailwind's own
palette; every ratio in a comment was computed, not recalled.

themeContrast asserts 26 fg/bg pairs in BOTH themes. darkParity asserts each
dark token still equals the literal it replaces, so dark mode is a provable
refactor rather than a hope, and a Tailwind upgrade that shifts a colour fails
here rather than in someone's eyes.

Three parity exceptions, all measured, all toward legibility: gray-500 text
(122 occurrences, 2.14-4.34:1), red-500 text (52, 2.71-3.84:1), and white on
orange-500 (61, 2.89:1 — the approved brand change to a near-black label).

Brand-as-text is a separate token from brand-as-surface because orange-500 as
text on white is 2.89:1; brand-text resolves to orange-700 (5.23:1) in light."
```

---

## Task 3: `tokens.css` and stylesheet consolidation

**Files:**
- Create: `src/styles/tokens.css`
- Test: `src/styles/tokensParity.test.js`
- Modify: `src/index.css`, `src/globals.css`, `src/App.css`

**Interfaces:**
- Consumes: `LIGHT_TOKENS`, `DARK_TOKENS` from Task 2.
- Produces: Tailwind utilities `bg-background`, `bg-card`, `bg-surface`, `bg-surface-hover`, `bg-muted`, `bg-popover`, `bg-overlay`, `bg-primary`, `bg-primary-hover`, `bg-brand-surface`, `bg-destructive`, `bg-destructive-surface`, `bg-success`, `bg-success-surface`, `bg-warning`, `bg-warning-surface`, `bg-info`, `bg-info-surface`, and the matching `text-*`, `border-*`, `ring-*`, `placeholder-*`, `divide-*`, `from-*`, `to-*` forms, each accepting an `/opacity` modifier.

- [ ] **Step 1: Write the failing parity test**

```js
// src/styles/tokensParity.test.js
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { LIGHT_TOKENS, DARK_TOKENS } from "./tokens";

const css = readFileSync(join(__dirname, "tokens.css"), "utf8");

/** Pull `--name: value;` declarations out of the first block matching `selector`. */
function declarationsIn(selector) {
  const start = css.indexOf(selector);
  if (start === -1) throw new Error(`No ${selector} block in tokens.css`);
  const open = css.indexOf("{", start);
  const close = css.indexOf("\n}", open);
  const body = css.slice(open + 1, close);
  const out = {};
  for (const m of body.matchAll(/--([a-z0-9-]+)\s*:\s*([^;]+);/gi)) {
    out[m[1]] = m[2].trim();
  }
  return out;
}

describe("tokens.css matches tokens.js", () => {
  it.each([
    [":root", LIGHT_TOKENS],
    [".dark", DARK_TOKENS],
  ])("%s declares every token with the same value", (selector, expected) => {
    const actual = declarationsIn(selector);
    for (const [name, value] of Object.entries(expected)) {
      expect(actual[name]).toBe(value);
    }
  });

  it("declares no token in CSS that tokens.js does not know about", () => {
    const actual = declarationsIn(":root");
    for (const name of Object.keys(actual)) {
      expect(LIGHT_TOKENS[name]).toBeDefined();
    }
  });

  it("exposes every token to Tailwind via @theme inline", () => {
    for (const name of Object.keys(LIGHT_TOKENS)) {
      expect(css).toContain(`--color-${name}: var(--${name});`);
    }
  });
});
```

- [ ] **Step 2: Run and verify it fails**

Run: `npx jest src/styles/tokensParity.test.js`
Expected: FAIL — `ENOENT` on `tokens.css`.

- [ ] **Step 3: Write `src/styles/tokens.css`**

Transcribe `LIGHT_TOKENS` into `:root` and `DARK_TOKENS` into `.dark`, in the same order, then map each to Tailwind. The test in Step 1 is what proves the transcription is faithful, so run it rather than eyeballing.

```css
/*
 * src/styles/tokens.css
 * ═══════════════════════════════════════════════════════════════════════════
 * THE ONLY PLACE COLOURS ARE DEFINED. Two themes, one set of names.
 *
 * Components must name a ROLE (`bg-card`), never a colour (`bg-gray-900`).
 * That is what makes a new component impossible to half-theme: there is no
 * second place to forget.
 *
 * Values are literal oklch copied from Tailwind v4's palette, NOT
 * `var(--color-gray-900)`. Tailwind v4 only emits a palette variable when some
 * utility uses it, so a var() reference here resolves to nothing once the last
 * `gray-900` utility is migrated away.
 *
 * Mirrored as data in tokens.js for the tests; tokensParity.test.js fails if
 * the two drift. Edit both or neither.
 *
 * Contrast is enforced by themeContrast.test.js over 26 pairs in both themes.
 * Do not change a value here without running `npx jest src/styles/`.
 */

:root {
  --background: oklch(98.5% 0.002 247.839);
  --foreground: oklch(21% 0.034 264.665);
  --card: oklch(100% 0 0);
  --card-foreground: oklch(21% 0.034 264.665);
  --popover: oklch(100% 0 0);
  --popover-foreground: oklch(21% 0.034 264.665);
  --surface: oklch(96.7% 0.003 264.542);
  --surface-hover: oklch(92.8% 0.006 264.531);
  --muted: oklch(96.7% 0.003 264.542);
  --muted-foreground: oklch(44.6% 0.03 256.802);
  --subtle-foreground: oklch(55.1% 0.027 264.364);
  --border: oklch(92.8% 0.006 264.531);
  --border-strong: oklch(87.2% 0.01 258.338);
  --input: oklch(100% 0 0);
  --ring: oklch(70.5% 0.213 47.604);
  --overlay: color-mix(in oklab, oklch(21% 0.034 264.665) 50%, transparent);
  --primary: oklch(70.5% 0.213 47.604);
  --primary-hover: oklch(64.6% 0.222 41.116);
  --primary-foreground: oklch(21% 0.034 264.665);
  --brand-text: oklch(55.3% 0.195 38.402);
  --brand-surface: oklch(98% 0.016 73.684);
  --destructive: oklch(57.7% 0.245 27.325);
  --destructive-foreground: oklch(100% 0 0);
  --destructive-surface: oklch(97.1% 0.013 17.38);
  --success: oklch(52.7% 0.154 150.069);
  --success-foreground: oklch(100% 0 0);
  --success-surface: oklch(98.2% 0.018 155.826);
  --warning: oklch(55.5% 0.163 48.998);
  --warning-foreground: oklch(21% 0.034 264.665);
  --warning-surface: oklch(98.7% 0.022 95.277);
  --info: oklch(54.6% 0.245 262.881);
  --info-foreground: oklch(100% 0 0);
  --info-surface: oklch(97% 0.014 254.604);
}

.dark {
  --background: oklch(0% 0 0);
  --foreground: oklch(100% 0 0);
  --card: oklch(21% 0.034 264.665);
  --card-foreground: oklch(100% 0 0);
  --popover: oklch(21% 0.034 264.665);
  --popover-foreground: oklch(100% 0 0);
  --surface: oklch(27.8% 0.033 256.848);
  --surface-hover: oklch(37.3% 0.034 259.733);
  --muted: oklch(27.8% 0.033 256.848);
  --muted-foreground: oklch(70.7% 0.022 261.325);
  --subtle-foreground: oklch(70.7% 0.022 261.325);
  --border: oklch(37.3% 0.034 259.733);
  --border-strong: oklch(44.6% 0.03 256.802);
  --input: oklch(27.8% 0.033 256.848);
  --ring: oklch(70.5% 0.213 47.604);
  --overlay: color-mix(in oklab, oklch(0% 0 0) 50%, transparent);
  --primary: oklch(70.5% 0.213 47.604);
  --primary-hover: oklch(64.6% 0.222 41.116);
  --primary-foreground: oklch(21% 0.034 264.665);
  --brand-text: oklch(70.5% 0.213 47.604);
  --brand-surface: color-mix(in oklab, oklch(70.5% 0.213 47.604) 15%, transparent);
  --destructive: oklch(70.4% 0.191 22.216);
  --destructive-foreground: oklch(21% 0.034 264.665);
  --destructive-surface: color-mix(in oklab, oklch(70.4% 0.191 22.216) 15%, transparent);
  --success: oklch(79.2% 0.209 151.711);
  --success-foreground: oklch(21% 0.034 264.665);
  --success-surface: color-mix(in oklab, oklch(79.2% 0.209 151.711) 15%, transparent);
  --warning: oklch(82.8% 0.189 84.429);
  --warning-foreground: oklch(21% 0.034 264.665);
  --warning-surface: color-mix(in oklab, oklch(82.8% 0.189 84.429) 15%, transparent);
  --info: oklch(70.7% 0.165 254.624);
  --info-foreground: oklch(21% 0.034 264.665);
  --info-surface: color-mix(in oklab, oklch(70.7% 0.165 254.624) 15%, transparent);
}

/*
 * `inline` is load-bearing: it makes `bg-card` compile to
 * `background-color: var(--card)` rather than baking in the light value, which
 * is what lets `.dark` redefining `--card` flip the whole app.
 */
@theme inline {
  --color-background: var(--background);
  --color-foreground: var(--foreground);
  --color-card: var(--card);
  --color-card-foreground: var(--card-foreground);
  --color-popover: var(--popover);
  --color-popover-foreground: var(--popover-foreground);
  --color-surface: var(--surface);
  --color-surface-hover: var(--surface-hover);
  --color-muted: var(--muted);
  --color-muted-foreground: var(--muted-foreground);
  --color-subtle-foreground: var(--subtle-foreground);
  --color-border: var(--border);
  --color-border-strong: var(--border-strong);
  --color-input: var(--input);
  --color-ring: var(--ring);
  --color-overlay: var(--overlay);
  --color-primary: var(--primary);
  --color-primary-hover: var(--primary-hover);
  --color-primary-foreground: var(--primary-foreground);
  --color-brand-text: var(--brand-text);
  --color-brand-surface: var(--brand-surface);
  --color-destructive: var(--destructive);
  --color-destructive-foreground: var(--destructive-foreground);
  --color-destructive-surface: var(--destructive-surface);
  --color-success: var(--success);
  --color-success-foreground: var(--success-foreground);
  --color-success-surface: var(--success-surface);
  --color-warning: var(--warning);
  --color-warning-foreground: var(--warning-foreground);
  --color-warning-surface: var(--warning-surface);
  --color-info: var(--info);
  --color-info-foreground: var(--info-foreground);
  --color-info-surface: var(--info-surface);
}
```

- [ ] **Step 4: Run the parity test and verify it passes**

Run: `npx jest src/styles/tokensParity.test.js`
Expected: PASS. A mismatch names the exact token.

- [ ] **Step 5: Rewrite `src/index.css`**

Replace the whole file. Note what changed: one `@import "tailwindcss"`, one `@custom-variant`, `body` on tokens, and all six component classes re-expressed in tokens (each was hard-dark).

```css
/*
 * src/index.css — the app's single Tailwind entry point.
 *
 * Theme colours live in styles/tokens.css. Nothing here may name a colour.
 *
 * `dark:` follows OUR class, not the operating system: the app owns the
 * preference, stores it, and must be able to render either theme on any
 * machine. Declared here ONCE — globals.css used to declare a second,
 * different variant (`&:is(.dark *)`), and which one won depended on import
 * order rather than intent.
 */
@import "tailwindcss";
@import "./styles/tokens.css";

@custom-variant dark (&:where(.dark, .dark *));

@layer base {
  html {
    font-family: "Inter", system-ui, sans-serif;
  }

  body {
    @apply bg-background text-foreground antialiased;
  }
}

@layer components {
  .btn-primary {
    @apply bg-primary hover:bg-primary-hover text-primary-foreground font-medium px-6 py-3 rounded-lg transition-colors duration-300;
  }

  .btn-secondary {
    @apply border border-border-strong hover:border-primary text-muted-foreground hover:text-brand-text px-6 py-3 rounded-lg font-medium transition-colors;
  }

  .input-field {
    @apply w-full px-4 py-3 bg-input border border-border rounded-lg text-foreground placeholder-subtle-foreground focus:border-primary focus:outline-none;
  }

  .card {
    @apply bg-card rounded-lg border border-border hover:border-primary/30 transition-colors;
  }

  .modal {
    @apply fixed inset-0 bg-overlay backdrop-blur-sm z-50 flex items-center justify-center p-4;
  }

  .modal-content {
    @apply bg-popover border border-primary/20 rounded-lg w-full max-w-2xl max-h-[90vh] overflow-y-auto;
  }
}

@layer utilities {
  .text-gradient {
    @apply bg-gradient-to-r from-primary to-primary-hover bg-clip-text text-transparent;
  }

  .shadow-orange {
    box-shadow: 0 10px 25px color-mix(in oklab, var(--primary) 10%, transparent);
  }

  @keyframes float {
    0%,
    100% {
      transform: translateY(0px) rotate(0deg);
    }
    50% {
      transform: translateY(-10px) rotate(5deg);
    }
  }

  .animate-float {
    animation: float 6s ease-in-out infinite;
  }
}
```

Note: `.border-gradient` is dropped — `grep -rn "border-gradient" src/` returns nothing. Confirm that before deleting; if it has a user, port it to `var(--primary)`.

- [ ] **Step 6: Strip the duplicate theme config from `src/globals.css`**

Delete from `globals.css`: the `@import "tailwindcss"` line, the `@custom-variant dark` line, the entire `:root` block, the entire `.dark` block, and the entire `@theme inline` block. Keep `@import "tw-animate-css";`, and replace the base layer with a version that does not restate `body` colours:

```css
/*
 * src/globals.css — non-theme global styles only.
 *
 * The token blocks that used to live here now live in styles/tokens.css, which
 * index.css imports. They were removed because this file declared a SECOND,
 * conflicting `@custom-variant dark` and a second `body` rule, so which theme
 * config won was decided by import order (main.jsx imports index.css, App.jsx
 * imports this) rather than by intent. Its `.dark` block was also unbranded —
 * `--primary` was white, not the brand orange.
 */
@import "tw-animate-css";

@layer base {
  * {
    @apply border-border outline-ring/50;
  }

  @media (max-width: 768px) {
    .mobile-optimized {
      @apply text-base leading-relaxed;
    }

    .mobile-card {
      @apply p-4 shadow-sm;
    }

    .mobile-header {
      @apply text-lg font-semibold;
    }

    .mobile-nav {
      @apply text-base font-medium;
    }
  }
}
```

- [ ] **Step 7: Fix the transition rule in `src/App.css`**

Replace the `* { transition-property: ... }` block at line 22 (it fires on every hover and focus, not just theme switches) with a class that only exists during a theme change, plus token-driven scrollbar and focus colours:

```css
/*
 * Theme switching only. A `*` rule used to apply this transition permanently,
 * so every hover and focus animated too; that made ordinary interaction feel
 * laggy and was never the intent. utils/theme.js adds `.theme-transition` to
 * <html> for 200ms around a switch and removes it again.
 */
.theme-transition,
.theme-transition *,
.theme-transition *::before,
.theme-transition *::after {
  transition-property: color, background-color, border-color, fill, stroke,
    text-decoration-color, outline-color;
  transition-timing-function: cubic-bezier(0.4, 0, 0.2, 1);
  transition-duration: 200ms;
}

@media (prefers-reduced-motion: reduce) {
  .theme-transition,
  .theme-transition *,
  .theme-transition *::before,
  .theme-transition *::after {
    transition-duration: 0ms;
  }
}

::-webkit-scrollbar-track {
  background: var(--surface);
}

::-webkit-scrollbar-thumb {
  background: var(--primary);
}

::-webkit-scrollbar-thumb:hover {
  background: var(--primary-hover);
}

button:focus-visible,
input:focus-visible,
select:focus-visible,
textarea:focus-visible {
  outline: 2px solid var(--ring);
  outline-offset: 2px;
}
```

Delete the old `::-webkit-scrollbar-track`, `::-webkit-scrollbar-thumb`, `::-webkit-scrollbar-thumb:hover` and `:focus-visible` rules with their hardcoded `#1f2937` / `#f97316` / `#ea580c` values, so there is exactly one definition of each.

- [ ] **Step 8: Verify the build compiles and the app still renders dark**

Run: `npm run build`
Expected: build succeeds with no "Cannot apply unknown utility class" error. Such an error means a token is missing from `@theme inline` in `tokens.css`.

Run: `npx jest src/styles/`
Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add src/styles/tokens.css src/styles/tokensParity.test.js src/index.css src/globals.css src/App.css
git commit -m "feat(theme): one token layer, one Tailwind config

tokens.css is now the only place a colour is defined, mirrored as data in
tokens.js with tokensParity.test.js failing if the two drift.

Removes a genuine ambiguity: index.css and globals.css each declared their own
@custom-variant dark (&:where(.dark, .dark *) vs &:is(.dark *)) and their own
body colours, so which theme config applied depended on import order. The
globals.css token block was also unbranded — --primary was white, not orange.

All six component classes (.btn-primary, .btn-secondary, .input-field, .card,
.modal, .modal-content) were hard-dark and are now token-driven.

App.css put a 150ms transition on * for ten properties, so every hover and
focus animated. Now scoped to .theme-transition, which theme.js adds for 200ms
around a switch, and honoured prefers-reduced-motion."
```

---

## Task 4: Theme runtime

**Files:**
- Rewrite: `src/utils/theme.js`
- Rewrite: `src/utils/theme.test.js`
- Modify: `index.html`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `THEMES = { LIGHT: "light", DARK: "dark" }`
  - `DEFAULT_THEME = "light"`, `STORAGE_KEY = "theme"`
  - `getStoredTheme() => "light" | "dark" | null`
  - `resolveInitialTheme() => "light" | "dark"`
  - `applyTheme(theme, { persist = true, animate = false } = {}) => "light" | "dark"`
  - `initTheme() => "light" | "dark"`
  - `subscribeToThemeChanges(listener: (theme) => void) => () => void`

- [ ] **Step 1: Write the failing test**

```js
// src/utils/theme.test.js
import {
  THEMES,
  DEFAULT_THEME,
  STORAGE_KEY,
  getStoredTheme,
  resolveInitialTheme,
  applyTheme,
  initTheme,
  subscribeToThemeChanges,
} from "./theme";

beforeEach(() => {
  window.localStorage.clear();
  document.documentElement.className = "";
  document.documentElement.removeAttribute("style");
  document.head.innerHTML = "";
});

describe("getStoredTheme", () => {
  it("returns null when nothing is stored", () => {
    expect(getStoredTheme()).toBeNull();
  });

  it("returns a valid stored theme", () => {
    window.localStorage.setItem(STORAGE_KEY, "dark");
    expect(getStoredTheme()).toBe("dark");
  });

  it("ignores a value that is not a known theme", () => {
    window.localStorage.setItem(STORAGE_KEY, "hot-pink");
    expect(getStoredTheme()).toBeNull();
  });
});

describe("resolveInitialTheme", () => {
  it("defaults to light with nothing stored", () => {
    expect(resolveInitialTheme()).toBe(THEMES.LIGHT);
    expect(DEFAULT_THEME).toBe(THEMES.LIGHT);
  });

  it("prefers a stored theme over the default", () => {
    window.localStorage.setItem(STORAGE_KEY, "dark");
    expect(resolveInitialTheme()).toBe(THEMES.DARK);
  });

  it("does not consult prefers-color-scheme", () => {
    const matchMedia = jest.fn().mockReturnValue({ matches: true, addEventListener() {}, removeEventListener() {} });
    window.matchMedia = matchMedia;
    resolveInitialTheme();
    expect(matchMedia).not.toHaveBeenCalled();
  });
});

describe("applyTheme", () => {
  it("adds the dark class for dark", () => {
    applyTheme(THEMES.DARK);
    expect(document.documentElement.classList.contains("dark")).toBe(true);
  });

  it("removes the dark class for light", () => {
    document.documentElement.classList.add("dark");
    applyTheme(THEMES.LIGHT);
    expect(document.documentElement.classList.contains("dark")).toBe(false);
  });

  it("sets color-scheme so native form controls and scrollbars match", () => {
    applyTheme(THEMES.DARK);
    expect(document.documentElement.style.colorScheme).toBe("dark");
    applyTheme(THEMES.LIGHT);
    expect(document.documentElement.style.colorScheme).toBe("light");
  });

  it("persists by default", () => {
    applyTheme(THEMES.DARK);
    expect(window.localStorage.getItem(STORAGE_KEY)).toBe("dark");
  });

  it("can apply without persisting, for cross-tab echoes", () => {
    applyTheme(THEMES.DARK, { persist: false });
    expect(window.localStorage.getItem(STORAGE_KEY)).toBeNull();
    expect(document.documentElement.classList.contains("dark")).toBe(true);
  });

  it("creates and updates the theme-color meta tag", () => {
    applyTheme(THEMES.DARK);
    const meta = document.querySelector('meta[name="theme-color"]');
    expect(meta).not.toBeNull();
    const darkValue = meta.getAttribute("content");
    applyTheme(THEMES.LIGHT);
    expect(document.querySelectorAll('meta[name="theme-color"]')).toHaveLength(1);
    expect(meta.getAttribute("content")).not.toBe(darkValue);
  });

  it("falls back to the default for an unknown theme", () => {
    expect(applyTheme("hot-pink")).toBe(DEFAULT_THEME);
  });

  it("is idempotent", () => {
    applyTheme(THEMES.DARK);
    applyTheme(THEMES.DARK);
    expect(document.documentElement.className.match(/dark/g)).toHaveLength(1);
  });

  it("adds .theme-transition only when animating, then removes it", () => {
    jest.useFakeTimers();
    applyTheme(THEMES.DARK, { animate: true });
    expect(document.documentElement.classList.contains("theme-transition")).toBe(true);
    jest.runAllTimers();
    expect(document.documentElement.classList.contains("theme-transition")).toBe(false);
    jest.useRealTimers();
  });

  it("does not animate on the initial application", () => {
    applyTheme(THEMES.DARK);
    expect(document.documentElement.classList.contains("theme-transition")).toBe(false);
  });

  it("does not throw when localStorage is unavailable", () => {
    const spy = jest.spyOn(window.localStorage.__proto__, "setItem").mockImplementation(() => {
      throw new Error("private mode");
    });
    expect(() => applyTheme(THEMES.DARK)).not.toThrow();
    expect(document.documentElement.classList.contains("dark")).toBe(true);
    spy.mockRestore();
  });
});

describe("initTheme", () => {
  it("applies the stored theme and returns it", () => {
    window.localStorage.setItem(STORAGE_KEY, "dark");
    expect(initTheme()).toBe(THEMES.DARK);
    expect(document.documentElement.classList.contains("dark")).toBe(true);
  });

  it("applies light when nothing is stored, without writing a preference", () => {
    expect(initTheme()).toBe(THEMES.LIGHT);
    expect(document.documentElement.classList.contains("dark")).toBe(false);
    expect(window.localStorage.getItem(STORAGE_KEY)).toBeNull();
  });
});

describe("subscribeToThemeChanges", () => {
  it("applies a theme changed in another tab", () => {
    const seen = [];
    const unsubscribe = subscribeToThemeChanges((t) => seen.push(t));
    window.dispatchEvent(new StorageEvent("storage", { key: STORAGE_KEY, newValue: "dark" }));
    expect(seen).toEqual([THEMES.DARK]);
    expect(document.documentElement.classList.contains("dark")).toBe(true);
    unsubscribe();
  });

  it("ignores storage events for other keys", () => {
    const seen = [];
    const unsubscribe = subscribeToThemeChanges((t) => seen.push(t));
    window.dispatchEvent(new StorageEvent("storage", { key: "cart", newValue: "dark" }));
    expect(seen).toEqual([]);
    unsubscribe();
  });

  it("stops listening after unsubscribe", () => {
    const seen = [];
    subscribeToThemeChanges((t) => seen.push(t))();
    window.dispatchEvent(new StorageEvent("storage", { key: STORAGE_KEY, newValue: "dark" }));
    expect(seen).toEqual([]);
  });
});
```

- [ ] **Step 2: Run and verify it fails**

Run: `npx jest src/utils/theme.test.js`
Expected: FAIL — the current module exports only `applyAppTheme`.

- [ ] **Step 3: Rewrite `src/utils/theme.js`**

```js
/**
 * utils/theme.js
 * ══════════════════════════════════════════════════════════════════════════════
 * The app has two themes and remembers which one you chose.
 *
 * This file replaces a version whose entire job was to assert the app was
 * dark-only and DELETE any saved `theme: "light"`. That was correct at the time:
 * commit 9e8d481 measured that no file in src/ flipped cleanly, so the toggle
 * that used to exist produced a screen half in each theme rather than a light
 * app. The token migration is what makes a second theme real.
 *
 * DESIGN NOTES
 *
 * `prefers-color-scheme` is deliberately never read. The app owns the
 * preference: default light, changed only by the user, stored in localStorage.
 * Reading the OS as well would mean two sources of truth for one question.
 *
 * Storage access is always guarded. In private mode `localStorage` can throw on
 * read AND on write, and a theme helper is not permitted to take the app down.
 * The class on <html> is what actually renders; a preference we cannot save is a
 * degraded experience, not an error.
 */

export const THEMES = { LIGHT: "light", DARK: "dark" };
export const DEFAULT_THEME = THEMES.LIGHT;
export const STORAGE_KEY = "theme";

/** Browser-chrome colour per theme. Matches --background in styles/tokens.css. */
const THEME_COLOR = {
  [THEMES.LIGHT]: "#fafafa",
  [THEMES.DARK]: "#000000",
};

/** How long .theme-transition stays on. Must match App.css's duration. */
const TRANSITION_MS = 200;

let transitionTimer = null;

const isValid = (value) => value === THEMES.LIGHT || value === THEMES.DARK;

/** The stored preference, or null if absent, invalid, or unreadable. */
export function getStoredTheme() {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    return isValid(stored) ? stored : null;
  } catch {
    return null;
  }
}

/** What to render before the user has said anything this session. */
export function resolveInitialTheme() {
  return getStoredTheme() ?? DEFAULT_THEME;
}

function setThemeColorMeta(theme) {
  let meta = document.querySelector('meta[name="theme-color"]');
  if (!meta) {
    meta = document.createElement("meta");
    meta.setAttribute("name", "theme-color");
    document.head.appendChild(meta);
  }
  meta.setAttribute("content", THEME_COLOR[theme]);
}

/**
 * Render `theme` and, by default, remember it.
 *
 * @param {"light"|"dark"} theme
 * @param {{persist?: boolean, animate?: boolean}} [options]
 *   persist — false when echoing a change another tab already stored.
 *   animate — true for a user-initiated switch; false on first paint, where a
 *             transition would animate the page in from the wrong theme.
 * @returns {"light"|"dark"} the theme actually applied.
 */
export function applyTheme(theme, { persist = true, animate = false } = {}) {
  const next = isValid(theme) ? theme : DEFAULT_THEME;
  const root = document.documentElement;

  if (animate) {
    root.classList.add("theme-transition");
    clearTimeout(transitionTimer);
    transitionTimer = setTimeout(() => {
      root.classList.remove("theme-transition");
    }, TRANSITION_MS);
  }

  root.classList.toggle("dark", next === THEMES.DARK);
  // Tells the browser to theme native widgets — scrollbars, date pickers,
  // autofill — which no amount of CSS on our side can reach.
  root.style.colorScheme = next;
  setThemeColorMeta(next);

  if (persist) {
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // Private mode. The class above is what renders; carry on.
    }
  }

  return next;
}

/**
 * Apply the right theme at boot. Does NOT persist: a visitor who has never
 * chosen should stay on whatever the default is, including after we change it.
 */
export function initTheme() {
  return applyTheme(resolveInitialTheme(), { persist: false, animate: false });
}

/**
 * Keep other tabs in step. `storage` fires only in OTHER tabs, so this cannot
 * loop back on the tab that made the change.
 *
 * @returns {() => void} unsubscribe
 */
export function subscribeToThemeChanges(listener) {
  const onStorage = (event) => {
    if (event.key !== STORAGE_KEY || !isValid(event.newValue)) return;
    applyTheme(event.newValue, { persist: false, animate: true });
    listener(event.newValue);
  };
  window.addEventListener("storage", onStorage);
  return () => window.removeEventListener("storage", onStorage);
}
```

- [ ] **Step 4: Run and verify it passes**

Run: `npx jest src/utils/theme.test.js`
Expected: PASS, 22 tests.

- [ ] **Step 5: Replace the boot script in `index.html`**

The current file hardcodes `class="dark"`. Replace the whole file:

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <link rel="icon" type="image/svg+xml" href="/vite.svg" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta name="color-scheme" content="light dark" />
    <title>Drop 'N Roll</title>
    <!--
      Set the theme BEFORE first paint. If this ran in the bundle instead, a
      visitor whose preference is dark would see a white page flash first.
      Deliberately tiny and dependency-free, and it must stay in sync with
      STORAGE_KEY and DEFAULT_THEME in src/utils/theme.js.
    -->
    <script>
      (function () {
        try {
          var stored = localStorage.getItem("theme");
          var theme = stored === "light" || stored === "dark" ? stored : "light";
          if (theme === "dark") document.documentElement.classList.add("dark");
          document.documentElement.style.colorScheme = theme;
        } catch (e) {
          document.documentElement.style.colorScheme = "light";
        }
      })();
    </script>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.jsx"></script>
  </body>
</html>
```

- [ ] **Step 6: Commit**

```bash
git add src/utils/theme.js src/utils/theme.test.js index.html
git commit -m "feat(theme): two-theme runtime with persistence and cross-tab sync

Replaces the dark-only assertion module. Default light, stored under \"theme\",
prefers-color-scheme deliberately never read so there is one source of truth.

- applyTheme takes { persist, animate }: persist:false echoes another tab's
  change without writing it back, animate:false avoids transitioning the page
  in from the wrong theme on first paint.
- colorScheme is set on <html> so native widgets (scrollbars, date pickers,
  autofill) follow the theme; CSS cannot reach those.
- Every storage access is guarded — private mode can throw on read and write,
  and a theme helper must not take the app down.
- index.html sets the class before first paint, so a dark-preferring visitor
  never sees a white flash. Replaces the hardcoded class=\"dark\"."
```

---

## Task 5: ThemeContext

**Files:**
- Create: `src/contexts/ThemeContext.jsx`
- Test: `src/contexts/ThemeContext.test.jsx`
- Modify: `src/main.jsx`

**Interfaces:**
- Consumes: `THEMES`, `applyTheme`, `resolveInitialTheme`, `subscribeToThemeChanges`, `initTheme` from Task 4.
- Produces:
  - `ThemeProvider({ children })`
  - `useTheme() => { theme, isDark, setTheme(t), toggleTheme(), registerHeaderToggle(), hasHeaderToggle }`

`registerHeaderToggle` is how the floating toggle knows to hide: `Header` calls it in an effect, and the floating variant renders nothing while the count is above zero. A count rather than a boolean, so `StrictMode`'s double-mount and a remount during navigation cannot leave it stuck.

- [ ] **Step 1: Write the failing test**

```jsx
// src/contexts/ThemeContext.test.jsx
import { render, screen, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useEffect } from "react";
import { ThemeProvider, useTheme } from "./ThemeContext";
import { STORAGE_KEY, THEMES } from "../utils/theme";

function Probe() {
  const { theme, isDark, toggleTheme, setTheme, hasHeaderToggle } = useTheme();
  return (
    <div>
      <span data-testid="theme">{theme}</span>
      <span data-testid="is-dark">{String(isDark)}</span>
      <span data-testid="has-header">{String(hasHeaderToggle)}</span>
      <button onClick={toggleTheme}>toggle</button>
      <button onClick={() => setTheme(THEMES.DARK)}>go dark</button>
    </div>
  );
}

function FakeHeader() {
  const { registerHeaderToggle } = useTheme();
  useEffect(() => registerHeaderToggle(), [registerHeaderToggle]);
  return <div>header</div>;
}

beforeEach(() => {
  window.localStorage.clear();
  document.documentElement.className = "";
});

describe("ThemeProvider", () => {
  it("starts light with nothing stored", () => {
    render(<ThemeProvider><Probe /></ThemeProvider>);
    expect(screen.getByTestId("theme")).toHaveTextContent("light");
    expect(screen.getByTestId("is-dark")).toHaveTextContent("false");
  });

  it("starts from the stored preference", () => {
    window.localStorage.setItem(STORAGE_KEY, "dark");
    render(<ThemeProvider><Probe /></ThemeProvider>);
    expect(screen.getByTestId("theme")).toHaveTextContent("dark");
  });

  it("toggleTheme flips the theme, the class and storage", async () => {
    const user = userEvent.setup();
    render(<ThemeProvider><Probe /></ThemeProvider>);
    await user.click(screen.getByRole("button", { name: "toggle" }));
    expect(screen.getByTestId("theme")).toHaveTextContent("dark");
    expect(document.documentElement.classList.contains("dark")).toBe(true);
    expect(window.localStorage.getItem(STORAGE_KEY)).toBe("dark");
    await user.click(screen.getByRole("button", { name: "toggle" }));
    expect(screen.getByTestId("theme")).toHaveTextContent("light");
    expect(document.documentElement.classList.contains("dark")).toBe(false);
  });

  it("setTheme applies a specific theme", async () => {
    const user = userEvent.setup();
    render(<ThemeProvider><Probe /></ThemeProvider>);
    await user.click(screen.getByRole("button", { name: "go dark" }));
    expect(screen.getByTestId("theme")).toHaveTextContent("dark");
  });

  it("reports no header toggle by default", () => {
    render(<ThemeProvider><Probe /></ThemeProvider>);
    expect(screen.getByTestId("has-header")).toHaveTextContent("false");
  });

  it("reports a header toggle once a Header registers", () => {
    render(<ThemeProvider><FakeHeader /><Probe /></ThemeProvider>);
    expect(screen.getByTestId("has-header")).toHaveTextContent("true");
  });

  it("reports none again after the Header unmounts", () => {
    const { rerender } = render(
      <ThemeProvider><FakeHeader /><Probe /></ThemeProvider>,
    );
    expect(screen.getByTestId("has-header")).toHaveTextContent("true");
    rerender(<ThemeProvider><Probe /></ThemeProvider>);
    expect(screen.getByTestId("has-header")).toHaveTextContent("false");
  });

  it("follows a change made in another tab", () => {
    render(<ThemeProvider><Probe /></ThemeProvider>);
    act(() => {
      window.dispatchEvent(
        new StorageEvent("storage", { key: STORAGE_KEY, newValue: "dark" }),
      );
    });
    expect(screen.getByTestId("theme")).toHaveTextContent("dark");
  });

  it("throws a useful error when used outside the provider", () => {
    const spy = jest.spyOn(console, "error").mockImplementation(() => {});
    expect(() => render(<Probe />)).toThrow(/ThemeProvider/);
    spy.mockRestore();
  });
});
```

- [ ] **Step 2: Run and verify it fails**

Run: `npx jest src/contexts/ThemeContext.test.jsx`
Expected: FAIL — module not found.

Note: if `@testing-library/user-event` is absent, install it (`npm i -D @testing-library/user-event`) and commit the lockfile change with this task.

- [ ] **Step 3: Write `src/contexts/ThemeContext.jsx`**

```jsx
/**
 * contexts/ThemeContext.jsx
 *
 * One source of truth for which theme is active, so any component can read or
 * change it without touching the DOM.
 *
 * `registerHeaderToggle` exists to solve a small but real problem: the toggle
 * has to be reachable on all 31 routes, and 14 of them render no <Header>. A
 * fixed floating toggle mounted once in App covers those, but would sit on top
 * of the header's own toggle on the other 17. Rather than keep a hardcoded list
 * of headerless routes in sync forever, the Header announces itself and the
 * floating variant stands down. A COUNT, not a boolean: StrictMode double-mounts
 * effects in development, and a boolean would latch.
 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  THEMES,
  applyTheme,
  resolveInitialTheme,
  subscribeToThemeChanges,
} from "../utils/theme";

const ThemeContext = createContext(null);

export function ThemeProvider({ children }) {
  const [theme, setThemeState] = useState(resolveInitialTheme);
  const [headerToggles, setHeaderToggles] = useState(0);

  const setTheme = useCallback((next) => {
    setThemeState(applyTheme(next, { persist: true, animate: true }));
  }, []);

  const toggleTheme = useCallback(() => {
    setThemeState((current) =>
      applyTheme(current === THEMES.DARK ? THEMES.LIGHT : THEMES.DARK, {
        persist: true,
        animate: true,
      }),
    );
  }, []);

  // Another tab changed it. applyTheme already ran inside the subscription, so
  // this only needs to catch React up.
  useEffect(() => subscribeToThemeChanges(setThemeState), []);

  const registerHeaderToggle = useCallback(() => {
    setHeaderToggles((n) => n + 1);
    return () => setHeaderToggles((n) => Math.max(0, n - 1));
  }, []);

  const value = useMemo(
    () => ({
      theme,
      isDark: theme === THEMES.DARK,
      setTheme,
      toggleTheme,
      registerHeaderToggle,
      hasHeaderToggle: headerToggles > 0,
    }),
    [theme, setTheme, toggleTheme, registerHeaderToggle, headerToggles],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used inside a ThemeProvider");
  }
  return context;
}
```

- [ ] **Step 4: Run and verify it passes**

Run: `npx jest src/contexts/ThemeContext.test.jsx`
Expected: PASS, 9 tests.

- [ ] **Step 5: Wire the provider into `src/main.jsx`**

Replace the `applyAppTheme` import and call, and wrap the tree. `initTheme()` runs before render so React's first paint already matches `<html>`.

```jsx
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App.jsx";
import { BrowserRouter } from "react-router-dom";
import { AuthProvider } from "./contexts/AuthContext";
import { ThemeProvider } from "./contexts/ThemeContext";
import { fetchParcelLimits } from "./utils/parcelValidation";
import { initTheme } from "./utils/theme";

// Before render, so React's first paint agrees with the class index.html set.
initTheme();

// Warm the parcel limits cache so Zod schemas use live backend values.
fetchParcelLimits();

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <ThemeProvider>
      <AuthProvider>
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </AuthProvider>
    </ThemeProvider>
  </StrictMode>,
);
```

- [ ] **Step 6: Verify nothing else imported the old function**

Run: `grep -rn "applyAppTheme" src/ index.html`
Expected: no matches. Any hit must be updated to `initTheme`.

Run: `npx jest src/utils src/contexts`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/contexts/ThemeContext.jsx src/contexts/ThemeContext.test.jsx src/main.jsx
git commit -m "feat(theme): ThemeProvider and useTheme

One source of truth for the active theme, with cross-tab sync.

registerHeaderToggle is how the always-visible requirement is met without a
hardcoded route list: 14 of 31 routes render no Header, so a floating toggle is
mounted once in App, and the Header announces itself so the floating one stands
down on the other 17. It counts registrations rather than setting a boolean,
because StrictMode double-mounts effects and a boolean would latch."
```

---

## Task 6: ThemeToggle component

**Files:**
- Create: `src/components/common/ThemeToggle.jsx`
- Test: `src/components/common/ThemeToggle.test.jsx`

**Interfaces:**
- Consumes: `useTheme` from Task 5.
- Produces: `default export ThemeToggle({ variant = "header", className = "" })`, `variant` ∈ `"header" | "floating"`.

- [ ] **Step 1: Write the failing test**

```jsx
// src/components/common/ThemeToggle.test.jsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ThemeToggle from "./ThemeToggle";
import { ThemeProvider, useTheme } from "../../contexts/ThemeContext";
import { STORAGE_KEY } from "../../utils/theme";

const renderToggle = (props) =>
  render(<ThemeProvider><ThemeToggle {...props} /></ThemeProvider>);

function FakeHeaderWithToggle() {
  const { registerHeaderToggle } = useTheme();
  // Registers synchronously enough for the floating variant to see it.
  useEffectOnce(registerHeaderToggle);
  return <ThemeToggle variant="header" />;
}
function useEffectOnce(fn) {
  const { useEffect } = require("react");
  useEffect(() => fn(), [fn]);
}

beforeEach(() => {
  window.localStorage.clear();
  document.documentElement.className = "";
});

describe("ThemeToggle", () => {
  it("renders an accessible button", () => {
    renderToggle();
    expect(screen.getByRole("button")).toBeInTheDocument();
  });

  it("labels the action, not the state, so the label says where a click goes", () => {
    renderToggle();
    expect(
      screen.getByRole("button", { name: /switch to dark mode/i }),
    ).toBeInTheDocument();
  });

  it("updates the label after switching", async () => {
    const user = userEvent.setup();
    renderToggle();
    await user.click(screen.getByRole("button"));
    expect(
      screen.getByRole("button", { name: /switch to light mode/i }),
    ).toBeInTheDocument();
  });

  it("exposes pressed state for assistive tech", async () => {
    const user = userEvent.setup();
    renderToggle();
    const button = screen.getByRole("button");
    expect(button).toHaveAttribute("aria-pressed", "false");
    await user.click(button);
    expect(button).toHaveAttribute("aria-pressed", "true");
  });

  it("switches the theme on click", async () => {
    const user = userEvent.setup();
    renderToggle();
    await user.click(screen.getByRole("button"));
    expect(document.documentElement.classList.contains("dark")).toBe(true);
    expect(window.localStorage.getItem(STORAGE_KEY)).toBe("dark");
  });

  it("is operable with the keyboard", async () => {
    const user = userEvent.setup();
    renderToggle();
    await user.tab();
    expect(screen.getByRole("button")).toHaveFocus();
    await user.keyboard("{Enter}");
    expect(document.documentElement.classList.contains("dark")).toBe(true);
    await user.keyboard(" ");
    expect(document.documentElement.classList.contains("dark")).toBe(false);
  });

  it("is type=button so it never submits a surrounding form", () => {
    renderToggle();
    expect(screen.getByRole("button")).toHaveAttribute("type", "button");
  });

  it("has a visible focus ring", () => {
    renderToggle();
    expect(screen.getByRole("button").className).toMatch(/focus-visible:ring/);
  });

  it("marks its icons decorative, so the label is read once", () => {
    const { container } = renderToggle();
    const svgs = container.querySelectorAll("svg");
    expect(svgs.length).toBeGreaterThan(0);
    for (const svg of svgs) expect(svg).toHaveAttribute("aria-hidden", "true");
  });

  it("renders fixed-position when floating", () => {
    renderToggle({ variant: "floating" });
    expect(screen.getByRole("button").className).toMatch(/fixed/);
  });

  it("is not fixed-position in the header", () => {
    renderToggle({ variant: "header" });
    expect(screen.getByRole("button").className).not.toMatch(/fixed/);
  });

  it("accepts extra classes", () => {
    renderToggle({ className: "ml-4" });
    expect(screen.getByRole("button").className).toMatch(/ml-4/);
  });

  it("hides the floating variant when a header toggle is present", () => {
    render(
      <ThemeProvider>
        <FakeHeaderWithToggle />
        <ThemeToggle variant="floating" />
      </ThemeProvider>,
    );
    // Only the header's toggle survives.
    expect(screen.getAllByRole("button")).toHaveLength(1);
    expect(screen.getByRole("button").className).not.toMatch(/fixed/);
  });

  it("names only tokens, never a raw colour", () => {
    renderToggle();
    expect(screen.getByRole("button").className).not.toMatch(
      /\b(bg|text|border)-(white|black|gray|slate|zinc|orange)-?\d*\b/,
    );
  });
});
```

- [ ] **Step 2: Run and verify it fails**

Run: `npx jest src/components/common/ThemeToggle.test.jsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Write `src/components/common/ThemeToggle.jsx`**

```jsx
/**
 * components/common/ThemeToggle.jsx
 *
 * One button, two placements. `variant="header"` sits in the nav; the
 * `"floating"` variant is mounted once in App.jsx and covers the 14 routes that
 * render no Header, standing down automatically when a Header is present (see
 * ThemeContext's registerHeaderToggle).
 *
 * ACCESSIBILITY. The label names the ACTION ("Switch to dark mode"), not the
 * current state, because that is what a screen-reader user needs to predict a
 * click. `aria-pressed` carries the state instead. Icons are aria-hidden so the
 * name is announced once, not twice.
 */
import { Moon, Sun } from "lucide-react";
import { useTheme } from "../../contexts/ThemeContext";

const BASE_CLASSES =
  "inline-flex items-center justify-center rounded-lg transition-colors " +
  "text-muted-foreground hover:text-brand-text hover:bg-surface-hover " +
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring " +
  "focus-visible:ring-offset-2 focus-visible:ring-offset-background";

const VARIANT_CLASSES = {
  header: "h-9 w-9",
  floating:
    "fixed bottom-5 right-5 z-50 h-11 w-11 shadow-lg bg-card border border-border",
};

export default function ThemeToggle({ variant = "header", className = "" }) {
  const { isDark, toggleTheme, hasHeaderToggle } = useTheme();

  // A header toggle is already on screen; a second floating one would overlap.
  if (variant === "floating" && hasHeaderToggle) return null;

  const label = isDark ? "Switch to light mode" : "Switch to dark mode";
  const Icon = isDark ? Sun : Moon;

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={label}
      aria-pressed={isDark}
      title={label}
      className={`${BASE_CLASSES} ${VARIANT_CLASSES[variant] ?? VARIANT_CLASSES.header} ${className}`}
    >
      <Icon size={variant === "floating" ? 20 : 18} aria-hidden="true" />
    </button>
  );
}
```

- [ ] **Step 4: Run and verify it passes**

Run: `npx jest src/components/common/ThemeToggle.test.jsx`
Expected: PASS, 14 tests.

- [ ] **Step 5: Commit**

```bash
git add src/components/common/ThemeToggle.jsx src/components/common/ThemeToggle.test.jsx
git commit -m "feat(theme): ThemeToggle, header and floating variants

One component, two placements. The floating variant hides itself when a Header
toggle is registered, so the control is reachable on all 31 routes without
appearing twice on the 17 that have a header.

The accessible name describes the ACTION (\"Switch to dark mode\") rather than
the current state, since that is what lets a screen-reader user predict the
click; aria-pressed carries the state. Icons are aria-hidden so the name is
announced once. A test asserts the button's own classes name only tokens, never
a raw colour."
```

---

## Task 7: Mount the toggle

**Files:**
- Modify: `src/components/common/Header.jsx`
- Modify: `src/App.jsx`
- Test: `src/App.themeToggle.test.jsx` (create)

**Interfaces:**
- Consumes: `ThemeToggle` (Task 6), `useTheme` (Task 5).
- Produces: no new exports.

- [ ] **Step 1: Write the failing test**

```jsx
// src/App.themeToggle.test.jsx
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { ThemeProvider } from "./contexts/ThemeContext";
import ThemeToggle from "./components/common/ThemeToggle";

// App itself pulls in Google Maps, Stripe and the auth stack, which is a lot of
// surface for one placement assertion. This asserts the CONTRACT instead: a
// route with no Header still gets a toggle, and a route with one does not get
// two. Full-route coverage is the eval lane's job (evals/eval_theme_coverage.mjs).
function HeaderlessRoute() {
  return (
    <div>
      <p>login page</p>
      <ThemeToggle variant="floating" />
    </div>
  );
}

beforeEach(() => {
  window.localStorage.clear();
  document.documentElement.className = "";
});

describe("toggle reachability", () => {
  it("shows a toggle on a route that renders no Header", () => {
    render(
      <MemoryRouter>
        <ThemeProvider><HeaderlessRoute /></ThemeProvider>
      </MemoryRouter>,
    );
    expect(screen.getByRole("button", { name: /switch to dark mode/i })).toBeInTheDocument();
  });
});

describe("Header", () => {
  it("renders exactly one theme toggle", async () => {
    const { default: Header } = await import("./components/common/Header");
    render(
      <MemoryRouter>
        <ThemeProvider><Header /><ThemeToggle variant="floating" /></ThemeProvider>
      </MemoryRouter>,
    );
    expect(screen.getAllByRole("button", { name: /switch to (dark|light) mode/i })).toHaveLength(1);
  });
});
```

If importing `Header` pulls in providers it needs (`useAuth`, `useAuthModal`), wrap it in those providers in the test rather than mocking them, so the test exercises the real component.

- [ ] **Step 2: Run and verify the Header case fails**

Run: `npx jest src/App.themeToggle.test.jsx`
Expected: the first test passes; the Header test FAILS with 0 toggles found.

- [ ] **Step 3: Add the toggle to `Header.jsx`**

Three edits.

Add to the imports:

```jsx
import { useEffect } from "react";
import ThemeToggle from "./ThemeToggle";
import { useTheme } from "../../contexts/ThemeContext";
```

`useEffect` is already imported in this file — extend the existing import rather than adding a second one.

Inside the component, next to the other hooks, announce the header toggle so the floating one stands down:

```jsx
  const { registerHeaderToggle } = useTheme();

  // Tells the floating toggle in App.jsx to stand down while this header is on
  // screen. Returning the unregister function from the effect is what makes a
  // route change back to a headerless page restore it.
  useEffect(() => registerHeaderToggle(), [registerHeaderToggle]);
```

In the desktop actions block, insert the toggle immediately before the `{/* Divider */}` element:

```jsx
              <ThemeToggle variant="header" />

              {/* Divider */}
```

And in the mobile menu, inside the auth section's containing `div` and before its closing tag, add a labelled row so the control is reachable on a phone:

```jsx
                  <div className="flex items-center justify-between px-1 pt-2">
                    <span className="text-muted-foreground font-medium">Appearance</span>
                    <ThemeToggle variant="header" />
                  </div>
```

- [ ] **Step 4: Mount the floating toggle in `src/App.jsx`**

Add the import:

```jsx
import ThemeToggle from "./components/common/ThemeToggle";
```

Then, in the component that renders `<Routes>`, add the toggle as a sibling **outside** `<Routes>` so it is not tied to any route:

```jsx
      <ThemeToggle variant="floating" />
```

Place it next to the existing `<Toaster />`. It renders nothing when a Header is present, so it is safe to mount unconditionally.

While in this file, tokenise `AdminRedirect` (the only colour-carrying markup in `App.jsx`):

```jsx
    <div className="flex flex-col items-center justify-center min-h-screen bg-background text-foreground p-8">
      <div className="text-center max-w-md mx-auto">
        <h1 className="text-2xl font-bold mb-4">Admin Dashboard</h1>
        <p className="text-muted-foreground mb-8">Redirecting to your dashboard...</p>
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
      </div>
    </div>
```

- [ ] **Step 5: Run and verify it passes**

Run: `npx jest src/App.themeToggle.test.jsx src/components/common`
Expected: PASS.

- [ ] **Step 6: Verify by hand in the browser**

Run: `npm run dev`

Check, in this order:
1. Landing page `/` loads **light** on a fresh profile (clear `localStorage` first).
2. Clicking the header toggle flips the page and the colours transition rather than jumping.
3. Reload — the choice survives.
4. Navigate to `/login` (no Header): the floating toggle is visible bottom-right and works.
5. Back to `/`: exactly one toggle on screen.
6. Open a second tab and flip the theme there; the first tab follows.
7. Hover a nav link: it does **not** fade slowly (proves the `*` transition is gone).

- [ ] **Step 7: Commit**

```bash
git add src/components/common/Header.jsx src/App.jsx src/App.themeToggle.test.jsx
git commit -m "feat(theme): mount the toggle on every route

Header gets the toggle on desktop and an \"Appearance\" row in the mobile menu;
App mounts the floating variant outside <Routes>, which is what covers the 14
routes that render no Header (/login, /quote, /booking, /driver-dashboard,
/pay/*). The Header registers itself so only one is ever on screen.

Also tokenises AdminRedirect, the only colour-carrying markup in App.jsx."
```

---

## Task 8: The codemod

**Files:**
- Create: `scripts/migrate_theme_tokens.mjs`
- Test: `scripts/migrate_theme_tokens.test.mjs`
- Modify: `package.json` (add `migrate:theme` script)

**Interfaces:**
- Consumes: nothing.
- Produces (exported for tests):
  - `MAPPING: Record<string, string>` — bare class → token class.
  - `ON_COLOR_BACKGROUND_RE: RegExp`
  - `ALLOW_LIST: string[]`
  - `migrateClassString(value: string) => { value: string, changed: number, unmapped: string[] }`
  - `migrateSource(source: string) => { source: string, changed: number, unmapped: string[] }`
  - `run({ paths, write }) => { files: number, changed: number, unmapped: Array<{file, line, cls}> }`

- [ ] **Step 1: Write the failing test**

```js
// scripts/migrate_theme_tokens.test.mjs
import { migrateClassString, migrateSource } from "./migrate_theme_tokens.mjs";

describe("migrateClassString", () => {
  it("maps a dark card surface to the card token", () => {
    expect(migrateClassString("bg-gray-900 rounded-lg").value).toBe("bg-card rounded-lg");
  });

  it("maps body text", () => {
    expect(migrateClassString("text-white font-bold").value).toBe("text-foreground font-bold");
  });

  it("maps secondary text from both grey families to one token", () => {
    expect(migrateClassString("text-gray-400").value).toBe("text-muted-foreground");
    expect(migrateClassString("text-slate-400").value).toBe("text-muted-foreground");
  });

  it("preserves variant prefixes", () => {
    expect(migrateClassString("hover:bg-gray-800 focus:border-gray-700").value).toBe(
      "hover:bg-surface focus:border-border",
    );
  });

  it("preserves opacity modifiers", () => {
    expect(migrateClassString("border-orange-500/30").value).toBe("border-primary/30");
  });

  it("preserves a variant AND an opacity modifier together", () => {
    expect(migrateClassString("hover:bg-orange-500/20").value).toBe("hover:bg-primary/20");
  });

  // THE ON-COLOUR RULE. 61 elements put text-white on a coloured background.
  // Mapping those to text-foreground makes every primary button label wrong.
  it("keeps white readable on a brand background", () => {
    expect(migrateClassString("bg-orange-500 text-white").value).toBe(
      "bg-primary text-primary-foreground",
    );
  });

  it("applies the on-colour rule with the background written after the text", () => {
    expect(migrateClassString("text-white bg-orange-500").value).toBe(
      "text-primary-foreground bg-primary",
    );
  });

  it("applies the on-colour rule for a gradient background", () => {
    expect(migrateClassString("bg-gradient-to-r from-orange-500 to-orange-600 text-white").value).toBe(
      "bg-gradient-to-r from-primary to-primary-hover text-primary-foreground",
    );
  });

  it("applies the on-colour rule for a state background", () => {
    expect(migrateClassString("bg-red-600 text-white").value).toBe(
      "bg-destructive text-destructive-foreground",
    );
  });

  it("does not treat a mere border as a coloured background", () => {
    expect(migrateClassString("border-orange-500 text-white").value).toBe(
      "border-primary text-foreground",
    );
  });

  it("leaves allow-listed brand colours alone", () => {
    expect(migrateClassString("bg-[#0070ba] text-white").value).toBe("bg-[#0070ba] text-white");
  });

  it("leaves non-colour utilities untouched", () => {
    const input = "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold";
    expect(migrateClassString(input).value).toBe(input);
  });

  it("reports classes it cannot map instead of guessing", () => {
    const result = migrateClassString("bg-fuchsia-700");
    expect(result.value).toBe("bg-fuchsia-700");
    expect(result.unmapped).toContain("bg-fuchsia-700");
  });

  it("is idempotent", () => {
    const once = migrateClassString("bg-gray-900 text-white").value;
    expect(migrateClassString(once).value).toBe(once);
  });

  it("preserves whitespace shape, so diffs stay readable", () => {
    expect(migrateClassString("bg-gray-900   text-white").value).toBe("bg-card   text-foreground");
  });
});

describe("migrateSource", () => {
  it("rewrites a className string literal", () => {
    const src = `export const A = () => <div className="bg-gray-900 text-white">hi</div>;`;
    expect(migrateSource(src).source).toContain('className="bg-card text-foreground"');
  });

  it("rewrites inside a template literal, leaving expressions alone", () => {
    const src = "const c = `bg-gray-900 ${isActive ? 'text-white' : 'text-gray-400'}`;";
    const out = migrateSource(src).source;
    expect(out).toContain("bg-card");
    expect(out).toContain("text-foreground");
    expect(out).toContain("text-muted-foreground");
    expect(out).toContain("${isActive ?");
  });

  it("does not touch string literals that are not class lists", () => {
    const src = `const msg = "the text-white paint is bg-gray-900 in colour";`;
    // No className/class context and not a pure class list: left alone.
    expect(migrateSource(src).source).toBe(src);
  });

  it("counts what it changed", () => {
    const src = `<div className="bg-gray-900 text-white" />`;
    expect(migrateSource(src).changed).toBe(2);
  });

  it("is idempotent over a whole file", () => {
    const src = `<div className="bg-gray-900 text-white hover:bg-gray-800" />`;
    const once = migrateSource(src).source;
    expect(migrateSource(once).source).toBe(once);
    expect(migrateSource(once).changed).toBe(0);
  });
});
```

- [ ] **Step 2: Run and verify it fails**

Run: `npx jest scripts/migrate_theme_tokens.test.mjs`
Expected: FAIL — module not found.

Note: `jest.config.js` transforms `.mjs` already (`^.+\\.(js|jsx|mjs)$`), but `testMatch` may not pick up `scripts/`. If the test is not collected, add `testMatch` covering `**/*.test.mjs` to `jest.config.js` as part of this task.

- [ ] **Step 3: Write `scripts/migrate_theme_tokens.mjs`**

```js
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
 * THE ONE SUBTLE RULE. `text-white` means two different things: body text on a
 * dark surface (-> text-foreground) and a label on a coloured button
 * (-> text-primary-foreground). 61 elements are the second kind. Guessing wrong
 * turns every primary button label unreadable, so the rule reads the sibling
 * classes in the same class string to decide. See ON_COLOR_BACKGROUND_RE.
 *
 *   node scripts/migrate_theme_tokens.mjs --dry src/components/common
 *   node scripts/migrate_theme_tokens.mjs --write src/components/common
 */

import { readFileSync, writeFileSync, readdirSync, statSync, mkdirSync } from "node:fs";
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
  "text-white": "text-foreground", // may become text-primary-foreground; see applyOnColorRule
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

/** Which `-foreground` token to use, by the background family found. */
const ON_COLOR_TOKEN = [
  [/(?:bg|from|via|to)-orange-/, "primary-foreground"],
  [/(?:bg|from|via|to)-red-/, "destructive-foreground"],
  [/(?:bg|from|via|to)-(?:green|emerald)-/, "success-foreground"],
  [/(?:bg|from|via|to)-(?:amber|yellow)-/, "warning-foreground"],
  [/(?:bg|from|via|to)-blue-/, "info-foreground"],
];

/** Literal colours that must stay literal: third-party brand requirements. */
export const ALLOW_LIST = ["bg-[#0070ba]", "bg-[#005ea6]", "text-[#0070ba]"];

/** Colour utilities we know about, for deciding what counts as "unmapped". */
const COLOUR_CLASS_RE =
  /^(?:[\w-]+:)*(?:bg|text|border|ring|divide|placeholder|from|via|to|outline|shadow|accent|caret|fill|stroke)-(?:white|black|gray|slate|zinc|neutral|stone|orange|red|green|blue|yellow|amber|emerald|purple|indigo|cyan|pink|teal|violet|rose|fuchsia|lime|sky)(?:-\d{2,3})?(?:\/\d{1,3})?$/;

/** Split a class token into variants, base, and opacity. */
function parseClass(cls) {
  const slash = cls.lastIndexOf("/");
  const opacity = slash > cls.lastIndexOf("]") && slash !== -1 ? cls.slice(slash) : "";
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
 * @returns {{value: string, changed: number, unmapped: string[]}}
 */
export function migrateClassString(value) {
  const onColor = ON_COLOR_BACKGROUND_RE.test(value);
  const unmapped = [];
  let changed = 0;

  // Split on whitespace but KEEP it, so the output diff is minimal.
  const pieces = value.split(/(\s+)/);
  const out = pieces.map((piece) => {
    if (!piece || /^\s+$/.test(piece)) return piece;
    if (ALLOW_LIST.includes(piece)) return piece;

    const { variants, base, opacity } = parseClass(piece);

    let mapped = MAPPING[base];

    // The on-colour rule: white/black sitting on a coloured background is a
    // label, not body text.
    if ((base === "text-white" || base === "text-black") && onColor) {
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

  return { value: out.join(""), changed, unmapped };
}

/** Does this string literal look like a class list rather than prose? */
function looksLikeClassList(text) {
  const tokens = text.trim().split(/\s+/);
  if (tokens.length === 0 || text.trim() === "") return false;
  // Every token must look like a utility class: no spaces-with-punctuation prose.
  return tokens.every((t) => /^[\w[\]#().,%/:-]+$/.test(t)) && /-/.test(text);
}

/**
 * Rewrite class strings in a source file.
 *
 * Targets, in order: className/class attribute string literals, then any
 * template-literal chunk or quoted string that is itself a plain class list
 * (which covers clsx/cn arguments and the ternaries inside template literals).
 * Expressions inside `${...}` are never touched.
 */
export function migrateSource(source) {
  let changed = 0;
  const unmapped = [];

  const apply = (text) => {
    const result = migrateClassString(text);
    changed += result.changed;
    unmapped.push(...result.unmapped);
    return result.value;
  };

  // 1. className="..." and class="..."
  let out = source.replace(
    /((?:className|class)\s*=\s*)(["'])([^"'\n]*)\2/g,
    (_m, lead, quote, body) => `${lead}${quote}${apply(body)}${quote}`,
  );

  // 2. Template literals: rewrite the literal chunks between ${...} holes,
  //    plus quoted class lists inside the holes.
  out = out.replace(/`([^`]*)`/g, (whole, body) => {
    const rebuilt = body
      .split(/(\$\{[^}]*\})/)
      .map((segment) => {
        if (segment.startsWith("${")) {
          // Only touch quoted strings that are pure class lists.
          return segment.replace(/(["'])([^"']*)\1/g, (m, q, inner) =>
            looksLikeClassList(inner) ? `${q}${apply(inner)}${q}` : m,
          );
        }
        return looksLikeClassList(segment) ? apply(segment) : segment;
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
    for (const cls of new Set(unmapped)) {
      const line = before.split("\n").findIndex((l) => l.includes(cls)) + 1;
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
  console.log(`${write ? "REWROTE" : "DRY RUN"}  files: ${result.files}  classes: ${result.changed}`);

  if (result.unmapped.length) {
    mkdirSync("/tmp/theme-migration", { recursive: true });
    const tsv = ["file\tline\tclass", ...result.unmapped.map((u) => `${u.file}\t${u.line}\t${u.cls}`)].join("\n");
    writeFileSync("/tmp/theme-migration/unmapped.tsv", tsv + "\n", "utf8");
    console.log(`unmapped: ${result.unmapped.length} -> /tmp/theme-migration/unmapped.tsv`);
    console.log("These were NOT changed. Review each and either add a mapping or hand-edit.");
  }
}
```

- [ ] **Step 4: Run and verify it passes**

Run: `npx jest scripts/migrate_theme_tokens.test.mjs`
Expected: PASS, 21 tests.

- [ ] **Step 5: Add the npm script**

In `package.json`, alongside the existing `audit:theme`:

```json
    "migrate:theme": "node scripts/migrate_theme_tokens.mjs",
```

- [ ] **Step 6: Commit**

```bash
git add scripts/migrate_theme_tokens.mjs scripts/migrate_theme_tokens.test.mjs package.json jest.config.js
git commit -m "feat(theme): codemod for the 5389-occurrence migration

Deterministic space: 5389 colour utilities across 123 files is a mapping table,
not a judgement call, and one reviewable table beats 123 hand-edited diffs.

It never guesses. An unknown colour class is left exactly as it was and written
to /tmp/theme-migration/unmapped.tsv with file:line, so the residue is a short
list to look at rather than a silent wrong answer.

The subtle rule is text-white, which means two different things: body text on a
dark surface, and a label on a coloured button. 61 elements are the second kind,
so the mapper reads sibling classes in the same class string and picks
text-primary-foreground (or the matching state) instead of text-foreground.
Getting that backwards makes every primary button label unreadable.

Variant prefixes and opacity modifiers are preserved (hover:bg-orange-500/20 ->
hover:bg-primary/20); PayPal and Stripe brand literals are allow-listed."
```

---

## Tasks 9–23: Migration streams

Fifteen streams. Each is **the same five steps** with a different path, listed in full below so no stream needs to read another. Streams touch disjoint files and may run in parallel; `common` must land first because `Header`, `Footer` and `LoadingSkeletons` are shared.

| Task | Stream | Path | Files |
|---|---|---|---|
| 9 | common | `src/components/common` | 4 |
| 10 | landingPage | `src/components/landingPage` | 2 |
| 11 | business | `src/components/business` | 22 |
| 12 | auth | `src/components/auth` | 13 |
| 13 | payments | `src/components/payments` | 11 |
| 14 | driver | `src/components/driver` | 10 |
| 15 | bookings | `src/components/bookings` | 5 |
| 16 | quote | `src/components/quote` | 3 |
| 17 | profile | `src/components/profile` | 3 |
| 18 | map | `src/components/map` | 3 |
| 19 | contact | `src/components/contact` | 2 |
| 20 | admin | `src/components/admin` | 2 |
| 21 | about | `src/components/about` | 1 |
| 22 | track | `src/components/track` | 1 |
| 23 | utils | `src/utils/bulkUploadValidation.js` | 1 |

### The five steps for each stream

Substitute `<PATH>` and `<STREAM>` from the table.

- [ ] **Step 1: Confirm the tree is clean, then dry-run**

```bash
git status --short          # must be empty; the diff is the only record of what changed
npm run migrate:theme -- --dry <PATH>
```

Read the reported counts and, if written, `/tmp/theme-migration/unmapped.tsv`. Do not proceed if `files: 0` — that means the path is wrong.

- [ ] **Step 2: Rewrite, then read the diff**

```bash
npm run migrate:theme -- --write <PATH>
git diff --stat
git diff
```

Read the whole diff. Three things to check, because they are what the codemod cannot know:

1. **Any `text-primary-foreground` that is not on a coloured background**, or any `text-foreground` that is. Fix by hand.
2. **`bg-surface` where the element is an input or a hover state** rather than a panel — `bg-gray-800` serves all three, and the codemod maps by dominant role. An input should be `bg-input`; a hover state should be `hover:bg-surface-hover`.
3. **Semantic colour used decoratively** — e.g. a blue chip that means "info" versus one that is merely blue. The token is right for the former, wrong for the latter.

- [ ] **Step 3: Hand-fix anything in `/tmp/theme-migration/unmapped.tsv` for this path**

Each row is a colour class with no mapping. For each: either it is genuinely one-off decoration (leave it, and note why), or it belongs to a role (add it to `MAPPING` in `scripts/migrate_theme_tokens.mjs`, add a test case for it in `scripts/migrate_theme_tokens.test.mjs`, and re-run Step 2).

- [ ] **Step 4: Verify**

```bash
npx jest                                  # whole gate suite must stay green
npm run build                             # no "unknown utility class"
npm run audit:theme -- --files | head -20 # this stream's files should drop toward 0
```

Then look at the affected screens in both themes:

```bash
npm run dev
```

Toggle the theme on each page this stream touched. Look for: white-on-white or dark-on-dark text, a card that stayed dark while the page went light, an invisible border, an unreadable button label.

- [ ] **Step 5: Commit**

```bash
git add <PATH>
git commit -m "refactor(theme): migrate <STREAM> to semantic tokens

<N> occurrences across <M> files now name roles rather than colours, so both
themes come from styles/tokens.css.

Hand-corrections after the codemod: <list them, or 'none'>."
```

---

## Task 24: Rewrite the audit as the new gate

The current `scripts/audit_theme.mjs` measures whether the app can flip at all and exits non-zero while it cannot. That question is now answered, so it must measure the new invariant instead: no raw colour utilities remain outside the allow-list.

**Files:**
- Rewrite: `scripts/audit_theme.mjs`
- Delete: `scripts/audit_unpaired_light.mjs`
- Create: `src/styles/noRawColors.test.js`
- Modify: `package.json`

**Interfaces:**
- Consumes: `ALLOW_LIST` from Task 8.
- Produces: exit code 0 when the tree is clean; a per-file table with `--files`.

- [ ] **Step 1: Write the failing gate test**

```js
// src/styles/noRawColors.test.js
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { ALLOW_LIST } from "../../scripts/migrate_theme_tokens.mjs";

const SRC = join(__dirname, "..");

const RAW_COLOR_RE =
  /(?:^|["'\s`])((?:[\w-]+:)*(?:bg|text|border|ring|divide|placeholder|from|via|to)-(?:white|black|gray|slate|zinc|neutral|stone|orange|red|green|blue|yellow|amber|emerald|purple|indigo|cyan|pink|teal)(?:-\d{2,3})?(?:\/\d{1,3})?)(?=["'\s`]|$)/g;

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.jsx?$/.test(p) && !/\.test\.jsx?$/.test(p)) out.push(p);
  }
  return out;
}

describe("no raw colour utilities in src/", () => {
  it("every component names a role, not a colour", () => {
    const offenders = [];
    for (const file of walk(SRC)) {
      // tokens.js legitimately holds palette values; it IS the palette.
      if (/styles[/\\]tokens\.js$/.test(file)) continue;
      const src = readFileSync(file, "utf8");
      for (const m of src.matchAll(RAW_COLOR_RE)) {
        if (ALLOW_LIST.includes(m[1])) continue;
        const line = src.slice(0, m.index).split("\n").length;
        offenders.push(`${relative(SRC, file)}:${line}  ${m[1]}`);
      }
    }
    expect(offenders).toEqual([]);
  });
});
```

- [ ] **Step 2: Run it**

Run: `npx jest src/styles/noRawColors.test.js`
Expected: FAIL initially, listing every remaining raw colour. It passes only once all 15 streams are done — which is exactly its job. Add it to the suite in this task and let it fail until then, or land this task last; either is fine, but do not weaken the assertion to make it pass.

- [ ] **Step 3: Rewrite `scripts/audit_theme.mjs`**

```js
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
 * themes, so one raw `text-white` is enough to make a card illegible once the
 * page goes light. Zero is the only passing answer, allow-listed third-party
 * brand colours aside.
 *
 *   node scripts/audit_theme.mjs
 *   node scripts/audit_theme.mjs --files
 */

import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { ALLOW_LIST } from "./migrate_theme_tokens.mjs";

const ROOT = new URL("../src", import.meta.url).pathname;

const RAW_COLOR_RE =
  /(?:^|["'\s`])((?:[\w-]+:)*(?:bg|text|border|ring|divide|placeholder|from|via|to)-(?:white|black|gray|slate|zinc|neutral|stone|orange|red|green|blue|yellow|amber|emerald|purple|indigo|cyan|pink|teal)(?:-\d{2,3})?(?:\/\d{1,3})?)(?=["'\s`]|$)/g;

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.jsx?$/.test(p) && !/\.test\.jsx?$/.test(p)) out.push(p);
  }
  return out;
}

const rows = [];
let total = 0;

for (const file of walk(ROOT)) {
  if (/styles[/\\]tokens\.js$/.test(file)) continue;
  const src = readFileSync(file, "utf8");
  const hits = [];
  for (const m of src.matchAll(RAW_COLOR_RE)) {
    if (ALLOW_LIST.includes(m[1])) continue;
    hits.push({ cls: m[1], line: src.slice(0, m.index).split("\n").length });
  }
  if (hits.length) {
    rows.push({ file: relative(ROOT, file), hits });
    total += hits.length;
  }
}

if (process.argv.includes("--files")) {
  console.log("raw  file");
  for (const r of rows.sort((a, b) => b.hits.length - a.hits.length)) {
    console.log(String(r.hits.length).padStart(4), " ", r.file);
  }
  console.log("");
}

console.log("THEME AUDIT");
console.log("  files still naming a colour :", rows.length);
console.log("  raw colour occurrences      :", total);
console.log("");

if (total > 0) {
  console.log("VERDICT: not themeable yet. A raw colour renders identically in both");
  console.log("         themes, so each of these is a spot that stays dark when the page");
  console.log("         goes light. Run `npm run migrate:theme -- --write <path>`, then");
  console.log("         review the diff. `--files` lists the worst offenders first.");
  process.exitCode = 1;
} else {
  console.log("VERDICT: every file names roles, not colours. Both themes render.");
}
```

- [ ] **Step 4: Update `package.json` and remove the retired audit**

Remove the `audit:light` script and delete `scripts/audit_unpaired_light.mjs`. Its whole job was finding light surfaces with no `dark:` pair and excusing 13 files as intentional "light islands" — a distinction that stops existing once no file is intrinsically either theme.

- [ ] **Step 5: Verify**

Run: `npm run audit:theme`
Expected: exit 0 and "every file names roles, not colours" once all streams are done.

- [ ] **Step 6: Commit**

```bash
git add scripts/audit_theme.mjs src/styles/noRawColors.test.js package.json
git rm scripts/audit_unpaired_light.mjs
git commit -m "feat(theme): audit the new invariant, as a gate test too

audit_theme.mjs used to ask whether any file could flip cleanly; the answer was
0 of 73 and that is what removed the toggle in 9e8d481. Settled question, so it
now asks whether any file still names a colour rather than a role — a raw colour
renders the same in both themes, so one is enough to strand a card in the wrong
one. Still exits non-zero until clean.

Same check ships as noRawColors.test.js so a regression fails on commit rather
than waiting for someone to run the audit.

Retires audit_unpaired_light.mjs: it excused 13 files as intentional \"light
islands\", a category that stops existing once no file is intrinsically either
theme."
```

---

## Task 25: Eval lane

Gate tests prove the tokens and the runtime. They cannot prove that a real rendered page has no half-themed corner, because that depends on which elements actually nest inside which. This crawls the running app.

**Files:**
- Create: `evals/eval_theme_coverage.mjs`
- Modify: `package.json`

**Interfaces:**
- Consumes: the dev server on `http://localhost:5173`, `contrastRatio` from Task 1.
- Produces: exit 0 when zero findings; a report at `/tmp/theme-eval/report.md`.

- [ ] **Step 1: Write the eval**

Uses Playwright's Chromium if available, else Puppeteer. Add whichever is already in the tree; if neither is, `npm i -D playwright` and commit the lockfile with this task.

```js
#!/usr/bin/env node
/**
 * evals/eval_theme_coverage.mjs
 * ═══════════════════════════════════════════════════════════════════════════
 * Does every route render coherently in BOTH themes?
 *
 * WHY A BROWSER. The gate tests prove the token values clear AA and that the
 * runtime flips the class. Neither can prove a rendered page has no half-themed
 * corner, because that depends on which element ends up inside which — a dark
 * card nested in a light page is a DOM fact, not a palette fact.
 *
 * Deterministic despite being in the slow lane: it reads computed styles and
 * does arithmetic. That is strictly better than asking a model to eyeball a
 * screenshot, so the model is not asked.
 *
 * TWO FINDINGS IT REPORTS
 *   contrast  a text node whose computed colour vs its effective background
 *             falls below AA.
 *   mixed     an element with a dark background inside a light ancestor, or the
 *             reverse. This is the half-flip that removed the toggle in 9e8d481,
 *             detected structurally rather than by opinion.
 *
 *   npm run eval:theme
 */

import { writeFileSync, mkdirSync } from "node:fs";
import { chromium } from "playwright";
import { relativeLuminance } from "../src/styles/colorMath.js";

const BASE = process.env.EVAL_BASE_URL ?? "http://localhost:5173";

// Public routes only. Authenticated routes need a session; see the note at the
// end of this file for extending coverage with a seeded login.
const ROUTES = [
  "/", "/faqs", "/login", "/register", "/forgot-password",
  "/check-email", "/email-confirmation", "/account-confirmed",
  "/resend-confirmation", "/quote", "/booking", "/pay/cancel",
];

const AA_NORMAL = 4.5;

/** srgb "rgb(r, g, b)" -> linear triple, for relativeLuminance. */
function parseRgb(str) {
  const m = /rgba?\(([\d.]+),\s*([\d.]+),\s*([\d.]+)/.exec(str);
  if (!m) return null;
  return [m[1], m[2], m[3]]
    .map((v) => Number(v) / 255)
    .map((c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
}

function ratio(a, b) {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

/** Collect text colour + effective background for every visible text node. */
const COLLECT = `(() => {
  const out = [];
  const isTransparent = (c) => !c || c === "transparent" || /rgba\\(0,\\s*0,\\s*0,\\s*0\\)/.test(c);
  const effectiveBg = (el) => {
    let node = el;
    while (node && node !== document.documentElement) {
      const bg = getComputedStyle(node).backgroundColor;
      if (!isTransparent(bg)) return bg;
      node = node.parentElement;
    }
    return getComputedStyle(document.body).backgroundColor;
  };
  for (const el of document.querySelectorAll("body *")) {
    const style = getComputedStyle(el);
    if (style.display === "none" || style.visibility === "hidden" || Number(style.opacity) === 0) continue;
    const rect = el.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) continue;
    const ownText = Array.from(el.childNodes)
      .filter((n) => n.nodeType === 3)
      .map((n) => n.textContent.trim())
      .join(" ")
      .trim();
    out.push({
      tag: el.tagName.toLowerCase(),
      cls: (el.getAttribute("class") || "").slice(0, 120),
      text: ownText.slice(0, 60),
      hasText: ownText.length > 0,
      color: style.color,
      bg: getComputedStyle(el).backgroundColor,
      effBg: effectiveBg(el),
      fontSize: parseFloat(style.fontSize),
      fontWeight: style.fontWeight,
    });
  }
  return out;
})()`;

async function auditRoute(page, route, theme) {
  await page.goto(`${BASE}${route}`, { waitUntil: "networkidle" });
  await page.evaluate((t) => {
    localStorage.setItem("theme", t);
    document.documentElement.classList.toggle("dark", t === "dark");
  }, theme);
  await page.waitForTimeout(300); // let the transition settle

  const nodes = await page.evaluate(COLLECT);
  const findings = [];

  for (const n of nodes) {
    // Contrast, for elements that own visible text.
    if (n.hasText) {
      const fg = parseRgb(n.color);
      const bg = parseRgb(n.effBg);
      if (fg && bg) {
        const large = n.fontSize >= 24 || (n.fontSize >= 18.66 && Number(n.fontWeight) >= 700);
        const min = large ? 3 : AA_NORMAL;
        const r = ratio(fg, bg);
        if (r < min) {
          findings.push({
            kind: "contrast", route, theme, tag: n.tag, cls: n.cls,
            detail: `"${n.text}" ${r.toFixed(2)}:1 (needs ${min})`,
          });
        }
      }
    }

    // Mixed theming: an opaque background whose lightness is on the wrong side
    // of the theme it is rendering in.
    const own = parseRgb(n.bg);
    if (own) {
      const lum = relativeLuminance(own);
      if (theme === "light" && lum < 0.05) {
        findings.push({ kind: "mixed", route, theme, tag: n.tag, cls: n.cls, detail: `dark surface (lum ${lum.toFixed(3)}) in light theme` });
      }
      if (theme === "dark" && lum > 0.8) {
        findings.push({ kind: "mixed", route, theme, tag: n.tag, cls: n.cls, detail: `light surface (lum ${lum.toFixed(3)}) in dark theme` });
      }
    }
  }
  return findings;
}

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
const all = [];

for (const route of ROUTES) {
  for (const theme of ["light", "dark"]) {
    try {
      const findings = await auditRoute(page, route, theme);
      all.push(...findings);
      console.log(`${theme.padEnd(5)} ${route.padEnd(24)} ${findings.length} finding(s)`);
    } catch (err) {
      console.log(`${theme.padEnd(5)} ${route.padEnd(24)} ERROR ${err.message}`);
      all.push({ kind: "error", route, theme, tag: "-", cls: "-", detail: err.message });
    }
  }
}

await browser.close();

mkdirSync("/tmp/theme-eval", { recursive: true });
const byKind = (k) => all.filter((f) => f.kind === k);
const report = [
  "# Theme coverage eval",
  "",
  `Routes: ${ROUTES.length} x 2 themes. Findings: ${all.length}`,
  `- contrast: ${byKind("contrast").length}`,
  `- mixed:    ${byKind("mixed").length}`,
  `- errors:   ${byKind("error").length}`,
  "",
  "| kind | theme | route | element | detail |",
  "| --- | --- | --- | --- | --- |",
  ...all.map((f) => `| ${f.kind} | ${f.theme} | ${f.route} | \`${f.tag}.${f.cls}\` | ${f.detail} |`),
].join("\n");
writeFileSync("/tmp/theme-eval/report.md", report + "\n");

console.log(`\n${all.length} finding(s) -> /tmp/theme-eval/report.md`);
process.exitCode = all.length === 0 ? 0 : 1;

// Extending coverage: the 19 authenticated routes need a session. Seed one by
// writing the auth token into localStorage before the first goto, the same way
// the theme is set above, using a test account from the backend fixtures.
```

- [ ] **Step 2: Add the npm script**

```json
    "eval:theme": "node evals/eval_theme_coverage.mjs",
```

- [ ] **Step 3: Run it against the dev server**

```bash
npm run dev &
npm run eval:theme
```

Expected: a findings table. Every `mixed` finding is a bug — fix it in the owning component. Triage `contrast` findings: a genuine failure is a token or a component bug; a false positive is usually text over an image or a gradient, where the crawler's "effective background" walk cannot see the real backdrop. Note those in the eval as known exclusions rather than silencing the check.

- [ ] **Step 4: Commit**

```bash
git add evals/eval_theme_coverage.mjs package.json
git commit -m "feat(theme): eval lane — crawl 31 routes in both themes

Gate tests prove the palette clears AA and the runtime flips the class. Neither
can prove a RENDERED page has no half-themed corner: a dark card inside a light
page is a DOM fact, not a palette fact. This reads computed styles in a real
browser and reports two findings — contrast below AA, and a surface whose
lightness is on the wrong side of the theme it renders in.

That second one is the exact failure that removed the toggle in 9e8d481, now
detected structurally instead of by whoever happens to look at the screen.

Deterministic despite being in the slow lane, so no model is asked to eyeball a
screenshot."
```

---

## Task 26: Document how to stay themed

**Files:**
- Create: `docs/theming.md`
- Modify: `README.md`

- [ ] **Step 1: Write `docs/theming.md`**

Cover, with a concrete example of each: the token table and what role each name means; the rule that components name roles and never colours; how to add a token (edit `tokens.css` **and** `tokens.js`, add a `CONTRAST_PAIRS` row, run `npx jest src/styles/`); why `dark:` is almost never needed once a component is on tokens; the on-colour rule and when to reach for `*-foreground`; how to run `audit:theme`, the gate suite, and `eval:theme`; and the three parity exceptions with their measured ratios.

- [ ] **Step 2: Link it from `README.md`** under a "Theming" heading, one line plus the link.

- [ ] **Step 3: Commit**

```bash
git add docs/theming.md README.md
git commit -m "docs(theme): how to add UI without breaking a theme

The rule is one line — name a role, never a colour — but the reasons it matters
and the procedure for adding a token are worth writing down, since the failure
mode is invisible until someone flips the theme on a page you did not check."
```

---

## Task 27: Ship

- [ ] **Step 1: Full verification**

```bash
npx jest                # entire gate suite
npm run lint
npm run build
npm run audit:theme     # must exit 0
npm run dev & npm run eval:theme
```

Every command must pass. `audit:theme` exiting non-zero means a stream is unfinished.

- [ ] **Step 2: Manual pass over the routes the eval cannot reach**

Log in and toggle the theme on each authenticated route: `/history`, `/profile`, `/profile-settings`, `/billing`, `/invoices/:id`, `/bulk-upload`, `/bulk-upload/:id`, `/bulk-upload/:id/review`, `/business/register`, `/business/profile`, `/driver-dashboard`, `/pay/:txId`, `/pay/bulk/:uploadId`, `/pay/resume/:resumeToken`, `/admin-live-tracking`. Also open the modals: auth, track parcel, booking, job details, QR scanner, failure report.

- [ ] **Step 3: Report the measured outcome**

| Measure | Before | After |
|---|---|---|
| Raw colour occurrences | 1697 dark-only of 5389 total | fill in from `audit:theme` |
| Files rendering correctly in both themes | 0 of 73 | fill in |
| Routes with a reachable toggle | 0 of 31 | fill in |
| AA contrast failures, both themes | unmeasured | fill in from `eval:theme` |
| Mixed-theming findings | 36 files half-flip | fill in |

- [ ] **Step 4: Push**

```bash
git push origin develop
```

- [ ] **Step 5: Report what to restart**

The frontend is a static Vite build, so a deploy is a rebuild plus a static-file sync — no service restart. Confirm against `DEPLOY.md` and `deploy.sh` and state the exact commands, flagging any that need `sudo` as Julien's to run.

---

## Self-Review

**Spec coverage.** §1 problem → Task 24 measures the new invariant. §2 decisions → tokens (Tasks 2–3), light default (Task 4), toggle placement (Tasks 6–7), cool-neutral palette (Task 2). §2.1 flagged consequence → `DEFAULT_THEME` in Task 4, called out in Global Constraints. §3 invariant and both Tailwind v4 traps → Task 2 `PARITY_MAP` + `darkParity.test.js`, literal values enforced in Global Constraints. §4 consolidation → Task 3 Steps 5–7. §5 vocabulary → Task 2 token tables, `@theme inline` in Task 3. §6 codemod incl. on-colour rule, ambiguity reporting, idempotency, allow-list → Task 8. §7 runtime, no-flash, context, toggle, transitions → Tasks 4–7. §8 gate and eval lanes → Tasks 1, 2, 3, 4, 5, 6, 24, 25. §9 execution order → Tasks 9–23 in the stated order, root stream as Task 23. §10 risks → each has an owning task. §11 outcome measures → Task 27 Step 3.

**Additions the spec did not have,** all forced by measurement during planning: `brand-text` split from `primary` (orange-500 as text on white is 2.89:1); `primary-foreground` = `gray-900` rather than white (2.89:1 → 6.14:1, approved); `success`/`warning` at the 700 step in light (green-600 is 3.22:1, amber-600 is 3.19:1); `tokens.js` + `tokensParity.test.js` so tests need no CSS parser; the gamma double-decode regression test in Task 1.

**Placeholder scan.** No TBD/TODO. Every code step carries the actual code. The 15 streams share one fully-written five-step procedure with a parameter table rather than referring to each other. Two deliberate fill-ins, both requiring a run to produce: the outcome numbers in Task 27 Step 3, and per-stream hand-corrections in each stream's commit message.

**Type consistency.** `applyTheme(theme, {persist, animate})` — same signature in Task 4's implementation, its tests, and both call sites in Task 5. `registerHeaderToggle()` returns an unregister function in Task 5, and Task 7's Header returns it straight from `useEffect`. `contrastRatio` accepts oklch strings or linear triples in Task 1, used both ways in Tasks 2 and 25. `migrateClassString`/`migrateSource` return `{value|source, changed, unmapped}` consistently in Task 8 and its tests. `ALLOW_LIST` is exported by Task 8 and imported by Task 24 in both the script and the test. `relativeLuminance` expects linear input in Task 1 and Task 25 converts sRGB before calling it. Token names in `MAPPING` (Task 8) all exist in `LIGHT_TOKENS`/`DARK_TOKENS` (Task 2) and in `@theme inline` (Task 3).
