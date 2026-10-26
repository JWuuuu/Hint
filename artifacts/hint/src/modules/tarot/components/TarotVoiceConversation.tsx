import { useEffect, useRef, useState } from "react";
import { Check, MessageSquareText, Mic, MicOff, Pause, Play, RotateCcw, X } from "lucide-react";
import { Dialog, DialogSurface, DialogTitle } from "../../../components/ui/dialog";
import { ConstellationBackdrop } from "../../../components/app/ConstellationBackdrop";
import { useLanguage } from "../../../lib/i18n";
import { startHintSpeechRecognition, type HintSpeechSession } from "../../../lib/speechRecognition";
import { addNativeAppStateListener } from "../../../lib/mobile/appLifecycle";
import type { useTarotSpeechPlayback } from "../logic/useTarotSpeechPlayback";
import { useTarotReducedMotion } from "../logic/useTarotReducedMotion";
import { HintGuideSlot } from "../../../components/mascot/HintGuide";
import { voiceGuideContext } from "../../../components/mascot/hintGuideContext";

type Phase = "starting" | "listening" | "thinking" | "speaking" | "paused" | "error";

export function TarotVoiceConversation({ onSend, onClose, playback, busy }: {
  onSend: (text: string) => Promise<string | null | undefined>;
  onClose: () => void;
  playback: ReturnType<typeof useTarotSpeechPlayback>;
  busy: boolean;
}) {
  const { language, t } = useLanguage();
  const reducedMotion = useTarotReducedMotion();
  const [phase, setPhase] = useState<Phase>("starting");
  const [transcript, setTranscript] = useState("");
  const [reply, setReply] = useState("");
  const [showTranscript, setShowTranscript] = useState(false);
  const [turns, setTurns] = useState<Array<{ role: "user" | "assistant"; text: string }>>([]);
  const transcriptRef = useRef<HTMLDivElement | null>(null);
  const [notice, setNotice] = useState("");
  const [playbackFailed, setPlaybackFailed] = useState(false);
  const opener = useRef(document.activeElement instanceof HTMLElement ? document.activeElement : null);
  const generation = useRef(0);
  const controller = useRef<AbortController | null>(null);
  const session = useRef<HintSpeechSession | null>(null);
  const silence = useRef<ReturnType<typeof setTimeout> | null>(null);
  const finishTurn = useRef<(() => void) | null>(null);
  const current = useRef({ onSend, playback, language, t });
  current.current = { onSend, playback, language, t };

  function cancel() {
    generation.current++;
    if (silence.current) clearTimeout(silence.current);
    controller.current?.abort(); controller.current = null;
    void session.current?.cancel(); session.current = null;
    finishTurn.current = null;
    current.current.playback.stop();
  }

  async function speak(answer: string, turn: number) {
    setNotice(""); setPlaybackFailed(false); setPhase("speaking");
    const played = await current.current.playback.play(answer, "voice-conversation");
    if (generation.current !== turn) return;
    if (!played) {
      setPlaybackFailed(true);
      setShowTranscript(true);
      setNotice(current.current.t("tarot.chatVoice.playbackError")); setPhase("error"); return;
    }
    void listen();
  }

  async function listen() {
    cancel();
    const turn = generation.current;
    const abort = new AbortController();
    controller.current = abort;
    let text = "";
    let finished = false;
    let failed = false;
    setTranscript(""); setNotice(""); setPlaybackFailed(false); setPhase("starting");
    const active = () => generation.current === turn;
    const finish = async () => {
      if (!active() || finished) return;
      finished = true;
      if (silence.current) clearTimeout(silence.current);
      abort.abort();
      void session.current?.cancel(); session.current = null;
      if (failed) return;
      if (!text.trim() || document.hidden) { setPhase("paused"); return; }
      setTurns(previous => [...previous, { role: "user", text: text.trim() }]);
      setTranscript("");
      setReply(""); setPhase("thinking");
      try {
        const answer = await current.current.onSend(text.trim());
        if (!active()) return;
        if (!answer) throw new Error("Reply unavailable");
        setReply(answer);
        setTurns(previous => [...previous, { role: "assistant", text: answer }]);
        await speak(answer, turn);
      } catch {
        if (active()) { setNotice(current.current.t("tarot.chatVoice.replyError")); setPhase("error"); }
      }
    };
    finishTurn.current = () => { void finish(); };
    silence.current = setTimeout(() => {
      if (!active() || finished) return;
      finished = true;
      abort.abort();
      setNotice(current.current.t("tarot.voice.failed")); setPhase("error");
    }, 12000);
    try {
      const next = await startHintSpeechRecognition({
        language: { en: "en-US", zh: "zh-CN", es: "es-ES", ja: "ja-JP", ko: "ko-KR" }[current.current.language],
        continuous: false,
        signal: abort.signal,
        onStart: () => {
          if (!active() || finished) return;
          if (silence.current) clearTimeout(silence.current);
          setPhase("listening");
        },
        onTranscript: value => {
          if (!active() || finished) return;
          text = value; setTranscript(value);
          if (silence.current) clearTimeout(silence.current);
          silence.current = setTimeout(() => { void finish(); }, 1200);
        },
        onError: reason => {
          if (!active() || finished) return;
          failed = true; finished = true;
          if (silence.current) clearTimeout(silence.current);
          abort.abort();
          setNotice(current.current.t(`tarot.voice.${reason === "no-speech" ? "noSpeech" : reason}`));
          setPhase("error");
        },
        onEnd: () => { void finish(); },
      });
      if (!active() || finished) await next.cancel();
      else session.current = next;
    } catch {
      if (active() && !finished) {
        finished = true;
        if (silence.current) clearTimeout(silence.current);
        setNotice(current.current.t("tarot.voice.failed")); setPhase("error");
      }
    }
  }

  useEffect(() => {
    void listen();
    const pause = () => { cancel(); setPhase("paused"); };
    const hidden = () => { if (document.hidden) pause(); };
    document.addEventListener("visibilitychange", hidden);
    const removeNative = addNativeAppStateListener(active => { if (!active) pause(); });
    return () => {
      cancel();
      document.removeEventListener("visibilitychange", hidden);
      void removeNative.then(remove => remove()).catch(() => undefined);
    };
  }, []);

  useEffect(() => {
    const feed = transcriptRef.current;
    feed?.scrollTo({ top: feed.scrollHeight, behavior: "auto" });
  }, [turns, transcript, showTranscript]);

  const listening = phase === "listening" || phase === "starting";
  const canResume = phase === "paused" || phase === "error";
  const displayPhase = phase === "speaking" && playback.status !== "playing" ? "preparing" : phase;
  return <Dialog open onOpenChange={open => { if (!open) onClose(); }}>
    <DialogSurface asChild aria-describedby={undefined} onCloseAutoFocus={event => {
      event.preventDefault();
      if (opener.current?.isConnected) opener.current.focus({ preventScroll: true });
    }}>
      <section className="tarot-reading-theme absolute inset-0 z-[80] flex flex-col bg-[var(--reading-base)] text-[var(--reading-ink)]" data-testid="tarot-voice-conversation">
        <ConstellationBackdrop paused={canResume} />
        <header className="relative z-10 flex items-center justify-between px-4 pb-3 pt-[calc(var(--hint-safe-top)+0.75rem)]">
          <DialogTitle className="pl-2 font-serif text-[23px]">Hint</DialogTitle>
          <div className="flex items-center gap-1">
            <button type="button" onClick={() => setShowTranscript(value => !value)} aria-pressed={showTranscript}
              aria-label={t(showTranscript ? "tarot.chatVoice.hideTranscript" : "tarot.chatVoice.showTranscript")} aria-controls="tarot-voice-transcript"
              className={`inline-flex min-h-11 items-center gap-2 rounded-full px-3 font-sans text-[13px] ${showTranscript ? "bg-[var(--reading-control)] text-[var(--reading-accent)]" : "text-[var(--reading-accent)] hover:bg-[#796582]/10"}`}>
              <MessageSquareText size={17} />{t("tarot.chatVoice.transcript")}
            </button>
            <button type="button" onClick={onClose} aria-label={t("tarot.chatVoice.close")} className="grid h-11 w-11 place-items-center rounded-full hover:bg-[#796582]/10"><X size={21} /></button>
          </div>
        </header>
        <div className="relative z-10 flex min-h-0 flex-1 flex-col overflow-y-auto px-6 py-5 [container-type:size]">
          {/* Auto margins center the stage when it fits and collapse when it overflows,
              so a short screen scrolls from its first line rather than an unreachable top.
              The stage may shrink to the body height so the transcript keeps a bounded scroll box;
              the mascot is capped by a share of the body height (cqh) as well as its width. */}
          <div className="my-auto flex min-h-0 w-full flex-col items-center gap-5">
          <HintGuideSlot context={voiceGuideContext(displayPhase, playback.status)} priority={100}
            className={`aspect-square shrink-0 ${showTranscript ? "w-[min(100%,11rem,32cqh)]" : "w-[min(100%,18rem,55cqh)]"}`} fallback={<div aria-hidden="true" data-testid="tarot-voice-orb" data-phase={displayPhase} data-reduced-motion={reducedMotion}
            className={`hint-voice-orb relative grid aspect-square w-full shrink-0 place-items-center rounded-full text-[#796582] shadow-[0_20px_70px_rgba(121,101,130,0.15)] ${showTranscript ? "max-w-28" : "max-w-40"}`}>
            <span className="hint-voice-ring absolute -inset-3 rounded-full border border-[#b997c9]/35" />
            {canResume ? <MicOff size={36} strokeWidth={1.4} /> : <span className="hint-voice-bars flex h-12 items-center gap-[5px]">
              {[0, 1, 2, 3, 4].map(bar => <i key={bar} className="block w-[5px] rounded-full bg-[#796582]" />)}
            </span>}
          </div>} />
          <div className="tarot-reading-copy shrink-0 space-y-1.5 text-center">
            <p role="status" className="font-sans text-[22px] font-semibold">{t(`tarot.chatVoice.${displayPhase}`)}</p>
            <p className="max-w-xs font-sans text-[13px] leading-5 text-[var(--reading-muted)]">{t(`tarot.chatVoice.${displayPhase}Hint`)}</p>
          </div>
          <div id="tarot-voice-transcript" ref={transcriptRef} hidden={!showTranscript} role="region" aria-label={t("tarot.chatVoice.transcript")}
            className="min-h-16 w-full max-w-md overflow-y-auto rounded-2xl border border-[#b997c9]/25 bg-[var(--reading-transcript)] p-4 font-sans text-[14px] leading-6 [overflow-wrap:anywhere]">
            {!turns.length && !transcript && <p className="text-center text-[var(--reading-muted)]">{t("tarot.chatVoice.transcriptEmpty")}</p>}
            {turns.map((message, index) => <div key={index} className="mb-4 last:mb-0">
              <p className="mb-1 text-[11px] font-semibold text-[var(--reading-muted)]">{message.role === "user" ? t("tarot.chatVoice.you") : "Hint"}</p>
              <p>{message.text}</p>
            </div>)}
            {transcript && <div><p className="mb-1 text-[11px] font-semibold text-[var(--reading-muted)]">{t("tarot.chatVoice.you")}</p><p className="text-[var(--reading-accent)]">{transcript}</p></div>}
          </div>
          {notice && <p role="alert" className="tarot-reading-copy max-w-md shrink-0 text-center font-sans text-[13px] leading-5 text-[var(--reading-error)]">{notice}</p>}
          </div>
        </div>
        <footer className="relative z-10 px-6 pb-[calc(var(--hint-safe-bottom)+1rem)] pt-3 text-center">
          <div className="flex justify-center gap-4">
            {playbackFailed && reply && <button type="button" onClick={() => {
              cancel(); void speak(reply, generation.current);
            }} aria-label={t("tarot.chatVoice.retryReading")} className="grid h-14 w-14 place-items-center rounded-full tarot-action-primary"><RotateCcw size={21} /></button>}
            <div className="space-y-2">
              <button type="button" disabled={canResume && busy} onClick={() => {
                if (canResume) void listen();
                else { cancel(); setPhase("paused"); }
              }} aria-label={t(canResume ? "tarot.chatVoice.resume" : "tarot.chatVoice.pause")}
                className="grid h-14 w-14 place-items-center rounded-full bg-[var(--reading-control)] text-[var(--reading-accent)] disabled:opacity-40">
                {canResume ? <Play size={22} fill="currentColor" /> : <Pause size={22} fill="currentColor" />}
              </button>
              <p className="tarot-reading-copy font-sans text-[11px] text-[var(--reading-muted)]">{t(canResume ? "tarot.chatVoice.resumeLabel" : "tarot.chatVoice.pauseLabel")}</p>
            </div>
            {phase === "speaking" && <button type="button" onClick={() => { void listen(); }} aria-label={t("tarot.chatVoice.interrupt")}
              className="grid h-14 w-14 place-items-center rounded-full tarot-action-primary"><Mic size={22} /></button>}
            {listening && transcript.trim() && <button type="button" onClick={() => finishTurn.current?.()} aria-label={t("tarot.chatVoice.send")}
              className="grid h-14 w-14 place-items-center rounded-full tarot-action-primary"><Check size={22} /></button>}
            <div className="space-y-2">
              <button type="button" onClick={onClose} aria-label={t("tarot.chatVoice.end")} className="grid h-14 w-14 place-items-center rounded-full bg-[var(--reading-control)] text-[var(--reading-body)]"><X size={23} /></button>
              <p className="tarot-reading-copy font-sans text-[11px] text-[var(--reading-muted)]">{t("tarot.chatVoice.endLabel")}</p>
            </div>
          </div>
          <p className="tarot-reading-copy mt-4 font-sans text-[11px] text-[var(--reading-muted)]">{t("tarot.chatVoice.saved")}</p>
        </footer>
      </section>
    </DialogSurface>
  </Dialog>;
}
