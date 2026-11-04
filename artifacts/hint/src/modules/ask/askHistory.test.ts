// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { askHistoryKey, listAskHistory, readActiveAskConversation, saveAskConversation, type AskConversation } from "./askHistory";

const conversation = (id: string, size = 200): AskConversation => ({
  id, anonId: "owner", createdAt: "2026-09-10", updatedAt: `2026-09-10T00:00:${id.padStart(2, "0")}Z`,
  messages: [{ id: `${id}-q`, role: "user", content: `Question ${id} `.padEnd(size, "."), createdAt: "2026-09-10" }],
});
beforeEach(() => localStorage.clear());
afterEach(() => vi.restoreAllMocks());

it("drops the oldest saved conversations, never the current one, when storage is full", () => {
  for (let i = 1; i <= 6; i++) expect(saveAskConversation(conversation(String(i)))).toBe(true);
  const write = Storage.prototype.setItem;
  vi.spyOn(Storage.prototype, "setItem").mockImplementation(function (this: Storage, key: string, value: string) {
    if (key === askHistoryKey("owner") && value.length > 900) throw new DOMException("The quota has been exceeded.", "QuotaExceededError");
    return write.call(this, key, value);
  });
  expect(saveAskConversation(conversation("7"))).toBe(true);
  const ids = listAskHistory("owner").map(row => row.id);
  expect(ids[0]).toBe("7"); expect(ids).toEqual(["7", "6", "5", "4"].slice(0, ids.length));
  expect(ids.length).toBeGreaterThan(1);
  expect(readActiveAskConversation("owner")?.id).toBe("7");
});

it("reports failure when even the current conversation alone cannot be stored", () => {
  saveAskConversation(conversation("1"));
  vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new DOMException("Full", "QuotaExceededError"); });
  expect(saveAskConversation(conversation("2"))).toBe(false);
  vi.restoreAllMocks();
  expect(listAskHistory("owner").map(row => row.id)).toEqual(["1"]);
});

it("does not delete older conversations for errors other than a full storage quota", () => {
  for (let i = 1; i <= 3; i++) saveAskConversation(conversation(String(i)));
  const write = Storage.prototype.setItem;
  vi.spyOn(Storage.prototype, "setItem").mockImplementation(function (this: Storage, key: string, value: string) {
    if (key === askHistoryKey("owner")) throw new DOMException("Denied", "SecurityError");
    return write.call(this, key, value);
  });
  expect(saveAskConversation(conversation("4"))).toBe(false);
  vi.restoreAllMocks();
  expect(listAskHistory("owner").map(row => row.id)).toEqual(["3", "2", "1"]);
});
