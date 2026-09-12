import { isNativeShell } from "./mobile/runtime";

type BrowserSpeechResult = {
  isFinal: boolean;
  0?: { transcript?: string };
};

type BrowserSpeechRecognition = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  maxAlternatives: number;
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
  signal?: AbortSignal;
  onStart?: () => void;
  onTranscript: (transcript: string) => void;
  onError: (reason: "unavailable" | "permission" | "network" | "no-speech" | "failed") => void;
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
  if (error === "not-allowed" || error === "service-not-allowed") return "permission";
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
    const availability = await SpeechRecognition.available({ language: options.language });
    checkCancelled();
    if (!availability.available) {
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
    if (startRequested) await cleanup(true);
    await removeListeners();
    if (!options.signal?.aborted) reportError("failed");
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
    throw new Error("Speech recognition unavailable");
  }
  const recognition = new Recognition();
  recognition.continuous = true;
  recognition.interimResults = true;
  recognition.lang = options.language;
  recognition.maxAlternatives = 1;
  let finalText = "";
  let ended = false;
  let errorReported = false;
  const finish = () => {
    if (ended) return;
    ended = true;
    recognition.onresult = null;
    recognition.onerror = null;
    recognition.onend = null;
    options.signal?.removeEventListener("abort", onAbort);
    options.onEnd();
  };
  const reportError = (reason: Parameters<HintSpeechOptions["onError"]>[0]) => {
    if (errorReported) return;
    errorReported = true;
    options.onError(reason);
  };
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
    // Detach callbacks first: abort can emit an expected "aborted" error synchronously.
    finish();
    try {
      if (cancel) recognition.abort();
      else recognition.stop();
    } catch {
      if (!cancel) reportError("failed");
    }
  };
  try {
    recognition.start();
    if (!ended) {
      options.signal?.addEventListener("abort", onAbort, { once: true });
      options.onStart?.();
    }
  } catch (error) {
    reportError("failed");
    finish();
    throw error;
  }
  return {
    stop: async () => close(false),
    cancel: async () => close(true),
  };
}

export async function startHintSpeechRecognition(
  options: HintSpeechOptions,
): Promise<HintSpeechSession> {
  if (isNativeShell()) return startNativeSpeech(options);
  return startBrowserSpeech(options);
}
