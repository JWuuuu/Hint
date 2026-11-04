import { expect, it } from "vitest";
import { ASK_CONTEXT_MAX_CHARS, ASK_CONTEXT_MAX_MESSAGES, ASK_MESSAGE_MAX_CHARS, buildAskContext, mergeAskMessages } from "./askContext";
import type { ChatMessage } from "../hold/chat/types";

const message = (id: string, content: string, role: ChatMessage["role"] = "user"): ChatMessage => ({ id, role, content, createdAt: "2026-09-10" });

it("keeps the newest turns in order within the turn limit", () => {
  const turns = Array.from({ length: 40 }, (_, index) => message(String(index), `Turn ${index}`, index % 2 ? "assistant" : "user"));
  const context = buildAskContext(turns);
  expect(context).toHaveLength(ASK_CONTEXT_MAX_MESSAGES);
  expect(context.map(turn => turn.content)).toEqual(turns.slice(-ASK_CONTEXT_MAX_MESSAGES).map(turn => turn.content));
  expect(context[0]).toEqual({ role: turns[24]!.role, content: "Turn 24" });
});

it("stops at the character budget without splitting a turn, skips blank turns and clips oversized ones", () => {
  const big = "b".repeat(ASK_MESSAGE_MAX_CHARS + 500);
  const older = "a".repeat(ASK_MESSAGE_MAX_CHARS), old = "c".repeat(ASK_MESSAGE_MAX_CHARS);
  const context = buildAskContext([message("older", older), message("old", old), message("blank", "   "), message("big", big), message("new", "Latest")]);
  expect(context.map(turn => turn.content)).toEqual([old, big.slice(0, ASK_MESSAGE_MAX_CHARS), "Latest"]);
  expect(context.reduce((sum, turn) => sum + turn.content.length, 0)).toBeLessThanOrEqual(ASK_CONTEXT_MAX_CHARS);
  expect(buildAskContext([])).toEqual([]);
});

it("merges another tab's turns first and never repeats an id", () => {
  const shared = [message("1", "One"), message("2", "Two", "assistant")];
  const merged = mergeAskMessages([...shared, message("t", "Theirs")], [...shared, message("m", "Mine")]);
  expect(merged.map(turn => turn.id)).toEqual(["1", "2", "t", "m"]);
  expect(mergeAskMessages([], shared)).toEqual(shared);
});
