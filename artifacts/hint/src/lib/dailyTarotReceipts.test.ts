// @vitest-environment jsdom
import { beforeEach, afterEach, expect, it, vi } from "vitest";
const identity = vi.hoisted(() => ({ owner: "receipt-test" }));
vi.mock("./api", () => ({ apiUrl: (path: string) => path, apiFetch: (...args: Parameters<typeof fetch>) => fetch(...args) }));
vi.mock("./identity", () => ({ getAnonId: () => identity.owner, getLocalDateString: () => "2026-09-09" }));
let events: ReturnType<typeof vi.spyOn>;
beforeEach(() => { localStorage.clear(); vi.resetModules(); identity.owner = "receipt-test"; events = vi.spyOn(window, "addEventListener"); });
afterEach(() => {
  for (const [event, listener] of events.mock.calls) if (event === "online") window.removeEventListener(event, listener);
  vi.useRealTimers(); vi.restoreAllMocks(); vi.unstubAllGlobals();
});
const assigned = (extra: object = {}) => ({
  id: "server-receipt", anonymousDeviceId: "server-owner", anonId: "server-owner", dailyKey: "2026-09-09",
  featureType: "daily-card", assignedCardId: "3-empress", orientation: "upright", openedAt: null,
  assignedAt: "2026-09-09T12:00:00.000Z", serverTime: "2026-09-09T12:00:00.000Z",
  expiresAt: "2026-09-10T00:00:00.000Z", ...extra,
});
const ok = (body: unknown) => ({ ok: true, status: 200, json: async () => body });

it("ignores forged synced storage and restores the server assignment after reload", async () => {
  localStorage.setItem("hint_daily_receipt_fallbacks_v1", JSON.stringify([assigned({
    anonId: identity.owner, assignedCardId: "18-moon", openedAt: "2026-09-09T09:00:00Z", source: "server", syncStatus: "synced",
  })]));
  const fetcher = vi.fn().mockResolvedValue(ok(assigned({ openedAt: "2026-09-09T12:00:01Z" }))); vi.stubGlobal("fetch", fetcher);
  let receipts = await import("./dailyReceipts");
  expect(receipts.getCachedDailyReceipt("daily-card", { dailyKey: "2026-09-09" })).toBeNull();
  const first = await receipts.getOrCreateDailyReceipt("daily-card", { fallbackAssignedCardId: "18-moon" });
  expect(first.assignedCardId).toBe("3-empress");
  expect(JSON.parse(fetcher.mock.calls[0][1].body)).toEqual({ featureType: "daily-card" });
  vi.resetModules(); receipts = await import("./dailyReceipts");
  expect((await receipts.getOrCreateDailyReceipt("daily-card")).id).toBe(first.id);
  expect(fetcher).toHaveBeenCalledTimes(2);
});

it.each(["daily-card", "daily-tarot"] as const)("never fabricates an offline %s assignment or reveal", async feature => {
  vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));
  const receipts = await import("./dailyReceipts");
  await expect(receipts.getOrCreateDailyReceipt(feature, { fallbackAssignedCardId: "18-moon" })).rejects.toThrow();
  await expect(receipts.openDailyReceipt(feature, { fallbackAssignedCardId: "18-moon" })).rejects.toThrow();
  expect(receipts.getCachedDailyReceipt(feature)).toBeNull();
  expect(localStorage.getItem("hint_daily_receipt_fallbacks_v1")).toBeNull();
});

it("waits for the saved reveal and deduplicates rapid taps without submitting a chosen card", async () => {
  let finish!: (value: unknown) => void;
  const fetcher = vi.fn().mockResolvedValueOnce(ok(assigned())).mockImplementation(() => new Promise(resolve => { finish = resolve; }));
  vi.stubGlobal("fetch", fetcher);
  const receipts = await import("./dailyReceipts");
  await receipts.getOrCreateDailyReceipt("daily-card");
  const first = receipts.openDailyReceipt("daily-card", { fallbackAssignedCardId: "18-moon", dailyKey: "2026-09-09" });
  const second = receipts.openDailyReceipt("daily-card", { fallbackAssignedCardId: "0-fool", dailyKey: "2026-09-09" });
  expect(fetcher).toHaveBeenCalledTimes(2);
  expect(receipts.getCachedDailyReceipt("daily-card")?.openedAt).toBeNull();
  expect(JSON.parse(fetcher.mock.calls[1][1].body)).toEqual({ featureType: "daily-card", dailyKey: "2026-09-09" });
  expect(fetcher.mock.calls[1][0]).toBe("/api/daily-receipts/open");
  finish(ok(assigned({ openedAt: "2026-09-09T12:00:01.000Z" })));
  expect((await first).assignedCardId).toBe("3-empress");
  expect((await second).openedAt).toBe("2026-09-09T12:00:01.000Z");
});

