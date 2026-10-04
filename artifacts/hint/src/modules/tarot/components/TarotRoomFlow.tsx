import { LocalizedText } from "../../../lib/LocalizedText";
import { useRoomVisit } from "../../../components/app/RoomVisitBoundary";
import { markRoomVisitStarted, roomVisitWasClosed } from "../../../components/app/roomVisits";
import {
  useEffect,
  useReducer,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent,
  type ReactNode,
  type WheelEvent,
} from "react";
import { AnimatePresence, animate, motion, useMotionValue } from "framer-motion";
import "./spread-recommendation.css";
import {
  ArrowLeft,
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  Heart,
  House,
  Hourglass,
  Lock,
  Mic,
  Moon,
  Palette,
  Route,
  Send,
  Sparkles,
  WandSparkles,
} from "lucide-react";
import { Link, useLocation } from "wouter";
import { triggerHaptic, type FeedbackIntent } from "../../../lib/feedback";
import { useTarotReducedMotion } from "../logic/useTarotReducedMotion";
import { useMotionPolicy } from "../../../lib/motionPolicy";
import { useLanguage } from "../../../lib/i18n";
import {
  BACKGROUND_STYLES,
  CARD_FACE_STYLES,
  DEFAULT_TAROT_ROOM_SETUP,
  SPREAD_CHOICES,
  loadSavedTarotRoomSetup,
  saveTarotRoomSetupPreference,
  type CardFaceId,
  type DeckStyleId,
  type RoomBackgroundId,
  type SpreadChoice,
} from "../../hold/useHoldFlow";
import { apiFetch, apiUrl } from "../../../lib/api";
import { getAnonId } from "../../../lib/identity";
import {
  getDefaultTarotCardBackForStyle,
  getTarotCardBackImage,
  ORIGINAL_TAROT_CARD_BACK_ID,
  TAROT_CARD_BACK_CHOICES,
  type TarotCardBackId,
  type TarotCardBackStyle,
} from "../logic/cardBacks";
import { getTarotCardImage } from "../logic/cardImageMap";
import { createHiddenDeck } from "../logic/createHiddenDeck";
import { selectCardByVisualId } from "../logic/selectCards";
import {
  PICK_WHEEL_CARD_H,
  PICK_WHEEL_CARD_H_ZOOM,
  PICK_WHEEL_CARD_W,
  PICK_WHEEL_CARD_W_ZOOM,
  PICK_WHEEL_DRAG_SENSITIVITY,
  TAROT_PHONE_FRAME_MAX_WIDTH,
  getPickWheelGeometry,
  getPickWheelLayout,
  getTarotPhoneStageSize,
  pickWheelStep,
  positiveModulo,
  wheelDisplayNumber,
  type PickWheelLayout,
  type PickWheelStageSize,
} from "../logic/pickWheelGeometry";
import {
  applyAutoWashWave,
  applyTableCurrent,
  applyWashForce,
  gatherDeckToCenter,
  loosenDeckForWash,
  squareDeckAtCenter,
  type WashPointer,
} from "../logic/washPhysics";
import {
  createAutomaticPileOrder,
  createThreePiles,
  shuffleHiddenDeck,
  stackThreePiles,
  type TarotPileId,
} from "../logic/ritualDeckOrder";
import {
  createInitialWashRitualState,
  createWashFrameClock,
  getWashRitualTiming,
  washRitualReducer,
} from "../logic/washRitualMachine";
import {
  clearActiveTarotSession,
  loadActiveTarotSession,
  saveActiveTarotSession,
  updateActiveTarotSessionArchive,
} from "../logic/activeTarotSession";
import {
  createTarotFlowState,
  getTarotStableRecoveryStep,
  tarotFlowReducer,
  type TarotFlowStep,
} from "../logic/ritualFlowMachine";
import type { RitualCard } from "../types/ritual.types";
import {
  CardWashRitual,
  RitualBackCard,
  WASH_CARD_SIZE,
  type CardWashRitualHandle,
  type WashRitualTheme,
} from "./CardWashRitual";
import { ReadingReveal } from "./ReadingReveal";
import { TarotHintReadingChat } from "./TarotHintReadingChat";
import { SpreadPreviewCarousel } from "./SpreadPreviewCarousel";
import { readBirthProfile } from "../../../lib/astro/userBirthProfile";
import { useProfile } from "../../../lib/useProfile";
import { zodiacSign } from "../../me/utils";
import {
  startHintSpeechRecognition,
  type HintSpeechSession,
} from "../../../lib/speechRecognition";
import { addNativeAppStateListener } from "../../../lib/mobile/appLifecycle";
import {
  getLocalTarotReading,
  type LocalTarotReading,
} from "../../readings/localTarotReadings";
import {
  getTarotRoomStarClassName,
  getTarotRoomSurfaceBackground,
} from "../logic/roomVisuals";

type QuestionCard = {
  category: string;
  question: string;
  icon: "love" | "decision" | "self" | "timing" | "career" | "truth";
  imageCardId: string;
  gradient: string;
};

type RoomDesign = {
  id: string;
  label: string;
  mood: string;
  deckStyleId: DeckStyleId;
  backStyle: TarotCardBackStyle;
  cardBackId: TarotCardBackId;
  cardArtId: CardFaceId;
  backgroundId: RoomBackgroundId;
  background: string;
  glow: string;
};

type DesignPanel = "room" | "front" | "back";

type SpreadRecommendation = {
  spreadType: SpreadChoice["id"];
  reason: string;
  focusLabel: string;
  confidence: "high" | "medium" | "low";
  source: "api" | "local";
};

type Translate = (key: string) => string;

function formatCopy(
  template: string,
  values: Record<string, string | number>,
) {
  return Object.entries(values).reduce(
    (copy, [key, value]) => copy.replaceAll(`{${key}}`, String(value)),
    template,
  );
}

function localizeSpreadChoice(spread: SpreadChoice, t: Translate): SpreadChoice {
  const prefix = `tarot.spread.${spread.id}`;
  return {
    ...spread,
    label: t(`${prefix}.label`),
    description: t(`${prefix}.description`),
    positions: t(`${prefix}.positions`),
    bestFor: t(`${prefix}.bestFor`),
    positionLabels: t(`${prefix}.positionLabels`).split("|"),
  };
}

function isRoomSetupRequested() {
  if (typeof window === "undefined") return false;
  const params = new URLSearchParams(window.location.search);
  return params.get("setup") === "1" || params.get("roomSetup") === "1";
}

function getArchivedReadingRequest() {
  if (typeof window === "undefined") return null;
  const params = new URLSearchParams(window.location.search);
  const readingId = params.get("reading")?.trim();
  if (!readingId) return null;
  return {
    readingId,
    returnToDetail: params.get("returnTo") === "detail",
  };
}

const SPREAD_PREVIEW_TEXT_STYLE: CSSProperties = {
  fontFamily: "Inter, Arial, system-ui, sans-serif",
  fontVariantNumeric: "tabular-nums",
};

const QUESTION_CARDS: QuestionCard[] = [
  {
    category: "Love",
    question: "Why do I keep thinking about them?",
    icon: "love",
    imageCardId: "6-lovers",
    gradient: "from-[#ffd9e6]/80 via-[#fff6ed]/70 to-[#e7dcff]/70",
  },
  {
    category: "Work",
    question: "What should I know before my next job move?",
    icon: "career",
    imageCardId: "1-magician",
    gradient: "from-[#f7e5c8]/80 via-[#fff8ef]/72 to-[#e6f0ea]/74",
  },
  {
    category: "Decision",
    question: "Which path is better for me now?",
    icon: "decision",
    imageCardId: "11-justice",
    gradient: "from-[#f6e8c8]/80 via-[#fff8ef]/70 to-[#dcecff]/70",
  },
  {
    category: "Self",
    question: "What am I avoiding emotionally?",
    icon: "self",
    imageCardId: "9-hermit",
    gradient: "from-[#eee8ff]/80 via-[#fff8f5]/70 to-[#ffdce9]/70",
  },
  {
    category: "Timing",
    question: "Is now the right time to act?",
    icon: "timing",
    imageCardId: "14-temperance",
    gradient: "from-[#fff0ca]/80 via-[#fff8ef]/70 to-[#eadcff]/70",
  },
  {
    category: "Truth",
    question: "What is the honest thing I am missing?",
    icon: "truth",
    imageCardId: "18-moon",
    gradient: "from-[#e9f2ff]/80 via-[#fff8f1]/72 to-[#f0ddff]/70",
  },
];

const FEATURED_SPREADS = [...SPREAD_CHOICES];

const ROOM_DESIGNS: RoomDesign[] = [
  {
    id: "rose",
    label: "Rose Veil",
    mood: "Soft, feminine, relationship-focused.",
    deckStyleId: "rose",
    backStyle: "rose",
    cardBackId: "01_Final_Eight_Set/02_Moon_Tide_Lavender_Gold.png",
    cardArtId: "hint-classic",
    backgroundId: "stars",
    background: "linear-gradient(135deg, #ffe0ec, #fff7ee 52%, #e7ddff)",
    glow: "rgba(246,186,209,0.46)",
  },
  {
    id: "ivory",
    label: "Ivory Gate",
    mood: "Bright, calm, easier to read.",
    deckStyleId: "ivory",
    backStyle: "ivory",
    cardBackId: "01_Final_Eight_Set/05_Dawn_Gate_Ivory_Gold.png",
    cardArtId: "hint-classic",
    backgroundId: "dawn",
    background: "linear-gradient(135deg, #fff3d5, #fffaf3 54%, #e8f2ec)",
    glow: "rgba(236,198,129,0.48)",
  },
  {
    id: "nocturne",
    label: "Sky Deck",
    mood: "Dark sky, celestial, focused.",
    deckStyleId: "nocturne",
    backStyle: "nocturne",
    cardBackId: getDefaultTarotCardBackForStyle("nocturne"),
    cardArtId: "hint-classic",
    backgroundId: "sea",
    background: "linear-gradient(135deg, #e6e1ff, #fff5f8 50%, #d8e8ff)",
    glow: "rgba(171,151,255,0.42)",
  },
];

function hapticTick(duration = 8) {
  const intent: FeedbackIntent =
    duration <= 4 ? "soft" : duration >= 12 ? "select" : "tap";
  triggerHaptic(intent);
}

function hapticPulse(pattern: number | number[] = [6, 28, 10]) {
  const longestPulse = Array.isArray(pattern)
    ? Math.max(...pattern.filter((_, index) => index % 2 === 0))
    : pattern;
  triggerHaptic(longestPulse >= 24 ? "warning" : "select");
}

const CARD_FACE_PREVIEW_IDS = ["0-fool", "6-lovers", "19-sun"] as const;

type QuestionIntent =
  | "career"
  | "love"
  | "timing"
  | "choice"
  | "self"
  | "general";

function getQuestionIntent(question: string): QuestionIntent {
  const lower = question.toLowerCase();
  if (
    /job|career|work|interview|offer|business|money|boss|company|application|hire|hiring|school|exam|工作|事业|面试|录取|公司|老板|考试|学校|申请|薪资|金钱/.test(
      lower,
    )
  )
    return "career";
  if (
    /love|relationship|partner|crush|\bex\b|date|dating|them|him|her|connection|feel|感情|爱情|关系|对象|前任|喜欢|对方|连接|联系/.test(
      lower,
    )
  )
    return "love";
  if (/when|timing|soon|time|wait|now|later|什么时候|时机|时间|现在|以后|等待/.test(lower)) return "timing";
  if (/choice|choose|decision|path|option|which|should i|选择|决定|哪条路|哪一条路|应该|方向/.test(lower))
    return "choice";
  if (/myself|avoid|emotion|healing|fear|pattern|self|自己|情绪|疗愈|害怕|模式|内心|逃避/.test(lower))
    return "self";
  return "general";
}

function questionPromptTitle(
  t: Translate,
  intent: QuestionIntent = "general",
) {
  return t(`tarot.flow.question.title.${intent}`);
}

function questionPromptBody(
  t: Translate,
  intent: QuestionIntent = "general",
) {
  return t(`tarot.flow.question.body.${intent}`);
}

function localizedFocusLabel(t: Translate, question: string) {
  return t(`tarot.flow.focus.${getQuestionIntent(question)}`);
}

const DEFAULT_GUEST_CARD_BACK_ID: TarotCardBackId =
  ORIGINAL_TAROT_CARD_BACK_ID;

const ZODIAC_SIGNS = [
  "Aries",
  "Taurus",
  "Gemini",
  "Cancer",
  "Leo",
  "Virgo",
  "Libra",
  "Scorpio",
  "Sagittarius",
  "Capricorn",
  "Aquarius",
  "Pisces",
] as const;

type ZodiacSignName = (typeof ZODIAC_SIGNS)[number];

const ZODIAC_SIGN_SET = new Set<string>(ZODIAC_SIGNS);

const PERSONAL_ZODIAC_CARD_BACKS: Record<
  ZodiacSignName,
  [TarotCardBackId, TarotCardBackId]
> = {
  Aries: [
    "07_Zodiac_Set_A_Detailed/01_Aries_Ram_Fire_Swirls.png",
    "08_Zodiac_Set_B_Minimal/01_Aries_Ram_Fire_Minimal.png",
  ],
  Taurus: [
    "07_Zodiac_Set_A_Detailed/02_Taurus_Horns_Botanical_Green_Gold.png",
    "08_Zodiac_Set_B_Minimal/02_Taurus_Horns_Sage_Minimal.png",
  ],
  Gemini: [
    "07_Zodiac_Set_A_Detailed/03_Gemini_Twin_Air_Navy_Gold.png",
    "08_Zodiac_Set_B_Minimal/03_Gemini_Twin_Veil_Minimal.png",
  ],
  Cancer: [
    "07_Zodiac_Set_A_Detailed/04_Cancer_Shell_Water_Teal_Gold.png",
    "08_Zodiac_Set_B_Minimal/04_Cancer_Shell_Tide_Minimal.png",
  ],
  Leo: [
    "07_Zodiac_Set_A_Detailed/05_Leo_Solar_Lion_Bronze_Gold.png",
    "08_Zodiac_Set_B_Minimal/05_Leo_Sunburst_Minimal.png",
  ],
  Virgo: [
    "07_Zodiac_Set_A_Detailed/06_Virgo_Wheat_Sage_Gold.png",
    "08_Zodiac_Set_B_Minimal/06_Virgo_Wheat_Minimal.png",
  ],
  Libra: [
    "07_Zodiac_Set_A_Detailed/07_Libra_Scales_Plumberry_Gold.png",
    "08_Zodiac_Set_B_Minimal/07_Libra_Violet_Balance_Minimal.png",
  ],
  Scorpio: [
    "07_Zodiac_Set_A_Detailed/08_Scorpio_Claws_Shadow_Plum_Gold.png",
    "08_Zodiac_Set_B_Minimal/08_Scorpio_Claws_Dark_Minimal.png",
  ],
  Sagittarius: [
    "07_Zodiac_Set_A_Detailed/09_Sagittarius_Bow_Arrow_Burgundy_Gold.png",
    "08_Zodiac_Set_B_Minimal/09_Sagittarius_Pink_Archer_Minimal.png",
  ],
  Capricorn: [
    "07_Zodiac_Set_A_Detailed/10_Capricorn_Sea_Goat_Mountain_Gold.png",
    "08_Zodiac_Set_B_Minimal/10_Capricorn_Goat_Horns_Minimal.png",
  ],
  Aquarius: [
    "07_Zodiac_Set_A_Detailed/11_Aquarius_Waterbearer_Teal_Gold.png",
    "08_Zodiac_Set_B_Minimal/11_Aquarius_Waterbearer_Minimal.png",
  ],
  Pisces: [
    "07_Zodiac_Set_A_Detailed/12_Pisces_Twin_Fish_Navy_Gold.png",
    "08_Zodiac_Set_B_Minimal/12_Pisces_Fish_Waves_Minimal.png",
  ],
};

function isZodiacSignName(value: string | null): value is ZodiacSignName {
  return Boolean(value && ZODIAC_SIGN_SET.has(value));
}

function getPersonalZodiacCardBacks(birthDate?: string | null) {
  const sign = zodiacSign(birthDate);
  if (!isZodiacSignName(sign)) return null;
  return {
    sign,
    cardBackIds: PERSONAL_ZODIAC_CARD_BACKS[sign],
  };
}

function isUnlockedCardBackForBirth(
  item: { id: TarotCardBackId },
  personalBacks: ReturnType<typeof getPersonalZodiacCardBacks>,
) {
  const includedRoomStyle =
    item.id.startsWith("00_Hint_Sky_Deck/") ||
    item.id.startsWith("01_Final_Eight_Set/") ||
    item.id === ORIGINAL_TAROT_CARD_BACK_ID;
  if (includedRoomStyle) return true;
  return personalBacks?.cardBackIds.includes(item.id) ?? false;
}

function isLockedCardBackForBirth(
  item: { id: TarotCardBackId },
  personalBacks: ReturnType<typeof getPersonalZodiacCardBacks>,
) {
  return !isUnlockedCardBackForBirth(item, personalBacks);
}

function getCardFace(cardArtId: CardFaceId) {
  return (
    CARD_FACE_STYLES.find((item) => item.id === cardArtId) ??
    CARD_FACE_STYLES[0]!
  );
}

function getCardBackStyle(cardBackId: TarotCardBackId): TarotCardBackStyle {
  if (/Ivory|Dawn|Sage|Earth/i.test(cardBackId)) return "ivory";
  if (/Rose|Pink|Lavender|Purple|Plum|Burgundy|Flame|Moon_Tide/i.test(cardBackId)) {
    return "rose";
  }
  return "nocturne";
}

function getRoomBackground(backgroundId: RoomBackgroundId) {
  return (
    BACKGROUND_STYLES.find((item) => item.id === backgroundId) ??
    BACKGROUND_STYLES[0]!
  );
}

function getBackgroundGlow(backgroundId: RoomBackgroundId) {
  if (backgroundId === "dawn") return "rgba(236,198,129,0.48)";
  if (backgroundId === "sea") return "rgba(83,194,194,0.38)";
  return "rgba(171,151,255,0.42)";
}

function loadInitialRoomDesign(): RoomDesign {
  const saved = loadSavedTarotRoomSetup();
  if (!saved) {
    return (
      ROOM_DESIGNS.find((item) => item.cardBackId === ORIGINAL_TAROT_CARD_BACK_ID) ??
      ROOM_DESIGNS[0]!
    );
  }
  const base =
    ROOM_DESIGNS.find((item) => item.backgroundId === saved.backgroundId) ??
    ROOM_DESIGNS[0]!;
  const backStyle = getCardBackStyle(saved.cardBackId);

  return {
    ...base,
    deckStyleId: saved.deckStyleId,
    backStyle,
    cardBackId: saved.cardBackId,
    cardArtId: saved.cardFaceId,
    backgroundId: saved.backgroundId,
    background: getTarotRoomSurfaceBackground(saved.backgroundId),
    glow: getBackgroundGlow(saved.backgroundId),
  };
}

