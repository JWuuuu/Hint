import { describe, expect, it } from "vitest";
import type { RitualCard } from "../types/ritual.types";
import { selectCardByVisualId } from "./selectCards";

function card(index: number): RitualCard {
  return {
    visualId: `visual-${index}`,
    cardId: `card-${index}`,
    name: `Card ${index}`,
    orientation: index % 2 === 0 ? "upright" : "reversed",
    x: index,
    y: 50,
    rotation: index,
    rotate: index,
    zIndex: index,
    selected: false,
    revealed: false,
  };
}

describe("exact visual card selection", () => {
  it("selects the identity and orientation attached to the requested visual card", () => {
    const deck = Array.from({ length: 78 }, (_, index) => card(index));
    const selected = selectCardByVisualId(deck, [], "visual-37", 3);

    expect(selected).toHaveLength(1);
    expect(selected[0]).toMatchObject({
      visualId: "visual-37",
      cardId: "card-37",
      name: "Card 37",
      orientation: "reversed",
      selected: true,
    });
  });

  it("prevents duplicate cards and enforces the spread card count", () => {
    const deck = Array.from({ length: 78 }, (_, index) => card(index));
    const first = selectCardByVisualId(deck, [], "visual-5", 2);
    const duplicate = selectCardByVisualId(deck, first, "visual-5", 2);
    const second = selectCardByVisualId(deck, duplicate, "visual-11", 2);
    const overLimit = selectCardByVisualId(deck, second, "visual-22", 2);

    expect(duplicate).toEqual(first);
    expect(second.map((item) => item.visualId)).toEqual(["visual-5", "visual-11"]);
    expect(overLimit).toEqual(second);
  });

  it("ignores visual IDs that are not present in the final hidden order", () => {
    const deck = Array.from({ length: 4 }, (_, index) => card(index));
    expect(selectCardByVisualId(deck, [], "missing", 1)).toEqual([]);
  });
});

