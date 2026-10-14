import { useState, useEffect, useCallback } from "react";

const STORAGE_KEY = "mi_advantage_theme";
const CHANGE_EVENT = "mi-theme-change";

export type Theme = "light" | "dark";

function storedTheme(): Theme | null {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === "light" || saved === "dark") return saved;
  } catch {
    /* storage unavailable */
  }
  return null;
}

export function getInitialTheme(): Theme {
  const saved = storedTheme();
  if (saved) return saved;
  if (
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-color-scheme: dark)").matches
  ) {
    return "dark";
  }
  return "light";
}

export function currentTheme(): Theme {
  if (
    typeof document !== "undefined" &&
    document.documentElement.classList.contains("dark")
  ) {
    return "dark";
  }
  return "light";
}

export function applyTheme(theme: Theme) {
  if (typeof document !== "undefined") {
    document.documentElement.classList.toggle("dark", theme === "dark");
  }
  try {
    localStorage.setItem(STORAGE_KEY, theme);
  } catch {
    /* storage unavailable */
  }
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(CHANGE_EVENT));
  }
}

// Reactive theme state, synced across every toggle button in the app.
export function useTheme() {
  const [theme, setTheme] = useState<Theme>(() => currentTheme());
  useEffect(() => {
    const onChange = () => setTheme(currentTheme());
    window.addEventListener(CHANGE_EVENT, onChange);
    return () => window.removeEventListener(CHANGE_EVENT, onChange);
  }, []);
  const toggle = useCallback(() => {
    applyTheme(currentTheme() === "dark" ? "light" : "dark");
  }, []);
  return { theme, toggle };
}
