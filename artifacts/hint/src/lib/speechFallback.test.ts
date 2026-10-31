import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { HintSpeechOptions } from "./speechRecognition";
const recording = vi.hoisted(() => ({ start: vi.fn(), native: false, canRecord: true, available: vi.fn(), requestPermissions: vi.fn() }));
vi.mock("./mobile/runtime", () => ({ isNativeShell: () => recording.native }));
vi.mock("./recordedSpeech", () => ({ canRecordSpeech: () => recording.canRecord, startRecordedSpeech: recording.start }));
vi.mock("@capacitor/core", () => ({ registerPlugin: () => ({ available: recording.available, requestPermissions: recording.requestPermissions }) }));
let browser: Recognition;
class Recognition {
  onerror: ((event: { error: string }) => void) | null = null;
  onend: (() => void) | null = null;
  start = vi.fn(); stop = vi.fn(); abort = vi.fn();
  constructor() { browser = this; }
}
const options = () => ({ language: "en-US", onStart: vi.fn(), onProcessing: vi.fn(), onTranscript: vi.fn(), onError: vi.fn(), onEnd: vi.fn() });
beforeEach(() => {
  vi.resetModules(); recording.start.mockReset(); recording.available.mockReset(); recording.requestPermissions.mockReset();
  recording.native = false; recording.canRecord = true;
  recording.start.mockResolvedValue({ stop: vi.fn(), cancel: vi.fn() });
  vi.stubGlobal("window", { SpeechRecognition: Recognition });
});
afterEach(() => vi.unstubAllGlobals());
it("switches a failed browser speech service to recording without ending the conversation", async () => {
  const { startHintSpeechRecognition } = await import("./speechRecognition");
  const callbacks = options(); await startHintSpeechRecognition(callbacks);
  browser.onerror?.({ error: "network" }); browser.onend?.();
  expect(recording.start).toHaveBeenCalledOnce();
  expect(callbacks.onError).not.toHaveBeenCalled(); expect(callbacks.onEnd).not.toHaveBeenCalled();
  const captured = recording.start.mock.calls[0][0] as HintSpeechOptions;
  captured.onTranscript("Recorded phrase"); captured.onEnd();
  expect(callbacks.onTranscript).toHaveBeenCalledExactlyOnceWith("Recorded phrase");
  expect(callbacks.onEnd).toHaveBeenCalledOnce();
});
it("propagates cancellation while the recording service is still starting", async () => {
  let resolve!: (session: unknown) => void;
  recording.start.mockReturnValue(new Promise(done => { resolve = done; }));
  const { startHintSpeechRecognition } = await import("./speechRecognition");
  const session = await startHintSpeechRecognition(options());
  browser.onerror?.({ error: "network" }); await session.cancel();
  expect(recording.start.mock.calls[0][0].signal.aborted).toBe(true);
  resolve({ stop: vi.fn(), cancel: vi.fn() });
});
it("does not bypass a denied microphone permission with another capture attempt", async () => {
  const { startHintSpeechRecognition } = await import("./speechRecognition");
  const callbacks = options(); await startHintSpeechRecognition(callbacks);
  browser.onerror?.({ error: "not-allowed" });
  expect(callbacks.onError).toHaveBeenCalledExactlyOnceWith("permission");
  expect(recording.start).not.toHaveBeenCalled(); expect(callbacks.onEnd).toHaveBeenCalledOnce();
});
it("records directly when the browser has no speech recognition API", async () => {
  vi.stubGlobal("window", {});
  const { startHintSpeechRecognition } = await import("./speechRecognition");
  await startHintSpeechRecognition(options()); expect(recording.start).toHaveBeenCalledOnce();
});
it.each([
  ["has no native recogniser plugin (Android shell)", () => recording.available.mockRejectedValue(new Error("not implemented"))],
  ["reports the native recogniser unavailable", () => recording.available.mockResolvedValue({ available: false })],
])("records in a native shell that %s, keeping the caller's locale", async (_label, arrange) => {
  recording.native = true; arrange();
  const { startHintSpeechRecognition } = await import("./speechRecognition");
  const callbacks = { ...options(), language: "ko-KR" }; await startHintSpeechRecognition(callbacks);
  expect(recording.start).toHaveBeenCalledOnce();
  expect((recording.start.mock.calls[0][0] as HintSpeechOptions).language).toBe("ko-KR");
  expect(recording.requestPermissions).not.toHaveBeenCalled(); expect(callbacks.onError).not.toHaveBeenCalled();
});
it("keeps the typed fallback in a native shell that can neither recognise nor record", async () => {
  recording.native = true; recording.canRecord = false; recording.available.mockResolvedValue({ available: false });
  const { startHintSpeechRecognition } = await import("./speechRecognition");
  const callbacks = options();
  await expect(startHintSpeechRecognition(callbacks)).rejects.toThrow("Speech recognition unavailable");
  expect(recording.start).not.toHaveBeenCalled();
  expect(callbacks.onError).toHaveBeenCalledExactlyOnceWith("unavailable"); expect(callbacks.onEnd).toHaveBeenCalledOnce();
});
it("does not record when native permission is denied", async () => {
  recording.native = true; recording.available.mockResolvedValue({ available: true });
  recording.requestPermissions.mockResolvedValue({ speechRecognition: "granted", microphone: "denied" });
  const { startHintSpeechRecognition } = await import("./speechRecognition");
  const callbacks = options();
  await expect(startHintSpeechRecognition(callbacks)).rejects.toThrow();
  expect(recording.start).not.toHaveBeenCalled();
  expect(callbacks.onError).toHaveBeenCalledExactlyOnceWith("permission");
});
