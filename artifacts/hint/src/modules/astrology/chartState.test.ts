// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { BirthProfile } from "@/types/astrology";
import type { AstroNatalResponse } from "@/lib/astro/astroClient";
import { birthInputFingerprint } from "@/lib/birthDetails";
import { CHART_SETTINGS, chartContext, migrateLegacyChart, natalCacheKey, readAstroLocation, readChart, storeChart, writeAstroLocation } from "./chartState";

const profile: BirthProfile = { id: "owner-a", name: "Reader", birthDate: "2000-01-01", birthTime: "08:15", birthPlace: "Taipei", latitude: 25, longitude: 121.5, timezone: "Asia/Taipei", timezoneOffset: 8, createdAt: "2026-09-10", updatedAt: "2026-09-10" };
const response: AstroNatalResponse = { source: "astrologyapi", mode: "live", cached: false, fetchedAt: "2026-09-10T12:00:00Z", profileHash: "verified-fixture", chart: { placements: [{ body: "sun", sign: "capricorn", degree: 10 }], houses: [], aspects: [], elementBalance: {}, modalityBalance: {} } };
beforeEach(() => { localStorage.clear(); window.history.replaceState({}, "", "/app/astrology"); vi.restoreAllMocks(); });

describe("owner-bound natal chart cache", () => {
  it("stores and restores without an email or account label", () => {
    expect(storeChart(profile.id, profile, response)).toBe(true);
    expect(migrateLegacyChart(profile.id, profile)?.id).toBe("verified-fixture");
    expect(readChart("another-owner", profile)).toBeNull();
  });
  it.each([
    { birthDate: "2000-01-02" }, { birthTime: "09:15" }, { birthPlace: "Tokyo" },
    { latitude: 24 }, { longitude: 122 }, { timezoneOffset: 9 }, { timezone: "Asia/Tokyo" },
  ])("does not reuse positions after changing calculation input %j", patch => {
    storeChart(profile.id, profile, response);
    expect(readChart(profile.id, { ...profile, ...patch })).toBeNull();
    expect(chartContext(profile.id, { ...profile, ...patch })).not.toBe(chartContext(profile.id, profile));
  });
  it("keeps calculated positions on a name-only edit while using the new name", () => {
    storeChart(profile.id, profile, response);
    expect(readChart(profile.id, { ...profile, name: "New label" })?.birthProfile.name).toBe("New label");
  });
  it.each([
    { ...response, source: "fallback" as const, mode: "fallback" as const },
    { ...response, source: "validation" as const, mode: "partial" as const },
    { ...response, chart: { ...response.chart!, placements: [] } },
  ])("does not persist a fallback, partial or empty personal result", result => {
    expect(storeChart(profile.id, profile, result)).toBe(false);
    expect(localStorage.getItem(natalCacheKey(profile.id))).toBeNull();
  });
  it("rejects a malformed or empty cached result instead of showing a ready chart", () => {
    localStorage.setItem(natalCacheKey(profile.id), "invalid");
    expect(readChart(profile.id, profile)).toBeNull();
    localStorage.setItem(natalCacheKey(profile.id), JSON.stringify({ owner: profile.id, fingerprint: birthInputFingerprint(profile), settings: CHART_SETTINGS, response: { ...response, chart: { ...response.chart!, placements: [] } } }));
    expect(readChart(profile.id, profile)).toBeNull();
  });
  it("reports storage failure while leaving an existing valid record untouched", () => {
    storeChart(profile.id, profile, response);
    const saved = localStorage.getItem(natalCacheKey(profile.id));
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new DOMException("Full", "QuotaExceededError"); });
    expect(storeChart(profile.id, profile, { ...response, profileHash: "new" })).toBe(false);
    expect(localStorage.getItem(natalCacheKey(profile.id))).toBe(saved);
  });
  it("does not use matching email alone to claim a legacy chart", () => {
    const account = "reader@example.test";
    const key = `hint.astrology.savedNatalChart.v2:${account}`;
    localStorage.setItem(key, JSON.stringify({ accountKey: account, profileId: "another-owner", chart: { birthProfile: profile }, natalResponse: response }));
    expect(migrateLegacyChart(profile.id, profile, account)).toBeNull();
    expect(localStorage.getItem(key)).not.toBeNull();
    localStorage.setItem(key, JSON.stringify({ accountKey: account, profileId: profile.id, chart: { birthProfile: profile }, natalResponse: response }));
    expect(migrateLegacyChart(profile.id, profile, account)?.id).toBe("verified-fixture");
    expect(localStorage.getItem(key)).not.toBeNull();
  });
});
describe("Astrology location state", () => {
  it("supports old aliases and keeps detail selection in direct links", () => {
    expect(readAstroLocation("?tab=code").tab).toBe("signs");
    expect(readAstroLocation("?tab=today").tab).toBe("transits");
    expect(readAstroLocation("?tab=chart&body=moon")).toEqual({ tab: "chart", sign: null, selection: { kind: "body", id: "moon" } });
  });
  it("replaces stale selectors without removing unrelated query state or the hosted path", () => {
    window.history.replaceState({}, "", "/beta/app/astrology?tab=chart&body=moon&house=2&preview=embedded#detail");
    writeAstroLocation("signs", "aries");
    expect(window.location.pathname).toBe("/beta/app/astrology");
    expect(window.location.hash).toBe("#detail");
    expect(window.location.search).toBe("?preview=embedded&tab=signs&sign=aries");
  });
});

it('rejects an old response when another tab clears between the cache check and write', () => {
  const originalSet = Storage.prototype.setItem;
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function(key, value) {
    if (key === natalCacheKey(profile.id)) originalSet.call(this, `hint_history_clear_version_v1:${profile.id}`, 'cleared-in-other-tab');
    originalSet.call(this, key, value);
  });
  expect(storeChart(profile.id, profile, response, '')).toBe(false);
  expect(readChart(profile.id, profile)).toBeNull();
  expect(localStorage.getItem(natalCacheKey(profile.id))).toBeNull();
});
it('never re-adopts a legacy result after clear, and accepts an explicit new calculation', () => {
  const key = 'reader@example.test';
  localStorage.setItem(`hint.astrology.savedNatalChart.v2:${key}`, JSON.stringify({ accountKey:key, profileId:profile.id, chart:{birthProfile:profile}, natalResponse:response }));
  localStorage.setItem(`hint_history_clear_version_v1:${profile.id}`, 'clear-v1');
  expect(migrateLegacyChart(profile.id, profile, key)).toBeNull();
  expect(storeChart(profile.id, profile, response, '')).toBe(false);
  expect(storeChart(profile.id, profile, response, 'clear-v1')).toBe(true);
  expect(readChart(profile.id, profile)?.id).toBe('verified-fixture');
});
