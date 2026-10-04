import { getAnonId } from "../../lib/identity";
import { z } from "zod";
import type { TarotCardArtId } from "../tarot/logic/cardImageMap";
import {
  getDefaultTarotCardBackForStyle,
  isTarotCardBackId,
  type TarotCardBackId,
  type TarotCardBackStyle,
} from "../tarot/logic/cardBacks";

const STORAGE_KEY = "hint_local_tarot_readings_v1";
const UPDATED_EVENT = "hint:local-tarot-readings-updated";
const MAX_ITEMS = 80;

export type LocalTarotReadingCard = {
  visualId?: string;
  cardId: string;
  name: string;
  orientation: "upright" | "reversed";
  positionLabel: string;
  keywords: string[];
};

export type LocalTarotChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
};

const readingText = z.string().trim().min(1);
const structuredReadingSchema = z.object({
  signal_type: z.enum(["clear_signal", "mixed_signal", "opening", "blocked", "soft_yes", "soft_no"]),
  overall_summary: readingText,
  cards: z.array(z.object({
    position: readingText,
    card_name: readingText,
    orientation: z.enum(["upright", "reversed"]),
    meaning: readingText,
  })).min(1).max(10),
  final_action_advice: readingText,
  follow_up_invitation: readingText,
  cards_connection: readingText.optional().catch(undefined),
  watch_for: readingText.optional().catch(undefined),
});

export type LocalStructuredTarotReading = z.infer<typeof structuredReadingSchema>;

export function parseStructuredTarotReading(value: unknown): LocalStructuredTarotReading | null {
  const parsed = structuredReadingSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}

export type LocalTarotRoomDesign = {
  backgroundId: string;
  cardArtId: TarotCardArtId;
  cardBackId: TarotCardBackId;
  backStyle: TarotCardBackStyle;
};

export type LocalTarotReading = {
  schemaVersion: 2;
  id: string;
  anonId: string;
  source: "tarot";
  spreadType: string;
  spreadLabel: string;
  question?: string;
  story?: string;
  focusLabel?: string;
  cardArtId?: TarotCardArtId;
  roomDesign?: LocalTarotRoomDesign;
  structuredReading?: LocalStructuredTarotReading;
  detailedReading?: LocalStructuredTarotReading;
  detailedContext?: string;
  detailedFeedback?: "yes" | "somewhat" | "no";
  interpretationStatus?: "pending" | "local" | "ready";
  chatMessages: LocalTarotChatMessage[];
  shortAnswer: string;
  questionMeaning: string;
  cardMeanings: string[];
  cards: LocalTarotReadingCard[];
  createdAt: string;
};

type LegacyLocalTarotReading = Omit<
  LocalTarotReading,
  "schemaVersion" | "chatMessages"
