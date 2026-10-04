// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { ReactNode } from "react";
import { CompatibilityView } from "./CompatibilityView";
const mocks = vi.hoisted(() => ({ save: vi.fn(), fetch: vi.fn(), navigate: vi.fn(), recalculate: vi.fn(), chartLoading: false, chartError: null as string | null, owner: "fixture", resultId: null as string | null, token: null as string | null, chart: null as object | null, input: { name: "Fixture", birthday: "2000-02-29" }, profile: { name: "Fixture", birthDate: "2000-02-29" } as { name: string; birthDate: string; [key: string]: unknown } }));
vi.mock("wouter", () => ({ useRoute: (path: string) => path.includes("invite") ? (mocks.token ? [true, { token: mocks.token }] : [false, null]) : mocks.resultId ? [true, { id: mocks.resultId }] : [false, null], useLocation: () => ["/app/compatibility", mocks.navigate], Link: ({ children, href }: { children: ReactNode; href: string }) => <a href={href}>{children}</a> }));
vi.mock("../../lib/identity", () => ({ getAnonId: () => mocks.owner, captureIdentityContext: () => { const owner = mocks.owner; return { owner, signal: new AbortController().signal, assertCurrent: () => { if (owner !== mocks.owner) throw new DOMException("Owner changed", "AbortError"); } }; } }));
vi.mock("../../lib/clearHistory", () => ({ historyClearVersion: (owner: string) => localStorage.getItem(`hint_history_clear_version_v1:${owner}`) ?? "" }));
vi.mock("../../lib/quietMotion", () => ({ motion: { div: ({ children, ...props }: { children: ReactNode }) => <div>{children}</div> } }));
vi.mock("../../lib/i18n", () => ({ useLanguage: () => ({ language: "en", t: (key: string) => key }) }));
vi.mock("../../lib/LocalizedText", () => ({ LocalizedText: ({ text }: { text: string }) => <>{text}</>, translateText: (text: string) => text }));
vi.mock("../../lib/useProfile", () => ({ useProfile: () => ({ anonId: "fixture", profile: mocks.profile, saveProfile: mocks.save, isSaving: false }) }));
vi.mock("../astrology/useBirthChart", () => ({ useBirthChart: () => ({ birthInput: mocks.input, chart: mocks.chart, isLoading: mocks.chartLoading, error: mocks.chartError, recalculate: mocks.recalculate }) }));
vi.mock("../astrology/components/PersonalSignalSeal", () => ({ PersonalSignalSeal: () => <span>Chart</span> }));
vi.mock("../../lib/api", () => ({ apiUrl: (path: string) => path, apiFetch: (...args: unknown[]) => mocks.fetch(...args) }));
vi.mock("../../lib/publicUrls", () => ({ publicAppUrl: (path: string) => `https://hint.example${path}` }));
vi.mock("../../lib/astro/astroClient", () => ({ getGeoDetails: vi.fn(), getTimezoneDetails: vi.fn() }));
beforeEach(() => { localStorage.clear(); mocks.fetch.mockReset(); mocks.save.mockReset(); mocks.navigate.mockReset(); mocks.recalculate.mockReset(); mocks.chartLoading = false; mocks.chartError = null; mocks.token = null; mocks.resultId = null; mocks.owner = "fixture"; mocks.chart = null; mocks.input = { name: "Fixture", birthday: "2000-02-29" }; mocks.profile = { name: "Fixture", birthDate: "2000-02-29" }; });
afterEach(() => { cleanup(); vi.restoreAllMocks(); });
it("awaits self-profile save so storage failures remain visible in the birth form", async () => {
  mocks.save.mockRejectedValue(new Error("Quota"));
  render(<CompatibilityView />);
  fireEvent.change(screen.getByLabelText("birthProfile.name"), { target: { value: "Fixture" } });
  fireEvent.change(screen.getByLabelText("birthProfile.birthDate"), { target: { value: "2000-02-29" } });
  fireEvent.change(screen.getByLabelText("birthProfile.birthPlace"), { target: { value: "Chicago" } });
  fireEvent.click(screen.getByRole("button", { name: "Save profile" }));
  await waitFor(() => expect(screen.getByRole("alert").textContent).toContain("could not be saved"));
  expect((screen.getByLabelText("birthProfile.birthPlace") as HTMLInputElement).value).toBe("Chicago");
});
it("deduplicates invite creation, aborts on input changes and ignores a late result", async () => {
  mocks.chart = { sunSign: "aries", moonSign: "cancer", risingSign: "leo" };
  let finish!: (value: object) => void; mocks.fetch.mockImplementation(() => new Promise(resolve => { finish = resolve; }));
  const view = render(<CompatibilityView />);
  fireEvent.click(screen.getByRole("button", { name: "Create invite link" }));
  fireEvent.click(screen.getByRole("button", { name: "Creating..." }));
  expect(mocks.fetch).toHaveBeenCalledTimes(1);
  const signal = mocks.fetch.mock.calls[0][1].signal as AbortSignal;
  mocks.input = { name: "Changed reader", birthday: "2000-02-29" }; view.rerender(<CompatibilityView />);
  expect(signal.aborted).toBe(true);
  await act(async () => finish({ ok: true, json: async () => ({ token: "obsolete" }) }));
  expect(screen.queryByText(/obsolete/)).toBeNull();
});
it("reports denied clipboard access and keeps the invite link selectable", async () => {
  mocks.chart = { sunSign: "aries", moonSign: "cancer", risingSign: "leo" };
  mocks.fetch.mockResolvedValue({ ok: true, json: async () => ({ token: "fixture-token" }) });
  Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText: vi.fn().mockRejectedValue(new Error("Denied")) } });
  render(<CompatibilityView />);
  fireEvent.click(screen.getByRole("button", { name: "Create invite link" }));
  await waitFor(() => expect(screen.getByText("https://hint.example/app/compatibility/invite/fixture-token")).toBeTruthy());
  fireEvent.click(screen.getByRole("button", { name: "Copy" }));
  await waitFor(() => expect(screen.getByRole("status").textContent).toBe("quality.copyFailed"));
});
it("an accepted invitation with a private result never offers another completion form", async () => {
  mocks.token = "accepted";
  mocks.fetch.mockResolvedValue({ ok: true, json: async () => ({ token: "accepted", status: "completed", resultId: null }) });
  render(<CompatibilityView />);
  await waitFor(() => expect(screen.getByText("quality.inviteAccepted")).toBeTruthy());
  expect(screen.queryByRole("checkbox")).toBeNull(); expect(mocks.navigate).not.toHaveBeenCalled();
});
it("token changes discard an older completion even when its response body resolves later", async () => {
  mocks.token = "first";
  let finishBody!: (value: object) => void;
  mocks.fetch.mockImplementation((url: string) => url.endsWith("/complete")
    ? Promise.resolve({ ok: true, status: 200, json: () => new Promise(resolve => { finishBody = resolve; }) })
    : Promise.resolve({ ok: true, json: async () => ({ token: mocks.token, status: "pending", creatorName: mocks.token }) }));
  const view = render(<CompatibilityView />);
  await waitFor(() => expect(screen.getByRole("checkbox")).toBeTruthy());
  fireEvent.click(screen.getByRole("checkbox"));
  fireEvent.change(screen.getByLabelText("birthProfile.name"), { target: { value: "Fixture" } });
  fireEvent.change(screen.getByLabelText("birthProfile.birthDate"), { target: { value: "2000-02-29" } });
  fireEvent.change(screen.getByLabelText("birthProfile.birthPlace"), { target: { value: "Chicago" } });
  fireEvent.click(screen.getByRole("button", { name: "Open shared chart" }));
  await waitFor(() => expect(finishBody).toBeTypeOf("function"));
  const signal = mocks.fetch.mock.calls.find(call => String(call[0]).endsWith("/complete"))![1].signal as AbortSignal;
  mocks.token = "second"; view.rerender(<CompatibilityView />);
  expect(signal.aborted).toBe(true);
  await act(async () => finishBody({ resultId: "old", result: { id: "old" } }));
  expect(mocks.navigate).not.toHaveBeenCalled();
  expect(Object.keys(localStorage).some(key => key.includes("old"))).toBe(false);
});
it("restores only the current owner's immutable result snapshot and ignores unowned legacy caches", async () => {
  const chart = { input: { birthday: "2000-02-29" }, placements: [] };
  const saved = { id: "shared", source: "api", people: { user: { name: "Saved Alice", chart }, friend: { name: "Saved Bob", chart } }, scores: { overall: 55, attraction: 55, communication: 55, emotionalRhythm: 55, stability: 55, tension: 55 }, highlights: { strongestLink: "Link", easyPart: "Easy", frictionPoint: "Friction", advice: "Advice" } };
  localStorage.setItem("hint_compatibility_result_v2:alice:shared", JSON.stringify(saved));
  localStorage.setItem("hint_compatibility_result_v1:shared", JSON.stringify(saved));
  mocks.resultId = "shared"; mocks.owner = "alice"; mocks.fetch.mockRejectedValue(new Error("Offline"));
  render(<CompatibilityView />);
  expect(screen.getByRole("heading", { name: "Saved Alice + Saved Bob" })).toBeTruthy();
  expect(screen.queryByText("55", { exact: true })).toBeNull();
  expect(screen.queryByRole("progressbar")).toBeNull();
  expect(screen.getByText("Detailed connections between these charts are not available for this result.")).toBeTruthy();
  expect(screen.queryByText("Original calculation notes")).toBeNull();
  for (const formulaNote of Object.values(saved.highlights)) expect(screen.queryByText(formulaNote, { exact: true })).toBeNull();
  expect(JSON.parse(localStorage.getItem("hint_compatibility_result_v2:alice:shared")!).highlights).toEqual(saved.highlights);
  await waitFor(() => expect(screen.getByRole("status").textContent).toContain("Offline"));
  cleanup(); mocks.owner = "other";
  render(<CompatibilityView />);
  expect(screen.queryByRole("heading", { name: "Saved Alice + Saved Bob" })).toBeNull();
  await waitFor(() => expect(screen.getByText("Offline")).toBeTruthy());
  expect(localStorage.getItem("hint_compatibility_result_v2:alice:shared")).not.toBeNull();
});
it("a damaged local result remains a recoverable result page", async () => {
  mocks.resultId = "damaged";
  localStorage.setItem("hint_compatibility_result_v2:fixture:damaged", JSON.stringify({ id: "damaged", scores: null }));
  mocks.fetch.mockResolvedValue({ ok: false, status: 503 });
  render(<CompatibilityView />);
  await waitFor(() => expect(screen.getByRole("button", { name: "Retry" })).toBeTruthy());
});

