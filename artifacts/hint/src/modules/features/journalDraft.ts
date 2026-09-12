export type JournalDraft = { title: string; body: string; mood: string | null };

export const EMPTY_JOURNAL_DRAFT: JournalDraft = { title: "", body: "", mood: null };
const key = (anonId: string) => `hint_journal_draft_v1:${anonId}`;

export function readJournalDraftRecord(anonId: string): { draft: JournalDraft; revision: string | null } {
  try {
    const value = JSON.parse(localStorage.getItem(key(anonId)) ?? "null");
    if (value && typeof value.title === "string" && typeof value.body === "string"
      && (value.mood === null || typeof value.mood === "string")) {
      return { draft: { title: value.title, body: value.body, mood: value.mood }, revision: typeof value.revision === "string" ? value.revision : null };
    }
  } catch {
    // A missing or unreadable draft must not prevent writing a new page.
  }
  return { draft: { ...EMPTY_JOURNAL_DRAFT }, revision: null };
}

export function readJournalDraft(anonId: string): JournalDraft { return readJournalDraftRecord(anonId).draft; }

export function writeJournalDraft(anonId: string, draft: JournalDraft): boolean {
  return writeJournalDraftRecord(anonId, draft).saved;
}

export function writeJournalDraftRecord(anonId: string, draft: JournalDraft): { saved: boolean; revision: string } {
  const revision = crypto.randomUUID();
  try {
    if (!draft.title && !draft.body && !draft.mood) localStorage.removeItem(key(anonId));
    else localStorage.setItem(key(anonId), JSON.stringify({ ...draft, revision }));
    return { saved: true, revision };
  } catch {
    return { saved: false, revision };
  }
}

export function clearSavedJournalDraft(anonId: string, submitted: JournalDraft, submittedRevision?: string | null): boolean {
  const record = readJournalDraftRecord(anonId);
  if (submittedRevision !== undefined && record.revision !== submittedRevision) return true;
  const current = record.draft;
  // A save may finish after navigation; preserve anything written since then.
  if (current.title !== submitted.title || current.body !== submitted.body || current.mood !== submitted.mood) return true;
  return writeJournalDraft(anonId, EMPTY_JOURNAL_DRAFT);
}
