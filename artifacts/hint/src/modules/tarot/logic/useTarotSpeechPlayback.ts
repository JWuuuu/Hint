import { useCallback, useEffect, useRef, useState } from "react";
import { apiFetch, apiUrl } from "../../../lib/api";
import { addNativeAppStateListener } from "../../../lib/mobile/appLifecycle";

export function splitSpokenReading(text: string): string[] {
  const chunks: string[] = [];
  let rest = text.trim();
  while (rest.length > 3900) {
    const prefix = rest.slice(0, 3900);
    const boundary = Math.max(prefix.lastIndexOf(". "), prefix.lastIndexOf("。"), prefix.lastIndexOf("\n"));
    const space = prefix.lastIndexOf(" ");
    const end = boundary > 1950 ? boundary + 1 : space > 1950 ? space : 3900;
    chunks.push(rest.slice(0, end).trim());
    rest = rest.slice(end).trim();
  }
  if (rest) chunks.push(rest);
  return chunks;
}

export function useTarotSpeechPlayback() {
  const [state, setState] = useState<{ id: string | null; status: "idle" | "loading" | "playing" | "error" }>({ id: null, status: "idle" });
  const request = useRef<AbortController | null>(null);
  const stop = useCallback(() => {
    request.current?.abort();
    request.current = null;
    setState({ id: null, status: "idle" });
  }, []);

  useEffect(() => {
    const hidden = () => { if (document.hidden) stop(); };
    document.addEventListener("visibilitychange", hidden);
    const removeNative = addNativeAppStateListener(active => { if (!active) stop(); });
    return () => {
      document.removeEventListener("visibilitychange", hidden);
      void removeNative.then(remove => remove()).catch(() => undefined);
      request.current?.abort();
      request.current = null;
    };
  }, [stop]);

  const play = useCallback(async (text: string, id: string): Promise<boolean> => {
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    try {
      for (const chunk of splitSpokenReading(text)) {
        setState({ id, status: "loading" });
        const timeout = setTimeout(() => controller.abort(), 25_000);
        let blob: Blob;
        try {
          const response = await apiFetch(apiUrl("/api/speech"), {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ text: chunk }), signal: controller.signal,
          });
          if (!response.ok) throw new Error("Speech unavailable");
          blob = await response.blob();
        } finally { clearTimeout(timeout); }
        controller.signal.throwIfAborted();
        const url = URL.createObjectURL(blob);
        const audio = new Audio(url);
        try {
          await new Promise<void>((resolve, reject) => {
            const finish = (error?: unknown) => {
              audio.onended = null; audio.onerror = null;
              controller.signal.removeEventListener("abort", aborted);
              error ? reject(error) : resolve();
            };
            const aborted = () => { audio.pause(); finish(new DOMException("Playback stopped", "AbortError")); };
            controller.signal.addEventListener("abort", aborted, { once: true });
            audio.onended = () => finish();
            audio.onerror = () => finish(new Error("Playback unavailable"));
            void audio.play().then(() => {
              if (controller.signal.aborted) { audio.pause(); return; }
              setState({ id, status: "playing" });
            }, finish);
          });
        } finally { audio.pause(); URL.revokeObjectURL(url); }
      }
      if (request.current === controller) setState({ id: null, status: "idle" });
      return true;
    } catch {
      if (request.current === controller) setState({ id, status: "error" });
      return false;
    } finally { if (request.current === controller) request.current = null; }
  }, []);

  return { ...state, play, stop };
}
