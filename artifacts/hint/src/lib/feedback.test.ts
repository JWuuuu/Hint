import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getHintPreferences: vi.fn(),
  isNativeShell: vi.fn(),
  loadNative: vi.fn(),
  impact: vi.fn().mockResolvedValue(undefined),
  notification: vi.fn().mockResolvedValue(undefined),
  vibrate: vi.fn(),
  addAppListener: vi.fn(),
}));

vi.mock("./preferences", () => ({
  getHintPreferences: mocks.getHintPreferences,
  HINT_PREFERENCES_UPDATED_EVENT: "hint:preferences-updated",
}));

vi.mock("./mobile/appLifecycle", () => ({ addNativeAppStateListener: mocks.addAppListener }));

vi.mock("./mobile/runtime", () => ({
  isNativeShell: mocks.isNativeShell,
}));

const nativeModule = {
  Haptics: {
    impact: mocks.impact,
    notification: mocks.notification,
  },
  ImpactStyle: {
    Light: "LIGHT",
    Medium: "MEDIUM",
    Heavy: "HEAVY",
  },
  NotificationType: {
    Success: "SUCCESS",
    Warning: "WARNING",
  },
};

function delayNativeModule() {
  let resolve!: (value: typeof nativeModule) => void;
  mocks.loadNative.mockReturnValue(new Promise<typeof nativeModule>((done) => { resolve = done; }));
  return async () => {
    await vi.waitFor(() => expect(mocks.loadNative).toHaveBeenCalledOnce());
    resolve(nativeModule);
    await vi.dynamicImportSettled();
  };
}

