import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const native = vi.hoisted(() => {
  const listeners = new Map<string, (result: Record<string, unknown>) => void>();
  const removers: Array<ReturnType<typeof vi.fn>> = [];
  const plugin = {
    available: vi.fn(async () => ({ available: true })),
    requestPermissions: vi.fn(async () => ({
      speechRecognition: "granted",
      microphone: "granted",
    })),
    start: vi.fn(async () => ({ matches: [] as string[] })),
    stop: vi.fn(async () => undefined),
    cancel: vi.fn(async () => undefined),
    addListener: vi.fn(async (
      event: string,
      callback: (result: Record<string, unknown>) => void,
    ) => {
      listeners.set(event, callback);
      const remove = vi.fn(async () => undefined);
      removers.push(remove);
      return { remove };
    }),
  };
  return { isNativeShell: vi.fn(() => true), listeners, removers, plugin };
});

vi.mock("./mobile/runtime", () => ({ isNativeShell: native.isNativeShell }));
vi.mock("@capacitor/core", () => ({ registerPlugin: () => native.plugin }));

import { startHintSpeechRecognition } from "./speechRecognition";

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => { resolve = done; });
  return { promise, resolve };
}

function options() {
  return {
    language: "en-US",
    onStart: vi.fn(),
    onTranscript: vi.fn(),
    onError: vi.fn(),
    onEnd: vi.fn(),
  };
}

