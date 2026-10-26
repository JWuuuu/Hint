import { apiFetch, apiUrl } from "./api";
import type { HintSpeechOptions, HintSpeechSession } from "./speechRecognition";

/**
 * Voice input for devices without on-device speech recognition (Android
 * WebView, Firefox, iOS without Siri dictation). One spoken turn is recorded
 * with MediaRecorder, ended by a simple level-based silence detector, and
 * transcribed by the Hint API (POST /api/transcribe).
 *
 * It honours the same HintSpeechSession contract as the browser and native
 * recognisers: onStart once recording begins, one onTranscript with the final
 * text, onError at most once, and onEnd exactly once.
 */

type SpeechFailure = Parameters<HintSpeechOptions["onError"]>[0];

export const RECORDED_SPEECH_LIMITS = {
  /** Hard cap for one turn; matches the server's upload ceiling with room to spare. */
  maxTurnMs: 30_000,
  /** Give up when nothing louder than the room is heard for this long. */
  noSpeechMs: 8_000,
  /** Silence after speech that ends a single-turn recording. */
  endSilenceMs: 1_300,
  /** Longer pause allowance when the caller asked for continuous dictation. */
  continuousEndSilenceMs: 2_200,
  /** Sustained level needed before the turn counts as speech (ignores clicks). */
  minSpeechMs: 200,
  calibrationMs: 300,
  pollMs: 100,
  uploadTimeoutMs: 25_000,
  /** Smaller blobs are container headers without audio. */
  minAudioBytes: 512,
} as const;

const MIME_TYPES = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg;codecs=opus", "audio/ogg"];

export function recordedSpeechSupported(): boolean {
  if (typeof window === "undefined" || typeof navigator === "undefined") return false;
  return typeof window.MediaRecorder === "function" && typeof navigator.mediaDevices?.getUserMedia === "function";
}

function pickMimeType(): string | undefined {
  const isTypeSupported = window.MediaRecorder.isTypeSupported?.bind(window.MediaRecorder);
  if (!isTypeSupported) return undefined;
  return MIME_TYPES.find((type) => {
    try { return isTypeSupported(type); } catch { return false; }
  });
}

function microphoneFailure(error: unknown): SpeechFailure {
  const name = error && typeof error === "object" && "name" in error ? String(error.name) : "";
  if (["NotAllowedError", "SecurityError", "PermissionDeniedError"].includes(name)) return "permission";
  if (["NotFoundError", "DevicesNotFoundError", "OverconstrainedError", "NotReadableError", "TrackStartError"].includes(name)) return "micMissing";
  return "failed";
}

type LevelMeter = { level: () => number; close: () => void };

/** RMS input level for silence detection; null when the platform cannot run Web Audio now. */
async function createLevelMeter(stream: MediaStream): Promise<LevelMeter | null> {
  const audioWindow = window as typeof window & { webkitAudioContext?: typeof AudioContext };
  const Context = audioWindow.AudioContext ?? audioWindow.webkitAudioContext;
  if (!Context) return null;
  let context: AudioContext;
  try { context = new Context(); } catch { return null; }
  const close = () => { void context.close().catch(() => undefined); };
  try {
    if (context.state === "suspended") {
      // resume() can stay pending forever when autoplay rules refuse it.
      await Promise.race([context.resume().catch(() => undefined), new Promise((resolve) => setTimeout(resolve, 500))]);
    }
    if (context.state !== "running") { close(); return null; }
    const source = context.createMediaStreamSource(stream);
    const analyser = context.createAnalyser();
    analyser.fftSize = 1024;
    source.connect(analyser);
    const samples = new Float32Array(analyser.fftSize);
    return {
      level: () => {
        analyser.getFloatTimeDomainData(samples);
        let sum = 0;
        for (let index = 0; index < samples.length; index += 1) sum += samples[index]! * samples[index]!;
        return Math.sqrt(sum / samples.length);
      },
      close: () => {
        try { source.disconnect(); } catch { /* already disconnected */ }
        close();
      },
    };
  } catch {
    close();
    return null;
  }
}

class TranscriptionFailure extends Error {
  constructor(readonly reason: SpeechFailure) { super(`Transcription failed: ${reason}`); }
}

async function transcribe(blob: Blob, language: string, signal: AbortSignal): Promise<string> {
  const timeout = new AbortController();
  const timer = setTimeout(() => timeout.abort(), RECORDED_SPEECH_LIMITS.uploadTimeoutMs);
  const forward = () => timeout.abort();
  signal.addEventListener("abort", forward, { once: true });
  try {
    const response = await apiFetch(apiUrl(`/api/transcribe?language=${encodeURIComponent(language)}`), {
      method: "POST",
      headers: { "Content-Type": blob.type.split(";")[0] || "audio/webm" },
      body: blob,
      signal: timeout.signal,
    });
    if (response.status === 400) return "";
    if (response.status === 415) throw new TranscriptionFailure("unavailable");
    if (response.status === 429 || response.status === 413) throw new TranscriptionFailure("failed");
    if (!response.ok) throw new TranscriptionFailure("network");
    const body = await response.json() as { text?: unknown };
    return typeof body.text === "string" ? body.text.trim() : "";
  } catch (error) {
    if (error instanceof TranscriptionFailure) throw error;
    throw new TranscriptionFailure("network");
  } finally {
    clearTimeout(timer);
    signal.removeEventListener("abort", forward);
  }
}