describe("Hint haptic feedback", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.spyOn(Date, "now").mockReturnValue(1_000);
    vi.stubGlobal("navigator", { vibrate: mocks.vibrate });
    vi.stubGlobal("document", Object.assign(new EventTarget(), { visibilityState: "visible" }));
    vi.stubGlobal("window", new EventTarget());
    mocks.addAppListener.mockReset().mockResolvedValue(vi.fn(async () => undefined));
    mocks.getHintPreferences.mockReset().mockReturnValue({ soundAndHaptics: true });
    mocks.isNativeShell.mockReset().mockReturnValue(true);
    mocks.impact.mockReset().mockResolvedValue(undefined);
    mocks.notification.mockReset().mockResolvedValue(undefined);
    mocks.vibrate.mockReset();
    mocks.loadNative.mockReset().mockResolvedValue(nativeModule);
    vi.doMock("@capacitor/haptics", () => mocks.loadNative());
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    vi.doUnmock("@capacitor/haptics");
  });

  it("respects settings, rate limits native pulses, and keeps a web fallback", async () => {
    const { triggerHaptic } = await import("./feedback");
    mocks.getHintPreferences.mockReturnValue({ soundAndHaptics: false });

    triggerHaptic("select");
    expect(mocks.impact).not.toHaveBeenCalled();

    mocks.getHintPreferences.mockReturnValue({ soundAndHaptics: true });
    triggerHaptic("select");
    await vi.dynamicImportSettled();
    expect(mocks.impact).toHaveBeenCalledExactlyOnceWith({ style: "MEDIUM" });

    triggerHaptic("reveal");
    await vi.dynamicImportSettled();
    expect(mocks.impact).toHaveBeenCalledTimes(1);

    vi.mocked(Date.now).mockReturnValue(1_050);
    triggerHaptic("complete");
    await vi.dynamicImportSettled();
    expect(mocks.notification).toHaveBeenCalledExactlyOnceWith({ type: "SUCCESS" });

    vi.mocked(Date.now).mockReturnValue(1_100);
    mocks.isNativeShell.mockReturnValue(false);
    triggerHaptic("tap");
    expect(mocks.vibrate).toHaveBeenCalledWith(8);
  });

  it.each([
    ["soft", "LIGHT"],
    ["tap", "LIGHT"],
    ["select", "MEDIUM"],
    ["reveal", "HEAVY"],
  ] as const)("maps %s to the native %s impact", async (intent, style) => {
    const { triggerHaptic } = await import("./feedback");
    triggerHaptic(intent);
    await vi.dynamicImportSettled();
    expect(mocks.impact).toHaveBeenCalledExactlyOnceWith({ style });
    expect(mocks.notification).not.toHaveBeenCalled();
  });

  it.each([["success", "SUCCESS"], ["warning", "WARNING"]] as const)("maps %s to a native notification", async (intent, type) => {
    const { triggerHaptic } = await import("./feedback");
    triggerHaptic(intent);
    await vi.dynamicImportSettled();
    expect(mocks.notification).toHaveBeenCalledExactlyOnceWith({ type });
    expect(mocks.impact).not.toHaveBeenCalled();
  });

  it("delivers only the newest gesture after a delayed native import", async () => {
    const release = delayNativeModule();
    const { triggerHaptic } = await import("./feedback");
    triggerHaptic("tap");
    vi.mocked(Date.now).mockReturnValue(1_050);
    triggerHaptic("select");
    vi.mocked(Date.now).mockReturnValue(1_100);
    triggerHaptic("complete");
    await release();
    expect(mocks.vibrate).not.toHaveBeenCalled();
    expect(mocks.impact).not.toHaveBeenCalled();
    expect(mocks.notification).toHaveBeenCalledExactlyOnceWith({ type: "SUCCESS" });
  });

  it.each(["disabled", "backgrounded", "expired"])("drops a %s delayed native pulse", async (change) => {
    const release = delayNativeModule();
    const { triggerHaptic } = await import("./feedback");
    triggerHaptic("select");
    if (change === "disabled") mocks.getHintPreferences.mockReturnValue({ soundAndHaptics: false });
    if (change === "backgrounded") Object.assign(document, { visibilityState: "hidden" });
    if (change === "expired") vi.mocked(Date.now).mockReturnValue(1_151);
    await release();
    expect(mocks.impact).not.toHaveBeenCalled();
    expect(mocks.notification).not.toHaveBeenCalled();
    expect(mocks.vibrate).not.toHaveBeenCalled();
  });

  it.each([0, 1, 20, 45])("retains the first eligible intent when a repeat at %dms is throttled", async (interval) => {
    const release = delayNativeModule();
    const { triggerHaptic, triggerFeedback } = await import("./feedback");
    triggerHaptic("tap");
    vi.mocked(Date.now).mockReturnValue(1_000 + interval);
    triggerFeedback("select");
    await release();
    expect(mocks.impact).toHaveBeenCalledExactlyOnceWith({ style: "LIGHT" });
    expect(mocks.notification).not.toHaveBeenCalled();
    expect(mocks.vibrate).not.toHaveBeenCalled();
  });

  it("coalesces same-task intents even after the native module is warm", async () => {
    const { triggerHaptic, triggerFeedback } = await import("./feedback");
    triggerHaptic("tap");
    await vi.dynamicImportSettled();
    vi.mocked(Date.now).mockReturnValue(1_046);
    triggerFeedback("select");
    triggerHaptic("complete");
    await vi.dynamicImportSettled();
    expect(mocks.impact.mock.calls).toEqual([[{ style: "LIGHT" }], [{ style: "MEDIUM" }]]);
    expect(mocks.notification).not.toHaveBeenCalled();
    expect(mocks.vibrate).not.toHaveBeenCalled();
    expect(mocks.loadNative).toHaveBeenCalledOnce();
  });

  it("accepts a newer intent at 46ms and does not extend its window for dropped input", async () => {
    const release = delayNativeModule();
    const { triggerHaptic } = await import("./feedback");
    triggerHaptic("tap");
    vi.mocked(Date.now).mockReturnValue(1_045);
    triggerHaptic("warning");
    vi.mocked(Date.now).mockReturnValue(1_046);
    triggerHaptic("select");
    vi.mocked(Date.now).mockReturnValue(1_091);
    triggerHaptic("complete");
    await release();
    expect(mocks.impact).toHaveBeenCalledExactlyOnceWith({ style: "MEDIUM" });
    expect(mocks.notification).not.toHaveBeenCalled();
    expect(mocks.vibrate).not.toHaveBeenCalled();
  });

  it("keeps the same first-intent coalescing policy on the web", async () => {
    mocks.isNativeShell.mockReturnValue(false);
    const { triggerHaptic, triggerFeedback } = await import("./feedback");
    triggerHaptic("tap");
    triggerFeedback("select");
    vi.mocked(Date.now).mockReturnValue(1_045);
    triggerHaptic("warning");
    expect(mocks.vibrate).toHaveBeenCalledExactlyOnceWith(8);
    vi.mocked(Date.now).mockReturnValue(1_046);
    triggerHaptic("select");
    expect(mocks.vibrate.mock.calls).toEqual([[8], [[8, 18, 10]]]);
    expect(mocks.loadNative).not.toHaveBeenCalled();
  });

  it.each([false, true])("coalesces while lifecycle registration is pending, backgrounded=%s", async (backgrounded) => {
    let resolveLifecycle!: (remove: () => Promise<void>) => void;
    mocks.addAppListener.mockReturnValue(new Promise(done => { resolveLifecycle = done; }));
    const { triggerHaptic } = await import("./feedback");
    triggerHaptic("tap");
    vi.mocked(Date.now).mockReturnValue(1_020);
    triggerHaptic("select");
    await vi.dynamicImportSettled();
    expect(mocks.impact).not.toHaveBeenCalled();
    expect(mocks.addAppListener).toHaveBeenCalledExactlyOnceWith(expect.any(Function), { emitCurrentState: true });
    if (backgrounded) mocks.addAppListener.mock.calls[0][0](false);
    resolveLifecycle(vi.fn(async () => undefined));
    await vi.dynamicImportSettled();
    if (backgrounded) expect(mocks.impact).not.toHaveBeenCalled();
    else expect(mocks.impact).toHaveBeenCalledExactlyOnceWith({ style: "LIGHT" });
    expect(mocks.notification).not.toHaveBeenCalled();
    expect(mocks.vibrate).not.toHaveBeenCalled();
  });

  it.each([150, 151, -1])("checks the original intent age after coalescing, age=%dms", async (age) => {
    const release = delayNativeModule();
    const { triggerHaptic } = await import("./feedback");
    triggerHaptic("tap");
    vi.mocked(Date.now).mockReturnValue(1_020);
    triggerHaptic("select");
    vi.mocked(Date.now).mockReturnValue(1_000 + age);
    await release();
    if (age === 150) expect(mocks.impact).toHaveBeenCalledExactlyOnceWith({ style: "LIGHT" });
    else expect(mocks.impact).not.toHaveBeenCalled();
    expect(mocks.notification).not.toHaveBeenCalled();
    expect(mocks.vibrate).not.toHaveBeenCalled();
  });

  it("invalidates pending work on a disabled call even within the throttle window", async () => {
    const release = delayNativeModule();
    const { triggerHaptic } = await import("./feedback");
    triggerHaptic("tap");
    mocks.getHintPreferences.mockReturnValue({ soundAndHaptics: false });
    triggerHaptic("select");
    mocks.getHintPreferences.mockReturnValue({ soundAndHaptics: true });
    triggerHaptic("complete");
    await release();
    expect(mocks.impact).not.toHaveBeenCalled();
    expect(mocks.notification).not.toHaveBeenCalled();
    expect(mocks.vibrate).not.toHaveBeenCalled();
    vi.mocked(Date.now).mockReturnValue(1_046);
    triggerHaptic("select");
    await vi.dynamicImportSettled();
    expect(mocks.impact).toHaveBeenCalledExactlyOnceWith({ style: "MEDIUM" });
  });

  it.each(["import", "impact"])("falls back once for coalesced intent after a failed native %s", async (failure) => {
    if (failure === "import") mocks.loadNative.mockRejectedValue(new Error("Module unavailable"));
    else mocks.impact.mockRejectedValue(new Error("Impact unavailable"));
    const { triggerHaptic } = await import("./feedback");
    triggerHaptic("tap");
    triggerHaptic("select");
    await vi.dynamicImportSettled();
    expect(mocks.vibrate).toHaveBeenCalledExactlyOnceWith(8);
    expect(mocks.impact).toHaveBeenCalledTimes(failure === "import" ? 0 : 1);
    expect(mocks.notification).not.toHaveBeenCalled();
  });

  it("does not duplicate a delivered pulse while its native acknowledgement is pending", async () => {
    let acknowledge!: () => void;
    mocks.impact.mockReturnValue(new Promise<void>(done => { acknowledge = done; }));
    const { triggerHaptic } = await import("./feedback");
    triggerHaptic("tap");
    await vi.dynamicImportSettled();
    expect(mocks.impact).toHaveBeenCalledOnce();
    vi.mocked(Date.now).mockReturnValue(1_020);
    triggerHaptic("select");
    acknowledge();
    await vi.dynamicImportSettled();
    expect(mocks.impact).toHaveBeenCalledExactlyOnceWith({ style: "LIGHT" });
    expect(mocks.notification).not.toHaveBeenCalled();
    expect(mocks.vibrate).not.toHaveBeenCalled();
  });

  it("retains the coalesced intent when optional lifecycle registration fails", async () => {
    mocks.addAppListener.mockRejectedValue(new Error("Lifecycle unavailable"));
    const { triggerHaptic } = await import("./feedback");
    triggerHaptic("tap");
    triggerHaptic("select");
    await vi.dynamicImportSettled();
    expect(mocks.impact).toHaveBeenCalledExactlyOnceWith({ style: "LIGHT" });
    expect(mocks.notification).not.toHaveBeenCalled();
    expect(mocks.vibrate).not.toHaveBeenCalled();
  });

  it("rate limits actual delivery as well as the original gesture time", async () => {
    const release = delayNativeModule();
    const { triggerHaptic } = await import("./feedback");
    triggerHaptic("tap");
    vi.mocked(Date.now).mockReturnValue(1_100);
    await release();
    expect(mocks.impact).toHaveBeenCalledOnce();
    vi.mocked(Date.now).mockReturnValue(1_140);
    triggerHaptic("complete");
    await vi.dynamicImportSettled();
    expect(mocks.notification).not.toHaveBeenCalled();
    vi.mocked(Date.now).mockReturnValue(1_190);
    triggerHaptic("complete");
    await vi.dynamicImportSettled();
    expect(mocks.notification).toHaveBeenCalledOnce();
    expect(mocks.loadNative).toHaveBeenCalledOnce();
  });

  it.each(["disabled", "backgrounded"])("keeps %s browser feedback silent", async (change) => {
    mocks.isNativeShell.mockReturnValue(false);
    const { triggerHaptic } = await import("./feedback");
    if (change === "disabled") mocks.getHintPreferences.mockReturnValue({ soundAndHaptics: false });
    if (change === "backgrounded") Object.assign(document, { visibilityState: "hidden" });
    triggerHaptic("tap");
    expect(mocks.vibrate).not.toHaveBeenCalled();
    expect(mocks.loadNative).not.toHaveBeenCalled();
  });

  it.each(["disabled", "superseded", "expired", "future"])("does not replay %s feedback after a native failure", async (change) => {
    let reject!: (reason: Error) => void;
    mocks.impact.mockReturnValue(new Promise<void>((_, fail) => { reject = fail; }));
    const { triggerHaptic } = await import("./feedback");
    triggerHaptic("tap");
    await vi.waitFor(() => expect(mocks.impact).toHaveBeenCalledOnce());
    if (change === "disabled") mocks.getHintPreferences.mockReturnValue({ soundAndHaptics: false });
    if (change === "superseded") {
      vi.mocked(Date.now).mockReturnValue(1_050);
      triggerHaptic("complete");
    }
    if (change === "expired") vi.mocked(Date.now).mockReturnValue(1_151);
    if (change === "future") vi.mocked(Date.now).mockReturnValue(999);
    reject(new Error("Native feedback unavailable"));
    await vi.dynamicImportSettled();
    expect(mocks.vibrate).not.toHaveBeenCalled();
  });

  it("handles rejected native and browser feedback without an unhandled rejection", async () => {
    mocks.impact.mockRejectedValue(new Error("Native feedback unavailable"));
    mocks.vibrate.mockImplementation(() => { throw new Error("Vibration unavailable"); });
    const { triggerHaptic } = await import("./feedback");
    expect(() => triggerHaptic("tap")).not.toThrow();
    await vi.dynamicImportSettled();
    expect(mocks.vibrate).toHaveBeenCalledExactlyOnceWith(8);
    vi.mocked(Date.now).mockReturnValue(1_050);
    mocks.isNativeShell.mockReturnValue(false);
    expect(() => triggerHaptic("tap")).not.toThrow();
    expect(mocks.vibrate).toHaveBeenCalledTimes(2);
  });

  it("silences native feedback while the app is inactive even if the web view stays visible", async () => {
    const { triggerHaptic } = await import("./feedback");
    triggerHaptic("tap");
    await vi.dynamicImportSettled();
    const listener = mocks.addAppListener.mock.calls[0]?.[0];
    listener?.(false);
    vi.mocked(Date.now).mockReturnValue(1_060);
    triggerHaptic("complete");
    await vi.dynamicImportSettled();
    expect(mocks.notification).not.toHaveBeenCalled();
    listener?.(true);
    vi.mocked(Date.now).mockReturnValue(1_120);
    triggerHaptic("select");
    await vi.dynamicImportSettled();
    expect(mocks.impact).toHaveBeenCalledTimes(2);
  });

  it("bounds a stalled lifecycle bridge without suppressing all future gestures", async () => {
    mocks.addAppListener.mockReturnValue(new Promise(() => undefined));
    const { triggerHaptic } = await import("./feedback");
    triggerHaptic("tap");
    await vi.waitFor(() => expect(mocks.impact).toHaveBeenCalledOnce());
    vi.mocked(Date.now).mockReturnValue(1_200);
    triggerHaptic("select");
    await vi.waitFor(() => expect(mocks.impact).toHaveBeenCalledTimes(2));
    // A lifecycle event still overrides the visible-document fallback.
    mocks.addAppListener.mock.calls[0][0](false);
    vi.mocked(Date.now).mockReturnValue(1_300);
    triggerHaptic("complete");
    await vi.dynamicImportSettled();
    expect(mocks.notification).not.toHaveBeenCalled();
  });

  it.each(["visibility", "native", "preference", "pagehide"])("does not replay queued feedback across a brief %s interruption", async reason => {
    const release = delayNativeModule();
    const { triggerHaptic } = await import("./feedback");
    triggerHaptic("select");
    if (reason === "visibility") {
      Object.assign(document, { visibilityState: "hidden" });
      document.dispatchEvent(new Event("visibilitychange"));
      Object.assign(document, { visibilityState: "visible" });
      document.dispatchEvent(new Event("visibilitychange"));
    } else if (reason === "native") {
      const listener = mocks.addAppListener.mock.calls[0]?.[0];
      listener?.(false); listener?.(true);
    } else if (reason === "preference") {
      mocks.getHintPreferences.mockReturnValue({ soundAndHaptics: false });
      window.dispatchEvent(new Event("hint:preferences-updated"));
      mocks.getHintPreferences.mockReturnValue({ soundAndHaptics: true });
      window.dispatchEvent(new Event("hint:preferences-updated"));
    } else {
      window.dispatchEvent(new Event("pagehide"));
      window.dispatchEvent(new Event("pageshow"));
    }
    await release();
    expect(mocks.impact).not.toHaveBeenCalled();
    expect(mocks.notification).not.toHaveBeenCalled();
  });

  it.each(["visibility", "preference"])("cancels an ongoing browser vibration when %s disables feedback", async reason => {
    mocks.isNativeShell.mockReturnValue(false);
    const { triggerHaptic } = await import("./feedback");
    triggerHaptic("reveal");
    if (reason === "visibility") {
      Object.assign(document, { visibilityState: "hidden" });
      document.dispatchEvent(new Event("visibilitychange"));
    } else {
      mocks.getHintPreferences.mockReturnValue({ soundAndHaptics: false });
      window.dispatchEvent(new Event("hint:preferences-updated"));
    }
    expect(mocks.vibrate).toHaveBeenLastCalledWith(0);
  });
});
