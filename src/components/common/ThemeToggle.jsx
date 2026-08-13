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
      className={`${BASE_CLASSES} ${
        VARIANT_CLASSES[variant] ?? VARIANT_CLASSES.header
      } ${className}`}
    >
      <Icon size={variant === "floating" ? 20 : 18} aria-hidden="true" />
    </button>
  );
}
