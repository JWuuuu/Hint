import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { sendTarotChatMessage, type TarotChatInput, type TarotChatReply } from "@workspace/api-client-react";
import { requestTarotFollowUp, TAROT_FOLLOW_UP_TIMEOUT_MS } from "./requestTarotFollowUp";

vi.mock("@workspace/api-client-react", () => ({ sendTarotChatMessage: vi.fn() }));
const send = vi.mocked(sendTarotChatMessage);
const input: TarotChatInput = {
  originalQuestion: "What is opening now?", territory: "Clarity", spreadType: "single",
  cards: [], initialReading: "Take one deliberate step.", messages: [], followUp: "Which step?",
};
const reply = { message: "Take the smallest honest step.", createdAt: "2026-09-07T00:00:00Z" };

beforeEach(() => { vi.useFakeTimers(); send.mockReset(); });
afterEach(() => { vi.useRealTimers(); });

describe("Tarot follow-up request ownership", () => {
  it("keeps the complete reply and releases its timer and abort listener", async () => {
    const controller = new AbortController();
    const remove = vi.spyOn(controller.signal, "removeEventListener");
    send.mockResolvedValue({ ...reply, message: `  ${reply.message}  ` });
    await expect(requestTarotFollowUp(input, { signal: controller.signal })).resolves.toEqual(reply);
    expect(vi.getTimerCount()).toBe(0);
    expect(remove).toHaveBeenCalledWith("abort", expect.any(Function));
  });

  it("does not send for an already closed reading", async () => {
    const controller = new AbortController();
    controller.abort();
    await expect(requestTarotFollowUp(input, { signal: controller.signal })).rejects.toMatchObject({ name: "AbortError" });
    expect(send).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  });

  it("aborts on departure even if the transport never resolves", async () => {
    send.mockReturnValue(new Promise(() => {}));
    const controller = new AbortController();
    const pending = requestTarotFollowUp(input, { signal: controller.signal });
    const rejected = expect(pending).rejects.toMatchObject({ name: "AbortError" });
    await Promise.resolve();
    controller.abort();
    await rejected;
    expect(send.mock.calls[0]?.[1]?.signal?.aborted).toBe(true);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("times out a stalled request and ignores its late response", async () => {
    let finish!: (value: TarotChatReply) => void;
    send.mockReturnValue(new Promise((resolve) => { finish = resolve; }));
    const completed = vi.fn();
    const failed = vi.fn();
    const pending = requestTarotFollowUp(input).then(completed, failed);
    await vi.advanceTimersByTimeAsync(TAROT_FOLLOW_UP_TIMEOUT_MS - 1);
    expect(failed).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    await pending;
    expect(failed).toHaveBeenCalledWith(expect.objectContaining({ name: "TimeoutError" }));
    expect(send.mock.calls[0]?.[1]?.signal?.aborted).toBe(true);
    finish(reply);
    await Promise.resolve();
    expect(completed).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  });

  it.each([null, {}, 7, "not an object", { message: "  " }, { message: ["not a reply"] }])("rejects malformed replies: %j", async (value) => {
    send.mockResolvedValue(value as TarotChatReply);
    await expect(requestTarotFollowUp(input)).rejects.toThrow("no readable message");
    expect(vi.getTimerCount()).toBe(0);
  });

  it.each(["local", "unknown", null])("surfaces a %j source as a fallback even with HTTP success", async (source) => {
    send.mockResolvedValue({ ...reply, source } as TarotChatReply);
    await expect(requestTarotFollowUp(input)).rejects.toThrow("used local fallback");
    expect(vi.getTimerCount()).toBe(0);
  });

  it("accepts an explicitly complete provider response", async () => {
    send.mockResolvedValue({ ...reply, source: "api" } as TarotChatReply);
    await expect(requestTarotFollowUp(input)).resolves.toMatchObject(reply);
  });

  it("cleans up after network failure", async () => {
    send.mockRejectedValue(new Error("Offline"));
    await expect(requestTarotFollowUp(input)).rejects.toThrow("Offline");
    expect(vi.getTimerCount()).toBe(0);
  });
});