describe("native Hint speech recognition", () => {
  beforeEach(() => {
    native.isNativeShell.mockReturnValue(true);
    native.listeners.clear();
    native.removers.length = 0;
    Object.values(native.plugin).forEach((value) => {
      if (typeof value === "function" && "mockClear" in value) value.mockClear();
    });
    native.plugin.available.mockResolvedValue({ available: true });
    native.plugin.requestPermissions.mockResolvedValue({
      speechRecognition: "granted",
      microphone: "granted",
    });
    native.plugin.start.mockResolvedValue({ matches: [] });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("removes native listeners when iOS stops the recording", async () => {
    const callbacks = options();
    const session = await startHintSpeechRecognition(callbacks);

    native.listeners.get("listeningState")?.({ status: "stopped" });

    await vi.waitFor(() => {
      expect(native.removers).toHaveLength(3);
      native.removers.forEach((remove) => expect(remove).toHaveBeenCalledOnce());
    });
    expect(callbacks.onEnd).toHaveBeenCalledOnce();

    await session.cancel();
    expect(native.plugin.cancel).not.toHaveBeenCalled();
  });

  it("cleans listeners and reports failure when native startup rejects", async () => {
    const callbacks = options();
    native.plugin.start.mockRejectedValueOnce(new Error("audio session unavailable"));

    await expect(startHintSpeechRecognition(callbacks)).rejects.toThrow(
      "audio session unavailable",
    );

    expect(callbacks.onError).toHaveBeenCalledWith("failed");
    expect(native.removers).toHaveLength(3);
    native.removers.forEach((remove) => expect(remove).toHaveBeenCalledOnce());
  });

  it("ends a native speech session exactly once when iOS reports an error and then stops", async () => {
    const callbacks = options();
    await startHintSpeechRecognition(callbacks);

    native.listeners.get("speechError")?.({ message: "recognition failed" });
    native.listeners.get("listeningState")?.({ status: "stopped" });

    await vi.waitFor(() => {
      expect(callbacks.onError).toHaveBeenCalledOnce();
      expect(callbacks.onEnd).toHaveBeenCalledOnce();
      native.removers.forEach((remove) => expect(remove).toHaveBeenCalledOnce());
    });
  });

  it("removes partial native setup when listener registration rejects", async () => {
    const callbacks = options();
    const firstRemove = vi.fn(async () => undefined);
    native.plugin.addListener
      .mockImplementationOnce(async () => {
        native.removers.push(firstRemove);
        return { remove: firstRemove };
      })
      .mockRejectedValueOnce(new Error("listener unavailable"));

    await expect(startHintSpeechRecognition(callbacks)).rejects.toThrow(
      "listener unavailable",
    );

    expect(firstRemove).toHaveBeenCalledOnce();
    expect(native.plugin.start).not.toHaveBeenCalled();
    expect(callbacks.onError).toHaveBeenCalledOnce();
    expect(callbacks.onError).toHaveBeenCalledWith("failed");
  });

  it("does not start recording after cancellation during the permission prompt", async () => {
    const callbacks = options();
    const controller = new AbortController();
    const permission = deferred<{ speechRecognition: string; microphone: string }>();
    native.plugin.requestPermissions.mockReturnValueOnce(permission.promise);
    const pending = startHintSpeechRecognition({ ...callbacks, signal: controller.signal });
    const rejected = expect(pending).rejects.toMatchObject({ name: "AbortError" });
    await vi.waitFor(() => expect(native.plugin.requestPermissions).toHaveBeenCalledOnce());
    controller.abort();
    permission.resolve({ speechRecognition: "granted", microphone: "granted" });
    await rejected;
    expect(native.plugin.start).not.toHaveBeenCalled();
    expect(native.plugin.addListener).not.toHaveBeenCalled();
    expect(callbacks.onError).not.toHaveBeenCalled();
    expect(callbacks.onStart).not.toHaveBeenCalled();
    expect(callbacks.onEnd).toHaveBeenCalledOnce();
  });

  it("cancels a recording that finishes starting after its sheet was closed", async () => {
    const callbacks = options();
    const controller = new AbortController();
    const start = deferred<{ matches: string[] }>();
    native.plugin.start.mockReturnValueOnce(start.promise);
    const pending = startHintSpeechRecognition({ ...callbacks, signal: controller.signal });
    const rejected = expect(pending).rejects.toMatchObject({ name: "AbortError" });
    await vi.waitFor(() => expect(native.plugin.start).toHaveBeenCalledOnce());
    controller.abort();
    native.listeners.get("partialResults")?.({ matches: ["Late private transcript"] });
    start.resolve({ matches: ["Late private transcript"] });
    await rejected;
    expect(native.plugin.cancel).toHaveBeenCalledOnce();
    native.removers.forEach((remove) => expect(remove).toHaveBeenCalledOnce());
    expect(callbacks.onTranscript).not.toHaveBeenCalled();
    expect(callbacks.onError).not.toHaveBeenCalled();
    expect(callbacks.onEnd).toHaveBeenCalledOnce();
  });

  it("ignores late native callbacks after cancellation and releases the microphone once", async () => {
    const callbacks = options();
    const controller = new AbortController();
    const session = await startHintSpeechRecognition({ ...callbacks, signal: controller.signal });
    controller.abort();
    await session.cancel();
    native.listeners.get("partialResults")?.({ matches: ["Old recording"] });
    native.listeners.get("speechError")?.({ message: "cancelled" });
    native.listeners.get("listeningState")?.({ status: "stopped" });
    expect(native.plugin.cancel).toHaveBeenCalledOnce();
    expect(callbacks.onTranscript).not.toHaveBeenCalled();
    expect(callbacks.onError).not.toHaveBeenCalled();
    expect(callbacks.onEnd).toHaveBeenCalledOnce();
  });

  it("reports bridge availability failures for the typed fallback", async () => {
    const callbacks = options();
    native.plugin.available.mockRejectedValueOnce(new Error("bridge unavailable"));
    await expect(startHintSpeechRecognition(callbacks)).rejects.toThrow("bridge unavailable");
    expect(callbacks.onError).toHaveBeenCalledWith("failed");
    expect(callbacks.onEnd).toHaveBeenCalledOnce();
  });

  it("uses real browser dictation results and exposes stop controls", async () => {
    const callbacks = options();
    const stop = vi.fn();
    const abort = vi.fn();
    let recognition:
      | {
          continuous: boolean;
          interimResults: boolean;
          lang: string;
          maxAlternatives: number;
          onresult: ((event: {
            resultIndex: number;
            results: { length: number; 0: { isFinal: boolean; 0: { transcript: string } } };
          }) => void) | null;
          onerror: ((event: { error?: string }) => void) | null;
          onend: (() => void) | null;
        }
      | undefined;

    class BrowserRecognition {
      continuous = false;
      interimResults = false;
      lang = "";
      maxAlternatives = 0;
      onresult = null;
      onerror = null;
      onend = null;
      start = vi.fn();
      stop = stop;
      abort = abort;

      constructor() {
        recognition = this;
      }
    }

    native.isNativeShell.mockReturnValue(false);
    vi.stubGlobal("window", { SpeechRecognition: BrowserRecognition });

    const session = await startHintSpeechRecognition(callbacks);
    expect(recognition).toMatchObject({
      continuous: true,
      interimResults: true,
      lang: "en-US",
      maxAlternatives: 1,
    });
    recognition?.onresult?.({
      resultIndex: 0,
      results: {
        0: { isFinal: true, 0: { transcript: "What should I notice?" } },
        length: 1,
      },
    });
    expect(callbacks.onTranscript).toHaveBeenCalledWith("What should I notice?");
    recognition?.onresult?.({
      resultIndex: 0,
      results: {
        0: { isFinal: true, 0: { transcript: "What should I notice?" } },
        length: 1,
      },
    });
    expect(callbacks.onTranscript).toHaveBeenLastCalledWith("What should I notice?");

    await session.stop();
    expect(stop).toHaveBeenCalledOnce();
    await session.cancel();
    expect(abort).not.toHaveBeenCalled();
    expect(callbacks.onEnd).toHaveBeenCalledOnce();
  });

  it("reports and ends browser dictation when recognition fails during startup", async () => {
    const callbacks = options();
    class BrowserRecognition {
      continuous = false;
      interimResults = false;
      lang = "";
      maxAlternatives = 0;
      onresult = null;
      onerror = null;
      onend = null;
      start = () => {
        throw new Error("microphone unavailable");
      };
      stop = vi.fn();
      abort = vi.fn();
    }

    native.isNativeShell.mockReturnValue(false);
    vi.stubGlobal("window", { SpeechRecognition: BrowserRecognition });

    await expect(startHintSpeechRecognition(callbacks)).rejects.toThrow(
      "microphone unavailable",
    );
    expect(callbacks.onError).toHaveBeenCalledOnce();
    expect(callbacks.onError).toHaveBeenCalledWith("failed");
    expect(callbacks.onEnd).toHaveBeenCalledOnce();
  });
});
