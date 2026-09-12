// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { saveLocalCollectionUnlock, getCardCollectionSummary } from "./cardCollection";
beforeEach(() => localStorage.clear());
afterEach(() => vi.restoreAllMocks());
it("does not report a successful collection save when storage is full; retry persists once", () => {
  const failure = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new Error("full"); });
  expect(saveLocalCollectionUnlock("7-chariot", "animal", "test")).toBeNull();
  failure.mockRestore();
  expect(saveLocalCollectionUnlock("7-chariot", "animal", "test")).not.toBeNull();
  saveLocalCollectionUnlock("7-chariot", "animal", "test");
  expect(JSON.parse(localStorage.getItem("hint_local_collection_unlocks_v1")!)).toHaveLength(1);
});
it("uses the saved card identity when a daily reading has a translated name", () => {
  localStorage.setItem("hint_local_daily_readings", JSON.stringify([{ id: "daily-fixture", anonId: "test", cardId: "3-empress", cardName: "皇后", createdAt: "2026-09-09T12:00:00Z" }]));
  expect(getCardCollectionSummary("test").cards.find(card => card.cardId === "3-empress")?.unlocked).toBe(true);
});
