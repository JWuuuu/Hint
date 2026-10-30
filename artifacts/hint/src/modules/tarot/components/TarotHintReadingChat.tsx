import { TarotVoiceConversation } from "./TarotVoiceConversation";
import { HintGuideSlot } from "../../../components/mascot/HintGuide";
import { askGuideContext } from "../../../components/mascot/hintGuideContext";
import { useHintTyping } from "../../../components/mascot/useHintTyping";
import { TarotMessageActions } from "./TarotMessageActions";
import { useTarotSpeechPlayback } from "../logic/useTarotSpeechPlayback";
import "./tarot-reading-layout.css";
import { useReadingDictation } from "../logic/useReadingDictation";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator } from "../../../components/ui/dropdown-menu";
import { ReceiptShareDialog } from "../../receipt-printer/ReceiptShareDialog";
import { useManagedRoomVisit } from "../../../components/app/RoomVisitBoundary";
import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { AnimatePresence, animate, motion, useMotionValue } from "framer-motion";
import {
  ChevronLeft,
  ChevronRight,
  History,
  Home,
  Ellipsis,
  Mic,
  Square,
  BookOpen,
  Printer,
  RotateCcw,
  ArrowUp,
  ArrowDown,
  AudioLines,
  X,
} from "lucide-react";
import { useLocation } from "wouter";
import { useSendTarotChatMessage, type TarotCardDraw } from "@workspace/api-client-react";
import { apiFetch, apiUrl } from "../../../lib/api";
import type { SpreadChoice } from "../../hold/useHoldFlow";
import type { RitualCard } from "../logic/createHiddenDeck";
import { getCardSuit, getReadableCardMeaning } from "../logic/cardMeanings";
import { receiptCardName, receiptPosition } from "../logic/receiptCopy";
import type { TarotCardArtId } from "../logic/cardImageMap";
import type { TarotCardBackId, TarotCardBackStyle } from "../logic/cardBacks";
import { TarotCardVisual } from "./TarotCardVisual";
import { DetailedTarotReading } from "./DetailedTarotReading";
import {
  parseStructuredTarotReading,
  saveLocalTarotReading,
  type LocalStructuredTarotReading,
  type LocalTarotChatMessage,
  type LocalTarotReading,
  type LocalTarotRoomDesign,
  type LocalTarotSaveResult,
} from "../../readings/localTarotReadings";
import { saveLocalQuestionHistory } from "../../readings/localQuestionHistory";
import { recordRitualCompletion } from "../../home/data/localRitualProgress";
import { getSpreadPositionLabel } from "../logic/spreadLabels";
import type { WashRitualTheme } from "./CardWashRitual";
import { useTarotReducedMotion } from "../logic/useTarotReducedMotion";
import { requestTarotFollowUp } from "../logic/requestTarotFollowUp";
import { buildTarotChatContext } from "../logic/buildTarotChatContext";
import { getTarotSpreadHistory } from "../logic/buildTarotSpreadHistory";
import { useLanguage, type HintLanguage } from "../../../lib/i18n";
import { Dialog, DialogSurface, DialogTitle } from "../../../components/ui/dialog";

type LocalChatMessage = LocalTarotChatMessage;

type TarotHintReadingChatProps = {
  selectedCards: RitualCard[];
  spread: SpreadChoice;
  backStyle?: TarotCardBackStyle;
  cardBackId?: TarotCardBackId;
  cardArtId?: TarotCardArtId;
  question?: string;
  story?: string;
  focusLabel?: string;
  roomDesign?: LocalTarotRoomDesign;
  theme?: Pick<WashRitualTheme, "surface" | "chamberOverlay" | "starClassName">;
  archiveOnOpen?: boolean;
  archivedReading?: LocalTarotReading;
  existingReadingId?: string;
  existingReadingCreatedAt?: string;
  onArchived?: (reading: LocalTarotReading) => void;
  onNewReading?: () => void;
  onBack?: () => void;
};

type StructuredSignalType = "clear_signal" | "mixed_signal" | "opening" | "blocked" | "soft_yes" | "soft_no";

type StructuredCardMeaning = {
  position: string;
  card_name: string;
  orientation: "upright" | "reversed";
  meaning: string;
};

type StructuredTarotReading = LocalStructuredTarotReading;

const MIN_READING_REVEAL_MS = 650;

function useModalReturnFocus() {
  const opener = useRef(typeof document !== "undefined" && document.activeElement instanceof HTMLElement ? document.activeElement : null);
  return (event: Event) => {
    event.preventDefault();
    if (opener.current?.isConnected) opener.current.focus({ preventScroll: true });
  };
}

function formatChatCopy(
  template: string,
  values: Record<string, string | number>,
) {
  return Object.entries(values).reduce(
    (copy, [key, value]) => copy.replaceAll(`{${key}}`, String(value)),
    template,
  );
}

function localizeFallbackReading(
  reading: StructuredTarotReading,
  language: HintLanguage,
  t: (key: string) => string,
): StructuredTarotReading {
  if (language !== "zh") return reading;
  return {
    ...reading,
    overall_summary: t(`tarot.flow.chat.local.summary.${reading.signal_type}`),
    cards: reading.cards.map((card) => ({
      ...card,
      meaning: formatChatCopy(t("tarot.flow.chat.local.cardMeaning"), {
        position: card.position,
        card: card.card_name,
        orientation:
          card.orientation === "reversed"
            ? t("tarot.flow.chat.reversed")
            : t("tarot.flow.chat.upright"),
      }),
    })),
    final_action_advice: t(
      `tarot.flow.chat.local.guidance.${reading.signal_type}`,
    ),
    follow_up_invitation: t("tarot.flow.chat.local.invitation"),
  };
}