export async function startRecordedSpeech(options: HintSpeechOptions): Promise<HintSpeechSession> {
  const limits = RECORDED_SPEECH_LIMITS;
  let ended = false;
  let errorReported = false;
  let stream: MediaStream | null = null;
  let meter: LevelMeter | null = null;
  let recorder: MediaRecorder | null = null;
  let poll: ReturnType<typeof setInterval> | null = null;
  let closing: Promise<void> | null = null;
  const upload = new AbortController();

  const reportError = (reason: SpeechFailure) => {
    if (errorReported || ended || options.signal?.aborted) return;
    errorReported = true;
    options.onError(reason);
  };
  const release = () => {
    if (poll) clearInterval(poll);
    poll = null;
    meter?.close();
    meter = null;
    stream?.getTracks().forEach((track) => track.stop());
    stream = null;
  };
  const finish = () => {
    if (ended) return;
    ended = true;
    release();
    options.signal?.removeEventListener("abort", onAbort);
    options.onEnd();
  };
  const cancel = async () => {
    if (ended) return;
    upload.abort();
    try { if (recorder && recorder.state !== "inactive") recorder.stop(); } catch { /* already stopped */ }
    finish();
  };
  const onAbort = () => { void cancel(); };
  const failStartup = (reason: SpeechFailure, error: unknown): never => {
    reportError(reason);
    finish();
    throw error;
  };
  const abortIfCancelled = () => {
    if (!options.signal?.aborted) return;
    finish();
    options.signal.throwIfAborted();
  };

  options.signal?.throwIfAborted();
  if (!recordedSpeechSupported()) failStartup("unavailable", new Error("Voice recording unavailable"));

  try {
    stream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
    });
  } catch (error) {
    failStartup(microphoneFailure(error), error);
  }
  abortIfCancelled();
  meter = await createLevelMeter(stream!);
  abortIfCancelled();
  const metered = meter !== null;

  const endSilenceMs = options.continuous ? limits.continuousEndSilenceMs : limits.endSilenceMs;
  let heard = false;
  let voicedMs = 0;
  let lastVoiceAt = 0;
  let floorSum = 0;
  let floorSamples = 0;

  const mimeType = pickMimeType();
  const chunks: Blob[] = [];
  try {
    recorder = new window.MediaRecorder(stream!, mimeType ? { mimeType } : undefined);
  } catch (error) {
    failStartup("failed", error);
  }
  const activeRecorder = recorder!;
  const stopped = new Promise<void>((resolve) => {
    activeRecorder.addEventListener("stop", () => resolve(), { once: true });
  });
  activeRecorder.addEventListener("dataavailable", (event) => {
    if (event.data && event.data.size > 0) chunks.push(event.data);
  });
  activeRecorder.addEventListener("error", () => {
    reportError("failed");
    void cancel();
  });

  const stop = (): Promise<void> => {
    if (closing) return closing;
    if (ended) return Promise.resolve();
    closing = (async () => {
      if (poll) clearInterval(poll);
      poll = null;
      try {
        if (activeRecorder.state !== "inactive") {
          activeRecorder.stop();
          await stopped;
        }
      } catch { /* the recorder already stopped */ }
      // The microphone is released before the upload so the indicator turns off at once.
      release();
      if (ended) return;
      const blob = new Blob(chunks, { type: activeRecorder.mimeType || mimeType || chunks[0]?.type || "audio/webm" });
      if ((metered && !heard) || blob.size < limits.minAudioBytes) {
        reportError("no-speech");
        finish();
        return;
      }
      try {
        const text = await transcribe(blob, options.language, upload.signal);
        if (ended) return;
        if (text) options.onTranscript(text);
        else reportError("no-speech");
      } catch (error) {
        if (!ended && !upload.signal.aborted) {
          reportError(error instanceof TranscriptionFailure ? error.reason : "network");
        }
      }
      finish();
    })();
    return closing;
  };

  try {
    activeRecorder.start(250);
  } catch (error) {
    failStartup("failed", error);
  }
  options.signal?.addEventListener("abort", onAbort, { once: true });
  options.onStart?.();

  const startedAt = Date.now();
  poll = setInterval(() => {
    if (ended || closing) return;
    const elapsed = Date.now() - startedAt;
    if (elapsed >= limits.maxTurnMs) { void stop(); return; }
    // Without a level meter the turn ends at the cap or when the caller stops it.
    if (!meter) return;
    const level = meter.level();
    if (elapsed < limits.calibrationMs) {
      floorSum += level;
      floorSamples += 1;
      return;
    }
    // Speech starting immediately would inflate the room estimate, so clamp it.
    const floor = floorSamples ? floorSum / floorSamples : 0;
    const threshold = Math.min(0.035, Math.max(0.01, floor * 2.5));
    if (level > threshold) {
      voicedMs += limits.pollMs;
      lastVoiceAt = elapsed;
      if (voicedMs >= limits.minSpeechMs) heard = true;
    } else if (!heard) {
      voicedMs = Math.max(0, voicedMs - limits.pollMs);
    }
    if (heard && elapsed - lastVoiceAt >= endSilenceMs) void stop();
    else if (!heard && elapsed >= limits.noSpeechMs) {
      reportError("no-speech");
      void cancel();
    }
  }, limits.pollMs);

  return { stop, cancel };
}
