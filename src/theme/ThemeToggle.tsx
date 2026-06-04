import { useTheme } from "./use-theme";

/**
 * A button in the topbar that toggles between dark and light themes.
 * Persists the choice via a cookie so SSR and the no-flash script
 * can pick it up on subsequent requests.
 */
export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const isDark = theme === "dark";

  return (
    <button
      aria-label={isDark ? "Switch to light theme" : "Switch to dark theme"}
      aria-pressed={isDark}
      className="theme-toggle"
      onClick={() => setTheme(isDark ? "light" : "dark")}
      title={isDark ? "Light mode" : "Dark mode"}
      type="button"
    >
      {isDark ? "☀" : "☽"}
    </button>
  );
}
