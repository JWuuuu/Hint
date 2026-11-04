// @vitest-environment jsdom
import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { useAskHintChat } from "./useAskHintChat";
import { saveAskConversation, listAskHistory } from "./askHistory";
import { writeTextDraft, readTextDraft, textDraftKey } from "../../lib/textDraft";
const { send, visit } = vi.hoisted(() => ({ send: vi.fn(), visit: { closed: false, onLeave: undefined as (() => void) | undefined } }));
vi.mock("../../components/app/roomVisits", () => ({ roomVisitWasClosed: () => visit.closed, markRoomVisitStarted: () => { visit.closed = false; } }));
vi.mock("../../components/app/RoomVisitBoundary", () => ({ useRoomVisit: (options: { onLeave?: () => void }) => { visit.onLeave = options.onLeave; } }));
vi.mock("@workspace/api-client-react", () => ({ sendAmbientChatMessage: send }));
vi.mock("../../lib/i18n", () => ({ useLanguage: () => ({ t: (key: string) => key }) }));
vi.mock("../../lib/identity", () => ({ getAnonId: () => "fixture" }));
vi.mock("../../lib/clearHistory", () => ({ historyClearVersion: (owner: string) => localStorage.getItem(`hint_history_clear_version_v1:${owner}`) ?? "" }));
beforeEach(() => { localStorage.clear(); send.mockReset(); visit.closed = false; visit.onLeave = undefined; window.history.replaceState(null, "", "/app/ask"); });
afterEach(() => vi.restoreAllMocks());
it("keeps failed questions across remount, retries once, then clears the confirmed draft", async () => {
  send.mockRejectedValueOnce(new Error("503"));
  const first = renderHook(() => useAskHintChat());
  act(() => first.result.current.setDraft("Will this draft survive?"));
  await act(() => first.result.current.sendMessage(first.result.current.draft));
  expect(first.result.current.draft).toBe("Will this draft survive?");
  expect(first.result.current.error).toBeTruthy();
  first.unmount();
  const second = renderHook(() => useAskHintChat());
  expect(second.result.current.draft).toBe("Will this draft survive?");
  send.mockResolvedValueOnce({ message: "A response", createdAt: "2026-09-09T00:00:00Z" });
  await act(() => second.result.current.sendMessage(second.result.current.draft));
  expect(second.result.current.draft).toBe("");
  expect(second.result.current.messages).toHaveLength(2);
  second.unmount();
});
it("aborts on leaving and ignores a late response; repeated send makes only one request", async () => {
  let finish!: (reply: object) => void;
  send.mockImplementation(() => new Promise(resolve => { finish = resolve; }));
  const first = renderHook(() => useAskHintChat());
  act(() => first.result.current.setDraft("Keep me"));
  act(() => { void first.result.current.sendMessage("Keep me"); void first.result.current.sendMessage("Keep me"); });
  expect(send).toHaveBeenCalledTimes(1);
  const signal = send.mock.calls[0][1].signal as AbortSignal;
  first.unmount();
  expect(signal.aborted).toBe(true);
  await act(async () => finish({ message: "Late", createdAt: "2026-09-09" }));
  const second = renderHook(() => useAskHintChat());
  expect(second.result.current.draft).toBe("Keep me");
  expect(second.result.current.messages).toHaveLength(0);
  second.unmount();
});
it("restores successful exchanges separately from an unsent follow-up draft", async () => {
  send.mockResolvedValue({ message: "Saved response", createdAt: "2026-09-09T00:00:00Z" });
  const first = renderHook(() => useAskHintChat());
  act(() => first.result.current.setDraft("First question"));
  await act(() => first.result.current.sendMessage("First question"));
  act(() => first.result.current.setDraft("Unsent follow-up"));
  expect(first.result.current.historySaved).toBe(true); first.unmount();
  const second = renderHook(() => useAskHintChat());
  expect(second.result.current.messages.map(message => message.content)).toEqual(["First question", "Saved response"]);
  expect(second.result.current.draft).toBe("Unsent follow-up"); second.unmount();
});
it("keeps a successful response on screen and retries history persistence without another AI request", async () => {
  send.mockResolvedValue({ message: "Response stays visible", createdAt: "2026-09-09T00:00:00Z" });
  const first = renderHook(() => useAskHintChat());
  act(() => first.result.current.setDraft("Question"));
  const write = Storage.prototype.setItem;
  const denied = vi.spyOn(Storage.prototype, "setItem").mockImplementation(function (this: Storage, key, value) {
    if (key.startsWith("hint_ask_history")) throw new Error("Full");
    return write.call(this, key, value);
  });
  await act(() => first.result.current.sendMessage("Question"));
  expect(first.result.current.messages).toHaveLength(2); expect(first.result.current.historySaved).toBe(false);
  denied.mockRestore(); act(() => first.result.current.retrySaveHistory());
  expect(first.result.current.historySaved).toBe(true); expect(send).toHaveBeenCalledTimes(1);
  first.unmount();
});
it("does not resurrect a conversation when another tab clears history during a request", async () => {
  let finish!: (reply: object) => void;
  send.mockImplementation(() => new Promise(resolve => { finish = resolve; }));
  const first = renderHook(() => useAskHintChat());
  act(() => first.result.current.setDraft("Old question"));
  act(() => { void first.result.current.sendMessage("Old question"); });
  act(() => { localStorage.removeItem("hint_text_draft_v1:fixture:ask:"); localStorage.setItem("hint_history_clear_version_v1:fixture", "cleared"); window.dispatchEvent(new Event("storage")); });
  await act(async () => finish({ message: "Late answer", createdAt: "2026-09-09" }));
  expect(first.result.current.messages).toEqual([]); expect(first.result.current.draft).toBe("");
  expect(localStorage.getItem("hint_ask_history_v1:fixture")).toBeNull(); first.unmount();
});
it("starts a closed room blank without overwriting its draft and restores it only on request", () => {
  const key = textDraftKey("ask", "fixture");
  const before = writeTextDraft(key, "A previous question").draft;
  visit.closed = true;
  const view = renderHook(() => useAskHintChat());
  expect(view.result.current.draft).toBe(""); expect(view.result.current.canRestoreDraft).toBe(true);
  expect(readTextDraft(key)).toEqual(before);
  writeTextDraft(key, "Updated in another tab");
  act(() => view.result.current.restoreDraft());
  expect(view.result.current.draft).toBe("Updated in another tab"); expect(visit.closed).toBe(false);
  view.unmount();
  const reload = renderHook(() => useAskHintChat());
  expect(reload.result.current.draft).toBe("Updated in another tab"); reload.unmount();
});
it("keeps a fresh draft separate from the prior active conversation across refresh", () => {
  saveAskConversation({ id: "prior", anonId: "fixture", createdAt: "2026-09-10", updatedAt: "2026-09-10", messages: [{ id: "old", role: "assistant", content: "Prior saved answer", createdAt: "2026-09-10" }] });
  visit.closed = true;
  const fresh = renderHook(() => useAskHintChat());
  expect(fresh.result.current.messages).toEqual([]);
  act(() => fresh.result.current.setDraft("A different question")); fresh.unmount();
  const reload = renderHook(() => useAskHintChat());
  expect(reload.result.current.draft).toBe("A different question"); expect(reload.result.current.messages).toEqual([]);
  expect(listAskHistory("fixture")).toHaveLength(1);
  act(() => reload.result.current.openConversation("prior"));
  expect(reload.result.current.messages[0]?.content).toBe("Prior saved answer"); reload.unmount();
});
it("honors an explicit History conversation link after closing the room", () => {
  saveAskConversation({ id: "history-id", anonId: "fixture", createdAt: "2026-09-10", updatedAt: "2026-09-10", messages: [{ id: "answer", role: "assistant", content: "History answer", createdAt: "2026-09-10" }] });
  visit.closed = true; window.history.replaceState(null, "", "/app/ask?conversation=history-id");
  const view = renderHook(() => useAskHintChat());
  expect(view.result.current.messages[0]?.content).toBe("History answer"); view.unmount();
});
it("does not mistake the current visit's refresh URL for an explicit History restore after departure", async () => {
  send.mockResolvedValue({ message: "Saved response", createdAt: "2026-09-10T00:00:00Z" });
  const first = renderHook(() => useAskHintChat());
  act(() => first.result.current.setDraft("Prior question"));
  await act(() => first.result.current.sendMessage("Prior question")); first.unmount();
  visit.closed = true;
  const returning = renderHook(() => useAskHintChat());
  expect(returning.result.current.messages).toEqual([]); expect(listAskHistory("fixture")).toHaveLength(1); returning.unmount();
});
it("invalidates a reply immediately on confirmed departure before React unmounts", async () => {
  let finish!: (reply: object) => void;
  send.mockImplementation(() => new Promise(resolve => { finish = resolve; }));
  const view = renderHook(() => useAskHintChat());
  act(() => view.result.current.setDraft("Leave while sending"));
  act(() => { void view.result.current.sendMessage("Leave while sending"); });
  act(() => visit.onLeave?.());
  expect(send.mock.calls[0][1].signal.aborted).toBe(true);
  await act(async () => finish({ message: "Too late", createdAt: "2026-09-10" }));
  expect(listAskHistory("fixture")).toEqual([]); expect(view.result.current.draft).toBe("Leave while sending"); view.unmount();
});

