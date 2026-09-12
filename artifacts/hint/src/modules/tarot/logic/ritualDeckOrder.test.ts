import { describe, expect, it } from "vitest";
import type { RitualCard } from "../types/ritual.types";
import {
  appendPileSelection,
  createAutomaticPileOrder,
  createThreePiles,
  isCompletePileOrder,
  shuffleHiddenDeck,
  stackThreePiles,
  type TarotPileId,
} from "./ritualDeckOrder";

function card(index: number): RitualCard {
  return {
    visualId: `visual-${index}`,
    cardId: `card-${index}`,
    name: `Card ${index}`,
    orientation: index % 2 === 0 ? "upright" : "reversed",
    x: 50,
    y: 50,
    rotation: 0,
    rotate: 0,
    zIndex: index,
    selected: false,
    revealed: false,
  };
}

const ALL_ORDERS: TarotPileId[][] = [
  ["A", "B", "C"],
  ["A", "C", "B"],
  ["B", "A", "C"],
  ["B", "C", "A"],
  ["C", "A", "B"],
  ["C", "B", "A"],
];

describe("ritual deck order", () => {
  it("creates three complete contiguous piles from the current deck", () => {
    const deck = Array.from({ length: 78 }, (_, index) => card(index));
    const piles = createThreePiles(deck);

    expect(piles.A).toEqual(deck.slice(0, 26));
    expect(piles.B).toEqual(deck.slice(26, 52));
    expect(piles.C).toEqual(deck.slice(52));
    expect([...piles.A, ...piles.B, ...piles.C]).toEqual(deck);
  });

  it.each(ALL_ORDERS)("stacks all piles in %s order", (...order) => {
    const deck = Array.from({ length: 12 }, (_, index) => card(index));
    const piles = createThreePiles(deck);
    const stacked = stackThreePiles(piles, order);

    expect(stacked).toEqual(order.flatMap((pileId) => piles[pileId]));
    expect(new Set(stacked.map((item) => item.visualId)).size).toBe(deck.length);
  });

  it("rejects duplicate or incomplete pile selections", () => {
    const deck = Array.from({ length: 9 }, (_, index) => card(index));
    const piles = createThreePiles(deck);

    expect(isCompletePileOrder(["A", "A", "C"])).toBe(false);
    expect(isCompletePileOrder(["A", "B"])).toBe(false);
    expect(() => stackThreePiles(piles, ["A", "A", "C"])).toThrow();
  });

  it("keeps rapid and duplicate pile taps deterministic", () => {
    let order: TarotPileId[] = [];
    for (const pileId of ["B", "B", "C", "A", "C"] as TarotPileId[]) {
      order = appendPileSelection(order, pileId);
    }

    expect(order).toEqual(["B", "C", "A"]);
  });

  it("creates a complete automatic pile order without user input", () => {
    const values = [0.1, 0.8];
    let cursor = 0;
    const order = createAutomaticPileOrder(() => values[cursor++] ?? 0.5);

    expect(order).toEqual(["C", "B", "A"]);
    expect(isCompletePileOrder(order)).toBe(true);
  });

  it("shuffles actual card objects without changing visual identity or orientation", () => {
    const deck = Array.from({ length: 8 }, (_, index) => card(index));
    const values = [0.12, 0.76, 0.33, 0.91, 0.28, 0.64, 0.04];
    let cursor = 0;
    const shuffled = shuffleHiddenDeck(deck, () => values[cursor++] ?? 0.5);

    expect(shuffled).not.toEqual(deck);
    expect(new Set(shuffled.map((item) => item.visualId))).toEqual(
      new Set(deck.map((item) => item.visualId)),
    );
    for (const shuffledCard of shuffled) {
      const original = deck.find((item) => item.visualId === shuffledCard.visualId);
      expect(shuffledCard).toBe(original);
      expect(shuffledCard.orientation).toBe(original?.orientation);
      expect(shuffledCard.cardId).toBe(original?.cardId);
    }
  });
});
