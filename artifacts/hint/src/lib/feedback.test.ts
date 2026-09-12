import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getHintPreferences: vi.fn(),
  isNativeShell: vi.fn(),
  loadNative: vi.fn(),
  impact: vi.fn().mockResolvedValue(undefined),
  notification: vi.fn().mockResolvedValue(undefined),
  vibrate: vi.fn(),
}));

vi.mock("./preferences", () => ({
  getHintPreferences: mocks.getHintPreferences,
}));

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
    vi.stubGlobal("document", { visibilityState: "visible" });
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
    expect({ native: mocks.isNativeShell.mock.calls.length, web: mocks.vibrate.mock.calls }).toEqual({ native: 3, web: [] });
    expect(mocks.impact).not.toHaveBeenCalled();
    expect(mocks.notification).toHaveBeenCalledExactlyOnceWith({ type: "SUCCESS" });
  });

  it.each(["disabled", "backgrounded", "expired"])("drops a %s delayed native pulse", async (change) => {
    const release = delayNativeModule();
    const { triggerHaptic } = await import("./feedback");
    triggerHaptic("select");
    if (change === "disabled") mocks.getHintPreferences.mockReturnValue({ soundAndHaptics: false });
    if (change === "backgrounded") vi.stubGlobal("document", { visibilityState: "hidden" });
    if (change === "expired") vi.mocked(Date.now).mockReturnValue(1_151);
    await release();
    expect(mocks.impact).not.toHaveBeenCalled();
    expect(mocks.notification).not.toHaveBeenCalled();
    expect(mocks.vibrate).not.toHaveBeenCalled();
  });

  it("invalidates an old queued pulse even when the newer gesture is rate limited", async () => {
    const release = delayNativeModule();
    const { triggerHaptic } = await import("./feedback");
    triggerHaptic("tap");
    vi.mocked(Date.now).mockReturnValue(1_020);
    triggerHaptic("select");
    await release();
    expect(mocks.impact).not.toHaveBeenCalled();
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
    if (change === "backgrounded") vi.stubGlobal("document", { visibilityState: "hidden" });
    triggerHaptic("tap");
    expect(mocks.vibrate).not.toHaveBeenCalled();
    expect(mocks.loadNative).not.toHaveBeenCalled();
  });

  it.each(["disabled", "superseded", "expired"])("does not replay %s feedback after a native failure", async (change) => {
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
});
