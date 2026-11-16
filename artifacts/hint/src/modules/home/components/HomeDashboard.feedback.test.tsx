/** @vitest-environment jsdom */
import { act, cleanup, fireEvent, render, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { HomeDashboard } from "./HomeDashboard";
import { getAnonId } from "../../../lib/identity";
import { LanguageProvider } from "../../../lib/i18n";

const state = vi.hoisted(() => ({
  feedback: vi.fn(), open: vi.fn(), restore: vi.fn(), claim: vi.fn(), reduced: false,
  reveal: null as null | { onFlip: () => void; onRevealed: () => void },
  nativeListeners: new Set<(active: boolean) => void>(),
}));
vi.mock("../data/homeCheckIn", async importOriginal => ({
  ...await importOriginal<typeof import("../data/homeCheckIn")>(),
  claimHomeCheckIn: (...args: unknown[]) => state.claim(...args),
}));
vi.mock("../../../lib/feedback", () => ({ triggerFeedback: state.feedback }));
vi.mock("../../../lib/useDailyTarotDay", () => ({ useDailyTarotDay: () => "2026-11-10" }));
vi.mock("../../../lib/useProfile", () => ({ useProfile: () => ({ profile: null }) }));
vi.mock("../../../lib/motionPolicy", () => ({ useMotionPolicy: () => ({ reduced: state.reduced, pageVisible: true }) }));
vi.mock("../../../lib/mobile/appLifecycle", () => ({ addNativeAppStateListener: async (listener: (active: boolean) => void) => {
  state.nativeListeners.add(listener); return async () => { state.nativeListeners.delete(listener); };
} }));
vi.mock("../../../lib/dailyReceipts", () => ({
  getOrCreateDailyReceipt: (...args: unknown[]) => state.restore(...args),
  openDailyReceipt: (...args: unknown[]) => state.open(...args),
  getCachedDailyReceipt: () => null,
  subscribeToDailyReceiptFallbacks: () => () => undefined,
  parseServerDailyKey: (day: string) => new Date(`${day}T12:00:00`),
}));
vi.mock("../../../components/mascot/HintGuide", () => ({ HintGuideSlot: () => null, useHintGuideGesture: () => undefined }));
vi.mock("../../../components/mascot/RoomCompanion", () => ({ HintCorner: () => null }));
vi.mock("../../../components/mascot/useDailyDelivery", () => ({ useDailyDelivery: () => ({ active: false, delivered: false, target: { current: null }, handoff: 1, materialVisible: true }) }));
vi.mock("../../../components/mascot/useDailyReveal", () => ({ useDailyReveal: (options: typeof state.reveal) => {
  state.reveal = options; return { flipped: true, detailsReady: true, rotation: 180, flip: () => options?.onFlip() };
} }));
vi.mock("../../receipt-printer/ReceiptShareDialog", () => ({ DailyReceiptButton: () => null }));
vi.mock("../../readings/localDailyReadings", () => ({
  listLocalDailyReadings: () => [], listLocalDailyReadingMemory: () => [],
  saveLocalDailyReading: () => null, subscribeToLocalDailyReadings: () => () => undefined,
}));

function receipt(opened = false) {
  return { id: "fixture-receipt", anonId: getAnonId(), dailyKey: "2026-11-10", featureType: "daily-card",
    assignedCardId: "17-star", openedAt: opened ? "2026-11-10T12:00:00Z" : null, source: "server", syncStatus: "synced" };
}
function deferred<T>() {
  let resolve!: (value: T) => void, reject!: (reason: unknown) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
const intents = () => state.feedback.mock.calls.map(([intent]) => intent);
beforeEach(() => {
  localStorage.clear(); state.claim.mockReset().mockReturnValue({ awardedCredits: 1 }); state.feedback.mockReset(); state.open.mockReset(); state.restore.mockReset();
  state.reduced = false; state.reveal = null; state.nativeListeners.clear();
  state.restore.mockResolvedValue(receipt()); state.open.mockResolvedValue(receipt(true));
  vi.spyOn(document, "visibilityState", "get").mockReturnValue("visible");
  vi.stubGlobal("ResizeObserver", class { observe() {} unobserve() {} disconnect() {} });
  vi.stubGlobal("IntersectionObserver", class { observe() {} unobserve() {} disconnect() {} });
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

async function home() {
  const view = render(<LanguageProvider><HomeDashboard /></LanguageProvider>);
  await waitFor(() => expect((view.getByTestId("home-reveal-trigger") as HTMLButtonElement).disabled).toBe(false));
  return view;
}
async function opened() {
  const view = await home(); fireEvent.click(view.getByTestId("home-reveal-trigger"));
  await view.findByTestId("home-daily-reveal"); return view;
}

it("acknowledges one accepted request softly and never calls reveal while the server is pending", async () => {
  const pending = deferred<ReturnType<typeof receipt>>(); state.open.mockReturnValue(pending.promise);
  const view = await home(), trigger = view.getByTestId("home-reveal-trigger");
  act(() => { fireEvent.click(trigger); fireEvent.click(trigger); fireEvent.click(trigger); });
  expect(state.open).toHaveBeenCalledOnce(); expect(intents()).toEqual(["soft"]);
  expect(view.queryByTestId("home-daily-reveal")).toBeNull();
  expect(state.claim).not.toHaveBeenCalled();
  await act(async () => pending.resolve(receipt(true)));
  expect(state.claim).toHaveBeenCalledExactlyOnceWith(getAnonId(), "2026-11-10");
});

it.each([false, true])("has one actual reveal milestone with reduced motion=%s and no extra success pulse", async reduced => {
  state.reduced = reduced; await opened();
  act(() => {
    if (!reduced) { state.reveal!.onFlip(); state.reveal!.onFlip(); }
    state.reveal!.onRevealed(); state.reveal!.onRevealed();
  });
  expect(intents()).toEqual(["soft", "reveal"]);
});

it("warns for the current failed request and permits one new reveal after deliberate retry", async () => {
  state.open.mockRejectedValueOnce(new Error("offline"));
  const view = await home(); fireEvent.click(view.getByTestId("home-reveal-trigger"));
  await waitFor(() => expect(intents()).toEqual(["soft", "warning"]));
  expect(view.queryByTestId("home-daily-reveal")).toBeNull();
  fireEvent.click(view.getByTestId("home-reveal-trigger")); await view.findByTestId("home-daily-reveal");
  act(() => state.reveal!.onFlip()); expect(intents()).toEqual(["soft", "warning", "soft", "reveal"]);
});

it("keeps an unconfirmed server payload closed without awarding a check-in", async () => {
  state.open.mockResolvedValue(receipt(false));
  const view = await home(); fireEvent.click(view.getByTestId("home-reveal-trigger"));
  await waitFor(() => expect(intents()).toEqual(["soft", "warning"]));
  expect(view.queryByTestId("home-daily-reveal")).toBeNull();
  expect(state.claim).not.toHaveBeenCalled();
});

it("drops stale flip callbacks after close and keeps restored reopens quiet", async () => {
  const view = await opened(); const late = state.reveal!.onFlip;
  fireEvent.click(view.getByRole("button", { name: /^Close$/ }));
  act(late); expect(intents()).toEqual(["soft"]);
  fireEvent.click(view.getByTestId("home-reveal-trigger")); await view.findByTestId("home-daily-reveal");
  act(() => { state.reveal!.onFlip(); state.reveal!.onRevealed(); });
  expect(intents()).toEqual(["soft", "tap"]); expect(state.open).toHaveBeenCalledOnce();
  expect(state.claim).toHaveBeenCalledOnce();
});

it.each(["resolve", "reject"] as const)("does not announce a late %s after unmount", async outcome => {
  const pending = deferred<ReturnType<typeof receipt>>(); state.open.mockReturnValue(pending.promise);
  const view = await home(); fireEvent.click(view.getByTestId("home-reveal-trigger")); const late = state.reveal!.onFlip;
  view.unmount();
  await act(async () => { if (outcome === "resolve") pending.resolve(receipt(true)); else pending.reject(new Error("offline")); });
  act(late); expect(intents()).toEqual(["soft"]);
});

it.each(["browser", "native", "pagehide"])("does not replay an interrupted request after a brief %s background/return", async source => {
  const pending = deferred<ReturnType<typeof receipt>>(); state.open.mockReturnValue(pending.promise);
  const view = await home(); fireEvent.click(view.getByTestId("home-reveal-trigger"));
  act(() => {
    if (source === "browser") {
      vi.spyOn(document, "visibilityState", "get").mockReturnValue("hidden"); document.dispatchEvent(new Event("visibilitychange"));
      vi.spyOn(document, "visibilityState", "get").mockReturnValue("visible"); document.dispatchEvent(new Event("visibilitychange"));
    } else if (source === "native") {
      state.nativeListeners.forEach(listener => listener(false)); state.nativeListeners.forEach(listener => listener(true));
    } else { window.dispatchEvent(new Event("pagehide")); window.dispatchEvent(new Event("pageshow")); }
  });
  await act(async () => pending.resolve(receipt(true)));
  act(() => { state.reveal!.onFlip(); state.reveal!.onRevealed(); });
  expect(intents()).toEqual(["soft"]);
});

it("only confirms a keep after storage succeeds and deduplicates rapid retry clicks", async () => {
  const view = await opened(); act(() => state.reveal!.onFlip());
  const set = Storage.prototype.setItem;
  const write = vi.spyOn(Storage.prototype, "setItem").mockImplementation(function(this: Storage, key, value) {
    if (key === "hint_local_collection_unlocks_v1") throw new DOMException("Full", "QuotaExceededError");
    set.call(this, key, value);
  });
  fireEvent.click(view.getByTestId("home-save-card")); expect(intents()).toEqual(["soft", "reveal"]);
  expect(view.getByRole("alert").textContent).toContain("Not saved");
  write.mockRestore();
  const save = view.getByTestId("home-save-card");
  act(() => { fireEvent.click(save); fireEvent.click(save); });
  expect(intents()).toEqual(["soft", "reveal", "complete"]);
  expect(JSON.parse(localStorage.getItem("hint_local_collection_unlocks_v1")!)).toHaveLength(1);
});

it("does not celebrate already restored state", async () => {
  state.restore.mockResolvedValue(receipt(true)); const view = await home();
  expect(intents()).toEqual([]);
  fireEvent.click(view.getByTestId("home-reveal-trigger")); await view.findByTestId("home-daily-reveal");
  act(() => { state.reveal!.onFlip(); state.reveal!.onRevealed(); });
  expect(intents()).toEqual(["tap"]); expect(state.open).not.toHaveBeenCalled();
});

it("does not add a reveal cue when reduced motion is enabled after the turn starts", async () => {
  const view = await opened(); act(() => state.reveal!.onFlip());
  state.reduced = true;
  view.rerender(<LanguageProvider><HomeDashboard /></LanguageProvider>);
  act(() => state.reveal!.onRevealed());
  expect(intents()).toEqual(["soft", "reveal"]);
});

it("drops a future turn cue when the dialog was interrupted after the server confirmed", async () => {
  await opened();
  act(() => { state.nativeListeners.forEach(listener => listener(false)); state.nativeListeners.forEach(listener => listener(true)); });
  act(() => { state.reveal!.onFlip(); state.reveal!.onRevealed(); });
  expect(intents()).toEqual(["soft"]);
});

it("does not replay a failed request warning after an interruption", async () => {
  const pending = deferred<ReturnType<typeof receipt>>(); state.open.mockReturnValue(pending.promise);
  const view = await home(); fireEvent.click(view.getByTestId("home-reveal-trigger"));
  act(() => { window.dispatchEvent(new Event("pagehide")); window.dispatchEvent(new Event("pageshow")); });
  await act(async () => pending.reject(new Error("offline")));
  expect(intents()).toEqual(["soft"]);
});
