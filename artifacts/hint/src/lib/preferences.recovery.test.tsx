// @vitest-environment jsdom
import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

beforeEach(() => { vi.resetModules(); localStorage.clear(); });
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });
const blocked = () => { throw new DOMException("Synthetic denial", "QuotaExceededError"); };

it("keeps the existing values-only setter contracts and reports persistence separately", async () => {
  const p = await import("./preferences");
  const next = { soundAndHaptics: false, reduceMotion: true };
  expect(p.saveHintPreferences(next)).toEqual(next);
  expect(p.setHintPreference("reduceMotion", false)).toEqual({ soundAndHaptics: false, reduceMotion: false });
  expect(p.getHintPreferencePersistence()).toEqual({ preferences: "saved", theme: "idle", pendingTheme: null });
});

it("retries only explicitly, saves the latest rapid choices and preserves a separate theme failure", async () => {
  const p = await import("./preferences");
  const write = vi.spyOn(Storage.prototype, "setItem").mockImplementation(blocked);
  p.setHintThemePreference("bright");
  p.setHintPreference("soundAndHaptics", false);
  p.setHintPreference("reduceMotion", true);
  p.setHintPreference("soundAndHaptics", true);
  p.setHintPreference("soundAndHaptics", false);
  expect(write).toHaveBeenCalledTimes(5);
  p.getHintPreferences(); p.getHintPreferencePersistence();
  expect(write).toHaveBeenCalledTimes(5);
  expect(p.retryHintPreferences().saved).toBe(false);
  expect(write).toHaveBeenCalledTimes(6);
  write.mockRestore();
  const successfulWrite = vi.spyOn(Storage.prototype, "setItem");
  expect(p.retryHintPreferences()).toEqual({ saved: true, preferences: { reduceMotion: true, soundAndHaptics: false } });
  expect(JSON.parse(localStorage.getItem(p.HINT_PREFERENCES_STORAGE_KEY)!)).toEqual({ reduceMotion: true, soundAndHaptics: false });
  expect(p.getHintPreferencePersistence()).toEqual({ preferences: "saved", theme: "unsaved", pendingTheme: "bright" });
  p.retryHintPreferences();
  expect(successfulWrite).toHaveBeenCalledTimes(1);
});

it("does not change a known bright theme when the storage getter becomes blocked", async () => {
  const p = await import("./preferences");
  const theme = await import("../components/app/theme");
  p.setHintThemePreference("bright");
  expect(theme.getInitialHintTheme()).toBe("bright");
  const getter = vi.spyOn(window, "localStorage", "get").mockImplementation(blocked);
  expect(p.setHintThemePreference("dark")).toEqual({ saved: false, theme: "dark" });
  p.setHintPreference("soundAndHaptics", false);
  p.setHintPreference("reduceMotion", true);
  expect(theme.getInitialHintTheme()).toBe("bright");
  expect(p.getHintPreferences()).toEqual({ reduceMotion: true, soundAndHaptics: false });
  expect(p.getHintPreferencePersistence().preferences).toBe("unsaved");
  getter.mockRestore();
  expect(p.retryHintThemePreference()?.saved).toBe(true);
  expect(theme.getInitialHintTheme()).toBe("dark");
  expect(p.getHintPreferencePersistence().preferences).toBe("unsaved");
  expect(p.retryHintPreferences().saved).toBe(true);
});

it("retains session choices with unreadable storage and can apply a successfully written theme", async () => {
  const p = await import("./preferences");
  const theme = await import("../components/app/theme");
  p.saveHintPreferences({ reduceMotion: true, soundAndHaptics: false });
  vi.spyOn(Storage.prototype, "getItem").mockImplementation(blocked);
  expect(p.getHintPreferences()).toEqual({ reduceMotion: true, soundAndHaptics: false });
  expect(p.setHintThemePreference("bright").saved).toBe(true);
  expect(theme.getInitialHintTheme()).toBe("bright");
});

it("synchronizes values and outcomes across consumers, including a later mount and recovery", async () => {
  const p = await import("./preferences");
  const a = renderHook(p.useHintPreferences), b = renderHook(p.useHintPreferences);
  const write = vi.spyOn(Storage.prototype, "setItem").mockImplementation(blocked);
  act(() => a.result.current.setPreference("soundAndHaptics", false));
  expect(b.result.current.preferences.soundAndHaptics).toBe(false);
  expect(b.result.current.persistence.preferences).toBe("unsaved");
  a.unmount();
  const c = renderHook(p.useHintPreferences);
  expect(c.result.current.persistence.preferences).toBe("unsaved");
  write.mockRestore();
  act(() => c.result.current.retryPreferences());
  expect(b.result.current.persistence.preferences).toBe("saved");
  expect(b.result.current.preferences.soundAndHaptics).toBe(false);
});

it("accepts durable cross-tab updates but never overwrites an unsaved local disable", async () => {
  const p = await import("./preferences");
  const hook = renderHook(p.useHintPreferences);
  act(() => {
    localStorage.setItem(p.HINT_PREFERENCES_STORAGE_KEY, JSON.stringify({ reduceMotion: true, soundAndHaptics: true }));
    window.dispatchEvent(new StorageEvent("storage", { key: p.HINT_PREFERENCES_STORAGE_KEY }));
  });
  expect(hook.result.current.preferences.reduceMotion).toBe(true);
  const write = vi.spyOn(Storage.prototype, "setItem").mockImplementation(blocked);
  act(() => hook.result.current.setPreference("soundAndHaptics", false));
  write.mockRestore();
  act(() => {
    localStorage.setItem(p.HINT_PREFERENCES_STORAGE_KEY, JSON.stringify({ reduceMotion: false, soundAndHaptics: true }));
    window.dispatchEvent(new StorageEvent("storage", { key: p.HINT_PREFERENCES_STORAGE_KEY }));
  });
  expect(hook.result.current.preferences).toEqual({ reduceMotion: true, soundAndHaptics: false });
  expect(hook.result.current.persistence.preferences).toBe("unsaved");
});

