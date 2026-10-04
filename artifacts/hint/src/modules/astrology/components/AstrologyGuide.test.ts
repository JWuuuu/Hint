import { expect, it } from "vitest";
import { chartDate } from "./AstrologyGuide";
it("preserves ambiguous, invalid, or unzoned provider dates without inventing a timezone", () => {
  for (const value of [
    "09-10-2026",
    "2026-02-30",
    "2026-09-10T12:00:00",
    "unknown",
  ])
    expect(chartDate(value, "en", true)).toBe(value);
});
it("keeps exact same-day transit times distinct and formats valid dates in the app language", () => {
  expect(chartDate("2026-09-10T12:00:00Z", "en", true)).not.toBe(
    chartDate("2026-09-10T16:00:00Z", "en", true),
  );
  expect(chartDate("2026-09-10", "en")).toBe("Sep 10, 2026");
  expect(chartDate("2026-09-10", "ja")).toContain("2026年9月10日");
  expect(chartDate("2024-02-29", "en")).toBe("Feb 29, 2024");
});
