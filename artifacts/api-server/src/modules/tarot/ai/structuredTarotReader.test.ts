import { beforeEach, describe, expect, it, vi } from "vitest";
import { deck } from "../data/deck.js";
import { buildLocalStructuredTarotReading, generateStructuredTarotReading, validateGeneratedReading } from "./structuredTarotReader.js";
import { generateTarotChatReply } from "../chat/chatReader.js";
import { generateTarotReading } from "./tarotReader.js";
import { HINT_SYSTEM_PROMPT } from "./tarotPrompt.js";

const provider = vi.hoisted(() => ({ create: vi.fn() }));
vi.mock("../../../lib/openaiConfig.js", () => ({
  openaiModel: "existing-model", getOpenAIClient: () => ({ chat: { completions: provider } }),
}));

const cards = deck.slice(0, 3).map((card, index) => ({ card, isReversed: index === 1, position: `Position ${index + 1}` }));
const input = { question: "A private question that must not be echoed", emotionalContext: null, drawnCards: cards, spreadType: "three" };
function reading() {
  return {
    signal_type: "mixed_signal", direct_answer: "Try one small exercise you can repeat.", overall_summary: "Take one thoughtful step without rushing.",
    cards: cards.map((draw) => ({ card_id: draw.card.id, card_name: draw.card.name, orientation: draw.isReversed ? "reversed" : "upright", position: draw.position, meaning: "A complete meaning for this exact position.", question_connection: "For this question, this position supports repeating the exercise before changing methods." })),
    final_action_advice: "Leave room to listen.", follow_up_invitation: "What would you like to understand?",
    cards_connection: "The Fool invites a small experiment, while the reversed Magician asks you to limit distractions. The High Priestess adds a pause to notice what you actually learned. Together they favor a repeatable exercise over switching methods whenever progress feels uncertain.",
  };
}
function completion(content = JSON.stringify(reading()), finish_reason = "stop", refusal: string | null = null) {
  return { choices: [{ finish_reason, message: { content, refusal } }] };
}
beforeEach(() => provider.create.mockReset());