it("restores the committed result after a lost response and reconnect", async () => {
  let stored = assigned(); let loseResponse = true;
  const fetcher = vi.fn().mockImplementation(async (url: string) => {
    if (url.endsWith("/open")) {
      stored = assigned({ openedAt: "2026-09-09T12:00:01.000Z" });
      if (loseResponse) { loseResponse = false; throw new Error("connection lost after save"); }
    }
    return ok(stored);
  });
  vi.stubGlobal("fetch", fetcher);
  const receipts = await import("./dailyReceipts");
  await receipts.getOrCreateDailyReceipt("daily-card");
  await expect(receipts.openDailyReceipt("daily-card")).rejects.toThrow("connection lost");
  expect(receipts.getCachedDailyReceipt("daily-card")?.openedAt).toBeNull();
  await receipts.syncPendingDailyReceipts();
  expect(receipts.getCachedDailyReceipt("daily-card")?.openedAt).toBe(stored.openedAt);
  expect((await receipts.openDailyReceipt("daily-card")).id).toBe(stored.id);
  expect(fetcher.mock.calls.every(([url]) => !String(url).endsWith("/sync"))).toBe(true);
});

it("a late unopened response cannot undo a completed server reveal", async () => {
  let finish!: (value: unknown) => void;
  vi.stubGlobal("fetch", vi.fn()
    .mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }))
    .mockResolvedValueOnce(ok(assigned({ openedAt: "2026-09-09T12:00:01.000Z", serverTime: "2026-09-09T12:00:01.000Z" }))));
  const receipts = await import("./dailyReceipts");
  const read = receipts.getOrCreateDailyReceipt("daily-card");
  await receipts.openDailyReceipt("daily-card");
  finish(ok(assigned()));
  expect((await read).openedAt).toBe("2026-09-09T12:00:01.000Z");
  expect(receipts.getCachedDailyReceipt("daily-card")?.openedAt).toBe("2026-09-09T12:00:01.000Z");
});

it("ignores a changed device clock and rolls over using server time at UTC midnight", async () => {
  vi.useFakeTimers({ toFake: ["Date", "performance"] }); vi.setSystemTime(new Date("2099-01-01T12:00:00Z"));
  const fetcher = vi.fn().mockResolvedValue(ok(assigned({ serverTime: "2026-09-09T23:59:59.000Z" }))); vi.stubGlobal("fetch", fetcher);
  const receipts = await import("./dailyReceipts");
  await receipts.getOrCreateDailyReceipt("daily-card");
  expect(receipts.getDailyTarotDay()).toBe("2026-09-09");
  vi.setSystemTime(new Date("2000-01-01T12:00:00Z"));
  expect(receipts.getDailyTarotDay()).toBe("2026-09-09");
  vi.advanceTimersByTime(1000);
  expect(receipts.getDailyTarotDay()).toBe("2026-09-10");
  expect(receipts.getCachedDailyReceipt("daily-card")).toBeNull();
  expect(JSON.parse(fetcher.mock.calls[0][1].body)).not.toHaveProperty("dailyKey");
});

it("does not replay forged storage into the authoritative sync endpoint", async () => {
  localStorage.setItem("hint_daily_receipt_fallbacks_v1", JSON.stringify([assigned({
    anonId: identity.owner, assignedCardId: "18-moon", openedAt: "2026-09-09T09:00:00Z", syncStatus: "pending",
  })]));
  const fetcher = vi.fn(); vi.stubGlobal("fetch", fetcher);
  const receipts = await import("./dailyReceipts");
  await receipts.syncPendingDailyReceipts();
  expect(fetcher).not.toHaveBeenCalled();
});

it("rejects a stale result after switching profiles", async () => {
  let finish!: (value: unknown) => void;
  vi.stubGlobal("fetch", vi.fn().mockImplementation(() => new Promise(resolve => { finish = resolve; })));
  const receipts = await import("./dailyReceipts");
  const reading = receipts.getOrCreateDailyReceipt("daily-card");
  identity.owner = "another-profile"; finish(ok(assigned()));
  await expect(reading).rejects.toThrow("owner changed");
  expect(receipts.getCachedDailyReceipt("daily-card", { dailyKey: "2026-09-09" })).toBeNull();
});

it("restores a server reading when local storage is full", async () => {
  vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new Error("full"); });
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(ok(assigned({ openedAt: "2026-09-09T12:00:01.000Z" }))));
  const receipts = await import("./dailyReceipts");
  const result = await receipts.getOrCreateDailyReceipt("daily-card");
  expect(result.source).toBe("server");
  expect(receipts.getCachedDailyReceipt("daily-card")?.id).toBe(result.id);
});

