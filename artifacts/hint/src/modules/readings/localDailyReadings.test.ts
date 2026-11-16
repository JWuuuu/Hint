// @vitest-environment jsdom
import { beforeEach, expect, it, vi } from "vitest";
vi.mock("../../lib/identity", () => ({ getAnonId: () => "daily-test", getLocalDateString: () => "2026-09-09" }));
vi.mock("../../lib/clearHistory", () => ({ wasDailyHistoryCleared: () => false }));
beforeEach(() => { localStorage.clear(); vi.resetModules(); });

it("skips damaged rows in the local daily store and keeps the readable ones", async () => {
  const good = { id: "r1", anonId: "daily-test", source: "daily-pull", cardName: "The Star", whisper: "", spreadType: "daily", createdAt: "2026-09-09T12:00:00.000Z" };
  localStorage.setItem("hint_local_daily_readings", JSON.stringify([null, 7, "x", {}, good]));
  const store = await import("./localDailyReadings");
  expect(store.listLocalDailyReadings().map((r) => r.id)).toEqual(["r1"]);
  localStorage.setItem("hint_local_daily_readings", "42");
  vi.resetModules();
  expect((await import("./localDailyReadings")).listLocalDailyReadings()).toEqual([]);
});
