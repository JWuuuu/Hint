import type { RitualCard } from "../types/ritual.types";
import { captureIdentityContext } from "../../../lib/identity";

const STORAGE_KEY = "hint_active_tarot_reading_v1";
const MAX_AGE_MS = 12 * 60 * 60 * 1000;

export type ActiveTarotRoomDesign = {
  id: string;
  label: string;
  mood: string;
  deckStyleId: string;
  backStyle: string;
  cardBackId: string;
  cardArtId: string;
  backgroundId: string;
  background: string;
  glow: string;
};

export type ActiveTarotSession = {
  version: 1;
  savedAt: number;
  phase:
    | "question"
    | "spreadRecommendation"
    | "design"
    | "prepare"
    | "pick"
    | "reveal"
    | "reading";
  question: string;
  spreadId: string;
  focusLabel: string;
  design: ActiveTarotRoomDesign;
  selectedCards: RitualCard[];
  revealedIds: string[];
  deck?: RitualCard[];
  readingId?: string;
  readingCreatedAt?: string;
};

type StorageLike = Pick<Storage, "getItem" | "setItem" | "removeItem">;
type RecoveryContext = { identity: ReturnType<typeof captureIdentityContext>; clearVersion: string };
let recoveryContext: RecoveryContext | null = null;
const scopedKey = (owner: string) => `hint_active_tarot_reading_v2:${owner}`;
const clearVersion = (owner: string) => window.localStorage.getItem(`hint_history_clear_version_v1:${owner}`) ?? "";

function ownedStorage(storage: StorageLike, context: RecoveryContext): StorageLike {
  const owner = context.identity.owner;
  const key = scopedKey(owner);
  const assertCurrent = () => {
    context.identity.assertCurrent();
    if (clearVersion(owner) !== context.clearVersion) throw new DOMException("History cleared", "AbortError");
  };
  return {
    getItem() {
      assertCurrent();
      const raw = storage.getItem(key);
      assertCurrent();
      if (raw !== null) {
        const record = JSON.parse(raw);
        return record?.owner === owner && record.clearVersion === context.clearVersion ? raw : null;
      }
      // A previous history clear invalidates every unversioned legacy copy,
      // including fallback sessionStorage in a different tab.
      if (context.clearVersion) return null;
      const legacy = storage.getItem(STORAGE_KEY);
      assertCurrent();
      if (!legacy) return null;
      const record = JSON.parse(legacy);
      if (record?.owner && record.owner !== owner || record?.clearVersion) return null;
      return legacy;
    },
    setItem(_unused, raw) {
      assertCurrent();
      const value = JSON.stringify({ ...JSON.parse(raw), owner, clearVersion: context.clearVersion });
      storage.setItem(key, value);
      assertCurrent();
    },
    removeItem() {
      assertCurrent();
      // A scoped tombstone prevents an old shared legacy copy from reappearing.
      // Never delete a shared slot that another process can select meanwhile.
      storage.setItem(key, "null");
      assertCurrent();
    },
  };
}

function defaultStorages(beginNewReading = false): StorageLike[] {
  if (typeof window === "undefined") return [];
  try {
    if (!recoveryContext) {
      const identity = captureIdentityContext();
      recoveryContext = { identity, clearVersion: clearVersion(identity.owner) };
    }
    recoveryContext.identity.assertCurrent();
    // Only an explicit New Reading/Restart can admit new work after deletion.
    // Late autosaves retain their original history generation.
    if (beginNewReading) recoveryContext = { ...recoveryContext, clearVersion: clearVersion(recoveryContext.identity.owner) };
    if (clearVersion(recoveryContext.identity.owner) !== recoveryContext.clearVersion) return [];
  } catch { return []; }
  const storages: StorageLike[] = [];
  for (const key of ["localStorage", "sessionStorage"] as const) {
    try {
      const storage = window[key];
      if (storage) storages.push(ownedStorage(storage, recoveryContext));
    } catch {
      // A restricted webview may expose one storage and reject the other.
    }
  }
  return storages;
}

function storageCandidates(storage?: StorageLike | null): StorageLike[] {
  if (storage === undefined) return defaultStorages();
  return storage ? [storage] : [];
}

function isRitualCard(value: unknown): value is RitualCard {
  if (!value || typeof value !== "object") return false;
  const card = value as Partial<RitualCard>;
  return (
    typeof card.visualId === "string" &&
    typeof card.cardId === "string" &&
    typeof card.name === "string" &&
    (card.orientation === "upright" || card.orientation === "reversed")
  );
}

function isRoomDesign(value: unknown): value is ActiveTarotRoomDesign {
  if (!value || typeof value !== "object") return false;
  const design = value as Partial<ActiveTarotRoomDesign>;
  return [
    design.id,
    design.label,
    design.mood,
    design.deckStyleId,
    design.backStyle,
    design.cardBackId,
    design.cardArtId,
    design.backgroundId,
    design.background,
    design.glow,
  ].every((item) => typeof item === "string");
}

