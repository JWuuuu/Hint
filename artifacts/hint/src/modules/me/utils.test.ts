import { expect, it } from "vitest";
import { initialsFrom } from "./utils";

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
