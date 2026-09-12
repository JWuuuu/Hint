import { describe, expect, it } from "vitest";
import { buildTarotChatContext } from "./buildTarotChatContext";

function reading(count = 3, long = false) {
  return {
    signal_type: "opening" as const,
    overall_summary: "Keep practicing one exercise.",
    final_action_advice: "Compare your next attempt with yesterday's attempt.",
    follow_up_invitation: "Which exercise?",
    cards: Array.from({ length: count }, (_, index) => ({ position: `Position ${index + 1}`, card_name: `Card ${index + 1}`, orientation: "upright" as const, meaning: long ? `Meaning for position ${index + 1}. ${"A complete useful sentence. ".repeat(70)}` : `A distinct meaning for position ${index + 1}.` })),
  };
}

describe("follow-up reading context", () => {
  it("preserves a short reading and never sends an unused context draft", () => {
    const original = reading();
    const context = buildTarotChatContext({ reading: original, additionalContext: "An unsent detail" });
    expect(context).toContain(original.overall_summary);
    expect(context).toContain(original.final_action_advice);
    for (const card of original.cards) expect(context).toContain(card.meaning);
    expect(context).not.toContain("An unsent detail");
  });
  it.each([1, 3, 5, 7, 9, 10])("keeps every position and the next step within budget for %i long cards", (count) => {
    const original = reading(count);
    const detailed = { ...reading(count, true), overall_summary: "A deeper explanation. ".repeat(50), cards_connection: "The influences connect. ".repeat(40), watch_for: "Watch the repeated mistake. ".repeat(40) };
    const before = JSON.stringify({ original, detailed });
    const context = buildTarotChatContext({ reading: original, detailedReading: detailed, additionalContext: "I only have fifteen minutes." });
    expect(context.length).toBeLessThanOrEqual(8000);
    expect(context).toContain(original.overall_summary);
    expect(context).toContain(detailed.final_action_advice);
    expect(context).toContain("I only have fifteen minutes.");
    expect(context).toContain("What to watch for:");
    for (const [index, card] of detailed.cards.entries()) {
      expect(context).toContain(`${card.position} - ${card.card_name} (upright):`);
      expect(context).toContain(`Meaning for position ${index + 1}.`);
    }
    expect(JSON.stringify({ original, detailed })).toBe(before);
  });
});
