import { expect, it } from "vitest";
import { initialsFrom, practiceRhythm, practiceSky, PRACTICE_SKY } from "./utils";

it("ignores punctuation-only tokens and leading punctuation in a name", () => {
  expect(initialsFrom("Alexandra — fictional reader")).toBe("AF");
  expect(initialsFrom("‘Amelia’ / Rose")).toBe("AR");
  expect(initialsFrom("— / …")).toBe("ME");
});

it("preserves Unicode letters, combining accents and complete code points", () => {
  expect(initialsFrom("e\u0301lodie Wu")).toBe("ÉW");
  expect(initialsFrom("𐐨lex Wu")).toBe("𐐀W");
  expect(initialsFrom("王 小月")).toBe("王小");
  expect(initialsFrom("김 민지")).toBe("김민");
});

it("keeps the monogram to at most two letters when uppercasing expands a letter", () => {
  expect(initialsFrom("ßeta Rose")).toBe("SR");
  expect(initialsFrom(null)).toBe("ME");
  expect(initialsFrom("Amelia")).toBe("A");
});

const at = (year: number, month: number, day: number, hour = 12) => new Date(year, month - 1, day, hour).toISOString();

it("marks each of the last fourteen local days that holds an entry, oldest first", () => {
  const today = new Date(2026, 9, 27, 9);
  const rhythm = practiceRhythm([
    { id: "a", createdAt: at(2026, 10, 27, 8) },
    { id: "b", createdAt: at(2026, 10, 27, 21) },
    { id: "c", createdAt: at(2026, 10, 20) },
    { id: "d", createdAt: at(2026, 10, 14) },
    { id: "too-old", createdAt: at(2026, 10, 13) },
    { id: "broken", createdAt: "not a date" },
  ], today);
  expect(rhythm.active).toHaveLength(14);
  expect(rhythm.active[13]).toBe(true);
  expect(rhythm.active[6]).toBe(true);
  expect(rhythm.active[0]).toBe(true);
  expect(rhythm.count).toBe(3);
});

it("draws the most recent kept readings left to right with the newest lit", () => {
  const entries = Array.from({ length: 15 }, (_, index) => ({ id: `r${index}`, createdAt: at(2026, 10, index + 1) })).reverse();
  const stars = practiceSky(entries);
  expect(stars).toHaveLength(PRACTICE_SKY.max);
  expect(stars[0]!.id).toBe("r3");
  expect(stars.at(-1)).toMatchObject({ id: "r14", latest: true });
  expect(stars.filter(star => star.latest)).toHaveLength(1);
  for (let index = 1; index < stars.length; index += 1) expect(stars[index]!.x).toBeGreaterThan(stars[index - 1]!.x);
  for (const star of stars) {
    expect(star.y).toBeGreaterThanOrEqual(PRACTICE_SKY.inset);
    expect(star.y).toBeLessThanOrEqual(PRACTICE_SKY.height - PRACTICE_SKY.inset);
  }
  expect(practiceSky(entries)).toEqual(stars);
});

it("centres a single star and draws nothing without readings", () => {
  expect(practiceSky([])).toEqual([]);
  const [only] = practiceSky([{ id: "first", createdAt: at(2026, 10, 1) }]);
  expect(only).toMatchObject({ x: PRACTICE_SKY.width / 2, latest: true });
});
