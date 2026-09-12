/**
 * Anonymous per-user identity. Hint has no login — each browser gets a
 * stable random id stored in localStorage, used to scope the user's profile,
 * daily pulls, journals, and readings.
 */

import { withIdentityLock } from "./identityLock";

const STORAGE_KEY = "hint_anon_id";
const CHANNEL_NAME = "hint.identity.v1";
const TRANSITION_KEY = "hint_identity_transition_v1";
const GENERATION_KEY = "hint_identity_generation_v1";

let cached: string | null = null;
let cachedGeneration: string | null = null;
let ownership = new AbortController();
let coordinationChannel: BroadcastChannel | null = null;
let stopCoordination: (() => void) | null = null;

/** Run before mounting readers so two fresh tabs cannot choose different owners. */
export async function initializeLocalIdentity(): Promise<string> {
  try { return await withIdentityLock(() => { recoverInterruptedSwitch(); return getAnonId(); }); }
  catch (error) {
    // Never mount readers over a partially copied account. An unavailable
    // coordinator is otherwise still compatible with local-only use.
    if (localStorage.getItem(TRANSITION_KEY)) throw error;
    return getAnonId();
  }
}
const PROFILE_INDEX_KEY = "hint_local_profile_index_v1";
const PROFILE_GLOBAL_KEYS = ["hint_local_auth_v1", "hint_onboarding_complete_v3", "hint_onboarding_preferences_v1", "hint_onboarding_skipped"] as const;
type ProfileNamespace = { id: string; label: string; values: Record<string, string | null>; activeTarot: string | null; activeTarotLocal?: string | null };
export const localAccountStorageKey = (owner: string) => `hint_local_auth_v2:${owner}`;
type IdentityTransition = { version: 1; previous: ProfileNamespace; previousIndex: string | null };

function restoreNamespace(snapshot: ProfileNamespace, restoreSession: boolean): void {
  for (const key of PROFILE_GLOBAL_KEYS) {
    const value = snapshot.values[key];
    if (value == null) localStorage.removeItem(key); else localStorage.setItem(key, value);
  }
  if (!restoreSession || snapshot.activeTarot == null) sessionStorage.removeItem("hint_active_tarot_reading_v1");
  else sessionStorage.setItem("hint_active_tarot_reading_v1", snapshot.activeTarot);
  if (snapshot.activeTarotLocal == null) localStorage.removeItem("hint_active_tarot_reading_v1");
  else localStorage.setItem("hint_active_tarot_reading_v1", snapshot.activeTarotLocal);
  localStorage.setItem(STORAGE_KEY, snapshot.id);
}

function rollbackTransition(record: IdentityTransition, restoreSession: boolean): void {
  restoreNamespace(record.previous, restoreSession);
  if (record.previousIndex == null) localStorage.removeItem(PROFILE_INDEX_KEY);
  else localStorage.setItem(PROFILE_INDEX_KEY, record.previousIndex);
  const generation = crypto.randomUUID();
  localStorage.setItem(GENERATION_KEY, generation);
  // Removing the journal is the commit point. If restoration fails, it stays
  // intact for a later retry and every reader remains fenced.
  localStorage.removeItem(TRANSITION_KEY);
  cached = record.previous.id; cachedGeneration = generation;
  ownership.abort(new DOMException("Local profile changed", "AbortError"));
  ownership = new AbortController();
}

function recoverInterruptedSwitch(): void {
  const raw = localStorage.getItem(TRANSITION_KEY);
  if (!raw) return;
  const record = JSON.parse(raw) as IdentityTransition;
  if (record?.version !== 1 || typeof record.previous?.id !== "string" || !record.previous.id || typeof record.previous.label !== "string" || !record.previous.values ||
      !PROFILE_GLOBAL_KEYS.every(key => Object.hasOwn(record.previous.values, key) && (record.previous.values[key] === null || typeof record.previous.values[key] === "string")) ||
      !(record.previous.activeTarot === null || typeof record.previous.activeTarot === "string") ||
      !(record.previous.activeTarotLocal === null || typeof record.previous.activeTarotLocal === "string") ||
      (record.previousIndex !== null && (typeof record.previousIndex !== "string" || !Array.isArray(JSON.parse(record.previousIndex))))) {
    throw new Error("Local profile recovery is unavailable");
  }
  // A new realm cannot assume the interrupted tab's sessionStorage belongs to
  // it. The durable recovery copy is restored; its own session copy is cleared.
  rollbackTransition(record, false);
}

