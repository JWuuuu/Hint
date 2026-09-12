// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { ReactNode } from "react";
import { AnimalTarotView } from "./AnimalTarotView";

const mocks = vi.hoisted(() => ({ closed: false, onLeave: undefined as (() => void) | undefined, open: vi.fn(), receipt: {
  anonId: "animal-owner", anonymousDeviceId: "animal-owner", featureType: "animal-tarot", dailyKey: "2026-09-10", assignedCardId: "black-cat",
  assignedAt: "2026-09-10T12:00:00Z", expiresAt: "2026-09-11T00:00:00Z", openedAt: "2026-09-10T12:00:00Z", source: "local-fallback", syncStatus: "pending",
} }));
vi.mock("../../components/app/roomVisits", () => ({ roomVisitWasClosed: () => mocks.closed, markRoomVisitStarted: () => { mocks.closed = false; } }));
vi.mock("../../components/app/RoomVisitBoundary", () => ({ useRoomVisit: (options: { onLeave?: () => void }) => { mocks.onLeave = options.onLeave; } }));
vi.mock("../../lib/identity", () => ({ getAnonId: () => "animal-owner", getLocalDateString: () => "2026-09-10" }));
vi.mock("../../lib/useLocalDay", () => ({ useLocalDay: () => "2026-09-10" }));
vi.mock("../../lib/motionPolicy", () => ({ useMotionPolicy: () => ({ reduced: true, pageVisible: true }) }));
vi.mock("../../lib/i18n", () => ({ useLanguage: () => ({ language: "en", t: (key: string) => key }) }));
vi.mock("../../lib/LocalizedText", () => ({ translateText: (text: string) => text, LocalizedText: ({ text }: { text: string }) => text }));
vi.mock("../../lib/dailyReceipts", () => ({ getOrCreateDailyReceipt: async () => mocks.receipt, getCachedDailyReceipt: () => mocks.receipt, openDailyReceipt: mocks.open, subscribeToDailyReceiptFallbacks: () => () => {} }));
vi.mock("../../shared/tarot/cardCollection", () => ({ saveLocalCollectionUnlock: () => true }));
vi.mock("../../components/app/AppChrome", () => ({ AppScreen: ({ children }: { children: ReactNode }) => <main>{children}</main>, GlassPanel: ({ children }: { children: ReactNode }) => <div>{children}</div>, SpaceNavigation: () => null, SectionLabel: ({ children }: { children: ReactNode }) => <h2>{children}</h2> }));
beforeEach(() => { mocks.closed = false; mocks.open.mockReset(); mocks.open.mockResolvedValue(mocks.receipt); });
afterEach(() => { cleanup(); vi.useRealTimers(); });

it("starts a closed visit at the card back and reveals the same locked animal", async () => {
  mocks.closed = true;
  const first = render(<AnimalTarotView />);
  await screen.findByRole("button", { name: "Draw animal card" });
  expect(screen.queryByText("Today's animal")).toBeNull();
  expect(first.container.querySelector(".animal-card-front")?.getAttribute("aria-hidden")).toBe("true");
  expect((first.container.querySelector(".animal-card-front") as HTMLElement).style.visibility).toBe("hidden");
  fireEvent.click(screen.getByRole("button", { name: "Draw animal card" }));
  await screen.findByRole("heading", { name: "Black Cat" });
  expect((first.container.querySelector(".animal-card-front") as HTMLElement).style.visibility).toBe("visible");
  expect(mocks.closed).toBe(false);
  expect(mocks.open).toHaveBeenCalledWith("animal-tarot", expect.objectContaining({ fallbackAssignedCardId: "black-cat" }));
  first.unmount();
  render(<AnimalTarotView />); await screen.findByRole("heading", { name: "Black Cat" });
  expect(mocks.receipt.assignedCardId).toBe("black-cat");
});

it("ignores a departed visit's late sync result and keeps the daily lock", async () => {
  let finish!: (result: object) => void;
  mocks.open.mockImplementation(() => new Promise(resolve => { finish = resolve; })); mocks.closed = true;
  const view = render(<AnimalTarotView />);
  await screen.findByRole("button", { name: "Draw animal card" });
  fireEvent.click(screen.getByRole("button", { name: "Draw animal card" }));
  act(() => mocks.onLeave?.()); view.unmount(); mocks.closed = true;
  render(<AnimalTarotView />);
  await act(async () => finish({ ...mocks.receipt, assignedCardId: "white-stag" }));
  await screen.findByRole("button", { name: "Draw animal card" });
  expect(screen.queryByRole("heading", { name: "White Stag" })).toBeNull();
  expect(mocks.receipt.assignedCardId).toBe("black-cat");
});
