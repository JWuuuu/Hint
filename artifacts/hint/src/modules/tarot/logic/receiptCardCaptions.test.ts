import { expect, it } from "vitest";
import { getReceiptCardCaption } from "./receiptCardCaptions";
import { RITUAL_TAROT_DECK } from "./createHiddenDeck";

it.each(RITUAL_TAROT_DECK)("provides short, distinct upright and reversed copy for $cardId", card => {
  const upright = getReceiptCardCaption(card.cardId, "upright");
  const reversed = getReceiptCardCaption(card.cardId, "reversed");
  expect(upright).not.toBe(reversed);
  for (const caption of [upright, reversed]) {
    expect(caption.length).toBeLessThanOrEqual(48);
    expect(caption.split(/\s+/).length).toBeLessThanOrEqual(9);
    expect(caption).toMatch(/\.$/);
  }
});

it("uses neutral copy for an unknown card", () => {
  expect(getReceiptCardCaption("PRIVATE ARCHIVED NAME", "upright")).toBe("Pause and choose one thoughtful step.");
});