const longConversation = (id: string, exchanges: number, size = 300) => ({
  id, anonId: "fixture", createdAt: "2026-09-10", updatedAt: "2026-09-10",
  messages: Array.from({ length: exchanges * 2 }, (_, index) => ({
    id: `${id}-${index}`, role: index % 2 ? "assistant" as const : "user" as const,
    content: `${index % 2 ? "Answer" : "Question"} ${index} `.padEnd(size, "~"), createdAt: "2026-09-10",
  })),
});
const sentTurns = (call = 0) => send.mock.calls[call][0].messages as { role: string; content: string }[];

it("keeps a long restored conversation working by sending only a bounded recent context", async () => {
  const saved = longConversation("long", 25);
  saveAskConversation(saved);
  window.history.replaceState(null, "", "/app/ask?conversation=long");
  send.mockResolvedValue({ message: "Still with you", source: "api", createdAt: "2026-09-11T00:00:00Z" });
  const view = renderHook(() => useAskHintChat());
  act(() => view.result.current.setDraft("Exchange twenty-six"));
  await act(() => view.result.current.sendMessage("Exchange twenty-six"));
  const turns = sentTurns();
  expect(turns.length).toBeGreaterThan(0); expect(turns.length).toBeLessThanOrEqual(16);
  expect(turns.reduce((sum, turn) => sum + turn.content.length, 0)).toBeLessThanOrEqual(12_000);
  expect(turns).toEqual(saved.messages.slice(-turns.length).map(({ role, content }) => ({ role, content })));
  expect(view.result.current.messages).toHaveLength(52);
  expect(listAskHistory("fixture")[0]?.messages).toHaveLength(52);
  view.unmount();
});

