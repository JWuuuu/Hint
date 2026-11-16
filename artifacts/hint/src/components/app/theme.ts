export type HintTheme = "dark" | "bright";

export const HINT_THEME_STORAGE_KEY = "hint-theme";

/** Browser-chrome colours (Safari bars, overscroll). Match the shell's base in constellation-backdrop.css. */
export const HINT_THEME_BAR_COLORS = { dark: "#2e253c", bright: "#fcfaf6" } as const;

let sessionTheme: HintTheme = "dark";

export function getInitialHintTheme(): HintTheme {
  if (typeof window === "undefined") return "dark";

  try {
    return sessionTheme = window.localStorage.getItem(HINT_THEME_STORAGE_KEY) === "bright"
      ? "bright"
      : "dark";
  } catch {
    // A later storage denial must not change the already displayed appearance.
    return sessionTheme;
  }
}

/** Apply a theme only after its durable write succeeds. */
export function saveHintTheme(theme: HintTheme): boolean {
  try {
    if (typeof window === "undefined") return false;
    window.localStorage.setItem(HINT_THEME_STORAGE_KEY, theme);
    sessionTheme = theme;
    return true;
  } catch {
    return false;
  }
}

