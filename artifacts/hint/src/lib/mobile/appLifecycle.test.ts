import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  isNativeShell: vi.fn(),
  addListener: vi.fn(),
  getState: vi.fn(),
  remove: vi.fn(async () => undefined),
}));

vi.mock("./runtime", () => ({ isNativeShell: mocks.isNativeShell }));
vi.mock("@capacitor/app", () => ({
  App: { addListener: mocks.addListener, getState: mocks.getState },
}));

import { addNativeAppStateListener } from "./appLifecycle";

describe("native app lifecycle", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.addListener.mockResolvedValue({ remove: mocks.remove });
    mocks.getState.mockReset().mockResolvedValue({ isActive: true });
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
    nativeListener?.({ isActive: false });
    expect(listener).toHaveBeenCalledTimes(2);
  });

  it("can report an already inactive app before any state-change event", async () => {
    mocks.isNativeShell.mockReturnValue(true);
    mocks.getState.mockResolvedValue({ isActive: false });
    const listener = vi.fn();
    const remove = await addNativeAppStateListener(listener, { emitCurrentState: true });
    expect(listener).toHaveBeenCalledExactlyOnceWith(false);
    await remove();
  });

  it("keeps a newer lifecycle event over an older initial snapshot", async () => {
    mocks.isNativeShell.mockReturnValue(true);
    let resolve!: (state: { isActive: boolean }) => void;
    mocks.getState.mockReturnValue(new Promise(done => { resolve = done; }));
    const listener = vi.fn();
    const pending = addNativeAppStateListener(listener, { emitCurrentState: true });
    await vi.waitFor(() => expect(mocks.getState).toHaveBeenCalledOnce());
    mocks.addListener.mock.calls[0][1]({ isActive: false });
    resolve({ isActive: true });
    const remove = await pending;
    expect(listener).toHaveBeenCalledExactlyOnceWith(false);
    await remove();
  });

  it("keeps the listener usable when the optional state snapshot fails", async () => {
    mocks.isNativeShell.mockReturnValue(true);
    mocks.getState.mockRejectedValue(new Error("State unavailable"));
    const listener = vi.fn();
    const remove = await addNativeAppStateListener(listener, { emitCurrentState: true });
    mocks.addListener.mock.calls[0][1]({ isActive: false });
    expect(listener).toHaveBeenCalledExactlyOnceWith(false);
    await remove();
  });

  it("returns cleanup when the initial snapshot stalls and ignores its late reply", async () => {
    mocks.isNativeShell.mockReturnValue(true);
    let resolve!: (state: { isActive: boolean }) => void;
    mocks.getState.mockReturnValue(new Promise(done => { resolve = done; }));
    const listener = vi.fn();
    const pending = addNativeAppStateListener(listener, { emitCurrentState: true });
    const done = vi.fn(); void pending.then(done);
    await vi.waitFor(() => expect(done).toHaveBeenCalledOnce());
    const remove = await pending; await remove();
    resolve({ isActive: true }); await Promise.resolve();
    expect(listener).not.toHaveBeenCalled();
    expect(mocks.remove).toHaveBeenCalledOnce();
  });
});
