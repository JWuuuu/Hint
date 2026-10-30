import { afterEach, beforeEach, expect, it, vi } from "vitest";
const api = vi.hoisted(() => ({ fetch: vi.fn() }));
vi.mock("./api", () => ({ apiFetch: api.fetch, apiUrl: (path: string) => path }));
import { startRecordedSpeech } from "./recordedSpeech";

const trackStop = vi.fn();
const microphone = vi.fn();
let recording: Recorder;
class Recorder {
  static isTypeSupported = (type: string) => type === "audio/webm;codecs=opus";
  state = "inactive";
  mimeType = "audio/webm;codecs=opus";
  ondataavailable: ((event: { data: Blob }) => void) | null = null;
  onstop: (() => void) | null = null;
  onerror: (() => void) | null = null;
  constructor() { recording = this; }
  start() { this.state = "recording"; }
  stop() {
    this.state = "inactive";
    queueMicrotask(() => { this.ondataavailable?.({ data: new Blob(["recorded audio"]) }); this.onstop?.(); });
  }
}
const callbacks = () => ({ language: "en-US", onStart: vi.fn(), onProcessing: vi.fn(), onTranscript: vi.fn(), onError: vi.fn(), onEnd: vi.fn() });
beforeEach(() => {
  vi.useFakeTimers(); trackStop.mockClear(); api.fetch.mockReset(); microphone.mockReset();
  vi.stubGlobal("navigator", { mediaDevices: { getUserMedia: microphone } });
  vi.stubGlobal("MediaRecorder", Recorder);
  vi.stubGlobal("AudioContext", undefined);
  microphone.mockResolvedValue({ getTracks: () => [{ stop: trackStop }] });
  api.fetch.mockImplementation(async (_path: string, init?: RequestInit) => new Response(JSON.stringify(init?.method === "POST" ? { text: "An actual transcript" } : { available: true }), { status: 200 }));
});
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

it("stops the microphone before uploading, keeps the final audio chunk, and delivers one transcript", async () => {
  const options = callbacks();
  const session = await startRecordedSpeech(options);
  expect(options.onStart).toHaveBeenCalledOnce();
  const pending = session.stop();
  expect(trackStop).toHaveBeenCalled();
  await pending;
  expect(api.fetch).toHaveBeenCalledTimes(2);
  const [path, init] = api.fetch.mock.calls[1];
  expect(path).toBe("/api/speech/transcription?language=en");
  expect(await init.body.text()).toBe("recorded audio");
  expect(options.onTranscript).toHaveBeenCalledExactlyOnceWith("An actual transcript");
  expect(options.onEnd).toHaveBeenCalledOnce();
});

it("cancels without uploading or returning a transcript", async () => {
  const options = callbacks();
  const session = await startRecordedSpeech(options);
  await session.cancel(); await Promise.resolve();
  expect(trackStop).toHaveBeenCalled();
  expect(api.fetch).toHaveBeenCalledTimes(1);
  expect(options.onTranscript).not.toHaveBeenCalled();
  expect(options.onEnd).toHaveBeenCalledOnce();
});

it("does not open the microphone when the backend is not configured", async () => {
  api.fetch.mockResolvedValue(new Response(JSON.stringify({ available: false })));
  const options = callbacks(); await startRecordedSpeech(options);
  expect(options.onError).toHaveBeenCalledExactlyOnceWith("backend");
  expect(microphone).not.toHaveBeenCalled();
});

it("releases permission granted after the user has cancelled", async () => {
  let resolve!: (stream: unknown) => void;
  microphone.mockReturnValue(new Promise(done => { resolve = done; }));
  const options = callbacks(), controller = new AbortController();
  const pending = startRecordedSpeech({ ...options, signal: controller.signal });
  await vi.waitFor(() => expect(microphone).toHaveBeenCalled());
  controller.abort();
  resolve({ getTracks: () => [{ stop: trackStop }] }); await pending;
  expect(trackStop).toHaveBeenCalledOnce();
  expect(options.onStart).not.toHaveBeenCalled();
  expect(options.onEnd).toHaveBeenCalledOnce();
  expect(options.onError).not.toHaveBeenCalled();
});

it("aborts an in-flight transcription and ignores a late reply", async () => {
  let resolve!: (response: Response) => void;
  const options = callbacks(), session = await startRecordedSpeech(options);
  api.fetch.mockReturnValueOnce(new Promise(done => { resolve = done; }));
  const pending = session.stop();
  await vi.waitFor(() => expect(api.fetch).toHaveBeenCalledTimes(2));
  await session.cancel();
  expect(api.fetch.mock.calls[1][1].signal.aborted).toBe(true);
  resolve(new Response(JSON.stringify({ text: "Too late" }))); await pending;
  expect(options.onTranscript).not.toHaveBeenCalled();
  expect(options.onEnd).toHaveBeenCalledOnce();
});