function roomDesignFromReading(reading: LocalTarotReading): RoomDesign {
  const saved = reading.roomDesign;
  if (!saved) {
    const fallback = loadInitialRoomDesign();
    return {
      ...fallback,
      cardArtId: reading.cardArtId ?? fallback.cardArtId,
    };
  }
  const base =
    ROOM_DESIGNS.find((item) => item.backgroundId === saved.backgroundId) ??
    loadInitialRoomDesign();
  return {
    ...base,
    backgroundId: saved.backgroundId as RoomBackgroundId,
    background: getTarotRoomSurfaceBackground(saved.backgroundId as RoomBackgroundId),
    glow: getBackgroundGlow(saved.backgroundId as RoomBackgroundId),
    cardArtId: saved.cardArtId,
    cardBackId: saved.cardBackId,
    backStyle: saved.backStyle,
  };
}

function ritualCardsFromReading(reading: LocalTarotReading): RitualCard[] {
  return reading.cards.map((card, index) => ({
    visualId: card.visualId ?? `${reading.id}-${index}-${card.cardId}`,
    cardId: card.cardId,
    name: card.name,
    orientation: card.orientation,
    x: 50,
    y: 50,
    rotation: 0,
    rotate: 0,
    zIndex: index,
    selected: true,
    revealed: true,
  }));
}

function saveRoomDesignPreference(
  design: RoomDesign,
  spread: SpreadChoice,
) {
  const saved = loadSavedTarotRoomSetup();
  saveTarotRoomSetupPreference({
    ...DEFAULT_TAROT_ROOM_SETUP,
    ...saved,
    presetId:
      design.backgroundId === "dawn"
        ? "dawn"
        : design.backgroundId === "sea"
          ? "rose"
          : "hint",
    deckStyleId: design.deckStyleId,
    cardFaceId: design.cardArtId,
    cardBackId: design.cardBackId,
    backgroundId: design.backgroundId,
    cardColor: design.mood,
    spreadType: spread.id,
  });
}

function compactCardBackLabel(label: string) {
  const words = label.split(/\s+/).filter(Boolean);
  const zodiacWord = words.find((word) => ZODIAC_SIGN_SET.has(word));
  if (zodiacWord) {
    if (words.includes("Early")) return `${zodiacWord} Early`;
    return `${zodiacWord} ${words.includes("Minimal") ? "Minimal" : "Classic"}`;
  }

  const fillerWords = new Set([
    "Black",
    "Blue",
    "Bronze",
    "Burgundy",
    "Dark",
    "Detailed",
    "Early",
    "Gold",
    "Green",
    "Ivory",
    "Lavender",
    "Light",
    "Minimal",
    "Mist",
    "Navy",
    "Periwinkle",
    "Plum",
    "Plumberry",
    "Purple",
    "Rich",
    "Rose",
    "Sage",
    "Teal",
  ]);
  const coreWords = words.filter((word) => !fillerWords.has(word));
  const compactWords = coreWords.length >= 2 ? coreWords : words;

  return compactWords.slice(0, 2).join(" ");
}

function getWashTheme(design: RoomDesign): WashRitualTheme {
  const background = design.backgroundId;

  return {
    surface: "light",
    chamberOverlay: getTarotRoomSurfaceBackground(background),
    starClassName: getTarotRoomStarClassName(background),
    tableBackground:
      background === "sea"
        ? "radial-gradient(circle at 50% 44%, rgba(255,255,255,0.70), rgba(183,218,215,0.34) 52%, rgba(185,164,216,0.20) 100%)"
        : background === "dawn"
          ? "radial-gradient(circle at 50% 44%, rgba(255,255,255,0.72), rgba(239,216,172,0.30) 54%, rgba(197,221,210,0.22) 100%)"
          : "radial-gradient(circle at 48% 42%, rgba(255,255,255,0.74), rgba(230,195,213,0.28) 48%, rgba(190,164,217,0.22) 100%)",
    tableBorderColor:
      background === "dawn"
        ? "rgba(174,132,56,0.22)"
        : "rgba(123,91,145,0.18)",
    tableShadow:
      background === "dawn"
        ? "0 28px 80px rgba(95,82,72,0.14), inset 0 0 92px rgba(255,255,255,0.30)"
        : "0 28px 84px rgba(88,62,98,0.16), inset 0 0 92px rgba(255,255,255,0.28)",
    tableRingColor:
      background === "sea"
        ? "rgba(229,154,190,0.18)"
        : "rgba(246,187,207,0.22)",
    secondaryRingColor:
      background === "sea"
        ? "rgba(103,218,209,0.12)"
        : "rgba(248,214,152,0.14)",
    cardBackStyle: design.backStyle,
    cardBackId: design.cardBackId,
  };
}

type FlowDeckState = {
  hiddenDeckOrder: RitualCard[];
  ritualCards: RitualCard[];
};

function cleanQuestion(value: string) {
  return value.trim().replace(/\s+/g, " ");
}

function recommendSpread(question: string): SpreadChoice {
  const lower = question.toLowerCase();
  if (
    /job|career|work|interview|offer|business|money|boss|company|application|hire|hiring|school|exam|工作|事业|面试|录取|公司|老板|考试|学校|申请|薪资|金钱/i.test(
      lower,
    )
  ) {
    return (
      SPREAD_CHOICES.find((spread) => spread.id === "three") ??
      FEATURED_SPREADS[0]!
    );
  }
  if (
    /they|them|him|her|love|relationship|\bex\b|crush|partner|feel|感情|爱情|关系|对象|前任|喜欢|对方|连接|联系/i.test(lower)
  ) {
    return (
      SPREAD_CHOICES.find((spread) => spread.id === "trueHeart") ??
      FEATURED_SPREADS[0]!
    );
  }
  if (/choice|choose|decision|path|should|career|move|选择|决定|哪条路|哪一条路|应该|方向/i.test(lower)) {
    return (
      SPREAD_CHOICES.find((spread) => spread.id === "three") ??
      FEATURED_SPREADS[0]!
    );
  }
  if (/future|when|timing|time|soon|未来|什么时候|时机|时间|现在|以后/i.test(lower)) {
    return (
      SPREAD_CHOICES.find((spread) => spread.id === "peachBlossom") ??
      FEATURED_SPREADS[0]!
    );
  }
  return (
    SPREAD_CHOICES.find((spread) => spread.id === "three") ??
    FEATURED_SPREADS[0]!
  );
}

function spreadReason(spread: SpreadChoice, question: string) {
  const intent = getQuestionIntent(question);
  if (intent === "career") {
    return `${spread.label} keeps the work question practical: what shaped it, what is true now, and what move deserves your energy.`;
  }
  if (intent === "choice") {
    return `${spread.label} is best here because it turns the decision into a clear next action instead of more overthinking.`;
  }
  if (intent === "timing") {
    return `${spread.label} helps separate what is ready now from what still needs time.`;
  }
  if (intent === "self") {
    return `${spread.label} gives the pattern a mirror, then points to the next honest adjustment.`;
  }
  if (spread.id === "trueHeart") {
    return "This question has mixed signals, so the room separates what they show from what may be underneath.";
  }
  if (spread.id === "relationship") {
    return "This keeps your side, their side, and the thread between you in view.";
  }
  if (spread.id === "loveTree") {
    return "This gives the situation roots, environment, growth, future, and advice.";
  }
  return question
    ? `${spread.label} fits this question because it gives the room a clear shape before cards are chosen.`
    : "This spread is balanced for emotional uncertainty and next-step clarity.";
}

function findSpreadChoice(spreadType: string | null | undefined) {
  return SPREAD_CHOICES.find((item) => item.id === spreadType) ?? null;
}

function normalizeConfidence(
  value: unknown,
): SpreadRecommendation["confidence"] {
  return value === "high" || value === "medium" || value === "low"
    ? value
    : "medium";
}

function buildLocalSpreadRecommendation(
  question: string,
): SpreadRecommendation {
  const spread = recommendSpread(question);
  const intent = getQuestionIntent(question);
  const focusLabel =
    intent === "career"
      ? "Next move"
      : intent === "love"
        ? "Inner feelings"
        : intent === "timing"
          ? "Timing signal"
          : intent === "choice"
            ? "Decision path"
            : intent === "self"
              ? "Self pattern"
              : "Clear signal";

  return {
    spreadType: spread.id,
    reason: spreadReason(spread, question),
    focusLabel,
    confidence: intent === "general" ? "low" : "medium",
    source: "local",
  };
}

async function requestSpreadRecommendation(
  question: string,
  signal?: AbortSignal,
): Promise<SpreadRecommendation> {
  const response = await apiFetch(apiUrl("/api/tarot/spread-recommendation"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    signal,
    body: JSON.stringify({
      question,
      anonId: getAnonId(),
    }),
  });
  const data = (await response.json()) as Partial<SpreadRecommendation> & {
    error?: string;
  };

  if (!response.ok) {
    throw new Error(
      data.error ?? `Spread recommendation failed: ${response.status}`,
    );
  }

  const spread = findSpreadChoice(data.spreadType);
  if (
    !spread ||
    typeof data.reason !== "string" ||
    typeof data.focusLabel !== "string"
  ) {
    throw new Error("Spread recommendation response was invalid.");
  }

  return {
    spreadType: spread.id,
    reason: data.reason.trim(),
    focusLabel: data.focusLabel.trim() || spread.label,
    confidence: normalizeConfidence(data.confidence),
    source: data.source === "api" ? "api" : "local",
  };
}

function spreadCardSize(spread: SpreadChoice) {
  if (spread.id === "three")
    return { width: 44, height: 70, radius: 12, inner: 8, number: 22 };
  if (spread.cardCount >= 7)
    return { width: 26, height: 42, radius: 8, inner: 5, number: 16 };
  if (spread.cardCount >= 5)
    return { width: 32, height: 50, radius: 9, inner: 6, number: 17 };
  return { width: 40, height: 64, radius: 11, inner: 7, number: 20 };
}

function centerSpreadPreviewLayout(points: Array<{ x: number; y: number }>) {
  if (points.length <= 1) return [{ x: 50, y: 50 }];

  const minX = Math.min(...points.map((point) => point.x));
  const maxX = Math.max(...points.map((point) => point.x));
  const minY = Math.min(...points.map((point) => point.y));
  const maxY = Math.max(...points.map((point) => point.y));
  const rawWidth = Math.max(1, maxX - minX);
  const rawHeight = Math.max(1, maxY - minY);
  const rawCenterX = (minX + maxX) / 2;
  const rawCenterY = (minY + maxY) / 2;
  const scale = Math.min(1.18, 68 / rawWidth, 56 / rawHeight);

  return points.map((point) => ({
    x: 50 + (point.x - rawCenterX) * scale,
    y: 50 + (point.y - rawCenterY) * scale,
  }));
}

function getSpreadPreviewLayout(spread: SpreadChoice) {
  if (spread.id === "three") {
    return [
      { x: 24, y: 50 },
      { x: 50, y: 50 },
      { x: 76, y: 50 },
    ];
  }

  if (spread.id === "single") {
    return [{ x: 50, y: 50 }];
  }

  if (spread.id === "futureLover") {
    return [
      { x: 14, y: 28 },
      { x: 26, y: 38 },
      { x: 38, y: 52 },
      { x: 50, y: 66 },
      { x: 62, y: 52 },
      { x: 74, y: 38 },
      { x: 86, y: 28 },
    ];
  }

  if (spread.id === "peachBlossom" || spread.id === "trueHeart") {
    return [
      { x: 28, y: 30 },
      { x: 72, y: 30 },
      { x: 28, y: 66 },
      { x: 72, y: 66 },
      { x: 50, y: 48 },
    ];
  }

  if (spread.id === "reconciliation") {
    return [
      { x: 34, y: 26 },
      { x: 66, y: 26 },
      { x: 78, y: 48 },
      { x: 66, y: 70 },
      { x: 50, y: 78 },
      { x: 34, y: 70 },
      { x: 22, y: 48 },
    ];
  }

  if (spread.id === "loveTree") {
    return [
      { x: 50, y: 80 },
      { x: 50, y: 58 },
      { x: 28, y: 54 },
      { x: 72, y: 54 },
      { x: 38, y: 34 },
      { x: 62, y: 34 },
      { x: 50, y: 18 },
    ];
  }

  if (spread.id === "xRelationship") {
    return [
      { x: 24, y: 26 },
      { x: 38, y: 40 },
      { x: 50, y: 54 },
      { x: 62, y: 40 },
      { x: 76, y: 26 },
      { x: 62, y: 68 },
      { x: 50, y: 80 },
      { x: 38, y: 68 },
      { x: 24, y: 80 },
    ];
  }

  return centerSpreadPreviewLayout(
    spread.layout
      .slice(0, spread.cardCount)
      .map((point) => ({ x: point.x, y: point.y })),
  );
}

function getSpreadPreviewLabelStyle(
  point: { x: number; y: number },
  cardHeight: number,
) {
  const offset = cardHeight / 2 + 8;
  const above = point.y > 72 || (point.y >= 30 && point.y < 48);

  return {
    left: `${point.x}%`,
    top: above
      ? `calc(${point.y}% - ${offset}px)`
      : `calc(${point.y}% + ${offset}px)`,
    transform: above ? "translate(-50%, -100%)" : "translate(-50%, 0)",
  };
}

