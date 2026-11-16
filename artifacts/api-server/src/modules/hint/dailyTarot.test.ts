import { describe, expect, it, vi } from "vitest";
vi.mock("@workspace/db", () => ({ db: {}, dailyReceiptsTable: {}, dailyPullsTable: {}, historyClearsTable: {} }));
import { dailyTarotWindow } from "./dailyTarot";

describe("server UTC daily boundary", () => {
  it.each([
    ["2026-03-08T01:59:59-06:00", "2026-03-08"],
    ["2026-03-08T03:00:00-05:00", "2026-03-08"],
    ["2026-11-01T01:30:00-05:00", "2026-11-01"],
    ["2026-11-01T01:30:00-06:00", "2026-11-01"],
    ["2026-09-10T13:59:59+14:00", "2026-09-09"],
    ["2026-09-09T12:00:00-12:00", "2026-09-10"],
    ["2028-02-29T23:59:59Z", "2028-02-29"],
  ])("uses the same UTC day across timezone/DST boundaries: %s", (instant, day) => {
    const window = dailyTarotWindow(new Date(instant));
    expect(window.day).toBe(day);
    expect(window.expiresAt.getTime() - new Date(day + "T00:00:00Z").getTime()).toBe(86400000);
  });
  it.each(["2026-02-30", "2026-13-01", "2026-9-09", "invalid", "2026-09-09T01:00:00Z"])("rejects invalid requested day %s", day => {
    expect(() => dailyTarotWindow(new Date("2026-09-09T23:59:59Z"), day)).toThrow("Invalid calendar date");
  });
  it("does not allow a future date even one millisecond before midnight", () => {
    expect(() => dailyTarotWindow(new Date("2026-09-09T23:59:59.999Z"), "2026-09-10")).toThrow("Future");
    expect(dailyTarotWindow(new Date("2026-09-10T00:00:00Z")).day).toBe("2026-09-10");
  });
});