function resultFixture(id: string) {
  const chart = { input: { birthday: "2000-02-29" }, placements: [] };
  return { id, source: "api", people: { user: { name: `Reader ${id}`, chart }, friend: { name: `Friend ${id}`, chart } }, scores: { overall: 55, attraction: 55, communication: 55, emotionalRhythm: 55, stability: 55, tension: 55 }, highlights: { strongestLink: "Link", easyPart: "Easy", frictionPoint: "Friction", advice: "Advice" } };
}

it("switching result links never displays the preceding pair while the new result loads", async () => {
  mocks.resultId = "first";
  mocks.fetch.mockImplementation((url: string) => url.endsWith("first") ? Promise.resolve(new Response(JSON.stringify(resultFixture("first")))) : new Promise(() => {}));
  const view = render(<CompatibilityView />);
  await waitFor(() => expect(screen.getByRole("heading", { name: "Reader first + Friend first" })).toBeTruthy());
  mocks.resultId = "second"; view.rerender(<CompatibilityView />);
  expect(screen.queryByRole("heading", { name: "Reader first + Friend first" })).toBeNull();
});

it.each(["history", "owner"])("does not restore a late result after %s changes", async (change) => {
  mocks.resultId = "pending";
  let finish!: (value: object) => void;
  mocks.fetch.mockResolvedValue({ ok: true, status: 200, json: () => new Promise(resolve => { finish = resolve; }) });
  render(<CompatibilityView />);
  await waitFor(() => expect(finish).toBeTypeOf("function"));
  if (change === "owner") mocks.owner = "other";
  else localStorage.setItem("hint_history_clear_version_v1:fixture", "cleared");
  await act(async () => finish(resultFixture("pending")));
  expect(screen.queryByRole("heading", { name: "Reader pending + Friend pending" })).toBeNull();
  expect(localStorage.getItem("hint_compatibility_result_v2:fixture:pending")).toBeNull();
  expect(localStorage.getItem("hint_compatibility_result_v2:other:pending")).toBeNull();
});

