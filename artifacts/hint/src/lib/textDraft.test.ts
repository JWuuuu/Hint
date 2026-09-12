// @vitest-environment jsdom
import { beforeEach, afterEach, expect, it, vi } from "vitest";
import { textDraftKey, writeTextDraft, readTextDraft, clearTextDraft } from "./textDraft";
beforeEach(() => localStorage.clear());
afterEach(() => vi.restoreAllMocks());
it("isolates people and dates, retaining empty edits through reload", () => {
  const a = textDraftKey("daily", "a", "2026-09-09");
  writeTextDraft(a, "");
  expect(readTextDraft(a)?.text).toBe("");
  expect(readTextDraft(textDraftKey("daily", "b", "2026-09-09"))).toBeNull();
  expect(readTextDraft(textDraftKey("daily", "a", "2026-09-10"))).toBeNull();
});
it("a late success cannot clear a newer draft even if the text matches again", () => {
  const key = textDraftKey("ask", "a");
  const first = writeTextDraft(key, "same").draft;
  writeTextDraft(key, "new");
  const latest = writeTextDraft(key, "same").draft;
  clearTextDraft(key, first);
  expect(readTextDraft(key)).toEqual(latest);
  clearTextDraft(key, latest);
  expect(readTextDraft(key)).toBeNull();
});
it("reports quota errors without reporting persistence", () => {
  vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new DOMException("full", "QuotaExceededError"); });
  expect(writeTextDraft("x", "retain in UI").saved).toBe(false);
});
