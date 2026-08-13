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