it("history clearing removes a visible result and cancels its refresh", async () => {
  mocks.resultId = "visible";
  localStorage.setItem("hint_compatibility_result_v2:fixture:visible", JSON.stringify(resultFixture("visible")));
  mocks.fetch.mockImplementation(() => new Promise(() => {}));
  render(<CompatibilityView />);
  const signal = mocks.fetch.mock.calls[0][1].signal as AbortSignal;
  expect(screen.getByRole("heading", { name: "Reader visible + Friend visible" })).toBeTruthy();
  act(() => { localStorage.removeItem("hint_compatibility_result_v2:fixture:visible"); localStorage.setItem("hint_history_clear_version_v1:fixture", "cleared"); window.dispatchEvent(new Event("storage")); });
  expect(screen.queryByRole("heading", { name: "Reader visible + Friend visible" })).toBeNull();
  expect(signal.aborted).toBe(true);
  expect(mocks.fetch).toHaveBeenCalledTimes(1);
});

it("a late unavailable response cannot delete another owner's cached result", async () => {
  mocks.resultId = "shared";
  let finish!: (value: object) => void;
  mocks.fetch.mockImplementation(() => new Promise(resolve => { finish = resolve; }));
  localStorage.setItem("hint_compatibility_result_v2:other:shared", JSON.stringify(resultFixture("shared")));
  render(<CompatibilityView />);
  mocks.owner = "other";
  await act(async () => finish({ ok: false, status: 404 }));
  expect(localStorage.getItem("hint_compatibility_result_v2:other:shared")).not.toBeNull();
});

