import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  isNativeShell: vi.fn(),
  loadNative: vi.fn(),
  impact: vi.fn(),
  notification: vi.fn(),
  vibrate: vi.fn(),
}));

vi.mock("./mobile/runtime", () => ({ isNativeShell: mocks.isNativeShell }));
vi.mock("./mobile/appLifecycle", () => ({
  addNativeAppStateListener: vi.fn(async () => async () => undefined),
}));

const nativeModule = {
  Haptics: { impact: mocks.impact, notification: mocks.notification },
  ImpactStyle: { Light: "LIGHT", Medium: "MEDIUM", Heavy: "HEAVY" },
  NotificationType: { Success: "SUCCESS", Warning: "WARNING" },
};

function blockStorage(failure: "write" | "access") {
  if (failure === "write") {
    vi.spyOn(window.localStorage, "setItem").mockImplementation(() => {
      throw new Error("Storage full");
    });
  } else {
    Object.defineProperty(window, "localStorage", {
      configurable: true,
      get() { throw new Error("Storage blocked"); },
    });
  }
}

describe("haptic cancellation with real session preferences", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.spyOn(Date, "now").mockReturnValue(1_000);
    vi.stubGlobal("navigator", { vibrate: mocks.vibrate });
    vi.stubGlobal("document", Object.assign(new EventTarget(), { visibilityState: "visible" }));
    vi.stubGlobal("window", Object.assign(new EventTarget(), {
      localStorage: {
        getItem: vi.fn(() => JSON.stringify({ reduceMotion: false, soundAndHaptics: true })),
        setItem: vi.fn(),
      },
    }));
    mocks.isNativeShell.mockReset().mockReturnValue(true);
    mocks.impact.mockReset().mockResolvedValue(undefined);
    mocks.notification.mockReset().mockResolvedValue(undefined);
    mocks.vibrate.mockReset().mockReturnValue(true);
    mocks.loadNative.mockReset();
    vi.doMock("@capacitor/haptics", () => mocks.loadNative());
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    vi.doUnmock("@capacitor/haptics");
  });

  it.each([
    { failure: "write", reenable: false },
    { failure: "write", reenable: true },
    { failure: "access", reenable: false },
    { failure: "access", reenable: true },
  ] as const)("cancels a coalesced native intent despite storage $failure failure, reenable=$reenable", async ({ failure, reenable }) => {
    let release!: (module: typeof nativeModule) => void;
    mocks.loadNative.mockReturnValue(new Promise<typeof nativeModule>(done => { release = done; }));
    const { getHintPreferences, setHintPreference } = await import("./preferences");
    const { triggerHaptic } = await import("./feedback");
    triggerHaptic("tap");
    vi.mocked(Date.now).mockReturnValue(1_020);
    triggerHaptic("select");
    await vi.waitFor(() => expect(mocks.loadNative).toHaveBeenCalledOnce());

    blockStorage(failure);
    setHintPreference("soundAndHaptics", false);
    expect(getHintPreferences().soundAndHaptics).toBe(false);
    if (reenable) setHintPreference("soundAndHaptics", true);
    release(nativeModule);
    await vi.dynamicImportSettled();
    expect(mocks.impact).not.toHaveBeenCalled();
    expect(mocks.notification).not.toHaveBeenCalled();
    expect(mocks.vibrate).not.toHaveBeenCalled();

    vi.mocked(Date.now).mockReturnValue(1_046);
    triggerHaptic("select");
    await vi.dynamicImportSettled();
    if (reenable) expect(mocks.impact).toHaveBeenCalledExactlyOnceWith({ style: "MEDIUM" });
    else expect(mocks.impact).not.toHaveBeenCalled();
    expect(mocks.notification).not.toHaveBeenCalled();
    expect(mocks.vibrate).not.toHaveBeenCalled();
  });

  it.each(["write", "access"] as const)("cancels ongoing web feedback despite storage %s failure", async (failure) => {
    mocks.isNativeShell.mockReturnValue(false);
    const { getHintPreferences, setHintPreference } = await import("./preferences");
    const { triggerFeedback } = await import("./feedback");
    triggerFeedback("reveal");
    blockStorage(failure);
    setHintPreference("soundAndHaptics", false);
    expect(getHintPreferences().soundAndHaptics).toBe(false);
    vi.mocked(Date.now).mockReturnValue(1_046);
    triggerFeedback("select");
    expect(mocks.vibrate.mock.calls).toEqual([[[10, 24, 18, 40, 26]], [0]]);
    expect(mocks.loadNative).not.toHaveBeenCalled();
  });
});
