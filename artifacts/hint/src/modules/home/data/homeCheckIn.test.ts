// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const OWNER = "check-in-owner";
const PREFIX = `hint_home_checkin_v1:${OWNER}:`;
const setDay = (date: string) => vi.setSystemTime(new Date(`${date}T12:00:00`));

beforeEach(() => {
  vi.resetModules();
  localStorage.clear();
  sessionStorage.clear();
  localStorage.setItem("hint_anon_id", OWNER);
  vi.useFakeTimers();
  setDay("2026-11-03");
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe("home check-in", () => {
  it("reports the third-day reward exactly once, including after reopening the app", async () => {
    const first = await import("./homeCheckIn");
    for (const date of ["2026-11-01", "2026-11-02"]) {
      setDay(date);
      first.recordHomeCheckIn(OWNER, date);
    }
    setDay("2026-11-03");
    const claimed = first.claimHomeCheckIn(OWNER, "2026-11-03");
    expect(claimed.awardedCredits).toBe(2);
    expect(claimed.progress).toMatchObject({ todayCompleted: true, todayCredits: 2, totalCredits: 4 });
    expect(first.claimHomeCheckIn(OWNER, "2026-11-03").awardedCredits).toBe(0);
    vi.resetModules();
    const reopened = await import("./homeCheckIn");
    expect(reopened.claimHomeCheckIn(OWNER, "2026-11-03")).toEqual({
      progress: claimed.progress,
      awardedCredits: 0,
    });
  });

  it("does not report another reward when a session-only claim is retried or persisted", async () => {
    const module = await import("./homeCheckIn");
    const original = Storage.prototype.setItem;
    const write = vi.spyOn(Storage.prototype, "setItem").mockImplementation(function (this: Storage, key, value) {
      if (key.startsWith("hint_home_checkin_v1:")) throw new DOMException("Storage full", "QuotaExceededError");
      original.call(this, key, value);
    });
    const claimed = module.claimHomeCheckIn(OWNER, "2026-11-03");
    expect(claimed.awardedCredits).toBe(1);
    expect(claimed.progress).toMatchObject({ persistent: false, totalCredits: 1 });
    expect(module.claimHomeCheckIn(OWNER, "2026-11-03").awardedCredits).toBe(0);
    write.mockRestore();
    const saved = module.claimHomeCheckIn(OWNER, "2026-11-03");
    expect(saved.awardedCredits).toBe(0);
    expect(saved.progress).toMatchObject({ persistent: true, totalCredits: 1 });
    expect(saved.progress.records).toEqual(claimed.progress.records);
  });

  it("starts with a pending first day and records one claim across repeat clicks and app realms", async () => {
    const first = await import("./homeCheckIn");
    expect(first.getHomeCheckInProgress(OWNER, "2026-11-03")).toMatchObject({
      records: [], todayCompleted: false, currentStreak: 0,
      activeDay: 1, cycleDay: 1, completedInCycle: 0,
      todayCredits: 0, nextCredits: 1, totalCredits: 0, persistent: true,
    });
    const changed = vi.fn();
    const stop = first.subscribeToHomeCheckIn(changed);
    const claimed = first.recordHomeCheckIn(OWNER, "2026-11-03");
    expect(claimed).toMatchObject({ todayCompleted: true, currentStreak: 1, completedInCycle: 1, todayCredits: 1, totalCredits: 1 });
    first.recordHomeCheckIn(OWNER, "2026-11-03");
    vi.resetModules();
    const second = await import("./homeCheckIn");
    expect(second.recordHomeCheckIn(OWNER, "2026-11-03").records).toEqual(claimed.records);
    expect(changed).toHaveBeenCalledTimes(1);
    expect(Object.keys(localStorage).filter(key => key.startsWith(PREFIX))).toHaveLength(1);
    stop();
  });

  it("awards only the intended milestones, keeps weekly rewards capped, and crosses months", async () => {
    const module = await import("./homeCheckIn");
    const start = new Date(2026, 9, 29, 12);
    const rewards: number[] = [];
    const totals = new Map<number, number>();
    for (let day = 1; day <= 35; day++) {
      const date = new Date(start);
      date.setDate(start.getDate() + day - 1);
      vi.setSystemTime(date);
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
      const progress = module.recordHomeCheckIn(OWNER, key);
      rewards.push(progress.todayCredits);
      totals.set(day, progress.totalCredits);
      expect(progress.currentStreak).toBe(day);
    }
    expect(rewards.slice(0, 7)).toEqual([1, 1, 2, 1, 1, 1, 3]);
    expect(rewards[9]).toBe(1); // The third-day bonus does not restart each week.
    expect([rewards[13], rewards[20], rewards[27], rewards[34]]).toEqual([4, 4, 4, 4]);
    expect([totals.get(3), totals.get(7), totals.get(14), totals.get(28)]).toEqual([4, 10, 20, 40]);
  });

  it("keeps yesterday's streak pending today, starts the next seven-star cycle, and resets only continuity after a gap", async () => {
    const module = await import("./homeCheckIn");
    for (let day = 1; day <= 7; day++) {
      const key = `2026-11-${String(day).padStart(2, "0")}`;
      setDay(key);
      module.recordHomeCheckIn(OWNER, key);
    }
    setDay("2026-11-08");
    expect(module.getHomeCheckInProgress(OWNER, "2026-11-08")).toMatchObject({
      todayCompleted: false, currentStreak: 7, activeDay: 8,
      cycleDay: 1, completedInCycle: 0, nextCredits: 1, totalCredits: 10,
    });
    expect(module.recordHomeCheckIn(OWNER, "2026-11-08")).toMatchObject({ currentStreak: 8, cycleDay: 1, completedInCycle: 1, totalCredits: 11 });
    setDay("2026-11-10");
    expect(module.getHomeCheckInProgress(OWNER, "2026-11-10")).toMatchObject({ currentStreak: 0, activeDay: 1, totalCredits: 11 });
    const restarted = module.recordHomeCheckIn(OWNER, "2026-11-10");
    expect(restarted).toMatchObject({ currentStreak: 1, todayCredits: 1, totalCredits: 12 });
    expect(restarted.records).toHaveLength(9);
  });

  it("does not claim past/future days or turn old receipt and ritual data into rewards", async () => {
    const module = await import("./homeCheckIn");
    localStorage.setItem("hint_daily_receipt_fallbacks_v1", JSON.stringify([{ anonId: OWNER, dailyKey: "2026-11-02", openedAt: "2026-11-02T12:00:00.000Z" }]));
    localStorage.setItem("hint_local_ritual_progress_v1", "old ritual data");
    expect(() => module.recordHomeCheckIn(OWNER, "2026-11-02")).toThrow(/today/i);
    expect(() => module.recordHomeCheckIn(OWNER, "2026-11-04")).toThrow(/today/i);
    expect(() => module.recordHomeCheckIn(OWNER, "2026-02-30")).toThrow(/today/i);
    expect(module.getHomeCheckInProgress(OWNER, "2026-11-03").records).toEqual([]);
    module.recordHomeCheckIn(OWNER, "2026-11-03");
    expect(localStorage.getItem("hint_local_ritual_progress_v1")).toBe("old ritual data");
    expect(JSON.parse(localStorage.getItem("hint_daily_receipt_fallbacks_v1")!)).toHaveLength(1);
  });

  it("ignores impossible dates, corrupted entries, future entries, and invalid credit values", async () => {
    const module = await import("./homeCheckIn");
    const seed = { credits: 1, streak: 1, createdAt: "2026-11-01T12:00:00.000Z" };
    localStorage.setItem(`${PREFIX}2026-11-01`, JSON.stringify({ ...seed, date: "2026-11-01" }));
    localStorage.setItem(`${PREFIX}2026-11-02`, JSON.stringify({ ...seed, date: "2026-11-02", credits: 999 }));
    localStorage.setItem(`${PREFIX}2026-11-04`, JSON.stringify({ ...seed, date: "2026-11-04" }));
    localStorage.setItem(`${PREFIX}2026-02-30`, JSON.stringify({ ...seed, date: "2026-02-30" }));
    localStorage.setItem(`${PREFIX}2026-10-30`, "{broken");
    localStorage.setItem(`${PREFIX}2026-10-29`, JSON.stringify({ ...seed, date: "2026-10-29", streak: 0 }));
    expect(module.getHomeCheckInProgress(OWNER, "2026-11-03")).toMatchObject({ currentStreak: 0, totalCredits: 1 });
    expect(module.getHomeCheckInProgress(OWNER, "2026-11-03").records.map(row => row.date)).toEqual(["2026-11-01"]);
  });

  it("fences an old owner's writer and keeps records isolated when profiles switch", async () => {
    const first = await import("./homeCheckIn");
    first.recordHomeCheckIn(OWNER, "2026-11-03");
    localStorage.setItem("hint_anon_id", "other-owner");
    expect(() => first.recordHomeCheckIn(OWNER, "2026-11-03")).toThrow(/profile changed/i);
    expect(() => first.recordHomeCheckIn("other-owner", "2026-11-03")).toThrow(/profile changed/i);
    vi.resetModules();
    const second = await import("./homeCheckIn");
    expect(second.getHomeCheckInProgress("other-owner", "2026-11-03").totalCredits).toBe(0);
    expect(second.recordHomeCheckIn("other-owner", "2026-11-03").totalCredits).toBe(1);
    expect(second.getHomeCheckInProgress(OWNER, "2026-11-03").records).toHaveLength(1);
  });

  it("retains a failed write in session memory without pretending it is persistent or issuing duplicate events", async () => {
    const module = await import("./homeCheckIn");
    const original = Storage.prototype.setItem;
    const write = vi.spyOn(Storage.prototype, "setItem").mockImplementation(function (this: Storage, key, value) {
      if (key.startsWith("hint_home_checkin_v1:")) throw new DOMException("Storage full", "QuotaExceededError");
      original.call(this, key, value);
    });
    const changed = vi.fn();
    const stop = module.subscribeToHomeCheckIn(changed);
    const first = module.recordHomeCheckIn(OWNER, "2026-11-03");
    expect(first).toMatchObject({ persistent: false, todayCompleted: true, totalCredits: 1 });
    expect(module.recordHomeCheckIn(OWNER, "2026-11-03").records).toEqual(first.records);
    expect(changed).toHaveBeenCalledTimes(1);
    write.mockRestore();
    const saved = module.recordHomeCheckIn(OWNER, "2026-11-03");
    expect(saved).toMatchObject({ persistent: true, todayCompleted: true, totalCredits: 1 });
    expect(saved.records).toEqual(first.records);
    expect(changed).toHaveBeenCalledTimes(2);
    stop();
  });

  it("refreshes only for check-in storage updates and cleans up subscriptions", async () => {
    const module = await import("./homeCheckIn");
    const changed = vi.fn();
    const stop = module.subscribeToHomeCheckIn(changed);
    window.dispatchEvent(new StorageEvent("storage", { key: "unrelated-setting" }));
    expect(changed).not.toHaveBeenCalled();
    window.dispatchEvent(new StorageEvent("storage", { key: `${PREFIX}2026-11-03` }));
    window.dispatchEvent(new StorageEvent("storage", { key: null }));
    expect(changed).toHaveBeenCalledTimes(2);
    // clearHistory and other existing flows notify with an ordinary Event.
    expect(() => window.dispatchEvent(new Event("storage"))).not.toThrow();
    expect(changed).toHaveBeenCalledTimes(3);
    stop();
    window.dispatchEvent(new StorageEvent("storage", { key: `${PREFIX}2026-11-03` }));
    expect(changed).toHaveBeenCalledTimes(3);
  });
});