function readProfileIndex(): ProfileNamespace[] {
  const rows = JSON.parse(localStorage.getItem(PROFILE_INDEX_KEY) || "[]");
  return Array.isArray(rows) ? rows.filter(row => typeof row?.id === "string" && typeof row.label === "string" && row.values && typeof row.values === "object") : [];
}
function currentNamespace(): ProfileNamespace {
  const id = getAnonId();
  assertCurrentIdentity(id);
  const accountRaw = localStorage.getItem(localAccountStorageKey(id)) ?? localStorage.getItem("hint_local_auth_v1");
  const account = JSON.parse(accountRaw || "null");
  const profile = JSON.parse(localStorage.getItem(`hint_profile_v2_${id}`) || "null");
  const result = { id, label: account?.name || profile?.name || account?.identifier || "", values: Object.fromEntries(PROFILE_GLOBAL_KEYS.map(key => [key, key === "hint_local_auth_v1" ? accountRaw : localStorage.getItem(key)])), activeTarot: sessionStorage.getItem("hint_active_tarot_reading_v1"), activeTarotLocal: localStorage.getItem("hint_active_tarot_reading_v1") };
  assertCurrentIdentity(id);
  return result;
}
export function listLocalProfiles(): Array<{ id: string; label: string; current: boolean }> {
  try {
    const current = currentNamespace();
    return [current, ...readProfileIndex().filter(row => row.id !== current.id)].map(row => ({ id: row.id, label: row.label, current: row.id === current.id }));
  } catch { return []; }
}
/** Explicit device-local namespace selection. Email never identifies a server owner. */
export async function switchLocalProfile(targetId?: string): Promise<string> {
  const expectedOwner = getAnonId();
  return withIdentityLock(() => {
    assertCurrentIdentity(expectedOwner);
    const current = currentNamespace();
    const previousIndex = readProfileIndex();
    const next: ProfileNamespace = targetId
      ? previousIndex.find(row => row.id === targetId) ?? (() => { throw new Error("Unknown local profile"); })()
      : { id: crypto.randomUUID(), label: "", values: {}, activeTarot: null, activeTarotLocal: null };
    if (next.id === current.id) return next.id;
    const index = [current, ...previousIndex.filter(row => row.id !== current.id && row.id !== next.id), next];
    const oldIndex = localStorage.getItem(PROFILE_INDEX_KEY);
    const transition: IdentityTransition = { version: 1, previous: current, previousIndex: oldIndex };
    // Publish the fence before changing any shared slots. The journal is also
    // sufficient to roll back a crash without guessing which owner committed.
    localStorage.setItem(TRANSITION_KEY, JSON.stringify(transition));
    ownership.abort(new DOMException("Local profile changed", "AbortError"));
    try {
      const generation = crypto.randomUUID();
      localStorage.setItem(GENERATION_KEY, generation);
      localStorage.setItem(PROFILE_INDEX_KEY, JSON.stringify(index));
      // Protect old global quiz/birth data from first-use adoption by the new owner.
      if (!localStorage.getItem("hint_personality_legacy_owner_v3")) localStorage.setItem("hint_personality_legacy_owner_v3", current.id);
      if (!localStorage.getItem("hint_birth_legacy_owner_v3")) localStorage.setItem("hint_birth_legacy_owner_v3", current.id);
      for (const key of PROFILE_GLOBAL_KEYS) {
        const value = next.values[key];
        if (value == null) localStorage.removeItem(key); else localStorage.setItem(key, value);
      }
      if (next.activeTarot == null) sessionStorage.removeItem("hint_active_tarot_reading_v1");
      else sessionStorage.setItem("hint_active_tarot_reading_v1", next.activeTarot);
      if (next.activeTarotLocal == null) localStorage.removeItem("hint_active_tarot_reading_v1");
      else localStorage.setItem("hint_active_tarot_reading_v1", next.activeTarotLocal);
      localStorage.setItem(STORAGE_KEY, next.id);
      localStorage.removeItem(TRANSITION_KEY);
      cached = next.id; cachedGeneration = generation;
    } catch (error) {
      // Roll back selection if any storage operation fails; owned data is untouched.
      try {
        rollbackTransition(transition, true);
      } catch { /* The durable journal remains; no reader may adopt a partial account. */ }
      throw error;
    }
    ownership.abort(new DOMException("Local profile changed", "AbortError"));
    ownership = new AbortController();
    window.dispatchEvent(new Event("hint:identity-changed"));
    try { coordinationChannel?.postMessage({ type: "identity-changed" }); }
    catch { /* Other contexts still receive the committed localStorage event. */ }
    return next.id;
  });
}

