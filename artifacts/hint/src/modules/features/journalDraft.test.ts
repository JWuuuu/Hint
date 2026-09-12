// @vitest-environment jsdom
import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { clearSavedJournalDraft, EMPTY_JOURNAL_DRAFT, readJournalDraft, readJournalDraftRecord, writeJournalDraft, writeJournalDraftRecord } from "./journalDraft";

const page = { title: "A quiet moment", body: "One thing to remember.", mood: "still" };
beforeEach(() => localStorage.clear());
afterEach(() => vi.restoreAllMocks());

describe("journal draft recovery", () => {
  it("keeps each identity's writing separate and clears only the confirmed draft", () => {
    writeJournalDraft("first", page);
    writeJournalDraft("second", { ...page, body: "Another page." });
    expect(readJournalDraft("first")).toEqual(page);
    clearSavedJournalDraft("first", page);
    expect(readJournalDraft("first")).toEqual(EMPTY_JOURNAL_DRAFT);
    expect(readJournalDraft("second").body).toBe("Another page.");
  });
  it("does not erase a newer draft when an earlier save finishes after navigation", () => {
    writeJournalDraft("first", page);
    writeJournalDraft("first", { ...page, body: "New writing." });
    clearSavedJournalDraft("first", page);
    expect(readJournalDraft("first").body).toBe("New writing.");
  });
  it("recovers safely from malformed storage", () => {
    for (const value of ["{broken", "null", "[]", '{"title":7,"body":"text"}']) {
      localStorage.setItem("hint_journal_draft_v1:first", value);
      expect(readJournalDraft("first")).toEqual(EMPTY_JOURNAL_DRAFT);
    }
  });
  it("reports storage failure instead of claiming the draft is safe", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new Error("Quota exceeded"); });
    expect(writeJournalDraft("first", page)).toBe(false);
  });
  it("does not erase identical text written in a newer visit when an older save completes", () => {
    const submitted = writeJournalDraftRecord("first", page);
    writeJournalDraft("first", { ...page, body: "An intervening draft" });
    const renewed = writeJournalDraftRecord("first", page);
    clearSavedJournalDraft("first", page, submitted.revision);
    expect(readJournalDraftRecord("first")).toEqual({ draft: page, revision: renewed.revision });
    clearSavedJournalDraft("first", page, renewed.revision);
    expect(readJournalDraft("first")).toEqual(EMPTY_JOURNAL_DRAFT);
  });
});
