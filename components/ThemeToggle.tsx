"use client";

import { useEffect, useState } from "react";

type Theme = "light" | "dark";
const THEME_KEY = "illimani-theme";
const THEME_EVENT = "illimani-theme-change";

function applyTheme(theme: Theme) {
  document.documentElement.dataset.theme = theme;
}

export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>("light");

  useEffect(() => {
    let saved: string | null = null;
    try {
      saved = localStorage.getItem(THEME_KEY);
    } catch {
      saved = null;
    }
    const initial: Theme = saved === "dark" ? "dark" : "light";
    setTheme(initial);
    applyTheme(initial);

    const syncTheme = (event: Event) => {
      const next = (event as CustomEvent<Theme>).detail;
      if (next !== "light" && next !== "dark") return;
      setTheme(next);
      applyTheme(next);
    };
    window.addEventListener(THEME_EVENT, syncTheme);
    return () => window.removeEventListener(THEME_EVENT, syncTheme);
  }, []);

  function toggleTheme() {
    const next: Theme = theme === "dark" ? "light" : "dark";
    setTheme(next);
    applyTheme(next);
    try {
      localStorage.setItem(THEME_KEY, next);
    } catch {
      // The selected theme remains active for the current page.
    }
    window.dispatchEvent(new CustomEvent(THEME_EVENT, { detail: next }));
  }

  const label = theme === "dark" ? "Modo claro" : "Modo oscuro";

  return (
    <button className="theme-toggle" type="button" onClick={toggleTheme} aria-label={label} aria-pressed={theme === "dark"} title={label}>
      {theme === "dark" ? (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2m0 16v2M4.93 4.93l1.42 1.42m11.3 11.3 1.42 1.42M2 12h2m16 0h2M4.93 19.07l1.42-1.42m11.3-11.3 1.42-1.42" />
        </svg>
      ) : (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M20.2 15.1A8.4 8.4 0 0 1 8.9 3.8 8.5 8.5 0 1 0 20.2 15.1Z" />
        </svg>
      )}
      <span>{label}</span>
    </button>
  );
}
