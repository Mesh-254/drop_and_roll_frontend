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
