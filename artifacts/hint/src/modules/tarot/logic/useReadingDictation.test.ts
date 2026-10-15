/** @vitest-environment jsdom */
import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { HintSpeechOptions } from "../../../lib/speechRecognition";
const speech = vi.hoisted(() => ({ start: vi.fn() }));
vi.mock("../../../lib/speechRecognition", () => ({ startHintSpeechRecognition: speech.start }));
vi.mock("../../../lib/mobile/appLifecycle", () => ({ addNativeAppStateListener: async () => async () => undefined }));
import { useReadingDictation } from "./useReadingDictation";

let callbacks: HintSpeechOptions;
beforeEach(() => {
  vi.useFakeTimers();
  speech.start.mockReset().mockImplementation(async (options: HintSpeechOptions) => {
    callbacks = options;
    return { stop: vi.fn(async () => undefined), cancel: vi.fn(async () => undefined) };
  });
});
afterEach(() => { cleanup(); vi.useRealTimers(); vi.restoreAllMocks(); });
function setup(draft = "") {
  const onDraft = vi.fn();
  const onComplete = vi.fn();
  return { ...renderHook(() => useReadingDictation({ draft, onDraft, onComplete, language: "en", t: key => key })), onDraft, onComplete };
}

it("waits for microphone readiness and sends the finished transcript with the existing draft exactly once", async () => {
  const view = setup("About today:");
  await act(async () => view.result.current.start());
  expect(view.result.current.status).toBe("starting");
  expect(callbacks.continuous).toBe(false);
  act(() => callbacks.onStart?.());
  expect(view.result.current.status).toBe("listening");
  act(() => callbacks.onTranscript("what should I try?"));
  expect(view.onDraft).toHaveBeenLastCalledWith("About today: what should I try?");
  act(() => { callbacks.onEnd(); callbacks.onEnd(); vi.advanceTimersByTime(2000); });
  expect(view.onComplete).toHaveBeenCalledExactlyOnceWith("About today: what should I try?");
  expect(view.result.current.status).toBe("idle");
});

it("sends after a short speech pause and resets that wait as more words arrive", async () => {
  const view = setup();
  await act(async () => view.result.current.start());
  act(() => { callbacks.onStart?.(); callbacks.onTranscript("What should"); vi.advanceTimersByTime(1000); });
  expect(view.onComplete).not.toHaveBeenCalled();
  act(() => { callbacks.onTranscript("What should I do?"); vi.advanceTimersByTime(1199); });
  expect(view.onComplete).not.toHaveBeenCalled();
  act(() => vi.advanceTimersByTime(1));
  expect(view.onComplete).toHaveBeenCalledExactlyOnceWith("What should I do?");
});

it.each(["stop", "error", "unmount", "hidden"])("does not auto-send after %s, even with late results", async reason => {
  const view = setup();
  await act(async () => view.result.current.start());
  act(() => { callbacks.onStart?.(); callbacks.onTranscript("A partial thought"); });
  act(() => {
    if (reason === "stop") view.result.current.stop();
    if (reason === "error") callbacks.onError("network");
    if (reason === "unmount") view.unmount();
    if (reason === "hidden") {
      vi.spyOn(document, "hidden", "get").mockReturnValue(true);
      document.dispatchEvent(new Event("visibilitychange"));
    }
    callbacks.onTranscript("Late words"); callbacks.onEnd();
    vi.advanceTimersByTime(2000);
  });
  expect(view.onComplete).not.toHaveBeenCalled();
  expect(view.onDraft).toHaveBeenLastCalledWith("A partial thought");
  expect(callbacks.signal?.aborted).toBe(true);
});

it("never submits a pre-existing draft when no speech was captured", async () => {
  const view = setup("An unfinished draft");
  await act(async () => view.result.current.start());
  act(() => { callbacks.onStart?.(); callbacks.onEnd(); });
  expect(view.onComplete).not.toHaveBeenCalled();
});

it("stops a stalled startup and ignores a delayed microphone callback", async () => {
  const view = setup();
  await act(async () => view.result.current.start());
  act(() => { vi.advanceTimersByTime(12000); callbacks.onStart?.(); });
  expect(view.result.current.status).toBe("idle");
  expect(view.result.current.notice).toBe("tarot.voice.failed");
  expect(callbacks.signal?.aborted).toBe(true);
  expect(view.onComplete).not.toHaveBeenCalled();
});
