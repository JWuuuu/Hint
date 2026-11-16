/** @vitest-environment jsdom */
import { afterEach, beforeEach, expect, it, vi } from "vitest";

beforeEach(() => { vi.resetModules(); localStorage.clear(); });
afterEach(() => { vi.restoreAllMocks(); });

it("keeps feedback off for the current session when storage writes fail", async () => {
  const preferences = await import("./preferences");
  const updated = vi.fn();
  window.addEventListener(preferences.HINT_PREFERENCES_UPDATED_EVENT, updated);
  vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new DOMException("Full", "QuotaExceededError"); });
  preferences.setHintPreference("soundAndHaptics", false);
  expect(preferences.getHintPreferences().soundAndHaptics).toBe(false);
  preferences.setHintPreference("reduceMotion", true);
  expect(preferences.getHintPreferences()).toEqual({ soundAndHaptics: false, reduceMotion: true });
  expect(updated).toHaveBeenCalledTimes(2);
  window.removeEventListener(preferences.HINT_PREFERENCES_UPDATED_EVENT, updated);
});

it("handles blocked access to the storage object while retaining session preferences", async () => {
  const preferences = await import("./preferences");
  vi.spyOn(window, "localStorage", "get").mockImplementation(() => { throw new DOMException("Blocked", "SecurityError"); });
  expect(() => preferences.setHintPreference("soundAndHaptics", false)).not.toThrow();
  expect(preferences.getHintPreferences().soundAndHaptics).toBe(false);
  expect(() => preferences.setHintThemePreference("bright")).not.toThrow();
});
