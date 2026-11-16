// @vitest-environment jsdom
import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
const native = vi.hoisted(() => ({ id: "", listeners: new Map<string, (event: Record<string, unknown>) => void>(), cancel: vi.fn() }));
vi.mock("../../../lib/mobile/runtime", () => ({ isNativeShell: () => true }));
vi.mock("../../../lib/mobile/appLifecycle", () => ({ addNativeAppStateListener: async () => async () => undefined }));
vi.mock("@capacitor/core", () => ({ registerPlugin: () => ({
  available: async () => ({ available: true }),
  requestPermissions: async () => ({ speechRecognition: "granted", microphone: "granted" }),
  start: async ({ sessionId }: { sessionId: string }) => { native.id = sessionId; return { matches: [] }; },
  stop: async () => undefined, cancel: native.cancel,
  addListener: async (name: string, listener: (event: Record<string, unknown>) => void) => {
    native.listeners.set(name, listener); return { remove: async () => { native.listeners.delete(name); } };
  },
}) }));
import { useReadingDictation } from "./useReadingDictation";
afterEach(() => { cleanup(); vi.useRealTimers(); native.listeners.clear(); });
it("manual native Stop keeps the finalization window open despite an intervening partial result", async () => {
  vi.useFakeTimers(); native.cancel.mockReset().mockResolvedValue(undefined);
  const onDraft = vi.fn(), onComplete = vi.fn();
  const view = renderHook(() => useReadingDictation({ draft: "Prefix", onDraft, onComplete, language: "en", t: key => key }));
  await act(async () => view.result.current.start());
  expect(view.result.current.status).toBe("listening");
  let stopping!: Promise<void>;
  act(() => { stopping = view.result.current.start(); });
  expect(view.result.current.status).toBe("processing");
  act(() => native.listeners.get("partialResults")?.({ sessionId: native.id, matches: ["unfinished"] }));
  await act(async () => vi.advanceTimersByTimeAsync(1500));
  expect(view.result.current.status).toBe("processing");
  act(() => native.listeners.get("partialResults")?.({ sessionId: native.id, matches: ["finished sentence"], isFinal: true }));
  await act(async () => stopping);
  expect(onDraft).toHaveBeenLastCalledWith("Prefix finished sentence");
  expect(onComplete).not.toHaveBeenCalled(); expect(view.result.current.status).toBe("idle");
});