it("clips a stored turn that is longer than the server accepts", async () => {
  saveAskConversation({ ...longConversation("oversized", 1), messages: [{ id: "big", role: "assistant", content: "x".repeat(5_000), createdAt: "2026-09-10" }] });
  window.history.replaceState(null, "", "/app/ask?conversation=oversized");
  send.mockResolvedValue({ message: "Reply", createdAt: "2026-09-11T00:00:00Z" });
  const view = renderHook(() => useAskHintChat());
  await act(() => view.result.current.sendMessage("Next"));
  expect(sentTurns()[0]?.content.length).toBeLessThanOrEqual(4_000);
  view.unmount();
});

it("does not save the service's offline fallback as Hint's answer, keeps the question, and pauses retries briefly", async () => {
  vi.useFakeTimers();
  try {
    send.mockResolvedValueOnce({ message: "The live AI room is unavailable right now.", source: "local", createdAt: "2026-09-11T00:00:00Z" });
    const view = renderHook(() => useAskHintChat());
    act(() => view.result.current.setDraft("Are you there?"));
    await act(() => view.result.current.sendMessage("Are you there?"));
    expect(view.result.current.messages).toEqual([]);
    expect(view.result.current.error).toBe("ask.error.quota");
    expect(view.result.current.draft).toBe("Are you there?");
    expect(listAskHistory("fixture")).toEqual([]);
    // Each attempt counts toward the daily allowance, so an immediate retry is held back.
    expect(view.result.current.isLimited).toBe(true);
    await act(() => view.result.current.sendMessage(view.result.current.draft));
    expect(send).toHaveBeenCalledTimes(1);
    await act(async () => { await vi.advanceTimersByTimeAsync(60_000); });
    expect(view.result.current.isLimited).toBe(false);
    send.mockResolvedValueOnce({ message: "A real answer", source: "api", createdAt: "2026-09-11T00:01:00Z" });
    await act(() => view.result.current.sendMessage(view.result.current.draft));
    expect(view.result.current.messages.map(message => message.content)).toEqual(["Are you there?", "A real answer"]);
    expect(view.result.current.error).toBeNull();
    view.unmount();
  } finally { vi.useRealTimers(); }
});

