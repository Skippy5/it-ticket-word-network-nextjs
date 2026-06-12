"use client";

/** Light/dark theme state, synced with the `dark` class on <html>. */
import { create } from "zustand";

export type Theme = "light" | "dark";

interface ThemeState {
  theme: Theme;
  setTheme(theme: Theme): void;
  toggle(): void;
}

export const useThemeStore = create<ThemeState>((set, get) => ({
  theme: "light",
  setTheme: (theme) => {
    if (typeof document !== "undefined") {
      document.documentElement.classList.toggle("dark", theme === "dark");
      try {
        localStorage.setItem("theme", theme);
      } catch {
        /* private mode etc. */
      }
    }
    set({ theme });
  },
  toggle: () => get().setTheme(get().theme === "dark" ? "light" : "dark"),
}));

/** Read the class the bootstrap script applied (call once on mount). */
export function syncThemeFromDocument(): void {
  if (typeof document === "undefined") return;
  const dark = document.documentElement.classList.contains("dark");
  useThemeStore.setState({ theme: dark ? "dark" : "light" });
}
