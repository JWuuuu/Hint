import { afterEach, describe, expect, it, vi } from "vitest";
import { requestDetailedTarotReading, type DetailedTarotRequest } from "./requestDetailedTarotReading";
const reading = {
  signal_type: "opening" as const, overall_summary: "An opening is here.",
  cards: [{ card_name: "The Fool", orientation: "upright" as const, position: "Signal", meaning: "Start with one small experiment." }],
  final_action_advice: "Keep it reversible.", follow_up_invitation: "What feels uncertain?",
};
const input: DetailedTarotRequest = {
  question: "What should I try?", spreadType: "single",
  cards: [{ cardId: "0-fool", name: "The Fool", orientation: "upright", position: "Signal" }], originalReading: reading,
};
afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });
describe("explicit deeper Tarot request", () => {
  it("requests detail for the original cards and retains the complete result", async () => {
    const fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({ ...reading, source: "api" })));
    vi.stubGlobal("fetch", fetch);
    expect(await requestDetailedTarotReading(input, { signal: new AbortController().signal })).toEqual(reading);
    expect(JSON.parse(fetch.mock.calls[0]![1].body)).toMatchObject({ depth: "detailed", requiredCardCount: 1, originalReading: reading });
  });
  it.each(["local", "wrong-card", "malformed"])("rejects %s instead of reporting a successful detail", async (kind) => {
    const result = { ...reading, source: kind === "local" ? "local" : "api", cards: kind === "malformed" ? [] : reading.cards.map((card) => ({ ...card, card_name: kind === "wrong-card" ? "The Tower" : card.card_name })) };
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify(result))));
    await expect(requestDetailedTarotReading(input, { signal: new AbortController().signal })).rejects.toThrow();
  });
  it("releases a stalled fetch at the deadline even if fetch ignores cancellation", async () => {
    vi.useFakeTimers();
    const fetch = vi.fn().mockReturnValue(new Promise(() => {}));
    vi.stubGlobal("fetch", fetch);
    const result = requestDetailedTarotReading(input, { signal: new AbortController().signal, timeoutMs: 100 }).catch((error) => error);
    await vi.advanceTimersByTimeAsync(100);
    expect((await result).message).toContain("timed out");
    expect(fetch.mock.calls[0]![1].signal.aborted).toBe(true);
  });
  it("cancels on departure and ignores a late result", async () => {
    let finish!: (value: Response) => void;
    vi.stubGlobal("fetch", vi.fn().mockReturnValue(new Promise((resolve) => { finish = resolve; })));
    const controller = new AbortController();
    const result = requestDetailedTarotReading(input, { signal: controller.signal }).catch((error) => error);
    controller.abort();
    expect((await result).name).toBe("AbortError");
    finish(new Response(JSON.stringify({ ...reading, source: "api" })));
  });
});

vi.mock("@/lib/api", () => ({ apiUrl: (path: string) => path, apiFetch: (...args: Parameters<typeof fetch>) => fetch(...args) }));
