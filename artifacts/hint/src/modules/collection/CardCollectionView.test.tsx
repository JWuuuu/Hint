// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { ReactNode } from "react";
import { CardCollectionView } from "./CardCollectionView";
const mocks = vi.hoisted(() => ({ getReceipt: vi.fn(), unlock: vi.fn(), open: vi.fn(), cached: null as object | null, sync: (() => {}) as () => void }));
const fixtureCard = { cardId: "0-fool", name: "The Fool", image: "/fixture.jpg", rare: true, unlocked: true, sources: [], count: 1, lastSeenAt: "2026-09-09T12:00:00" };
vi.mock("../../lib/i18n", () => ({ useLanguage: () => ({ language: "ja", t: (key: string) => key }) }));
vi.mock("../../lib/LocalizedText", () => ({ LocalizedText: ({ text }: { text: string }) => <>{text}</> }));
vi.mock("wouter", () => ({ Link: ({ children, href }: { children: ReactNode; href: string }) => <a href={href}>{children}</a> }));
vi.mock("../../components/app/AppChrome", async importOriginal => ({
  ...await importOriginal<typeof import("../../components/app/AppChrome")>(),
  AppScreen: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  GlassPanel: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  SectionLabel: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));
vi.mock("../../shared/hooks/useCardCollection", () => ({ useCardCollection: () => ({ total: 2, unlocked: 1, locked: 1, rareUnlocked: 1, cards: [fixtureCard, { ...fixtureCard, cardId: "1-magician", name: "The Magician", unlocked: false }], recent: [fixtureCard] }) }));
vi.mock("../../lib/identity", () => ({ getAnonId: () => "fixture", getLocalDateString: (date = new Date()) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}` }));
vi.mock("../../lib/clearHistory", () => ({ wasDailyHistoryCleared: () => false }));
vi.mock("../../lib/dailyReceipts", () => ({ getOrCreateDailyReceipt: (...args: unknown[]) => mocks.getReceipt(...args), getCachedDailyReceipt: () => mocks.cached, openDailyReceipt: (...args: unknown[]) => mocks.open(...args), subscribeToDailyReceiptFallbacks: (callback: () => void) => { mocks.sync = callback; return () => {}; } }));
vi.mock("../../shared/tarot/cardCollection", () => ({ saveLocalCollectionUnlock: (...args: unknown[]) => mocks.unlock(...args), getDailyCollectionReward: () => ({ cardId: new Date().getDate() === 9 ? "0-fool" : "1-magician", expiresAt: "2026-09-10T00:00:00" }) }));
vi.mock("./RareCardUnlock", () => ({ RareCardUnlock: ({ card, onUnlock }: { card: { cardId: string; name: string }; onUnlock: (id: string) => void }) => <button data-testid="reward" onClick={() => onUnlock(card.cardId)}>{card.name}</button> }));
beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(new Date(2026, 8, 9, 23, 59, 50)); mocks.cached = null; mocks.getReceipt.mockReset(); mocks.open.mockReset(); mocks.unlock.mockReset().mockReturnValue({}); });
afterEach(() => { cleanup(); vi.useRealTimers(); vi.restoreAllMocks(); });
it("changes reward on midnight while ignoring yesterday's late assignment and localizes recent card names", async () => {
  let old!: (value: object) => void;
  mocks.getReceipt.mockImplementationOnce(() => new Promise(resolve => { old = resolve; }));
  mocks.getReceipt.mockResolvedValue({ assignedCardId: "1-magician", dailyKey: "2026-09-10" });
  render(<CardCollectionView />);
  expect(screen.getByTestId("reward").textContent).toBe("愚者");
  expect(screen.getAllByAltText("愚者").length).toBeGreaterThan(1);
  await act(async () => vi.advanceTimersByTimeAsync(15000));
  expect(mocks.getReceipt.mock.calls[1][1].dailyKey).toBe("2026-09-10");
  expect(screen.getByTestId("reward").textContent).toBe("魔術師");
  await act(async () => old({ assignedCardId: "0-fool", dailyKey: "2026-09-09" }));
  expect(screen.getByTestId("reward").textContent).toBe("魔術師");
});
it("keeps collection retry visible until the actual unlock is persisted", async () => {
  mocks.getReceipt.mockResolvedValue({ assignedCardId: "0-fool", dailyKey: "2026-09-09" });
  mocks.open.mockResolvedValue({ assignedCardId: "0-fool", dailyKey: "2026-09-09", openedAt: "2026-09-09T23:59:50" });
  mocks.unlock.mockReturnValueOnce(null).mockReturnValue({});
  render(<CardCollectionView />); await act(async () => {});
  await act(async () => fireEvent.click(screen.getByTestId("reward")));
  expect(screen.getByRole("button", { name: "quality.saveRetry" })).toBeTruthy();
  await act(async () => fireEvent.click(screen.getByRole("button", { name: "quality.saveRetry" })));
  expect(screen.queryByRole("button", { name: "quality.saveRetry" })).toBeNull();
});