it("reports microphone permission errors separately from service failures", async () => {
  microphone.mockRejectedValue(new DOMException("Denied", "NotAllowedError"));
  const options = callbacks(); await startRecordedSpeech(options);
  expect(options.onError).toHaveBeenCalledExactlyOnceWith("permission");
});

it("rejects oversized recordings without uploading audio", async () => {
  const options = callbacks(); await startRecordedSpeech(options);
  recording.ondataavailable?.({ data: new Blob([new Uint8Array(4 * 1024 * 1024 + 1)]) });
  expect(api.fetch).toHaveBeenCalledTimes(1);
  expect(options.onError).toHaveBeenCalledExactlyOnceWith("failed");
  expect(trackStop).toHaveBeenCalled();
});

it.each([
  [429, {}, "limit"], [413, {}, "failed"], [415, { code: "UNSUPPORTED_AUDIO" }, "unavailable"],
  [400, { code: "EMPTY_AUDIO" }, "no-speech"], [400, { code: "UNSUPPORTED_LANGUAGE" }, "failed"],
  [502, { code: "PROVIDER_UNAVAILABLE" }, "backend"], [503, { code: "SPEECH_UNAVAILABLE" }, "backend"],
])("maps a %s transcription reply to one shared voice error", async (status, body, reason) => {
  const options = callbacks(), session = await startRecordedSpeech(options);
  api.fetch.mockResolvedValueOnce(new Response(JSON.stringify(body), { status }));
  await session.stop();
  expect(options.onError).toHaveBeenCalledExactlyOnceWith(reason);
  expect(options.onTranscript).not.toHaveBeenCalled(); expect(options.onEnd).toHaveBeenCalledOnce();
});

it("treats an empty transcript as no speech", async () => {
  const options = callbacks(), session = await startRecordedSpeech(options);
  api.fetch.mockResolvedValueOnce(new Response(JSON.stringify({ text: "  " })));
  await session.stop();
  expect(options.onError).toHaveBeenCalledExactlyOnceWith("no-speech"); expect(options.onTranscript).not.toHaveBeenCalled();
});

it("does not upload an empty recording", async () => {
  const options = callbacks(), session = await startRecordedSpeech(options);
  recording.stop = function (this: Recorder) { this.state = "inactive"; queueMicrotask(() => this.onstop?.()); };
  await session.stop();
  expect(api.fetch).toHaveBeenCalledTimes(1);
  expect(options.onError).toHaveBeenCalledExactlyOnceWith("no-speech"); expect(options.onEnd).toHaveBeenCalledOnce();
});

it("sends the base language of the caller's locale with the recorder MIME type", async () => {
  const options = { ...callbacks(), language: "zh-CN" }, session = await startRecordedSpeech(options);
  await session.stop();
  const [path, init] = api.fetch.mock.calls[1];
  expect(path).toBe("/api/speech/transcription?language=zh");
  expect(init.headers).toEqual({ "Content-Type": "audio/webm;codecs=opus" });
});

it("still records when the platform cannot answer MIME support queries", async () => {
  vi.stubGlobal("MediaRecorder", class extends Recorder { static isTypeSupported = () => { throw new Error("unsupported"); }; });
  const options = callbacks(); await startRecordedSpeech(options);
  expect(options.onStart).toHaveBeenCalledOnce(); expect(options.onError).not.toHaveBeenCalled();
});

it.each([["PermissionDeniedError", "permission"], ["NotFoundError", "micMissing"], ["TrackStartError", "micMissing"]])("maps %s from getUserMedia", async (name, reason) => {
  microphone.mockRejectedValue(new DOMException("No microphone", name));
  const options = callbacks(); await startRecordedSpeech(options);
  expect(options.onError).toHaveBeenCalledExactlyOnceWith(reason); expect(options.onEnd).toHaveBeenCalledOnce();
});

it("reports a failed upload as a network error and ignores a later stop", async () => {
  const options = callbacks(), session = await startRecordedSpeech(options);
  api.fetch.mockRejectedValueOnce(new TypeError("Failed to fetch"));
  await session.stop(); await session.stop();
  expect(options.onError).toHaveBeenCalledExactlyOnceWith("network"); expect(options.onEnd).toHaveBeenCalledOnce();
});

it("caps recording time even when silence detection is unavailable", async () => {
  const options = callbacks(); await startRecordedSpeech(options);
  await vi.advanceTimersByTimeAsync(45000);
  expect(options.onTranscript).toHaveBeenCalledOnce();
  expect(options.onEnd).toHaveBeenCalledOnce();
});
