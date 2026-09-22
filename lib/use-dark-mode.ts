"use client";

import { useEffect, useState } from "react";

// Recharts renders raw SVG with hardcoded stroke/fill colors passed as
// props — those can't pick up Tailwind's `dark:` variant, so chart code
// needs to know the live theme to choose a legible color pair itself.
// ThemeToggle just flips a class on <html>; this watches for that instead
// of needing a shared context.
export function useIsDarkMode(): boolean {
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    const root = document.documentElement;
    setIsDark(root.classList.contains("dark"));

    const observer = new MutationObserver(() => {
      setIsDark(root.classList.contains("dark"));
    });
    observer.observe(root, { attributes: true, attributeFilter: ["class"] });
    return () => observer.disconnect();
  }, []);

  return isDark;
}