> & {
  schemaVersion?: 1 | 2;
  chatMessages?: LocalTarotChatMessage[];
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function normalizeCardArtId(value: unknown): TarotCardArtId | undefined {
  return value === "original" || value === "hint-classic" || value === "hint-card-2"
    ? value
    : undefined;
}

function normalizeRoomDesign(value: unknown, cardArtId?: TarotCardArtId): LocalTarotRoomDesign | undefined {
  if (!isRecord(value)) return undefined;
  const backStyle = value.backStyle === "ivory" || value.backStyle === "nocturne"
    ? value.backStyle
    : "rose";
  return {
    backgroundId: value.backgroundId === "dawn" || value.backgroundId === "sea" ? value.backgroundId : "stars",
    cardArtId: normalizeCardArtId(value.cardArtId) ?? cardArtId ?? "hint-classic",
    cardBackId: isTarotCardBackId(value.cardBackId) ? value.cardBackId : getDefaultTarotCardBackForStyle(backStyle),
    backStyle,
  };
}

function normalizeStoredCard(
  value: unknown,
  readingId: string,
  index: number,
): LocalTarotReadingCard | null {
  if (!isRecord(value)) return null;
  if (
    typeof value.cardId !== "string" ||
    !value.cardId ||
    typeof value.name !== "string" ||
    !value.name ||
    (value.orientation !== "upright" && value.orientation !== "reversed") ||
    typeof value.positionLabel !== "string"
  ) {
    return null;
  }

  return {
    cardId: value.cardId,
    name: value.name,
    orientation: value.orientation,
    positionLabel: value.positionLabel,
    keywords: Array.isArray(value.keywords)
      ? value.keywords.filter((keyword): keyword is string => typeof keyword === "string")
      : [],
    visualId:
      typeof value.visualId === "string" && value.visualId
        ? value.visualId
        : `${readingId}-${index}-${value.cardId}`,
  };
}

export function normalizeLocalTarotReading(
  value: LegacyLocalTarotReading,
): LocalTarotReading {
  const cards = Array.isArray(value.cards)
    ? value.cards.flatMap((card, index) => {
        const normalized = normalizeStoredCard(card, value.id, index);
        return normalized ? [normalized] : [];
      })
    : [];
  const parsedReading = parseStructuredTarotReading(value.structuredReading);
  const structuredReading = parsedReading?.cards.length === cards.length ? parsedReading : null;
  const parsedDetail = parseStructuredTarotReading(value.detailedReading);
  const detailedReading = parsedDetail?.cards.length === cards.length && cards.every((card, index) => {
    const detail = parsedDetail.cards[index]!;
    return detail.card_name === card.name && detail.position === card.positionLabel && detail.orientation === card.orientation;
  }) ? parsedDetail : undefined;
  const damagedInterpretation = value.structuredReading != null && !structuredReading;
  const cardArtId = normalizeCardArtId(value.cardArtId);
  const roomDesign = normalizeRoomDesign(value.roomDesign, cardArtId);
  return {
    ...value,
    schemaVersion: 2,
    spreadType: typeof value.spreadType === "string" ? value.spreadType : "three",
    spreadLabel: typeof value.spreadLabel === "string" ? value.spreadLabel : "Tarot",
    shortAnswer: typeof value.shortAnswer === "string" ? value.shortAnswer : "",
    questionMeaning: typeof value.questionMeaning === "string" ? value.questionMeaning : "",
    cardMeanings: Array.isArray(value.cardMeanings)
      ? value.cardMeanings.map((meaning) => typeof meaning === "string" ? meaning : "")
      : [],
    question: typeof value.question === "string" ? value.question : undefined,
    story: typeof value.story === "string" ? value.story : undefined,
    focusLabel: typeof value.focusLabel === "string" ? value.focusLabel : undefined,
    createdAt: typeof value.createdAt === "string" && Number.isFinite(Date.parse(value.createdAt))
      ? value.createdAt
      : new Date(0).toISOString(),
    structuredReading: structuredReading ?? undefined,
    detailedReading,
    detailedContext: typeof value.detailedContext === "string" ? value.detailedContext.slice(0, 600) : undefined,
    detailedFeedback: value.detailedFeedback === "yes" || value.detailedFeedback === "somewhat" || value.detailedFeedback === "no" ? value.detailedFeedback : undefined,
    cardArtId: cardArtId ?? roomDesign?.cardArtId,
    roomDesign,
    interpretationStatus: damagedInterpretation
      ? "local"
      : ["pending", "local", "ready"].includes(value.interpretationStatus ?? "")
        ? value.interpretationStatus
        : undefined,
    chatMessages: Array.isArray(value.chatMessages)
      ? value.chatMessages.filter(
          (message) =>
            Boolean(message) &&
            typeof message.id === "string" &&
            (message.role === "user" || message.role === "assistant") &&
            typeof message.content === "string",
        )
      : [],
    cards,
  };
}

function isStoredReading(value: unknown): value is LegacyLocalTarotReading {
  return (
    isRecord(value) &&
    typeof value.id === "string" &&
    Boolean(value.id) &&
    typeof value.anonId === "string" &&
    Boolean(value.anonId) &&
    Array.isArray(value.cards)
  );
}

function readStoredEntries(): unknown[] | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function readAll(): LocalTarotReading[] {
  return (readStoredEntries() ?? []).flatMap((item) => {
    if (!isStoredReading(item)) return [];
    try {
      const reading = normalizeLocalTarotReading(item);
      return reading.cards.length > 0 ? [reading] : [];
    } catch {
      return [];
    }
  });
}

function writeAll(items: unknown[]): boolean {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    window.dispatchEvent(new Event(UPDATED_EVENT));
    return true;
  } catch {
    return false;
  }
}

