// @vitest-environment jsdom
import { beforeEach, afterEach, expect, it, vi } from "vitest";
vi.mock("./api", () => ({ apiUrl: (path: string) => path, apiFetch: (...args: Parameters<typeof fetch>) => fetch(...args) }));
vi.mock("./identity", () => ({ getAnonId: () => "receipt-test", getLocalDateString: () => "2026-09-09" }));
beforeEach(() => { localStorage.clear(); vi.resetModules(); });
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });
it("retains the first offline reveal across reload and reconnect, with idempotent submissions", async () => {
  const fetcher = vi.fn().mockRejectedValue(new Error("offline")); vi.stubGlobal("fetch", fetcher);
  let receipts = await import("./dailyReceipts");
  const first = await receipts.openDailyReceipt("daily-card", { fallbackAssignedCardId: "3-empress" });
  expect(first.assignedCardId).toBe("3-empress"); expect(first.persistence).toBe("local");
  vi.resetModules(); receipts = await import("./dailyReceipts");
  fetcher.mockImplementation(async (_url, init) => ({ ok: true, status: 200, json: async () => ({ ...first, ...JSON.parse(init.body) }) }));
  const next = await receipts.getOrCreateDailyReceipt("daily-card", { fallbackAssignedCardId: "18-moon" });
  expect(next.assignedCardId).toBe("3-empress"); expect(next.syncStatus).toBe("synced");
  expect(JSON.parse(fetcher.mock.calls.at(-1)![1].body).assignedCardId).toBe("3-empress");
});
it("409 retains the local identity, while other days, people and features stay independent", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 409 }));
  const receipts = await import("./dailyReceipts");
  const local = await receipts.openDailyReceipt("daily-card", { fallbackAssignedCardId: "3-empress" });
  expect(local.syncStatus).toBe("conflict");
  expect((await receipts.getOrCreateDailyReceipt("daily-card", { fallbackAssignedCardId: "18-moon" })).assignedCardId).toBe("3-empress");
  expect(receipts.getCachedDailyReceipt("animal-tarot")).toBeNull();
  expect(receipts.getCachedDailyReceipt("daily-card", { dailyKey: "2026-09-10" })).toBeNull();
  expect(receipts.getCachedDailyReceipt("daily-card", { anonId: "other" })).toBeNull();
});
it("storage failure is reported and rapid reveal cannot start duplicate syncs", async () => {
  vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new Error("full"); });
  let finish!: (value: unknown) => void;
  const fetcher = vi.fn(() => new Promise(resolve => { finish = resolve; })); vi.stubGlobal("fetch", fetcher);
  const receipts = await import("./dailyReceipts");
  const first = receipts.openDailyReceipt("daily-card", { fallbackAssignedCardId: "3-empress" });
  const second = receipts.openDailyReceipt("daily-card", { fallbackAssignedCardId: "18-moon" });
  expect(fetcher).toHaveBeenCalledTimes(1);
  finish({ ok: false, status: 503 });
  expect((await first).persistence).toBe("memory"); expect((await second).assignedCardId).toBe("3-empress");
});
