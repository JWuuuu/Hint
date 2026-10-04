import { ReceiptShareDialog } from "../../receipt-printer/ReceiptShareDialog";
import { LocalizedText } from "../../../lib/LocalizedText";
import { useManagedRoomVisit } from "../../../components/app/RoomVisitBoundary";
import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { AnimatePresence, animate, motion, useMotionValue } from "framer-motion";
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  History,
  Home,
  Maximize2,
  Printer,
  RotateCcw,
  SendHorizontal,
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

const FOLLOW_UP_KEYS = ["next", "release", "truth"] as const;
const MIN_READING_REVEAL_MS = 650;
const CARD_PREVIEW_HINT_SESSION_KEY = "hint_tarot_card_preview_hint_v1";

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

function buildLocalizedFollowUpReply(
  followUp: string,
  cards: RitualCard[],
  language: HintLanguage,
  t: (key: string) => string,
) {
  if (language !== "zh") return buildFollowUpReply(followUp, cards);
  const focal = cards[0];
  return formatChatCopy(t("tarot.flow.chat.local.followUpReply"), {
    followUp,
    card: focal?.name ?? t("tarot.flow.chat.cards"),
    orientation: focal
      ? t(`tarot.flow.chat.${focal.orientation}`)
      : t("tarot.flow.chat.upright"),
  });
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

function buildFollowUpReply(question: string, cards: RitualCard[]) {
  const anchor = cards[0];
  const cleanQuestion = question.replace(/\s+/g, " ").trim();
  return `For "${cleanQuestion}", the cards are still pointing back to the whole pattern, not only one card. ${anchor ? getReadableCardMeaning(anchor).sentence : "Name what is true, then choose the smallest action that matches it."} Tell me the part that feels hardest to read, and I can stay with that thread.`;
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
  onBack,
}: TarotHintReadingChatProps) {
  const [, navigate] = useLocation();
  const managedRoomVisit = useManagedRoomVisit();
  const { language, t } = useLanguage();
  const reduceMotion = useTarotReducedMotion();
  const [draft, setDraft] = useState("");
  const [messages, setMessages] = useState<LocalChatMessage[]>(
    () => archivedReading?.chatMessages ?? [],
  );
  const [error, setError] = useState<string | null>(null);
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
  const [showCardPreviewHint, setShowCardPreviewHint] = useState(false);
  const acknowledgedCardHintRef = useRef<string | null>(null);
  const [receiptOpen, setReceiptOpen] = useState(false);
  const [hasSavedReading, setHasSavedReading] = useState(Boolean(archivedReading));
  const [saveFailed, setSaveFailed] = useState(false);
  const [saveNotice, setSaveNotice] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);
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
    if (readingStatus === "loading" || selectedCards.length === 0) return undefined;
    if (acknowledgedCardHintRef.current === selectedCardKey) return undefined;
    try {
      if (window.sessionStorage.getItem(CARD_PREVIEW_HINT_SESSION_KEY) === selectedCardKey) return undefined;
    } catch {
      // The hint can still appear when storage is unavailable.
    }

    let hideTimer: number | null = null;
    const showTimer = window.setTimeout(() => {
      if (acknowledgedCardHintRef.current === selectedCardKey) return;
      setShowCardPreviewHint(true);
      hideTimer = window.setTimeout(
        () => setShowCardPreviewHint(false),
        8_000, // Reading time should not shrink with reduced-motion settings.
      );
    }, reduceMotion ? 20 : 520);

    return () => {
      window.clearTimeout(showTimer);
      if (hideTimer !== null) window.clearTimeout(hideTimer);
    };
  }, [readingStatus, reduceMotion, selectedCardKey, selectedCards.length]);

  function dismissCardPreviewHint() {
    acknowledgedCardHintRef.current = selectedCardKey;
    setShowCardPreviewHint(false);
    try {
      window.sessionStorage.setItem(CARD_PREVIEW_HINT_SESSION_KEY, selectedCardKey);
    } catch {
      // Dismissal still works in memory when session storage is unavailable.
    }
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
    setError(null);
    let settled = false;
    const timeout = window.setTimeout(() => {
      settled = true;
      controller.abort();
      setReadingStatus("local");
    }, 8_000);

    const requestBody = {
      question:
        question?.trim() ||
        focusLabel?.trim() ||
        t("tarot.flow.chat.defaultQuestion"),
      spreadType: spread.id,
      emotionalContext: story?.trim() || null,
      focusLabel: focusLabel?.trim() || null,
      requiredCardCount: selectedCards.length,
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

  async function send(text: string) {
    const trimmed = text.trim();
    if (!trimmed || chatMutation.isPending || sendInFlightRef.current) return;
    sendInFlightRef.current = true;
    const controller = new AbortController();
    chatAbortRef.current = controller;
    setError(null);
    const userMessage: LocalChatMessage = {
      id: newMessageId(),
      role: "user",
      content: trimmed,
    };
    const priorMessages = messages;
    const withUser = [...priorMessages, userMessage];
    setMessages(withUser);
    persistMessages(withUser);
    setDraft("");

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
    } catch {
      if (controller.signal.aborted) return;
      setError(t("tarot.flow.chat.networkFallback"));
      const completedMessages = [
        ...withUser,
        {
          id: newMessageId(),
          role: "assistant" as const,
          content: buildLocalizedFollowUpReply(
            trimmed,
            selectedCards,
            language,
            t,
          ),
        },
      ];
      setMessages(completedMessages);
      persistMessages(completedMessages);
    } finally {
      if (chatAbortRef.current === controller) {
        chatAbortRef.current = null;
        sendInFlightRef.current = false;
      }
    }
  }

  function onKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.nativeEvent.isComposing || event.keyCode === 229) return;
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void send(draft);
    }
  }

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
      className="relative flex h-full w-full flex-col overflow-hidden text-[#332d45]"
    >
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

      <header className="relative z-10 border-b border-[#7b5b91]/10 px-5 pb-3 pl-16 pt-[calc(var(--hint-safe-top)+0.75rem)] sm:px-7 sm:pb-3.5 sm:pl-20">
        {onBack ? (
          <button
            type="button"
            onClick={() => { if (confirmLeave()) onBack(); }}
            className="absolute left-4 top-[calc(var(--hint-safe-top)+0.8rem)] grid h-11 w-11 place-items-center rounded-full border border-white/72 bg-white/66 text-[#65556d] shadow-[0_10px_26px_rgba(91,65,100,0.12)] backdrop-blur-xl"
            aria-label={t("common.back")}
          >
            <ArrowLeft size={18} strokeWidth={1.8} />
          </button>
        ) : null}
        <p className="font-sans text-[10px] uppercase tracking-[0.28em] text-[color:var(--tarot-page-muted,#9c7891)]">{t("tarot.room")}</p>
        <h1 className="mt-1 font-serif text-[26px] leading-tight text-[color:var(--tarot-page-ink,#332d45)] sm:text-[34px]">
          {t("tarot.flow.chat.title")}
        </h1>
        <p className="mt-1.5 max-w-2xl font-sans text-[12px] leading-relaxed text-[color:var(--tarot-page-muted,#746276)] sm:text-[13px]">
          {t("tarot.flow.chat.subtitle")}
        </p>
        {(question || focusLabel) && (
          <p className="mt-2 max-w-2xl truncate font-sans text-xs leading-relaxed text-[color:var(--tarot-page-muted,#8b7a88)]">
            {[focusLabel?.trim(), question?.trim()].filter(Boolean).join(" · ")}
          </p>
        )}
        <div className="absolute right-4 top-[calc(var(--hint-safe-top)+0.75rem)] flex items-center gap-2 sm:right-6">
          <button
            type="button"
            onClick={() => leaveTo("/app/readings")}
            data-room-target="/app/readings"
            className="flex h-11 w-11 items-center justify-center rounded-full border border-white/72 bg-white/58 text-[#6d5d72] shadow-[0_8px_22px_rgba(91,65,100,0.10)] transition-colors hover:border-[#d8b96e]/48 hover:text-[#7b5b91]"
            aria-label={t("tarot.flow.chat.openHistory")}
          >
            <History size={16} />
          </button>
          <button
            type="button"
            onClick={() => leaveTo("/app")}
            data-room-target="/app"
            className="flex h-11 w-11 items-center justify-center rounded-full border border-white/72 bg-white/58 text-[#6d5d72] shadow-[0_8px_22px_rgba(91,65,100,0.10)] transition-colors hover:border-[#d8b96e]/48 hover:text-[#7b5b91]"
            aria-label={t("tarot.flow.chat.returnHome")}
          >
            <Home size={16} />
          </button>
        </div>
      </header>

      <AnimatePresence>
        {showCardPreviewHint && cardPreviewIndex === null && !receiptOpen ? (
          <motion.div
            role="status"
            data-testid="tarot-card-tip"
            className="absolute left-1/2 top-[calc(var(--hint-safe-top)+6.9rem)] z-[60] flex w-[min(calc(100%-2rem),320px)] -translate-x-1/2 items-center gap-3 rounded-[16px] border border-white/78 bg-[#fffaf6]/92 px-3 py-2.5 shadow-[0_14px_36px_rgba(91,65,100,0.16)] backdrop-blur-md"
            initial={{ opacity: 0, y: reduceMotion ? 0 : -8, scale: reduceMotion ? 1 : 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: reduceMotion ? 0 : -6, scale: reduceMotion ? 1 : 0.98 }}
            transition={{ duration: reduceMotion ? 0.01 : 0.2, ease: [0.22, 0.8, 0.22, 1] }}
          >
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[#b997c9]/14 text-[#7b5b91]">
              <Maximize2 size={15} strokeWidth={1.7} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block font-sans text-[12px] font-semibold text-[#44374d]">
                {t("tarot.flow.chat.cardHintTitle")}
              </span>
              <span className="mt-0.5 block font-sans text-[11px] leading-4 text-[#756777]">
                {t("tarot.flow.chat.cardHintBody")}
              </span>
            </span>
            <button
              type="button"
              onClick={dismissCardPreviewHint}
              className="grid h-12 w-12 shrink-0 place-items-center rounded-full text-[#8b7a88]"
              aria-label={t("tarot.flow.chat.dismissCardHint")}
            >
              <X size={15} strokeWidth={1.8} />
            </button>
          </motion.div>
        ) : null}
      </AnimatePresence>

      <div ref={scrollRef} className="relative z-10 flex-1 overflow-y-auto px-4 py-4 sm:px-7">
        <div className="mx-auto flex w-full max-w-5xl flex-col gap-3 pb-6">
          <main className="flex min-w-0 flex-col gap-3">
            <motion.article
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: reduceMotion ? 0.01 : 0.2, ease: [0.22, 0.8, 0.22, 1] }}
              className="transform-gpu rounded-[18px] border border-white/78 bg-white/58 px-4 py-4 shadow-[0_18px_46px_rgba(91,65,100,0.09)] backdrop-blur-xl will-change-[opacity,transform] sm:px-5 sm:py-5"
            >
              <div className="flex items-center justify-between gap-3">
                <p className="font-sans text-[10px] uppercase tracking-[0.24em] text-[#9c7891]">
                  {t("tarot.flow.chat.reading")}
                </p>
                <p className="font-sans text-[9px] uppercase tracking-[0.18em] text-[#9a7557]">
                  {formatChatCopy(t("tarot.flow.chat.cardCount"), { count: selectedCards.length })}
                </p>
              </div>
              <AnimatePresence initial={false} mode="wait">
              {readingStatus === "loading" ? (
                <motion.div key="reading-pending" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: reduceMotion ? 0.01 : 0.12 }} className="mt-4 space-y-3" role="status" aria-live="polite">
                  <div className="h-3 w-28 animate-pulse rounded-full bg-[#b997c9]/24" />
                  <div className="h-3 w-full animate-pulse rounded-full bg-[#b997c9]/16" />
                  <div className="h-3 w-[86%] animate-pulse rounded-full bg-[#d8a6be]/18" />
                  <p className="pt-2 font-serif text-[16px] italic text-[#6f5b73]">{t("tarot.flow.chat.generating")}</p>
                </motion.div>
              ) : (
              <motion.div key="reading-ready" initial={{ opacity: 0, y: reduceMotion ? 0 : 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: reduceMotion ? 0.01 : 0.28, ease: [0.22, 0.8, 0.22, 1] }} className="mt-4 space-y-5">
                <section data-testid="tarot-short-answer" tabIndex={-1} className="border-l border-[#d8b96e]/56 pl-3.5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#735583]">
                  <h3 className="font-sans text-[11px] uppercase tracking-[0.18em] text-[#8b7a88]">{t("tarot.flow.chat.answer")}</h3>
                  <p className="mt-2 font-serif text-[17px] leading-[1.55] text-[#3b3045] sm:text-[18px]">{reading.overall_summary}</p>
                </section>
                <section>
                  <div className="flex items-end justify-between gap-3">
                    <h3 className="font-sans text-[11px] uppercase tracking-[0.18em] text-[#8b7a88]">
                      {t("tarot.flow.chat.cards")}
                    </h3>
                    <span className="font-serif text-[12px] italic text-[#9a8194]">{displaySpread.label}</span>
                  </div>
                  <div className="mt-2 divide-y divide-[#7b5b91]/10 border-y border-[#7b5b91]/10">
                    {reading.cards.map((card, index) => {
                      const visualCard = selectedCards[index];
                      return (
                        <div
                          key={`${visualCard?.visualId ?? index}-meaning`}
                          className="grid grid-cols-[72px_minmax(0,1fr)] gap-3.5 py-4 sm:grid-cols-[82px_minmax(0,1fr)] sm:gap-4"
                        >
                          {visualCard ? (
                            <div className="w-fit">
                              <TarotCardVisual
                                card={visualCard}
                                faceDown={false}
                                revealed
                                instantReveal
                                compact
                                backStyle={backStyle}
                                cardBackId={cardBackId}
                                cardArtId={cardArtId}
                                positionLabel={card.position}
                                ariaLabel={formatChatCopy(t("tarot.flow.chat.previewCardAria"), {
                                  position: card.position,
                                  card: card.card_name,
                                  orientation: t(`tarot.flow.chat.${card.orientation}`),
                                })}
                                showFrontCaption={false}
                                onClick={() => {
                                  dismissCardPreviewHint();
                                  setCardPreviewIndex(index);
                                }}
                                className="!h-[114px] !w-[72px] sm:!h-[130px] sm:!w-[82px]"
                              />
                            </div>
                          ) : (
                            <div className="h-[114px] w-[72px] rounded-[10px] border border-[#d8b96e]/30 bg-[#b997c9]/10" />
                          )}
                          <div className="min-w-0 self-center">
                            <p className="font-sans text-[9px] uppercase tracking-[0.18em] text-[#9a7557]">
                              {card.position}
                            </p>
                            <div className="mt-1 flex flex-wrap items-baseline gap-x-2 gap-y-1">
                              <p className="font-serif text-[16px] leading-tight text-[#3b3045] sm:text-[17px]">
                                {card.card_name}
                              </p>
                              {card.orientation === "reversed" ? (
                                <span className="font-sans text-[8px] uppercase tracking-[0.14em] text-[#a17b93]">
                                  {t("tarot.flow.chat.reversed")}
                                </span>
                              ) : null}
                            </div>
                            <p className="mt-2 font-sans text-[12.5px] leading-[1.62] text-[#625467] sm:text-[13px]">
                              {card.meaning}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </section>
                <section className="border-t border-[#d8b96e]/28 pt-4">
                  <h3 className="font-sans text-[11px] uppercase tracking-[0.18em] text-[#8b7a88]">{t("tarot.flow.chat.nextStep")}</h3>
                  <p className="mt-2 font-sans text-[13.5px] leading-6 text-[#55475e] sm:text-sm">{reading.final_action_advice}</p>
                </section>
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
                {readingStatus === "local" ? (
                  <button
                    type="button"
                    onClick={() => setReadingAttempt((attempt) => attempt + 1)}
                    className="min-h-11 rounded-full border border-[#7b5b91]/18 bg-white/58 px-4 font-sans text-[12px] font-semibold text-[#6d5775]"
                  >
                    {t("tarot.flow.chat.retryReading")}
                  </button>
                ) : null}
              </motion.div>
              )}
              </AnimatePresence>
            </motion.article>

            {messages.map((message) => (
              <motion.div
                key={message.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: reduceMotion ? 0.01 : 0.24, ease: "easeOut" }}
                className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[88%] rounded-[14px] border px-4 py-3 ${
                    message.role === "user"
                      ? "border-[#7b5b91]/16 bg-[#b997c9]/16"
                      : "border-white/72 bg-white/54"
                  }`}
                >
                  <p className="font-sans text-[15px] leading-7 text-[#44374d]">{message.content}</p>
                </div>
              </motion.div>
            ))}

            <section className="rounded-[18px] border border-white/74 bg-white/54 p-3 shadow-[0_12px_30px_rgba(91,65,100,0.08)] backdrop-blur-xl">
              <p role={saveFailed ? "alert" : "status"} className="font-sans text-[11px] leading-5 text-[#817382]">
                {t(hasSavedReading ? "tarot.flow.chat.saved" : saveFailed ? "tarot.flow.chat.saveFailed" : "tarot.flow.chat.notSaved")}
              </p>
              {saveFailed && (
                <button
                  type="button"
                  onClick={() => persistReading()}
                  className="mt-2 inline-flex min-h-11 items-center gap-2 rounded-full border border-[#7b5b91]/18 px-3 text-[12px] font-semibold text-[#6d5775]"
                >
                  <RotateCcw size={14} />
                  {t("tarot.flow.chat.retrySave")}
                </button>
              )}
              <div className={`mt-3 grid gap-1.5 sm:gap-2 ${onNewReading ? "grid-cols-3" : "grid-cols-2"}`}>
                  <button
                    type="button"
                    onClick={event => { event.currentTarget.focus({ preventScroll: true }); openReceipt(); }}
                    disabled={!savedReadingRef.current}
                    className="inline-flex h-11 min-w-0 items-center justify-center gap-1.5 rounded-full bg-[#6f527f] px-2 font-sans text-[10px] font-semibold text-[#fff9f4] shadow-[0_8px_20px_rgba(91,65,100,0.18),inset_0_1px_0_rgba(255,255,255,0.20)] disabled:opacity-45 sm:px-3 sm:text-[11px]"
                  >
                    <Printer size={13} strokeWidth={1.7} />
                    <span className="whitespace-nowrap">{t("tarot.flow.chat.receive")}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => leaveTo("/app/readings")}
                    data-room-target="/app/readings"
                    className="inline-flex h-11 min-w-0 items-center justify-center gap-1.5 rounded-full border border-[#7b5b91]/14 bg-white/66 px-2 font-sans text-[10px] font-semibold text-[#6d5d72] transition-colors hover:border-[#7b5b91]/30 sm:px-3 sm:text-[11px]"
                  >
                    <History size={13} />
                    <span className="whitespace-nowrap">{t("tarot.flow.chat.history")}</span>
                  </button>
                  {onNewReading ? (
                    <button
                      type="button"
                      onClick={() => { if (confirmLeave()) onNewReading(); }}
                      className="inline-flex h-11 min-w-0 items-center justify-center gap-1.5 rounded-full border border-[#7b5b91]/14 bg-white/66 px-2 font-sans text-[10px] font-semibold text-[#6d5d72] transition-colors hover:border-[#7b5b91]/30 sm:px-3 sm:text-[11px]"
                    >
                      <RotateCcw size={13} />
                      <span className="whitespace-nowrap">{t("tarot.flow.chat.newReading")}</span>
                    </button>
                  ) : null}
              </div>
            </section>
          </main>
        </div>
      </div>

      <div className="relative z-20 border-t border-white/72 bg-[#fff9f4]/82 px-4 pb-[calc(var(--hint-safe-bottom)+0.5rem)] pt-2.5 shadow-[0_-12px_32px_rgba(91,65,100,0.07)] backdrop-blur-xl sm:px-7">
        <div className="mx-auto max-w-4xl">
          <div className="mb-2 flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none]">
            {FOLLOW_UP_KEYS.map((key) => {
              const followUp = t(`tarot.flow.chat.followUp.${key}`);
              return (
              <button
                key={key}
                type="button"
                onClick={() => void send(followUp)}
                disabled={chatMutation.isPending}
                className="min-h-11 shrink-0 rounded-full border border-[#7b5b91]/14 bg-white/58 px-3.5 py-2 font-serif text-[13px] italic text-[#6d5d72] transition-colors hover:border-[#7b5b91]/30 disabled:cursor-wait disabled:opacity-55"
              >
                {followUp}
              </button>
              );
            })}
          </div>
          {error && (
            <p className="mb-2 font-sans text-xs text-[#8a6878]">
              {error}
            </p>
          )}
          <div className="flex items-end gap-3 rounded-[18px] border border-white/86 bg-white/72 px-4 py-3 shadow-[0_12px_32px_rgba(91,65,100,0.10)]">
            <textarea
              ref={inputRef}
              data-testid="tarot-follow-up-composer"
              rows={1}
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={onKeyDown}
              placeholder={
                chatMutation.isPending
                  ? t("tarot.flow.chat.pending")
                  : t("tarot.flow.chat.placeholder")
              }
              disabled={chatMutation.isPending}
              className="min-h-11 max-h-32 flex-1 resize-none bg-transparent py-2 font-sans text-[16px] leading-relaxed text-[#3f3348] outline-none placeholder:text-[#8b7a88]/70"
            />
            <button
              type="button"
              onClick={() => void send(draft)}
              disabled={!draft.trim() || chatMutation.isPending}
              aria-label={t("tarot.flow.chat.send")}
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#7b5b91] text-[#fff9f4] shadow-[0_9px_20px_rgba(91,65,113,0.20)] transition-colors hover:bg-[#6d4e84] disabled:cursor-default disabled:bg-[#b9adb9]/42 disabled:text-white/72"
            >
              <SendHorizontal size={16} />
            </button>
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

      <AnimatePresence>
        {receiptOpen ? (
          <ReceiptShareDialog source={{ kind: "tarot", reading: savedReadingRef.current! }} onClose={closeReceipt} />
        ) : null}
      </AnimatePresence>
    </section>
  );
}