function SpreadDiagram({
  spread,
  active = false,
  showLabels = false,
  cardBackId,
  quiet = false,
  className = "",
}: {
  spread: SpreadChoice;
  active?: boolean;
  showLabels?: boolean;
  cardBackId?: TarotCardBackId;
  quiet?: boolean;
  className?: string;
}) {
  const baseSize = spreadCardSize(spread);
  const size = quiet && spread.cardCount <= 3
    ? {
        ...baseSize,
        width: spread.cardCount === 1 ? 102 : spread.id === "three" ? 84 : 50,
        height: spread.cardCount === 1 ? 153 : spread.id === "three" ? 126 : 80,
        radius: 8,
      }
    : baseSize;
  const previewLayout = getSpreadPreviewLayout(spread);
  const labelsInLegend = showLabels && spread.cardCount >= 5;
  const showInlineLabels = showLabels && !labelsInLegend;
  const displayLayout = labelsInLegend
    ? previewLayout.map((point) => ({
        x: point.x,
        y: 42 + (point.y - 50) * 0.78,
      }))
    : previewLayout;
  const diagramClassName = className.trim() ? className : "h-40";
  const cardBackImageUrl = getTarotCardBackImage(
    cardBackId ?? getDefaultTarotCardBackForStyle("rose"),
  );

  if (spread.id === "three" || (quiet && spread.id === "single")) {
    return (
      <div
        className={`relative w-full min-w-0 overflow-hidden ${diagramClassName}`}
      >
        {!quiet && <div className="absolute inset-0 rounded-[26px] bg-[radial-gradient(circle_at_50%_52%,rgba(255,223,174,0.55),rgba(244,184,211,0.20)_42%,rgba(108,77,142,0.07)_68%,transparent_80%)]" />}
        <div className="absolute inset-0 flex items-center justify-center">
          <div className={quiet ? `tarot-spread-card-row${spread.cardCount === 1 ? " tarot-spread-card-row-single" : ""}` : "flex items-start justify-center gap-8"}>
            {spread.positionLabels.map((label, index) => (
              <div
                key={`${spread.id}-row-${label}`}
                className={`flex flex-col items-center ${quiet ? "min-w-0" : "w-[58px]"}`}
              >
                {quiet && <span className="tarot-spread-position-number">{String(index + 1).padStart(2, "0")}</span>}
                <div
                  className={`relative overflow-hidden border ${
                    active
                      ? "border-[#f5d790]/90 bg-[#2f2544]"
                      : "border-white/38 bg-white/24"
                  } ${quiet ? "tarot-spread-card-art" : "shadow-[0_16px_32px_rgba(67,45,86,0.22)]"}`}
                  style={{
                    width: quiet ? "100%" : size.width,
                    height: quiet ? undefined : size.height,
                    aspectRatio: `${size.width} / ${size.height}`,
                    borderRadius: size.radius,
                  }}
                >
                  <span
                    className="absolute inset-0 bg-cover bg-center"
                    style={{
                      backgroundImage: `url("${cardBackImageUrl}")`,
                      filter: quiet ? undefined : active
                        ? "brightness(0.98) saturate(1.18) contrast(1.08)"
                        : "brightness(1.04) saturate(0.94)",
                    }}
                  />
                  {!quiet && <span
                    className="absolute border border-[#ffe5a8]/52 bg-white/5"
                    style={{
                      inset: size.inner,
                      borderRadius: Math.max(4, size.radius - 4),
                    }}
                  />}
                  {!quiet && <span
                    className="absolute left-1/2 top-1/2 grid -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border border-[#f6dfaa]/70 bg-[#fff8ee]/92 text-[10px] font-black text-[#473250] shadow-[0_6px_14px_rgba(36,20,52,0.24)]"
                    style={{
                      width: size.number,
                      height: size.number,
                      ...SPREAD_PREVIEW_TEXT_STYLE,
                    }}
                  >
                    {index + 1}
                  </span>}
                </div>
                {showLabels ? (
                  <span
                    className={quiet ? "tarot-spread-position-label" : "mt-3 block h-[11px] w-[58px] truncate whitespace-nowrap text-center text-[8px] font-black uppercase leading-none tracking-[0.075em] text-[#6e5968]/84"}
                    style={SPREAD_PREVIEW_TEXT_STYLE}
                    title={label}
                  >
                    {label}
                  </span>
                ) : null}
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`relative w-full min-w-0 overflow-hidden ${diagramClassName}`}
    >
      {!quiet && <div className="absolute inset-0 rounded-[26px] bg-[radial-gradient(circle_at_50%_48%,rgba(255,232,185,0.62),rgba(244,184,211,0.22)_44%,rgba(108,77,142,0.08)_66%,transparent_78%)]" />}
      <svg
        aria-hidden
        viewBox="0 0 100 100"
        preserveAspectRatio={quiet ? "none" : undefined}
        className="absolute inset-0 h-full w-full"
      >
        <polyline
          points={displayLayout
            .map((point) => `${point.x},${point.y}`)
            .join(" ")}
          fill="none"
          stroke={active ? "rgba(142,94,42,0.30)" : "rgba(92,74,103,0.14)"}
          strokeDasharray="2.6 5"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="1"
          vectorEffect={quiet ? "non-scaling-stroke" : undefined}
        />
      </svg>
      {displayLayout.map((point, index) => (
        <div
          key={`${spread.id}-${index}`}
          className="absolute"
          style={{
            left: `${point.x}%`,
            top: `${point.y}%`,
            width: size.width,
            height: size.height,
            transform: "translate(-50%, -50%)",
          }}
        >
          <div
            className={`absolute inset-0 overflow-hidden border ${
              active
                ? "border-[#f5d790]/90 bg-[#2f2544]"
                : "border-white/38 bg-white/24"
            } ${quiet ? "tarot-spread-card-art" : "shadow-[0_14px_30px_rgba(67,45,86,0.24)]"}`}
            style={{ borderRadius: size.radius }}
          >
            <span
              className="absolute inset-0 bg-cover bg-center"
              style={{
                backgroundImage: `url("${cardBackImageUrl}")`,
                filter: quiet ? undefined : active
                  ? "brightness(0.98) saturate(1.18) contrast(1.08)"
                  : "brightness(1.04) saturate(0.94)",
              }}
            />
            <span
              className="absolute border border-[#ffe5a8]/52 bg-white/5"
              style={{
                inset: size.inner,
                borderRadius: Math.max(4, size.radius - 4),
              }}
            />
          </div>
          <span
            className="absolute left-1/2 top-1/2 grid -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border border-[#f6dfaa]/70 bg-[#fff8ee]/92 text-[10px] font-black text-[#473250] shadow-[0_6px_14px_rgba(36,20,52,0.24)]"
            style={{
              width: size.number,
              height: size.number,
              ...SPREAD_PREVIEW_TEXT_STYLE,
            }}
          >
            {index + 1}
          </span>
        </div>
      ))}
      {showInlineLabels ? (
        <>
          {displayLayout.map((point, index) => (
            <span
              key={`${spread.id}-label-${index}`}
              className={quiet ? "tarot-spread-inline-label" : "absolute z-20 flex h-[13px] w-[64px] items-center justify-center overflow-hidden truncate whitespace-nowrap rounded-full bg-white/58 px-1 text-center text-[7px] font-black uppercase leading-none tracking-[0.055em] text-[#6e5968]/88 shadow-[0_4px_12px_rgba(61,43,74,0.10)] backdrop-blur-md"}
              style={{
                ...getSpreadPreviewLabelStyle(point, size.height),
                ...SPREAD_PREVIEW_TEXT_STYLE,
              }}
              title={spread.positionLabels[index]}
            >
              {spread.positionLabels[index]}
            </span>
          ))}
        </>
      ) : null}
      {labelsInLegend ? (
        <div className="absolute inset-x-3 bottom-2 z-20 flex flex-wrap justify-center gap-x-1.5 gap-y-1">
          {spread.positionLabels
            .slice(0, spread.cardCount)
            .map((label, index) => (
              <span
                key={`${spread.id}-legend-${index}`}
                className="flex h-[13px] w-[56px] items-center justify-center overflow-hidden truncate whitespace-nowrap rounded-full bg-white/64 px-1 text-[6.5px] font-black uppercase leading-none tracking-[0.035em] text-[#6e5968]/88 shadow-[0_4px_12px_rgba(61,43,74,0.10)] backdrop-blur-md"
                style={SPREAD_PREVIEW_TEXT_STYLE}
                title={`${index + 1} ${label}`}
              >
                {index + 1} {label}
              </span>
            ))}
        </div>
      ) : null}
    </div>
  );
}

function QuestionIcon({ icon }: { icon: QuestionCard["icon"] }) {
  const className = "h-5 w-5";
  if (icon === "love") return <Heart className={className} />;
  if (icon === "decision") return <Route className={className} />;
  if (icon === "timing") return <Hourglass className={className} />;
  if (icon === "career") return <WandSparkles className={className} />;
  if (icon === "truth") return <Sparkles className={className} />;
  return <Moon className={className} />;
}

function TarotBack({
  className = "",
  cardBackId,
  flat = false,
}: {
  className?: string;
  cardBackId?: TarotCardBackId;
  flat?: boolean;
}) {
  const imageUrl = cardBackId ? getTarotCardBackImage(cardBackId) : "";
  return (
    <div
      className={`relative overflow-hidden rounded-[16px] border border-[#e7c77d]/70 bg-[linear-gradient(155deg,#29395f,#10162c_58%,#291a35)] [backface-visibility:hidden] ${
        flat
          ? "shadow-[0_5px_14px_rgba(46,31,60,0.2)]"
          : "shadow-[0_28px_70px_rgba(70,42,82,0.28),0_0_44px_rgba(246,194,213,0.28)]"
      } ${className}`}
    >
      {imageUrl ? (
        <div
          className="absolute inset-0 bg-center bg-no-repeat"
          style={{
            backgroundImage: `url("${imageUrl}")`,
            backgroundSize: "100% 100%",
            filter: "none",
          }}
        />
      ) : null}
      {imageUrl ? (
        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(24,18,38,0.04),rgba(24,18,38,0.10))]" />
      ) : null}
      <div className="absolute inset-[10px] rounded-[12px] border border-[#f9e3ad]/38" />
      {!imageUrl ? (
        <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 font-serif text-[24px] font-semibold text-[#ffe7a9]/80">
          H
        </span>
      ) : null}
    </div>
  );
}

function RoomBackground({
  design = ROOM_DESIGNS[0]!,
}: {
  design?: RoomDesign;
}) {
  return (
    <div
      data-room-background={design.backgroundId}
      className="pointer-events-none absolute inset-0 overflow-hidden"
    />
  );
}

function PrimaryButton({
  children,
  onClick,
  disabled,
  className = "",
}: {
  children: ReactNode;
  onClick: () => void;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      onKeyDown={(event) => {
        if (event.key !== "Enter" && event.key !== " ") return;
        event.preventDefault();
        if (!disabled) onClick();
      }}
      className={`inline-flex min-h-12 items-center justify-center rounded-full bg-[#2f2544] px-6 py-3 text-[13px] font-black text-[#fff8ec] shadow-[0_16px_34px_rgba(84,61,92,0.24)] transition active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-45 ${className}`}
    >
      {children}
    </button>
  );
}

function StepShell({ children, className = "" }: { children: ReactNode; className?: string }) {
  const reduceMotion = useTarotReducedMotion();
  return (
    <motion.section
      initial={{ opacity: 0, y: reduceMotion ? 0 : 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: reduceMotion ? 0 : -4, transition: { duration: reduceMotion ? 0.01 : 0.12, ease: "easeIn" } }}
      transition={{ duration: reduceMotion ? 0.01 : 0.28, ease: [0.22, 0.8, 0.22, 1] }}
      className={`hint-app-scroll absolute inset-0 z-10 flex w-full transform-gpu flex-col px-5 pb-[calc(var(--hint-safe-bottom)+1.25rem)] pt-[calc(var(--hint-safe-top)+4rem)] will-change-[opacity,transform] ${className}`}
    >
      {children}
    </motion.section>
  );
}

function Composer({
  question,
  setQuestion,
  onSubmit,
  onVoice,
}: {
  question: string;
  setQuestion: (value: string) => void;
  onSubmit: () => void;
  onVoice: () => void;
}) {
  return (
    <div className="fixed inset-x-0 bottom-0 z-40 px-4 pb-[calc(var(--hint-safe-bottom)+0.8rem)]">
      <div className="mx-auto flex max-w-[440px] items-center gap-2 rounded-[28px] border border-white/68 bg-white/66 p-2 shadow-[0_18px_48px_rgba(98,75,102,0.18)] backdrop-blur-xl">
        <input
          value={question}
          onChange={(event) => setQuestion(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") onSubmit();
          }}
          placeholder="Ask about love, timing, choices, or anything you can't stop thinking about."
          className="min-w-0 flex-1 bg-transparent px-3 py-2 text-[14px] font-semibold text-[#382f45] outline-none placeholder:text-[#8f7d91]"
        />
        <button
          type="button"
          onClick={onVoice}
          aria-label="Voice input"
          className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-[#f4e8f1] text-[#6e5871] transition active:scale-95"
        >
          <Mic size={18} />
        </button>
        <button
          type="button"
          onClick={onSubmit}
          aria-label="Send question"
          className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-[#2f2544] text-[#fff8ec] shadow-[0_10px_24px_rgba(65,48,76,0.24)] transition active:scale-95"
        >
          <Send size={17} />
        </button>
      </div>
    </div>
  );
}

function VoicePanel({
  transcript,
  notice,
  listening,
  starting,
  onUse,
  onCancel,
}: {
  transcript: string;
  notice?: string | null;
  listening: boolean;
  starting: boolean;
  onUse: () => void;
  onCancel: () => void;
}) {
  const { t } = useLanguage();
  const reduceMotion = useTarotReducedMotion();
  const animateWave = listening && !reduceMotion;
  const title = notice
    ? t("tarot.voice.stopped")
    : starting
      ? t("tarot.flow.question.voiceStarting")
      : listening
      ? t("tarot.flow.question.voiceListening")
      : transcript
        ? t("tarot.flow.question.voiceReady")
        : t("tarot.voice.stopped");

  return (
    <motion.div
      role="dialog"
      aria-modal="true"
      aria-label={t("tarot.flow.question.voiceInput")}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: reduceMotion ? 0 : 0.18 }}
      className="fixed inset-0 z-[90] bg-[#271f33]/30 px-5 pb-[calc(var(--hint-safe-bottom)+1rem)]"
    >
      <div className="absolute inset-x-4 bottom-[calc(var(--hint-safe-bottom)+1rem)] mx-auto max-w-[440px] rounded-[32px] border border-white/70 bg-[#fff9f4]/98 p-5 text-center shadow-[0_24px_70px_rgba(61,40,74,0.28)]">
        <p role="status" className="font-serif text-[28px] text-[#382f45]">{title}</p>
        <div aria-hidden="true" className="relative mx-auto mt-5 h-20 max-w-[260px]">
          {[0, 1, 2, 3, 4].map((line) => {
            const width = 112 - line * 9;
            return (
            <motion.span
              key={line}
              className="absolute left-1/2 top-1/2 h-1.5 rounded-full bg-[#b997c9]"
              animate={animateWave
                ? {
                    scaleX: [0.42, 1, 0.56],
                    y: [-18 + line * 9, -12 + line * 5, -18 + line * 9],
                    opacity: [0.28, 0.88, 0.36],
                  }
                : {
                    scaleX: 0.54,
                    y: -18 + line * 9,
                    opacity: 0.22,
                  }}
              transition={animateWave
                ? {
                    duration: 1.5 + line * 0.12,
                    repeat: Infinity,
                    ease: "easeInOut",
                  }
                : { duration: 0.22, ease: "easeOut" }}
              style={{
                width,
                marginLeft: -width / 2,
                transformOrigin: "center",
                willChange: "transform, opacity",
              }}
            />
            );
          })}
        </div>
        <p className="mx-auto min-h-12 max-w-[20rem] font-sans text-[14px] font-semibold leading-relaxed text-[#6b586d]">
          {notice || transcript || t("tarot.flow.question.voiceHint")}
        </p>
        <div className="mt-5 flex gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="min-h-11 flex-1 rounded-full border border-[#d9c9d6] bg-white/48 text-[12px] font-black text-[#6f6072]"
          >
            {t("tarot.flow.question.cancel")}
          </button>
          <PrimaryButton
            onClick={onUse}
            disabled={!transcript}
            className="min-h-11 flex-1"
          >
            {t("tarot.flow.question.useVoice")}
          </PrimaryButton>
        </div>
      </div>
    </motion.div>
  );
}

function QuestionStep({
  question,
  setQuestion,
  onSubmit,
  onPromptSelect,
  voiceOpen,
  openVoice,
  closeVoice,
}: {
  question: string;
  setQuestion: (value: string) => void;
  onSubmit: () => void;
  onPromptSelect: (value: string) => void;
  voiceOpen: boolean;
  openVoice: () => void;
  closeVoice: () => void;
}) {
  const { language, t } = useLanguage();
  const [transcript, setTranscript] = useState("");
  const [pickedPrompt, setPickedPrompt] = useState<string | null>(null);
  const [voiceNotice, setVoiceNotice] = useState<string | null>(null);
  const [voiceListening, setVoiceListening] = useState(false);
  const [voiceStarting, setVoiceStarting] = useState(false);
  const speechSessionRef = useRef<HintSpeechSession | null>(null);
  const speechStartRef = useRef<Promise<HintSpeechSession> | null>(null);
  const speechAbortRef = useRef<AbortController | null>(null);
  const voiceRequestRef = useRef(0);
  const intent = getQuestionIntent(question);
  const canContinue = Boolean(cleanQuestion(question));

  async function stopVoice(cancel = false) {
    voiceRequestRef.current += 1;
    if (cancel) speechAbortRef.current?.abort();
    speechAbortRef.current = null;
    const session = speechSessionRef.current;
    const pending = speechStartRef.current;
    speechSessionRef.current = null;
    const startedSession = session ?? await pending?.catch(() => null);
    if (!startedSession) return;
    await (cancel ? startedSession.cancel() : startedSession.stop()).catch(() => undefined);
  }

  useEffect(() => {
    return () => {
      void stopVoice(true);
    };
  }, []);

  async function startVoice() {
    hapticTick(8);
    const previousStop = stopVoice(true);
    const requestId = ++voiceRequestRef.current;
    await previousStop;
    if (voiceRequestRef.current !== requestId) return;
    const controller = new AbortController();
    speechAbortRef.current = controller;
    const isCurrent = () => voiceRequestRef.current === requestId && !controller.signal.aborted;
    let sessionEnded = false;
    setTranscript("");
    setVoiceNotice(null);
    setVoiceListening(false);
    setVoiceStarting(true);
    openVoice();
    const locale =
      language === "zh"
        ? "zh-CN"
        : language === "es"
          ? "es-ES"
          : language === "ja"
            ? "ja-JP"
            : language === "ko"
              ? "ko-KR"
              : "en-US";
    try {
      const pending = startHintSpeechRecognition({
        language: locale,
        signal: controller.signal,
        onStart: () => {
          if (!isCurrent()) return;
          setVoiceStarting(false);
          setVoiceListening(true);
        },
        onTranscript: (nextTranscript) => {
          if (!isCurrent()) return;
          setVoiceNotice(null);
          setTranscript(nextTranscript);
        },
        onEnd: () => {
          sessionEnded = true;
          if (!isCurrent()) return;
          speechSessionRef.current = null;
          setVoiceStarting(false);
          setVoiceListening(false);
        },
        onError: (reason) => {
          if (!isCurrent()) return;
          setVoiceStarting(false);
          setVoiceListening(false);
          const key =
            reason === "permission"
              ? "tarot.voice.permission"
              : reason === "network"
                ? "tarot.voice.network"
                : reason === "no-speech"
                  ? "tarot.voice.noSpeech"
                  : reason === "unavailable"
                    ? "tarot.voice.unavailable"
                    : "tarot.voice.failed";
          setVoiceNotice(t(key));
        },
      });
      speechStartRef.current = pending;
      const session = await pending;
      if (!isCurrent()) {
        await session.cancel();
      } else if (!sessionEnded) {
        speechSessionRef.current = session;
      }
    } catch {
      if (!isCurrent()) return;
      setVoiceStarting(false);
      setVoiceListening(false);
      // The adapter already exposes a localized, typed fallback in the sheet.
    } finally {
      if (voiceRequestRef.current === requestId) speechStartRef.current = null;
    }
  }

  return (
    <>
      <StepShell>
        <div className="pb-[calc(var(--hint-safe-bottom)+7.5rem)]">
          <p className="text-[11px] font-black uppercase tracking-[0.22em] text-[color:var(--tarot-page-muted,#9c7d92)]">
            {t("tarot.flow.question.eyebrow")}
          </p>
          <h1 className="mt-2.5 font-serif text-[32px] leading-[0.98] text-[color:var(--tarot-page-ink,#332d45)]">
            {questionPromptTitle(t, intent)}
          </h1>
          <p className="mt-3 max-w-[24rem] text-[13px] font-semibold leading-relaxed text-[color:var(--tarot-page-muted,#746276)]">
            {questionPromptBody(t, intent)}
          </p>

          {question ? (
            <div className="mt-5 rounded-[24px] border border-white/66 bg-white/46 p-4 shadow-[0_16px_46px_rgba(102,72,105,0.10)] backdrop-blur-xl">
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#a28398]">
                {t("tarot.flow.question.current")}
              </p>
              <p className="mt-2 text-[14px] font-bold leading-relaxed text-[#3d3348]">
                {question}
              </p>
            </div>
          ) : null}

          <div className="mt-5 flex items-center justify-between gap-3">
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[color:var(--tarot-page-muted,#9c7d92)]">
              {t("tarot.flow.question.suggested")}
            </p>
            <p className="rounded-full border border-white/56 bg-white/42 px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.12em] text-[#8a7888] shadow-[0_8px_22px_rgba(96,72,104,0.08)] backdrop-blur-xl">
              {t("tarot.flow.question.autoSpread")}
            </p>
          </div>

          <div className="mt-3 grid grid-cols-2 gap-2">
            {QUESTION_CARDS.map((card) => {
              const promptKey = card.icon;
              const localizedCategory = t(
                `tarot.flow.prompt.${promptKey}.category`,
              );
              const localizedQuestion = t(
                `tarot.flow.prompt.${promptKey}.question`,
              );
              const image =
                getTarotCardImage(card.imageCardId, "hint-card-2") ??
                getTarotCardImage(card.imageCardId, "hint-classic");
              return (
                <button
                  key={card.category}
                  type="button"
                  onClick={() => {
                    hapticTick();
                    setPickedPrompt(card.category);
                    setQuestion(localizedQuestion);
                    onPromptSelect(localizedQuestion);
                  }}
                  className={`relative h-[96px] overflow-hidden rounded-[18px] border bg-white/48 p-3 text-left shadow-[0_12px_28px_rgba(104,82,111,0.08)] backdrop-blur-xl transition duration-200 active:scale-[0.98] ${
                    pickedPrompt === card.category
                      ? "border-[#b997c9] bg-white/68 shadow-[0_16px_36px_rgba(123,91,145,0.16)]"
                      : "border-white/68"
                  }`}
                >
                  {image ? (
                    <span className="pointer-events-none absolute -right-1 bottom-1 h-[62px] w-[38px] rotate-[6deg] overflow-hidden rounded-[8px] border border-white/76 opacity-90 shadow-[0_10px_20px_rgba(79,58,91,0.14)]">
                      <img
                        src={image}
                        alt=""
                        aria-hidden="true"
                        className="h-full w-full object-cover"
                        draggable={false}
                      />
                    </span>
                  ) : null}
                  <span className="relative z-10 flex items-center gap-2">
                    <span className="grid h-7 w-7 place-items-center rounded-full border border-[#b997c9]/20 bg-[#fff9f4]/72 text-[#6f5878]">
                      <QuestionIcon icon={card.icon} />
                    </span>
                    <span className="min-w-0 truncate text-[9px] font-black uppercase tracking-[0.18em] text-[#9d7c84]">
                      {localizedCategory}
                    </span>
                  </span>
                  <span
                    className="relative z-10 mt-2.5 block h-[2.6rem] max-w-[calc(100%-2rem)] overflow-hidden text-[11.5px] font-bold leading-[1.2] text-[#3e3448]"
                    style={{
                      display: "-webkit-box",
                      WebkitBoxOrient: "vertical",
                      WebkitLineClamp: 3,
                    }}
                  >
                    {localizedQuestion}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </StepShell>

      <div className="fixed inset-x-0 bottom-0 z-40 px-4 pb-[calc(var(--hint-safe-bottom)+0.8rem)]">
        <div className="mx-auto flex max-w-[520px] items-end gap-2 rounded-[28px] border border-white/68 bg-white/76 p-2 shadow-[0_18px_54px_rgba(83,61,93,0.20)] backdrop-blur-xl">
          <textarea
            value={question}
            rows={1}
            onChange={(event) => setQuestion(event.target.value)}
            placeholder={t("tarot.flow.question.placeholder")}
            className="max-h-24 min-h-11 flex-1 resize-none rounded-[22px] bg-transparent px-3 py-3 text-[14px] font-bold leading-snug text-[#382f45] outline-none placeholder:text-[#9b8c9e]"
          />
          <button
            type="button"
            onClick={() => void startVoice()}
            aria-label={t("tarot.flow.question.voiceInput")}
            className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-[#f4e8f1] text-[#6e5871] transition active:scale-95"
          >
            <Mic size={18} />
          </button>
          <button
            type="button"
            onClick={onSubmit}
            disabled={!canContinue}
            aria-label={t("common.next")}
            className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-[#2f2544] text-[#fff8ec] shadow-[0_10px_24px_rgba(65,48,76,0.24)] transition active:scale-95 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Send size={18} />
          </button>
        </div>
      </div>
      <AnimatePresence>
        {voiceOpen && (
          <VoicePanel
            transcript={transcript}
            notice={voiceNotice}
            listening={voiceListening}
            starting={voiceStarting}
            onCancel={() => {
              void stopVoice(true);
              closeVoice();
            }}
            onUse={() => {
              hapticTick(8);
              void stopVoice();
              setQuestion(transcript);
              closeVoice();
            }}
          />
        )}
      </AnimatePresence>
    </>
  );
}

function SpreadRecommendationStep({
  spread,
  question,
  recommendation,
  isLoading,
  design,
  onSpreadChange,
  onUse,
}: {
  spread: SpreadChoice;
  question: string;
  recommendation: SpreadRecommendation | null;
  isLoading: boolean;
  design: RoomDesign;
  onSpreadChange: (spread: SpreadChoice) => void;
  onUse: () => void;
}) {
  const { language, t } = useLanguage();
  const currentIndex = Math.max(
    0,
    FEATURED_SPREADS.findIndex((item) => item.id === spread.id),
  );
  const displaySpread = localizeSpreadChoice(spread, t);
  const recommendationMatches = recommendation?.spreadType === spread.id;
  const reason =
    language === "zh"
      ? displaySpread.bestFor
      : recommendationMatches && recommendation.reason.trim()
        ? recommendation.reason
        : spreadReason(spread, question);
  const matchLabel = isLoading
    ? t("tarot.flow.recommendation.loading")
    : recommendationMatches && recommendation?.source === "api"
      ? t("tarot.flow.recommendation.api")
      : recommendationMatches
        ? t("tarot.flow.recommendation.local")
        : t("tarot.flow.recommendation.manual");

  return (
    <StepShell className="tarot-spread-scroll">
      <div className="tarot-spread-recommendation" data-testid="spread-recommendation">
        <header className="tarot-spread-story" data-testid="spread-story">
          <p className="tarot-spread-eyebrow">
            {t("tarot.flow.recommendation.eyebrow")}
          </p>
          <h1 className="font-serif">{displaySpread.label}</h1>
          {question.trim() && <p className="tarot-spread-question font-serif">{question}</p>}
        </header>

        <section className="tarot-spread-preview" aria-label={t("tarot.flow.recommendation.current")}>
          <div className="tarot-spread-preview-heading">
            <p role="status" className="tarot-spread-match">
              <span aria-hidden="true" />
              {matchLabel}
            </p>
            <p className="tarot-spread-size">
              {spread.cardCount === 1
                ? t("tarot.flow.recommendation.singleCard")
                : formatCopy(t("tarot.flow.recommendation.cardCount"), { count: spread.cardCount })}
            </p>
          </div>
          <SpreadPreviewCarousel
            index={currentIndex}
            count={FEATURED_SPREADS.length}
            spreadId={spread.id}
            spreadLabel={displaySpread.label}
            currentLabel={t("tarot.flow.recommendation.current")}
            previousLabel={t("tarot.flow.recommendation.previous")}
            nextLabel={t("tarot.flow.recommendation.next")}
            onSelect={(index) => {
              onSpreadChange(FEATURED_SPREADS[index]!);
              hapticTick();
            }}
          >
            <SpreadDiagram
              spread={displaySpread}
              active
              quiet
              cardBackId={design.cardBackId}
              className="tarot-spread-diagram-content"
            />
          </SpreadPreviewCarousel>
            <ol className={`tarot-spread-position-legend${spread.cardCount === 1 ? " tarot-spread-position-legend-single" : ""}`}>
              {displaySpread.positionLabels.slice(0, spread.cardCount).map((label, index) => (
                <li key={`${spread.id}-${index}`}>
                  <span>{String(index + 1).padStart(2, "0")}</span>
                  {label}
                </li>
              ))}
            </ol>
          <div className="tarot-spread-description" data-testid="spread-description">
            <p>{displaySpread.bestFor}</p>
          </div>
        </section>

        <div className="tarot-spread-reason" data-testid="spread-reason">
          <p className="tarot-spread-eyebrow">
            {t("tarot.flow.recommendation.why")}
          </p>
          <p className="tarot-spread-reason-copy font-serif">
            {reason}
          </p>
        </div>

        <PrimaryButton onClick={onUse} className="tarot-spread-use w-full">
          {t("tarot.flow.recommendation.use")}
          <ArrowRight size={18} strokeWidth={1.4} aria-hidden="true" />
        </PrimaryButton>
      </div>
    </StepShell>
  );
}

function SpotlightSelectorStep({
  selected,
  cardBackId,
  onSelect,
  onChoose,
}: {
  selected: SpreadChoice;
  cardBackId: TarotCardBackId;
  onSelect: (spread: SpreadChoice) => void;
  onChoose: () => void;
}) {
  const currentIndex = Math.max(
    0,
    FEATURED_SPREADS.findIndex((spread) => spread.id === selected.id),
  );
  const center = FEATURED_SPREADS[currentIndex] ?? FEATURED_SPREADS[0]!;

  function move(delta: number) {
    const next =
      (currentIndex + delta + FEATURED_SPREADS.length) %
      FEATURED_SPREADS.length;
    onSelect(FEATURED_SPREADS[next]!);
    hapticTick();
  }

  return (
    <StepShell>
      <div className="flex flex-1 flex-col justify-center overflow-hidden">
        <h1 className="font-serif text-[34px] leading-none text-[color:var(--tarot-page-ink,#332d45)]"><LocalizedText text={" Choose the shape of the reading. "} /></h1>
        <div className="relative mt-9 h-[420px]">
          <div className="absolute left-1/2 top-1/2 h-[360px] w-[360px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(circle,rgba(255,244,218,0.78),rgba(247,205,224,0.42)_38%,transparent_70%)]" />
          {[-1, 0, 1].map((offset) => {
            const spread =
              FEATURED_SPREADS[
                (currentIndex + offset + FEATURED_SPREADS.length) %
                  FEATURED_SPREADS.length
              ]!;
            const active = offset === 0;
            return (
              <motion.div
                key={`${spread.id}-${offset}`}
                className={`absolute left-1/2 top-1/2 w-[270px] -translate-x-1/2 -translate-y-1/2 rounded-[30px] border p-5 text-center ${
                  active
                    ? "border-white/80 bg-white/62 shadow-[0_26px_72px_rgba(95,72,110,0.18)]"
                    : "border-white/34 bg-white/28 blur-[1.2px]"
                }`}
                animate={{
                  x: offset * 222,
                  scale: active ? 1 : 0.82,
                  opacity: active ? 1 : 0.45,
                }}
                transition={{ type: "spring", stiffness: 180, damping: 24 }}
              >
                <SpreadDiagram
                  spread={spread}
                  active={active}
                  cardBackId={cardBackId}
                  className="h-40"
                />
                <p className="mt-3 font-serif text-[25px] leading-tight text-[#342e43]">
                  {spread.label}
                </p>
                <p className="mt-2 text-[11px] font-black uppercase tracking-[0.14em] text-[#a88359]">
                  {spread.cardCount}<LocalizedText text={" cards "} /></p>
                <p className="mt-3 line-clamp-2 text-[13px] font-semibold leading-relaxed text-[#6f5d72]">
                  {spread.description}. {spread.positions}
                </p>
              </motion.div>
            );
          })}
          <button
            type="button"
            onPointerDown={(event) => event.stopPropagation()}
            onClick={() => move(-1)}
            aria-label="Previous spread"
            className="absolute left-0 top-1/2 z-20 grid h-12 w-12 -translate-y-1/2 place-items-center rounded-full border border-white/58 bg-white/48 text-[#67556d] shadow-lg"
          >
            <ChevronLeft />
          </button>
          <button
            type="button"
            onPointerDown={(event) => event.stopPropagation()}
            onClick={() => move(1)}
            aria-label="Next spread"
            className="absolute right-0 top-1/2 z-20 grid h-12 w-12 -translate-y-1/2 place-items-center rounded-full border border-white/58 bg-white/48 text-[#67556d] shadow-lg"
          >
            <ChevronRight />
          </button>
        </div>
        <PrimaryButton
          onClick={onChoose}
          className="mx-auto w-full max-w-[300px]"
        ><LocalizedText text={" Choose this spread "} /></PrimaryButton>
        <p className="mt-4 text-center text-[12px] font-semibold text-[color:var(--tarot-page-muted,#826f82)]">
          {center.bestFor}
        </p>
      </div>
    </StepShell>
  );
}

function RoomDesignStudioStep({
  design,
  onDesign,
  spread,
  onContinue,
  settingsMode = false,
}: {
  design: RoomDesign;
  onDesign: (design: RoomDesign) => void;
  spread: SpreadChoice;
  onContinue: () => void;
  settingsMode?: boolean;
}) {
  const { t } = useLanguage();
  const [activePanel, setActivePanel] = useState<DesignPanel>("room");
  const [customizeOpen, setCustomizeOpen] = useState(settingsMode);
  const [showTokenStyles, setShowTokenStyles] = useState(false);
  const { profile } = useProfile();
  const [storedBirthProfile, setStoredBirthProfile] = useState(() =>
    readBirthProfile(),
  );
  const cardFace = getCardFace(design.cardArtId);
  const background = getRoomBackground(design.backgroundId);
  const displaySpread = localizeSpreadChoice(spread, t);
  const cardFaceLabel = t(`tarot.cardFace.${cardFace.id}.label`);
  const backgroundLabel = t(`tarot.background.${background.id}.label`);
  const activeBirthDate =
    profile?.birthDate ?? storedBirthProfile?.birthDate ?? null;
  const personalBacks = getPersonalZodiacCardBacks(activeBirthDate);
  const cardBack =
    TAROT_CARD_BACK_CHOICES.find((item) => item.id === design.cardBackId) ??
    TAROT_CARD_BACK_CHOICES[0]!;
  const cardBackShortLabel = compactCardBackLabel(cardBack.label);
  const previewImages = CARD_FACE_PREVIEW_IDS.map((cardId) =>
    getTarotCardImage(cardId, design.cardArtId),
  ).filter((image): image is string => Boolean(image));
  const frontPreviewImage = previewImages[1] ?? previewImages[0] ?? null;
  const unlockedCardBackChoices = TAROT_CARD_BACK_CHOICES.filter((item) =>
    isUnlockedCardBackForBirth(item, personalBacks),
  );
  const lockedCardBackChoices = TAROT_CARD_BACK_CHOICES.filter((item) =>
    isLockedCardBackForBirth(item, personalBacks),
  );
  const visibleCardBackChoices = showTokenStyles
    ? [...unlockedCardBackChoices, ...lockedCardBackChoices]
    : unlockedCardBackChoices;
  const cardBackHelpText = personalBacks
    ? formatCopy(t("tarot.flow.design.cardBackHelpPersonal"), {
        sign: personalBacks.sign,
      })
    : t("tarot.flow.design.cardBackHelpGuest");
  const summaryItems = [
    {
      label: settingsMode
        ? t("tarot.flow.design.room")
        : t("tarot.flow.design.spread"),
      value: settingsMode ? backgroundLabel : displaySpread.label,
    },
    { label: t("tarot.flow.design.front"), value: cardFaceLabel },
    { label: t("tarot.flow.design.back"), value: cardBackShortLabel },
  ];
  const panelTabs: Array<{ id: DesignPanel; label: string; value: string }> = [
    {
      id: "room",
      label: t("tarot.flow.design.room"),
      value: backgroundLabel,
    },
    {
      id: "front",
      label: t("tarot.flow.design.front"),
      value: cardFaceLabel,
    },
    {
      id: "back",
      label: t("tarot.flow.design.back"),
      value: cardBackShortLabel,
    },
  ];

  useEffect(() => {
    const syncBirthProfile = () => setStoredBirthProfile(readBirthProfile());
    window.addEventListener("hint.birthProfile.updated", syncBirthProfile);
    return () => {
      window.removeEventListener(
        "hint.birthProfile.updated",
        syncBirthProfile,
      );
    };
  }, []);

  useEffect(() => {
    if (isUnlockedCardBackForBirth({ id: design.cardBackId }, personalBacks)) {
      return;
    }
    const nextCardBackId =
      personalBacks?.cardBackIds[0] ?? DEFAULT_GUEST_CARD_BACK_ID;
    if (nextCardBackId === design.cardBackId) return;
    const nextBackStyle = getCardBackStyle(nextCardBackId);
    onDesign({
      ...design,
      cardBackId: nextCardBackId,
      backStyle: nextBackStyle,
      deckStyleId: nextBackStyle,
    });
  }, [activeBirthDate, design, onDesign, personalBacks]);

  return (
    <StepShell>
      <div className="flex min-h-0 flex-1 flex-col">
        <div className="flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.22em] text-[color:var(--tarot-page-muted,#9c7d92)]">
          <Palette size={15} />
          {settingsMode
            ? t("tarot.flow.design.settingsEyebrow")
            : t("tarot.flow.design.setupEyebrow")}
        </div>
        <h1 className="mt-2.5 font-serif text-[32px] leading-[1.02] text-[color:var(--tarot-page-ink,#332d45)]">
          {settingsMode
            ? t("tarot.flow.design.settingsTitle")
            : t("tarot.flow.design.setupTitle")}
        </h1>
        <p className="mt-2.5 max-w-[22rem] text-[13px] font-semibold leading-relaxed text-[color:var(--tarot-page-muted,#746276)]">
          {settingsMode
            ? t("tarot.flow.design.settingsBody")
            : t("tarot.flow.design.setupBody")}
        </p>

        <div className="mt-4 pb-2 pr-1">
          <div className="rounded-[26px] border border-white/64 bg-white/42 p-3 shadow-[0_18px_48px_rgba(96,72,104,0.11)] backdrop-blur-xl">
            <div
              className="relative overflow-hidden rounded-[22px] border border-white/42 p-4"
              style={{ background: getTarotRoomSurfaceBackground(design.backgroundId) }}
            >
              <div className="absolute inset-0 opacity-60 [background-image:radial-gradient(circle_at_20%_28%,rgba(255,255,255,0.88)_0_1px,transparent_1px),radial-gradient(circle_at_76%_18%,rgba(198,148,73,0.38)_0_1px,transparent_1px)] [background-size:72px_82px]" />
              <div className="relative z-10 flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="text-[9px] font-black uppercase tracking-[0.18em] text-[#9b7a8d]">
                    {settingsMode
                      ? t("tarot.flow.design.livePreview")
                      : t("tarot.flow.design.readySetup")}
                  </p>
                  <p
                    className={`mt-1 font-serif leading-tight text-[#342e43] ${
                      settingsMode ? "text-[24px]" : "truncate text-[29px]"
                    }`}
                  >
                    {settingsMode
                      ? t("tarot.flow.design.yourRoom")
                      : displaySpread.label}
                  </p>
                </div>
                <span className="shrink-0 rounded-full border border-white/58 bg-white/62 px-3 py-1.5 text-[9px] font-black uppercase tracking-[0.12em] text-[#8d6f82]">
                  {settingsMode
                    ? t("tarot.flow.design.roomStyle")
                    : formatCopy(t("tarot.flow.recommendation.cardCount"), {
                        count: spread.cardCount,
                      })}
                </span>
              </div>

              <div className="relative z-10 mt-3 grid grid-cols-[minmax(0,1fr)_132px] items-center gap-3">
                <div className="min-w-0 divide-y divide-[#7b5b91]/10">
                  {summaryItems.map((item) => (
                    <div
                      key={item.label}
                      className="flex min-h-11 items-center justify-between gap-3 px-1"
                    >
                      <span className="text-[8px] font-black uppercase tracking-[0.15em] text-[#9b7a8d]">
                        {item.label}
                      </span>
                      <span className="min-w-0 truncate text-right text-[12px] font-black text-[#43394a]">
                        {item.value}
                      </span>
                    </div>
                  ))}
                </div>
                <div className="relative h-[136px] min-w-0 overflow-hidden rounded-[20px] border border-white/46 bg-white/24 p-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.42)]">
                  <div
                    className="absolute -inset-6 rounded-full blur-2xl"
                    style={{ backgroundColor: design.glow }}
                  />
                  <div className="relative z-10 grid h-full grid-cols-2 gap-2">
                    <div className="flex min-w-0 flex-col items-center justify-center rounded-[17px] border border-white/46 bg-white/28 px-1 py-2">
                      <TarotBack
                        cardBackId={design.cardBackId}
                        className="h-[82px] w-[52px] rounded-[10px]"
                      />
                      <span className="mt-2 block text-[8px] font-black uppercase tracking-[0.12em] text-[#8f7185]">
                        {t("tarot.flow.design.back")}
                      </span>
                    </div>
                    <div className="flex min-w-0 flex-col items-center justify-center rounded-[17px] border border-white/46 bg-white/28 px-1 py-2">
                      {frontPreviewImage ? (
                        <span className="block h-[82px] w-[52px] overflow-hidden rounded-[10px] border border-white/82 shadow-[0_12px_24px_rgba(90,65,95,0.16)]">
                          <img
                            src={frontPreviewImage}
                            alt=""
                            aria-hidden="true"
                            className="h-full w-full object-cover"
                            draggable={false}
                          />
                        </span>
                      ) : (
                        <span className="flex h-[94px] w-[60px] items-center justify-center rounded-[12px] border border-white/68 bg-white/34 font-serif text-[22px] text-[#6a536a]">
                          H
                        </span>
                      )}
                      <span className="mt-2 block text-[8px] font-black uppercase tracking-[0.12em] text-[#8f7185]">
                        {t("tarot.flow.design.front")}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={() => {
                hapticTick();
                setCustomizeOpen((current) => !current);
              }}
              className="mt-3 flex min-h-12 w-full items-center justify-between rounded-[22px] border border-white/54 bg-white/42 px-4 text-left text-[#54475c] transition active:scale-[0.99]"
              aria-expanded={customizeOpen}
            >
              <span>
                <span className="block text-[10px] font-black uppercase tracking-[0.16em] text-[#9c7d92]">
                  {t("tarot.flow.design.customize")}
                </span>
                <span className="mt-0.5 block text-[12px] font-black">
                  {t("tarot.flow.design.customizeBody")}
                </span>
              </span>
              <ChevronRight
                size={17}
                className={`transition ${customizeOpen ? "rotate-90" : ""}`}
              />
            </button>

            {customizeOpen ? (
              <>
                <div className="mt-3 grid grid-cols-3 gap-1.5 rounded-[22px] border border-white/54 bg-white/32 p-1">
                  {panelTabs.map((panel) => {
                    const selected = activePanel === panel.id;
                    return (
                      <button
                        key={panel.id}
                        type="button"
                        onClick={() => {
                          hapticTick();
                          setActivePanel(panel.id);
                        }}
                        aria-pressed={selected}
                        className={`min-w-0 rounded-[18px] px-2 py-2.5 text-left transition active:scale-[0.98] ${
                          selected
                            ? "bg-white/78 text-[#3d3349] shadow-[0_10px_24px_rgba(92,65,102,0.14)]"
                            : "text-[#8a7588]"
                        }`}
                      >
                        <span className="block text-[9px] font-black uppercase tracking-[0.14em]">
                          {panel.label}
                        </span>
                        <span className="mt-0.5 block truncate text-[10px] font-black">
                          {panel.value}
                        </span>
                      </button>
                    );
                  })}
                </div>

                <div className="mt-3 rounded-[24px] border border-white/54 bg-white/32 p-3">
                  {activePanel === "room" ? (
                    <section>
                      <div className="mb-3">
                        <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#9c7d92]">
                          {t("tarot.flow.design.roomBackground")}
                        </p>
                        <p className="mt-1 text-[12px] font-bold text-[#6b596c]">
                          {t("tarot.flow.design.roomBackgroundBody")}
                        </p>
                      </div>
                      <div className="grid grid-cols-3 gap-2">
                        {BACKGROUND_STYLES.map((item) => {
                          const selected = item.id === design.backgroundId;
                          return (
                            <button
                              key={item.id}
                              type="button"
                              data-testid={`tarot-room-background-${item.id}`}
                              onClick={() => {
                                hapticTick();
                                onDesign({
                                  ...design,
                                  id: item.id,
                                  label: item.label,
                                  mood: item.description,
                                  backgroundId: item.id,
                                  background: getTarotRoomSurfaceBackground(
                                    item.id,
                                  ),
                                  glow: getBackgroundGlow(item.id),
                                });
                              }}
                              aria-pressed={selected}
                              className={`rounded-[18px] border p-2 text-left transition active:scale-[0.98] ${
                                selected
                                  ? "border-[#d7a85e] bg-white/78 shadow-[0_12px_28px_rgba(121,82,93,0.14)]"
                                  : "border-white/54 bg-white/30"
                              }`}
                            >
                              <span
                                className="block h-16 rounded-[14px] border border-white/54"
                                style={{ background: item.preview }}
                              />
                              <span className="mt-2 block truncate text-[10px] font-black text-[#4a4050]">
                                {t(`tarot.background.${item.id}.label`)}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </section>
                  ) : null}

                  {activePanel === "front" ? (
                    <section>
                      <div className="mb-3">
                        <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#9c7d92]">
                          {t("tarot.flow.design.cardFront")}
                        </p>
                        <p className="mt-1 text-[12px] font-bold text-[#6b596c]">
                          {t("tarot.flow.design.cardFrontBody")}
                        </p>
                      </div>
                      <div className="grid grid-cols-3 gap-2">
                        {CARD_FACE_STYLES.map((item) => {
                          const selected = item.id === design.cardArtId;
                          const images = item.previewCards
                            .map((cardId) =>
                              getTarotCardImage(cardId, item.id),
                            )
                            .filter((image): image is string =>
                              Boolean(image),
                            );
                          return (
                            <button
                              key={item.id}
                              type="button"
                              data-testid={`tarot-card-front-${item.id}`}
                              onClick={() => {
                                hapticTick();
                                onDesign({ ...design, cardArtId: item.id });
                              }}
                              aria-pressed={selected}
                              className={`rounded-[18px] border p-2 text-left transition active:scale-[0.98] ${
                                selected
                                  ? "border-[#d7a85e] bg-white/78 shadow-[0_12px_28px_rgba(121,82,93,0.14)]"
                                  : "border-white/54 bg-white/30"
                              }`}
                            >
                              <span className="relative block h-16">
                                {images.slice(0, 3).map((image, index) => (
                                  <span
                                    key={image}
                                    className="absolute left-1/2 top-1 block h-14 w-9 overflow-hidden rounded-[8px] border border-white/68 shadow-[0_8px_14px_rgba(90,65,95,0.14)]"
                                    style={{
                                      transform: `translateX(calc(-50% + ${(index - 1) * 13}px)) rotate(${(index - 1) * 7}deg)`,
                                      zIndex: index + 1,
                                    }}
                                  >
                                    <img
                                      src={image}
                                      alt=""
                                      aria-hidden="true"
                                      className="h-full w-full object-cover"
                                      draggable={false}
                                    />
                                  </span>
                                ))}
                              </span>
                              <span className="mt-1 block truncate text-[10px] font-black text-[#4a4050]">
                                {t(`tarot.cardFace.${item.id}.label`)}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </section>
                  ) : null}

                  {activePanel === "back" ? (
                    <section>
                      <div className="mb-3">
                        <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#9c7d92]">
                          {t("tarot.flow.design.cardBack")}
                        </p>
                        <p className="mt-1 text-[12px] font-bold leading-snug text-[#6b596c]">
                          {cardBackHelpText}
                        </p>
                      </div>
                      <div className="grid max-h-[300px] grid-cols-2 gap-2 overflow-y-auto pr-1 [scrollbar-width:none]">
                        {visibleCardBackChoices.map((item) => {
                          const selected = item.id === design.cardBackId;
                          const locked = isLockedCardBackForBirth(
                            item,
                            personalBacks,
                          );
                          return (
                            <button
                              key={item.id}
                              type="button"
                              data-testid={`tarot-card-back-${item.id.replace(/[^a-zA-Z0-9]+/g, "-")}`}
                              onClick={() => {
                                hapticTick();
                                if (locked) return;
                                const backStyle = getCardBackStyle(item.id);
                                onDesign({
                                  ...design,
                                  cardBackId: item.id,
                                  backStyle,
                                  deckStyleId: backStyle,
                                });
                              }}
                              className={`relative min-w-0 overflow-hidden rounded-[18px] border p-3 text-center transition active:scale-[0.98] ${
                                selected
                                  ? "border-[#d7a85e] bg-white/72 shadow-[0_12px_32px_rgba(121,82,93,0.14)]"
                                  : locked
                                    ? "border-white/42 bg-white/20 opacity-72"
                                    : "border-white/54 bg-white/30"
                              }`}
                              aria-disabled={locked}
                              disabled={locked}
                              aria-pressed={selected}
                            >
                              <img
                                src={item.image}
                                alt=""
                                aria-hidden="true"
                                className={`mx-auto h-24 w-[62px] rounded-[11px] object-cover shadow-[0_10px_18px_rgba(90,65,95,0.16)] ${locked ? "saturate-[0.75]" : ""}`}
                                draggable={false}
                              />
                              <p className="mt-2 truncate text-[10px] font-black text-[#4a4050]">
                                {compactCardBackLabel(item.label)}
                              </p>
                              {locked ? (
                                <span className="absolute right-2 top-2 inline-flex h-7 items-center gap-1 rounded-full border border-white/60 bg-white/78 px-2 text-[8px] font-black uppercase tracking-[0.12em] text-[#7a6074] shadow-[0_8px_18px_rgba(72,52,82,0.14)]">
                                  <Lock size={10} />
                                  {t("tarot.flow.design.token")}
                                </span>
                              ) : null}
                            </button>
                          );
                        })}
                      </div>
                      {lockedCardBackChoices.length ? (
                        <button
                          type="button"
                          onClick={() => {
                            hapticTick();
                            setShowTokenStyles((current) => !current);
                          }}
                          className="mt-3 min-h-11 w-full rounded-full border border-white/58 bg-white/44 px-4 text-[11px] font-black text-[#67556d]"
                        >
                          {showTokenStyles
                            ? t("tarot.flow.design.showMyBacks")
                            : t("tarot.flow.design.showTokenStyles")}
                        </button>
                      ) : null}
                    </section>
                  ) : null}
                </div>
              </>
            ) : null}
          </div>
        </div>

        <PrimaryButton onClick={onContinue} className="mt-3 w-full">
          {settingsMode
            ? t("tarot.flow.design.save")
            : t("tarot.flow.design.begin")}
        </PrimaryButton>
      </div>
    </StepShell>
  );
}

function PrepareStep({
  question,
  spread,
  design,
  onDone,
}: {
  question: string;
  spread: SpreadChoice;
  design: RoomDesign;
  onDone: () => void;
}) {
  const { t } = useLanguage();
  const reduceMotion = useTarotReducedMotion();
  const displaySpread = localizeSpreadChoice(spread, t);

  useEffect(() => {
    const timer = window.setTimeout(onDone, reduceMotion ? 80 : 1300);
    return () => window.clearTimeout(timer);
  }, [onDone, reduceMotion]);

  return (
    <StepShell>
      <div className="flex flex-1 flex-col items-center justify-center text-center">
        <motion.div
          className="grid h-40 w-40 place-items-center rounded-full border border-[#f2d6e2]/72 bg-white/36 shadow-[0_0_70px_rgba(246,186,209,0.42)]"
          animate={{
            scale: reduceMotion ? 1 : [0.92, 1.08, 0.92],
            opacity: reduceMotion ? 1 : [0.72, 1, 0.72],
          }}
          transition={{
            duration: reduceMotion ? 0.01 : 2.2,
            repeat: reduceMotion ? 0 : Infinity,
            ease: "easeInOut",
          }}
        >
          <TarotBack cardBackId={design.cardBackId} className="h-28 w-[72px]" />
        </motion.div>
        <h1 className="mt-10 font-serif text-[34px] leading-none text-[color:var(--tarot-page-ink,#332d45)]">
          {t("tarot.flow.prepare.title")}
        </h1>
        <p className="mt-4 max-w-[20rem] text-[15px] font-semibold leading-relaxed text-[color:var(--tarot-page-muted,#746276)]">
          {t("tarot.flow.prepare.body")}
        </p>
        <div className="mt-8 w-full max-w-[340px] rounded-[24px] border border-white/62 bg-white/38 p-4 text-left backdrop-blur-xl">
          <p className="text-[11px] font-black uppercase tracking-[0.18em] text-[#a28191]">
            {displaySpread.label}
          </p>
          <p className="mt-2 text-[14px] font-semibold leading-relaxed text-[#4a4050]">
            {question}
          </p>
        </div>
      </div>
    </StepShell>
  );
}

function RitualShuffleStep({
  design,
  deck,
  onComplete,
}: {
  design: RoomDesign;
  deck: RitualCard[];
  onComplete: (deck: RitualCard[]) => void;
}) {
  const reduceMotion = useTarotReducedMotion();
  const { pageVisible } = useMotionPolicy();
  const washProxyCount = Math.min(deck.length, 48);
  const [deckState, setDeckState] = useState<FlowDeckState>(() =>
    ({
      hiddenDeckOrder: deck,
      ritualCards: loosenDeckForWash(deck.slice(0, washProxyCount)),
    }),
  );
  const [washState, dispatchWash] = useReducer(
    washRitualReducer,
    undefined,
    createInitialWashRitualState,
  );
  const { stage, mode: washMode, autoWashing } = washState;
  const deckStateRef = useRef(deckState);
  const stageRef = useRef(stage);
  const washScoreRef = useRef(0);
  const autoWashingRef = useRef(false);
  const autoWashFrameRef = useRef<number | null>(null);
  const washFrameRef = useRef<number | null>(null);
  const washRitualRef = useRef<CardWashRitualHandle | null>(null);
  const pendingWashPointerRef = useRef<WashPointer | null>(null);
  const timers = useRef<number[]>([]);
  const lastWashHapticAtRef = useRef(0);
  const lastStrongWashHapticAtRef = useRef(0);
  const squareStartedRef = useRef(false);
  const gatherStartedAtRef = useRef(0);
  const squareStartedAtRef = useRef(0);
  const ritualDoneRef = useRef(false);
  const washCompleteScore = 96;
  const washTiming = getWashRitualTiming(reduceMotion);
  const theme = getWashTheme(design);
  const displayRitualCards = deckState.ritualCards;
  stageRef.current = stage;

  function clearTimers() {
    timers.current.forEach((timer) => window.clearTimeout(timer));
    timers.current = [];
    if (autoWashFrameRef.current !== null) {
      window.cancelAnimationFrame(autoWashFrameRef.current);
      autoWashFrameRef.current = null;
    }
    if (washFrameRef.current !== null) {
      window.cancelAnimationFrame(washFrameRef.current);
      washFrameRef.current = null;
    }
    pendingWashPointerRef.current = null;
  }

  function updateDeckState(
    updater: (current: FlowDeckState) => FlowDeckState,
    commit = true,
  ) {
    const next = updater(deckStateRef.current);
    deckStateRef.current = next;
    if (commit) {
      setDeckState(next);
    } else {
      washRitualRef.current?.paintCards(next.ritualCards);
    }
    return next;
  }

  useEffect(() => {
    deckStateRef.current = deckState;
  }, [deckState]);

  useEffect(() => {
    return () => clearTimers();
  }, []);

  useEffect(() => {
    if (!pageVisible || reduceMotion || stage !== "washing" || autoWashing || washMode !== "manual") return undefined;
    let frame = 0;
    const nextFrame = createWashFrameClock(performance.now());
    const tick = (now: number) => {
      const steps = nextFrame(now);
      const pointer = pendingWashPointerRef.current;
      if (pointer) {
        pendingWashPointerRef.current = null;
        applyWashPointer(pointer);
      } else if (steps > 0) {
        updateDeckState((current) => {
          let ritualCards = current.ritualCards;
          for (let step = 0; step < steps; step += 1) {
            ritualCards = applyTableCurrent(ritualCards, now);
          }
          return { ...current, ritualCards };
        }, false);
      }
      frame = window.requestAnimationFrame(tick);
    };
    frame = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(frame);
  }, [autoWashing, pageVisible, reduceMotion, stage, washMode]);

  function beginWash() {
    if (stageRef.current !== "washing" || autoWashingRef.current) return;
    if (washMode === null) {
      hapticPulse([6, 22, 8]);
      dispatchWash({ type: "MANUAL_START" });
    }
    washScoreRef.current = Math.max(washScoreRef.current, 4);
    dispatchWash({
      type: "PROGRESS",
      progress: washScoreRef.current / washCompleteScore,
    });
  }

  function applyWashPointer(pointer: WashPointer) {
    if (stageRef.current !== "washing" || autoWashingRef.current) return;
    if (washMode === null) dispatchWash({ type: "MANUAL_START" });
    const now = Date.now();
    if (now - lastWashHapticAtRef.current > 88) {
      lastWashHapticAtRef.current = now;
      hapticTick(pointer.spinDirection === 1 ? 4 : 3);
    }
    updateDeckState((current) => {
      const result = applyWashForce(current.ritualCards, pointer);
      if (
        result.movementScore > 9 &&
        now - lastStrongWashHapticAtRef.current > 320
      ) {
        lastStrongWashHapticAtRef.current = now;
        hapticPulse([4, 18, 5]);
      }
      washScoreRef.current = Math.min(
        washCompleteScore,
        washScoreRef.current + result.movementScore * 0.16 + 0.1,
      );
      return {
        ...current,
        ritualCards: result.cards,
      };
    }, false);
  }

  function flushPendingWash() {
    if (washFrameRef.current !== null) {
      window.cancelAnimationFrame(washFrameRef.current);
      washFrameRef.current = null;
    }
    const pointer = pendingWashPointerRef.current;
    pendingWashPointerRef.current = null;
    if (pointer) applyWashPointer(pointer);
  }

  function wash(pointer: WashPointer) {
    if (stageRef.current !== "washing" || autoWashingRef.current) return;
    const pending = pendingWashPointerRef.current;
    pendingWashPointerRef.current = pending
      ? {
          ...pointer,
          movementX: pending.movementX + pointer.movementX,
          movementY: pending.movementY + pointer.movementY,
        }
      : pointer;
    if (reduceMotion && washFrameRef.current === null) {
      washFrameRef.current = window.requestAnimationFrame(flushPendingWash);
    }
  }

  function finishWash() {
    if (stageRef.current !== "washing") return;
    flushPendingWash();
    stageRef.current = "gathering";
    autoWashingRef.current = false;
    hapticPulse([8, 34, 10]);
    dispatchWash({ type: "WASH_COMPLETE" });
    squareStartedRef.current = false;
    gatherStartedAtRef.current = performance.now();
    updateDeckState((current) => ({
      ...current,
      hiddenDeckOrder: shuffleHiddenDeck(current.hiddenDeckOrder),
      ritualCards: gatherDeckToCenter(current.ritualCards),
    }));
    clearTimers();
    // CSS events can disappear after a visibility change or a no-op transform.
    // These bounds run alongside the visual settle rather than adding seconds
    // of dead time when an event never arrives.
    timers.current = [
      window.setTimeout(squareGatheredDeck, washTiming.squareMs),
      window.setTimeout(completeGather, washTiming.readyMs),
    ];
  }

  function cancelWash() {
    if (stageRef.current !== "washing" || autoWashingRef.current) return;
    flushPendingWash();
    setDeckState(deckStateRef.current);
    dispatchWash({ type: "MANUAL_CANCEL" });
  }

  function squareGatheredDeck() {
    if (ritualDoneRef.current || stageRef.current !== "gathering" || squareStartedRef.current) return;
    squareStartedRef.current = true;
    squareStartedAtRef.current = performance.now();
    hapticTick(5);
    updateDeckState((current) => ({
      ...current,
      ritualCards: squareDeckAtCenter(current.ritualCards),
    }));
    // Anchor recovery to the actual squaring start as well: a throttled timer
    // must not leave the ritual waiting for a transitionend that never arrives.
    timers.current.push(window.setTimeout(completeGather, washTiming.readyMs - washTiming.squareMs));
  }

  function completeGather() {
    if (ritualDoneRef.current || stageRef.current !== "gathering") return;
    if (!squareStartedRef.current) {
      if (performance.now() - gatherStartedAtRef.current >= washTiming.squareMs) squareGatheredDeck();
      return;
    }
    // A late transitionend from the gathering phase must not finish squaring.
    if (performance.now() - squareStartedAtRef.current < (reduceMotion ? 10 : 520)) return;

    ritualDoneRef.current = true;
    stageRef.current = "cutReady";
    dispatchWash({ type: "GATHER_COMPLETE" });
    hapticPulse([5, 24, 5]);
    clearTimers();
    onComplete(deckStateRef.current.hiddenDeckOrder);
  }

  function startAutoWash() {
    if (stageRef.current !== "washing" || autoWashingRef.current) return;
    autoWashingRef.current = true;
    dispatchWash({ type: "AUTO_START" });
    hapticPulse([7, 26, 8]);
    // Continue from the cards already on the table; starting auto must not
    // teleport a partially washed deck back into its initial layout.
    clearTimers();
    const startedAt = performance.now();
    const nextFrame = createWashFrameClock(startedAt);
    const duration = washTiming.autoWashMs;
    const tick = (now: number) => {
      if (!autoWashingRef.current || stageRef.current !== "washing") return;
      const elapsed = now - startedAt;
      const steps = nextFrame(now);
      if (steps > 0 && !reduceMotion) {
        updateDeckState((current) => {
          let ritualCards = current.ritualCards;
          for (let step = 0; step < steps; step += 1) {
            ritualCards = applyAutoWashWave(ritualCards, elapsed, 1);
          }
          return { ...current, ritualCards };
        }, false);
      }
      washScoreRef.current = Math.min(
        washCompleteScore,
        (elapsed / duration) * washCompleteScore,
      );
      if (elapsed >= duration) {
        autoWashFrameRef.current = null;
        finishWash();
        return;
      }
      autoWashFrameRef.current = window.requestAnimationFrame(tick);
    };
    autoWashFrameRef.current = window.requestAnimationFrame(tick);
  }

  return (
    <CardWashRitual
      ref={washRitualRef}
      stage={stage}
      ritualCards={displayRitualCards}
      deckCount={deck.length}
      theme={theme}
      onBeginWash={beginWash}
      onWash={wash}
      onWashRelease={finishWash}
      onWashCancel={cancelWash}
      autoWashing={autoWashing}
      onAutoWash={startAutoWash}
      onCardsSettled={() => completeGather()}
    />
  );
}


const POST_CUT_SHUFFLE_SECONDS = 2.8;

function RitualDeckInterleave({
  cardBackId,
  settled,
  reduceMotion,
  onComplete,
}: {
  cardBackId: TarotCardBackId;
  settled: boolean;
  reduceMotion: boolean;
  onComplete: () => void;
}) {
  // These face-down proxies only describe the motion. CutStep owns the hidden
  // 78-card order and advances once the last card has joined the deck.
  const count = reduceMotion ? 1 : 12;
  return Array.from({ length: count }, (_, index) => {
    const side = index % 2 === 0 ? -1 : 1;
    const depth = Math.floor((count - 1 - index) / 2) * 1.1;
    const releaseAt = 0.48 + index * 0.023;
    const landAt = 0.61 + index * 0.026;
    return (
      <div key={index} aria-hidden="true"
        className="absolute left-1/2 top-[52%] -translate-x-1/2 -translate-y-1/2"
        style={{ zIndex: index }}>
        <motion.div
          data-shuffle-card={index}
          className={`relative ${WASH_CARD_SIZE} transform-gpu will-change-transform`}
          initial={{ x: 0, y: 1.2 + depth * 0.2, rotate: 0 }}
          animate={settled || reduceMotion
            ? { x: 0, y: 1.2 + depth * 0.2, rotate: 0 }
            : {
                x: [0, side * 62, side * 62, side * 18, side * 18, 0, 0],
                y: [1.2 + depth * 0.2, -14 + depth, -14 + depth, -5 + depth, -5 + depth, 1.2 + depth * 0.2, 1.2 + depth * 0.2],
                rotate: [0, side * 11, side * 11, side * 7, side * 7, side * 0.4, 0],
              }}
          transition={settled || reduceMotion
            ? { duration: reduceMotion ? 0.05 : 0.12 }
            : {
                duration: POST_CUT_SHUFFLE_SECONDS,
                times: [0, 0.18, 0.28, 0.43, releaseAt, landAt, 1],
                ease: [0.4, 0, 0.2, 1],
              }}
          onAnimationComplete={() => {
            if (!settled && index === count - 1) onComplete();
          }}>
          <RitualBackCard cardBackId={cardBackId} className="h-full w-full" />
        </motion.div>
      </div>
    );
  });
}

function CutStep({
  design,
  deck,
  onDone,
}: {
  design: RoomDesign;
  deck: RitualCard[];
  onDone: (deck: RitualCard[]) => void;
}) {
  const { t } = useLanguage();
  const reduceMotion = useTarotReducedMotion();
  const [{ pileOrder, finalDeck }] = useState(() => {
    const nextPiles = createThreePiles(deck);
    const nextOrder = createAutomaticPileOrder();
    const cutDeck = stackThreePiles(nextPiles, nextOrder);
    return {
      pileOrder: nextOrder,
      finalDeck: shuffleHiddenDeck(cutDeck),
    };
  });
  const [phase, setPhase] = useState<
    "splitting" | "stacking" | "squared" | "shuffling" | "settled"
  >("splitting");
  const onDoneRef = useRef(onDone);
  const completedRef = useRef(false);
  const phaseRef = useRef(phase);
  const pilePositions: Record<TarotPileId, { x: number; y: number; rotate: number }> = {
    A: { x: -90, y: 14, rotate: -4 },
    B: { x: 0, y: -18, rotate: 1 },
    C: { x: 90, y: 14, rotate: 4 },
  };

  useEffect(() => {
    onDoneRef.current = onDone;
  }, [onDone]);

  useEffect(() => {
    phaseRef.current = phase;
  }, [phase]);

  function moveToPhase(
    expected: typeof phase,
    next: typeof phase,
    haptic: number | number[],
  ) {
    if (phaseRef.current !== expected) return;
    phaseRef.current = next;
    setPhase(next);
    hapticPulse(haptic);
  }

  function finishCut() {
    if (completedRef.current) return;
    completedRef.current = true;
    onDoneRef.current(finalDeck);
  }

  useEffect(() => {
    hapticPulse([8, 28, 9]);
    const watchdog = window.setTimeout(finishCut, reduceMotion ? 900 : 7_000);
    return () => window.clearTimeout(watchdog);
  }, [finalDeck, reduceMotion]);

  useEffect(() => {
    const phaseRecoveryMs = reduceMotion
      ? 70
      : {
          splitting: 900,
          stacking: 820,
          squared: 620,
          shuffling: POST_CUT_SHUFFLE_SECONDS * 1000 + 240,
          settled: 760,
        }[phase];
    const recovery = window.setTimeout(() => {
      if (phase === "splitting") {
        moveToPhase("splitting", "stacking", [5, 20, 5]);
      } else if (phase === "stacking") {
        moveToPhase("stacking", "squared", [6, 20, 5, 34, 8]);
      } else if (phase === "squared") {
        moveToPhase("squared", "shuffling", [5, 18, 4, 18, 5]);
      } else if (phase === "shuffling") {
        moveToPhase("shuffling", "settled", [7, 26, 9]);
      } else {
        finishCut();
      }
    }, phaseRecoveryMs);
    return () => window.clearTimeout(recovery);
  }, [phase, reduceMotion]);

  const instruction =
    phase === "splitting"
      ? t("tarot.flow.cut.cutting")
      : phase === "stacking"
        ? t("tarot.flow.cut.stack")
        : phase === "squared"
          ? t("tarot.flow.cut.squared")
          : phase === "shuffling"
            ? t("tarot.flow.cut.shuffle")
            : t("tarot.flow.cut.ready");
  const heading =
    phase === "shuffling"
      ? t("tarot.flow.cut.shuffleTitle")
      : phase === "settled"
        ? t("tarot.flow.cut.readyTitle")
        : t("tarot.flow.cut.title");
  return (
    <CardWashRitual
      stage="cutting"
      ritualCards={[]}
      deckCount={deck.length}
      theme={getWashTheme(design)}
      heading={heading}
      helper={instruction}
      onBeginWash={() => {}}
      onWash={() => {}}
      onWashRelease={() => {}}
    >
      <div data-testid="tarot-cut-table" data-cut-phase={phase} className="pointer-events-none absolute inset-0"
        aria-label={phase === "shuffling" ? t("tarot.flow.cut.shuffleAria") : undefined}>
        {phase === "shuffling" || phase === "settled" ? (
          <RitualDeckInterleave
            cardBackId={design.cardBackId}
            settled={phase === "settled"}
            reduceMotion={reduceMotion}
            onComplete={() => moveToPhase("shuffling", "settled", [7, 26, 9])}
          />
        ) : (["A", "B", "C"] as const).map((pileId, pileIndex) => {
          const selectedIndex = pileOrder.indexOf(pileId);
          const target = pilePositions[pileId];
          const pose = phase === "splitting"
            ? { x: target.x, y: target.y, rotate: target.rotate }
            : { x: 0, y: phase === "stacking" ? selectedIndex * 2 : selectedIndex * 0.6, rotate: 0 };
          const duration = reduceMotion ? 0.05 : phase === "splitting" ? 0.6
            : phase === "stacking" ? 0.54 : 0.4;
          return (
            <div key={pileId} aria-hidden="true"
              className="absolute left-1/2 top-[52%] -translate-x-1/2 -translate-y-1/2"
              style={{ zIndex: phase === "splitting" ? pileIndex : selectedIndex }}>
              <motion.div
                data-cut-packet={pileId}
                className={`relative ${WASH_CARD_SIZE} transform-gpu will-change-transform`}
                initial={{ x: 0, y: 0, rotate: 0 }}
                animate={pose}
                transition={{ duration, ease: [0.22, 0.72, 0.18, 1],
                  delay: reduceMotion ? 0 : phase === "splitting" ? pileIndex * 0.07 : phase === "stacking" ? selectedIndex * 0.07 : 0 }}
                onAnimationComplete={() => {
                  if (phase === "splitting" && pileIndex === 2) moveToPhase("splitting", "stacking", [5, 20, 5]);
                  if (selectedIndex !== 2) return;
                  if (phase === "stacking") moveToPhase("stacking", "squared", [6, 20, 5]);
                  else if (phase === "squared") moveToPhase("squared", "shuffling", [5, 18, 5]);
                }}>
                {Array.from({ length: 5 }, (_, edge) => (
                  <span key={edge} className="absolute inset-0 rounded-[10px] border border-[#d7bd7c]/55 bg-[#182139]"
                    style={{ transform: `translate3d(${(4 - edge) * 0.24}px, ${(4 - edge) * 0.38}px, 0)` }} />
                ))}
                <RitualBackCard cardBackId={design.cardBackId} className="h-full w-full" />
              </motion.div>
            </div>
          );
        })}
      </div>
    </CardWashRitual>
  );
}

function isPointInsidePickWheelCard(
  layout: PickWheelLayout,
  width: number,
  height: number,
  radialOffset: number,
  clientX: number,
  clientY: number,
  padding = 14,
) {
  const originX = layout.x + Math.cos(layout.angle) * radialOffset;
  const originY = layout.y + Math.sin(layout.angle) * radialOffset;
  const dx = clientX - originX;
  const dy = clientY - originY;
  const cos = Math.cos(layout.rotate);
  const sin = Math.sin(layout.rotate);
  const localX = dx * cos + dy * sin;
  const localY = -dx * sin + dy * cos;

  return (
    localX >= -width / 2 - padding &&
    localX <= width / 2 + padding &&
    localY >= -height - padding &&
    localY <= padding
  );
}

function PickStep({
  spread,
  deck,
  design,
  selectedCards,
  setSelectedCards,
  onDone,
}: {
  spread: SpreadChoice;
  deck: RitualCard[];
  design: RoomDesign;
  selectedCards: RitualCard[];
  setSelectedCards: (cards: RitualCard[]) => void;
  onDone: () => void;
}) {
  const { t } = useLanguage();
  const [fanRotation, setFanRotation] = useState(0);
  const [zoomed, setZoomed] = useState(false);
  const [stageSize, setStageSize] = useState<PickWheelStageSize>(() =>
    getTarotPhoneStageSize(),
  );
  const pickStageRef = useRef<HTMLDivElement | null>(null);
  const pickTrayRef = useRef<HTMLDivElement | null>(null);
  const [trayBottom, setTrayBottom] = useState(0);
  const [placingId, setPlacingId] = useState<string | null>(null);
  const [armedCardId, setArmedCardId] = useState<string | null>(null);
  const armedCardIdRef = useRef<string | null>(null);
  const wheelDragRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    startRotation: number;
    startVisualId: string | null;
    moved: boolean;
  } | null>(null);
  const wheelRotationFrameRef = useRef<number | null>(null);
  const pendingWheelRotationRef = useRef<number | null>(null);
  const activeWheelPointersRef = useRef<Map<number, { x: number; y: number }>>(
    new Map(),
  );
  const pinchStartDistanceRef = useRef<number | null>(null);
  const pinchStartZoomedRef = useRef(false);
  const suppressNextClickRef = useRef(false);
  const selectedCardsRef = useRef(selectedCards);
  const lastWheelHapticNumberRef = useRef<number | null>(null);
  const lastWheelHapticAtRef = useRef(0);
  const lastWheelScrollHapticAtRef = useRef(0);
  const selectedIds = new Set(selectedCards.map((card) => card.visualId));
  const remainingDeck = deck.filter((card) => !selectedIds.has(card.visualId));
  const displaySpread = localizeSpreadChoice(spread, t);
  const done = selectedCards.length >= spread.cardCount;
  const wheelGeometry = getPickWheelGeometry(stageSize, zoomed, zoomed ? 0 : trayBottom + 24);
  const wheelCardWidth = zoomed ? PICK_WHEEL_CARD_W_ZOOM : PICK_WHEEL_CARD_W;
  const wheelCardHeight = zoomed ? PICK_WHEEL_CARD_H_ZOOM : PICK_WHEEL_CARD_H;
  const armedLift = zoomed ? 12 : 14;
  const armedScale = zoomed ? 1.035 : 1.055;
  const cardBackImageUrl = getTarotCardBackImage(design.cardBackId);
  const pickTarget = {
    x: stageSize.width * 0.52,
    y: stageSize.height * 0.73,
  };
  const wheelStep = pickWheelStep(remainingDeck.length);
  const targetAngle = Math.atan2(
    pickTarget.y - wheelGeometry.centerY,
    pickTarget.x - wheelGeometry.centerX,
  );
  const virtualCenterIndex = Math.round(
    (targetAngle - wheelGeometry.startAngle - fanRotation) / wheelStep,
  );
  const candidateWheelCards = remainingDeck.map((card, index) => {
    const virtualIndex =
      index +
      Math.round((virtualCenterIndex - index) / remainingDeck.length) *
        remainingDeck.length;
    return {
      card,
      index,
      virtualIndex,
      displayNumber: wheelDisplayNumber(virtualIndex, remainingDeck.length),
      layout: getPickWheelLayout(
        virtualIndex,
        fanRotation,
        remainingDeck.length,
        wheelGeometry,
      ),
    };
  });
  let activeWheelCard: (typeof candidateWheelCards)[number] | null = null;
  let activeDistance = Number.POSITIVE_INFINITY;

  for (const item of candidateWheelCards) {
    const { card, layout } = item;
    if (!card || selectedIds.has(card.visualId)) continue;
    const distance = Math.hypot(
      layout.x - pickTarget.x,
      layout.y - pickTarget.y,
    );
    if (distance < activeDistance) {
      activeDistance = distance;
      activeWheelCard = item;
    }
  }

  const fallbackVirtualIndex =
    activeWheelCard?.virtualIndex ?? virtualCenterIndex;
  const activeIndex = positiveModulo(fallbackVirtualIndex, remainingDeck.length);
  const activeCard = activeWheelCard?.card ?? remainingDeck[activeIndex];
  const activeNumber = wheelDisplayNumber(
    fallbackVirtualIndex,
    remainingDeck.length,
  );

  function armCard(visualId: string | null) {
    armedCardIdRef.current = visualId;
    setArmedCardId(visualId);
  }

  useEffect(() => {
    selectedCardsRef.current = selectedCards;
  }, [selectedCards]);

  useEffect(() => {
    if (lastWheelHapticNumberRef.current === null) {
      lastWheelHapticNumberRef.current = activeNumber;
      return;
    }
    if (lastWheelHapticNumberRef.current === activeNumber) return;
    lastWheelHapticNumberRef.current = activeNumber;

    const now = Date.now();
    if (now - lastWheelHapticAtRef.current < 72) return;
    lastWheelHapticAtRef.current = now;
    hapticTick(3);
  }, [activeNumber]);

  useEffect(() => {
    if (!placingId) return undefined;
    const timer = window.setTimeout(() => setPlacingId(null), 560);
    return () => window.clearTimeout(timer);
  }, [placingId]);

  useEffect(() => {
    if (!armedCardId) return;
    if (selectedCards.some((card) => card.visualId === armedCardId)) {
      armCard(null);
    }
  }, [armedCardId, selectedCards]);

  useEffect(() => {
    const updateSize = () => {
      const rect = pickStageRef.current?.getBoundingClientRect();
      const trayRect = pickTrayRef.current?.getBoundingClientRect();
      if (rect && trayRect) setTrayBottom(trayRect.bottom - rect.top);
      if (rect && rect.width > 0 && rect.height > 0) {
        setStageSize({
          width: Math.min(rect.width, TAROT_PHONE_FRAME_MAX_WIDTH),
          height: rect.height,
        });
        return;
      }
      setStageSize(getTarotPhoneStageSize());
    };
    updateSize();
    window.addEventListener("resize", updateSize);
    const resizeObserver =
      typeof ResizeObserver !== "undefined" && pickStageRef.current
        ? new ResizeObserver(updateSize)
        : null;
    if (resizeObserver && pickStageRef.current) {
      resizeObserver.observe(pickStageRef.current);
      if (pickTrayRef.current) resizeObserver.observe(pickTrayRef.current);
    }
    return () => {
      window.removeEventListener("resize", updateSize);
      resizeObserver?.disconnect();
    };
  }, []);

  useEffect(() => {
    return () => {
      if (wheelRotationFrameRef.current !== null) {
        window.cancelAnimationFrame(wheelRotationFrameRef.current);
      }
      activeWheelPointersRef.current.clear();
    };
  }, []);

  function scheduleFanRotation(nextRotation: number) {
    pendingWheelRotationRef.current = nextRotation;
    if (wheelRotationFrameRef.current !== null) return;
    wheelRotationFrameRef.current = window.requestAnimationFrame(() => {
      wheelRotationFrameRef.current = null;
      const pendingRotation = pendingWheelRotationRef.current;
      pendingWheelRotationRef.current = null;
      if (pendingRotation !== null) setFanRotation(pendingRotation);
    });
  }

  function flushScheduledFanRotation() {
    if (pendingWheelRotationRef.current === null) return;
    if (wheelRotationFrameRef.current !== null) {
      window.cancelAnimationFrame(wheelRotationFrameRef.current);
      wheelRotationFrameRef.current = null;
    }
    const pendingRotation = pendingWheelRotationRef.current;
    pendingWheelRotationRef.current = null;
    setFanRotation(pendingRotation);
  }

  function getPointerDistance() {
    const points = Array.from(activeWheelPointersRef.current.values());
    if (points.length < 2) return 0;
    const [first, second] = points;
    return Math.hypot(second.x - first.x, second.y - first.y);
  }

  function choose(card = activeCard, force = false) {
    if (!force && suppressNextClickRef.current) {
      suppressNextClickRef.current = false;
      return;
    }
    const currentSelectedCards = selectedCardsRef.current;
    if (currentSelectedCards.length >= spread.cardCount) return;
    if (!card) return;
    if (currentSelectedCards.some((item) => item.visualId === card.visualId)) {
      hapticTick(4);
      return;
    }
    if (armedCardIdRef.current !== card.visualId) {
      hapticPulse([4, 20, 5]);
      armCard(card.visualId);
      return;
    }
    hapticPulse([8, 24, 10]);
    setPlacingId(card.visualId);
    armCard(null);
    const nextSelectedCards = selectCardByVisualId(
      deck,
      currentSelectedCards,
      card.visualId,
      spread.cardCount,
    );
    if (nextSelectedCards.length === currentSelectedCards.length) return;
    selectedCardsRef.current = nextSelectedCards;
    setSelectedCards(nextSelectedCards);
  }

  function findTopCardAtPoint(localX: number, localY: number) {
    let topCard: { card: RitualCard; zIndex: number } | null = null;
    for (const item of candidateWheelCards) {
      const { card, layout } = item;
      if (!card || selectedIds.has(card.visualId)) continue;
      const radialOffset = armedCardId === card.visualId ? armedLift : 0;
      if (
        !isPointInsidePickWheelCard(
          layout,
          wheelCardWidth,
          wheelCardHeight,
          radialOffset,
          localX,
          localY,
          zoomed ? 20 : 16,
        )
      ) {
        continue;
      }
      if (!topCard || layout.zIndex > topCard.zIndex) {
        topCard = { card, zIndex: layout.zIndex };
      }
    }
    return topCard?.card ?? null;
  }

  function findNearestCard(localX: number, localY: number) {
    const threshold = zoomed ? 132 : 104;
    let nearest: { card: RitualCard; distance: number } | null = null;
    for (const item of candidateWheelCards) {
      const { card, layout } = item;
      if (!card || selectedIds.has(card.visualId)) continue;
      const offset = armedCardId === card.visualId ? armedLift : 0;
      const originX = layout.x + Math.cos(layout.angle) * offset;
      const originY = layout.y + Math.sin(layout.angle) * offset;
      const distance = Math.hypot(localX - originX, localY - originY);
      if (distance > threshold) continue;
      if (!nearest || distance < nearest.distance) nearest = { card, distance };
    }
    return nearest?.card ?? null;
  }

  function handleWheelPointerDown(event: PointerEvent<HTMLDivElement>) {
    if (done) return;
    event.preventDefault();
    const targetElement =
      event.target instanceof HTMLElement ? event.target : null;
    const targetButton = targetElement?.closest<HTMLButtonElement>(
      "button[data-visual-id]",
    );
    activeWheelPointersRef.current.set(event.pointerId, {
      x: event.clientX,
      y: event.clientY,
    });
    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
      // Some embedded WebViews expose Pointer Events without pointer capture.
    }

    if (activeWheelPointersRef.current.size >= 2) {
      pinchStartDistanceRef.current = getPointerDistance();
      pinchStartZoomedRef.current = zoomed;
      wheelDragRef.current = null;
      if (armedCardIdRef.current) armCard(null);
      hapticTick(3);
      return;
    }

    hapticTick(3);
    wheelDragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      startRotation: fanRotation,
      startVisualId: targetButton?.dataset.visualId ?? null,
      moved: false,
    };
  }

  function handleWheelPointerMove(event: PointerEvent<HTMLDivElement>) {
    if (activeWheelPointersRef.current.has(event.pointerId)) {
      activeWheelPointersRef.current.set(event.pointerId, {
        x: event.clientX,
        y: event.clientY,
      });
    }

    if (activeWheelPointersRef.current.size >= 2) {
      const startDistance = pinchStartDistanceRef.current || getPointerDistance();
      pinchStartDistanceRef.current = startDistance;
      const currentDistance = getPointerDistance();
      const ratio = startDistance > 0 ? currentDistance / startDistance : 1;
      if (ratio > 1.08 && !pinchStartZoomedRef.current) {
        hapticPulse([4, 18, 5]);
        armCard(null);
        setZoomed(true);
      }
      if (ratio < 0.92 && pinchStartZoomedRef.current) {
        hapticPulse([4, 18, 5]);
        armCard(null);
        setZoomed(false);
      }
      return;
    }

    const drag = wheelDragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    const deltaX = event.clientX - drag.startX;
    const deltaY = event.clientY - drag.startY;
    if (Math.hypot(deltaX, deltaY) > 10) {
      drag.moved = true;
      if (armedCardIdRef.current) armCard(null);
    }
    if (drag.moved) {
      scheduleFanRotation(
        drag.startRotation +
          (deltaX - deltaY * 0.7) * PICK_WHEEL_DRAG_SENSITIVITY,
      );
    }
  }

  function handleWheelPointerUp(event: PointerEvent<HTMLDivElement>) {
    const wasPinching =
      activeWheelPointersRef.current.size >= 2 ||
      pinchStartDistanceRef.current !== null;
    activeWheelPointersRef.current.delete(event.pointerId);
    if (activeWheelPointersRef.current.size < 2) {
      pinchStartDistanceRef.current = null;
    }
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    if (wasPinching) {
      suppressNextClickRef.current = true;
      window.setTimeout(() => {
        suppressNextClickRef.current = false;
      }, 0);
      wheelDragRef.current = null;
      return;
    }

    const drag = wheelDragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    flushScheduledFanRotation();
    if (drag.moved) {
      suppressNextClickRef.current = true;
      window.setTimeout(() => {
        suppressNextClickRef.current = false;
      }, 0);
    } else {
      const rect = event.currentTarget.getBoundingClientRect();
      const localX = event.clientX - rect.left;
      const localY = event.clientY - rect.top;
      const targetElement =
        event.target instanceof HTMLElement ? event.target : null;
      const targetButton = targetElement?.closest<HTMLButtonElement>(
        "button[data-visual-id]",
      );
      const targetVisualId =
        drag.startVisualId ?? targetButton?.dataset.visualId ?? null;
      const directCard = targetVisualId
        ? deck.find((card) => card.visualId === targetVisualId)
        : undefined;
      const directAvailable =
        directCard && !selectedIds.has(directCard.visualId) ? directCard : undefined;
      const armedItem = armedCardId
        ? candidateWheelCards.find((item) => item.card.visualId === armedCardId)
        : undefined;
      const armedCard =
        armedItem &&
        !selectedIds.has(armedItem.card.visualId) &&
        isPointInsidePickWheelCard(
          armedItem.layout,
          wheelCardWidth,
          wheelCardHeight,
          armedLift,
          localX,
          localY,
          zoomed ? 24 : 18,
        )
          ? armedItem.card
          : undefined;
      const card =
        armedCard ??
        directAvailable ??
        findTopCardAtPoint(localX, localY) ??
        findNearestCard(localX, localY);
      if (card) {
        suppressNextClickRef.current = true;
        window.setTimeout(() => {
          suppressNextClickRef.current = false;
        }, 0);
        choose(card, true);
      }
    }
    wheelDragRef.current = null;
  }

  function handleWheelPointerCancel(event: PointerEvent<HTMLDivElement>) {
    activeWheelPointersRef.current.delete(event.pointerId);
    if (activeWheelPointersRef.current.size < 2) {
      pinchStartDistanceRef.current = null;
    }
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    wheelDragRef.current = null;
    suppressNextClickRef.current = true;
    window.setTimeout(() => {
      suppressNextClickRef.current = false;
    }, 0);
  }

  function handleWheelScroll(deltaY: number) {
    if (armedCardIdRef.current) armCard(null);
    const now = Date.now();
    if (now - lastWheelScrollHapticAtRef.current > 58) {
      lastWheelScrollHapticAtRef.current = now;
      hapticTick(3);
    }
    setFanRotation((current) => current - deltaY * 0.0012);
  }

  function toggleFanZoom() {
    hapticPulse([4, 18, 5]);
    armCard(null);
    setZoomed((current) => !current);
  }

  function handleWheelGesture(event: WheelEvent<HTMLDivElement>) {
    if (event.cancelable) event.preventDefault();
    if (event.ctrlKey || event.metaKey) {
      hapticPulse([4, 18, 5]);
      armCard(null);
      setZoomed(event.deltaY < 0);
      return;
    }
    handleWheelScroll(event.deltaY);
  }

  const visibleWheelCards = candidateWheelCards
    .filter(({ card, layout }) => {
      if (selectedIds.has(card.visualId)) return false;
      const topLimit = stageSize.height * (zoomed ? 0.30 : 0.36);
      return (
        layout.x > -310 &&
        layout.x < stageSize.width + 310 &&
        layout.y > topLimit &&
        layout.y < stageSize.height + 320
      );
    });
  const spreadPreviewPoints = spread.layout.slice(0, spread.cardCount);

  return (
    <StepShell>
      <div
        ref={pickStageRef}
        data-testid="tarot-pick-stage"
        className="relative -mx-5 -mb-[calc(var(--hint-safe-bottom)+1.25rem)] flex min-h-0 flex-1 flex-col overflow-clip px-5"
      >
        <div
          className={`pointer-events-none relative z-50 text-center transition duration-300 ${
            zoomed ? "-translate-y-4 opacity-0" : "translate-y-0 opacity-100"
          }`}
        >
          <h1 className="font-serif text-[32px] leading-none text-[color:var(--tarot-page-ink,#332d45)]">
            {t("tarot.flow.pick.title")}
          </h1>
          <p className="mt-2 text-[13px] font-bold text-[color:var(--tarot-page-muted,#746276)]">
            {formatCopy(t("tarot.flow.pick.chosen"), {
              spread: displaySpread.label,
              chosen: selectedCards.length,
              total: spread.cardCount,
            })}
          </p>
        </div>
        <div
          ref={pickTrayRef}
          data-testid="tarot-pick-tray"
          style={{ height: spread.cardCount >= 7 ? 224 : Math.min(224, Math.max(176, stageSize.height * 0.27)) }}
          className={`pointer-events-none relative z-[30] mt-4 shrink-0 rounded-[24px] border border-white/50 bg-[linear-gradient(150deg,rgba(255,252,249,0.68),rgba(255,252,249,0.18))] transition duration-200 ${
            zoomed ? "scale-[0.98] opacity-0" : "scale-100 opacity-100"
          }`}
        >
          {spreadPreviewPoints.map((point, index) => (
            <motion.div
              key={index}
              className={`absolute -translate-x-1/2 -translate-y-1/2 rounded-[8px] ${spread.cardCount >= 7 ? "h-[48px] w-[30px]" : "h-[64px] w-[40px]"}`}
              style={{ left: `${point.x}%`, top: `${point.y}%` }}
              initial={false}
              animate={
                selectedCards[index]
                  ? { x: 0, y: 0, scale: 1, opacity: 1, rotate: 0 }
                  : { x: 0, y: 0, scale: 0.92, opacity: 0.78, rotate: 0 }
              }
              transition={{ type: "spring", stiffness: 160, damping: 21 }}
            >
              {selectedCards[index] ? (
                <motion.div
                  layoutId={`pick-card-${selectedCards[index]!.visualId}`}
                  animate={{ x: 0, y: 0, scale: 1, rotate: 0, opacity: 1 }}
                  transition={{
                    type: "spring",
                    stiffness: 115,
                    damping: 17,
                    mass: 0.95,
                  }}
                  className="relative h-full w-full"
                >
                  {placingId === selectedCards[index]?.visualId ? (
                    <motion.span
                      aria-hidden
                      className="absolute -inset-5 rounded-[18px] border border-[#f1d390]/62"
                      initial={{ opacity: 0.9, scale: 0.72 }}
                      animate={{ opacity: 0, scale: 1.36 }}
                      transition={{ duration: 0.82, ease: "easeOut" }}
                    />
                  ) : null}
                  <TarotBack
                    cardBackId={design.cardBackId}
                    className="h-full w-full rounded-[10px] shadow-[0_14px_30px_rgba(108,79,116,0.12)]"
                  />
                </motion.div>
              ) : (
                <div className="h-full w-full rounded-[10px] border border-dashed border-[#876b84]/82 bg-white/76 shadow-[0_10px_24px_rgba(108,79,116,0.10)]">
                  <span className="grid h-full place-items-center text-[12px] font-black text-[#674f65]">
                    {index + 1}
                  </span>
                </div>
              )}
              <span className="absolute left-1/2 top-[calc(100%+0.35rem)] max-w-[5.5rem] -translate-x-1/2 truncate text-[8px] font-black uppercase tracking-[0.12em] text-[#654f63]">
                {displaySpread.positionLabels[index] ??
                  formatCopy(t("tarot.flow.pick.card"), { number: index + 1 })}
              </span>
            </motion.div>
          ))}
        </div>
        <div
          className="absolute inset-0 z-40 cursor-grab touch-none select-none overflow-clip active:cursor-grabbing"
          data-deck-size={remainingDeck.length}
          onPointerDown={handleWheelPointerDown}
          onPointerMove={handleWheelPointerMove}
          onPointerUp={handleWheelPointerUp}
          onPointerCancel={handleWheelPointerCancel}
          onWheel={handleWheelGesture}
          aria-label={t("tarot.flow.pick.wheelAria")}
        >
          <div
            className="pointer-events-none absolute rounded-full bg-[radial-gradient(circle,rgba(235,220,227,0.10),rgba(255,251,246,0.18)_70%,transparent)]"
            style={{
              left: wheelGeometry.centerX - wheelGeometry.radius,
              top: wheelGeometry.centerY - wheelGeometry.radius,
              width: wheelGeometry.radius * 2,
              height: wheelGeometry.radius * 2,
            }}
          />
          {visibleWheelCards.map(
            ({ card, virtualIndex, displayNumber, layout }) => {
              const selectedInWheel = selectedIds.has(card.visualId);
              const isArmed = armedCardId === card.visualId;
              const emphasized = isArmed;
              const cardWidth = wheelCardWidth;
              const cardHeight = wheelCardHeight;
              const cardOpacity = selectedInWheel ? 0.68 : 1;
              const armedOffset = isArmed ? armedLift : 0;
              const cardX = layout.x + Math.cos(layout.angle) * armedOffset;
              const cardY = layout.y + Math.sin(layout.angle) * armedOffset;
              return (
                <motion.button
                  key={card.visualId}
                  layoutId={
                    selectedInWheel ? undefined : `pick-card-${card.visualId}`
                  }
                  type="button"
                  data-visual-id={card.visualId}
                  aria-disabled={selectedInWheel}
                  onClick={(event) => {
                    event.preventDefault();
                  }}
                  onKeyDown={(event) => {
                    if (event.key !== "Enter" && event.key !== " ") return;
                    event.preventDefault();
                    choose(card, true);
                  }}
                  aria-pressed={isArmed}
                  aria-label={
                    isArmed
                      ? formatCopy(t("tarot.flow.pick.confirmCard"), {
                          number: displayNumber,
                        })
                      : formatCopy(t("tarot.flow.pick.liftCard"), {
                          number: displayNumber,
                        })
                  }
                  className="absolute block transform-gpu overflow-visible rounded-[16px] border outline-none transition-[box-shadow,filter,opacity] duration-150 will-change-transform [backface-visibility:hidden] [contain:layout_style]"
                  style={{
                    left: cardX,
                    top: cardY,
                    width: cardWidth,
                    height: cardHeight,
                    zIndex: layout.zIndex,
                    opacity: cardOpacity,
                    backgroundColor: "#251d35",
                    backgroundImage: `url("${cardBackImageUrl}")`,
                    backgroundPosition: "center",
                    backgroundSize: "100% 100%",
                    borderColor: emphasized
                      ? "rgba(241,211,144,0.86)"
                      : "rgba(241,211,144,0.42)",
                    boxShadow: emphasized
                      ? "0 24px 52px rgba(78,56,92,0.28), 0 0 0 2px rgba(255,244,216,0.72), 0 0 42px rgba(241,211,144,0.34)"
                      : "0 9px 18px rgba(78,56,92,0.13)",
                    filter: emphasized ? "brightness(1.04)" : undefined,
                    transformOrigin: "50% 100%",
                  }}
                  animate={{
                    x: "-50%",
                    y: "-100%",
                    rotate: `${layout.rotate}rad`,
                    scale: isArmed ? armedScale : 1,
                  }}
                  transition={{
                    type: "spring",
                    stiffness: 430,
                    damping: 38,
                    mass: 0.62,
                  }}
                >
                  <span
                    aria-hidden
                    className={`pointer-events-none absolute left-1/2 z-30 font-serif font-black leading-none ${
                      zoomed ? "top-[-1.85rem] text-[16px]" : "top-[-1.45rem] text-[14px]"
                    } ${emphasized ? "text-[#6a461d]" : "text-[#4a3422]"}`}
                    style={{
                      opacity: emphasized ? 0.78 : 0.64,
                      transform: `translateX(-50%) rotate(${-layout.rotate}rad)`,
                      textShadow: emphasized
                        ? "0 1px 0 rgba(255,250,230,0.82), 0 6px 14px rgba(108,70,29,0.16)"
                        : "0 1px 0 rgba(255,250,230,0.72), 0 5px 12px rgba(80,52,34,0.12)",
                    }}
                  >
                    {displayNumber}
                  </span>
                  <span className="pointer-events-none absolute inset-0 overflow-hidden rounded-[16px]">
                    <span className="absolute inset-[8px] rounded-[11px] border border-white/18" />
                    <span className="absolute inset-0 bg-[radial-gradient(circle_at_28%_18%,rgba(255,255,255,0.05),transparent_28%),linear-gradient(140deg,rgba(255,255,255,0.04),transparent_42%)]" />
                    {emphasized ? (
                      <span className="absolute inset-0 rounded-[16px] bg-[radial-gradient(circle_at_50%_12%,rgba(255,246,215,0.20),transparent_35%)]" />
                    ) : null}
                  </span>
                </motion.button>
              );
            },
          )}
        </div>
        <div className="absolute bottom-[5.25rem] left-5 z-50 flex items-center gap-2">
          <button
            type="button"
            aria-label={
              zoomed
                ? t("tarot.flow.pick.closeAria")
                : t("tarot.flow.pick.expandAria")
            }
            className="h-11 rounded-full border border-white/75 bg-white/84 px-5 text-[11px] font-black uppercase tracking-[0.14em] text-[#654f6d] shadow-[0_14px_32px_rgba(78,56,92,0.14)] backdrop-blur-xl transition active:scale-95"
            onPointerDown={(event) => event.stopPropagation()}
            onPointerUp={(event) => event.stopPropagation()}
            onClick={toggleFanZoom}
            onKeyDown={(event) => {
              if (event.key !== "Enter" && event.key !== " ") return;
              event.preventDefault();
              toggleFanZoom();
            }}
          >
            {zoomed
              ? t("tarot.flow.pick.close")
              : t("tarot.flow.pick.expand")}
          </button>
        </div>
        <div className="pointer-events-none absolute inset-x-5 bottom-4 z-50">
          {done ? (
            <PrimaryButton
              onClick={onDone}
              className="pointer-events-auto w-full"
            >
              {t("tarot.flow.pick.reveal")}
            </PrimaryButton>
          ) : null}
        </div>
      </div>
    </StepShell>
  );
}

function TarotPhoneFrame({ children }: { children: ReactNode }) {
  return (
    <div
      data-testid="tarot-phone-frame-shell"
      className="absolute inset-0 flex justify-center overflow-hidden"
    >
      <div
        data-testid="tarot-phone-frame"
        className="relative h-full min-h-0 w-full max-w-[var(--hint-app-width)] transform-gpu overflow-hidden shadow-[0_0_0_1px_rgba(255,255,255,0.55),0_24px_80px_rgba(82,62,91,0.12)]"
      >
        {children}
      </div>
    </div>
  );
}

export function TarotRoomFlow() {
  const [, navigate] = useLocation();
  const { language, t } = useLanguage();
  const reduceMotion = useTarotReducedMotion();
  const setupRequested = isRoomSetupRequested();
  const [archivedRequest] = useState(getArchivedReadingRequest);
  const [freshVisit] = useState(() => roomVisitWasClosed("tarot"));
  const visitOpen = useRef(true);
  const [restoredSession] = useState(() =>
    setupRequested || archivedRequest || freshVisit ? null : loadActiveTarotSession(),
  );
  const [archivedReading, setArchivedReading] = useState(() => {
    if (archivedRequest) {
      return getLocalTarotReading(archivedRequest.readingId);
    }
    if (restoredSession?.phase === "reading" && restoredSession.readingId) {
      return getLocalTarotReading(restoredSession.readingId);
    }
    return null;
  });
  const [{ step, settingsMode, settingsReturnStep }, dispatchFlow] = useReducer(
    tarotFlowReducer,
    createTarotFlowState(
      setupRequested
        ? "design"
        : archivedReading
          ? "reading"
          : restoredSession?.phase ?? "question",
      setupRequested,
    ),
  );
  function setStep(nextStep: TarotFlowStep) {
    dispatchFlow({ type: "NAVIGATE", step: nextStep });
  }
  const [question, setQuestion] = useState(
    archivedReading?.question ?? restoredSession?.question ?? "",
  );
  const [voiceOpen, setVoiceOpen] = useState(false);
  const [spread, setSpread] = useState<SpreadChoice>(
    () => {
      const savedSpreadType = archivedReading?.spreadType ??
        restoredSession?.spreadId ?? loadSavedTarotRoomSetup()?.spreadType;
      return (
        SPREAD_CHOICES.find((item) => item.id === savedSpreadType) ??
        SPREAD_CHOICES.find((item) => item.id === "three") ??
        SPREAD_CHOICES[0]!
      );
    },
  );
  const [spreadRecommendation, setSpreadRecommendation] =
    useState<SpreadRecommendation | null>(() =>
      archivedReading
        ? {
            spreadType: archivedReading.spreadType as SpreadChoice["id"],
            reason: "",
            focusLabel: archivedReading.focusLabel ?? archivedReading.spreadLabel,
            confidence: "high",
            source: "local",
          }
        : restoredSession
        ? {
            spreadType: restoredSession.spreadId as SpreadChoice["id"],
            reason: "",
            focusLabel: restoredSession.focusLabel,
            confidence: "high",
            source: "local",
          }
        : null,
    );
  const [spreadRecommendationPending, setSpreadRecommendationPending] =
    useState(false);
  const [design, setDesign] = useState<RoomDesign>(() =>
    archivedReading
      ? roomDesignFromReading(archivedReading)
      : restoredSession
      ? (restoredSession.design as RoomDesign)
      : loadInitialRoomDesign(),
  );
  const [selectedCards, setSelectedCards] = useState<RitualCard[]>(
    archivedReading
      ? ritualCardsFromReading(archivedReading)
      : restoredSession?.selectedCards ?? [],
  );
  const [revealedIds, setRevealedIds] = useState<string[]>(
    archivedReading
      ? ritualCardsFromReading(archivedReading).map((card) => card.visualId)
      : restoredSession?.revealedIds ?? [],
  );
  const [deck, setDeck] = useState<RitualCard[]>(() =>
    restoredSession?.deck?.length ? restoredSession.deck : createHiddenDeck(),
  );
  const [ritualRecoveryVersion, setRitualRecoveryVersion] = useState(0);
  const spreadRecommendationControllerRef = useRef<AbortController | null>(null);
  const stepRef = useRef(step);
  const backgroundedRitualRef = useRef(false);
  const readingArchiveRef = useRef(
    archivedReading
      ? {
          id: archivedReading.id,
          createdAt: archivedReading.createdAt,
        }
      : restoredSession?.readingId && restoredSession.readingCreatedAt
      ? {
          id: restoredSession.readingId,
          createdAt: restoredSession.readingCreatedAt,
        }
      : null,
  );
  stepRef.current = step;

  useRoomVisit({
    room: "tarot",
    hasProgress: Boolean(question.trim()) || selectedCards.length > 0 || (!settingsMode && step !== "question"),
    onLeave: () => {
      // Close this mounted visit before navigation, so a late recommendation,
      // autosave or archive callback cannot reopen it. Other tabs keep their work.
      visitOpen.current = false;
      spreadRecommendationControllerRef.current?.abort();
      spreadRecommendationControllerRef.current = null;
    },
  });

  useEffect(() => {
    return () => {
      spreadRecommendationControllerRef.current?.abort();
      spreadRecommendationControllerRef.current = null;
    };
  }, []);

  useEffect(() => {
    let disposed = false;
    let removeNativeListener: (() => Promise<void>) | null = null;
    const markBackgroundedRitual = () => {
      backgroundedRitualRef.current =
        stepRef.current === "prepare" ||
        getTarotStableRecoveryStep(stepRef.current) !== stepRef.current;
    };
    const recoverInterruptedRitual = (allowHiddenDocument = false) => {
      if (!allowHiddenDocument && document.visibilityState === "hidden") return;
      const currentStep = stepRef.current;
      const interrupted =
        backgroundedRitualRef.current ||
        getTarotStableRecoveryStep(currentStep) !== currentStep;
      backgroundedRitualRef.current = false;
      if (!interrupted) return;
      stepRef.current = "prepare";
      setRitualRecoveryVersion((version) => version + 1);
      dispatchFlow({ type: "NAVIGATE", step: "prepare" });
    };
    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        markBackgroundedRitual();
      } else {
        recoverInterruptedRitual();
      }
    };
    const handlePageShow = () => recoverInterruptedRitual();

    void addNativeAppStateListener((isActive) => {
      if (isActive) recoverInterruptedRitual(true);
      else markBackgroundedRitual();
    })
      .then((remove) => {
        if (disposed) void remove();
        else removeNativeListener = remove;
      })
      .catch(() => {
        // Browser lifecycle events remain the recovery fallback.
      });

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("pagehide", markBackgroundedRitual);
    window.addEventListener("pageshow", handlePageShow);
    return () => {
      disposed = true;
      void removeNativeListener?.();
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("pagehide", markBackgroundedRitual);
      window.removeEventListener("pageshow", handlePageShow);
    };
  }, []);

  useEffect(() => {
    if (archivedRequest && !archivedReading) {
      navigate("/app/readings", { replace: true });
    }
  }, [archivedReading, archivedRequest, navigate]);

  useEffect(() => {
    if (!visitOpen.current || archivedReading || (settingsMode && !settingsReturnStep)) return;
    // A new empty entrance must not replace another tab's durable recovery copy.
    if (freshVisit && step === "question" && !question) return;
    const stablePhase = getTarotStableRecoveryStep(step);
    saveActiveTarotSession({
      phase: stablePhase,
      question,
      spreadId: spread.id,
      focusLabel: spreadRecommendation?.focusLabel ?? t("tarot.room"),
      design,
      selectedCards,
      revealedIds,
      deck: stablePhase === "pick" || stablePhase === "reveal" || stablePhase === "reading"
        ? deck
        : undefined,
      readingId: readingArchiveRef.current?.id,
      readingCreatedAt: readingArchiveRef.current?.createdAt,
    });
    if (question || step !== "question") markRoomVisitStarted("tarot");
  }, [archivedReading, deck, design, freshVisit, question, revealedIds, selectedCards, settingsMode, settingsReturnStep, spread.id, spreadRecommendation?.focusLabel, step, t]);

  async function submitQuestionValue(value: string) {
    const cleaned = cleanQuestion(value);
    if (!cleaned) return;
    clearActiveTarotSession();
    readingArchiveRef.current = null;
    hapticPulse([8, 26, 8]);
    const localRecommendation = buildLocalSpreadRecommendation(cleaned);
    if (language === "zh") {
      localRecommendation.focusLabel = localizedFocusLabel(t, cleaned);
    }
    const localSpread =
      findSpreadChoice(localRecommendation.spreadType) ??
      recommendSpread(cleaned);
    setQuestion(cleaned);
    setSpread(localSpread);
    setSpreadRecommendation(localRecommendation);
    setSpreadRecommendationPending(true);
    setSelectedCards([]);
    setRevealedIds([]);
    setDeck(createHiddenDeck());
    setStep("spreadRecommendation");

    spreadRecommendationControllerRef.current?.abort();
    const controller = new AbortController();
    spreadRecommendationControllerRef.current = controller;

    try {
      const apiRecommendation = await requestSpreadRecommendation(
        cleaned,
        controller.signal,
      );
      if (language === "zh") {
        apiRecommendation.focusLabel = localizedFocusLabel(t, cleaned);
      }
      if (spreadRecommendationControllerRef.current !== controller) return;
      const apiSpread =
        findSpreadChoice(apiRecommendation.spreadType) ?? localSpread;
      setSpread(apiSpread);
      setSpreadRecommendation(apiRecommendation);
    } catch {
      if (spreadRecommendationControllerRef.current !== controller) return;
      setSpread(localSpread);
      setSpreadRecommendation(localRecommendation);
    } finally {
      if (spreadRecommendationControllerRef.current === controller) {
        spreadRecommendationControllerRef.current = null;
        setSpreadRecommendationPending(false);
      }
    }
  }

  function submitQuestion() {
    void submitQuestionValue(question);
  }

  function stopSpreadRecommendationRequest() {
    spreadRecommendationControllerRef.current?.abort();
    spreadRecommendationControllerRef.current = null;
    setSpreadRecommendationPending(false);
  }

  function chooseSpread(nextSpread: SpreadChoice) {
    stopSpreadRecommendationRequest();
    setSpread(nextSpread);
  }

  const canStepBack =
    settingsMode || step !== "question";

  function restoreStepAfterRoomSettings() {
    if (!settingsReturnStep) return false;
    dispatchFlow({ type: "CLOSE_SETTINGS" });
    return true;
  }

  function handleBack() {
    hapticTick(8);
    if (settingsMode) {
      if (!restoreStepAfterRoomSettings()) navigate("/app/profile");
      return;
    }

    if (step === "spreadRecommendation") {
      spreadRecommendationControllerRef.current?.abort();
      spreadRecommendationControllerRef.current = null;
      setSpreadRecommendationPending(false);
      setStep("question");
      return;
    }

    if (step === "spreadSelector") {
      setStep(question ? "spreadRecommendation" : "question");
      return;
    }

    if (step === "design") {
      setStep(question ? "spreadRecommendation" : "question");
      return;
    }

    if (step === "prepare") {
      setStep("design");
      return;
    }

    if (step === "shuffle" || step === "cut") {
      setStep("prepare");
      return;
    }

    if (step === "pick") {
      setSelectedCards([]);
      setRevealedIds([]);
      setStep("prepare");
      return;
    }

    if (step === "reveal") {
      setStep("pick");
    }
  }

  function openRoomSettings() {
    hapticTick(8);
    if (settingsMode && step === "design") return;
    dispatchFlow({ type: "OPEN_SETTINGS" });
  }

  if (step === "reading") {
    return (
      <TarotPhoneFrame>
        <motion.div
          className="absolute inset-0 transform-gpu will-change-[opacity,transform]"
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: reduceMotion ? 0.01 : 0.2, ease: [0.22, 0.8, 0.22, 1] }}
        >
          <TarotHintReadingChat
            selectedCards={selectedCards}
            spread={spread}
            backStyle={design.backStyle}
            cardBackId={design.cardBackId}
            cardArtId={design.cardArtId}
            question={question}
            story={archivedReading?.story}
            focusLabel={spreadRecommendation?.focusLabel ?? t("tarot.room")}
            roomDesign={{
              backgroundId: design.backgroundId,
              cardArtId: design.cardArtId,
              cardBackId: design.cardBackId,
              backStyle: design.backStyle,
            }}
            theme={getWashTheme(design)}
            archiveOnOpen={!archivedReading}
            archivedReading={archivedReading ?? undefined}
            existingReadingId={readingArchiveRef.current?.id}
            existingReadingCreatedAt={readingArchiveRef.current?.createdAt}
            onBack={
              archivedReading
                ? () => navigate(`/app/readings/${encodeURIComponent(archivedReading.id)}`)
                : () => setStep("reveal")
            }
            onArchived={(reading) => {
              if (!visitOpen.current) return;
              readingArchiveRef.current = {
                id: reading.id,
                createdAt: reading.createdAt,
              };
              updateActiveTarotSessionArchive(reading.id, reading.createdAt);
            }}
            onNewReading={() => {
              clearActiveTarotSession();
              setArchivedReading(null);
              readingArchiveRef.current = null;
              setQuestion("");
              setSelectedCards([]);
              setRevealedIds([]);
              setDeck(createHiddenDeck());
              setSpreadRecommendation(null);
              setSpreadRecommendationPending(false);
              dispatchFlow({ type: "RESET" });
              navigate("/app/tarot", { replace: true });
            }}
          />
        </motion.div>
      </TarotPhoneFrame>
    );
  }

  return (
    <TarotPhoneFrame>
      <div className="absolute inset-0 overflow-hidden text-[color:var(--tarot-page-ink,#332d45)]">
        <RoomBackground design={design} />
        <div className="absolute left-4 top-[calc(var(--hint-safe-top)+0.75rem)] z-[80] flex items-center gap-2">
          {canStepBack ? (
            <button
              type="button"
              onClick={handleBack}
              aria-label={t("common.back")}
              className="grid h-11 w-11 place-items-center rounded-full border border-white/64 bg-white/54 text-[#5e5063] shadow-[0_10px_28px_rgba(92,72,105,0.14)] backdrop-blur-xl transition active:scale-95"
            >
              <ArrowLeft size={18} strokeWidth={1.8} />
            </button>
          ) : null}
          <Link
            href="/app"
            aria-label={t("common.home")}
            className="grid h-11 w-11 place-items-center rounded-full border border-white/64 bg-white/54 text-[#5e5063] shadow-[0_10px_28px_rgba(92,72,105,0.14)] backdrop-blur-xl transition active:scale-95"
          >
            <House size={17} strokeWidth={1.8} />
          </Link>
        </div>
        <button
          type="button"
          onClick={openRoomSettings}
          aria-label={t("me.settings.tarotTitle")}
          aria-pressed={settingsMode && step === "design"}
          className="absolute right-5 top-[calc(var(--hint-safe-top)+0.9rem)] z-[80] flex min-h-11 items-center gap-2 rounded-full border border-white/58 bg-white/46 px-3 py-2 text-[10px] font-black uppercase tracking-[0.18em] text-[#8e7082] shadow-[0_9px_24px_rgba(92,72,105,0.1)] backdrop-blur-xl transition active:scale-[0.97] aria-pressed:border-[#d4b5c7]/70 aria-pressed:bg-white/64"
        >
          <WandSparkles size={13} />
          {t("tarot.room")}
        </button>

        <AnimatePresence initial={false} mode="wait">
          {step === "question" && (
            <QuestionStep
              key="question"
              question={question}
              setQuestion={setQuestion}
              onSubmit={submitQuestion}
              onPromptSelect={(value) => void submitQuestionValue(value)}
              voiceOpen={voiceOpen}
              openVoice={() => setVoiceOpen(true)}
              closeVoice={() => setVoiceOpen(false)}
            />
          )}
          {step === "spreadRecommendation" && (
            <SpreadRecommendationStep
              key="spread-recommendation"
              spread={spread}
              question={question}
              recommendation={spreadRecommendation}
              isLoading={spreadRecommendationPending}
              design={design}
              onSpreadChange={chooseSpread}
              onUse={() => {
                stopSpreadRecommendationRequest();
                hapticTick(12);
                setStep("design");
              }}
            />
          )}
          {step === "spreadSelector" && (
            <SpotlightSelectorStep
              key="spread-selector"
              selected={spread}
              cardBackId={design.cardBackId}
              onSelect={chooseSpread}
              onChoose={() => {
                hapticTick(12);
                setStep("design");
              }}
            />
          )}
          {step === "design" && (
            <RoomDesignStudioStep
              key={`design-${settingsMode ? "settings" : "ritual"}`}
              design={design}
              onDesign={setDesign}
              spread={spread}
              settingsMode={settingsMode}
              onContinue={() => {
                hapticPulse([8, 28, 10]);
                saveRoomDesignPreference(design, spread);
                if (settingsMode) {
                  if (!restoreStepAfterRoomSettings()) navigate("/app/profile");
                  return;
                }
                setStep("prepare");
              }}
            />
          )}
          {step === "prepare" && (
            <PrepareStep
              key={`prepare-${ritualRecoveryVersion}`}
              question={question}
              spread={spread}
              design={design}
              onDone={() => {
                hapticTick(10);
                setStep("shuffle");
              }}
            />
          )}
          {step === "shuffle" && (
            <RitualShuffleStep
              key="shuffle"
              design={design}
              deck={deck}
              onComplete={(nextDeck) => {
                hapticPulse([8, 34, 12]);
                setDeck(nextDeck);
                setStep("cut");
              }}
            />
          )}
          {step === "cut" && (
            <CutStep
              key="cut"
              design={design}
              deck={deck}
              onDone={(nextDeck) => {
                setDeck(nextDeck);
                setStep("pick");
              }}
            />
          )}
          {step === "pick" && (
            <PickStep
              key="pick"
              spread={spread}
              deck={deck}
              design={design}
              selectedCards={selectedCards}
              setSelectedCards={setSelectedCards}
              onDone={() => {
                hapticPulse([10, 42, 14]);
                setRevealedIds([]);
                setStep("reveal");
              }}
            />
          )}
          {step === "reveal" && (
            <motion.div
              key="reveal"
              className="absolute inset-0 z-30"
              initial={{ opacity: 0, y: reduceMotion ? 0 : 14 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: reduceMotion ? 0 : -12 }}
              transition={{
                duration: reduceMotion ? 0.01 : 0.36,
                ease: "easeOut",
              }}
            >
              <ReadingReveal
                selectedCards={selectedCards}
                revealedIds={revealedIds}
                spread={spread}
                backStyle={design.backStyle}
                cardBackId={design.cardBackId}
                cardArtId={design.cardArtId}
                theme={getWashTheme(design)}
                autoReveal
                onReveal={(visualId) => {
                  hapticTick(8);
                  setRevealedIds((current) =>
                    current.includes(visualId)
                      ? current
                      : [...current, visualId],
                  );
                }}
                onContinue={() => {
                  hapticTick(12);
                  setStep("reading");
                }}
                onRestart={() => {
                  hapticTick(10);
                  clearActiveTarotSession();
                  readingArchiveRef.current = null;
                  setSelectedCards([]);
                  setRevealedIds([]);
                  setDeck(createHiddenDeck());
                  setSpreadRecommendation(null);
                  setSpreadRecommendationPending(false);
                  setStep("question");
                }}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </TarotPhoneFrame>
  );
}
