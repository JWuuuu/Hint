import type { RitualCard } from "../types/ritual.types";

export type TarotPileId = "A" | "B" | "C";

export type TarotPileMap = Record<TarotPileId, RitualCard[]>;

export const TAROT_PILE_IDS: readonly TarotPileId[] = ["A", "B", "C"];

export function createAutomaticPileOrder(
  random: () => number = Math.random,
): [TarotPileId, TarotPileId, TarotPileId] {
  const order = [...TAROT_PILE_IDS];
  for (let index = order.length - 1; index > 0; index -= 1) {
    const target = Math.floor(random() * (index + 1));
    [order[index], order[target]] = [order[target]!, order[index]!];
  }
  return order as [TarotPileId, TarotPileId, TarotPileId];
}

export function shuffleHiddenDeck(
  deck: readonly RitualCard[],
  random: () => number = Math.random,
): RitualCard[] {
  const shuffled = [...deck];
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const target = Math.floor(random() * (index + 1));
    [shuffled[index], shuffled[target]] = [shuffled[target]!, shuffled[index]!];
  }
  return shuffled;
}

export function createThreePiles(
  deck: readonly RitualCard[],
  cutPoints?: readonly [number, number],
): TarotPileMap {
  if (deck.length < 3) {
    throw new Error("A three-pile cut requires at least three cards.");
  }

  const defaultFirst = Math.floor(deck.length / 3);
  const defaultSecond = Math.floor((deck.length * 2) / 3);
  const first = Math.max(1, Math.min(deck.length - 2, cutPoints?.[0] ?? defaultFirst));
  const second = Math.max(first + 1, Math.min(deck.length - 1, cutPoints?.[1] ?? defaultSecond));

  return {
    A: deck.slice(0, first),
    B: deck.slice(first, second),
    C: deck.slice(second),
  };
}

export function isCompletePileOrder(
  order: readonly TarotPileId[],
): order is readonly [TarotPileId, TarotPileId, TarotPileId] {
  return order.length === 3 && new Set(order).size === 3;
}

export function appendPileSelection(
  order: readonly TarotPileId[],
  pileId: TarotPileId,
): TarotPileId[] {
  if (order.length >= TAROT_PILE_IDS.length || order.includes(pileId)) {
    return [...order];
  }
  return [...order, pileId];
}

export function stackThreePiles(
  piles: TarotPileMap,
  order: readonly TarotPileId[],
): RitualCard[] {
  if (!isCompletePileOrder(order)) {
    throw new Error("Pile order must contain A, B, and C exactly once.");
  }
  return order.flatMap((pileId) => piles[pileId]);
}
