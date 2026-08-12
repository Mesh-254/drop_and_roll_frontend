/**
 * utils/theme.js
 * ══════════════════════════════════════════════════════════════════════════════
 * This app is dark. There is no second theme, and this function is what makes
 * that true at runtime rather than by hope.
 *
 * ── The measurement ──────────────────────────────────────────────────────────
 * `node scripts/audit_theme.mjs` counts, per file, dark-surface utilities with
 * no `dark:` sibling. The answer today:
 *
 *     files that flip cleanly (dark: only) : 0   ← of 72
 *     MIXED files (half-flip in light mode): 34
 *     dark-only utility occurrences        : 1700
 *
 * NOT ONE file flips cleanly, and `body` is unconditionally
 * `bg-black text-white`. So removing the `.dark` class does not produce a light
 * app. It produces a screen half in each theme: white cards with dark text
 * sitting on a black page, beside neighbours that stayed dark.
 *
 * ── Why this only became a problem recently ──────────────────────────────────
 * Tailwind v4 resolves `dark:` from `prefers-color-scheme` unless configured
 * otherwise, and this project never configured it. So ProfilePage's light/dark
 * button wrote a `.dark` class that nothing read: the toggle was inert, and its
 * inertness was the only thing protecting the app from it. Pinning `dark:` to
 * that class (index.css) fixed 42 miscoloured elements in the bulk wizard and,
 * in the same stroke, armed the button.
 *
 * The button is now gone. This function exists for the users who already
 * pressed it: `theme: "light"` is sitting in their localStorage, and on their
 * next visit ProfilePage would no longer be there to re-apply it — but nothing
 * would clear it either, and a future reader of that key would resurrect the
 * broken state. It is removed at boot, once, and `.dark` is re-asserted.
 *
 * ── If a real light mode is ever wanted ──────────────────────────────────────
 * It is 72 files of pairing plus a theme-aware `body`, not a toggle. Make
 * `scripts/audit_theme.mjs` report a non-zero "flips cleanly" count first; it
 * exits non-zero until then, so it can gate the work.
 */

const STORAGE_KEY = "theme";

/**
 * Assert the app's only theme, and clear any stale preference for the one that
 * does not exist. Safe to call more than once; safe with no DOM (SSR/tests).
 *
 * @returns {boolean} true if a stale "light" preference was found and cleared.
 */
export function applyAppTheme() {
  if (typeof document === "undefined") return false;

  let repaired = false;
  try {
    if (window.localStorage?.getItem(STORAGE_KEY) === "light") {
      window.localStorage.removeItem(STORAGE_KEY);
      repaired = true;
    }
  } catch {
    // Private mode / storage disabled. The class below is what actually
    // matters; a stale key we cannot read cannot hurt us either.
  }

  // index.html ships `class="dark"` so there is no flash before this runs.
  // Re-asserted here because that is a static file and this is the invariant.
  document.documentElement.classList.add("dark");
  return repaired;
}
