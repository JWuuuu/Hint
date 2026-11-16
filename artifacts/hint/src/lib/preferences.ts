import { useSyncExternalStore } from "react";
import {
  HINT_THEME_STORAGE_KEY,
  saveHintTheme,
  type HintTheme,
} from "../components/app/theme";

export const HINT_PREFERENCES_STORAGE_KEY = "hint.preferences.v1";
export const HINT_PREFERENCES_UPDATED_EVENT = "hint:preferences-updated";

export type HintPreferences = {
  reduceMotion: boolean;
  soundAndHaptics: boolean;
};

const DEFAULT_PREFERENCES: HintPreferences = {
  reduceMotion: false,
  soundAndHaptics: true,
};
let sessionPreferences = DEFAULT_PREFERENCES;
let unsavedPreferences = false;

export type HintPreferencePersistence = {
  preferences: "idle" | "saved" | "unsaved";
  theme: "idle" | "saved" | "unsaved";
  pendingTheme: HintTheme | null;
};

let persistence: HintPreferencePersistence = { preferences: "idle", theme: "idle", pendingTheme: null };

export function getHintPreferencePersistence(): HintPreferencePersistence {
  return persistence;
}

function notifyPreferences() {
  if (typeof window !== "undefined") window.dispatchEvent(new Event(HINT_PREFERENCES_UPDATED_EVENT));
}

function canUseStorage() {
  try { return typeof window !== "undefined" && typeof window.localStorage !== "undefined"; }
  catch { return false; }
}

export function getHintPreferences(): HintPreferences {
  if (unsavedPreferences || !canUseStorage()) return sessionPreferences;

  try {
    const raw = window.localStorage.getItem(HINT_PREFERENCES_STORAGE_KEY);
    if (!raw) return sessionPreferences = DEFAULT_PREFERENCES;
    const parsed = JSON.parse(raw) as Partial<HintPreferences>;
    const next = {
      reduceMotion: Boolean(parsed.reduceMotion),
      soundAndHaptics:
        typeof parsed.soundAndHaptics === "boolean"
          ? parsed.soundAndHaptics
          : DEFAULT_PREFERENCES.soundAndHaptics,
    };
    // Stable identity lets every hook consumer read the same external snapshot.
    if (next.reduceMotion !== sessionPreferences.reduceMotion || next.soundAndHaptics !== sessionPreferences.soundAndHaptics) sessionPreferences = next;
    return sessionPreferences;
  } catch {
    return sessionPreferences;
  }
}

export function saveHintPreferences(next: HintPreferences): HintPreferences {
  sessionPreferences = { ...next };
  unsavedPreferences = true;
  try {
    if (canUseStorage()) {
      window.localStorage.setItem(HINT_PREFERENCES_STORAGE_KEY, JSON.stringify(next));
      unsavedPreferences = false;
    }
  } catch {
    // Keep the user's immediate choice for this session, including feedback off.
  }
  persistence = { ...persistence, preferences: unsavedPreferences ? "unsaved" : "saved" };
  notifyPreferences();

  return next;
}

export function setHintPreference<K extends keyof HintPreferences>(
  key: K,
  value: HintPreferences[K],
): HintPreferences {
  return saveHintPreferences({
    ...getHintPreferences(),
    [key]: value,
  });
}

/** Existing callers may ignore the additive result; failure never applies the theme. */
export function setHintThemePreference(theme: HintTheme): { saved: boolean; theme: HintTheme } {
  const saved = saveHintTheme(theme);
  persistence = { ...persistence, theme: saved ? "saved" : "unsaved", pendingTheme: saved ? null : theme };
  notifyPreferences();
  return { saved, theme };
}

/** Retry only on an explicit request, using the latest session choices. */
export function retryHintPreferences(): { saved: boolean; preferences: HintPreferences } {
  const preferences = unsavedPreferences ? saveHintPreferences(sessionPreferences) : getHintPreferences();
  return { saved: !unsavedPreferences, preferences };
}

export function retryHintThemePreference() {
  if (persistence.pendingTheme !== null) return setHintThemePreference(persistence.pendingTheme);
  return undefined;
}

function subscribePreferences(listener: () => void) {
  const storage = (event: StorageEvent) => {
    if (event.key !== null && event.key !== HINT_PREFERENCES_STORAGE_KEY && event.key !== HINT_THEME_STORAGE_KEY) return;
    if (event.key === null || event.key === HINT_THEME_STORAGE_KEY) {
      // A deliberate appearance change in another tab supersedes an old retry.
      persistence = { ...persistence, theme: "idle", pendingTheme: null };
    }
    if (!unsavedPreferences && (event.key === null || event.key === HINT_PREFERENCES_STORAGE_KEY)) {
      // Another tab may have removed the value; do not retain our old save receipt.
      persistence = { ...persistence, preferences: "idle" };
    }
    listener();
  };
  window.addEventListener(HINT_PREFERENCES_UPDATED_EVENT, listener);
  window.addEventListener("storage", storage);
  return () => {
    window.removeEventListener(HINT_PREFERENCES_UPDATED_EVENT, listener);
    window.removeEventListener("storage", storage);
  };
}

let snapshot = { preferences: DEFAULT_PREFERENCES, persistence };
const serverSnapshot = snapshot;
function getSnapshot() {
  const preferences = getHintPreferences();
  if (snapshot.preferences !== preferences || snapshot.persistence !== persistence) snapshot = { preferences, persistence };
  return snapshot;
}

export function useHintPreferences() {
  const state = useSyncExternalStore(subscribePreferences, getSnapshot, () => serverSnapshot);
  return {
    ...state,
    setPreference: setHintPreference,
    retryPreferences: retryHintPreferences,
    retryTheme: retryHintThemePreference,
  };
}
