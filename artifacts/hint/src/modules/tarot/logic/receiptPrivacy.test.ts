import { describe, expect, it } from "vitest";
import { RITUAL_TAROT_DECK } from "./createHiddenDeck";
import { getReadableCardMeaning } from "./cardMeanings";
import { getTarotReceiptInsight } from "./receiptPrivacy";

describe("Tarot receipt private-context boundary", () => {
  it("does not echo personal context through a saved AI or legacy fallback answer", () => {
    const question = "Should I accept the confidential Northstar offer?";
    const cards = [{ cardId: "0-fool", orientation: "upright" as const, name: question, keywords: [question] }];
    const answer = `For "${question}", consider the confidential details we discussed.`;
    const insight = getTarotReceiptInsight(cards, answer, false);
    expect(insight).toBe(getReadableCardMeaning({ ...RITUAL_TAROT_DECK[0]!, orientation: "upright" }).sentence);
    expect(insight).not.toContain("Northstar");
    expect(insight).not.toContain("confidential");
    expect(getTarotReceiptInsight(cards, answer, true)).toBe(answer);
    expect(getTarotReceiptInsight(cards, answer, false)).toBe(insight);
  });

  it("keeps card-derived meaning specific to the selected identities and orientation", () => {
    const cards = [{ cardId: "0-fool", orientation: "upright" as const }, { cardId: "17-star", orientation: "reversed" as const }];
    const insight = getTarotReceiptInsight(cards, "Private answer", false);
    expect(insight).toContain("The Fool");
    expect(insight).toContain("Star reversed");
    expect(insight).not.toBe(getTarotReceiptInsight([...cards].reverse(), "Private answer", false));
    expect(insight).not.toBe(getTarotReceiptInsight(cards.map((card) => ({ ...card, orientation: "upright" })), "Private answer", false));
  });

  it.each(RITUAL_TAROT_DECK.map((card) => [card.cardId, card] as const))("supports both orientations of %s using the existing card meanings", (_, card) => {
    for (const orientation of ["upright", "reversed"] as const) {
      const selected = [{ ...card, orientation }];
      const insight = getTarotReceiptInsight(selected, "Private answer", false);
      expect(insight).toBe(getReadableCardMeaning(selected[0]!).sentence);
      expect(insight.length).toBeGreaterThan(30);
      expect(insight).not.toMatch(/undefined|Private answer/);
    }
  });

  it("fails closed for missing or unknown archived card IDs", () => {
    const unknown = [{ cardId: "private-question-instead-of-id", orientation: "upright" as const }];
    expect(getTarotReceiptInsight(unknown, "Private answer", false)).toBe(getTarotReceiptInsight([], "Other private answer", false));
  });
});