export type LocalTarotSaveResult = {
  reading: LocalTarotReading;
  saved: boolean;
};

export function saveLocalTarotReading(
  input: Omit<
    LocalTarotReading,
    "schemaVersion" | "id" | "anonId" | "source" | "createdAt" | "chatMessages"
  > & {
    id?: string;
    anonId?: string;
    createdAt?: string;
    chatMessages?: LocalTarotChatMessage[];
  },
): LocalTarotSaveResult {
  const anonId = input.anonId ?? getAnonId();
  const createdAt = input.createdAt ?? new Date().toISOString();
  const id = input.id ?? `tarot-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const reading: LocalTarotReading = {
    schemaVersion: 2,
    id,
    anonId,
    source: "tarot",
    spreadType: input.spreadType,
    spreadLabel: input.spreadLabel,
    question: input.question,
    story: input.story,
    focusLabel: input.focusLabel,
    cardArtId: input.cardArtId,
    roomDesign: input.roomDesign,
    structuredReading: input.structuredReading,
    detailedReading: input.detailedReading,
    detailedContext: input.detailedContext,
    detailedFeedback: input.detailedFeedback,
    interpretationStatus: input.interpretationStatus,
    chatMessages: input.chatMessages ?? [],
    shortAnswer: input.shortAnswer,
    questionMeaning: input.questionMeaning,
    cardMeanings: input.cardMeanings,
    cards: input.cards,
    createdAt,
  };

  const existing = readStoredEntries();
  return {
    reading,
    // Keep unreadable records intact so a later migration can still recover them.
    saved: existing !== null && writeAll([reading, ...existing.filter((item) =>
      !isRecord(item) || item.id !== id || item.anonId !== anonId,
    )].slice(0, MAX_ITEMS)),
  };
}

export function patchLocalTarotReading(
  id: string,
  patch: Partial<
    Pick<
      LocalTarotReading,
      | "shortAnswer"
      | "questionMeaning"
      | "cardMeanings"
      | "structuredReading"
      | "detailedReading"
      | "detailedContext"
      | "detailedFeedback"
      | "interpretationStatus"
      | "chatMessages"
      | "roomDesign"
    >
  >,
  anonId = getAnonId(),
): LocalTarotReading | null {
  const current = getLocalTarotReading(id, anonId);
  if (!current) return null;
  const next = normalizeLocalTarotReading({ ...current, ...patch });
  const existing = readStoredEntries();
  if (existing === null) return null;
  return writeAll([next, ...existing.filter((item) =>
    !isRecord(item) || item.id !== id || item.anonId !== anonId,
  )].slice(0, MAX_ITEMS)) ? next : null;
}

export function listLocalTarotReadings(anonId = getAnonId()): LocalTarotReading[] {
  return readAll()
    .filter((item) => item.anonId === anonId)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

export function getLocalTarotReading(id: string, anonId = getAnonId()): LocalTarotReading | null {
  return readAll().find((item) => item.anonId === anonId && item.id === id) ?? null;
}

export function subscribeToLocalTarotReadings(onChange: () => void): () => void {
  window.addEventListener(UPDATED_EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(UPDATED_EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}
