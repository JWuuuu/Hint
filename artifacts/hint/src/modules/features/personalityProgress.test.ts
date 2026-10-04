// @vitest-environment jsdom
import { beforeEach, afterEach, expect, it, vi } from "vitest";
import { readPersonalityProgress, readPersonalityResults, writePersonalityProgress, emptyPersonalityProgress, personalityResultsKey } from "./personalityProgress";
beforeEach(() => localStorage.clear());
afterEach(() => vi.restoreAllMocks());
it("keeps answers, result and the edited question position across reload for only their owner", () => {
  const progress = { answers: ["avoid", "think", "avoid", "think", "avoid", "think"] as const, questionIndex: 2, result: "The Professional Avoider" };
  expect(writePersonalityProgress("a", { ...progress, answers: [...progress.answers] })).toBe(true);
  expect(readPersonalityProgress("a")).toEqual(progress);
  expect(readPersonalityProgress("b")).toEqual(emptyPersonalityProgress());
});
it("claims legacy results once and does not revive them after retaking", () => {
  localStorage.setItem("hint.personalities.answers.v2", '["avoid","think"]');
  expect(readPersonalityProgress("a").answers).toEqual(["avoid", "think"]);
  expect(readPersonalityProgress("b").answers).toEqual([]);
  writePersonalityProgress("a", emptyPersonalityProgress());
  expect(readPersonalityProgress("a").answers).toEqual([]);
  expect(localStorage.getItem("hint.personalities.answers.v2")).toBe('["avoid","think"]');
});
it("reports storage failure without claiming new progress was persisted", () => {
  writePersonalityProgress("a", emptyPersonalityProgress());
  vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new Error("Full"); });
  expect(writePersonalityProgress("a", { answers: ["think"], questionIndex: 1, result: null })).toBe(false);
  expect(readPersonalityProgress("a").answers).toEqual([]);
});
it("preserves each completed result before new visit answers replace active progress", () => {
  const completed = { answers: ["avoid", "think", "avoid", "think", "avoid", "think"] as const, questionIndex: 6, result: "The Professional Avoider" };
  writePersonalityProgress("a", { ...completed, answers: [...completed.answers] });
  writePersonalityProgress("a", { answers: ["think"], questionIndex: 1, result: null });
  expect(readPersonalityResults("a")).toEqual([completed]); expect(readPersonalityResults("b")).toEqual([]);
  expect(readPersonalityProgress("a").answers).toEqual(["think"]);
  writePersonalityProgress("a", { ...completed, answers: [...completed.answers] });
  writePersonalityProgress("a", emptyPersonalityProgress());
  expect(readPersonalityResults("a")).toHaveLength(1);
});
it("keeps the completed active snapshot if its backup cannot be persisted", () => {
  const completed = { answers: ["think"] as const, questionIndex: 6, result: "The Overthinker" };
  writePersonalityProgress("a", { ...completed, answers: [...completed.answers] });
  const original = Storage.prototype.setItem;
  vi.spyOn(Storage.prototype, "setItem").mockImplementation(function(this: Storage, key, value) {
    if (key === personalityResultsKey("a")) throw new Error("Full");
    original.call(this, key, value);
  });
  expect(writePersonalityProgress("a", emptyPersonalityProgress())).toBe(false);
  expect(readPersonalityProgress("a")).toEqual(completed);
});
