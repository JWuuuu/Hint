import { describe, expect, it } from "vitest";
import { createHiddenDeck } from "./createHiddenDeck";
import { applyAutoWashWave, applyTableCurrent, applyWashForce, gatherDeckToCenter, squareDeckAtCenter, loosenDeckForWash } from "./washPhysics";

describe("a hand-driven card wash", () => {
  it("gathers a long-washed card by the nearest physical angle instead of unwinding whole turns", () => {
    const cards = createHiddenDeck().slice(0, 2).map((card, i) => ({ ...card, rotate: i === 0 ? 725 : -731 }));
    const gathered = gatherDeckToCenter(cards);
    const squared = squareDeckAtCenter(gathered);
    gathered.forEach((card, i) => expect(Math.abs(card.rotate - cards[i]!.rotate)).toBeLessThanOrEqual(180));
    squared.forEach((card, i) => {
      expect(Math.abs(card.rotate - gathered[i]!.rotate)).toBeLessThan(15);
      expect(Math.abs(card.rotate % 360)).toBe(0);
    });
  });
  it("lets a stationary hand's momentum come to rest instead of driving an endless orbit", () => {
    let cards = loosenDeckForWash(createHiddenDeck());
    cards = applyWashForce(cards, { x: 310, y: 210, movementX: 0, movementY: 12, width: 400, height: 400, spinDirection: 1 }).cards;
    for (let i = 0; i < 90; i++) cards = applyTableCurrent(cards, i * 1000 / 60, .72, 1);
    const resting = cards;
    for (let i = 90; i < 120; i++) cards = applyTableCurrent(cards, i * 1000 / 60, .72, 1);
    expect(Math.max(...cards.map((card, i) => Math.hypot(card.x - resting[i]!.x, card.y - resting[i]!.y)))).toBeLessThan(.1);
  });

  it("gives nearby cards more of the hand's pressure than the far side of the table", () => {
    const deck = createHiddenDeck();
    const cards = [{ ...deck[0]!, x: 80, y: 52, velocityX: 0, velocityY: 0 }, { ...deck[1]!, x: 20, y: 52, velocityX: 0, velocityY: 0 }];
    const next = applyWashForce(cards, { x: 320, y: 208, movementX: 0, movementY: 12, width: 400, height: 400, spinDirection: 1 }).cards;
    const moved = next.map((card, i) => Math.hypot(card.x - cards[i]!.x, card.y - cards[i]!.y));
    expect(moved[0]).toBeGreaterThan(moved[1]! * 3);
  });

  it("carries a card inward with a gentle sweep instead of only turning it around the centre", () => {
    let cards = [{ ...createHiddenDeck()[0]!, x: 73, y: 52,
      velocityX: 0, velocityY: 0, velocityRotate: 0 }];
    const initialAngle = cards[0]!.rotate;
    for (let frame = 0; frame < 20; frame++) {
      cards = applyWashForce(cards, {
        x: 292 - frame * 3, y: 208 + frame,
        movementX: -3, movementY: 1,
        width: 400, height: 400, spinDirection: 1,
      }).cards;
    }
    expect(Math.hypot(cards[0]!.x - 50, cards[0]!.y - 52)).toBeLessThan(20);
    expect(cards[0]!.rotate).toBeGreaterThan(initialAngle);
  });

  it("preserves hidden card identities and distinct physical angles through repeated washing", () => {
    let cards = loosenDeckForWash(createHiddenDeck());
    const identities = cards.map(({ visualId, cardId, orientation }) => ({ visualId, cardId, orientation }));
    for (let i = 0; i < 500; i++) cards = applyAutoWashWave(cards, i * 1000 / 60, 1);
    expect(cards.map(({ visualId, cardId, orientation }) => ({ visualId, cardId, orientation }))).toEqual(identities);
    expect(cards.every(card => !card.revealed && !card.selected)).toBe(true);
    expect(new Set(cards.map(card => card.rotate.toFixed(1))).size).toBeGreaterThan(50);
  });
});
