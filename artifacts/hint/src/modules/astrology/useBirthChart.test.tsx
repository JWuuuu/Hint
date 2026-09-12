// @vitest-environment jsdom
import { createElement, type PropsWithChildren } from "react";
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { useBirthChart } from "./useBirthChart";
import { natalCacheKey, readChart, storeChart } from "./chartState";
import type { BirthProfile } from "@/types/astrology";
import type { AstroNatalResponse } from "@/lib/astro/astroClient";

const state = vi.hoisted(() => ({ owner: "owner-a", identity: new AbortController(), natal: vi.fn(), legacy: vi.fn() }));
vi.mock("@/lib/identity", () => ({ getAnonId: () => state.owner, captureIdentityContext: () => {
  const owner = state.owner; const signal = state.identity.signal;
  return { owner, signal, assertCurrent: () => { signal.throwIfAborted(); if (state.owner !== owner) throw new DOMException("Changed", "AbortError"); } };
} }));
vi.mock("@/lib/astro/userBirthProfile", () => ({ getBirthProfileConflict: () => null }));
vi.mock("@/lib/astro/astroClient", () => ({ getNatalChart: (...args: unknown[]) => state.natal(...args) }));
vi.mock("@/lib/api", () => ({ apiUrl: (url: string) => url, apiFetch: (...args: unknown[]) => state.legacy(...args) }));
const profile: BirthProfile = { id: "owner-a", name: "Reader", birthDate: "2000-01-01", birthTime: "08:15", birthPlace: "Taipei", latitude: 25, longitude: 121.5, timezone: "Asia/Taipei", timezoneOffset: 8, createdAt: "2026-09-10", updatedAt: "2026-09-10" };
const response: AstroNatalResponse = { source: "astrologyapi", mode: "live", cached: false, fetchedAt: "2026-09-10T12:00:00Z", profileHash: "same-shared-chart", calculation: { zodiacSystem: "tropical", requestedHouseSystem: "placidus", houseSystem: null, returned: { placements: 1, houses: 0, aspects: 0 } }, chart: { placements: [{ body: "sun", sign: "capricorn", degree: 10 }], houses: [], aspects: [], elementBalance: {}, modalityBalance: {} } };
const clients: QueryClient[] = [];
function setup(initial = profile) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } }); clients.push(client);
  const wrapper = ({ children }: PropsWithChildren) => createElement(QueryClientProvider, { client }, children);
  return renderHook(({ owner, details }) => useBirthChart(owner, details), { wrapper, initialProps: { owner: initial.id, details: initial } });
}
beforeEach(() => {
  localStorage.clear(); state.owner = "owner-a"; state.identity = new AbortController();
  state.natal.mockReset(); state.legacy.mockReset();
  state.natal.mockRejectedValue(new Error("Offline")); state.legacy.mockRejectedValue(new Error("Offline"));
});
afterEach(() => { cleanup(); clients.splice(0).forEach(client => client.clear()); vi.restoreAllMocks(); });