it("does not deduplicate a new-day request behind a slow previous-day response", async () => {
  vi.useFakeTimers({ toFake: ["Date", "performance"] });
  let finish!: (value: unknown) => void;
  const fetcher = vi.fn()
    .mockResolvedValueOnce(ok(assigned({ serverTime: "2026-09-09T23:59:59.000Z" })))
    .mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }))
    .mockResolvedValueOnce(ok(assigned({ id: "next-day", dailyKey: "2026-09-10", serverTime: "2026-09-10T00:00:00.000Z", expiresAt: "2026-09-11T00:00:00.000Z" })));
  vi.stubGlobal("fetch", fetcher);
  const receipts = await import("./dailyReceipts");
  await receipts.getOrCreateDailyReceipt("daily-card");
  const old = receipts.getOrCreateDailyReceipt("daily-card");
  vi.advanceTimersByTime(1000);
  expect((await receipts.getOrCreateDailyReceipt("daily-card")).id).toBe("next-day");
  finish(ok(assigned({ serverTime: "2026-09-09T23:59:59.000Z" })));
  await old;
  expect(receipts.getDailyTarotDay()).toBe("2026-09-10");
  expect(receipts.getCachedDailyReceipt("daily-card")?.id).toBe("next-day");
});

it.each(["daily-card", "daily-tarot"] as const)("reconnect recovers %s when the offline request is still pending", async feature => {
  let fail!: (reason: Error) => void;
  const fetcher = vi.fn()
    .mockImplementationOnce(() => new Promise((_resolve, reject) => { fail = reject; }))
    .mockResolvedValue(ok(assigned({ featureType: feature })));
  vi.stubGlobal("fetch", fetcher);
  const receipts = await import("./dailyReceipts");
  // Attach the rejection handler before settling the controlled offline request.
  const original = receipts.getOrCreateDailyReceipt(feature).catch(() => null);
  window.dispatchEvent(new Event("online"));
  const restored = receipts.getOrCreateDailyReceipt(feature).catch(() => null);
  expect(fetcher).toHaveBeenCalledTimes(1);
  fail(new Error("old connection failed after reconnect"));
  expect((await restored)?.id).toBe("server-receipt");
  expect((await original)?.id).toBe("server-receipt");
  expect(fetcher).toHaveBeenCalledTimes(2);
  expect(receipts.getCachedDailyReceipt(feature)?.openedAt).toBeNull();
  expect(fetcher.mock.calls.every(([url, options]) => String(url).endsWith("/get-or-create") &&
    JSON.stringify(JSON.parse(options.body)) === JSON.stringify({ featureType: feature }))).toBe(true);
});

it("bounds recovery to one fresh read when the connection remains unavailable", async () => {
  let fail!: (reason: Error) => void;
  const fetcher = vi.fn()
    .mockImplementationOnce(() => new Promise((_resolve, reject) => { fail = reject; }))
    .mockRejectedValue(new Error("still offline"));
  vi.stubGlobal("fetch", fetcher);
  const receipts = await import("./dailyReceipts");
  const result = receipts.getOrCreateDailyReceipt("daily-card").catch(error => error.message);
  window.dispatchEvent(new Event("online"));
  window.dispatchEvent(new Event("online"));
  fail(new Error("old connection"));
  expect(await result).toBe("still offline");
  expect(fetcher).toHaveBeenCalledTimes(2);
  expect(receipts.getCachedDailyReceipt("daily-card")).toBeNull();
});

it("does not retry a pending read for an owner who changed during reconnect", async () => {
  let fail!: (reason: Error) => void;
  const fetcher = vi.fn().mockImplementation(() => new Promise((_resolve, reject) => { fail = reject; }));
  vi.stubGlobal("fetch", fetcher);
  const receipts = await import("./dailyReceipts");
  const result = receipts.getOrCreateDailyReceipt("daily-card").catch(error => error.message);
  window.dispatchEvent(new Event("online"));
  identity.owner = "another-profile";
  fail(new Error("old connection"));
  expect(await result).toBe("old connection");
  expect(fetcher).toHaveBeenCalledTimes(1);
});

it("reconnect does not repeat an in-flight reveal whose response is lost", async () => {
  let fail!: (reason: Error) => void;
  let opens = 0;
  const fetcher = vi.fn().mockImplementation((url: string) => {
    if (url.endsWith("/open")) {
      opens++;
      return new Promise((_resolve, reject) => { fail = reject; });
    }
    return Promise.resolve(ok(assigned()));
  });
  vi.stubGlobal("fetch", fetcher);
  const receipts = await import("./dailyReceipts");
  const result = receipts.openDailyReceipt("daily-card").catch(error => error.message);
  window.dispatchEvent(new Event("online"));
  fail(new Error("response lost"));
  expect(await result).toBe("response lost");
  expect(opens).toBe(1);
});
