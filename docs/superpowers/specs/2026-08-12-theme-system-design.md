# Dark / Light Theme System — Design

**Date:** 2026-08-12
**Status:** Approved for planning
**Repo:** `drop_and_roll_frontend` (branch `develop`)

---

## 1. Problem

The app is dark-only. A light/dark toggle used to sit on ProfilePage; commit `9e8d481`
removed it after measuring that pressing it did not render a light app, it rendered a
screen half in each theme.

That measurement still holds. `npm run audit:theme` today:

```
files with dark-only styling and NO dark: pair : 37
files that flip cleanly (dark: only)           : 0     <- of 73
MIXED files (half-flip in light mode)          : 36
dark-only utility occurrences (total)          : 1697
dark: utility occurrences (total)              : 1160
```

Full colour surface, measured across `src/**/*.{js,jsx}`:

| Quantity | Count |
|---|---|
| Files in `src/` (excl. tests) | 123 |
| Colour-utility occurrences | 5389 |
| Distinct colour classes | 539 |
| Occurrences with an opacity modifier (`bg-orange-500/30`) | 663 |
| Variant-prefixed (`hover:` 445, `focus:` 155, `group-hover:` 15, `disabled:` 15, other 10) | 640 |
| `text-white` sitting on a coloured background | 61 |
| Routes in `App.jsx` | 31 |
| Routes rendering **no** `<Header>` | 14 |

The goal: a real light mode and a real dark mode across every route, a toggle that is
always reachable, a persisted preference, smooth transitions, and contrast that passes
WCAG AA in both themes.

## 2. Decisions taken

| Decision | Choice |
|---|---|
| Approach | Semantic design tokens (repair + adopt the layer already in `globals.css`) |
| Default for a visitor with no saved preference | **Light** |
| Toggle placement | Header where one exists, plus a fixed floating fallback |
| Light palette | Cool neutral + orange brand (reuse the `:root` values already written) |

### 2.1 Flagged consequence of the light default

`utils/theme.js` currently *deletes* any saved `theme: "light"` at boot. So after this
ships, every existing user has no stored key and lands on **light**. The orange-on-black
identity becomes opt-in. This is an intentional change of the default look, accepted when
the decision was taken. Reverting it later is a one-line change to `DEFAULT_THEME`.

## 3. The invariant that makes a 123-file refactor safe

> **Dark mode's rendered appearance must not change.**

Every `.dark` token is defined as the exact colour of the literal utility it replaces. So:

- in **dark** mode this work is a pure refactor, provable mechanically;
- in **light** mode it is the new feature.

Two facts discovered while validating this, both of which shape the implementation:

1. **Tailwind v4's palette is `oklch`, not hex.** e.g. `--color-orange-500: oklch(70.5% 0.213 47.604)`.
2. **Tailwind v4 only emits palette variables that are actually used.** So writing
   `--card: var(--color-gray-900)` is a trap: the variable stops being emitted the moment
   the migration removes the last `gray-900` utility, and `--card` silently resolves to
   nothing. **Tokens must therefore carry literal values**, with a test asserting those
   literals still equal Tailwind's palette (§8, `darkParity.test.js`). That test also
   catches drift on a future Tailwind upgrade.

Measured palette values to transcribe (from `@tailwindcss/node` compile output, not memory).
This is the subset the dominant mappings need; the state tokens also draw on `red-400/600`,
`green-400/600`, `blue-400/600` and `amber-400/600`, extracted the same way:

```
gray-50  oklch(98.5% 0.002 247.839)   gray-700 oklch(37.3% 0.034 259.733)
gray-100 oklch(96.7% 0.003 264.542)   gray-800 oklch(27.8% 0.033 256.848)
gray-200 oklch(92.8% 0.006 264.531)   gray-900 oklch(21% 0.034 264.665)
gray-300 oklch(87.2% 0.01 258.338)    gray-950 oklch(13% 0.028 261.692)
gray-400 oklch(70.7% 0.022 261.325)   slate-400 oklch(70.4% 0.04 256.788)
gray-500 oklch(55.1% 0.027 264.364)   slate-700 oklch(37.2% 0.044 257.287)
gray-600 oklch(44.6% 0.03 256.802)    slate-800 oklch(27.9% 0.041 260.031)
orange-500 oklch(70.5% 0.213 47.604)  orange-600 oklch(64.6% 0.222 41.116)
red-500 oklch(63.7% 0.237 25.331)     green-500 oklch(72.3% 0.219 149.579)
```