function newMessageId() {
  return `hint-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

function cleanReadingCopy(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function looksTruncated(value: string) {
  return /(?:\.{3}|…)$/.test(cleanReadingCopy(value));
}

function restoreCompleteCopy(saved: string, fallback: string) {
  const cleanSaved = cleanReadingCopy(saved);
  return !cleanSaved || looksTruncated(cleanSaved)
    ? cleanReadingCopy(fallback)
    : cleanSaved;
}


const BLOCKING_CARD_IDS = new Set([
  "12-hanged-man",
  "13-death",
  "15-devil",
  "16-tower",
  "18-moon",
  "five-cups",
  "five-swords",
  "seven-swords",
  "eight-swords",
  "nine-swords",
  "ten-swords",
]);

const OPENING_CARD_IDS = new Set([
  "0-fool",
  "1-magician",
  "3-empress",
  "6-lovers",
  "7-chariot",
  "8-strength",
  "14-temperance",
  "17-star",
  "19-sun",
  "20-judgement",
  "21-world",
  "ace-wands",
  "ace-cups",
  "ace-pentacles",
  "six-wands",
  "ten-cups",
  "ten-pentacles",
]);

function getReadingSignal(cards: RitualCard[]): StructuredSignalType {
  const reversedCount = cards.filter((card) => card.orientation === "reversed").length;
  const blockingScore = cards.reduce((score, card) => score + (BLOCKING_CARD_IDS.has(card.cardId) ? 1 : 0), 0) + reversedCount;
  const openingScore = cards.reduce((score, card) => score + (OPENING_CARD_IDS.has(card.cardId) ? 1 : 0), 0);

  if (cards.length === 0) return "mixed_signal";
  if (openingScore >= Math.max(1, blockingScore + 1) && reversedCount === 0) return "opening";
  if (openingScore > blockingScore && reversedCount <= 1) return "soft_yes";
  if (blockingScore >= openingScore + 2 || reversedCount >= Math.ceil(cards.length * 0.6)) return "blocked";
  if (blockingScore > openingScore) return "soft_no";
  if (openingScore === blockingScore && cards.length > 1) return "mixed_signal";
  return "clear_signal";
}

function getSignalLanguage(signalType: StructuredSignalType) {
  switch (signalType) {
    case "opening":
      return {
        label: "a very clear positive signal",
        direction: "move forward, but do it steadily instead of waiting for perfect certainty",
      };
    case "soft_yes":
    case "clear_signal":
      return {
        label: "a positive signal with a clear direction",
        direction: "there is movement here, but it needs one clean and paced next step",
      };
    case "blocked":
      return {
        label: "a heavy blocked signal",
        direction: "do not push this right now; protect your energy and stop feeding the loop",
      };
    case "soft_no":
      return {
        label: "a warning signal more than a green light",
        direction: "slow down and test what is real before trusting the surface signal",
      };
    case "mixed_signal":
    default:
      return {
        label: "a mixed signal",
        direction: "stay curious, but do not invest more until the pattern gets clearer",
      };
  }
}

function questionLead() {
  return "For this question, ";
}

function buildOverallReading(cards: RitualCard[]): { signalType: StructuredSignalType; text: string } {
  const signalType = getReadingSignal(cards);
  const signal = getSignalLanguage(signalType);
  return {
    signalType,
    text: `${questionLead()}the answer is: ${signal.direction}.`,
  };
}

function buildCardMeaning(card: RitualCard, index: number, spread: SpreadChoice): StructuredCardMeaning {
  const position = getSpreadPositionLabel(spread, index);
  const orientation = card.orientation === "reversed" ? "reversed" : "upright";
  return {
    position,
    card_name: card.name,
    orientation,
    meaning: cleanReadingCopy(getReadableCardMeaning(card).sentence),
  };
}

function buildFinalGuidance(signalType: StructuredSignalType) {
  switch (signalType) {
    case "opening":
    case "soft_yes":
    case "clear_signal":
      return "Take one honest step forward and let the response show you what is real.";
    case "blocked":
      return "Pause, protect your energy, and stop chasing the part that keeps looping.";
    case "soft_no":
      return "Slow down and check the pattern before you make a bigger move.";
    case "mixed_signal":
    default:
      return "Stay close enough to notice the next signal, but do not overinvest yet.";
  }
}

function buildFollowUpInvitation(question?: string, focusLabel?: string) {
  const lower = `${question ?? ""} ${focusLabel ?? ""}`.toLowerCase();
  if (/love|relationship|dating|connection|reconcile|breakup|their|him|her|them/.test(lower)) {
    return "Ask about any card if you want the deeper layer of this connection.";
  }
  if (/work|job|career|exam|school|application|offer/.test(lower)) {
    return "Ask about any card if you want the deeper layer of this decision.";
  }
  return "Ask about any card if you want the deeper layer.";
}

function buildLocalStructuredReading(
  cards: RitualCard[],
  spread: SpreadChoice,
  question?: string,
  story?: string,
  focusLabel?: string,
): StructuredTarotReading {
  const overall = buildOverallReading(cards);
  return {
    signal_type: overall.signalType,
    overall_summary: overall.text,
    cards: cards.map((card, index) => buildCardMeaning(card, index, spread)),
    final_action_advice: buildFinalGuidance(overall.signalType),
    follow_up_invitation: buildFollowUpInvitation(question, focusLabel),
  };
}

function buildArchivedStructuredReading(
  archivedReading: NonNullable<TarotHintReadingChatProps["archivedReading"]>,
  localReading: StructuredTarotReading,
): StructuredTarotReading {
  const savedReading = archivedReading.structuredReading ?? {
    ...localReading,
    overall_summary: archivedReading.shortAnswer,
    final_action_advice: archivedReading.questionMeaning,
    cards: localReading.cards.map((card, index) => {
      const savedMeaning = archivedReading.cardMeanings[index];
      if (!savedMeaning) return card;
      const separatorIndex = savedMeaning.indexOf(":");
      return {
        ...card,
        meaning:
          separatorIndex >= 0
            ? savedMeaning.slice(separatorIndex + 1).trim()
            : savedMeaning,
      };
    }),
  };

  return {
    ...savedReading,
    overall_summary: restoreCompleteCopy(
      savedReading.overall_summary,
      localReading.overall_summary,
    ),
    cards: savedReading.cards.map((card, index) => ({
      ...card,
      meaning: restoreCompleteCopy(
        card.meaning,
        localReading.cards[index]?.meaning ?? card.meaning,
      ),
    })),
    final_action_advice: restoreCompleteCopy(
      savedReading.final_action_advice,
      localReading.final_action_advice,
    ),
    follow_up_invitation: restoreCompleteCopy(
      savedReading.follow_up_invitation,
      localReading.follow_up_invitation,
    ),
  };
}

function normalizeStructuredReading(reading: StructuredTarotReading): StructuredTarotReading {
  return {
    ...reading,
    overall_summary: cleanReadingCopy(reading.overall_summary),
    cards: reading.cards.map((card) => ({
      ...card,
      meaning: cleanReadingCopy(card.meaning),
    })),
    final_action_advice: cleanReadingCopy(reading.final_action_advice),
    follow_up_invitation: cleanReadingCopy(reading.follow_up_invitation),
  };
}

function toApiCardDraw(card: RitualCard, index: number, spread: SpreadChoice): TarotCardDraw {
  const meaning = getReadableCardMeaning(card);
  const isMajor = /^\d+-/.test(card.cardId);
  return {
    card: {
      id: card.cardId,
      name: card.name,
      arcana: isMajor ? "major" : "minor",
      suit: isMajor ? null : getCardSuit(card.cardId),
      keywords: meaning.keywords,
      upright: meaning.upright,
      reversed: meaning.reversed,
    },
    isReversed: card.orientation === "reversed",
    position: getSpreadPositionLabel(spread, index),
  };
}

type CardDetailPreviewProps = {
  cards: RitualCard[];
  reading: StructuredTarotReading;
  activeIndex: number;
  backStyle: TarotCardBackStyle;
  cardBackId?: TarotCardBackId;
  cardArtId: TarotCardArtId;
  reduceMotion: boolean;
  t: (key: string) => string;
  onSelectIndex: (index: number) => void;
  onClose: () => void;
};

function CardDetailPreview({
  cards,
  reading,
  activeIndex,
  backStyle,
  cardBackId,
  cardArtId,
  reduceMotion,
  t,
  onSelectIndex,
  onClose,
}: CardDetailPreviewProps) {
  const restoreFocus = useModalReturnFocus();
  const [zoom, setZoom] = useState(1);
  const zoomValue = useMotionValue(1);
  const pinchRef = useRef<{ distance: number; zoom: number } | null>(null);
  const pinchMovedRef = useRef(false);
  const card = cards[activeIndex];
  const interpretation = reading.cards[activeIndex];
  const cardCount = cards.length;

  function selectCard(index: number) {
    zoomValue.jump(1);
    setZoom(1);
    pinchRef.current = null;
    pinchMovedRef.current = false;
    onSelectIndex(index);
  }

  useEffect(() => {
    zoomValue.jump(1);
    setZoom(1);
    pinchRef.current = null;
  }, [activeIndex, zoomValue]);

  useEffect(() => () => zoomValue.stop(), [zoomValue]);

  useEffect(() => {
    const onKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === "ArrowLeft" && cardCount > 1) {
        zoomValue.jump(1);
        setZoom(1);
        onSelectIndex((activeIndex - 1 + cardCount) % cardCount);
      }
      if (event.key === "ArrowRight" && cardCount > 1) {
        zoomValue.jump(1);
        setZoom(1);
        onSelectIndex((activeIndex + 1) % cardCount);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [activeIndex, cardCount, onClose, onSelectIndex, zoomValue]);

  if (!card || !interpretation) return null;

  const clampZoom = (value: number) => Math.min(1.5, Math.max(0.85, value));
  const touchDistance = (touches: React.TouchList) => {
    const first = touches.item(0);
    const second = touches.item(1);
    if (!first || !second) return 0;
    return Math.hypot(second.clientX - first.clientX, second.clientY - first.clientY);
  };

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
    <DialogSurface asChild aria-label={card.name} aria-describedby={undefined} onCloseAutoFocus={restoreFocus}>
    <motion.div
      className="absolute inset-0 z-[75] flex flex-col overflow-hidden"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: reduceMotion ? 0.01 : 0.2 }}
    >

      <header className="relative z-10 flex items-center justify-between gap-3 px-4 pb-2 pt-[calc(var(--hint-safe-top)+0.65rem)]">
        <button
          type="button"
          onClick={onClose}
          className="grid h-11 w-11 place-items-center rounded-full border border-white/76 bg-white/64 text-[#625467] shadow-[0_8px_22px_rgba(91,65,100,0.10)]"
          aria-label={t("tarot.flow.chat.closeCardPreview")}
          title={t("tarot.flow.chat.closeCardPreview")}
        >
          <X size={18} strokeWidth={1.8} />
        </button>
        <div className="min-w-0 text-center">
          <p className="font-sans text-[9px] uppercase tracking-[0.26em] text-[color:var(--tarot-page-muted,#9c7891)]">
            {t("tarot.flow.chat.cardPreview")}
          </p>
          <DialogTitle asChild><p className="mt-0.5 truncate font-serif text-[19px] leading-tight text-[color:var(--tarot-page-ink,#342940)]">{card.name}</p></DialogTitle>
        </div>
        <span className="grid h-11 w-11 place-items-center font-sans text-[10px] tabular-nums text-[color:var(--tarot-page-muted,#8b7a88)]">
          {activeIndex + 1}/{cardCount}
        </span>
      </header>

      <div className="relative z-10 flex min-h-0 flex-1 flex-col">
        <div
          className="relative flex min-h-[280px] flex-1 touch-none items-center justify-center overflow-hidden px-14 py-4"
          onTouchStart={(event) => {
            if (event.touches.length !== 2) return;
            zoomValue.stop();
            pinchMovedRef.current = false;
            pinchRef.current = {
              distance: touchDistance(event.touches),
              zoom: zoomValue.get(),
            };
          }}
          onTouchMove={(event) => {
            if (event.touches.length !== 2 || !pinchRef.current) return;
            event.preventDefault();
            const distance = touchDistance(event.touches);
            if (!distance || !pinchRef.current.distance) return;
            pinchMovedRef.current = true;
            zoomValue.set(clampZoom(pinchRef.current.zoom * (distance / pinchRef.current.distance)));
          }}
          onTouchEnd={(event) => {
            if (event.touches.length < 2) {
              pinchRef.current = null;
              setZoom(zoomValue.get());
            }
          }}
          onTouchCancel={() => { pinchRef.current = null; pinchMovedRef.current = true; setZoom(zoomValue.get()); }}
        >
          {cardCount > 1 ? (
            <button
              type="button"
              onClick={() => selectCard((activeIndex - 1 + cardCount) % cardCount)}
              className="absolute left-3 z-20 grid h-11 w-11 place-items-center rounded-full border border-white/76 bg-white/68 text-[#6d5d72] shadow-[0_10px_26px_rgba(91,65,100,0.12)]"
              aria-label={t("tarot.flow.chat.previousCard")}
              title={t("tarot.flow.chat.previousCard")}
            >
              <ChevronLeft size={20} strokeWidth={1.7} />
            </button>
          ) : null}

          <motion.div
            key={card.visualId}
            initial={{ opacity: 0, x: reduceMotion ? 0 : 8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: reduceMotion ? 0.01 : 0.28, ease: [0.22, 0.8, 0.22, 1] }}
            className="relative transform-gpu will-change-transform"
          >
            <motion.div style={{ scale: zoomValue }} className="relative" data-testid="tarot-card-zoom">
            <div className="pointer-events-none absolute inset-[-18%] rounded-[50%] bg-[#b997c9]/14 blur-2xl" />
            <TarotCardVisual
              card={card}
              faceDown={false}
              revealed
              instantReveal
              backStyle={backStyle}
              cardBackId={cardBackId}
              cardArtId={cardArtId}
              positionLabel={interpretation.position}
              ariaLabel={`${interpretation.position}, ${card.name}, ${t(`tarot.flow.chat.${card.orientation}`)}`}
              showFrontCaption={false}
              className="!h-[300px] !w-[188px] min-[410px]:!h-[340px] min-[410px]:!w-[212px]"
            />
            <button
              type="button"
              className="absolute inset-0 z-10 rounded-[12px] bg-transparent"
              onClick={() => {
                if (pinchMovedRef.current) {
                  pinchMovedRef.current = false;
                  return;
                }
                const next = zoom > 1 ? 1 : 1.35;
                setZoom(next);
                animate(zoomValue, next, { duration: reduceMotion ? 0 : 0.3, ease: [0.22, 0.8, 0.22, 1] });
              }}
              aria-label={t("tarot.flow.chat.toggleCardZoom")}
              aria-pressed={zoom > 1}
            />
            </motion.div>
          </motion.div>

          {cardCount > 1 ? (
            <button
              type="button"
              onClick={() => selectCard((activeIndex + 1) % cardCount)}
              className="absolute right-3 z-20 grid h-11 w-11 place-items-center rounded-full border border-white/76 bg-white/68 text-[#6d5d72] shadow-[0_10px_26px_rgba(91,65,100,0.12)]"
              aria-label={t("tarot.flow.chat.nextCard")}
              title={t("tarot.flow.chat.nextCard")}
            >
              <ChevronRight size={20} strokeWidth={1.7} />
            </button>
          ) : null}
        </div>

        <div className="relative z-20 mx-3 mb-[calc(var(--hint-safe-bottom)+0.65rem)] rounded-[18px] border border-white/76 bg-white/66 px-4 pb-4 pt-3 shadow-[0_18px_48px_rgba(91,65,100,0.12)] backdrop-blur-md">
          <div className="min-w-0">
            <p className="font-sans text-[9px] uppercase tracking-[0.2em] text-[#9a7557]">{interpretation.position}</p>
            <div className="mt-1 flex flex-wrap items-baseline gap-2">
              <h2 className="font-serif text-[21px] leading-tight text-[#342940]">{interpretation.card_name}</h2>
              {interpretation.orientation === "reversed" ? (
                <span className="font-sans text-[8px] uppercase tracking-[0.14em] text-[#a17b93]">
                  {t("tarot.flow.chat.reversed")}
                </span>
              ) : null}
            </div>
          </div>
          <p className="mt-2 max-h-[76px] overflow-y-auto font-sans text-[12.5px] leading-5 text-[#625467]">
            {interpretation.meaning}
          </p>
        </div>
      </div>
    </motion.div>
    </DialogSurface>
    </Dialog>
  );
}

export function TarotHintReadingChat({
  selectedCards,
  spread,
  backStyle = "nocturne",
  cardBackId,
  cardArtId = "original",
  question,
  story,
  focusLabel,
  roomDesign,
  theme,
  archiveOnOpen = true,
  archivedReading,
  existingReadingId,
  existingReadingCreatedAt,
  onArchived,
  onNewReading,
}: TarotHintReadingChatProps) {
  const [, navigate] = useLocation();
  const managedRoomVisit = useManagedRoomVisit();
  const { language, t } = useLanguage();
  const reduceMotion = useTarotReducedMotion();
  const [draft, setDraft] = useState("");
  const [messages, setMessages] = useState<LocalChatMessage[]>(
    () => archivedReading?.chatMessages ?? [],
  );
  const [replyState, setReplyState] = useState<"failed" | "stopped" | null>(null);
  const [showLatest, setShowLatest] = useState(false);
  const [structuredReading, setStructuredReading] = useState<StructuredTarotReading | null>(
    null,
  );
  const [readingStatus, setReadingStatus] = useState<"loading" | "ready" | "local">(
    () => !archivedReading
      ? "loading"
      : archivedReading.interpretationStatus === "pending" || archivedReading.interpretationStatus === "local"
        ? "local"
        : "ready",
  );
  const [readingAttempt, setReadingAttempt] = useState(0);
  const [detailedReading, setDetailedReading] = useState(archivedReading?.detailedReading);
  const [detailedContext, setDetailedContext] = useState(archivedReading?.detailedContext ?? "");
  const [detailedFeedback, setDetailedFeedback] = useState(archivedReading?.detailedFeedback);
  const [cardPreviewIndex, setCardPreviewIndex] = useState<number | null>(null);
  const [showDeepReading, setShowDeepReading] = useState(false);
  const deepReadingRef = useRef<HTMLElement | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuTriggerRef = useRef<HTMLButtonElement | null>(null);
  const receiptFromMenuRef = useRef(false);
  const [receiptOpen, setReceiptOpen] = useState(false);
  const [hasSavedReading, setHasSavedReading] = useState(Boolean(archivedReading));
  const [saveFailed, setSaveFailed] = useState(false);
  const [saveNotice, setSaveNotice] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const dictation = useReadingDictation({ draft, onDraft: setDraft, onComplete: text => { void send(text); }, language, t });
  const voiceActive = dictation.status !== "idle";
  const typing = useHintTyping(draft);
  const [composerFocused, setComposerFocused] = useState(false);
  const [voiceConversationOpen, setVoiceConversationOpen] = useState(false);
  const playback = useTarotSpeechPlayback();
  useEffect(() => {
    if (!showDeepReading) return;
    const frame = requestAnimationFrame(() => {
      deepReadingRef.current?.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "start" });
      deepReadingRef.current?.focus({ preventScroll: true });
    });
    return () => cancelAnimationFrame(frame);
  }, [showDeepReading, reduceMotion]);
  useEffect(() => {
    const input = inputRef.current;
    if (!input) return;
    input.style.height = "auto";
    input.style.height = `${Math.min(128, Math.max(44, input.scrollHeight))}px`;
  }, [draft]);
  useEffect(() => {
    if (menuOpen || cardPreviewIndex !== null || receiptOpen) { dictation.stop(); playback.stop(); }
  }, [menuOpen, cardPreviewIndex, receiptOpen, dictation.stop, playback.stop]);
  const previousMessageCount = useRef(messages.length);
  const followingConversation = useRef(true);
  const savedReadingKeyRef = useRef<string | null>(null);
  const savedReadingRef = useRef<LocalTarotReading | null>(archivedReading ?? null);
  const questionArchivedRef = useRef(Boolean(archivedReading));
  const leaveTimerRef = useRef<number | null>(null);
  const sendInFlightRef = useRef(false);
  const chatAbortRef = useRef<AbortController | null>(null);
  const chatMutation = useSendTarotChatMessage({
    mutation: {
      retry: false,
      mutationFn: ({ data }) => requestTarotFollowUp(data, { signal: chatAbortRef.current?.signal }),
    },
  });
  const selectedCardKey = useMemo(
    () => selectedCards.map((card) => `${card.visualId}:${card.cardId}:${card.orientation}`).join("|"),
    [selectedCards],
  );
  const displaySpread = useMemo(
    () => ({
      ...spread,
      label: archivedReading?.spreadLabel ?? t(`tarot.spread.${spread.id}.label`),
      positionLabels: archivedReading
        ? archivedReading.cards.map((card) => card.positionLabel)
        : t(`tarot.spread.${spread.id}.positionLabels`).split("|"),
    }),
    [archivedReading, spread, t],
  );
  const localReading = useMemo(
    () => {
      const nextLocalReading = buildLocalStructuredReading(
        selectedCards,
        displaySpread,
        question,
        story,
        focusLabel,
      );
      if (archivedReading) return buildArchivedStructuredReading(archivedReading, nextLocalReading);
      return localizeFallbackReading(nextLocalReading, language, t);
    },
    [archivedReading, displaySpread, focusLabel, language, question, selectedCardKey, selectedCards, story, t],
  );
  const reading = useMemo(
    () => normalizeStructuredReading(structuredReading ?? localReading),
    [localReading, structuredReading],
  );
  const shortAnswer = reading.overall_summary;
  const cardMeanings = reading.cards.map((card) => `${card.position}: ${card.meaning}`);
  const questionMeaning = reading.final_action_advice;
  const initialReadingText = useMemo(
    () => buildTarotChatContext({ reading, detailedReading, additionalContext: detailedContext }),
    [detailedReading, reading, detailedContext],
  );

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: 0, behavior: "auto" });
  }, [selectedCards]);

  useEffect(() => {
    const newMessage = messages.length > previousMessageCount.current;
    previousMessageCount.current = messages.length;
    const lastMessage = messages.at(-1);
    const feed = scrollRef.current;
    if (!feed) return;
    if ((newMessage && lastMessage?.role === "user") || (followingConversation.current && (newMessage || chatMutation.isPending))) {
      feed.scrollTo({ top: feed.scrollHeight, behavior: "auto" });
      followingConversation.current = true;
      setShowLatest(false);
    } else {
      setShowLatest(messages.length > 0 && feed.scrollHeight - feed.scrollTop - feed.clientHeight > 96);
    }
  }, [messages, chatMutation.isPending]);

  function jumpToLatest() {
    const feed = scrollRef.current;
    feed?.scrollTo({ top: feed.scrollHeight, behavior: "auto" });
    followingConversation.current = true;
    setShowLatest(false);
  }

  useEffect(() => {
    return () => {
      chatAbortRef.current?.abort();
      chatAbortRef.current = null;
      if (leaveTimerRef.current !== null) {
        window.clearTimeout(leaveTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!saveFailed) return undefined;
    const warnBeforeReload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", warnBeforeReload);
    return () => window.removeEventListener("beforeunload", warnBeforeReload);
  }, [saveFailed]);

  useEffect(() => {
    if (selectedCards.length === 0) return undefined;
    if (archivedReading && readingAttempt === 0) {
      setStructuredReading(localReading);
      setReadingStatus(
        archivedReading.interpretationStatus === "pending" || archivedReading.interpretationStatus === "local"
          ? "local"
          : "ready",
      );
      return undefined;
    }

    const controller = new AbortController();
    const requestStartedAt = performance.now();
    let revealTimer: number | null = null;
    setStructuredReading(null);
    setReadingStatus("loading");
    setReplyState(null);
    let settled = false;
    const timeout = window.setTimeout(() => {
      settled = true;
      controller.abort();
      setReadingStatus("local");
    }, 15_000);

    const requestBody = {
      question:
        question?.trim() ||
        focusLabel?.trim() ||
        t("tarot.flow.chat.defaultQuestion"),
      spreadType: spread.id,
      emotionalContext: story?.trim() || null,
      focusLabel: focusLabel?.trim() || null,
      requiredCardCount: selectedCards.length,
      spreadHistory: getTarotSpreadHistory({ activeReadingId: savedReadingRef.current?.id ?? existingReadingId, question }),
      cards: selectedCards.map((card, index) => {
        const meaning = getReadableCardMeaning(card);
        const isMajor = /^\d+-/.test(card.cardId);
        return {
          cardId: card.cardId,
          name: card.name,
          orientation: card.orientation,
          position: getSpreadPositionLabel(displaySpread, index),
          keywords: meaning.keywords,
          upright: meaning.upright,
          reversed: meaning.reversed,
          arcana: isMajor ? "major" : "minor",
          suit: isMajor ? null : getCardSuit(card.cardId),
        };
      }),
    };

    void apiFetch(apiUrl("/api/tarot/structured-reading"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(requestBody),
      signal: controller.signal,
    })
      .then((response) => response.ok ? response.json() as Promise<unknown> : null)
      .then((data: unknown) => ({
        reading: parseStructuredTarotReading(data),
        local: Boolean(data && typeof data === "object" && "source" in data && data.source !== "api"),
      }))
      .then(({ reading: nextReading, local }) => {
        const matchesDraw = nextReading && nextReading.cards.length === selectedCards.length && selectedCards.every((card, index) => {
          const interpreted = nextReading.cards[index]!;
          return interpreted.card_name === card.name
            && interpreted.orientation === card.orientation
            && interpreted.position === getSpreadPositionLabel(displaySpread, index);
        });
        if (!settled && nextReading && matchesDraw) {
          settled = true;
          window.clearTimeout(timeout);
          const revealDelay = Math.max(
            0,
            MIN_READING_REVEAL_MS - (performance.now() - requestStartedAt),
          );
          revealTimer = window.setTimeout(() => {
            setStructuredReading(normalizeStructuredReading(nextReading));
            setReadingStatus(local ? "local" : "ready");
          }, revealDelay);
          return;
        }
        if (!settled) {
          settled = true;
          window.clearTimeout(timeout);
          setReadingStatus("local");
        }
      })
      .catch((requestError: unknown) => {
        if (settled || (requestError instanceof DOMException && requestError.name === "AbortError")) return;
        settled = true;
        window.clearTimeout(timeout);
        setReadingStatus("local");
      });

    return () => {
      settled = true;
      window.clearTimeout(timeout);
      if (revealTimer !== null) window.clearTimeout(revealTimer);
      controller.abort();
    };
  }, [archivedReading, displaySpread, focusLabel, localReading, question, readingAttempt, selectedCardKey, selectedCards, spread.id, story, t]);

  useEffect(() => {
    if (!archiveOnOpen) return;
    if (selectedCards.length === 0) return;
    const saveKey = selectedCards.map((card) => card.visualId).join("|");
    if (savedReadingKeyRef.current === saveKey) return;
    savedReadingKeyRef.current = saveKey;
    const result = saveLocalTarotReading({
      id: existingReadingId,
      createdAt: existingReadingCreatedAt,
      spreadType: spread.id,
      spreadLabel: displaySpread.label,
      question,
      story,
      focusLabel,
      cardArtId,
      roomDesign,
      structuredReading: undefined,
      interpretationStatus: "pending",
      chatMessages: [],
      shortAnswer,
      questionMeaning,
      cardMeanings,
      cards: selectedCards.map((card, index) => ({
        visualId: card.visualId,
        cardId: card.cardId,
        name: card.name,
        orientation: card.orientation,
        positionLabel: getSpreadPositionLabel(displaySpread, index),
        keywords: getReadableCardMeaning(card).keywords,
      })),
    });
    acceptSaveResult(result);
    recordRitualCompletion();
    // Save once when the reading page opens for this selected card set.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function acceptSaveResult(result: LocalTarotSaveResult) {
    // Keep the newest answer and chat in memory even when durable storage is unavailable.
    savedReadingRef.current = result.reading;
    setHasSavedReading(result.saved);
    setSaveFailed(!result.saved);
    if (!result.saved) return;
    onArchived?.(result.reading);
    if (!questionArchivedRef.current && question?.trim()) {
      questionArchivedRef.current = true;
      saveLocalQuestionHistory({
        question,
        focus: focusLabel?.trim() || displaySpread.label,
        spreadType: spread.id,
        readingId: result.reading.id,
        createdAt: result.reading.createdAt,
      });
    }
  }

  function persistReading(patch: Partial<LocalTarotReading> = {}) {
    const current = savedReadingRef.current;
    if (!current) return;
    acceptSaveResult(saveLocalTarotReading({ ...current, ...patch }));
  }

  useEffect(() => {
    if (!savedReadingRef.current) return;
    if (readingStatus === "loading") {
      if (savedReadingRef.current.interpretationStatus !== "pending") {
        persistReading({ interpretationStatus: "pending" });
      }
      return;
    }
    const finalReading = normalizeStructuredReading(reading);
    persistReading({
      structuredReading: finalReading,
      interpretationStatus: readingStatus,
      shortAnswer: finalReading.overall_summary,
      questionMeaning: finalReading.final_action_advice,
      cardMeanings: finalReading.cards.map(
        (card) => `${card.position}: ${card.meaning}`,
      ),
    });
  }, [reading, readingStatus]);

  function persistMessages(nextMessages: LocalChatMessage[]) {
    persistReading({ chatMessages: nextMessages });
  }

  async function send(text: string, retryMessageId?: string) {
    const trimmed = text.trim();
    if (!trimmed || chatMutation.isPending || sendInFlightRef.current) return;
    const retryMessage = retryMessageId ? messages.at(-1) : null;
    if (retryMessageId && (retryMessage?.id !== retryMessageId || retryMessage.role !== "user")) return;
    sendInFlightRef.current = true;
    const controller = new AbortController();
    chatAbortRef.current = controller;
    setReplyState(null);
    const userMessage: LocalChatMessage = retryMessage ?? {
      id: newMessageId(),
      role: "user",
      content: trimmed,
    };
    const priorMessages = retryMessage ? messages.slice(0, -1) : messages;
    const withUser = retryMessage ? messages : [...priorMessages, userMessage];
    setMessages(withUser);
    persistMessages(withUser);
    if (!retryMessage) setDraft("");

    try {
      const reply = await chatMutation.mutateAsync({
        data: {
          originalQuestion:
            question?.trim() || t("tarot.flow.chat.defaultQuestion"),
          territory: focusLabel?.trim() || displaySpread.label,
          emotionalContext: story?.trim() || undefined,
          spreadType: spread.id,
          cards: selectedCards.map((card, index) =>
            toApiCardDraw(card, index, displaySpread),
          ),
          initialReading: initialReadingText,
          spreadHistory: getTarotSpreadHistory({ activeReadingId: savedReadingRef.current?.id ?? existingReadingId, question }),
          messages: priorMessages.slice(-12).map((message) => ({
            role: message.role,
            content: message.content,
          })),
          followUp: trimmed,
        },
      });

      if (controller.signal.aborted) return;
      const completedMessages = [
        ...withUser,
        {
          id: newMessageId(),
          role: "assistant" as const,
          content: reply.message,
        },
      ];
      setMessages(completedMessages);
      persistMessages(completedMessages);
      return reply.message;
    } catch {
      if (controller.signal.aborted) return;
      setReplyState("failed");
      return null;
    } finally {
      if (chatAbortRef.current === controller) {
        chatAbortRef.current = null;
        sendInFlightRef.current = false;
      }
    }
  }

  function onKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (voiceActive || chatMutation.isPending) return;
    if (event.nativeEvent.isComposing || event.keyCode === 229) return;
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      playback.stop();
      void send(draft);
    }
  }

  const unansweredMessage = !chatMutation.isPending && messages.at(-1)?.role === "user" ? messages.at(-1)! : null;

  function confirmLeave() {
    return !saveFailed || window.confirm(t("tarot.flow.chat.unsavedLeave"));
  }

  function leaveTo(path: string) {
    if (!managedRoomVisit && !confirmLeave()) return;
    if (managedRoomVisit) { navigate(path); return; }
    setSaveNotice(hasSavedReading);
    if (leaveTimerRef.current !== null) {
      window.clearTimeout(leaveTimerRef.current);
    }
    leaveTimerRef.current = window.setTimeout(() => {
      navigate(path);
    }, reduceMotion ? 20 : 160);
  }

  function closeReceipt() {
    setReceiptOpen(false);
  }

  function openReceipt() {
    if (!savedReadingRef.current) return;
    setCardPreviewIndex(null);
    setReceiptOpen(true);
  }

  return (
    <section
      data-room-background={roomDesign?.backgroundId ?? "stars"}
      className="tarot-reading-theme relative flex h-full w-full flex-col overflow-hidden bg-transparent text-[var(--reading-ink)]"
    >
      {/* The shell's shared sky shows through; this room paints no backdrop. */}
      <div
        data-tarot-chat-content
        className="contents"
        inert={cardPreviewIndex !== null ? true : undefined}
        aria-hidden={cardPreviewIndex !== null ? true : undefined}
        style={{ visibility: cardPreviewIndex !== null ? "hidden" : undefined }}
      >
      <AnimatePresence>
        {saveNotice && (
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.98 }}
            transition={{ duration: reduceMotion ? 0.01 : 0.18, ease: "easeOut" }}
            className="absolute right-4 top-[calc(var(--hint-safe-top)+0.75rem)] z-50 flex max-w-[calc(100%-2rem)] items-center gap-3 rounded-full border border-[#d8b96e]/28 bg-white/88 px-4 py-3 shadow-[0_16px_42px_rgba(95,69,103,0.16)] backdrop-blur-md"
          >
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#d8b96e]/14 text-[#7b5b91]">
              <History size={16} />
            </span>
            <span className="min-w-0">
              <span className="block font-sans text-[12px] font-semibold text-[#332d45]">{t("tarot.flow.chat.savedTitle")}</span>
              <span className="block truncate font-sans text-[11px] text-[#746276]">
                {t("tarot.flow.chat.savedBody")}
              </span>
            </span>
          </motion.div>
        )}
      </AnimatePresence>

      <header data-testid="tarot-reading-header" className="relative z-20 flex shrink-0 items-center gap-1 border-b border-[#7b5b91]/8 bg-[var(--reading-header)] px-3 pb-2 pt-[calc(var(--hint-safe-top)+0.5rem)] backdrop-blur-xl">
        <button type="button" onClick={() => leaveTo("/app")} data-room-target="/app"
          className="grid h-11 w-11 shrink-0 place-items-center rounded-full text-[var(--reading-accent)] hover:bg-[var(--reading-hover)]" aria-label={t("tarot.flow.chat.returnHome")}>
          <Home size={19} strokeWidth={1.7} />
        </button>
        <div className="flex min-w-0 flex-1 items-center justify-center">
          <HintGuideSlot priority={55} className="-my-3 h-20 w-20 shrink-0" context={{
            ...askGuideContext({ messageCount: messages.length, thinking: chatMutation.isPending || readingStatus === "loading",
              lastRole: messages.at(-1)?.role, typing: typing && !voiceActive, keyboardOpen: composerFocused,
              playbackStatus: playback.status, error: dictation.notice }),
            room: "tarot", ...(voiceActive ? { phase: dictation.status === "listening" ? "listening" : "preparing" } : {}),
          }} />
          <h1 className="truncate font-serif text-[22px] text-[var(--reading-ink)]">Hint</h1>
        </div>
        <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
          <DropdownMenuTrigger asChild>
            <button ref={menuTriggerRef} type="button" aria-label={t("tarot.flow.chat.readingOptions")}
              className="grid h-11 w-11 shrink-0 place-items-center rounded-full text-[var(--reading-accent)] hover:bg-[var(--reading-hover)]"><Ellipsis size={21} /></button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" sideOffset={8} className="w-56 rounded-[18px] border-[#7b5b91]/12 bg-[#fffaf7] p-2 text-[#62506d] shadow-[0_12px_36px_rgba(91,65,100,0.14)]"
            onCloseAutoFocus={(event) => {
              if (!receiptFromMenuRef.current) return;
              event.preventDefault();
              receiptFromMenuRef.current = false;
              menuTriggerRef.current?.focus({ preventScroll: true });
              openReceipt();
            }}>
            <DropdownMenuItem className="min-h-11 rounded-xl px-3" onSelect={() => leaveTo("/app/readings")}><History size={16} />{t("tarot.flow.chat.history")}</DropdownMenuItem>
            {onNewReading && <DropdownMenuItem className="min-h-11 rounded-xl px-3" onSelect={() => { if (confirmLeave()) onNewReading(); }}><RotateCcw size={16} />{t("tarot.flow.chat.newReading")}</DropdownMenuItem>}
            <DropdownMenuItem className="min-h-11 rounded-xl px-3" disabled={!savedReadingRef.current} onSelect={() => { receiptFromMenuRef.current = true; }}><Printer size={16} />{t("tarot.flow.chat.receive")}</DropdownMenuItem>
            <DropdownMenuSeparator className="bg-[#7b5b91]/10" />
            <DropdownMenuItem className="min-h-11 rounded-xl px-3" onSelect={() => setShowDeepReading(true)}><BookOpen size={16} />{t("tarot.flow.chat.exploreReading")}</DropdownMenuItem>
            {readingStatus === "local" && <DropdownMenuItem className="min-h-11 rounded-xl px-3" onSelect={() => setReadingAttempt(attempt => attempt + 1)}><RotateCcw size={16} />{t("tarot.flow.chat.retryReading")}</DropdownMenuItem>}
          </DropdownMenuContent>
        </DropdownMenu>
      </header>

      <div ref={scrollRef} onScroll={(event) => {
        const feed = event.currentTarget;
        followingConversation.current = feed.scrollHeight - feed.scrollTop - feed.clientHeight < 96;
        setShowLatest(messages.length > 0 && !followingConversation.current);
      }} data-testid="tarot-reading-feed" className="relative z-10 min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-5 sm:px-7">
        <div className="mx-auto flex w-full max-w-2xl flex-col gap-5 pb-3">
          <main className="flex min-w-0 flex-col gap-5">
            {(question || focusLabel) && (
              <div data-testid="tarot-reading-question" className="ml-auto max-w-[88%] rounded-[20px] rounded-tr-md border border-[#7b5b91]/10 bg-[var(--reading-bubble)] px-4 py-3">
                <p className="font-sans text-[15px] leading-6 text-[var(--reading-ink)]">{question || focusLabel}</p>
              </div>
            )}
            <p className="sr-only">{displaySpread.label}</p>

            <motion.article
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: reduceMotion ? 0.01 : 0.2, ease: [0.22, 0.8, 0.22, 1] }}
              className="min-w-0 transform-gpu will-change-[opacity,transform]"
            >
              <AnimatePresence initial={false} mode="wait">
              {readingStatus === "loading" ? (
                <motion.div key="reading-pending" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: reduceMotion ? 0.01 : 0.12 }} className="mt-4 space-y-3" role="status" aria-live="polite">
                  <div className="h-3 w-28 animate-pulse rounded-full bg-[#b997c9]/24" />
                  <div className="h-3 w-full animate-pulse rounded-full bg-[#b997c9]/16" />
                  <div className="h-3 w-[86%] animate-pulse rounded-full bg-[#d8a6be]/18" />
                  <p className="tarot-reading-copy pt-2 font-serif text-[16px] italic text-[var(--reading-body)]">{t("tarot.flow.chat.generating")}</p>
                </motion.div>
              ) : (
              <motion.div key="reading-ready" initial={{ opacity: 0, y: reduceMotion ? 0 : 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: reduceMotion ? 0.01 : 0.28, ease: [0.22, 0.8, 0.22, 1] }} className="space-y-5">
                <section data-testid="tarot-short-answer" tabIndex={-1} className="rounded-2xl border border-[#b997c9]/40 bg-[var(--reading-answer)] px-4 py-4 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#735583]">
                  <h3 className="mb-2 font-sans text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--reading-accent)]">{t("tarot.flow.chat.answer")}</h3>
                  <p className="font-sans text-[16px] font-bold leading-7 text-[var(--reading-ink)]">{reading.overall_summary}</p>
                </section>
                <ol aria-label={t("tarot.flow.chat.cards")} className="list-none space-y-6">
                  {reading.cards.map((card, index) => {
                    const visualCard = selectedCards[index];
                    return (
                      <li key={`meaning-${index}`} id={`tarot-card-meaning-${index}`}
                        className="grid grid-cols-[76px_minmax(0,1fr)] items-start gap-4 min-[400px]:grid-cols-[88px_minmax(0,1fr)]">
                        {visualCard ? <TarotCardVisual card={visualCard} faceDown={false} revealed instantReveal compact
                          backStyle={backStyle} cardBackId={cardBackId} cardArtId={cardArtId} positionLabel={card.position}
                          ariaLabel={formatChatCopy(t("tarot.flow.chat.previewCardAria"), {
                            position: card.position, card: card.card_name, orientation: t(`tarot.flow.chat.${card.orientation}`),
                          })}
                          showFrontCaption={false}
                          onClick={() => setCardPreviewIndex(index)}
                          className="!h-[122px] !w-[76px] min-[400px]:!h-[141px] min-[400px]:!w-[88px] !shadow-[0_5px_14px_rgba(68,55,77,0.16)] focus-visible:ring-2 focus-visible:ring-[#796582] focus-visible:ring-offset-4" /> : <span />}
                        <div className="tarot-reading-copy min-w-0">
                          <h3 className="font-sans text-[15px] font-semibold leading-6 text-[var(--reading-ink)]">{index + 1}. {card.card_name}</h3>
                          <p className="mt-0.5 font-sans text-[11px] leading-4 text-[var(--reading-muted)]">{card.position} · {t(`tarot.flow.chat.${card.orientation}`)}</p>
                          <p className="mt-2 font-sans text-[15px] leading-6 text-[var(--reading-body)] [overflow-wrap:anywhere]">{card.meaning}</p>
                        </div>
                      </li>
                    );
                  })}
                </ol>
                {reading.cards_connection && <section data-testid="tarot-cards-synthesis" className="tarot-reading-copy">
                  <h3 className="sr-only">{t("tarot.flow.chat.deepConnection")}</h3>
                  <p className="font-sans text-[15px] leading-7 text-[var(--reading-body)]">{reading.cards_connection}</p>
                </section>}
                <p data-testid="tarot-next-step" className="tarot-reading-copy font-sans text-[15px] leading-7 text-[var(--reading-ink)]">{reading.final_action_advice}</p>
                <TarotMessageActions id="initial-reading" text={[reading.overall_summary, ...reading.cards.map(card => `${card.card_name}. ${card.meaning}`), reading.cards_connection, reading.final_action_advice].filter(Boolean).join("\n\n")}
                  playback={playback} beforePlay={dictation.stop} />
                {showDeepReading && <section ref={deepReadingRef} tabIndex={-1} className="relative scroll-mt-5">
                  <button type="button" aria-label={t("tarot.flow.chat.closeDeep")}
                    onClick={() => setShowDeepReading(false)} className="absolute right-0 top-0 grid h-11 w-11 place-items-center rounded-full text-[var(--reading-accent)]"><X size={16} /></button>
                  <div className="pt-6">
                <DetailedTarotReading
                  request={{
                    question: question?.trim() || focusLabel?.trim() || t("tarot.flow.chat.defaultQuestion"),
                    emotionalContext: story?.trim() || null,
                    spreadType: spread.id,
                    cards: selectedCards.map((card, index) => ({
                      cardId: card.cardId, name: card.name, orientation: card.orientation,
                      position: getSpreadPositionLabel(displaySpread, index),
                    })),
                    originalReading: reading,
                    activeReadingId: savedReadingRef.current?.id ?? existingReadingId,
                  }}
                  saved={detailedReading}
                  savedContext={detailedContext}
                  feedback={detailedFeedback}
                  onContextChange={(context) => { setDetailedContext(context); persistReading({ detailedContext: context }); }}
                  onFeedback={(value) => { setDetailedFeedback(value); persistReading({ detailedFeedback: value }); }}
                  onGenerated={(detail) => {
                    setDetailedReading(detail);
                    persistReading({ detailedReading: detail });
                  }}
                />
                  </div>
                </section>}

              </motion.div>
              )}
              </AnimatePresence>
            </motion.article>

            <section className={saveFailed ? "-mt-2" : "sr-only"}>
              <p role={saveFailed ? "alert" : "status"} className="tarot-reading-copy font-sans text-[11px] leading-5 text-[var(--reading-muted)]">
                {t(hasSavedReading ? "tarot.flow.chat.saved" : saveFailed ? "tarot.flow.chat.saveFailed" : "tarot.flow.chat.notSaved")}
              </p>
              {saveFailed && (
                <button
                  type="button"
                  onClick={() => persistReading()}
                  className="mt-2 inline-flex min-h-11 items-center gap-2 rounded-full border border-[#7b5b91]/18 px-3 text-[12px] font-semibold text-[var(--reading-accent)]"
                >
                  <RotateCcw size={14} />
                  {t("tarot.flow.chat.retrySave")}
                </button>
              )}
            </section>
            {messages.map((message) => (
              <motion.div
                key={message.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: reduceMotion ? 0.01 : 0.24, ease: "easeOut" }}
                className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`min-w-0 rounded-[20px] px-4 py-3 ${
                    message.role === "user"
                      ? "max-w-[88%] rounded-tr-md bg-[var(--reading-bubble)]"
                      : "w-full !px-0"
                  }`}
                >
                  <p className={`${message.role === "assistant" ? "tarot-reading-copy " : ""}whitespace-pre-wrap font-sans text-[15px] leading-7 text-[var(--reading-ink)] [overflow-wrap:anywhere]`}>{message.content}</p>
                  {message.role === "assistant" && <TarotMessageActions id={message.id} text={message.content} playback={playback} beforePlay={dictation.stop} />}
                </div>
              </motion.div>
            ))}
            {chatMutation.isPending && <div role="status" aria-live="polite" data-testid="tarot-response-pending" className="tarot-reading-copy flex min-h-11 items-center gap-3 font-sans text-[13px] text-[var(--reading-muted)]">
              <span aria-hidden="true" className="hint-reply-dots flex gap-1" data-reduced-motion={reduceMotion}><i /><i /><i /></span>
              {t("tarot.flow.chat.pending")}
            </div>}
            {unansweredMessage && <div className="tarot-reading-copy flex flex-wrap items-center gap-x-3 gap-y-1 font-sans text-[13px] text-[var(--reading-muted)]">
              <p role={replyState === "failed" ? "alert" : "status"}>{t(`tarot.flow.chat.${replyState === "failed" ? "replyFailed" : replyState === "stopped" ? "replyStopped" : "replyMissing"}`)}</p>
              <button type="button" onClick={() => { playback.stop(); void send(unansweredMessage.content, unansweredMessage.id); }}
                className="inline-flex min-h-11 items-center gap-2 rounded-full px-3 text-[var(--reading-accent)] hover:bg-[#796582]/8"><RotateCcw size={14} />{t("tarot.flow.chat.retryReply")}</button>
            </div>}

          </main>
        </div>
      </div>

      <div data-testid="tarot-reading-composer" className="relative z-20 shrink-0 bg-[var(--reading-composer)] px-3 pb-[calc(var(--hint-safe-bottom)+0.5rem)] pt-2 backdrop-blur-xl sm:px-7">
        {showLatest && <button type="button" onClick={jumpToLatest} aria-label={t("tarot.flow.chat.jumpLatest")} title={t("tarot.flow.chat.jumpLatest")}
          className="absolute -top-14 left-1/2 grid h-11 w-11 -translate-x-1/2 place-items-center rounded-full border border-[#7b5b91]/15 bg-[var(--reading-control)] text-[var(--reading-accent)] shadow-[0_4px_16px_rgba(68,55,77,0.12)] hover:bg-[var(--reading-hover)]"><ArrowDown size={19} /></button>}
        <div className="mx-auto max-w-2xl">
          {(dictation.notice || voiceActive) && (
            <p role={dictation.notice ? "alert" : "status"} className="mb-2 px-2 font-sans text-xs text-[var(--reading-muted)]">
              {dictation.notice || t(dictation.status === "starting" ? "tarot.flow.question.voiceStarting" : dictation.status === "processing" ? "tarot.voice.processing" : "tarot.chatVoice.autoSend")}
            </p>
          )}
          <div className="flex items-end gap-1 rounded-[26px] border border-[#7b5b91]/16 bg-[var(--reading-input)] px-3 py-2 shadow-[0_4px_18px_rgba(91,65,100,0.06)]">
            <textarea
              ref={inputRef}
              data-testid="tarot-follow-up-composer"
              rows={1}
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              onFocus={() => setComposerFocused(true)}
              onBlur={() => setComposerFocused(false)}
              onKeyDown={onKeyDown}
              placeholder={t("tarot.flow.chat.placeholder")}
              aria-label={t("tarot.flow.chat.placeholder")}
              readOnly={voiceActive}
              className="min-h-11 min-w-0 max-h-32 flex-1 resize-none bg-transparent py-2 font-sans text-[16px] leading-relaxed text-[var(--reading-ink)] outline-none placeholder:text-[var(--reading-muted)]/70 placeholder-shown:overflow-hidden placeholder-shown:text-ellipsis placeholder-shown:whitespace-nowrap"
            />
            <button type="button" aria-label={t(voiceActive ? "tarot.voice.stop" : "tarot.voice.start")}
              aria-pressed={voiceActive} disabled={chatMutation.isPending} onClick={() => { playback.stop(); void dictation.start(); }}
              className={`grid h-11 w-11 shrink-0 place-items-center rounded-full transition-colors disabled:opacity-40 ${voiceActive ? "bg-[var(--reading-control)] text-[var(--reading-accent)]" : "text-[var(--reading-accent)] hover:bg-[#796582]/8"}`}>
              {voiceActive ? <Square size={16} fill="currentColor" /> : <Mic size={19} strokeWidth={1.7} />}
            </button>
            {!draft.trim() && !chatMutation.isPending && !voiceActive ? (
              <button type="button" aria-label={t("tarot.chatVoice.open")} title={t("tarot.chatVoice.open")}
                onClick={() => { dictation.stop(); playback.stop(); setVoiceConversationOpen(true); }}
                className="grid h-11 w-11 shrink-0 place-items-center rounded-full tarot-action-primary"><AudioLines size={21} /></button>
            ) : (
              <button type="button" onClick={() => {
                if (chatMutation.isPending) { setReplyState("stopped"); chatAbortRef.current?.abort(); }
                else { playback.stop(); void send(draft); }
              }} disabled={voiceActive || (!draft.trim() && !chatMutation.isPending)}
                aria-label={t(chatMutation.isPending ? "tarot.chatVoice.stopResponse" : "tarot.flow.chat.send")}
                className="grid h-11 w-11 shrink-0 place-items-center rounded-full tarot-action-primary disabled:cursor-default">
                {chatMutation.isPending ? <Square size={16} fill="currentColor" /> : <ArrowUp size={20} />}
              </button>
            )}
          </div>
        </div>
      </div>

      </div>

      <AnimatePresence>
        {cardPreviewIndex !== null ? (
          <CardDetailPreview
            cards={selectedCards}
            reading={reading}
            activeIndex={cardPreviewIndex}
            backStyle={backStyle}
            cardBackId={cardBackId}
            cardArtId={cardArtId}
            reduceMotion={reduceMotion}
            t={t}
            onSelectIndex={setCardPreviewIndex}
            onClose={() => setCardPreviewIndex(null)}
          />
        ) : null}
      </AnimatePresence>

      {voiceConversationOpen && <TarotVoiceConversation onSend={send} busy={chatMutation.isPending} playback={playback}
        onClose={() => { playback.stop(); setVoiceConversationOpen(false); }} />}

      <AnimatePresence>
        {receiptOpen ? (
          <ReceiptShareDialog source={{ kind: "tarot", reading: savedReadingRef.current! }} onClose={closeReceipt} />
        ) : null}
      </AnimatePresence>
    </section>
  );
}
