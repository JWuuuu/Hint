// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { TogetherReading } from "./TogetherReading";
import type { BirthProfile, AstroSynastryResponse } from "@/types/astrology";
import type { HintLanguage } from "@/lib/i18n";
import { togetherText, TOGETHER_COPY } from "../togetherCopy";

const mocks = vi.hoisted(() => ({ owner: "fixture", language: "en" as HintLanguage, calculate: vi.fn(), fetch: vi.fn(), publicUrl: vi.fn() }));
vi.mock("@/lib/identity", () => ({ getAnonId: () => mocks.owner, captureIdentityContext: () => { const owner = mocks.owner; return { owner, signal: new AbortController().signal, assertCurrent: () => { if (owner !== mocks.owner) throw new DOMException("Owner changed", "AbortError"); } }; } }));
vi.mock("@/lib/clearHistory", () => ({ historyClearVersion: (owner: string) => localStorage.getItem(`hint_history_clear_version_v1:${owner}`) ?? "" }));
vi.mock("@/lib/astro/astroClient", () => ({ getSynastry: (...args: unknown[]) => mocks.calculate(...args), getGeoDetails: vi.fn(), getTimezoneDetails: vi.fn() }));
vi.mock("@/lib/api", () => ({ apiUrl: (path: string) => path, apiFetch: (...args: unknown[]) => mocks.fetch(...args) }));
vi.mock("@/lib/publicUrls", () => ({ publicAppUrl: (path: string) => mocks.publicUrl(path) }));
vi.mock("@/lib/i18n", async importOriginal => {
  const actual = await importOriginal<typeof import("@/lib/i18n")>();
  return { ...actual, useLanguage: () => ({ language: mocks.language, t: (key: string) => actual.TRANSLATIONS[mocks.language][key] ?? key }) };
});

const profile: BirthProfile = { id: "fixture", name: "Reader A", birthDate: "2000-02-29", birthTime: "08:00", birthPlace: "Chicago", latitude: 41.87, longitude: -87.62, timezoneOffset: -6, createdAt: "2026-09-10", updatedAt: "2026-09-10" };
const result: AstroSynastryResponse = { source: "astrologyapi", mode: "live", cached: false, fetchedAt: "2026-09-10T12:00:00Z", summary: { comfort: "Original comfort", tension: "Original tension", communication: "Original communication", attraction: "Original attraction", growth: "Original growth" }, aspects: [{ from: "Venus", to: "Moon", type: "trine", tier: "strong", meaning: "Original aspect note" }], plainEnglish: { main: "Original comparison", comfort: "Original comfort", tension: "Original tension", advice: "Original advice" } };
function fillPartner(name = "Partner A") {
  fireEvent.change(screen.getByLabelText("Name", { exact: true }), { target: { value: name } });
  fireEvent.change(screen.getByLabelText("Birth date", { exact: true }), { target: { value: "2000-01-01" } });
  fireEvent.change(screen.getByLabelText("Birth place", { exact: true }), { target: { value: "Tokyo" } });
  fireEvent.change(screen.getByLabelText("Birth time", { exact: true }), { target: { value: "08:00" } });
  fireEvent.change(screen.getByLabelText("Latitude", { exact: true }), { target: { value: "35.67" } });
  fireEvent.change(screen.getByLabelText("Longitude", { exact: true }), { target: { value: "139.65" } });
  fireEvent.change(screen.getByLabelText("Timezone offset", { exact: true }), { target: { value: "9" } });
}
beforeEach(() => {
  localStorage.clear(); sessionStorage.clear(); mocks.language = "en"; mocks.owner = "fixture";
  mocks.calculate.mockReset(); mocks.fetch.mockReset(); mocks.publicUrl.mockReset().mockImplementation(path => `https://hint.test${path}`);
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

it("requires consent, deduplicates requests and aborts old comparisons after edits", async () => {
  let finish!: (value: AstroSynastryResponse) => void;
  mocks.calculate.mockImplementation(() => new Promise(resolve => { finish = resolve; }));
  render(<TogetherReading profile={profile} />); fillPartner();
  fireEvent.click(screen.getByRole("button", { name: "Explore the connection" }));
  expect(mocks.calculate).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("checkbox"));
  fireEvent.click(screen.getByRole("button", { name: "Explore the connection" }));
  fireEvent.click(screen.getByRole("button", { name: "Calculating the connection…" }));
  expect(mocks.calculate).toHaveBeenCalledTimes(1);
  const signal = mocks.calculate.mock.calls[0]![2] as AbortSignal;
  fireEvent.change(screen.getByLabelText("Name", { exact: true }), { target: { value: "Partner B" } });
  expect(signal.aborted).toBe(true);
  await act(async () => finish(result));
  expect(screen.queryByTestId("together-result")).toBeNull();
  expect((screen.getByLabelText("Name", { exact: true }) as HTMLInputElement).value).toBe("Partner B");
});

it("uses immutable names for a real comparison and never completes fallback data", async () => {
  mocks.calculate.mockResolvedValueOnce({ ...result, source: "fallback", mode: "fallback" }).mockResolvedValueOnce(result);
  render(<TogetherReading profile={profile} />); fillPartner(); fireEvent.click(screen.getByRole("checkbox"));
  fireEvent.click(screen.getByRole("button", { name: "Explore the connection" }));
  await waitFor(() => expect(screen.getByRole("alert").textContent).toContain("unavailable"));
  expect(screen.queryByTestId("together-result")).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Explore the connection" }));
  await waitFor(() => expect(screen.getByRole("heading", { name: "Reader A + Partner A" })).toBeTruthy());
  expect(screen.getByRole("heading", { name: "Venus · Trine · Moon" })).toBeTruthy();
  expect(screen.queryByRole("progressbar")).toBeNull();
  fireEvent.change(screen.getByLabelText("Name", { exact: true }), { target: { value: "Partner C" } });
  expect(screen.queryByTestId("together-result")).toBeNull();
});

it("checks public URL configuration before creating an invitation", async () => {
  mocks.publicUrl.mockImplementation(() => { throw new Error("Unconfigured URL"); });
  render(<TogetherReading profile={profile} />);
  fireEvent.click(screen.getByRole("button", { name: "Create invite link" }));
  await waitFor(() => expect(screen.getByRole("alert").textContent).toContain("could not be created"));
  expect(mocks.fetch).not.toHaveBeenCalled();
});

it("does not request a personal comparison with unknown partner time or coordinates", async () => {
  render(<TogetherReading profile={profile} />); fillPartner(); fireEvent.click(screen.getByRole("checkbox"));
  fireEvent.change(screen.getByLabelText("Birth time", { exact: true }), { target: { value: "" } });
  fireEvent.click(screen.getByRole("button", { name: "Explore the connection" }));
  await waitFor(() => expect(screen.getByRole("alert").textContent).toContain("accurate birth time"));
  expect(mocks.calculate).not.toHaveBeenCalled();
  expect(screen.getByText("These entries are used for this comparison. They are not added to your personal birth profile.")).toBeTruthy();
});

it("keeps the invitation readable after copy failure and native share cancellation", async () => {
  mocks.fetch.mockResolvedValue(new Response(JSON.stringify({ token: "fixture", expiresAt: "2026-09-17T12:00:00Z" })));
  const copy = vi.fn().mockRejectedValue(new Error("Clipboard denied"));
  const share = vi.fn().mockRejectedValue(new DOMException("Cancelled", "AbortError"));
  Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText: copy } });
  Object.defineProperty(navigator, "share", { configurable: true, value: share });
  render(<TogetherReading profile={profile} />);
  fireEvent.click(screen.getByRole("button", { name: "Create invite link" }));
  await waitFor(() => expect(screen.getByText("https://hint.test/app/compatibility/invite/fixture")).toBeTruthy());
  fireEvent.click(screen.getByRole("button", { name: "Copy link" }));
  await waitFor(() => expect(screen.getByRole("status").textContent).toContain("could not be copied"));
  fireEvent.click(screen.getByRole("button", { name: "Share invite link" }));
  await waitFor(() => expect(share).toHaveBeenCalledTimes(1));
  expect(screen.queryByRole("alert")).toBeNull();
  expect(screen.getByText("https://hint.test/app/compatibility/invite/fixture")).toBeTruthy();
  expect(share.mock.calls[0][0]).toEqual({ title: "The space between you", url: "https://hint.test/app/compatibility/invite/fixture" });
});