it("reuses My Chart's verified device cache offline without email or a second endpoint request", async () => {
  storeChart(profile.id, profile, response);
  const hook = setup();
  await waitFor(() => expect(hook.result.current.chart?.sunSign).toBe("capricorn"));
  expect(hook.result.current.chart?.calculatedAt).toBe(response.fetchedAt);
  expect(hook.result.current.chart?.moonSign).toBeUndefined();
  expect(state.natal).not.toHaveBeenCalled(); expect(state.legacy).not.toHaveBeenCalled();
});
it.each([{ birthTime: undefined }, { timezoneOffset: undefined }, { latitude: undefined }])("does not request a personal chart with unknown required data %j", missing => {
  const hook = setup({ ...profile, ...missing });
  expect(hook.result.current.chart).toBeNull();
  expect(state.natal).not.toHaveBeenCalled(); expect(state.legacy).not.toHaveBeenCalled();
});
it("uses one canonical calculation and shares only returned data and metadata back to My Chart", async () => {
  state.natal.mockResolvedValue(response);
  const hook = setup();
  await waitFor(() => expect(hook.result.current.chart?.sunSign).toBe("capricorn"));
  expect(state.natal).toHaveBeenCalledOnce(); expect(state.legacy).not.toHaveBeenCalled();
  expect(hook.result.current.chart?.calculation).toEqual(response.calculation);
  expect(hook.result.current.chart?.risingSign).toBeUndefined();
  expect(hook.result.current.chart?.dominantElement).toBeUndefined();
  expect(hook.result.current.chart?.moonPhase).toBeUndefined();
  expect(hook.result.current.chart?.natalWheel).toBeUndefined();
  expect(hook.result.current.chart?.houses).toEqual([]);
  expect(hook.result.current.storageStatus).toBe("local");
  expect(readChart(profile.id, profile)?.id).toBe("same-shared-chart");
});
it("updates a display name without another calculation and refreshes only on explicit request", async () => {
  storeChart(profile.id, profile, response);
  const hook = setup();
  hook.rerender({ owner: profile.id, details: { ...profile, name: "Renamed reader" } });
  expect(hook.result.current.chart?.input.name).toBe("Renamed reader");
  expect(state.natal).not.toHaveBeenCalled();
  state.natal.mockResolvedValue({ ...response, fetchedAt: "2026-09-11T12:00:00Z" });
  await act(async () => { await hook.result.current.recalculate(); });
  expect(state.natal).toHaveBeenCalledOnce();
  await waitFor(() => expect(hook.result.current.chart?.calculatedAt).toBe("2026-09-11T12:00:00Z"));
});
it("adopts a newer shared chart without letting an older query cache override it", async () => {
  storeChart(profile.id, profile, response);
  const hook = setup();
  expect(hook.result.current.chart?.sunSign).toBe("capricorn");
  act(() => {
    storeChart(profile.id, profile, { ...response, fetchedAt: "2026-09-11T12:00:00Z", chart: { ...response.chart!, placements: [{ body: "sun", sign: "aquarius", degree: 3 }] } });
    window.dispatchEvent(new Event("storage"));
  });
  expect(hook.result.current.chart?.sunSign).toBe("aquarius");
  expect(state.natal).not.toHaveBeenCalled();
});
it("aborts and rejects a late result when calculation inputs change", async () => {
  let finish!: (value: AstroNatalResponse) => void;
  state.natal.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; })).mockImplementation(() => new Promise(() => {}));
  const hook = setup();
  await waitFor(() => expect(state.natal).toHaveBeenCalledOnce());
  const signal = state.natal.mock.calls[0][1] as AbortSignal;
  hook.rerender({ owner: profile.id, details: { ...profile, birthTime: "09:00" } });
  await waitFor(() => expect(signal.aborted).toBe(true));
  await act(async () => finish(response));
  expect(hook.result.current.chart).toBeNull();
  expect(localStorage.getItem(natalCacheKey(profile.id))).toBeNull();
});
it("aborts an old owner's response and never adopts their chart for the next owner", async () => {
  let finish!: (value: AstroNatalResponse) => void;
  state.natal.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; })).mockImplementation(() => new Promise(() => {}));
  const hook = setup();
  await waitFor(() => expect(state.natal).toHaveBeenCalledOnce());
  const signal = state.natal.mock.calls[0][1] as AbortSignal;
  act(() => { state.identity.abort(); state.identity = new AbortController(); state.owner = "owner-b"; window.dispatchEvent(new Event("hint:identity-changed")); });
  hook.rerender({ owner: "owner-b", details: { ...profile, id: "owner-b" } });
  expect(signal.aborted).toBe(true);
  await act(async () => finish(response));
  expect(hook.result.current.chart).toBeNull();
  expect(localStorage.getItem(natalCacheKey("owner-a"))).toBeNull(); expect(localStorage.getItem(natalCacheKey("owner-b"))).toBeNull();
});
function markCleared() {
  localStorage.setItem(`hint_history_clear_version_v1:${profile.id}`, "new-history-generation");
  localStorage.removeItem(natalCacheKey(profile.id));
  window.dispatchEvent(new Event("storage"));
}
it("clears an open chart without recreating it until an explicit recalculation", async () => {
  storeChart(profile.id, profile, response);
  const hook = setup();
  expect(hook.result.current.chart).not.toBeNull();
  act(markCleared);
  expect(hook.result.current.chart).toBeNull();
  expect(state.natal).not.toHaveBeenCalled();
  state.natal.mockResolvedValue(response);
  await act(async () => { await hook.result.current.recalculate(); });
  expect(state.natal).toHaveBeenCalledOnce();
  expect(readChart(profile.id, profile)?.id).toBe(response.profileHash);
});
it("does not resurrect a request that finishes after history deletion", async () => {
  let finish!: (value: AstroNatalResponse) => void;
  state.natal.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
  const hook = setup();
  await waitFor(() => expect(state.natal).toHaveBeenCalledOnce());
  const signal = state.natal.mock.calls[0][1] as AbortSignal;
  act(markCleared);
  expect(signal.aborted).toBe(true);
  await act(async () => finish(response));
  expect(hook.result.current.chart).toBeNull();
  expect(localStorage.getItem(natalCacheKey(profile.id))).toBeNull();
  expect(state.natal).toHaveBeenCalledOnce();
});
it("rejects a clear that arrives during cache persistence before publishing the chart", async () => {
  state.natal.mockResolvedValue(response);
  const original = Storage.prototype.setItem;
  vi.spyOn(Storage.prototype, "setItem").mockImplementation(function(this: Storage, key, value) {
    original.call(this, key, value);
    if (key === natalCacheKey(profile.id)) original.call(this, `hint_history_clear_version_v1:${profile.id}`, "concurrent-clear");
  });
  const hook = setup();
  await waitFor(() => expect(localStorage.getItem(`hint_history_clear_version_v1:${profile.id}`)).toBe("concurrent-clear"));
  await waitFor(() => expect(hook.result.current.isLoading).toBe(false));
  expect(hook.result.current.chart).toBeNull();
  expect(readChart(profile.id, profile)).toBeNull();
  expect(clients.at(-1)!.getQueriesData({ queryKey: ["verified-birth-chart"] }).every(([, data]) => data === undefined)).toBe(true);
});
it("aborts an unmounted calculation and does not persist its late response", async () => {
  let finish!: (value: AstroNatalResponse) => void;
  state.natal.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
  const hook = setup();
  await waitFor(() => expect(state.natal).toHaveBeenCalledOnce());
  const signal = state.natal.mock.calls[0][1] as AbortSignal;
  hook.unmount(); expect(signal.aborted).toBe(true);
  await act(async () => finish(response));
  expect(localStorage.getItem(natalCacheKey(profile.id))).toBeNull();
});
it("keeps a result in memory when storage is full without claiming it was saved", async () => {
  state.natal.mockResolvedValue(response);
  vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new DOMException("Full", "QuotaExceededError"); });
  const hook = setup();
  await waitFor(() => expect(hook.result.current.chart?.sunSign).toBe("capricorn"));
  expect(hook.result.current.storageStatus).toBe("memory");
  expect(localStorage.getItem(natalCacheKey(profile.id))).toBeNull();
});
it("rejects a fallback personal calculation and preserves the verified cached chart on refresh failure", async () => {
  storeChart(profile.id, profile, response);
  state.natal.mockResolvedValue({ ...response, source: "fallback", mode: "fallback" });
  const hook = setup();
  await act(async () => { await hook.result.current.recalculate(); });
  await waitFor(() => expect(hook.result.current.error).toContain("not available"));
  expect(hook.result.current.chart?.sunSign).toBe("capricorn");
  expect(readChart(profile.id, profile)?.mode).toBe("live");
});