it("does not replay superseded theme choices or discard preference failure on theme success", async () => {
  const p = await import("./preferences");
  const write = vi.spyOn(Storage.prototype, "setItem").mockImplementation(blocked);
  p.setHintPreference("soundAndHaptics", false);
  p.setHintThemePreference("bright"); p.setHintThemePreference("dark"); p.setHintThemePreference("bright");
  write.mockRestore();
  expect(p.retryHintThemePreference()).toEqual({ saved: true, theme: "bright" });
  expect(p.getHintPreferencePersistence()).toEqual({ preferences: "unsaved", theme: "saved", pendingTheme: null });
  const saved = vi.spyOn(Storage.prototype, "setItem");
  expect(p.retryHintThemePreference()).toBeUndefined();
  expect(saved).not.toHaveBeenCalled();
});

it("clears an obsolete theme retry when another tab deliberately changes appearance", async () => {
  const p = await import("./preferences");
  const hook = renderHook(p.useHintPreferences);
  const write = vi.spyOn(Storage.prototype, "setItem").mockImplementation(blocked);
  act(() => p.setHintThemePreference("bright"));
  write.mockRestore();
  act(() => window.dispatchEvent(new StorageEvent("storage", { key: "hint-theme", newValue: "dark" })));
  expect(hook.result.current.persistence).toEqual({ preferences: "idle", theme: "idle", pendingTheme: null });
  const saved = vi.spyOn(Storage.prototype, "setItem");
  p.retryHintThemePreference();
  expect(saved).not.toHaveBeenCalled();
});

it("clears a stale save message when another tab removes the saved preferences", async () => {
  const p = await import("./preferences");
  const hook = renderHook(p.useHintPreferences);
  act(() => p.setHintPreference("soundAndHaptics", false));
  expect(hook.result.current.persistence.preferences).toBe("saved");
  act(() => {
    localStorage.removeItem(p.HINT_PREFERENCES_STORAGE_KEY);
    window.dispatchEvent(new StorageEvent("storage", { key: p.HINT_PREFERENCES_STORAGE_KEY }));
  });
  expect(hook.result.current.persistence.preferences).toBe("idle");
  expect(hook.result.current.preferences.soundAndHaptics).toBe(true);
});

it("marks session-only writes honestly when there is no storage object", async () => {
  const p = await import("./preferences");
  vi.spyOn(window, "localStorage", "get").mockReturnValue(undefined as unknown as Storage);
  p.setHintPreference("soundAndHaptics", false);
  expect(p.getHintPreferencePersistence().preferences).toBe("unsaved");
  expect(p.getHintPreferences().soundAndHaptics).toBe(false);
  expect(p.setHintThemePreference("bright").saved).toBe(false);
});

it("uses the real feedback authority to cancel and keep vibration off after a failed save and retry", async () => {
  vi.doMock("./mobile/runtime", () => ({ isNativeShell: () => false }));
  const p = await import("./preferences");
  const { triggerFeedback } = await import("./feedback");
  const vibrate = vi.fn((_pattern: number | number[]) => true);
  vi.stubGlobal("navigator", { vibrate });
  triggerFeedback("tap");
  expect(vibrate.mock.calls).toEqual([[8]]);
  const write = vi.spyOn(Storage.prototype, "setItem").mockImplementation(blocked);
  p.setHintPreference("soundAndHaptics", false);
  expect(vibrate.mock.calls).toEqual([[8], [0]]);
  triggerFeedback("success");
  write.mockRestore();
  p.retryHintPreferences();
  triggerFeedback("tap");
  expect(vibrate.mock.calls).toEqual([[8], [0]]);
  vi.doUnmock("./mobile/runtime");
});

it("does not replay a pending native haptic after rapid session-only disable and enable", async () => {
  vi.doMock("./mobile/runtime", () => ({ isNativeShell: () => true }));
  let ready!: () => void;
  vi.doMock("./mobile/appLifecycle", () => ({ addNativeAppStateListener: () => new Promise<() => Promise<void>>(resolve => { ready = () => resolve(async () => {}); }) }));
  const impact = vi.fn(), notification = vi.fn();
  vi.doMock("@capacitor/haptics", () => ({ Haptics: { impact, notification }, ImpactStyle: { Light: "LIGHT" }, NotificationType: { Success: "SUCCESS" } }));
  vi.useFakeTimers();
  try {
    const p = await import("./preferences");
    const { triggerFeedback } = await import("./feedback");
    triggerFeedback("tap");
    const write = vi.spyOn(Storage.prototype, "setItem").mockImplementation(blocked);
    p.setHintPreference("soundAndHaptics", false);
    p.setHintPreference("soundAndHaptics", true);
    ready();
    await vi.advanceTimersByTimeAsync(1);
    expect(impact).not.toHaveBeenCalled();
    expect(notification).not.toHaveBeenCalled();
    write.mockRestore();
    p.retryHintPreferences();
    await vi.advanceTimersByTimeAsync(200);
    expect(impact).not.toHaveBeenCalled();
    expect(notification).not.toHaveBeenCalled();
    triggerFeedback("tap");
    await vi.advanceTimersByTimeAsync(1);
    expect(impact).toHaveBeenCalledTimes(1);
  } finally {
    vi.useRealTimers();
    vi.doUnmock("./mobile/runtime"); vi.doUnmock("./mobile/appLifecycle"); vi.doUnmock("@capacitor/haptics");
  }
});