## 4. Stylesheet consolidation

Today there are **two competing theme configs**, and which one wins is decided by import
order rather than intent:

- `src/index.css:31` — `@custom-variant dark (&:where(.dark, .dark *))`, and
  `body { @apply bg-black text-white }`
- `src/globals.css:4` — `@custom-variant dark (&:is(.dark *))`, a full shadcn token set,
  and `body { @apply bg-background text-foreground }`

`main.jsx` imports `index.css`; `App.jsx` imports `App.css` then `globals.css`. Later wins.

Target layout:

| File | Responsibility after this work |
|---|---|
| `src/styles/tokens.css` | **NEW.** Single source of truth: `:root` (light), `.dark`, `@theme inline`. Nothing else. |
| `src/index.css` | Imports Tailwind + tokens **once**. Declares `@custom-variant dark` **once**. `body` in tokens. Re-expresses `.btn-primary` / `.btn-secondary` / `.input-field` / `.card` / `.modal` / `.modal-content` in tokens — all six are currently hard-dark. |
| `src/globals.css` | Token blocks and duplicate variant removed; keeps only its non-theme content (mobile helpers, `tw-animate-css`). |
| `src/App.css` | The `* { transition-property: … }` rule (line 22) removed — see §7. Keyframes and scrollbar colours become token-driven. |

## 5. Token vocabulary

Names already used by `globals.css`'s `@theme inline` block are kept, so that block and
`* { @apply border-border }` keep working. Added tokens cover the vocabulary actually
measured in the codebase.

| Group | Tokens |
|---|---|
| Surfaces | `background`, `card`, `popover`, `surface`, `surface-hover`, `muted`, `overlay` |
| Text | `foreground`, `card-foreground`, `muted-foreground`, `subtle-foreground` |
| Lines | `border`, `border-strong`, `input`, `ring` |
| Brand | `primary`, `primary-hover`, `primary-foreground` |
| States | `success`, `warning`, `destructive`, `info` — each with `-foreground` and `-surface` |

Two rules that prevent the classic theming failures:

- **`*-foreground` tokens are theme-invariant.** White text on an orange button is white in
  both themes. This is what stops a codemod from making 61 button labels illegible.
- **State hues shift lightness between themes.** `text-red-400` reads on black but fails on
  white, so `--destructive` is `red-400` in dark and `red-600` in light. Same hue, both legible.

Verified compiling against var-backed tokens (all 12 forms produce correct CSS, opacity via
`color-mix`): `bg-*/30`, `border-*/50`, `ring-*/40`, `text-*/60`, `hover:bg-*/20`,
`dark:bg-*/70`, `from-*/10`, `to-*`, `placeholder-*`, `divide-*`. The 663 opacity-modifier
occurrences are therefore safe to migrate.

## 6. The codemod

`scripts/migrate_theme_tokens.mjs`. Deterministic space per CLAUDE.md: same tree, same
result, no judgement calls at runtime.

Walks `className` string literals, template literals, and `clsx`/`cn` call arguments.
Maps each class token through a fixed table. Preserves variant prefixes and opacity
modifiers. Dominant mappings, by measured frequency:

| From | To | Occurrences |
|---|---|---|
| `text-white` (not on colour) | `text-foreground` | 406 total, 345 after the on-colour rule |
| `text-gray-400`, `text-slate-400` | `text-muted-foreground` | 384 |
| `bg-gray-800`, `bg-slate-700` | `bg-surface` | 178 |
| `bg-black` | `bg-background` | 47 |
| `bg-gray-900`, `bg-slate-800/900` | `bg-card` | 98 |
| `bg-white`, `bg-gray-50` | `bg-card` / `bg-muted` | 169 |
| `text-orange-500/400` | `text-primary` | 181 |
| `border-gray-700/800`, `border-slate-600` | `border-border` | 141 |

### 6.1 The on-colour rule (the one hard case)

61 elements carry `text-white` on a coloured background, e.g.
`src/components/business/BulkUploadReviewPage.jsx:417`:

```
bg-orange-500 hover:bg-orange-600 text-white text-sm font-semibold
```

A blind `text-white → text-foreground` map turns every primary button label dark-on-orange.

> Before mapping `text-white` / `text-black`, inspect the sibling classes in the **same**
> class string. If it contains a brand, state, or gradient background (`bg-orange-*`,
> `bg-red-*`, `bg-green-*`, `bg-blue-*`, `from-*`), map to `text-primary-foreground` or the
> matching state `-foreground`. Otherwise map to `text-foreground`.

