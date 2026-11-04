import { getAnonId } from "../../lib/identity";
import type { SpreadType } from "../hold/chat/types";

const STORAGE_KEY = "hint_local_question_history_v1";
const UPDATED_EVENT = "hint:local-question-history-updated";
const MAX_ITEMS = 50;

export interface QuestionHistoryItem {
  id: string;
  anonId: string;
  question: string;
  focus: string;
  spreadType: SpreadType;
  readingId?: string;
  createdAt: string;
}

const UNREADABLE_KEY = `${STORAGE_KEY}:unreadable`;
const SPREAD_TYPES = new Set<string>(["single", "three", "relationship", "futureLover", "peachBlossom", "reconciliation", "trueHeart", "loveTree", "xRelationship"] satisfies SpreadType[]);

/** One malformed row (null, half-written, edited by hand) must not take down History. */
function toQuestionItem(value: unknown): QuestionHistoryItem | null {
  if (!value || typeof value !== "object") return null;
  const row = value as Record<string, unknown>;
  if (typeof row.id !== "string" || typeof row.anonId !== "string") return null;
  if (typeof row.question !== "string" || !row.question.trim()) return null;
  if (typeof row.createdAt !== "string" || Number.isNaN(Date.parse(row.createdAt))) return null;
  if (typeof row.spreadType !== "string" || !SPREAD_TYPES.has(row.spreadType)) return null;
  return {
    id: row.id,
    anonId: row.anonId,
    question: row.question,
    focus: typeof row.focus === "string" ? row.focus : "",
    spreadType: row.spreadType as SpreadType,
    readingId: typeof row.readingId === "string" ? row.readingId : undefined,
    createdAt: row.createdAt,
  };
}

/** Keep one copy of unreadable history before the next save replaces it. */
function preserveUnreadable(raw: string) {
  try {
    if (localStorage.getItem(UNREADABLE_KEY) === null) localStorage.setItem(UNREADABLE_KEY, raw);
  } catch {
    // Best effort only; storage may be full or unavailable.
  }
}

function readAll(): QuestionHistoryItem[] {
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      preserveUnreadable(raw);
      return [];
    }
    return parsed.flatMap((value) => {
      const item = toQuestionItem(value);
      return item ? [item] : [];
    });
  } catch {
    if (raw) preserveUnreadable(raw);
    return [];
  }
}

function writeAll(items: QuestionHistoryItem[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    window.dispatchEvent(new Event(UPDATED_EVENT));
  } catch {
    // Question history is a local convenience; reading flow should continue.
  }
}

export function saveLocalQuestionHistory(input: {
  question: string;
  focus: string;
  spreadType: SpreadType;
  readingId?: string;
  createdAt?: string;
  anonId?: string;
}): QuestionHistoryItem {
  const anonId = input.anonId ?? getAnonId();
  const createdAt = input.createdAt ?? new Date().toISOString();
  const question = input.question.trim();
  const item: QuestionHistoryItem = {
    id: `q-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    anonId,
    question,
    focus: input.focus,
    spreadType: input.spreadType,
    readingId: input.readingId,
    createdAt,
  };

  const lowerQuestion = question.toLowerCase();
  const withoutDuplicate = readAll().filter(
    (stored) =>
      !(
        stored.anonId === anonId &&
        stored.question.trim().toLowerCase() === lowerQuestion &&
        stored.spreadType === input.spreadType
      ),
  );

  writeAll([item, ...withoutDuplicate].slice(0, MAX_ITEMS));
  return item;
}

export function listLocalQuestionHistory(anonId = getAnonId()): QuestionHistoryItem[] {
  return readAll()
    .filter((item) => item.anonId === anonId)
    .sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );
}

export function subscribeToLocalQuestionHistory(onChange: () => void): () => void {
  window.addEventListener(UPDATED_EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(UPDATED_EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}
