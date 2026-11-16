import { captureIdentityContext, getAnonId, getLocalDateString } from "../../../lib/identity";
import { getDailyTarotDay } from "../../../lib/dailyReceipts";

const STORAGE_PREFIX = "hint_home_checkin_v1:";
const UPDATED_EVENT = "hint:home-check-in-updated";

export type HomeCheckInEntry = {
  date: string;
  credits: number;
  streak: number;
  createdAt: string;
};

export type HomeCheckInProgress = {
  records: HomeCheckInEntry[];
  todayCompleted: boolean;
  currentStreak: number;
  activeDay: number;
  cycleDay: number;
  completedInCycle: number;
  todayCredits: number;
  nextCredits: number;
  totalCredits: number;
  persistent: boolean;
};

// A per-day key makes the claim idempotent across tabs without replacing a
// whole ledger. Unavailable storage falls back to this realm only.
const pendingMemory = new Map<string, HomeCheckInEntry>();

function ownerPrefix(owner: string): string {
  if (!owner || owner.length > 256) throw new TypeError("A check-in owner is required.");
  return `${STORAGE_PREFIX}${encodeURIComponent(owner)}:`;
}

function isDateKey(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T12:00:00`);
  return Number.isFinite(parsed.getTime()) && getLocalDateString(parsed) === value;
}

function previousDay(day: string): string {
  const date = new Date(`${day}T12:00:00`);
  date.setDate(date.getDate() - 1);
  return getLocalDateString(date);
}

export function homeCheckInReward(streak: number): number {
  if (!Number.isSafeInteger(streak) || streak < 1) return 0;
  if (streak === 3) return 2;
  if (streak === 7) return 3;
  if (streak >= 14 && streak % 7 === 0) return 4;
  return 1;
}

function parseEntry(raw: string | null, expectedDate: string): HomeCheckInEntry | null {
  if (!raw) return null;
  try {
    const entry: unknown = JSON.parse(raw);
    if (!entry || typeof entry !== "object") return null;
    const row = entry as Partial<HomeCheckInEntry>;
    if (row.date !== expectedDate || !isDateKey(row.date) ||
        !Number.isSafeInteger(row.streak) || (row.streak ?? 0) < 1 ||
        row.credits !== homeCheckInReward(row.streak!) ||
        typeof row.createdAt !== "string" || !Number.isFinite(Date.parse(row.createdAt))) return null;
    return { date: row.date, credits: row.credits!, streak: row.streak!, createdAt: row.createdAt };
  } catch { return null; }
}

function readRecords(owner: string, today: string): { records: HomeCheckInEntry[]; persistent: boolean } {
  const prefix = ownerPrefix(owner);
  if (!isDateKey(today)) throw new RangeError("A valid check-in date is required.");
  const rows = new Map<string, HomeCheckInEntry>();
  const memoryKeys = new Set<string>();
  for (const [key, row] of pendingMemory) {
    if (key.startsWith(prefix) && row.date <= today) {
      rows.set(row.date, row);
      memoryKeys.add(key);
    }
  }
  let readable = true;
  try {
    for (let index = 0; index < localStorage.length; index++) {
      const key = localStorage.key(index);
      if (!key?.startsWith(prefix)) continue;
      const date = key.slice(prefix.length);
      if (!isDateKey(date) || date > today) continue;
      const row = parseEntry(localStorage.getItem(key), date);
      if (row) {
        rows.set(date, row);
        memoryKeys.delete(key);
      }
    }
  } catch { readable = false; }
  return {
    records: [...rows.values()].sort((a, b) => a.date.localeCompare(b.date)),
    persistent: readable && memoryKeys.size === 0,
  };
}

export function getHomeCheckInProgress(owner: string, today: string): HomeCheckInProgress {
  const { records, persistent } = readRecords(owner, today);
  const byDate = new Map(records.map(row => [row.date, row]));
  const todayEntry = byDate.get(today);
  let cursor = todayEntry ? today : previousDay(today);
  let currentStreak = 0;
  while (byDate.has(cursor)) {
    currentStreak++;
    cursor = previousDay(cursor);
  }
  const activeDay = todayEntry ? currentStreak : currentStreak + 1;
  const cycleDay = ((activeDay - 1) % 7) + 1;
  return {
    records,
    todayCompleted: Boolean(todayEntry),
    currentStreak,
    activeDay,
    cycleDay,
    completedInCycle: todayEntry ? cycleDay : cycleDay - 1,
    todayCredits: todayEntry?.credits ?? 0,
    nextCredits: homeCheckInReward(activeDay),
    totalCredits: records.reduce((sum, row) => sum + row.credits, 0),
    persistent,
  };
}

function currentOwnerGuard(owner: string): () => void {
  if (getAnonId() !== owner) throw new DOMException("Local profile changed", "AbortError");
  try {
    const context = captureIdentityContext();
    if (context.owner !== owner) throw new DOMException("Local profile changed", "AbortError");
    return context.assertCurrent;
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") throw error;
    // A browser may deny storage entirely. Its cached identity can still own
    // an explicitly session-only record; a real identity fence still aborts.
    return () => {
      if (getAnonId() !== owner) throw new DOMException("Local profile changed", "AbortError");
    };
  }
}

export function recordHomeCheckIn(owner: string, date: string): HomeCheckInProgress {
  if (!isDateKey(date) || date !== getDailyTarotDay()) {
    throw new DOMException("Check-in is only available for today.", "AbortError");
  }
  const assertCurrent = currentOwnerGuard(owner);
  const progress = getHomeCheckInProgress(owner, date);
  const key = `${ownerPrefix(owner)}${date}`;
  const existing = progress.records.find(row => row.date === date);
  if (existing && !pendingMemory.has(key)) return progress;
  const record = existing ?? {
    date,
    credits: progress.nextCredits,
    streak: progress.activeDay,
    createdAt: new Date().toISOString(),
  };
  assertCurrent();
  // A render captured just before midnight must not claim yesterday later.
  if (date !== getDailyTarotDay()) throw new DOMException("The check-in day changed.", "AbortError");
  let changed = !existing;
  try {
    const saved = parseEntry(localStorage.getItem(key), date);
    if (!saved) localStorage.setItem(key, JSON.stringify(record));
    changed ||= pendingMemory.has(key);
    pendingMemory.delete(key);
  } catch {
    assertCurrent();
    pendingMemory.set(key, record);
  }
  if (changed && typeof window !== "undefined") window.dispatchEvent(new Event(UPDATED_EVENT));
  return getHomeCheckInProgress(owner, date);
}

export function claimHomeCheckIn(owner: string, date: string): {
  progress: HomeCheckInProgress;
  awardedCredits: number;
} {
  const before = getHomeCheckInProgress(owner, date);
  const progress = recordHomeCheckIn(owner, date);
  return {
    progress,
    // Persisting a session-only claim later is not another earned reward.
    awardedCredits: !before.todayCompleted && progress.todayCompleted ? progress.todayCredits : 0,
  };
}

export function subscribeToHomeCheckIn(onChange: () => void): () => void {
  const onStorage = (event: StorageEvent) => {
    // Some existing local-data flows dispatch a plain Event("storage").
    if (event.key == null || event.key.startsWith(STORAGE_PREFIX)) onChange();
  };
  window.addEventListener(UPDATED_EVENT, onChange);
  window.addEventListener("storage", onStorage);
  return () => {
    window.removeEventListener(UPDATED_EVENT, onChange);
    window.removeEventListener("storage", onStorage);
  };
}
