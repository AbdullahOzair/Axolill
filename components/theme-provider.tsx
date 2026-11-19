"use client";

import * as React from "react";

type Theme = "light" | "dark" | "system";

type ThemeContextValue = {
  theme: Theme;
  resolvedTheme: "light" | "dark";
  setTheme: (theme: Theme) => void;
};

const ThemeContext = React.createContext<ThemeContextValue | null>(null);

const THEME_SCRIPT = `(() => {
  const root = document.documentElement;
  let theme = "system";
  try { theme = localStorage.getItem("theme") || theme; } catch {}
  const resolved = theme === "system"
    ? (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light")
    : theme;
  root.classList.remove("light", "dark");
  root.classList.add(resolved);
  root.style.colorScheme = resolved;
})();`;

export function ThemeProvider({
  children,
  defaultTheme = "system",
  enableSystem = true,
}: {
  children: React.ReactNode;
  defaultTheme?: Theme;
  enableSystem?: boolean;
}) {
  const [theme, setThemeState] = React.useState<Theme>(defaultTheme);
  const [resolvedTheme, setResolvedTheme] = React.useState<"light" | "dark">(
    "light"
  );

  React.useEffect(() => {
    const stored = window.localStorage.getItem("theme") as Theme | null;
    const nextTheme = stored ?? defaultTheme;

    const resolve = (value: Theme) =>
      value === "system" && enableSystem
        ? window.matchMedia("(prefers-color-scheme: dark)").matches
          ? "dark"
          : "light"
        : value === "dark"
          ? "dark"
          : "light";

    const apply = (value: Theme) => {
      const nextResolved = resolve(value);
      document.documentElement.classList.remove("light", "dark");
      document.documentElement.classList.add(nextResolved);
      document.documentElement.style.colorScheme = nextResolved;
      setResolvedTheme(nextResolved);
    };

    setThemeState(nextTheme);
    apply(nextTheme);

    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => {
      if (nextTheme === "system" && enableSystem) apply("system");
    };
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, [defaultTheme, enableSystem]);

  const setTheme = (nextTheme: Theme) => {
    window.localStorage.setItem("theme", nextTheme);
    setThemeState(nextTheme);
    const nextResolved =
      nextTheme === "system" && enableSystem
        ? window.matchMedia("(prefers-color-scheme: dark)").matches
          ? "dark"
          : "light"
        : nextTheme === "dark"
          ? "dark"
          : "light";
    document.documentElement.classList.remove("light", "dark");
    document.documentElement.classList.add(nextResolved);
    document.documentElement.style.colorScheme = nextResolved;
    setResolvedTheme(nextResolved);
  };

  return (
    <ThemeContext.Provider value={{ theme, resolvedTheme, setTheme }}>
      <script
        suppressHydrationWarning
        dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }}
      />
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = React.useContext(ThemeContext);
  if (!context) throw new Error("useTheme must be used inside ThemeProvider");
  return context;
}