export function saveActiveTarotSession(
  session: Omit<ActiveTarotSession, "version" | "savedAt"> &
    Partial<Pick<ActiveTarotSession, "version" | "savedAt">>,
  storage?: StorageLike | null,
  now = Date.now(),
) {
  const candidates = storageCandidates(storage);
  let savedAt = session.savedAt ?? now;
  for (const candidate of candidates) {
    try {
      const previous = JSON.parse(candidate.getItem(STORAGE_KEY) ?? "null");
      if (previous?.version === 1 && Number.isFinite(previous.savedAt)) {
        savedAt = Math.max(savedAt, previous.savedAt + 1);
      }
    } catch {
      // A failed metadata read must not prevent writing to another store.
    }
  }
  const value: ActiveTarotSession = {
    ...session,
    version: 1,
    savedAt,
  };
  const serialized = JSON.stringify(value);
  for (const candidate of candidates) {
    try {
      candidate.setItem(STORAGE_KEY, serialized);
      // Once the preferred store recovers, an older fallback must not resurrect later.
      if (candidate === candidates[0]) {
        for (const fallback of candidates.slice(1)) {
          try {
            fallback.removeItem(STORAGE_KEY);
          } catch {
            // Cleanup failure must not invalidate the successful save.
          }
        }
      }
      return;
    } catch {
      // Fall back to session storage when durable storage is unavailable.
    }
  }
}

function readActiveTarotSession(
  storage: StorageLike,
  now: number,
): ActiveTarotSession | null {
  try {
    const raw = storage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const value = JSON.parse(raw) as Partial<ActiveTarotSession>;
    const validArchiveReference =
      (value.readingId === undefined && value.readingCreatedAt === undefined) ||
      (typeof value.readingId === "string" &&
        typeof value.readingCreatedAt === "string");
    const valid =
      value.version === 1 &&
      typeof value.savedAt === "number" &&
      now - value.savedAt <= MAX_AGE_MS &&
      [
        "question",
        "spreadRecommendation",
        "design",
        "prepare",
        "pick",
        "reveal",
        "reading",
      ].includes(value.phase ?? "") &&
      typeof value.question === "string" &&
      typeof value.spreadId === "string" &&
      typeof value.focusLabel === "string" &&
      isRoomDesign(value.design) &&
      Array.isArray(value.selectedCards) &&
      value.selectedCards.every(isRitualCard) &&
      Array.isArray(value.revealedIds) &&
      value.revealedIds.every((item) => typeof item === "string") &&
      (value.deck === undefined ||
        (Array.isArray(value.deck) && value.deck.every(isRitualCard))) &&
      validArchiveReference &&
      ((value.phase === "reveal" || value.phase === "reading")
        ? value.selectedCards.length > 0
        : true);
    if (!valid) {
      storage.removeItem(STORAGE_KEY);
      return null;
    }
    return value as ActiveTarotSession;
  } catch {
    try {
      storage.removeItem(STORAGE_KEY);
    } catch {
      // Invalid recovery data is safe to ignore when storage is restricted.
    }
    return null;
  }
}

export function loadActiveTarotSession(
  storage?: StorageLike | null,
  now = Date.now(),
): ActiveTarotSession | null {
  const candidates = storageCandidates(storage);
  let newest: { value: ActiveTarotSession; storage: StorageLike } | null = null;
  for (const candidate of candidates) {
    const value = readActiveTarotSession(candidate, now);
    if (value && (!newest || value.savedAt > newest.value.savedAt)) {
      newest = { value, storage: candidate };
    }
  }
  if (!newest) return null;

  if (storage === undefined && newest.storage !== candidates[0] && candidates[0]) {
    try {
      candidates[0].setItem(STORAGE_KEY, JSON.stringify(newest.value));
      newest.storage.removeItem(STORAGE_KEY);
    } catch {
      // Preserve the newest fallback until durable storage can accept it.
    }
  }
  return newest.value;
}

export function updateActiveTarotSessionArchive(
  readingId: string,
  readingCreatedAt: string,
  storage?: StorageLike | null,
) {
  const current = loadActiveTarotSession(storage);
  if (!current) return;
  saveActiveTarotSession(
    { ...current, readingId, readingCreatedAt, savedAt: Date.now() },
    storage,
  );
}

export function clearActiveTarotSession(
  storage?: StorageLike | null,
) {
  for (const candidate of storage === undefined ? defaultStorages(true) : storageCandidates(storage)) {
    try {
      candidate.removeItem(STORAGE_KEY);
    } catch {
      // Clearing recovery state is best effort.
    }
  }
}
