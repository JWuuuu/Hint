import { describe, expect, it, vi } from "vitest";
import { createHiddenDeck } from "./createHiddenDeck";
import {
  applyAutoWashWave,
  applyWashForce,
  loosenDeckForWash,
} from "./washPhysics";

describe("first-edition tarot wash physics", () => {
  it("moves a card out of the exact center instead of pinning it beneath the wash", () => {
    const card = { ...createHiddenDeck()[0]!, x: 50, y: 52, homeX: 50, homeY: 52,
      velocityX: 0, velocityY: 0, velocityRotate: 0 };
    let cards = [card];
    for (let frame = 0; frame < 120; frame += 1) {
      cards = applyWashForce(cards, { x: 200, y: 208, movementX: 8, movementY: 4, width: 400, height: 400, spinDirection: 1 }).cards;
    }
    expect(Math.hypot(cards[0]!.x - 50, cards[0]!.y - 52)).toBeGreaterThan(3);
    expect(cards[0]!.cardId).toBe(card.cardId);
  });

  it("lets the wash fill the table instead of stopping at a narrow central box", () => {
    const random = vi.spyOn(Math, "random").mockReturnValue(0.5);
    let cards = loosenDeckForWash(createHiddenDeck());
    for (let frame = 0; frame < 120; frame += 1) {
      cards = applyAutoWashWave(cards, frame * (1000 / 60));
    }
    const horizontalSpan = Math.max(...cards.map(card => card.x)) - Math.min(...cards.map(card => card.x));
    expect(horizontalSpan).toBeGreaterThan(48);
    random.mockRestore();
  });

  it("gives a gentle hand movement a gentler response than a fast sweep", () => {
    const random = vi.spyOn(Math, "random").mockReturnValue(0.5);
    const cards = loosenDeckForWash(createHiddenDeck());
    const pointer = { x: 180, y: 190, width: 375, height: 380, spinDirection: 1 as const };
    const slow = applyWashForce(cards, { ...pointer, movementX: 1, movementY: 0 });
    const fast = applyWashForce(cards, { ...pointer, movementX: 18, movementY: 0 });
    const distance = (moved: typeof cards) => moved.reduce((sum, card, index) =>
      sum + Math.hypot(card.x - cards[index]!.x, card.y - cards[index]!.y), 0);
    expect(distance(slow.cards)).toBeLessThan(distance(fast.cards) * 0.65);
    random.mockRestore();
  });
  it("loosens all 78 cards into varied natural lanes", () => {
    let randomState = 42;
    const random = vi.spyOn(Math, "random").mockImplementation(() => {
      randomState = (randomState * 1664525 + 1013904223) % 4294967296;
      return randomState / 4294967296;
    });
    const cards = loosenDeckForWash(createHiddenDeck());
    const rotations = cards.map((card) => card.rotate);

    expect(cards).toHaveLength(78);
    expect(new Set(cards.map((card) => card.x.toFixed(2))).size).toBeGreaterThan(60);
    expect(new Set(cards.map((card) => card.y.toFixed(2))).size).toBeGreaterThan(60);
    expect(new Set(rotations.map((rotation) => rotation.toFixed(2))).size).toBeGreaterThan(50);
    expect(Math.min(...rotations)).toBeLessThan(-10);
    expect(Math.max(...rotations)).toBeGreaterThan(10);
    expect(cards.every((card) => card.x >= 16 && card.x <= 84)).toBe(true);
    expect(cards.every((card) => card.y >= 17 && card.y <= 85)).toBe(true);
    random.mockRestore();
  });

  it("follows either clockwise or counterclockwise hand movement", () => {
    const random = vi.spyOn(Math, "random").mockReturnValue(0.5);
    const cards = loosenDeckForWash(createHiddenDeck());
    const pointer = {
      x: 200,
      y: 300,
      movementX: 26,
      movementY: 11,
      width: 400,
      height: 600,
    };
    const clockwise = applyWashForce(cards, { ...pointer, spinDirection: 1 });
    const counterclockwise = applyWashForce(cards, { ...pointer, spinDirection: -1 });
    const clockwiseRotation = clockwise.cards.reduce(
      (sum, card, index) => sum + card.rotate - cards[index]!.rotate,
      0,
    );
    const counterclockwiseRotation = counterclockwise.cards.reduce(
      (sum, card, index) => sum + card.rotate - cards[index]!.rotate,
      0,
    );

    expect(clockwise.activeVisualIds.length).toBeGreaterThan(10);
    expect(counterclockwise.activeVisualIds.length).toBeGreaterThan(10);
    expect(clockwiseRotation).toBeGreaterThan(0);
    expect(counterclockwiseRotation).toBeLessThan(0);
    random.mockRestore();
  });

  it("supports a centered auto wash in either direction", () => {
    const random = vi.spyOn(Math, "random").mockReturnValue(0.5);
    const cards = loosenDeckForWash(createHiddenDeck());
    const clockwise = applyAutoWashWave(cards, 400, 1);
    const counterclockwise = applyAutoWashWave(cards, 400, -1);
    const clockwiseRotation = clockwise.reduce(
      (sum, card, index) => sum + card.rotate - cards[index]!.rotate,
      0,
    );
    const counterclockwiseRotation = counterclockwise.reduce(
      (sum, card, index) => sum + card.rotate - cards[index]!.rotate,
      0,
    );

    expect(clockwiseRotation).toBeGreaterThan(0);
    expect(counterclockwiseRotation).toBeLessThan(0);
    expect(clockwise.every((card) => card.x >= 16 && card.x <= 84)).toBe(true);
    expect(clockwise.every((card) => card.y >= 17 && card.y <= 85)).toBe(true);
    random.mockRestore();
  });
});
