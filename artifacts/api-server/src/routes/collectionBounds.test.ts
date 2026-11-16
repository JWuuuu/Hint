import { describe, expect, it, vi } from "vitest";
import { z } from "zod";

vi.mock("@workspace/db", () => ({ db: {}, readingsTable: {}, pool: {} }));
vi.mock("../lib/logger.js", () => ({ logger: { error: vi.fn() } }));
import { chatInputSchema, structuredReadingInputSchema } from "./tarot";
import { deck } from "../modules/tarot/data/deck";
import { structuredTarotReadingSchema, validateGeneratedReading } from "../modules/tarot/ai/structuredTarotReader";

const card = { cardId: deck[0]!.id, name: deck[0]!.name, orientation: "upright", position: "1" };
const draw = { card: deck[0]!, isReversed: false, position: "1" };
const structured = { question: "What should I notice?", spreadType: "single", requiredCardCount: 1, cards: [card] };
const chat = { originalQuestion: structured.question, territory: "Clarity", spreadType: "single", cards: [draw],
  initialReading: "A reading.", messages: [], followUp: "And now?" };
const reading = { signal_type: "clear_signal", overall_summary: "A summary.", cards: [
  { position: "1", card_name: card.name, orientation: "upright", meaning: "A meaning." },
], final_action_advice: "Take a moment.", follow_up_invitation: "What next?" };

// Array accessors reveal element traversal even when every element is valid.
function observedArray(value: unknown, count = 200) {
  let visits = 0;
  const items = Array.from({ length: count }, (_, index) => index);
  for (let index = 0; index < count; index++) {
    Object.defineProperty(items, index, { get: () => { visits++; return value; } });
  }
  return { items, visits: () => visits };
}

describe("collection admission before element validation", () => {
  it("uses the patched v4 validator API", () => {
    expect("_zod" in structuredReadingInputSchema).toBe(true);
  });

  for (const invalid of [false, true]) {
    it.each([
      ["structured cards", structuredReadingInputSchema, card, (items: unknown[]) => ({ ...structured, cards: items })],
      ["original reading cards", structuredReadingInputSchema, reading.cards[0], (items: unknown[]) => ({ ...structured, originalReading: { ...reading, cards: items } })],
      ["chat cards", chatInputSchema, draw, (items: unknown[]) => ({ ...chat, cards: items })],
      ["chat messages", chatInputSchema, { role: "user", content: "Hello" }, (items: unknown[]) => ({ ...chat, messages: items })],
      ["structured keywords", structuredReadingInputSchema, "meaning", (items: unknown[]) => ({ ...structured, cards: [{ ...card, keywords: items }] })],
      ["chat keywords", chatInputSchema, "meaning", (items: unknown[]) => ({ ...chat, cards: [{ ...draw, card: { ...draw.card, keywords: items } }] })],
    ] as const)("rejects oversized %s without visiting " + (invalid ? "invalid" : "valid") + " elements", (_name, schema, item, input) => {
      const observed = observedArray(invalid ? null : item);
      const result = schema.safeParse(input(observed.items));
      expect(observed.visits()).toBe(0);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues).toHaveLength(1);
        expect(result.error.issues[0]!.code).toBe("too_big");
      }
    });
  }

  it("rejects oversized provider results before card validation", () => {
    const observed = observedArray({});
    let error: unknown;
    try { validateGeneratedReading({ ...reading, cards: observed.items }, [draw]); } catch (caught) { error = caught; }
    expect(observed.visits()).toBe(0);
    expect(error).toBeInstanceOf(z.ZodError);
    expect((error as z.ZodError).issues).toHaveLength(1);
    expect((error as z.ZodError).issues[0]!.code).toBe("too_big");
  });

  it("accepts every canonical deck card and a finite custom keyword allowance", () => {
    expect(Math.max(...deck.map(item => item.keywords.length))).toBeLessThanOrEqual(16);
    for (const item of deck) {
      expect(chatInputSchema.safeParse({ ...chat, cards: [{ ...draw, card: item }] }).success).toBe(true);
      expect(structuredReadingInputSchema.safeParse({ ...structured, cards: [{ ...card, cardId: item.id, name: item.name, keywords: item.keywords }] }).success).toBe(true);
    }
    for (const count of [0, 16, 17]) {
      const keywords = Array(count).fill("custom");
      expect(structuredReadingInputSchema.safeParse({ ...structured, cards: [{ ...card, keywords }] }).success).toBe(count <= 16);
      expect(chatInputSchema.safeParse({ ...chat, cards: [{ ...draw, card: { ...draw.card, keywords } }] }).success).toBe(count <= 16);
    }
  });

  it("preserves card/message boundaries, defaults, and nullish context", () => {
    for (const count of [1, 10]) {
      expect(structuredReadingInputSchema.parse({ ...structured, cards: Array(count).fill(card), requiredCardCount: count, emotionalContext: null }).depth).toBe("brief");
      expect(structuredTarotReadingSchema.safeParse({ ...reading, cards: Array(count).fill(reading.cards[0]) }).success).toBe(true);
    }
    for (const count of [0, 40]) {
      expect(chatInputSchema.safeParse({ ...chat, messages: Array(count).fill({ role: "user", content: "Hello" }) }).success).toBe(true);
    }
    expect(structuredReadingInputSchema.safeParse({ ...structured, cards: [] }).success).toBe(false);
    expect(chatInputSchema.safeParse({ ...chat, messages: [{ role: "user", content: "" }] }).success).toBe(false);
  });
});
