import React from "react";
import { useTheme } from "../lib/theme";
import { Sun, Moon } from "./AdminIcons";

// Theme toggle button. `variant` adapts it to light nav bars vs dark headers.
export default function ThemeToggle({
  variant = "light",
  title = "Toggle dark theme",
}: {
  variant?: "light" | "sidebar";
  title?: string;
}) {
  const { theme, toggle } = useTheme();
  const isDark = theme === "dark";
  return (
    <button
      type="button"
      onClick={toggle}
      title={title}
      aria-label={title}
      className={
        variant === "sidebar"
          ? "p-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl transition-all cursor-pointer"
          : "p-2 bg-white hover:bg-slate-100 dark:bg-slate-800 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-amber-300 rounded-xl transition-all cursor-pointer"
      }
    >
      {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
    </button>
  );
}
