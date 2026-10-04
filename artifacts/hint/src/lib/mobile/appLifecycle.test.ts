import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  isNativeShell: vi.fn(),
  addListener: vi.fn(),
  remove: vi.fn(async () => undefined),
}));

vi.mock("./runtime", () => ({ isNativeShell: mocks.isNativeShell }));
vi.mock("@capacitor/app", () => ({
  App: { addListener: mocks.addListener },
}));

import { addNativeAppStateListener } from "./appLifecycle";

describe("native app lifecycle", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.addListener.mockResolvedValue({ remove: mocks.remove });
  });

  it("does not load a native listener in the browser", async () => {
    mocks.isNativeShell.mockReturnValue(false);

    const remove = await addNativeAppStateListener(vi.fn());
    await remove();

    expect(mocks.addListener).not.toHaveBeenCalled();
  });

  it("forwards iOS app state and removes its native listener", async () => {
    mocks.isNativeShell.mockReturnValue(true);
    const listener = vi.fn();

    const remove = await addNativeAppStateListener(listener);
    const nativeListener = mocks.addListener.mock.calls[0]?.[1];
    nativeListener?.({ isActive: false });
    nativeListener?.({ isActive: true });

    expect(mocks.addListener).toHaveBeenCalledWith(
      "appStateChange",
      expect.any(Function),
    );
    expect(listener).toHaveBeenNthCalledWith(1, false);
    expect(listener).toHaveBeenNthCalledWith(2, true);

    await remove();
    expect(mocks.remove).toHaveBeenCalledOnce();
  });
});
