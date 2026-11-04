// @vitest-environment jsdom
import { beforeEach, expect, it, vi } from "vitest";

const KEY = "hint_local_question_history_v1";
const row = (overrides: Record<string, unknown> = {}) => ({
  id: "q-1", anonId: "owner", question: "What is opening now?", focus: "Clear signal",
  spreadType: "three", createdAt: "2026-11-01T10:00:00.000Z", ...overrides,
});

beforeEach(() => {
  localStorage.clear(); vi.resetModules();
  localStorage.setItem("hint_anon_id", "owner");
});

it("skips malformed rows instead of failing the whole history", async () => {
  localStorage.setItem(KEY, JSON.stringify([
    null, 7, "text", {}, row({ id: "q-ok" }),
    row({ id: "q-no-question", question: "  " }), row({ id: "q-bad-date", createdAt: "not a date" }),
    row({ id: "q-bad-spread", spreadType: "auto" }), row({ id: "q-no-focus", focus: undefined, createdAt: "2026-11-02T10:00:00.000Z" }),
  ]));
  const { listLocalQuestionHistory } = await import("./localQuestionHistory");
  const items = listLocalQuestionHistory("owner");
  expect(items.map((item) => item.id)).toEqual(["q-no-focus", "q-ok"]);
  expect(items[0]!.focus).toBe("");
});

it("keeps one copy of unreadable history before a new save replaces it", async () => {
  localStorage.setItem(KEY, "{not json");
  const store = await import("./localQuestionHistory");
  expect(store.listLocalQuestionHistory("owner")).toEqual([]);
  store.saveLocalQuestionHistory({ question: "A new question", focus: "", spreadType: "single", anonId: "owner" });
  expect(localStorage.getItem(`${KEY}:unreadable`)).toBe("{not json");
  expect(store.listLocalQuestionHistory("owner").map((item) => item.question)).toEqual(["A new question"]);
  // A later unreadable value does not replace the first preserved copy.
  localStorage.setItem(KEY, "[broken");
  store.listLocalQuestionHistory("owner");
  expect(localStorage.getItem(`${KEY}:unreadable`)).toBe("{not json");
});

it("still de-duplicates and saves well-formed history", async () => {
  const store = await import("./localQuestionHistory");
  store.saveLocalQuestionHistory({ question: "Same question", focus: "a", spreadType: "three", anonId: "owner" });
  store.saveLocalQuestionHistory({ question: "same question ", focus: "b", spreadType: "three", anonId: "owner" });
  expect(store.listLocalQuestionHistory("owner")).toHaveLength(1);
});
