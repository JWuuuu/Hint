import { apiFetch, apiUrl } from "./api";
import type { HintSpeechOptions, HintSpeechSession } from "./speechRecognition";

const MAX_BYTES = 4 * 1024 * 1024;
type SpeechFailure = Parameters<HintSpeechOptions["onError"]>[0];

/** Maps /api/speech/transcription statuses onto the shared voice error reasons. */
async function uploadFailure(response: Response): Promise<SpeechFailure> {
  if (response.status === 429) return "limit";
  if (response.status === 413) return "failed";
  if (response.status === 415) return "unavailable";
  if (response.status === 400) {
    const body = await response.json().catch(() => null) as { code?: unknown } | null;
    return body?.code === "EMPTY_AUDIO" ? "no-speech" : "failed";
  }
  return "backend";
}

export function canRecordSpeech() {
  return typeof MediaRecorder !== "undefined" && typeof navigator !== "undefined" && Boolean(navigator.mediaDevices?.getUserMedia);
}

/** Fallback for embedded browsers whose Web Speech service cannot connect. */
export async function startRecordedSpeech(options: HintSpeechOptions): Promise<HintSpeechSession> {
  const request = new AbortController();
  let stream: MediaStream | undefined;
  let recorder: MediaRecorder | undefined;
  let audio: AudioContext | undefined;
  let monitor: ReturnType<typeof setInterval> | undefined;
  let deadline: ReturnType<typeof setTimeout> | undefined;
  let timeout: ReturnType<typeof setTimeout> | undefined;
  let ended = false, stopping = false, bytes = 0;
  const chunks: Blob[] = [];
  let complete!: () => void;
  const completion = new Promise<void>(resolve => { complete = resolve; });
  function releaseMicrophone() {
    clearInterval(monitor); clearTimeout(deadline);
    stream?.getTracks().forEach(track => track.stop());
    if (audio) { void audio.close().catch(() => undefined); audio = undefined; }
  }
  function finish() {
    if (ended) return;
    ended = true;
    clearTimeout(timeout);
    options.signal?.removeEventListener("abort", cancel);
    if (recorder) { recorder.ondataavailable = null; recorder.onstop = null; recorder.onerror = null; }
    releaseMicrophone();
    chunks.length = 0;
    options.onEnd(); complete();
  }
  function cancel() {
    request.abort();
    finish();
    if (recorder?.state === "recording") recorder.stop();
  }
  function fail(reason: SpeechFailure) {
    if (ended) return;
    options.onError(reason);
    cancel();
  }
  function stop() {
    if (ended || stopping) return completion;
    stopping = true;
    if (recorder?.state === "recording") {
      options.onProcessing?.();
      recorder.stop();
      releaseMicrophone();
    }
    return completion;
  }
  async function transcribe() {
    if (ended) return;
    releaseMicrophone();
    const recording = new Blob(chunks, { type: recorder?.mimeType || chunks[0]?.type || "audio/webm" });
    chunks.length = 0;
    if (!recording.size) { fail("no-speech"); return; }
    options.onProcessing?.();
    timeout = setTimeout(() => fail("network"), 25000);
    try {
      const response = await apiFetch(apiUrl(`/api/speech/transcription?language=${encodeURIComponent(options.language.split("-")[0])}`), {
        method: "POST", headers: { "Content-Type": recording.type }, body: recording, signal: request.signal,
      });
      if (ended) return;
      if (!response.ok) { fail(await uploadFailure(response)); return; }
      const result = await response.json() as { text?: unknown };
      if (ended) return;
      if (typeof result.text !== "string" || !result.text.trim()) { fail("no-speech"); return; }
      options.onTranscript(result.text.trim());
      finish();
    } catch { if (!ended) fail("network"); }
  }
  options.signal?.throwIfAborted();
  options.signal?.addEventListener("abort", cancel, { once: true });
  try {
    if (!canRecordSpeech()) { fail("unavailable"); return { stop, cancel: async () => cancel() }; }
    // Check the service before holding the microphone in a nonfunctional session.
    timeout = setTimeout(() => fail("backend"), 8000);
    const available = await apiFetch(apiUrl("/api/speech/transcription/status"), { signal: request.signal });
    clearTimeout(timeout);
    if (ended) return { stop, cancel: async () => cancel() };
    if (!available.ok) { fail("backend"); return { stop, cancel: async () => cancel() }; }
    const capability = await available.json() as { available?: boolean };
    if (capability.available !== true) { fail("backend"); return { stop, cancel: async () => cancel() }; }
    stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true }, video: false });
    if (ended) { releaseMicrophone(); return { stop, cancel: async () => cancel() }; }
    const mimeType = ["audio/webm;codecs=opus", "audio/mp4", "audio/webm", "audio/ogg;codecs=opus"].find(type => {
      try { return MediaRecorder.isTypeSupported?.(type) ?? false; } catch { return false; }
    });
    recorder = new MediaRecorder(stream, mimeType ? { mimeType, audioBitsPerSecond: 64000 } : undefined);
    recorder.ondataavailable = event => {
      if (ended) return;
      bytes += event.data.size;
      if (bytes > MAX_BYTES) { fail("failed"); return; }
      if (event.data.size) chunks.push(event.data);
    };
    recorder.onerror = () => fail("failed");
    recorder.onstop = () => { void transcribe(); };
    recorder.start(250);
    options.onStart?.();
    if (ended) return { stop, cancel: async () => cancel() };
    deadline = setTimeout(() => { void stop(); }, 45000);
    // Stop after a spoken phrase. Manual Stop remains available if metering is unsupported.
    try {
      const Context = window.AudioContext ?? (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Context) throw new Error("Audio metering unavailable");
      audio = new Context();
      const analyser = audio.createAnalyser(); analyser.fftSize = 2048;
      audio.createMediaStreamSource(stream).connect(analyser);
      void audio.resume().catch(() => undefined);
      const samples = new Float32Array(analyser.fftSize);
      const began = Date.now(); let lastSound = began, heardSpeech = false;
      monitor = setInterval(() => {
        if (audio?.state !== "running") return;
        analyser.getFloatTimeDomainData(samples);
        const rms = Math.sqrt(samples.reduce((sum, value) => sum + value * value, 0) / samples.length);
        if (rms > .015) { heardSpeech = true; lastSound = Date.now(); }
        if (heardSpeech && Date.now() - lastSound > 1500) void stop();
        else if (!heardSpeech && Date.now() - began > 12000) fail("no-speech");
      }, 100);
    } catch { /* Recording and manual Stop work without audio metering. */ }
  } catch (error) {
    if (!ended) {
      const name = error instanceof Error ? error.name : "";
      fail(["NotAllowedError", "SecurityError", "PermissionDeniedError"].includes(name) ? "permission"
        : ["NotFoundError", "DevicesNotFoundError", "OverconstrainedError", "NotReadableError", "TrackStartError"].includes(name) ? "micMissing" : "backend");
    }
  }
  return { stop, cancel: async () => cancel() };
}