it("shows and saves the server's fixed safety reply like any real answer", async () => {
  send.mockResolvedValueOnce({ message: "Please call your local emergency number now.", source: "safety", safety: "crisis", createdAt: "2026-09-11T00:00:00Z" });
  const view = renderHook(() => useAskHintChat());
  await act(() => view.result.current.sendMessage("I want to end my life"));
  expect(view.result.current.messages.map(message => message.content)).toEqual(["I want to end my life", "Please call your local emergency number now."]);
  expect(view.result.current.error).toBeNull(); expect(view.result.current.isLimited).toBe(false);
  expect(listAskHistory("fixture")[0]?.messages).toHaveLength(2); view.unmount();
});

it("treats an empty reply as a failed request", async () => {
  send.mockResolvedValueOnce({ message: "   ", createdAt: "2026-09-11T00:00:00Z" });
  const view = renderHook(() => useAskHintChat());
  await act(() => view.result.current.sendMessage("Hello?"));
  expect(view.result.current.messages).toEqual([]); expect(view.result.current.error).toBe("ask.error.quiet");
  expect(listAskHistory("fixture")).toEqual([]); view.unmount();
});

it("ends a stalled request, keeps the question, and lets the retry succeed", async () => {
  vi.useFakeTimers();
  try {
    send.mockImplementationOnce((_body: unknown, { signal }: { signal: AbortSignal }) => new Promise((_resolve, reject) => {
      signal.addEventListener("abort", () => reject(signal.reason), { once: true });
    }));
    const view = renderHook(() => useAskHintChat());
    act(() => view.result.current.setDraft("Slow network question"));
    act(() => { void view.result.current.sendMessage("Slow network question"); });
    expect(view.result.current.isThinking).toBe(true);
    await act(async () => { await vi.advanceTimersByTimeAsync(29_000); });
    expect(view.result.current.isThinking).toBe(true);
    await act(async () => { await vi.advanceTimersByTimeAsync(1_000); });
    expect(view.result.current.isThinking).toBe(false);
    expect(send.mock.calls[0][1].signal.aborted).toBe(true);
    expect(view.result.current.error).toBe("ask.error.quiet");
    expect(view.result.current.messages).toEqual([]);
    expect(view.result.current.draft).toBe("Slow network question");
    send.mockResolvedValueOnce({ message: "Here now", source: "api", createdAt: "2026-09-11T00:00:00Z" });
    await act(() => view.result.current.sendMessage(view.result.current.draft));
    expect(view.result.current.messages.map(message => message.content)).toEqual(["Slow network question", "Here now"]);
    expect(send).toHaveBeenCalledTimes(2);
    view.unmount();
  } finally { vi.useRealTimers(); }
});