describe("Tarot provider contract", () => {
  it("uses the shared reader rules and supplied history in every reading mode without promoting user context to system instructions", async () => {
    const spreadHistory = JSON.stringify({ readings: [{ question: "Will we reconnect this month?", cards: [{ name: "The Tower", orientation: "reversed", position: "Obstacle" }] }], omittedReadings: 2 });
    provider.create.mockResolvedValue(completion());
    await generateTarotReading({ ...input, spreadHistory });
    await generateStructuredTarotReading({ ...input, spreadHistory });
    await generateStructuredTarotReading({ ...input, question: "我们这个月会复合吗？", spreadHistory });
    provider.create.mockResolvedValue(completion("Lean No. The supplied spreads disagree on whether contact develops into commitment."));
    await generateTarotChatReply({ originalQuestion: input.question, territory: "Relationships", emotionalContext: null,
      spreadType: "three", cards, initialReading: "An earlier answer.", messages: [],
      followUp: "Based on all our spreads, be more specific.", spreadHistory });
    for (const [request] of provider.create.mock.calls) {
      expect(request.messages[0].content).toContain(HINT_SYSTEM_PROMPT);
      expect(request.messages[1].role).toBe("user");
      expect(request.messages[1].content).toContain(spreadHistory);
      expect(request.messages[0].content).not.toContain(spreadHistory);
      expect(request.messages[1].content).toContain("Position 2");
      expect(request.messages[1].content).toContain("reversed");
    }
    expect(provider.create.mock.calls.at(-1)![0].messages.at(-1).content).toBe("Based on all our spreads, be more specific.");
  });
  it("preserves exact selected identities, positions, orientations and full copy", () => {
    const value = reading();
    value.cards[0]!.card_name = "A translated display name";
    value.cards[0]!.position = "A translated position";
    const parsed = validateGeneratedReading(value, cards);
    expect(parsed.cards[0]).toEqual({ card_name: cards[0]!.card.name, position: cards[0]!.position, orientation: "upright", meaning: `${value.cards[0]!.meaning} ${value.cards[0]!.question_connection}` });
    expect(parsed.overall_summary).toBe(`${value.direct_answer} ${value.overall_summary}`);
    expect(parsed.cards_connection).toBe(value.cards_connection);
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
    expect(request.response_format.type).toBe("json_schema");
    const schema = request.response_format.json_schema.schema;
    expect(request.response_format.json_schema.strict).toBe(true);
    expect(schema.required).toEqual(expect.arrayContaining(["direct_answer", "cards_connection"]));
    expect(schema.properties.cards).toMatchObject({ minItems: 3, maxItems: 3 });
    expect(schema.properties.cards.items.required).toContain("question_connection");
    expect(request.max_completion_tokens).toBe(1820);
    expect(request.messages[1].content).toContain("Return exactly 3 cards");
    expect(request.messages[1].content).toContain("Card ID: 0-fool");
    expect(request.messages[1].content).toContain("Every card MUST include meaning and question_connection");
    expect(request.messages[1].content).toContain("opening answer of two or three sentences");
    expect(request.messages[1].content).toContain("This synthesis belongs in the initial reading");
    expect(options).toEqual({ signal, timeout: 12500 });
  });
  it.each([undefined, "", "   "])("rejects a new brief reading without its combined interpretation: %j", (cards_connection) => {
    expect(() => validateGeneratedReading({ ...reading(), cards_connection }, cards)).toThrow();
  });
  it("rejects a new brief reading without its opening answer", () => {
    expect(() => validateGeneratedReading({ ...reading(), direct_answer: undefined }, cards)).toThrow("direct answer");
  });
  it("rejects a card definition without an explanation of its relevance", () => {
    const value = reading();
    expect(() => validateGeneratedReading({ ...value, cards: value.cards.map((card) => ({ ...card, question_connection: undefined })) }, cards)).toThrow("relevance to the question");
  });
  it.each([1, 10])("preserves all %i positions and their synthesis", (count) => {
    const draws = deck.slice(0, count).map((card, index) => ({ card, isReversed: false, position: `Position ${index + 1}` }));
    const value = { ...reading(), cards: draws.map((draw) => ({ ...reading().cards[0]!, card_id: draw.card.id, orientation: "upright", position: draw.position })) };
    const result = validateGeneratedReading(value, draws);
    expect(result.cards.map((card) => card.card_name)).toEqual(draws.map((draw) => draw.card.name));
    expect(result.cards.map((card) => card.position)).toEqual(draws.map((draw) => draw.position));
    expect(result.cards_connection).toBe(value.cards_connection);
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
    const schema = request.response_format.json_schema.schema;
    expect(schema.required).toEqual(expect.arrayContaining(["cards_connection", "watch_for"]));
    expect(schema.properties.cards.items.required).toEqual(expect.arrayContaining(["practical_implication", "watch_for"]));
    expect(schema.properties.cards.items.properties).not.toHaveProperty("question_connection");
    expect(request.messages[1].content).toContain(originalReading.overall_summary);
    expect(request.messages[1].content).toContain("I have fifteen minutes after work.");
    expect(request.messages[1].content).toContain("Each card must add a different contribution");
    expect(request.max_completion_tokens).toBeGreaterThan(1820);
    expect(options.timeout).toBe(12500);
  });
  it("does not pass a wordier basic reading off as detail without practical reasoning", () => {
    expect(() => validateGeneratedReading(reading(), cards, "detailed")).toThrow("practical implications");
  });
  it("uses a Chinese template for a Chinese question while keeping the card identities", async () => {
    provider.create.mockResolvedValue(completion());
    await generateStructuredTarotReading({ ...input, question: "我每天只有十五分钟，该怎么练习？" });
    const [request] = provider.create.mock.calls[0]!;
    expect(request.messages[0].content).toContain("Write every interpretation field in Chinese");
    expect(request.messages[1].content).toContain("开头的两到三句话");
    expect(request.messages[1].content).toContain("恰好 3 张牌");
    expect(request.messages[1].content).toContain("Card ID: 0-fool");
    expect(request.messages[1].content).toContain("question_connection");
    expect(request.messages[1].content).toContain("cards_connection");
  });
  it.each(["cards_connection", "watch_for"])("rejects new detail missing its %s section", (field) => {
    const detailed: Record<string, unknown> = { ...reading(), cards_connection: "The positions support one small test.", watch_for: "Check whether the next attempt improves.", cards: reading().cards.map((card) => ({ ...card, practical_implication: "Repeat one exercise.", watch_for: "Notice a repeated mistake." })) };
    delete detailed[field];
    expect(() => validateGeneratedReading(detailed, cards, "detailed")).toThrow();
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
