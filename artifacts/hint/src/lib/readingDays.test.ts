import { expect, it } from "vitest";
import { countReadingDays } from "./readingDays";
it("counts actual distinct reading days in the selected period, including server-only dates", () => {
  expect(countReadingDays([], "2026-09-01", "2026-09-30")).toBe(0);
  expect(countReadingDays(["2026-09-08", "2026-09-08", "2026-09-09", "2026-08-31", "invalid"], "2026-09-01", "2026-09-30")).toBe(2);
});