### 6.2 Ambiguity is reported, never guessed

Some literals serve more than one semantic role: `bg-gray-800` (127 occurrences) is a card
in some files and an input or a hover state in others. The codemod maps by **dominant
role** and records every occurrence it changed. Classes it cannot classify are **not
touched** — they are written to `/tmp/theme-migration/unmapped.tsv` with `file:line` for
hand review inside the per-directory streams (§9). The §8 contrast crawler is the net that
catches a wrong dominant-role call.

### 6.3 Codemod properties

- **Idempotent** — a second run changes nothing. Gate-tested on fixtures.
- **Allow-listed literals stay literal** — third-party brand colours must not be themed:
  PayPal `bg-[#0070ba]` and `bg-[#005ea6]`, Stripe surfaces in `StripeCreditCard.jsx:72`.
- **Reports** — before/after counts plus a CSV to `/tmp/theme-migration/`, per CLAUDE.md's
  backfill protocol. Git is the snapshot; the repo is clean before the run.

## 7. Runtime, transitions, accessibility

### 7.1 `src/utils/theme.js` (rewritten)

Currently this file exists only to assert dark-only and delete saved `light` preferences.
New surface:

| Export | Behaviour |
|---|---|
| `getStoredTheme()` | Validated read; ignores anything that is not `light`/`dark`. |
| `resolveInitialTheme()` | `stored ?? DEFAULT_THEME` (`light`). |
| `applyTheme(theme)` | Toggles `.dark` on `<html>`, sets `color-scheme`, updates `<meta name="theme-color">`, persists. |
| `initTheme()` | Called once from `main.jsx`. |
| `subscribeToThemeChanges(fn)` | `storage`-event listener, so two open tabs agree. |

Every storage access is `try`/`catch` — private mode and disabled storage must not throw.

### 7.2 No flash before first paint

`index.html` currently hardcodes `class="dark"`. Replace with a small inline script that
reads the stored preference and sets the class before paint, plus
`<meta name="color-scheme" content="light dark">`. This runs before the bundle, so there is
no flash and no dependence on React having mounted.

### 7.3 Context and toggle

`src/contexts/ThemeContext.jsx` provides `{ theme, setTheme, toggleTheme }`.

`src/components/common/ThemeToggle.jsx`, one component with two presentations:

- `variant="header"` — inline nav item, used by `Header.jsx`.
- `variant="floating"` — fixed control, mounted once in `App.jsx` **outside `<Routes>`** so
  it covers all 31 routes including the 14 with no Header (`/login`, `/register`, `/quote`,
  `/booking`, `/driver-dashboard`, `/pay/*`, `/admin*`, auth pages).

To avoid two toggles on header routes without hardcoding a route list that will drift:
**`Header` registers itself with `ThemeContext` on mount, and the floating variant hides
while a header toggle is registered.** Deterministic, and directly testable.

Icons come from `lucide-react` (already a dependency). Accessibility: `<button type="button">`,
dynamic `aria-label` ("Switch to dark mode" / "Switch to light mode"), `aria-pressed`
reflecting state, visible focus ring, keyboard-operable by default.

### 7.4 Transitions

`App.css:22` currently puts a 150ms transition on `*` for ten properties, so it fires on
every hover and focus, not just theme switches. Replace with: `applyTheme` adds a
`.theme-transition` class to `<html>` for ~200ms, and only that class carries a
colour/background/border transition. Result: the theme switch animates, ordinary
interaction does not. Gated on `prefers-reduced-motion: reduce`.

## 8. Tests and evals

### Gate lane — deterministic, local, free, <2s, every commit

