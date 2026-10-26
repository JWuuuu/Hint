import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const api = vi.hoisted(() => ({ fetch: vi.fn() }));
vi.mock("./api", () => ({ apiFetch: api.fetch, apiUrl: (path: string) => path }));

import { RECORDED_SPEECH_LIMITS, startRecordedSpeech } from "./recordedSpeech";

let level = 0;
let recordingBytes = 4096;

class FakeRecorder extends EventTarget {
  static isTypeSupported = (type: string) => type === "audio/webm;codecs=opus";
  static instances: FakeRecorder[] = [];
  state: "inactive" | "recording" = "inactive";
  mimeType: string;
  constructor(readonly stream: unknown, options?: { mimeType?: string }) {
    super();
    this.mimeType = options?.mimeType ?? "";
    FakeRecorder.instances.push(this);
  }
  start() { this.state = "recording"; }
  stop() {
    if (this.state === "inactive") return;
    this.state = "inactive";
    queueMicrotask(() => {
      this.dispatchEvent(Object.assign(new Event("dataavailable"), {
        data: new Blob([new Uint8Array(recordingBytes)], { type: "audio/webm;codecs=opus" }),
      }));
      this.dispatchEvent(new Event("stop"));
    });
  }
}

class FakeAudioContext {
  state = "running";
  close = vi.fn(async () => undefined);
  resume = vi.fn(async () => undefined);
  createMediaStreamSource() { return { connect: vi.fn(), disconnect: vi.fn() }; }
  createAnalyser() {
    return { fftSize: 1024, getFloatTimeDomainData: (target: Float32Array) => target.fill(level) };
  }
}

const track = { stop: vi.fn() };
const getUserMedia = vi.fn(async () => ({ getTracks: () => [track] }));

function callbacks(signal?: AbortSignal) {
  return {
    language: "en-US",
    continuous: false,
    signal,
    onStart: vi.fn(),
    onTranscript: vi.fn(),
    onError: vi.fn(),
    onEnd: vi.fn(),
  };
}

function transcript(text: string, status = 200) {
  return new Response(JSON.stringify(status === 200 ? { text } : { error: "x" }), {
    status, headers: { "Content-Type": "application/json" },
  });
}

/** Quiet room, a sentence, then a pause long enough to end the turn. */
async function speakOneSentence() {
  level = 0.002;
  await vi.advanceTimersByTimeAsync(RECORDED_SPEECH_LIMITS.calibrationMs + 100);
  level = 0.12;
  await vi.advanceTimersByTimeAsync(900);
  level = 0.003;
  await vi.advanceTimersByTimeAsync(RECORDED_SPEECH_LIMITS.endSilenceMs + 200);
}

