import { useEffect, useState } from "react";
import { Check, Copy, LoaderCircle, Square, Volume2 } from "lucide-react";
import { useLanguage } from "../../../lib/i18n";
import type { useTarotSpeechPlayback } from "../logic/useTarotSpeechPlayback";

export function TarotMessageActions({ text, id, playback, beforePlay }: {
  text: string;
  id: string;
  playback: ReturnType<typeof useTarotSpeechPlayback>;
  beforePlay: () => void;
}) {
  const { t } = useLanguage();
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState(false);
  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), 2000);
    return () => clearTimeout(timer);
  }, [copied]);
  const active = playback.id === id;
  const playing = active && (playback.status === "playing" || playback.status === "loading");
  const error = active && playback.status === "error";
  return <div className="mt-2 flex flex-wrap items-center gap-1 text-[var(--reading-muted,#8b7a88)]">
    <button type="button" aria-label={t(copied ? "tarot.chatVoice.copied" : "tarot.chatVoice.copy")} title={t("tarot.chatVoice.copy")}
      onClick={async () => {
        try { await navigator.clipboard.writeText(text); setCopied(true); setCopyError(false); }
        catch { setCopyError(true); }
      }} className="grid h-11 w-11 place-items-center rounded-full hover:bg-[#796582]/8">{copied ? <Check size={16} /> : <Copy size={16} />}</button>
    <button type="button" aria-label={t(playing ? "tarot.chatVoice.stopReading" : error ? "tarot.chatVoice.retryReading" : "tarot.chatVoice.readAloud")}
      title={t(playing ? "tarot.chatVoice.stopReading" : error ? "tarot.chatVoice.retryReading" : "tarot.chatVoice.readAloud")} onClick={() => {
        if (playing) playback.stop();
        else { beforePlay(); void playback.play(text, id); }
      }} className="grid h-11 w-11 place-items-center rounded-full hover:bg-[#796582]/8">
      {active && playback.status === "loading" ? <LoaderCircle size={16} className="animate-spin" /> : playing ? <Square size={15} /> : <Volume2 size={17} />}
    </button>
    {(error || copyError) && <p role="alert" className="w-full px-2 text-[12px] leading-5">{t(error ? "tarot.chatVoice.playbackError" : "tarot.chatVoice.copyError")}</p>}
  </div>;
}
