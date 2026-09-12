import { beforeEach, describe, expect, it, vi } from "vitest";
import { deck } from "../data/deck.js";
import { buildLocalStructuredTarotReading, generateStructuredTarotReading, validateGeneratedReading } from "./structuredTarotReader.js";
import { generateTarotChatReply } from "../chat/chatReader.js";

const provider = vi.hoisted(() => ({ create: vi.fn() }));
vi.mock("../../../lib/openaiConfig.js", () => ({
  openaiModel: "existing-model", getOpenAIClient: () => ({ chat: { completions: provider } }),
}));

const cards = deck.slice(0, 3).map((card, index) => ({ card, isReversed: index === 1, position: `Position ${index + 1}` }));
const input = { question: "A private question that must not be echoed", emotionalContext: null, drawnCards: cards, spreadType: "three" };
function reading() {
  return {
    signal_type: "mixed_signal", direct_answer: "Try one small exercise you can repeat.", overall_summary: "Take one thoughtful step without rushing.",
    cards: cards.map((draw) => ({ card_id: draw.card.id, card_name: draw.card.name, orientation: draw.isReversed ? "reversed" : "upright", position: draw.position, meaning: "A complete meaning for this exact position." })),
    final_action_advice: "Leave room to listen.", follow_up_invitation: "What would you like to understand?",
  };
}
function completion(content = JSON.stringify(reading()), finish_reason = "stop", refusal: string | null = null) {
  return { choices: [{ finish_reason, message: { content, refusal } }] };
}
beforeEach(() => provider.create.mockReset());

describe("Tarot provider contract", () => {
  it("preserves exact selected identities, positions, orientations and full copy", () => {
    const value = reading();
    value.cards[0]!.card_name = "A translated display name";
    value.cards[0]!.position = "A translated position";
    const parsed = validateGeneratedReading(value, cards);
    expect(parsed.cards[0]).toEqual({ card_name: cards[0]!.card.name, position: cards[0]!.position, orientation: "upright", meaning: value.cards[0]!.meaning });
    expect(parsed.overall_summary).toBe(`${value.direct_answer} ${value.overall_summary}`);
  });
  it.each(["missing", "reordered", "reversed", "different"])("rejects %s cards instead of attaching meanings to the wrong artwork", (kind) => {
    const value = reading();
    if (kind === "missing") value.cards.pop();
    if (kind === "reordered") value.cards.reverse();
    if (kind === "reversed") value.cards[0]!.orientation = "reversed";
    if (kind === "different") value.cards[0]!.card_id = "17-star";
    expect(() => validateGeneratedReading(value, cards)).toThrow();
  });
  it("bounds the request and budgets for every selected card without changing the model", async () => {
    provider.create.mockResolvedValue(completion());
    const signal = new AbortController().signal;
    await generateStructuredTarotReading({ ...input, signal });
    const [request, options] = provider.create.mock.calls[0]!;
    expect(request.model).toBe("existing-model");
    expect(request.max_completion_tokens).toBe(1180);
    expect(request.messages[1].content).toContain("Return exactly 3 cards");
    expect(request.messages[1].content).toContain("Card ID: 0-fool");
    expect(request.messages[1].content).toContain("each meaning to one complete sentence");
    expect(options).toEqual({ signal, timeout: 7500 });
  });
  it("expands the existing answer only for an explicitly requested detailed reading", async () => {
    const detailed = { ...reading(), cards_connection: "The past influence complicates the next step.", watch_for: "Notice whether the same mistake becomes easier to catch.", cards: reading().cards.map((card) => ({ ...card, practical_implication: "Try one ten-minute practice exercise.", watch_for: "Notice whether the same mistake gets easier to catch." })) };
    provider.create.mockResolvedValue(completion(JSON.stringify(detailed)));
    const originalReading = validateGeneratedReading(reading(), cards);
    const result = await generateStructuredTarotReading({ ...input, depth: "detailed", originalReading, additionalContext: "I have fifteen minutes after work." });
    expect(result.cards_connection).toBe(detailed.cards_connection);
    expect(result.watch_for).toBe(detailed.watch_for);
    expect(result.cards[0]!.meaning).toContain(detailed.cards[0]!.practical_implication);
    expect(result.cards[0]!.meaning).toContain(detailed.cards[0]!.watch_for);
    const [request, options] = provider.create.mock.calls[0]!;
    expect(request.messages[1].content).toContain("Explain how the cards relate");
    expect(request.messages[1].content).toContain(originalReading.overall_summary);
    expect(request.messages[1].content).toContain("I have fifteen minutes after work.");
    expect(request.messages[1].content).toContain("Each card must add a different contribution");
    expect(request.max_completion_tokens).toBeGreaterThan(1180);
    expect(options.timeout).toBe(12500);
  });
  it("does not pass a wordier basic reading off as detail without practical reasoning", () => {
    expect(() => validateGeneratedReading(reading(), cards, "detailed")).toThrow("practical implications");
  });
  it.each(["cards_connection", "watch_for"])("rejects new detail missing its %s section", (field) => {
    const detailed: Record<string, unknown> = { ...reading(), cards_connection: "The positions support one small test.", watch_for: "Check whether the next attempt improves.", cards: reading().cards.map((card) => ({ ...card, practical_implication: "Repeat one exercise.", watch_for: "Notice a repeated mistake." })) };
    delete detailed[field];
    expect(() => validateGeneratedReading(detailed, cards, "detailed")).toThrow("connect the cards");
  });
  it.each(["length", "content_filter", "tool_calls"])("rejects a %s completion even if it looks like parseable JSON", async (reason) => {
    provider.create.mockResolvedValue(completion(undefined, reason));
    await expect(generateStructuredTarotReading(input)).rejects.toThrow("did not complete");
  });
  it("rejects refusal and malformed JSON", async () => {
    provider.create.mockResolvedValueOnce(completion(undefined, "stop", "Refused"));
    await expect(generateStructuredTarotReading(input)).rejects.toThrow("did not complete");
    provider.create.mockResolvedValueOnce(completion("{incomplete"));
    await expect(generateStructuredTarotReading(input)).rejects.toThrow();
  });
  it("never echoes the private question in its local fallback answer", () => {
    expect(buildLocalStructuredTarotReading(input).overall_summary).not.toContain(input.question);
  });
  it("rejects an incomplete follow-up and uses a bounded, cancellable request", async () => {
    provider.create.mockResolvedValue(completion("An unfinished sentence", "length"));
    const signal = new AbortController().signal;
    await expect(generateTarotChatReply({ originalQuestion: "A question", territory: "Clarity", emotionalContext: null, spreadType: "three", cards, initialReading: "A reading", messages: [], followUp: "What next?", signal })).rejects.toThrow("did not complete");
    expect(provider.create.mock.calls[0]![1]).toEqual({ signal, timeout: 11500 });
  });
});