describe("recorded speech fallback", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    level = 0;
    recordingBytes = 4096;
    FakeRecorder.instances = [];
    track.stop.mockClear();
    getUserMedia.mockClear();
    api.fetch.mockReset();
    vi.stubGlobal("window", { MediaRecorder: FakeRecorder, AudioContext: FakeAudioContext });
    vi.stubGlobal("navigator", { mediaDevices: { getUserMedia } });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("records one turn, ends it on silence and returns the server transcript", async () => {
    api.fetch.mockResolvedValue(transcript("Will the move to Denver work out?"));
    const options = callbacks();
    await startRecordedSpeech(options);
    expect(options.onStart).toHaveBeenCalledOnce();
    expect(getUserMedia).toHaveBeenCalledWith({ audio: expect.objectContaining({ echoCancellation: true, noiseSuppression: true }) });
    expect(FakeRecorder.instances[0]?.mimeType).toBe("audio/webm;codecs=opus");

    await speakOneSentence();
    await vi.waitFor(() => expect(options.onEnd).toHaveBeenCalledOnce());

    expect(options.onTranscript).toHaveBeenCalledExactlyOnceWith("Will the move to Denver work out?");
    expect(options.onError).not.toHaveBeenCalled();
    expect(track.stop).toHaveBeenCalled();
    const [url, init] = api.fetch.mock.calls[0]!;
    expect(url).toBe("/api/transcribe?language=en-US");
    expect(init).toMatchObject({ method: "POST", headers: { "Content-Type": "audio/webm" } });
    expect(init.body).toBeInstanceOf(Blob);
  });

  it("reports no speech without uploading when the room stays quiet", async () => {
    const options = callbacks();
    level = 0.002;
    await startRecordedSpeech(options);
    await vi.advanceTimersByTimeAsync(RECORDED_SPEECH_LIMITS.noSpeechMs + 200);

    expect(options.onError).toHaveBeenCalledExactlyOnceWith("no-speech");
    expect(options.onEnd).toHaveBeenCalledOnce();
    expect(api.fetch).not.toHaveBeenCalled();
    expect(track.stop).toHaveBeenCalled();
  });

  it("does not mistake a short click for speech", async () => {
    const options = callbacks();
    await startRecordedSpeech(options);
    level = 0.002;
    await vi.advanceTimersByTimeAsync(400);
    level = 0.2;
    await vi.advanceTimersByTimeAsync(100);
    level = 0.002;
    await vi.advanceTimersByTimeAsync(RECORDED_SPEECH_LIMITS.noSpeechMs);
    expect(options.onError).toHaveBeenCalledExactlyOnceWith("no-speech");
    expect(api.fetch).not.toHaveBeenCalled();
  });

  it.each([
    ["NotAllowedError", "permission"],
    ["NotFoundError", "micMissing"],
    ["AbortError", "failed"],
  ])("maps a %s microphone failure to %s and ends once", async (name, reason) => {
    getUserMedia.mockRejectedValueOnce(new DOMException("blocked", name));
    const options = callbacks();
    await expect(startRecordedSpeech(options)).rejects.toMatchObject({ name });
    expect(options.onError).toHaveBeenCalledExactlyOnceWith(reason);
    expect(options.onEnd).toHaveBeenCalledOnce();
    expect(options.onStart).not.toHaveBeenCalled();
  });

  it("discards the recording on cancel and never uploads it", async () => {
    const options = callbacks();
    const session = await startRecordedSpeech(options);
    level = 0.12;
    await vi.advanceTimersByTimeAsync(800);
    await session.cancel();
    await vi.advanceTimersByTimeAsync(3000);

    expect(api.fetch).not.toHaveBeenCalled();
    expect(options.onTranscript).not.toHaveBeenCalled();
    expect(options.onError).not.toHaveBeenCalled();
    expect(options.onEnd).toHaveBeenCalledOnce();
    expect(track.stop).toHaveBeenCalled();
  });

  it("drops a late transcript when the caller aborts during the upload", async () => {
    let uploadSignal: AbortSignal | undefined;
    api.fetch.mockImplementation((_url: string, init: RequestInit) => new Promise((_, reject) => {
      uploadSignal = init.signal ?? undefined;
      init.signal?.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")), { once: true });
    }));
    const controller = new AbortController();
    const options = callbacks(controller.signal);
    await startRecordedSpeech(options);
    await speakOneSentence();
    await vi.waitFor(() => expect(api.fetch).toHaveBeenCalledOnce());

    controller.abort();
    await vi.waitFor(() => expect(uploadSignal?.aborted).toBe(true));
    await vi.advanceTimersByTimeAsync(10);
    expect(options.onEnd).toHaveBeenCalledOnce();
    expect(options.onError).not.toHaveBeenCalled();
    expect(options.onTranscript).not.toHaveBeenCalled();
  });

  it.each([
    [502, "network"],
    [429, "failed"],
    [415, "unavailable"],
  ])("maps a %s transcription response to %s", async (status, reason) => {
    api.fetch.mockResolvedValue(transcript("", status));
    const options = callbacks();
    await startRecordedSpeech(options);
    await speakOneSentence();
    await vi.waitFor(() => expect(options.onEnd).toHaveBeenCalledOnce());
    expect(options.onError).toHaveBeenCalledExactlyOnceWith(reason);
    expect(options.onTranscript).not.toHaveBeenCalled();
  });

  it("treats an empty server transcript as no speech", async () => {
    api.fetch.mockResolvedValue(transcript("   "));
    const options = callbacks();
    await startRecordedSpeech(options);
    await speakOneSentence();
    await vi.waitFor(() => expect(options.onEnd).toHaveBeenCalledOnce());
    expect(options.onError).toHaveBeenCalledExactlyOnceWith("no-speech");
  });

  it("uploads at once when the caller stops, delivering the transcript before stop resolves", async () => {
    api.fetch.mockResolvedValue(transcript("A quick question"));
    const options = callbacks();
    const session = await startRecordedSpeech(options);
    level = 0.002;
    await vi.advanceTimersByTimeAsync(400);
    level = 0.12;
    await vi.advanceTimersByTimeAsync(600);
    await session.stop();
    expect(options.onTranscript).toHaveBeenCalledExactlyOnceWith("A quick question");
    expect(options.onEnd).toHaveBeenCalledOnce();
    await session.stop();
    expect(api.fetch).toHaveBeenCalledOnce();
  });

  it("still ends the turn at the cap when Web Audio is unavailable", async () => {
    vi.stubGlobal("window", { MediaRecorder: FakeRecorder });
    api.fetch.mockResolvedValue(transcript("Long answer"));
    const options = callbacks();
    await startRecordedSpeech(options);
    await vi.advanceTimersByTimeAsync(RECORDED_SPEECH_LIMITS.maxTurnMs + 200);
    await vi.waitFor(() => expect(options.onEnd).toHaveBeenCalledOnce());
    expect(options.onTranscript).toHaveBeenCalledWith("Long answer");
  });

  it("reports unavailable when the platform cannot record", async () => {
    vi.stubGlobal("window", {});
    const options = callbacks();
    await expect(startRecordedSpeech(options)).rejects.toThrow("Voice recording unavailable");
    expect(options.onError).toHaveBeenCalledExactlyOnceWith("unavailable");
    expect(options.onEnd).toHaveBeenCalledOnce();
    expect(getUserMedia).not.toHaveBeenCalled();
  });
});