it.each(["history", "owner"])("does not cache or navigate from invitation completion after %s changes", async change => {
  mocks.token = "pending";
  let finishBody!: (value: object) => void;
  mocks.fetch.mockImplementation((url: string) => url.endsWith("/complete")
    ? Promise.resolve({ ok: true, status: 200, json: () => new Promise(resolve => { finishBody = resolve; }) })
    : Promise.resolve({ ok: true, json: async () => ({ token: "pending", status: "pending", creatorName: "Fixture" }) }));
  render(<CompatibilityView />);
  await waitFor(() => expect(screen.getByRole("checkbox")).toBeTruthy());
  fireEvent.click(screen.getByRole("checkbox"));
  fireEvent.change(screen.getByLabelText("birthProfile.name"), { target: { value: "Fixture" } });
  fireEvent.change(screen.getByLabelText("birthProfile.birthDate"), { target: { value: "2000-02-29" } });
  fireEvent.change(screen.getByLabelText("birthProfile.birthPlace"), { target: { value: "Chicago" } });
  fireEvent.click(screen.getByRole("button", { name: "Open shared chart" }));
  await waitFor(() => expect(finishBody).toBeTypeOf("function"));
  if (change === "owner") mocks.owner = "other";
  else localStorage.setItem("hint_history_clear_version_v1:fixture", "cleared");
  await act(async () => finishBody({ resultId: "late", result: resultFixture("late") }));
  expect(mocks.navigate).not.toHaveBeenCalled();
  expect(localStorage.getItem("hint_compatibility_result_v2:fixture:late")).toBeNull();
  expect(localStorage.getItem("hint_compatibility_result_v2:other:late")).toBeNull();
});

it("preserves saved birth details and provides direct retry when the personal calculation fails", async () => {
  mocks.profile = { name: "Saved Reader", birthDate: "2000-02-29", birthTime: "08:30", birthPlace: "Chicago", latitude: 41.87, longitude: -87.62, timezoneOffset: -6 };
  mocks.chartError = "Internal provider failure";
  let finish!: () => void; mocks.recalculate.mockImplementation(() => new Promise<void>(resolve => { finish = resolve; }));
  render(<CompatibilityView />);
  expect((screen.getByLabelText("birthProfile.name") as HTMLInputElement).value).toBe("Saved Reader");
  expect((screen.getByLabelText("birthProfile.birthPlace") as HTMLInputElement).value).toBe("Chicago");
  expect((screen.getByLabelText("birthProfile.birthTime") as HTMLInputElement).value).toBe("08:30");
  expect(screen.getByRole("alert").textContent).toContain("calculated chart is unavailable");
  expect(screen.queryByText("Internal provider failure")).toBeNull();
  expect(screen.queryByText("Save your birth profile before creating an invite.")).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Recalculate" }));
  fireEvent.click(screen.getByRole("button", { name: "Calculating your chart…" }));
  expect(mocks.recalculate).toHaveBeenCalledTimes(1);
  await act(async () => finish());
  expect(screen.getByRole("button", { name: "Recalculate" })).toBeTruthy();
});

it("shows calculation progress while preserving saved inputs and disabling invitation creation", () => {
  mocks.chartLoading = true;
  render(<CompatibilityView />);
  expect(screen.getByRole("status").textContent).toContain("Calculating your chart…");
  expect((screen.getByRole("button", { name: "Create invite link" }) as HTMLButtonElement).disabled).toBe(true);
  expect((screen.getByLabelText("birthProfile.name") as HTMLInputElement).value).toBe("Fixture");
});
