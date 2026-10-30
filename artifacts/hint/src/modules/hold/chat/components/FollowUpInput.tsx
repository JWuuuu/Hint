import {
  useState,
  useRef,
  useEffect,
  useImperativeHandle,
  forwardRef,
  type KeyboardEvent,
} from "react";
import { Mic, Square, SendHorizontal } from "lucide-react";
import { useReadingDictation } from "../../../tarot/logic/useReadingDictation";
import { IVORY } from "../../atmosphere";
import { useLanguage } from "../../../../lib/i18n";

interface Props {
  onSend: (text: string) => void;
  value?: string;
  onValueChange?: (value: string) => void;
  isThinking: boolean;
  disabled?: boolean;
  onVoiceStatusChange?: (status: "idle" | "starting" | "listening" | "processing") => void;
}

export interface FollowUpInputHandle {
  focus: () => void;
  setValue: (text: string) => void;
}

export const FollowUpInput = forwardRef<FollowUpInputHandle, Props>(
  function FollowUpInput({ onSend, isThinking, disabled, value, onValueChange, onVoiceStatusChange }, ref) {
    const [localText, setLocalText] = useState("");
    const text = value ?? localText;
    const setText = (next: string) => { setLocalText(next); onValueChange?.(next); };
    const [focused, setFocused] = useState(false);
    const taRef = useRef<HTMLTextAreaElement | null>(null);
    const { t, language } = useLanguage();
    const dictation = useReadingDictation({ draft: text, onDraft: setText, onComplete: setText, language, t });
    const voiceActive = dictation.status !== "idle";
    useEffect(() => { onVoiceStatusChange?.(dictation.status); }, [dictation.status, onVoiceStatusChange]);
    useEffect(() => { if (isThinking || disabled) dictation.stop(); }, [isThinking, disabled, dictation.stop]);

    useImperativeHandle(ref, () => ({
      focus: () => taRef.current?.focus(),
      setValue: (v: string) => setText(v),
    }));

    useEffect(() => {
      const ta = taRef.current;
      if (!ta) return;
      ta.style.height = "auto";
      ta.style.height = Math.min(ta.scrollHeight, 140) + "px";
    }, [text]);

    const submit = () => {
      const trimmed = text.trim();
      if (!trimmed || isThinking || disabled || voiceActive) return;
      onSend(trimmed);
      if (value === undefined) setText("");
    };

    const onKey = (e: KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        submit();
      }
    };

    const canSend = text.trim().length > 0 && !isThinking && !disabled && !voiceActive;

    return (
      <div className="relative shrink-0 px-5 pb-[calc(var(--hint-safe-bottom)+1rem)] pt-3">
        {(dictation.notice || voiceActive) && <p role={dictation.notice ? "alert" : "status"} className="relative z-10 mb-2 text-xs" style={{ color: IVORY.body }}>
          {dictation.notice || t(dictation.status === "processing" ? "tarot.voice.processing" : dictation.status === "starting" ? "tarot.flow.question.voiceStarting" : "tarot.flow.question.voiceListening")}
        </p>}
        <div
          aria-hidden
          className="absolute inset-x-0 -top-10 h-10 pointer-events-none"
          style={{
            background: "var(--hint-chat-input-veil)",
          }}
        />
        <div
          className="flex items-end gap-3 rounded-[12px] border backdrop-blur-[3px] px-4 py-3 transition-colors duration-500"
          style={{
            background: "var(--hint-chat-input-bg)",
            borderColor: focused
              ? "var(--hint-chat-input-border-focus)"
              : "var(--hint-chat-input-border)",
            boxShadow: focused
              ? "var(--hint-chat-input-shadow-focus)"
              : "var(--hint-chat-input-shadow)",
          }}
        >
          <textarea
            ref={taRef}
            rows={1}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={onKey}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            placeholder={isThinking ? t("chat.placeholderThinking") : t("chat.placeholder")}
            disabled={isThinking || disabled}
            readOnly={voiceActive}
            className="hint-chat-input min-h-11 min-w-0 flex-1 resize-none bg-transparent font-sans text-[16px] leading-relaxed focus:outline-none"
            style={{
              color: IVORY.primary,
              maxHeight: 140,
            }}
          />
          <button type="button" aria-label={t(voiceActive ? "tarot.voice.stop" : "tarot.voice.start")} aria-pressed={voiceActive}
            disabled={isThinking || disabled} onClick={() => { void dictation.start(); }}
            className="grid min-h-11 min-w-11 shrink-0 place-items-center rounded-full disabled:opacity-40" style={{ color: IVORY.body }}>
            {voiceActive ? <Square size={16} fill="currentColor" /> : <Mic size={18} />}
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={!canSend}
            className="flex min-h-11 min-w-11 items-center justify-center rounded-full px-3 font-sans text-[13px] font-medium disabled:cursor-default transition-opacity duration-300 hover:opacity-90"
            style={{
              color: canSend ? "#08070B" : IVORY.dim,
              background: canSend
                ? "linear-gradient(145deg, rgba(243,212,144,0.98), rgba(122,226,214,0.92))"
                : "rgba(255,255,255,0.05)",
            }}
            aria-label={t("common.send")}
          >
            <SendHorizontal size={16} />
          </button>
        </div>
      </div>
    );
  }
);
