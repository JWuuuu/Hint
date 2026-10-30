import { isNativeShell } from "./mobile/runtime";
import { canRecordSpeech, startRecordedSpeech } from "./recordedSpeech";

type BrowserSpeechResult = {
  isFinal: boolean;
  0?: { transcript?: string };
};

type BrowserSpeechRecognition = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  maxAlternatives: number;
  onstart: (() => void) | null;
  onresult: ((event: {
    resultIndex?: number;
    results: { length: number; [index: number]: BrowserSpeechResult | undefined };
  }) => void) | null;
  onerror: ((event: { error?: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
};

type BrowserSpeechConstructor = new () => BrowserSpeechRecognition;

export type HintSpeechSession = {
  stop: () => Promise<void>;
  cancel: () => Promise<void>;
};

export type HintSpeechOptions = {
  language: string;
  continuous?: boolean;
  signal?: AbortSignal;
  onStart?: () => void;
  onProcessing?: () => void;
  onTranscript: (transcript: string) => void;
  onError: (reason: "unavailable" | "permission" | "micMissing" | "network" | "no-speech" | "failed" | "backend" | "limit") => void;
  onEnd: () => void;
};

function browserSpeechConstructor(): BrowserSpeechConstructor | null {
  if (typeof window === "undefined") return null;
  const speechWindow = window as Window & {
    SpeechRecognition?: BrowserSpeechConstructor;
    webkitSpeechRecognition?: BrowserSpeechConstructor;
  };
  return speechWindow.SpeechRecognition ?? speechWindow.webkitSpeechRecognition ?? null;
}

function browserError(error?: string): Parameters<HintSpeechOptions["onError"]>[0] {
  if (error === "not-allowed") return "permission";
  if (error === "service-not-allowed" || error === "language-not-supported") return "unavailable";
  if (error === "audio-capture") return "micMissing";
  if (error === "network") return "network";
  if (error === "no-speech") return "no-speech";
  return "failed";
}

async function startNativeSpeech(options: HintSpeechOptions): Promise<HintSpeechSession> {
  const { registerPlugin } = await import("@capacitor/core");
  type ListenerHandle = { remove: () => Promise<void> };
  type NativeSpeechPlugin = {
    available: (options: { language: string }) => Promise<{ available: boolean }>;
    requestPermissions: () => Promise<{
      speechRecognition: "granted" | "denied";
      microphone: "granted" | "denied";
    }>;
    start: (options: { language: string }) => Promise<{ matches?: string[] }>;
    stop: () => Promise<void>;
    cancel: () => Promise<void>;
    addListener: (
      event: "partialResults" | "listeningState" | "speechError",
      callback: (result: { matches?: string[]; status?: string; message?: string }) => void,
    ) => Promise<ListenerHandle>;
  };
  const SpeechRecognition = registerPlugin<NativeSpeechPlugin>("HintSpeechRecognition");
  let errorReported = false;
  const reportError = (reason: Parameters<HintSpeechOptions["onError"]>[0]) => {
    if (errorReported) return;
    errorReported = true;
    options.onError(reason);
  };
  let cleanedUp = false;
  let ended = false;
  let startRequested = false;
  let closePromise: Promise<void> | null = null;
  const listenerHandles: ListenerHandle[] = [];
  const finish = () => {
    if (ended) return;
    ended = true;
    options.signal?.removeEventListener("abort", onAbort);
    options.onEnd();
  };
  const removeListeners = async () => {
    if (cleanedUp) return;
    cleanedUp = true;
    await Promise.all(listenerHandles.map((handle) => handle.remove().catch(() => undefined)));
  };
  const cleanup = (cancel: boolean): Promise<void> => {
    if (closePromise) return closePromise;
    if (ended) return Promise.resolve();
    finish();
    closePromise = (async () => {
      try {
        if (cancel) await SpeechRecognition.cancel();
        else await SpeechRecognition.stop();
      } catch {
        // Listener cleanup must still complete if the native session has ended.
      } finally {
        await removeListeners();
      }
    })();
    return closePromise;
  };
  const onAbort = () => { void cleanup(true); };
  const checkCancelled = () => options.signal?.throwIfAborted();

  let result: { matches?: string[] };
  try {
    checkCancelled();
    let availability: { available: boolean };
    try {
      availability = await SpeechRecognition.available({ language: options.language });
    } catch (error) {
      // Shells without the native recogniser (or a broken bridge) can still record a turn.
      if (!options.signal?.aborted && canRecordSpeech()) return startRecordedSpeech(options);
      throw error;
    }
    checkCancelled();
    if (!availability.available) {
      if (canRecordSpeech()) return startRecordedSpeech(options);
      reportError("unavailable");
      throw new Error("Speech recognition unavailable");
    }
    const permission = await SpeechRecognition.requestPermissions();
    checkCancelled();
    if (permission.speechRecognition !== "granted" || permission.microphone !== "granted") {
      reportError("permission");
      throw new Error("Speech recognition permission denied");
    }
    const partialHandle = await SpeechRecognition.addListener(
      "partialResults",
      ({ matches }) => {
        if (ended || options.signal?.aborted) return;
        const transcript = matches?.[0]?.trim();
        if (transcript) options.onTranscript(transcript);
      },
    );
    listenerHandles.push(partialHandle);
    checkCancelled();
    const stateHandle = await SpeechRecognition.addListener(
      "listeningState",
      ({ status }) => {
        if (status !== "stopped") return;
        void removeListeners();
        finish();
      },
    );
    listenerHandles.push(stateHandle);
    checkCancelled();
    const errorHandle = await SpeechRecognition.addListener(
      "speechError",
      () => {
        if (ended || options.signal?.aborted) return;
        reportError("failed");
        void cleanup(true);
      },
    );
    listenerHandles.push(errorHandle);
    checkCancelled();
    startRequested = true;
    result = await SpeechRecognition.start({
      language: options.language,
    });
    checkCancelled();
  } catch (error) {
    if (!options.signal?.aborted) reportError("failed");
    if (startRequested) await cleanup(true);
    await removeListeners();
    finish();
    throw error;
  }
  const directTranscript = result.matches?.[0]?.trim();
  if (!ended) {
    if (directTranscript) options.onTranscript(directTranscript);
    options.signal?.addEventListener("abort", onAbort, { once: true });
    options.onStart?.();
  }
  return {
    stop: () => cleanup(false),
    cancel: () => cleanup(true),
  };
}

function startBrowserSpeech(options: HintSpeechOptions): HintSpeechSession {
  options.signal?.throwIfAborted();
  const Recognition = browserSpeechConstructor();
  if (!Recognition) {
    options.onError("unavailable");
    options.onEnd();
    throw new Error("Speech recognition unavailable");
  }
  const recognition = new Recognition();
  recognition.continuous = options.continuous ?? true;
  recognition.interimResults = true;
  recognition.lang = options.language;
  recognition.maxAlternatives = 1;
  let finalText = "";
  let ended = false;
  let stopping = false;
  let stopTimeout: ReturnType<typeof setTimeout> | undefined;
  let resolveStop!: () => void;
  const stopped = new Promise<void>(resolve => { resolveStop = resolve; });
  let errorReported = false;
  const finish = () => {
    if (ended) return;
    ended = true;
    clearTimeout(stopTimeout);
    recognition.onstart = null;
    recognition.onresult = null;
    recognition.onerror = null;
    recognition.onend = null;
    options.signal?.removeEventListener("abort", onAbort);
    options.onEnd();
    resolveStop();
  };
  const reportError = (reason: Parameters<HintSpeechOptions["onError"]>[0]) => {
    if (errorReported) return;
    errorReported = true;
    options.onError(reason);
  };
  recognition.onstart = () => { if (!ended) options.onStart?.(); };
  recognition.onresult = (event) => {
    if (ended) return;
    finalText = "";
    let interimText = "";
    for (let index = 0; index < event.results.length; index += 1) {
      const result = event.results[index];
      const transcript = result?.[0]?.transcript?.trim() ?? "";
      if (!transcript) continue;
      if (result?.isFinal) finalText = `${finalText} ${transcript}`.trim();
      else interimText = `${interimText} ${transcript}`.trim();
    }
    options.onTranscript(`${finalText} ${interimText}`.trim());
  };
  recognition.onerror = (event) => {
    reportError(browserError(event.error));
    finish();
  };
  recognition.onend = finish;
  const onAbort = () => { close(true); };
  const close = (cancel: boolean) => {
    if (ended) return;
    if (cancel) finish();
    else if (stopping) return;
    else {
      stopping = true;
      options.onProcessing?.();
      // stop() flushes a final result before onend; abort() discards it.
      stopTimeout = setTimeout(() => { finish(); try { recognition.abort(); } catch { /* Already closed. */ } }, 2500);
    }
    try {
      if (cancel) recognition.abort();
      else recognition.stop();
    } catch {
      if (!cancel) reportError("failed");
      finish();
    }
  };
  try {
    recognition.start();
    if (!ended) {
      options.signal?.addEventListener("abort", onAbort, { once: true });
    }
  } catch (error) {
    reportError("failed");
    finish();
    throw error;
  }
  return {
    stop: async () => { close(false); await stopped; },
    cancel: async () => close(true),
  };
}

let useRecordingService = false;
export async function startHintSpeechRecognition(
  options: HintSpeechOptions,
): Promise<HintSpeechSession> {
  if (isNativeShell()) return startNativeSpeech(options);
  if ((!browserSpeechConstructor() || useRecordingService) && canRecordSpeech()) return startRecordedSpeech(options);
  let fallback = false, receivedText = false;
  let active: HintSpeechSession | undefined;
  let pending: Promise<HintSpeechSession> | undefined;
  const abort = new AbortController();
  const cancel = () => { abort.abort(); void active?.cancel(); };
  options.signal?.throwIfAborted();
  options.signal?.addEventListener("abort", cancel, { once: true });
  const finish = () => { options.signal?.removeEventListener("abort", cancel); options.onEnd(); };
  const shared = { ...options, signal: abort.signal, onEnd: finish };
  try {
    const browser = startBrowserSpeech({ ...shared,
      onTranscript: text => { receivedText ||= Boolean(text.trim()); options.onTranscript(text); },
      onError: reason => {
        if (!receivedText && ["network", "unavailable"].includes(reason) && canRecordSpeech() && !abort.signal.aborted) {
          fallback = true; useRecordingService = true;
          options.onProcessing?.();
          pending = startRecordedSpeech(shared).then(session => { active = session; return session; });
          void pending.catch(() => { if (!abort.signal.aborted) { options.onError("backend"); finish(); } });
        } else options.onError(reason);
      },
      onEnd: () => { if (!fallback) finish(); },
    });
    if (!fallback) active = browser;
  } catch (error) {
    options.signal?.removeEventListener("abort", cancel);
    throw error;
  }
  return { stop: async () => { await (pending ? await pending : active)?.stop(); }, cancel: async () => { cancel(); } };
}
