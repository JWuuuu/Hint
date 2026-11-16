// @vitest-environment jsdom
import { beforeEach, afterEach, expect, it, vi } from "vitest";
vi.mock("./api", () => ({ apiUrl: (path: string) => path, apiFetch: (...args: Parameters<typeof fetch>) => fetch(...args) }));
vi.mock("./identity", () => ({ getAnonId: () => "receipt-test", getLocalDateString: () => "2026-09-09" }));
beforeEach(() => { localStorage.clear(); vi.resetModules(); });
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });
it("retains the first offline reveal across reload and reconnect, with idempotent submissions", async () => {
  const fetcher = vi.fn().mockRejectedValue(new Error("offline")); vi.stubGlobal("fetch", fetcher);
  let receipts = await import("./dailyReceipts");
  const first = await receipts.openDailyReceipt("animal-tarot", { fallbackAssignedCardId: "moon-moth" });
  expect(first.assignedCardId).toBe("moon-moth"); expect(first.persistence).toBe("local");
  vi.resetModules(); receipts = await import("./dailyReceipts");
  fetcher.mockImplementation(async (_url, init) => ({ ok: true, status: 200, json: async () => ({ ...first, ...JSON.parse(init.body) }) }));
  const next = await receipts.getOrCreateDailyReceipt("animal-tarot", { fallbackAssignedCardId: "black-cat" });
  expect(next.assignedCardId).toBe("moon-moth"); expect(next.syncStatus).toBe("synced");
  expect(JSON.parse(fetcher.mock.calls.at(-1)![1].body).assignedCardId).toBe("moon-moth");
});
it("409 retains the local identity, while other days, people and features stay independent", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 409 }));
  const receipts = await import("./dailyReceipts");
  const local = await receipts.openDailyReceipt("animal-tarot", { fallbackAssignedCardId: "moon-moth" });
  expect(local.syncStatus).toBe("conflict");
  expect((await receipts.getOrCreateDailyReceipt("animal-tarot", { fallbackAssignedCardId: "black-cat" })).assignedCardId).toBe("moon-moth");
  expect(receipts.getCachedDailyReceipt("sky-deck")).toBeNull();
  expect(receipts.getCachedDailyReceipt("animal-tarot", { dailyKey: "2026-09-10" })).toBeNull();
  expect(receipts.getCachedDailyReceipt("animal-tarot", { anonId: "other" })).toBeNull();
});
it("storage failure is reported and rapid reveal cannot start duplicate syncs", async () => {
  vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new Error("full"); });
  let finish!: (value: unknown) => void;
  const fetcher = vi.fn(() => new Promise(resolve => { finish = resolve; })); vi.stubGlobal("fetch", fetcher);
  const receipts = await import("./dailyReceipts");
  const first = receipts.openDailyReceipt("animal-tarot", { fallbackAssignedCardId: "moon-moth" });
  const second = receipts.openDailyReceipt("animal-tarot", { fallbackAssignedCardId: "black-cat" });
  expect(fetcher).toHaveBeenCalledTimes(1);
  finish({ ok: false, status: 503 });
  expect((await first).persistence).toBe("memory"); expect((await second).assignedCardId).toBe("moon-moth");
});
it("ignores damaged rows in the fallback store instead of failing the lookup", async () => {
  const good = { anonId: "receipt-test", featureType: "animal-tarot", dailyKey: "2026-09-09", assignedCardId: "moon-moth", source: "local-fallback", syncStatus: "pending" };
  const untrustedDaily = { ...good, featureType: "daily-card", assignedCardId: "3-empress" };
  localStorage.setItem("hint_daily_receipt_fallbacks_v1", JSON.stringify([null, 7, "x", {}, good, untrustedDaily]));
  const receipts = await import("./dailyReceipts");
  expect(receipts.getCachedDailyReceipt("animal-tarot")?.assignedCardId).toBe("moon-moth");
  expect(receipts.getCachedDailyReceipt("daily-card", { dailyKey: good.dailyKey })).toBeNull();
  localStorage.setItem("hint_daily_receipt_fallbacks_v1", "42");
  vi.resetModules();
  expect((await import("./dailyReceipts")).getCachedDailyReceipt("animal-tarot")).toBeNull();
});
