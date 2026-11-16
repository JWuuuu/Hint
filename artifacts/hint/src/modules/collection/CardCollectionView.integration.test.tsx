// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { CardCollectionView } from "./CardCollectionView";
import { LanguageProvider } from "../../lib/i18n";
import { MotionPolicyProvider } from "../../lib/motionPolicy";
import { getCachedDailyReceipt } from "../../lib/dailyReceipts";
import { getDailyCollectionReward } from "../../shared/tarot/cardCollection";
const state = vi.hoisted(() => ({ owner: "", serial: 0 }));
vi.mock("../../lib/api", () => ({ apiUrl: (path: string) => path, apiFetch: (...args: Parameters<typeof fetch>) => fetch(...args) }));
vi.mock("../../lib/identity", () => ({ getAnonId: () => state.owner, getLocalDateString: (date = new Date()) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}` }));
const day = "2026-11-15";
const makeReceipt = (cardId = "19-sun", dailyKey = day) => ({ anonId: state.owner, anonymousDeviceId: state.owner, dailyKey, featureType: "collection-rare-reward", assignedCardId: cardId, assignedAt: `${dailyKey}T12:00:00Z`, expiresAt: "2026-11-17T00:00:00Z", openedAt: null });
const ok = (body: object) => new Response(JSON.stringify(body), { status: 200, headers: { "Content-Type": "application/json" } });
const wrapper = () => <LanguageProvider><MotionPolicyProvider><CardCollectionView /></MotionPolicyProvider></LanguageProvider>;
const panel = () => within(document.querySelector(".rare-unlock-panel") as HTMLElement);
const cache = () => getCachedDailyReceipt("collection-rare-reward", { anonId: state.owner, dailyKey: day });
const unlocks = () => JSON.parse(localStorage.getItem("hint_local_collection_unlocks_v1") || "[]");
beforeEach(() => {
  localStorage.clear(); state.owner = `h43-unit-${++state.serial}`;
  vi.useFakeTimers({ toFake: ["Date"] }); vi.setSystemTime(new Date(2026, 10, 15, 12));
  localStorage.setItem("hint-language", "en");
  localStorage.setItem("hint.preferences.v1", JSON.stringify({ reduceMotion: true, soundAndHaptics: false }));
  vi.stubGlobal("matchMedia", () => ({ matches: false, addEventListener() {}, removeEventListener() {} }));
});
afterEach(() => { cleanup(); vi.useRealTimers(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

it("uses the real child: held primary/grid input never reveals or becomes a later assignment's intent", async () => {
  let finish!: (response: Response) => void;
  const fetcher = vi.fn(() => new Promise<Response>(resolve => { finish = resolve; })); vi.stubGlobal("fetch", fetcher);
  render(wrapper());
  const primary = panel().getByRole("button");
  expect(primary.hasAttribute("disabled")).toBe(true);
  const grid = screen.getAllByRole("button", { name: /Open today's rare reward/ }).find(button => button !== primary)!;
  expect(grid.hasAttribute("disabled")).toBe(true);
  fireEvent.click(primary); fireEvent.click(grid);
  expect(document.querySelector(".rare-unlock-stage.is-saved")).toBeNull(); expect(unlocks()).toEqual([]);
  const fallback = getDailyCollectionReward().cardId;
  await act(async () => finish(ok(makeReceipt(fallback === "19-sun" ? "17-star" : "19-sun"))));
  expect(panel().getByRole("button").textContent).toContain("Open today's");
  expect(fetcher).toHaveBeenCalledOnce(); expect(cache()?.openedAt).toBeNull(); expect(unlocks()).toEqual([]);
  expect(screen.getAllByRole("button", { name: /locked$/ }).every(button => button.hasAttribute("disabled"))).toBe(true);
});

it("initial assignment failure opens one fallback immediately during held sync; conflict is honest and replay makes no request", async () => {
  let finish!: (response: Response) => void;
  const fetcher = vi.fn().mockResolvedValueOnce(new Response(null, { status: 503 })).mockImplementation(() => new Promise<Response>(resolve => { finish = resolve; })); vi.stubGlobal("fetch", fetcher);
  render(wrapper()); await act(async () => {});
  expect(cache()?.source).toBe("local-fallback");
  const button = panel().getByRole("button"); fireEvent.click(button); fireEvent.click(button);
  expect(unlocks()).toHaveLength(1); expect(cache()?.openedAt).toBeTruthy();
  expect(panel().getByRole("status").textContent).toContain("Online sync has not completed");
  expect(fetcher).toHaveBeenCalledTimes(2);
  const opened = cache();
  await act(async () => finish(new Response(null, { status: 409 })));
  expect(panel().getByRole("status").textContent).toContain("differs from the reward saved online");
  expect(screen.queryByRole("button", { name: /retry/i })).toBeNull();
  fireEvent.click(panel().getByRole("button"));
  expect(fetcher).toHaveBeenCalledTimes(2); expect(unlocks()).toHaveLength(1);
  expect(cache()?.assignedCardId).toBe(opened?.assignedCardId); expect(cache()?.openedAt).toBe(opened?.openedAt);
});

it("keeps an accepted reveal visible on local save failure and retries only local storage", async () => {
  const fetcher = vi.fn().mockResolvedValueOnce(ok(makeReceipt())).mockResolvedValue(new Response(null, { status: 503 })); vi.stubGlobal("fetch", fetcher);
  render(wrapper()); await act(async () => {});
  const original = Storage.prototype.setItem;
  const storage = vi.spyOn(Storage.prototype, "setItem").mockImplementation(function (this: Storage, key, value) { if (key === "hint_local_collection_unlocks_v1") throw new Error("fixture quota"); original.call(this, key, value); });
  await act(async () => fireEvent.click(panel().getByRole("button")));
  expect(unlocks()).toEqual([]); expect(document.querySelector(".rare-unlock-stage.is-saved")).not.toBeNull();
  expect(panel().getByRole("status").textContent).not.toContain("Saved");
  const calls = fetcher.mock.calls.length; storage.mockRestore();
  fireEvent.click(screen.getByRole("button", { name: /retry saving/i }));
  expect(unlocks()).toHaveLength(1); expect(fetcher).toHaveBeenCalledTimes(calls);
  expect(panel().getByRole("status").textContent).toContain("Online sync has not completed");
});

it("does not reuse grid activation on a new day or apply yesterday's late sync to today's view", async () => {
  let finish!: (response: Response) => void;
  const fetcher = vi.fn().mockResolvedValueOnce(ok(makeReceipt())).mockImplementationOnce(() => new Promise<Response>(resolve => { finish = resolve; })).mockResolvedValue(ok(makeReceipt("17-star", "2026-11-16"))); vi.stubGlobal("fetch", fetcher);
  render(wrapper()); await act(async () => {});
  const grid = screen.getAllByRole("button", { name: /Open today's rare reward/ }).find(button => button !== panel().getByRole("button"))!;
  fireEvent.click(grid); expect(unlocks()).toHaveLength(1);
  await act(async () => { vi.setSystemTime(new Date(2026, 10, 16, 12)); window.dispatchEvent(new Event("focus")); });
  expect(panel().getByRole("button").textContent).toContain("Open today's rare reward for The Star");
  await act(async () => finish(new Response(null, { status: 409 })));
  expect(panel().getByRole("button").textContent).toContain("Open today's rare reward for The Star");
  expect(panel().getByRole("status").textContent).not.toContain("differs");
  expect(unlocks()).toHaveLength(1); expect(fetcher).toHaveBeenCalledTimes(3);
});

it("ignores another owner's late sync and permits an already unlocked non-current card to replay", async () => {
  let finish!: (response: Response) => void;
  const fetcher = vi.fn().mockResolvedValueOnce(ok(makeReceipt())).mockImplementationOnce(() => new Promise<Response>(resolve => { finish = resolve; })); vi.stubGlobal("fetch", fetcher);
  const view = render(wrapper()); await act(async () => {});
  fireEvent.click(panel().getByRole("button")); const originalOwner = state.owner;
  state.owner = "h43-other-owner";
  localStorage.setItem("hint_local_collection_unlocks_v1", JSON.stringify([...unlocks(), { anonId: state.owner, cardId: "0-fool", source: "reward", createdAt: "2026-11-14T12:00:00Z" }]));
  fetcher.mockResolvedValue(ok(makeReceipt("17-star")));
  await act(async () => { view.rerender(wrapper()); });
  // Notify the new owner's subscription after its effect has attached.
  act(() => { window.dispatchEvent(new Event("storage")); });
  await act(async () => finish(new Response(null, { status: 409 })));
  expect(panel().getByRole("button").textContent).toContain("Open today's rare reward for The Star");
  expect(panel().getByRole("status").textContent).not.toContain("differs");
  const calls = fetcher.mock.calls.length;
  fireEvent.click(screen.getByRole("button", { name: "Replay rare unlock for The Fool" }));
  expect(panel().getByRole("button").textContent).toContain("Replay rare unlock for The Fool");
  expect(fetcher).toHaveBeenCalledTimes(calls);
  expect(unlocks().filter((row: { anonId: string }) => row.anonId === originalOwner)).toHaveLength(1);
});
