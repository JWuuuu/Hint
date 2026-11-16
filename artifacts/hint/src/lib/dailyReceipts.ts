import { apiFetch, apiUrl } from "./api";
import { getAnonId, getLocalDateString } from "./identity";

export type DailyReceiptFeature =
  | "daily-card"
  | "daily-tarot"
  | "sky-deck"
  | "energy-score"
  | "collection-rare-reward"
  | "animal-tarot";

export type DailyReceiptSource = "server" | "local-fallback";

export type DailyReceipt = {
  id?: string;
  userId?: string | null;
  anonymousDeviceId: string;
  anonId: string;
  dailyKey: string;
  featureType: DailyReceiptFeature;
  assignedCardId?: string | null;
  orientation?: "upright" | "reversed" | string | null;
  assignedAt: string;
  expiresAt: string;
  openedAt?: string | null;
  lastSeenAt?: string | null;
  serverTime?: string;
  source: DailyReceiptSource;
  persistence?: "local" | "synced" | "memory";
  syncStatus?: "pending" | "synced" | "conflict";
  historyExcluded?: boolean;
};

type ReceiptOptions = {
  anonId?: string;
  fallbackAssignedCardId?: string | null;
  dailyKey?: string;
};

const FALLBACK_STORAGE_KEY = "hint_daily_receipt_fallbacks_v1";
const FALLBACK_EVENT = "hint:daily-receipt-fallback-updated";

const memory = new Map<string, DailyReceipt>();
const requests = new Map<string, Promise<DailyReceipt>>();
const authoritativeFeatures = new Set<DailyReceiptFeature>(["daily-card", "daily-tarot"]);
const activeDailyFeatures = new Set<DailyReceiptFeature>();
let connectionGeneration = 0;
let serverClock: { time: number; received: number } | null = null;
function serverNow() {
  return serverClock ? serverClock.time + performance.now() - serverClock.received : Date.now();
}
/** UTC, anchored to a server response and a monotonic clock, never a client-selected timezone. */
export function getDailyTarotDay() { return new Date(serverNow()).toISOString().slice(0, 10); }