/** Captured work must never become work for whichever profile is selected later. */
export function assertCurrentIdentity(owner: string): void {
  if (localStorage.getItem(TRANSITION_KEY) || localStorage.getItem(STORAGE_KEY) !== owner ||
      (localStorage.getItem(GENERATION_KEY) ?? "") !== (cachedGeneration ?? "")) {
    throw new DOMException("Local profile changed", "AbortError");
  }
}

export function captureIdentityContext() {
  const owner = getAnonId();
  const generation = cachedGeneration;
  const signal = ownership.signal;
  const assertCurrent = () => {
    if (signal.aborted) throw signal.reason ?? new DOMException("Local profile changed", "AbortError");
    assertCurrentIdentity(owner);
    if (generation !== cachedGeneration) throw new DOMException("Local profile changed", "AbortError");
  };
  assertCurrent();
  return { owner, signal, assertCurrent };
}

/** Reload captured-owner hooks together after another browsing context switches. */
export function startIdentityCoordination(onExternalChange = () => window.location.reload()): () => void {
  if (stopCoordination) return stopCoordination;
  const owner = getAnonId();
  const generation = cachedGeneration;
  let handled = false;
  const check = () => {
    if (handled) return;
    let current: string | null;
    try {
      current = localStorage.getItem(STORAGE_KEY);
      if (current === owner && !localStorage.getItem(TRANSITION_KEY) && (localStorage.getItem(GENERATION_KEY) ?? "") === generation) return;
    } catch { return; }
    handled = true;
    ownership.abort(new DOMException("Local profile changed", "AbortError"));
    // A different tab's sessionStorage still holds the old profile's recovery
    // view. The selected profile's durable recovery copy is already restored.
    try { sessionStorage.removeItem("hint_active_tarot_reading_v1"); } catch { /* Reload still fences the old owner. */ }
    onExternalChange();
  };
  const storage = (event: StorageEvent) => { if (event.key === STORAGE_KEY || event.key === TRANSITION_KEY || event.key === GENERATION_KEY || event.key === null) check(); };
  const visible = () => { if (document.visibilityState === "visible") check(); };
  window.addEventListener("storage", storage);
  window.addEventListener("pageshow", check);
  document.addEventListener("visibilitychange", visible);
  try {
    if (typeof BroadcastChannel !== "undefined") {
      coordinationChannel = new BroadcastChannel(CHANNEL_NAME);
      coordinationChannel.onmessage = check;
    }
  } catch { /* Storage events remain the notification fallback. */ }
  stopCoordination = () => {
    window.removeEventListener("storage", storage);
    window.removeEventListener("pageshow", check);
    document.removeEventListener("visibilitychange", visible);
    coordinationChannel?.close(); coordinationChannel = null;
    stopCoordination = null;
  };
  return stopCoordination;
}

export function getAnonId(): string {
  if (cached) return cached;

  let id: string | null = null;
  try {
    id = localStorage.getItem(STORAGE_KEY);
    cachedGeneration = localStorage.getItem(GENERATION_KEY) ?? "";
  } catch {
    // localStorage unavailable (private mode, etc.) — fall through to a fresh id.
  }

  if (!id) {
    id =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `anon-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    try {
      localStorage.setItem(STORAGE_KEY, id);
    } catch {
      // Ignore write failures; the id still lives for this session via cache.
    }
  }

  cached = id;
  return id;
}

/**
 * Onboarding can be deferred — a returning visitor who chose "later" should not
 * be stopped at the identity ritual every time. We remember that choice locally.
 */
const ONBOARDING_SKIPPED_KEY = "hint_onboarding_skipped";

export function hasSkippedOnboarding(): boolean {
  try {
    return localStorage.getItem(ONBOARDING_SKIPPED_KEY) === "1";
  } catch {
    return false;
  }
}

export function setOnboardingSkipped(): void {
  try {
    localStorage.setItem(ONBOARDING_SKIPPED_KEY, "1");
  } catch {
    // Ignore write failures — they'll just see the ritual again next time.
  }
}

/** Today's date in the user's local timezone as YYYY-MM-DD. */
export function getLocalDateString(date: Date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}
