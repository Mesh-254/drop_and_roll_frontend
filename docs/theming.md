# Theming

The app has two themes. Both come from one file, and a component never names a
colour.

## The one rule

**Name a role, not a colour.**

```jsx
// NO — renders identically in both themes, so it strands on one of them
<div className="bg-gray-900 text-white border-gray-800">

// YES
<div className="bg-card text-card-foreground border-border">
```

`bg-gray-900` is a fact about a colour. `bg-card` is a statement about what the
element *is*, and `src/styles/tokens.css` decides what that means in each theme.
There is no second place to forget, which is what makes a half-themed component
impossible rather than merely unlikely.

`npm run audit:theme` fails if any file breaks this, and so does the gate suite
(`src/styles/noRawColors.test.js`), so a regression is caught on commit rather
than by a user on the one page nobody re-checked.

## The tokens

| Role | Use it for |
|---|---|
| `background` / `foreground` | The page itself, and body text on it |
| `card` / `card-foreground` | A raised container and its text |
| `popover` / `popover-foreground` | Menus, dropdowns, dialog panels |
| `surface` / `surface-hover` | A panel inside a card; its hover state |
| `muted` | A quiet fill — table stripes, disabled fields |
| `muted-foreground` | Secondary text |
| `subtle-foreground` | Tertiary text: hints, timestamps, captions |
| `border` / `border-strong` | A resting divider; an emphasised one |
| `input` | A form field's background |
| `ring` | Focus indicators |
| `overlay` | Modal scrims. Dark in BOTH themes, by design |
| `primary` / `primary-hover` | Brand fills: buttons, active states |
| `primary-foreground` | Text or icons sitting ON `primary` |
| `brand-text` | The brand colour used AS text |
| `destructive` / `success` / `warning` / `info` | State colours |
| `*-foreground` | Text on that state's fill |
| `*-surface` | A tinted background for that state |

Every one accepts an opacity modifier: `bg-primary/30`, `border-destructive/30`.

### Two distinctions that matter

**`primary` vs `brand-text`.** `primary` is a *surface* — the orange you put
behind something. `brand-text` is the brand used *as* text. They differ because
orange-500 as text on white measures 2.89:1 and fails AA, so `brand-text`
resolves to a darker orange (5.23:1) in light mode. Use `bg-primary` for a
button; use `text-brand-text` for a coloured heading.

**`*-foreground` is theme-invariant.** `text-primary-foreground` is the same
near-black in both themes, because it sits on orange, and orange is the same in
both themes. This is what stops a button label inverting into illegibility. If
your text sits on a coloured fill, reach for the fill's `-foreground`.

## Adding a token

1. Add it to `:root` **and** `.dark` in `src/styles/tokens.css`.
2. Add the same two values to `LIGHT_TOKENS` and `DARK_TOKENS` in
   `src/styles/tokens.js`. `tokensParity.test.js` fails if these drift, so do
   both or neither.
3. Expose it to Tailwind in the `@theme inline` block:
   `--color-my-token: var(--my-token);`. Without this the utility does not exist
   and the build fails with "Cannot apply unknown utility class".
4. Add a row to `CONTRAST_PAIRS` naming what it sits on and the minimum ratio
   (4.5 for text, 3 for focus indicators). This is not optional: it is how the
   token's accessibility gets proven rather than assumed.
5. `npx jest src/styles/`

Values are literal `oklch(...)` copied from Tailwind's palette, **never**
`var(--color-gray-900)`. Tailwind v4 only emits a palette variable when some
utility uses it, so a `var()` reference silently resolves to nothing once the
last user of that palette entry is migrated away.

## You almost never need `dark:`

A token already knows what to be in each theme, so `bg-card dark:bg-gray-800` is
a token plus a bug. The codebase carried 1160 `dark:` utilities written as
hand-picked pairs, and the migration collapsed nearly all of them.

`dark:` is still right when you want a genuinely *different role* per theme —
`bg-card dark:bg-surface` — which is rare enough to be worth a comment.

## Deliberate exceptions

Some colours stay literal, and each is listed in `ALLOW_LIST` in
`scripts/migrate_theme_tokens.mjs` with its reason:

- **Third-party brand colours.** PayPal's `bg-[#0070ba]` is a brand requirement.
  Text on such a background also stays literal — no token is correct on a colour
  the theme does not control.
- **Decorative shadows.** Black at 40–50% reads correctly on either ground.
- **Category colours.** The purple service-type chips specify their own
  foreground and background together, so they stay legible on either theme, and
  purple carries no role in this system.
- **Multi-hue decorative gradients.** `from-blue-500 to-cyan-500` on a service
  card: the two hues *are* the illustration. Detected structurally, not listed —
  a gradient is decorative when its stops come from different colour families,
  which is what separates it from the brand gradient
  (`from-orange-500 to-orange-600`).

If you need a new exception, add it to `ALLOW_LIST` with a comment. An exception
that is written down is a decision; one that merely passes is a leak.

## The theme at runtime

`src/utils/theme.js` owns it. Default **light**, stored in `localStorage` under
`"theme"`, and `prefers-color-scheme` is deliberately never read — the app owns
the preference, so there is one source of truth rather than two.

`index.html` sets the class before first paint, so a dark-preferring visitor
never sees a white flash. Read or change the theme from a component with
`useTheme()` (`src/contexts/ThemeContext.jsx`); never touch the class yourself.

The toggle is `ThemeToggle`, in two variants. `Header` renders the inline one and
registers itself with the context; `App` mounts the floating one outside
`<Routes>`, and it hides while a header toggle is registered. That handshake —
not a list of routes — is what makes the control reachable everywhere without
appearing twice.

Only theme switches animate: `applyTheme` adds `.theme-transition` to `<html>`
for 200ms. Do not reintroduce a global `* { transition: ... }`; that made every
hover animate.

## Checking your work

```bash
npx jest src/styles/     # tokens, contrast, parity, no raw colours
npm run audit:theme      # exits non-zero while any file names a colour
npm run dev              # then, in another shell:
npm run eval:theme       # every route in both themes, in real Chrome
```

The eval is the one that catches what the others cannot: a dark card nested in a
light page is a DOM fact, not a palette fact. It reports text below AA and
surfaces whose lightness is on the wrong side of the theme they render in.

## Where dark mode changed

Dark mode was migrated so that its rendered pixels do not change: each `.dark`
token equals the literal it replaced, asserted by `darkParity.test.js`. Three
exceptions, all measured, all toward legibility, recorded in
`PARITY_EXCEPTIONS`:

| Was | Measured | Now |
|---|---|---|
| `text-gray-500` / `text-slate-500` (122 uses) | 2.14–4.34:1 | `subtle-foreground` = gray-400 → 5.64–8.07:1 |
| `text-red-500` on dark surfaces (52 uses) | 2.71–3.84:1 | `destructive` = red-400 → 5.08–7.26:1 |
| `text-white` on `bg-orange-*` (61 uses, both themes) | 2.89:1 | `primary-foreground` = gray-900 → 6.14:1 |

The last one is why primary buttons now carry near-black labels. The brand orange
is untouched.
