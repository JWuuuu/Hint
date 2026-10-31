import { useEffect } from "react";
import { Loader2, Square, Volume2 } from "lucide-react";
import { IVORY } from "../../atmosphere";
import { useLanguage } from "../../../../lib/i18n";
import { useTarotSpeechPlayback } from "../../../tarot/logic/useTarotSpeechPlayback";

export type SpeechPlayback = ReturnType<typeof useTarotSpeechPlayback>;

interface Props {
  text: string;
  className?: string;
  playback?: SpeechPlayback;
  playbackId?: string;
}

export function SpeechButton(props: Props) {
  return props.playback ? <PlaybackButton {...props} playback={props.playback} /> : <IndependentSpeechButton {...props} />;
}

function IndependentSpeechButton(props: Props) {
  const playback = useTarotSpeechPlayback();
  useEffect(() => { playback.stop();return playback.stop; }, [props.text, playback.stop]);
  return <PlaybackButton {...props} playback={playback} />;
}

function PlaybackButton({ text, className = "", playback, playbackId = text }: Props & { playback: SpeechPlayback }) {
  const { t } = useLanguage();
  const state = playback.id === playbackId ? playback.status : "idle";

  const Icon = state === "loading" ? Loader2 : state === "playing" ? Square : Volume2;
  const label =
    state === "playing"
      ? t("reading.speech.stop")
      : state === "error"
        ? t("reading.speech.retry")
        : t("reading.speech.play");

  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={() => { if (state === "playing") playback.stop();else void playback.play(text, playbackId); }}
      disabled={state === "loading"}
      className={`inline-grid h-11 w-11 shrink-0 place-items-center rounded-full border transition-colors duration-150 disabled:cursor-wait ${className}`}
      style={{
        color: state === "error" ? "rgba(255,170,150,0.9)" : IVORY.body,
        borderColor:
          state === "playing" ? "rgba(255,240,210,0.38)" : "rgba(255,240,210,0.16)",
        background:
          state === "playing" ? "rgba(255,240,210,0.1)" : "rgba(255,240,210,0.04)",
      }}
    >
      <Icon
        aria-hidden
        className={`h-3.5 w-3.5 ${state === "loading" ? "animate-spin" : ""}`}
      />
    </button>
  );
}
