// @vitest-environment jsdom
import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { clearSavedJournalDraft, EMPTY_JOURNAL_DRAFT, readJournalDraft, readJournalDraftRecord, writeJournalDraft, writeJournalDraftRecord } from "./journalDraft";

const page = { title: "A quiet moment", body: "One thing to remember.", mood: "still" };
beforeEach(() => { localStorage.clear(); writeJournalDraft("first", EMPTY_JOURNAL_DRAFT); });
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
    expect(readJournalDraftRecord("first")).toEqual({ draft: page, revision: renewed.revision, submission: renewed.submission });
    clearSavedJournalDraft("first", page, renewed.revision);
    expect(readJournalDraft("first")).toEqual(EMPTY_JOURNAL_DRAFT);
  });
  it("invalidates a memory-only retry when history is cleared and keeps owners separate", () => {
    const fail = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new Error("Unavailable"); });
    const written = writeJournalDraftRecord("first", page);
    expect(readJournalDraftRecord("first").submission).toEqual(written.submission);
    expect(readJournalDraftRecord("unrelated").submission).toBeUndefined();
    fail.mockRestore();
    localStorage.setItem("hint_history_clear_version_v1:first", "new-clear");
    expect(readJournalDraft("first")).toEqual(EMPTY_JOURNAL_DRAFT);
    expect(readJournalDraftRecord("first").submission).toBeUndefined();
  });
  it("preserves another tab's newer durable draft when an older memory-only save succeeds", () => {
    writeJournalDraft("first", { ...page, body: "Original durable draft" });
    const fail = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new Error("Quota exceeded"); });
    const pending = writeJournalDraftRecord("first", page);
    expect(readJournalDraftRecord("first").submission).toEqual(pending.submission);
    fail.mockRestore();
    const newer = { ...page, body: "Newer writing from a second tab", revision: crypto.randomUUID(),
      submission: { clientRequestId: crypto.randomUUID(), editedAt: new Date().toISOString() } };
    localStorage.setItem("hint_journal_draft_v1:first", JSON.stringify(newer));
    clearSavedJournalDraft("first", page, pending.revision);
    expect(JSON.parse(localStorage.getItem("hint_journal_draft_v1:first")!)).toEqual(newer);
    expect(readJournalDraftRecord("first").submission).toEqual(newer.submission);
  });
  it("clears the old durable version after a memory-only save when no other tab has changed it", () => {
    writeJournalDraft("first", { ...page, body: "Older durable version" });
    const fail = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new Error("Quota exceeded"); });
    const pending = writeJournalDraftRecord("first", page);
    fail.mockRestore();
    expect(clearSavedJournalDraft("first", page, pending.revision)).toBe(true);
    expect(localStorage.getItem("hint_journal_draft_v1:first")).toBeNull();
  });
  it("reports failed deletion after a confirmed save and preserves the original durable retry key for a restart", async () => {
    const pending = writeJournalDraftRecord("first", page);
    vi.spyOn(Storage.prototype, "removeItem").mockImplementation(() => { throw new Error("Storage denied"); });
    expect(clearSavedJournalDraft("first", page, pending.revision)).toBe(false);
    expect(readJournalDraftRecord("first")).toMatchObject({ draft: EMPTY_JOURNAL_DRAFT, storageFailed: true });
    // Memory suppresses the confirmed draft for this session; a new realm can
    // only recover what is still durable, with the same server retry identity.
    vi.resetModules();
    const restarted = await import("./journalDraft");
    expect(restarted.readJournalDraftRecord("first")).toMatchObject({ draft: page, submission: pending.submission });
  });
});
