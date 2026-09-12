// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { PropsWithChildren } from "react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { BirthProfile, NatalChart, AstroTransitsResponse } from "@/types/astrology";
import type { AstroNatalResponse } from "@/lib/astro/astroClient";
import { AstrologyView } from "./AstrologyView";
import { natalCacheKey, storeChart } from "../astrology/chartState";

const mocks = vi.hoisted(() => ({ owner: "owner-a", identity: new AbortController(), natal: vi.fn(), transits: vi.fn() }));
vi.mock("@/lib/identity", () => ({
  getAnonId: () => mocks.owner,
  captureIdentityContext: () => {
    const owner = mocks.owner; const signal = mocks.identity.signal;
    return { owner, signal, assertCurrent: () => { signal.throwIfAborted(); if (mocks.owner !== owner) throw new DOMException("Changed", "AbortError"); } };
  },
}));
vi.mock("@/lib/auth", () => ({ useLocalAccount: () => null }));
vi.mock("@/lib/i18n", async importOriginal => ({
  ...await importOriginal<typeof import("@/lib/i18n")>(),
  useLanguage: () => ({ language: "en", t: (key: string) => key }),
}));
vi.mock("@/lib/motionPolicy", () => ({ useMotionPolicy: () => ({ reduced: true, pageVisible: true }) }));
vi.mock("@/lib/astro/astroClient", () => ({ getNatalChart: (...args: unknown[]) => mocks.natal(...args), getTransits: (...args: unknown[]) => mocks.transits(...args) }));
vi.mock("@/components/app/AppChrome", async importOriginal => ({
  ...await importOriginal<typeof import("@/components/app/AppChrome")>(),
  AppScreen: ({ children }: PropsWithChildren) => <main>{children}</main>,
}));
vi.mock("@/components/astro/BirthProfileForm", () => ({ BirthProfileForm: () => <div data-testid="birth-form" /> }));
vi.mock("../astrology/components/TogetherReading", () => ({ TogetherReading: () => <div /> }));
vi.mock("../astrology/components/AstrologyGuide", () => ({
  AstrologyOrientation: () => <h1>Astrology</h1>,
  AstroPanel: ({ children, title }: PropsWithChildren<{ title: string }>) => <section><h2>{title}</h2>{children}</section>,
  ZodiacGuide: () => <div data-testid="zodiac-guide" />,
  NatalReading: ({ chart, refreshing, onRefresh, error }: { chart: NatalChart; refreshing: boolean; onRefresh: () => void; error: string }) => <section data-testid="personal-chart"><p>{chart.id}</p><button disabled={refreshing} onClick={onRefresh}>Recalculate</button>{refreshing && <p role="status">Calculating</p>}{error && <p role="alert">{error}</p>}</section>,
  TransitReading: ({ transits, loading, onRange }: { transits: AstroTransitsResponse | null; loading: boolean; onRange: (value: "daily" | "weekly") => void }) => <section data-testid="personal-transits"><p>{transits?.date || "No transits"}</p>{loading && <p role="status">Loading transits</p>}<button onClick={() => onRange("weekly")}>This week</button></section>,
}));
const profile: BirthProfile = { id: "owner-a", name: "Reader", birthDate: "2000-01-01", birthTime: "08:15", birthPlace: "Taipei", latitude: 25, longitude: 121.5, timezone: "Asia/Taipei", timezoneOffset: 8, createdAt: "2026-09-10", updatedAt: "2026-09-10" };
const response: AstroNatalResponse = { source: "astrologyapi", mode: "live", cached: false, fetchedAt: "2026-09-10T12:00:00Z", profileHash: "verified-chart", chart: { placements: [{ body: "sun", sign: "capricorn", degree: 10 }], houses: [], aspects: [], elementBalance: {}, modalityBalance: {} } };
const seed = (input: BirthProfile) => localStorage.setItem(`hint_birth_profile_v3:${input.id}`, JSON.stringify(input));
beforeEach(() => {
  localStorage.clear(); sessionStorage.clear(); mocks.owner = "owner-a"; mocks.identity = new AbortController();
  mocks.natal.mockReset(); mocks.transits.mockReset();
  mocks.natal.mockImplementation(() => new Promise(() => {})); mocks.transits.mockImplementation(() => new Promise(() => {}));
  window.history.replaceState({}, "", "/app/astrology?tab=chart");
  vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => { callback(0); return 0; });
  HTMLElement.prototype.scrollIntoView = vi.fn();
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

it("calculates and restores an owner-bound chart without requiring email", async () => {
  seed(profile); mocks.natal.mockResolvedValue(response);
  const page = render(<AstrologyView />);
  await waitFor(() => expect(screen.getByTestId("personal-chart").textContent).toContain("verified-chart"));
  expect(mocks.natal).toHaveBeenCalledTimes(1);
  expect(localStorage.getItem(natalCacheKey(profile.id))).not.toBeNull();
  page.unmount(); render(<AstrologyView />);
  expect(screen.getByTestId("personal-chart").textContent).toContain("verified-chart");
  expect(mocks.natal).toHaveBeenCalledTimes(1);
});
it("keeps unknown time unknown and does not request a personal chart", () => {
  seed({ ...profile, birthTime: undefined }); render(<AstrologyView />);
  expect(mocks.natal).not.toHaveBeenCalled();
  expect(screen.queryByTestId("personal-chart")).toBeNull();
  expect(screen.getByText(/Time unknown\?/)).toBeTruthy();
});
it("rejects old birth results after the saved birth inputs change", async () => {
  seed(profile); let finish!: (value: AstroNatalResponse) => void;
  mocks.natal.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
  render(<AstrologyView />);
  await waitFor(() => expect(mocks.natal).toHaveBeenCalledTimes(1));
  const signal = mocks.natal.mock.calls[0]![1] as AbortSignal;
  act(() => { seed({ ...profile, birthDate: "2001-01-01" }); window.dispatchEvent(new Event("hint.birthProfile.updated")); });
  expect(signal.aborted).toBe(true);
  await act(async () => finish(response));
  expect(screen.queryByTestId("personal-chart")).toBeNull();
  expect(localStorage.getItem(natalCacheKey(profile.id))).toBeNull();
});
it("rejects an old owner's response after identity cancellation", async () => {
  seed(profile); let finish!: (value: AstroNatalResponse) => void;
  mocks.natal.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
  render(<AstrologyView />);
  await waitFor(() => expect(mocks.natal).toHaveBeenCalledTimes(1));
  const signal = mocks.natal.mock.calls[0]![1] as AbortSignal;
  act(() => { mocks.identity.abort(); mocks.owner = "owner-b"; window.dispatchEvent(new Event("storage")); });
  expect(signal.aborted).toBe(true);
  await act(async () => finish(response));
  expect(localStorage.getItem(natalCacheKey("owner-a"))).toBeNull();
  expect(localStorage.getItem(natalCacheKey("owner-b"))).toBeNull();
  expect(screen.queryByTestId("personal-chart")).toBeNull();
});
it("keeps a failed cache write readable in memory and retries without recalculating", async () => {
  seed(profile); mocks.natal.mockResolvedValue(response);
  const original = Storage.prototype.setItem;
  let blocked = true;
  vi.spyOn(Storage.prototype, "setItem").mockImplementation(function (this: Storage, key, value) {
    if (blocked && key === natalCacheKey(profile.id)) throw new DOMException("Full", "QuotaExceededError");
    original.call(this, key, value);
  });
  render(<AstrologyView />);
  await waitFor(() => expect(screen.getByTestId("personal-chart")).toBeTruthy());
  expect(screen.getByText(/could not be saved on this device/)).toBeTruthy();
  blocked = false; fireEvent.click(screen.getByRole("button", { name: "Retry saving chart" }));
  expect(localStorage.getItem(natalCacheKey(profile.id))).not.toBeNull();
  expect(mocks.natal).toHaveBeenCalledTimes(1);
});
it("does not stay stuck loading after cancelling a recalculation and returning to the chart", async () => {
  seed(profile); storeChart(profile.id, profile, response); render(<AstrologyView />);
  fireEvent.click(screen.getByRole("button", { name: "Recalculate" }));
  await waitFor(() => expect(mocks.natal).toHaveBeenCalledTimes(1));
  fireEvent.click(screen.getByRole("button", { name: /^Explore signs$/ }));
  expect((mocks.natal.mock.calls[0]![1] as AbortSignal).aborted).toBe(true);
  fireEvent.click(screen.getByRole("button", { name: /^My chart$/ }));
  await waitFor(() => {
    const canRetry = !(screen.getByRole("button", { name: "Recalculate" }) as HTMLButtonElement).disabled;
    expect(canRetry || mocks.natal.mock.calls.length > 1).toBe(true);
  });
});
it("does not resurrect a pre-deletion chart request after history is cleared", async () => {
  seed(profile); let finish!: (value: AstroNatalResponse) => void;
  mocks.natal.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
  render(<AstrologyView />);
  await waitFor(() => expect(mocks.natal).toHaveBeenCalledTimes(1));
  act(() => {
    localStorage.setItem(`hint_history_clear_version_v1:${profile.id}`, "new-deletion");
    localStorage.removeItem(natalCacheKey(profile.id));
    window.dispatchEvent(new Event("storage"));
  });
  await act(async () => finish(response));
  expect(localStorage.getItem(natalCacheKey(profile.id))).toBeNull();
  expect(screen.queryByTestId("personal-chart")).toBeNull();
});

it("does not automatically pay for a replacement chart after deleting a manually refreshed chart", async () => {
  seed(profile); storeChart(profile.id, profile, response); mocks.natal.mockResolvedValue(response);
  render(<AstrologyView />);
  fireEvent.click(screen.getByRole("button", { name: "Recalculate" }));
  await waitFor(() => expect((screen.getByRole("button", { name: "Recalculate" }) as HTMLButtonElement).disabled).toBe(false));
  expect(mocks.natal).toHaveBeenCalledTimes(1);
  await act(async () => {
    localStorage.setItem(`hint_history_clear_version_v1:${profile.id}`, "after-manual-refresh");
    localStorage.removeItem(natalCacheKey(profile.id));
    window.dispatchEvent(new Event("storage"));
  });
  expect(mocks.natal).toHaveBeenCalledTimes(1);
  expect(screen.queryByTestId("personal-chart")).toBeNull();
  expect(localStorage.getItem(natalCacheKey(profile.id))).toBeNull();
});

it("reuses a completed manual refresh when returning from the signs tab", async () => {
  seed(profile); storeChart(profile.id, profile, response); mocks.natal.mockResolvedValue(response);
  render(<AstrologyView />);
  fireEvent.click(screen.getByRole("button", { name: "Recalculate" }));
  await waitFor(() => expect((screen.getByRole("button", { name: "Recalculate" }) as HTMLButtonElement).disabled).toBe(false));
  fireEvent.click(screen.getByRole("button", { name: /^Explore signs$/ }));
  fireEvent.click(screen.getByRole("button", { name: /^My chart$/ }));
  expect(screen.getByTestId("personal-chart").textContent).toContain("verified-chart");
  expect(mocks.natal).toHaveBeenCalledTimes(1);
});

it("ignores a cancelled transit response after switching the requested period", async () => {
  seed(profile); storeChart(profile.id, profile, response);
  window.history.replaceState({}, "", "/app/astrology?tab=transits");
  const result = (date: string): AstroTransitsResponse => ({ source: "astrologyapi", mode: "live", cached: false, fetchedAt: "2026-09-10", date, transits: [], strongestTransit: { id: "fixture", title: "Fixture", transitPlanet: "sun", natalPlanet: "sun", aspect: "conjunction", area: [], theme: [], action: "Reflect", why: "Fixture", evidence: [] } });
  let daily!: (value: AstroTransitsResponse) => void;
  let weekly!: (value: AstroTransitsResponse) => void;
  mocks.transits.mockImplementationOnce(() => new Promise(resolve => { daily = resolve; })).mockImplementationOnce(() => new Promise(resolve => { weekly = resolve; }));
  render(<AstrologyView />);
  await waitFor(() => expect(mocks.transits).toHaveBeenCalledTimes(1));
  const firstSignal = mocks.transits.mock.calls[0]![3] as AbortSignal;
  fireEvent.click(screen.getByRole("button", { name: "This week" }));
  await waitFor(() => expect(mocks.transits).toHaveBeenCalledTimes(2));
  expect(firstSignal.aborted).toBe(true);
  await act(async () => weekly(result("weekly-result")));
  expect(screen.getByTestId("personal-transits").textContent).toContain("weekly-result");
  await act(async () => daily(result("stale-daily-result")));
  expect(screen.getByTestId("personal-transits").textContent).toContain("weekly-result");
  expect(screen.getByTestId("personal-transits").textContent).not.toContain("stale-daily-result");
});
