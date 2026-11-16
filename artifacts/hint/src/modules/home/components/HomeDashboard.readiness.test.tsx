/** @vitest-environment jsdom */
import { act, cleanup, render, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { HomeDashboard } from "./HomeDashboard";
import { LanguageProvider } from "../../../lib/i18n";
import { getDailyPullById } from "../data/dailyPulls";
const state = vi.hoisted(() => ({ day: "2026-11-10", restore: vi.fn(), open: vi.fn() }));
vi.mock("../../../lib/useDailyTarotDay", () => ({ useDailyTarotDay: () => state.day }));
vi.mock("../../../lib/useProfile", () => ({ useProfile: () => ({ profile: null }) }));
vi.mock("../../../lib/dailyReceipts", () => ({ getOrCreateDailyReceipt: () => state.restore(), openDailyReceipt: () => state.open(), getCachedDailyReceipt: () => null, subscribeToDailyReceiptFallbacks: () => () => undefined, parseServerDailyKey: (day: string) => new Date(`${day}T12:00:00`) }));
vi.mock("../../../components/mascot/HintGuide", () => ({ HintGuideSlot: () => null, useHintGuideGesture: () => undefined }));
vi.mock("../../../components/mascot/RoomCompanion", () => ({ HintCorner: () => null }));
vi.mock("../../../components/mascot/useDailyDelivery", () => ({ useDailyDelivery: () => ({ active: false, delivered: false, target: { current: null }, handoff: 1, materialVisible: true }) }));
vi.mock("../../../components/mascot/useDailyReveal", () => ({ useDailyReveal: () => ({ flipped: false, detailsReady: false, rotation: 0, flip: () => undefined }) }));
vi.mock("../../../lib/feedback", () => ({ triggerFeedback: () => undefined }));
vi.mock("../../../lib/motionPolicy", () => ({ useMotionPolicy: () => ({ reduced: true, pageVisible: true }) }));
vi.mock("../../../lib/mobile/appLifecycle", () => ({ addNativeAppStateListener: async () => async () => undefined }));
vi.mock("../../receipt-printer/ReceiptShareDialog", () => ({ DailyReceiptButton: () => null }));
vi.mock("../../readings/localDailyReadings", () => ({ listLocalDailyReadings: () => [], listLocalDailyReadingMemory: () => [], saveLocalDailyReading: () => null, subscribeToLocalDailyReadings: () => () => undefined }));
function receipt(opened = false, day = state.day) { return { id: "fictional", anonId: "reader", dailyKey: day, assignedCardId: "17-star", source: "server", openedAt: opened ? `${day}T12:00:00Z` : null, syncStatus: "synced" }; }
function deferred() { let resolve!: (v: ReturnType<typeof receipt>) => void; const promise = new Promise<ReturnType<typeof receipt>>(r => { resolve = r; }); return { promise, resolve }; }
const theme = () => document.querySelector(".hint-home-theme-title")!.textContent!.trim();
const mount = () => render(<LanguageProvider><HomeDashboard /></LanguageProvider>);
beforeEach(() => { localStorage.clear(); state.day = "2026-11-10"; state.restore.mockReset(); state.open.mockReset(); vi.stubGlobal("ResizeObserver", class { observe() {} unobserve() {} disconnect() {} }); vi.stubGlobal("IntersectionObserver", class { observe() {} unobserve() {} disconnect() {} }); });
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

it.each([false, true])("does not publish a provisional theme before authoritative restore (opened=%s)", async opened => {
  const pending = deferred(); state.restore.mockReturnValue(pending.promise); const view = mount();
  expect(theme()).toBe(""); expect(view.getByText("Checking today's signal...")).toBeTruthy();
  await act(async () => pending.resolve(receipt(opened)));
  expect(theme()).toBe("Hope"); expect(document.querySelector(".hint-home-theme-copy")!.textContent).toBe("Let one hopeful action be enough.");
});
it("keeps unavailable copy accurate and restores the theme after reconnect", async () => {
  state.restore.mockRejectedValueOnce(new Error("offline")).mockResolvedValue(receipt()); const view = mount();
  await view.findByText("We couldn't connect to Today's Hint. Reconnect to load your card."); expect(theme()).toBe("");
  await act(async () => window.dispatchEvent(new Event("online"))); await waitFor(() => expect(theme()).toBe("Hope"));
});
it("uses the first Japanese keyword for the compact theme without changing the full card copy", async () => {
  localStorage.setItem("hint-language", "ja"); state.restore.mockResolvedValue(receipt());
  mount(); await waitFor(() => expect(theme()).toBe("希望"));
  expect(getDailyPullById("17-star", "ja")!.keyword).toBe("希望・再生・ひらめき");
});
it("does not expose yesterday's theme during rollover or accept its late response", async () => {
  state.restore.mockResolvedValueOnce(receipt()); const view = mount(); await waitFor(() => expect(theme()).toBe("Hope"));
  const pending = deferred(); state.restore.mockReturnValue(pending.promise); state.day = "2026-11-11";
  view.rerender(<LanguageProvider><HomeDashboard /></LanguageProvider>); expect(theme()).toBe("");
  await act(async () => pending.resolve(receipt(false, "2026-11-10"))); expect(theme()).toBe("");
});