it("profile changes cancel an invitation and ignore a late result", async () => {
  let finish!: (value: Response) => void;
  mocks.fetch.mockImplementation(() => new Promise(resolve => { finish = resolve; }));
  const view = render(<TogetherReading profile={profile} />);
  fireEvent.click(screen.getByRole("button", { name: "Create invite link" }));
  const signal = mocks.fetch.mock.calls[0]![1].signal as AbortSignal;
  view.rerender(<TogetherReading profile={{ ...profile, name: "Reader B" }} />);
  expect(signal.aborted).toBe(true);
  await act(async () => finish(new Response(JSON.stringify({ token: "stale", expiresAt: "2026-09-17T12:00:00Z" }))));
  expect(screen.queryByText(/https:\/\/hint.test/)).toBeNull();
});

it("every Together state has authored copy in all five supported languages", () => {
  for (const key of Object.keys(TOGETHER_COPY) as Array<keyof typeof TOGETHER_COPY>) {
    for (const language of ["en", "zh", "es", "ja", "ko"] as const) {
      expect(togetherText(language, key), `${key}:${language}`).toBeTruthy();
      if (language !== "en") expect(togetherText(language, key)).not.toBe(togetherText("en", key));
    }
  }
});

it.each(["history", "owner"])("rejects late comparisons after %s changes even before notification", async change => {
  let finish!: (value: AstroSynastryResponse) => void;
  mocks.calculate.mockImplementation(() => new Promise(resolve => { finish = resolve; }));
  render(<TogetherReading profile={profile} />); fillPartner(); fireEvent.click(screen.getByRole("checkbox"));
  fireEvent.click(screen.getByRole("button", { name: "Explore the connection" }));
  if (change === "owner") mocks.owner = "other";
  else localStorage.setItem("hint_history_clear_version_v1:fixture", "cleared");
  await act(async () => finish(result));
  expect(screen.queryByTestId("together-result")).toBeNull();
});

it("history clearing removes an open comparison and pending invitation without restarting work", async () => {
  mocks.calculate.mockResolvedValue(result); mocks.fetch.mockImplementation(() => new Promise(() => {}));
  render(<TogetherReading profile={profile} />); fillPartner(); fireEvent.click(screen.getByRole("checkbox"));
  fireEvent.click(screen.getByRole("button", { name: "Explore the connection" }));
  await waitFor(() => expect(screen.getByTestId("together-result")).toBeTruthy());
  fireEvent.click(screen.getByRole("button", { name: "Create invite link" }));
  const signal = mocks.fetch.mock.calls[0][1].signal as AbortSignal;
  act(() => { localStorage.setItem("hint_history_clear_version_v1:fixture", "cleared"); window.dispatchEvent(new Event("storage")); });
  expect(screen.queryByTestId("together-result")).toBeNull();
  expect(signal.aborted).toBe(true);
  expect(mocks.fetch).toHaveBeenCalledTimes(1);
  expect(mocks.calculate).toHaveBeenCalledTimes(1);
  expect((screen.getByRole("checkbox") as HTMLInputElement).checked).toBe(false);
});