| File | Asserts |
|---|---|
| `src/utils/theme.test.js` (rewrite) | Default is light; stored preference wins; invalid stored value falls back; `.dark` class and `color-scheme` applied; `theme-color` meta updated; disabled localStorage does not throw; cross-tab `storage` event applies; `applyTheme` idempotent. |
| `src/components/common/ThemeToggle.test.jsx` | Both variants render; click flips theme and persists; `aria-label`/`aria-pressed` correct in each state; Enter and Space operate it; focus ring present. |
| `src/contexts/ThemeContext.test.jsx` | Provider default; `toggleTheme` updates consumers; header registration suppresses the floating variant. |
| `src/styles/themeContrast.test.js` | **Accessibility as arithmetic.** Parses token values from `tokens.css`, converts oklch to sRGB, computes the WCAG contrast ratio for every foreground/background pair in **both** themes, asserts ≥4.5:1 for body text and ≥3:1 for large text and UI boundaries. Includes a unit test of the oklch→sRGB conversion against known values. |
| `src/styles/darkParity.test.js` | The §3 invariant: every `.dark` token equals the Tailwind palette entry it replaced. Compiles Tailwind to read the real values, so a Tailwind upgrade that shifts a colour fails here. |
| `scripts/migrate_theme_tokens.test.mjs` | Mapping table correctness on fixtures, the on-colour rule, variant and opacity preservation, allow-list, idempotency. |

`scripts/audit_theme.mjs` is rewritten to measure the **new** invariant — raw colour-utility
occurrences trending to zero outside the allow-list — and keeps exiting non-zero until it is
met, so the claim stays checkable exactly as the current version does. `audit:light` stays.

### Eval lane — slower, needs a browser, before ship and nightly

`evals/eval_theme_coverage.mjs`: drive all 31 routes in both themes, read **computed
styles**, and flag

- any text node whose computed colour/background pair falls below the AA threshold;
- any element with a dark background inside a light ancestor, or the reverse — a
  **structural mixed-theming detector**, which is what "no page left half-themed" actually
  requires.

This is deterministic despite being in the paid/slow lane, which is strictly better than an
LLM judge for a contrast question. A screenshot review of both themes per route is graded
through **local Claude Code** (never an external API, per CLAUDE.md) for the genuinely latent
question: does the page read as one coherent design.

Pass threshold: zero AA failures, zero mixed-ancestor findings.

## 9. Execution order

Foundation is serial, because everything else depends on it:

1. `tokens.css` + stylesheet consolidation (§4, §5) + `darkParity` and `themeContrast` tests
2. Theme runtime, context, no-flash boot (§7.1–7.2)
3. `ThemeToggle` + Header/floating wiring (§7.3) + transitions (§7.4)
4. Codemod + its tests (§6)

Then the migration **fans out** into independent streams by directory, per CLAUDE.md's
fan-out rule. Each is gated on its own audit run plus the full gate suite:

`business` (22 files) · `auth` (13) · `payments` (11) · `driver` (10) · `bookings` (5) ·
`common` (4) · `quote` (3) · `profile` (3) · `map` (3) · `landingPage` (2) · `contact` (2) ·
`admin` (2) · `about` (1) · `track` (1)

Plus one small **root stream**: colour utilities outside `components/` are confined to exactly
three files — `src/App.jsx` (the inline `AdminRedirect`, `bg-black text-white`),
`src/utils/bulkUploadValidation.js`, and `src/utils/theme.js` (rewritten in step 2 regardless).
Verified by grep across `utils`, `api`, `offline`, `hooks`, `contexts`, `lib`, `config`: the
other 38 non-component files carry none.

Streams touch disjoint file sets, so they do not collide. `common/` lands early because
`Header`/`Footer`/`LoadingSkeletons` are shared.

Finally: run the eval lane over all 31 routes, fix findings, ship.

## 10. Risks

| Risk | Mitigation |
|---|---|
| Tailwind stops emitting a palette var, silently breaking a token | Tokens carry literal values; `darkParity.test.js` fails on drift (§3) |
| Codemod picks the wrong semantic role for an ambiguous literal | Dominant-role mapping + unmapped report + contrast crawler as the net (§6.2) |
| A primary button label becomes illegible | On-colour rule (§6.1), covered by codemod tests |
| Third-party brand colours get themed | Explicit allow-list (§6.3) |
| Existing users surprised by a white site | Flagged and accepted (§2.1); one-line revert |
| Light "islands" that are already light by design (payment pages, driver modals — 13 files listed by `audit:light`) get double-inverted | These are migrated to tokens like everything else; `audit:light`'s island detection is retired once no file is intrinsically light |

## 11. Outcome measures

| Measure | Now | Target |
|---|---|---|
| `audit:theme` raw dark-only occurrences | 1697 | 0 outside allow-list |
| Files that render correctly in both themes | 0 of 73 | 123 of 123 |
| Routes with a reachable toggle | 0 of 31 | 31 of 31 |
| AA contrast failures, both themes, all routes | unmeasured | 0 |
| Mixed-theming structural findings | 36 files half-flip | 0 |
