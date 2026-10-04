import express from "express";
import type { Server } from "node:http";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import router from "../../routes/tarot.js";
import { deck } from "./data/deck.js";
import { structuredTarotReadingSchema } from "./ai/structuredTarotReader.js";

const ai = vi.hoisted(() => ({ reading: vi.fn(), chat: vi.fn() }));
vi.mock("@workspace/db", () => ({ db: {}, readingsTable: {} }));
vi.mock("../../lib/logger.js", () => ({ logger: { error: vi.fn() } }));
vi.mock("../../lib/aiCostGuards.js", () => ({ consumeAiBudget: () => true }));
vi.mock("./ai/structuredTarotReader.js", async (original) => ({ ...await original<object>(), generateStructuredTarotReading: ai.reading }));
vi.mock("./chat/chatReader.js", () => ({ generateTarotChatReply: ai.chat }));

let server: Server;
let url: string;
const cards = deck.slice(0, 3).map((card, index) => ({ cardId: card.id, name: card.name, orientation: index === 1 ? "reversed" : "upright", position: `Position ${index + 1}` }));
const readingInput = { question: "What should I notice?", spreadType: "three", requiredCardCount: 3, cards };
const chatInput = { originalQuestion: readingInput.question, territory: "Clarity", spreadType: "three", cards: deck.slice(0, 3).map((card, index) => ({ card, isReversed: index === 1, position: cards[index]!.position })), initialReading: "A complete initial reading.", messages: [], followUp: "What is the next step?" };
async function post(path: string, body: unknown, signal?: AbortSignal) {
  return fetch(`${url}${path}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body), signal });
}
beforeAll(async () => {
  const app = express();
  app.use(express.json());
  app.use(router);
  server = app.listen(0, "127.0.0.1");
  await new Promise<void>((resolve) => server.once("listening", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Missing test server");
  url = `http://127.0.0.1:${address.port}`;
});
afterAll(async () => { server.closeAllConnections(); await new Promise<void>((resolve) => server.close(() => resolve())); });
beforeEach(() => { ai.reading.mockReset(); ai.chat.mockReset(); });

describe("Tarot HTTP response provenance", () => {
  it("marks a successful provider response as api", async () => {
    ai.reading.mockResolvedValue({ overall_summary: "Provider answer" });
    const response = await post("/tarot/structured-reading", readingInput);
    expect(await response.json()).toMatchObject({ source: "api", overall_summary: "Provider answer" });
  });
  it("marks a server fallback as local while keeping the selected cards", async () => {
    ai.reading.mockRejectedValue(new Error("Provider unavailable"));
    const response = await post("/tarot/structured-reading", readingInput);
    expect(response.status).toBe(200);
    const raw = await response.json();
    expect(raw).toMatchObject({ source: "local" });
    const body = structuredTarotReadingSchema.parse(raw);
    expect(body.cards.map((card) => card.card_name)).toEqual(cards.map((card) => card.name));
    expect(body.overall_summary).not.toContain(readingInput.question);
  });
  it("requires the original cards for detail and reports provider failure without a fake upgrade", async () => {
    const originalReading = {
      signal_type: "mixed_signal", overall_summary: "Take one thoughtful step.",
      cards: cards.map((card) => ({ card_name: card.name, position: card.position, orientation: card.orientation, meaning: "A concise meaning." })),
      final_action_advice: "Leave time to listen.", follow_up_invitation: "What next?",
    };
    expect((await post("/tarot/structured-reading", { ...readingInput, depth: "detailed" })).status).toBe(400);
    ai.reading.mockRejectedValue(new Error("Provider unavailable"));
    const additionalContext = "I have fifteen minutes after work.";
    const response = await post("/tarot/structured-reading", { ...readingInput, depth: "detailed", originalReading, additionalContext });
    expect(response.status).toBe(503);
    expect(await response.json()).not.toHaveProperty("source", "local");
    expect(ai.reading).toHaveBeenCalledWith(expect.objectContaining({ depth: "detailed", originalReading, additionalContext }));
    expect((await post("/tarot/structured-reading", { ...readingInput, depth: "detailed", originalReading, additionalContext: "a".repeat(601) })).status).toBe(400);
    const changed = { ...originalReading, cards: [...originalReading.cards].reverse() };
    expect((await post("/tarot/structured-reading", { ...readingInput, depth: "detailed", originalReading: changed })).status).toBe(400);
  });
  it("keeps quota fallback chat distinguishable from a provider reply", async () => {
    ai.chat.mockRejectedValueOnce(new Error("429 quota"));
    expect(await (await post("/tarot/chat", chatInput)).json()).toMatchObject({ source: "local" });
    ai.chat.mockResolvedValueOnce("A complete provider reply.");
    expect(await (await post("/tarot/chat", chatInput)).json()).toMatchObject({ source: "api", message: "A complete provider reply." });
  });
  it.each(["reading", "chat"] as const)("aborts the %s provider request when the phone disconnects", async (kind) => {
    let resolveSignal!: (signal: AbortSignal) => void;
    const started = new Promise<AbortSignal>((resolve) => { resolveSignal = resolve; });
    ai[kind].mockImplementation(({ signal }: { signal: AbortSignal }) => new Promise((_, reject) => {
      resolveSignal(signal);
      signal.addEventListener("abort", () => reject(new Error("Cancelled")), { once: true });
    }));
    const controller = new AbortController();
    const pending = post(kind === "reading" ? "/tarot/structured-reading" : "/tarot/chat", kind === "reading" ? readingInput : chatInput, controller.signal).catch(() => undefined);
    const signal = await started;
    controller.abort();
    await pending;
    await vi.waitFor(() => expect(signal.aborted).toBe(true));
  });
});
