import { useCallback, useEffect, useRef, useState } from "react";
import { startHintSpeechRecognition, type HintSpeechSession } from "../../../lib/speechRecognition";
import { addNativeAppStateListener } from "../../../lib/mobile/appLifecycle";
import type { HintLanguage } from "../../../lib/i18n";

export function useReadingDictation({ draft, onDraft, onComplete, language, t }: {
  draft: string;
  onDraft: (text: string) => void;
  onComplete: (text: string) => void;
  language: HintLanguage;
  t: (key: string) => string;
}) {
  const [status, setStatus] = useState<"idle" | "starting" | "listening" | "processing">("idle");
  const [notice, setNotice] = useState<string | null>(null);
  const controller = useRef<AbortController | null>(null);
  const session = useRef<HintSpeechSession | null>(null);
  const silence = useRef<ReturnType<typeof setTimeout> | null>(null);
  const submitOnEnd = useRef(true);
  const latest = useRef({ onDraft, onComplete });
  latest.current = { onDraft, onComplete };

  const stop = useCallback(() => {
    if (silence.current) clearTimeout(silence.current);
    const activeSession = session.current;
    session.current = null;
    controller.current?.abort();
    controller.current = null;
    void activeSession?.cancel();
    setStatus("idle");
  }, []);

  useEffect(() => {
    const onVisibility = () => { if (document.hidden) stop(); };
    document.addEventListener("visibilitychange", onVisibility);
    const removeNative = addNativeAppStateListener((active) => { if (!active) stop(); }).catch(() => async () => undefined);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      void removeNative.then(remove => remove()).catch(() => undefined);
      if (silence.current) clearTimeout(silence.current);
      controller.current?.abort();
      void session.current?.cancel();
      session.current = null;
    };
  }, [stop]);

  async function start() {
    if (controller.current) {
      if (session.current && status === "listening") {
        // A manual stop keeps the finished words in the editable draft.
        submitOnEnd.current = false;
        const stoppingRequest = controller.current;
        await session.current.stop();
        if (controller.current === stoppingRequest) stop();
      }
      else stop();
      return;
    }
    const request = new AbortController();
    controller.current = request;
    submitOnEnd.current = true;
    const prefix = draft.trimEnd();
    const current = () => controller.current === request && !request.signal.aborted;
    const locale = { en: "en-US", zh: "zh-CN", es: "es-ES", ja: "ja-JP", ko: "ko-KR" }[language];
    let ended = false;
    let transcript = "";
    const finish = () => {
      if (!current() || ended) return;
      ended = true;
      const text = transcript.trim();
      stop();
      if (text && submitOnEnd.current && !document.hidden) latest.current.onComplete([prefix, text].filter(Boolean).join(" "));
    };
    setNotice(null);
    setStatus("starting");
    silence.current = setTimeout(() => {
      if (!current() || ended) return;
      ended = true;
      stop();
      setNotice(t("tarot.voice.failed"));
    }, 12000);
    try {
      const next = await startHintSpeechRecognition({
        language: locale,
        continuous: false,
        signal: request.signal,
        onStart: () => {
          if (!current()) return;
          if (silence.current) clearTimeout(silence.current);
          setStatus("listening");
        },
        onProcessing: () => {
          if (!current() || ended) return;
          if (silence.current) clearTimeout(silence.current);
          setStatus("processing");
        },
        onTranscript: text => {
          if (!current() || ended) return;
          transcript = text;
          latest.current.onDraft([prefix, text.trim()].filter(Boolean).join(" "));
          if (silence.current) clearTimeout(silence.current);
          if (text.trim()) silence.current = setTimeout(finish, 1200);
        },
        onError: reason => {
          if (!current()) return;
          const key = reason === "no-speech" ? "noSpeech" : reason === "unavailable" ? "unavailable" : reason;
          ended = true;
          stop();
          setNotice(t(`tarot.voice.${key}`));
        },
        onEnd: finish,
      });
      if (!current() || ended) await next.cancel();
      else session.current = next;
    } catch {
      if (current()) {
        ended = true;
        stop();
        setNotice(value => value ?? t("tarot.voice.failed"));
      }
    }
  }

  return { status, notice, start, stop };
}
