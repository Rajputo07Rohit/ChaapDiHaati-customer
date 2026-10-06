import { createContext, ReactNode, useContext, useEffect, useState } from "react";

export type ThemePreference = "system" | "light" | "dark";

const STORAGE_KEY = "cdh_theme";

interface ThemeContextValue {
  theme: ThemePreference;
  setTheme: (theme: ThemePreference) => void;
  /** The actually-rendered light/dark state, with "system" already resolved — what a toggle button should read/flip. */
  isDark: boolean;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

function resolveIsDark(theme: ThemePreference): boolean {
  if (theme === "dark") return true;
  if (theme === "light") return false;
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

function applyTheme(theme: ThemePreference) {
  document.documentElement.classList.toggle("dark", resolveIsDark(theme));
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<ThemePreference>(() => {
    try {
      return (localStorage.getItem(STORAGE_KEY) as ThemePreference) || "system";
    } catch {
      return "system";
    }
  });

  const [isDark, setIsDark] = useState(() => resolveIsDark(theme));

  useEffect(() => {
    applyTheme(theme);
    setIsDark(resolveIsDark(theme));
    if (theme !== "system") return;
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => {
      applyTheme("system");
      setIsDark(resolveIsDark("system"));
    };
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, [theme]);

  function setTheme(next: ThemePreference) {
    setThemeState(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // Per-viewer convenience only — theme still applies for this session without persistence.
    }
  }

  return <ThemeContext.Provider value={{ theme, setTheme, isDark }}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
  return ctx;
}
