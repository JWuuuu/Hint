import type { AstroNatalResponse } from "@/lib/astro/astroClient";
import { normalizeClientNatal } from "@/lib/astro/normalizeClientAstro";
import { birthInputFingerprint } from "@/lib/birthDetails";
import { historyClearVersion } from "@/lib/clearHistory";
import type { BirthProfile, NatalChart } from "@/types/astrology";

export const CHART_SETTINGS = "astrologyapi:tropical:provider-default:v2";
export const natalCacheKey = (owner: string) =>
  `hint_astrology_natal_v3:${owner}`;
export const chartContext = (owner: string, profile: BirthProfile) =>
  `${owner}:${birthInputFingerprint(profile)}:${CHART_SETTINGS}`;
export type SavedChart = {
  clearVersion?: string;
  owner: string;
  fingerprint: string;
  settings: string;
  response: AstroNatalResponse;
  savedAt: string;
};

/** Rebuild from verified calculation data rather than trusting a cached presentation model. */
export function readChart(
  owner: string,
  profile: BirthProfile,
): NatalChart | null {
  try {
    const record = JSON.parse(
      localStorage.getItem(natalCacheKey(owner)) ?? "null",
    ) as SavedChart | null;
    if (
      !record ||
      record.owner !== owner ||
      (record.clearVersion ?? "") !== historyClearVersion(owner) ||
      record.fingerprint !== birthInputFingerprint(profile) ||
      record.settings !== CHART_SETTINGS
    )
      return null;
    const chart = normalizeClientNatal(profile, record.response);
    return chart?.placements.length ? chart : null;
  } catch {
    return null;
  }
}

export function storeChart(
  owner: string,
  profile: BirthProfile,
  response: AstroNatalResponse,
  clearVersion = historyClearVersion(owner),
): boolean {
  if (historyClearVersion(owner) !== clearVersion) return false;
  if (!normalizeClientNatal(profile, response)?.placements.length) return false;
  const record: SavedChart = {
    clearVersion,
    owner,
    fingerprint: birthInputFingerprint(profile),
    settings: CHART_SETTINGS,
    response,
    savedAt: new Date().toISOString(),
  };
  try {
    const value = JSON.stringify(record);
    localStorage.setItem(natalCacheKey(owner), value);
    if (historyClearVersion(owner) !== clearVersion) {
      if (localStorage.getItem(natalCacheKey(owner)) === value) localStorage.removeItem(natalCacheKey(owner));
      return false;
    }
    return localStorage.getItem(natalCacheKey(owner)) === value;
  } catch {
    return false;
  }
}

/** Email is not ownership evidence. Only owner-tagged, matching legacy records may migrate. */
export function migrateLegacyChart(
  owner: string,
  profile: BirthProfile,
  legacyAccountKey?: string,
): NatalChart | null {
  const current = readChart(owner, profile);
  if (current || !legacyAccountKey || historyClearVersion(owner)) return current;
  try {
    const raw = localStorage.getItem(
      `hint.astrology.savedNatalChart.v2:${legacyAccountKey}`,
    );
    if (!raw) return null;
    const old = JSON.parse(raw);
    if (
      old.accountKey !== legacyAccountKey ||
      old.profileId !== owner ||
      old.chart?.birthProfile?.id !== owner ||
      birthInputFingerprint(old.chart.birthProfile) !==
        birthInputFingerprint(profile)
    )
      return null;
    if (!storeChart(owner, profile, old.natalResponse)) return null;
    return readChart(owner, profile);
  } catch {
    return null;
  }
}

export type AstroTab =
  | "signs"
  | "chart"
  | "transits"
  | "birth"
  | "together"
  | "reports";
export type ChartSelection =
  | { kind: "body"; id: string }
  | { kind: "house"; id: string }
  | { kind: "aspect"; id: string };
export function readAstroLocation(search = window.location.search): {
  tab: AstroTab;
  sign: string | null;
  selection: ChartSelection | null;
} {
  const params = new URLSearchParams(search);
  const raw = params.get("tab");
  const tab =
    raw === "code"
      ? "signs"
      : raw === "today"
        ? "transits"
        : [
              "signs",
              "chart",
              "transits",
              "birth",
              "together",
              "reports",
            ].includes(raw ?? "")
          ? (raw as AstroTab)
          : "signs";
  const kind = (["body", "house", "aspect"] as const).find((key) =>
    params.has(key),
  );
  return {
    tab,
    sign: params.get("sign"),
    selection: kind ? { kind, id: params.get(kind)! } : null,
  };
}
export function writeAstroLocation(
  tab: AstroTab,
  sign?: string | null,
  selection?: ChartSelection | null,
  replace = false,
) {
  const url = new URL(window.location.href);
  for (const key of ["tab", "sign", "body", "house", "aspect", "person", "report"])
    url.searchParams.delete(key);
  url.searchParams.set("tab", tab);
  if (sign) url.searchParams.set("sign", sign);
  if (selection) url.searchParams.set(selection.kind, selection.id);
  window.history[replace ? "replaceState" : "pushState"](
    window.history.state,
    "",
    `${url.pathname}${url.search}${url.hash}`,
  );
}