const receiptKey = (owner: string, feature: DailyReceiptFeature, day: string) => `${owner}:${feature}:${day}`;
function isReceiptRow(row: unknown): row is DailyReceipt {
  return typeof row === "object" && row !== null && typeof (row as DailyReceipt).anonId === "string"
    && typeof (row as DailyReceipt).dailyKey === "string" && typeof (row as DailyReceipt).featureType === "string";
}
function readFallbackReceipts(): DailyReceipt[] {
  // A damaged row (null, a number, a half-written object) must not take Today down with it.
  try { const rows = JSON.parse(localStorage.getItem(FALLBACK_STORAGE_KEY) ?? "[]"); return Array.isArray(rows) ? rows.filter(isReceiptRow) : []; }
  catch { return []; }
}
export function getCachedDailyReceipt(feature: DailyReceiptFeature, options: ReceiptOptions = {}): DailyReceipt | null {
  const owner = options.anonId ?? getAnonId(); const day = options.dailyKey ?? (authoritativeFeatures.has(feature) ? getDailyTarotDay() : getLocalDateString());
  // Browser storage is a display cache, not proof of a server assignment. Revalidate on reload.
  if (authoritativeFeatures.has(feature)) return memory.get(receiptKey(owner, feature, day)) ?? null;
  return memory.get(receiptKey(owner, feature, day)) ?? readFallbackReceipts().find(row => row.anonId === owner && row.featureType === feature && row.dailyKey === day) ?? null;
}
async function authoritativeReceipt(featureType: DailyReceiptFeature, options: ReceiptOptions, open: boolean): Promise<DailyReceipt> {
  const owner = options.anonId ?? getAnonId();
  const key = `${receiptKey(owner, featureType, options.dailyKey ?? `current:${getDailyTarotDay()}`)}:${open ? "open" : "read"}`;
  const pending = requests.get(key); if (pending) return pending;
  activeDailyFeatures.add(featureType);
  const startedConnection = connectionGeneration;
  const work = (async () => {
    const request = () => apiFetch(apiUrl(open ? "/api/daily-receipts/open" : "/api/daily-receipts/get-or-create"), {
      method: open ? "PATCH" : "POST", headers: { "Content-Type": "application/json" }, signal: AbortSignal.timeout(10000),
      body: JSON.stringify({ featureType, ...(options.dailyKey ? { dailyKey: options.dailyKey } : {}) }),
    });
    const readResponse = async () => {
      const response = await request();
      if (!response.ok) throw new Error("Daily reading unavailable");
      return response;
    };
    let response;
    try { response = await readResponse(); }
    catch (error) {
      // An online event may have joined this still-pending offline read. Give all
      // its callers one fresh attempt; never automatically repeat a reveal.
      if (open || startedConnection === connectionGeneration || owner !== getAnonId()) throw error;
      response = await readResponse();
    }
    const server = await response.json() as DailyReceipt;
    if (owner !== getAnonId()) throw new Error("Daily reading owner changed");
    const timestamp = Date.parse(server.serverTime ?? "");
    if (!Number.isFinite(timestamp) || !server.id || server.featureType !== featureType || !server.assignedCardId ||
      !/^\d{4}-\d{2}-\d{2}$/.test(server.dailyKey) || !Number.isFinite(Date.parse(server.expiresAt))) {
      throw new Error("Invalid server daily reading");
    }
    if (!serverClock || timestamp >= serverClock.time) serverClock = { time: Math.max(timestamp, serverClock ? serverNow() : timestamp), received: performance.now() };
    const previous = memory.get(receiptKey(owner, featureType, server.dailyKey));
    // A slower assignment response cannot undo a completed open for this same receipt.
    return persist({ ...server, openedAt: server.openedAt ?? (previous?.id === server.id ? previous.openedAt : null),
      anonId: owner, source: "server", syncStatus: "synced" });
  })().finally(() => requests.delete(key));
  requests.set(key, work);
  return work;
}
function persist(receipt: DailyReceipt): DailyReceipt {
  const result = { ...receipt };
  const key = receiptKey(result.anonId, result.featureType, result.dailyKey);
  try {
    result.persistence = result.syncStatus === "synced" ? "synced" : "local";
    const rows = readFallbackReceipts().filter(row => receiptKey(row.anonId, row.featureType, row.dailyKey) !== key);
    localStorage.setItem(FALLBACK_STORAGE_KEY, JSON.stringify([result, ...rows]));
  } catch { result.persistence = result.syncStatus === "synced" ? "synced" : "memory"; }
  memory.set(key, result);
  window.dispatchEvent(new Event(FALLBACK_EVENT));
  return result;
}
function makeFallbackReceipt(featureType: DailyReceiptFeature, options: ReceiptOptions): DailyReceipt {
  const existing = getCachedDailyReceipt(featureType, options);
  if (existing) return existing;
  const owner = options.anonId ?? getAnonId(); const dailyKey = options.dailyKey ?? getLocalDateString();
  const expires = new Date(`${dailyKey}T12:00:00`); expires.setDate(expires.getDate() + 1); expires.setHours(0, 0, 0, 0);
  return persist({ anonymousDeviceId: owner, anonId: owner, dailyKey, featureType,
    assignedCardId: options.fallbackAssignedCardId ?? null, orientation: featureType === "daily-tarot" ? "upright" : null,
    assignedAt: new Date().toISOString(), expiresAt: expires.toISOString(), source: "local-fallback", syncStatus: "pending" });
}
export async function syncDailyReceipt(local: DailyReceipt): Promise<DailyReceipt> {
  if (authoritativeFeatures.has(local.featureType)) return authoritativeReceipt(local.featureType, { anonId: local.anonId, dailyKey: local.dailyKey }, false);
  if (!local.openedAt) return local;
  try {
    const response = await apiFetch(apiUrl("/api/daily-receipts/sync"), {
      method: "POST", headers: { "Content-Type": "application/json" }, signal: AbortSignal.timeout(10000),
      body: JSON.stringify({ anonId: local.anonId, anonymousDeviceId: local.anonId, featureType: local.featureType,
        dailyKey: local.dailyKey, assignedCardId: local.assignedCardId, orientation: local.orientation, openedAt: local.openedAt }),
    });
    if (response.status === 409) return persist({ ...local, syncStatus: "conflict" });
    if (!response.ok) throw new Error("Sync unavailable");
    const server = await response.json() as DailyReceipt;
    if (server.assignedCardId !== local.assignedCardId) return persist({ ...local, syncStatus: "conflict" });
    return persist({ ...server, anonId: local.anonId, source: "server", syncStatus: "synced" });
  } catch { return persist({ ...local, syncStatus: local.syncStatus === "conflict" ? "conflict" : "pending" }); }
}
export async function getOrCreateDailyReceipt(featureType: DailyReceiptFeature, options: ReceiptOptions = {}): Promise<DailyReceipt> {
  if (authoritativeFeatures.has(featureType)) return authoritativeReceipt(featureType, options, false);
  const owner = options.anonId ?? getAnonId(); const day = options.dailyKey ?? getLocalDateString();
  const local = getCachedDailyReceipt(featureType, { ...options, anonId: owner, dailyKey: day });
  if (local?.openedAt) return local.syncStatus === "synced" ? local : syncDailyReceipt(local);
  try {
    const response = await apiFetch(apiUrl("/api/daily-receipts/get-or-create"), {
      method: "POST", headers: { "Content-Type": "application/json" }, signal: AbortSignal.timeout(10000),
      body: JSON.stringify({ anonId: owner, anonymousDeviceId: owner, featureType, dailyKey: day }),
    });
    if (!response.ok) throw new Error("Unavailable");
    // A reveal can finish while this assignment request is in flight.
    const revealed = getCachedDailyReceipt(featureType, { anonId: owner, dailyKey: day });
    if (revealed?.openedAt) return revealed;
    return persist({ ...await response.json(), anonId: owner, source: "server", syncStatus: "synced" });
  } catch { return makeFallbackReceipt(featureType, { ...options, anonId: owner, dailyKey: day }); }
}
export async function openDailyReceipt(featureType: DailyReceiptFeature, options: ReceiptOptions = {}): Promise<DailyReceipt> {
  if (authoritativeFeatures.has(featureType)) return authoritativeReceipt(featureType, options, true);
  const owner = options.anonId ?? getAnonId(); const day = options.dailyKey ?? getLocalDateString();
  const key = receiptKey(owner, featureType, day);
  const pending = requests.get(key); if (pending) return pending;
  const receipt = makeFallbackReceipt(featureType, { ...options, anonId: owner, dailyKey: day });
  // Freeze the displayed identity synchronously, before any network operation.
  const opened = persist({ ...receipt, openedAt: receipt.openedAt ?? new Date().toISOString(), syncStatus: "pending" });
  const work = syncDailyReceipt(opened).finally(() => requests.delete(key));
  requests.set(key, work);
  return work;
}
export async function syncPendingDailyReceipts() {
  const rows = new Map(readFallbackReceipts().map(row => [receiptKey(row.anonId, row.featureType, row.dailyKey), row]));
  for (const [key, row] of memory) rows.set(key, row);
  for (const row of rows.values()) if (!authoritativeFeatures.has(row.featureType) && row.anonId === getAnonId() && row.openedAt && row.syncStatus !== "synced") await syncDailyReceipt(row);
  await Promise.allSettled([...activeDailyFeatures].map(feature => getOrCreateDailyReceipt(feature)));
}
if (typeof window !== "undefined") window.addEventListener("online", () => {
  connectionGeneration++;
  void syncPendingDailyReceipts();
});

export function parseServerDailyKey(dailyKey: string): Date {
  return new Date(`${dailyKey}T12:00:00`);
}

export function subscribeToDailyReceiptFallbacks(onChange: () => void): () => void {
  window.addEventListener(FALLBACK_EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(FALLBACK_EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}