it("does not send a question longer than the service accepts", async () => {
  const view = renderHook(() => useAskHintChat());
  const long = "a".repeat(2_001);
  act(() => view.result.current.setDraft(long));
  await act(() => view.result.current.sendMessage(long));
  expect(send).not.toHaveBeenCalled();
  expect(view.result.current.error).toBe("ask.error.tooLong");
  expect(view.result.current.canRetry).toBe(false);
  expect(view.result.current.draft).toBe(long);
  view.unmount();
});

it("keeps turns another tab saved to the same conversation instead of overwriting them", async () => {
  const base = longConversation("shared", 1, 20);
  saveAskConversation(base);
  window.history.replaceState(null, "", "/app/ask?conversation=shared");
  const view = renderHook(() => useAskHintChat());
  const other = [...base.messages,
    { id: "other-q", role: "user" as const, content: "Asked in another tab", createdAt: "2026-09-10T01:00:00Z" },
    { id: "other-a", role: "assistant" as const, content: "Answered in another tab", createdAt: "2026-09-10T01:00:05Z" }];
  saveAskConversation({ ...base, updatedAt: "2026-09-10T01:00:05Z", messages: other });
  send.mockResolvedValueOnce({ message: "Answered here", source: "api", createdAt: "2026-09-10T02:00:00Z" });
  await act(() => view.result.current.sendMessage("Asked here"));
  const stored = listAskHistory("fixture").find(row => row.id === "shared")!;
  expect(stored.messages.map(message => message.content)).toEqual([
    ...base.messages.map(message => message.content), "Asked in another tab", "Answered in another tab", "Asked here", "Answered here"]);
  expect(new Set(stored.messages.map(message => message.id)).size).toBe(stored.messages.length);
  expect(view.result.current.messages).toEqual(stored.messages);
  view.unmount();
});

it("ends the wait even when the request never starts, for example while the session lock is held", async () => {
  vi.useFakeTimers();
  try {
    send.mockImplementationOnce(() => new Promise(() => undefined));
    const view = renderHook(() => useAskHintChat());
    act(() => view.result.current.setDraft("Waiting on a lock"));
    act(() => { void view.result.current.sendMessage("Waiting on a lock"); });
    await act(async () => { await vi.advanceTimersByTimeAsync(30_000); });
    expect(view.result.current.isThinking).toBe(false);
    expect(view.result.current.error).toBe("ask.error.quiet");
    expect(view.result.current.draft).toBe("Waiting on a lock");
    view.unmount();
  } finally { vi.useRealTimers(); }
});

it("retrying a failed save keeps turns another tab saved in the meantime", async () => {
  send.mockResolvedValueOnce({ message: "Answer here", source: "api", createdAt: "2026-09-10T02:00:00Z" });
  const view = renderHook(() => useAskHintChat());
  const write = Storage.prototype.setItem;
  const denied = vi.spyOn(Storage.prototype, "setItem").mockImplementation(function (this: Storage, key, value) {
    if (key.startsWith("hint_ask_history")) throw new Error("Unavailable");
    return write.call(this, key, value);
  });
  await act(() => view.result.current.sendMessage("Question here"));
  expect(view.result.current.historySaved).toBe(false);
  denied.mockRestore();
  const id = new URL(window.location.href).searchParams.get("conversation")!;
  saveAskConversation({ id, anonId: "fixture", createdAt: "2026-09-10T01:00:00Z", updatedAt: "2026-09-10T03:00:00Z",
    messages: [{ id: "other-q", role: "user", content: "Other tab question", createdAt: "2026-09-10T03:00:00Z" },
      { id: "other-a", role: "assistant", content: "Other tab answer", createdAt: "2026-09-10T03:00:05Z" }] });
  act(() => view.result.current.retrySaveHistory());
  expect(view.result.current.historySaved).toBe(true);
  expect(listAskHistory("fixture").find(row => row.id === id)!.messages.map(message => message.content))
    .toEqual(["Other tab question", "Other tab answer", "Question here", "Answer here"]);
  view.unmount();
});
