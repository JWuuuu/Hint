import type { BirthProfile } from "../../types/astrology";
import { captureIdentityContext, getAnonId } from "../identity";
import { birthDetailsError, optionalBirthNumber, type BirthDetails } from "../birthDetails";

export const BIRTH_PROFILE_STORAGE_KEY = "hint.birthProfile"; // Legacy input, retained for recovery.
const canonicalKey = (owner: string) => `hint_birth_profile_v3:${owner}`;
const conflictKey = (owner: string) => `hint_birth_conflict_v3:${owner}`;
const deletedKey = (owner: string) => `hint_birth_deleted_v1:${owner}`;
export type AccountProfileLike = BirthDetails & { anonId?: string; createdAt?: string; updatedAt?: string };
function parseProfile(value: unknown): BirthProfile | null {
  if (!value || typeof value !== "object") return null;
  const row = value as Partial<BirthProfile>;
  if (!row.name || !row.birthDate) return null;
  const profile: BirthProfile = {
    id: row.id || getAnonId(), name: row.name, birthDate: row.birthDate,
    birthTime: row.birthTime || undefined, birthPlace: row.birthPlace || "",
    latitude: optionalBirthNumber(row.latitude), longitude: optionalBirthNumber(row.longitude),
    timezone: row.timezone || undefined, timezoneOffset: optionalBirthNumber(row.timezoneOffset),
    createdAt: row.createdAt || new Date().toISOString(), updatedAt: row.updatedAt || new Date().toISOString(),
  };
  return birthDetailsError(profile) ? null : profile;
}
function readJson(key: string): unknown {
  try { return JSON.parse(localStorage.getItem(key) ?? "null"); } catch { return null; }
}
export function getBirthProfileConflict(): { account: unknown; legacy: unknown } | null {
  try {
    const identity = captureIdentityContext();
    const result = readJson(conflictKey(identity.owner)) as { account: unknown; legacy: unknown } | null;
    identity.assertCurrent(); return result;
  } catch { return null; }
}
/** Repeatable migration: preserve both conflicting sources and never invent a winner. */
export function migrateBirthProfile(owner = getAnonId()): BirthProfile | null {
  let identity: ReturnType<typeof captureIdentityContext>;
  try { identity = captureIdentityContext(); if (identity.owner !== owner) return null; }
  catch { return null; }
  if (localStorage.getItem(deletedKey(owner))) return null;
  const current = parseProfile(readJson(canonicalKey(owner)));
  if (current) { try { identity.assertCurrent(); return current; } catch { return null; } }
  if (readJson(conflictKey(owner))) return null;
  const accountRaw = readJson(`hint_profile_v2_${owner}`);
  const claimedOwner = localStorage.getItem("hint_birth_legacy_owner_v3");
  const legacyRaw = !claimedOwner || claimedOwner === owner ? readJson(BIRTH_PROFILE_STORAGE_KEY) : null;
  const account = parseProfile(accountRaw);
  const legacy = parseProfile(legacyRaw);
  const fields = ["name", "birthDate", "birthTime", "birthPlace", "latitude", "longitude", "timezone", "timezoneOffset"] as const;
  const conflict = account && legacy && fields.some(key => account[key] != null && account[key] !== "" && legacy[key] != null && legacy[key] !== "" && account[key] !== legacy[key]);
  try {
    identity.assertCurrent();
    if (legacyRaw && !claimedOwner) localStorage.setItem("hint_birth_legacy_owner_v3", owner);
    if (conflict || accountRaw && !account || legacyRaw && !legacy) {
      localStorage.setItem(conflictKey(owner), JSON.stringify({ account: accountRaw, legacy: legacyRaw }));
      return null;
    }
    const profile = account || legacy;
    if (!profile) return null;
    const merged = { ...profile, id: owner };
    for (const key of fields) if ((merged[key] == null || merged[key] === "") && legacy?.[key] != null) Object.assign(merged, { [key]: legacy[key] });
    localStorage.setItem(canonicalKey(owner), JSON.stringify(merged));
    identity.assertCurrent();
    return merged;
  } catch { return null; }
}
export function readBirthProfile(): BirthProfile | null { return migrateBirthProfile(); }
export function saveBirthProfile(input: Omit<BirthProfile, "id" | "createdAt" | "updatedAt"> & Partial<Pick<BirthProfile, "id" | "createdAt">>): BirthProfile {
  const identity = captureIdentityContext();
  if (birthDetailsError(input)) throw new Error("Invalid birth details");
  const previous = readBirthProfile();
  const owner = identity.owner;
  const now = new Date().toISOString();
  const profile: BirthProfile = {
    ...input, id: owner, name: input.name.trim(), birthPlace: input.birthPlace.trim(),
    birthTime: input.birthTime || undefined, timezone: input.timezone?.trim() || undefined,
    createdAt: input.createdAt || previous?.createdAt || now, updatedAt: now,
  };
  identity.assertCurrent();
  localStorage.setItem(canonicalKey(owner), JSON.stringify(profile));
  // Explicitly saving a reviewed form resolves the conflict; the original backup remains recoverable.
  const conflict = localStorage.getItem(conflictKey(owner));
  if (conflict) {
    localStorage.setItem(`${conflictKey(owner)}:backup`, conflict);
    localStorage.removeItem(conflictKey(owner));
  }
  localStorage.setItem(`hint_profile_v2_${owner}`, JSON.stringify({ ...profile, anonId: owner }));
  localStorage.removeItem(deletedKey(owner));
  identity.assertCurrent();
  window.dispatchEvent(new CustomEvent("hint.birthProfile.updated", { detail: profile }));
  return profile;
}
export function clearBirthProfile() {
  const identity = captureIdentityContext();
  localStorage.setItem(deletedKey(identity.owner), "1");
  localStorage.removeItem(canonicalKey(identity.owner));
  localStorage.removeItem(`hint_profile_v2_${identity.owner}`);
  identity.assertCurrent();
  window.dispatchEvent(new CustomEvent("hint.birthProfile.updated"));
}
export function useBirthProfileStorageSnapshot() { return readBirthProfile(); }
export function saveBirthProfileFromAccountProfile(profile: AccountProfileLike, id?: string) {
  if (!profile.name?.trim() || !profile.birthDate || birthDetailsError(profile)) return null;
  const previous = readBirthProfile();
  const samePlace = previous?.birthPlace === (profile.birthPlace ?? "");
  const sameDate = previous?.birthDate === profile.birthDate;
  return saveBirthProfile({
    name: profile.name, birthDate: profile.birthDate, birthTime: profile.birthTime || undefined,
    birthPlace: profile.birthPlace || "",
    latitude: profile.latitude !== undefined ? profile.latitude ?? undefined : samePlace ? previous?.latitude : undefined,
    longitude: profile.longitude !== undefined ? profile.longitude ?? undefined : samePlace ? previous?.longitude : undefined,
    timezone: profile.timezone !== undefined ? profile.timezone || undefined : samePlace ? previous?.timezone : undefined,
    timezoneOffset: profile.timezoneOffset !== undefined ? profile.timezoneOffset ?? undefined : samePlace && sameDate ? previous?.timezoneOffset : undefined,
    createdAt: profile.createdAt || previous?.createdAt,
  });
}
export function birthProfileToProviderInput(profile: BirthProfile) {
  return { userId: profile.id, name: profile.name, birthday: profile.birthDate, birthTime: profile.birthTime,
    birthCity: profile.birthPlace, latitude: profile.latitude, longitude: profile.longitude,
    timezone: profile.timezone, timezoneOffset: profile.timezoneOffset };
}
