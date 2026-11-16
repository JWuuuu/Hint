export type JournalDraft = { title: string; body: string; mood: string | null };
export type JournalSubmission = { clientRequestId: string; editedAt: string };
export type JournalDraftRecord = { draft: JournalDraft; revision: string | null; submission?: JournalSubmission; storageFailed?: boolean };

export const EMPTY_JOURNAL_DRAFT: JournalDraft = { title: "", body: "", mood: null };
const key = (anonId: string) => `hint_journal_draft_v1:${anonId}`;
// Only failed writes live here. This preserves retry identity during this page
// session, including navigation, without pretending it survives a restart.
const unsaved = new Map<string, { record: JournalDraftRecord; clearVersion: string | null; previousStored: string | null | undefined }>();
function readStored(anonId: string): string | null | undefined {
  try { return localStorage.getItem(key(anonId)); } catch { return undefined; }
}
function clearVersion(anonId: string): string | null {
  try { return localStorage.getItem(`hint_history_clear_version_v1:${anonId}`); } catch { return null; }
}
function copyRecord(record: JournalDraftRecord): JournalDraftRecord {
  return { ...record, draft: { ...record.draft }, ...(record.submission ? { submission: { ...record.submission } } : {}) };
}

export function readJournalDraftRecord(anonId: string): JournalDraftRecord {
  const stored = readStored(anonId);
  const memory = unsaved.get(anonId);
  // A failed local write must not hide a later durable revision from another
  // tab. In particular, completion of the old save must not delete that draft.
  if (memory && memory.clearVersion === clearVersion(anonId)
    && (stored === undefined || stored === memory.previousStored || (memory.previousStored === undefined && stored === null))) return copyRecord(memory.record);
  unsaved.delete(anonId);
  try {
    const value = JSON.parse(stored ?? "null");
    if (value && typeof value.title === "string" && typeof value.body === "string"
      && (value.mood === null || typeof value.mood === "string")) {
      const submission = value.submission;
      const validSubmission = submission && typeof submission.clientRequestId === "string"
        && /^[\da-f]{8}-(?:[\da-f]{4}-){3}[\da-f]{12}$/i.test(submission.clientRequestId)
        && typeof submission.editedAt === "string" && Number.isFinite(Date.parse(submission.editedAt));
      return { draft: { title: value.title, body: value.body, mood: value.mood }, revision: typeof value.revision === "string" ? value.revision : null,
        ...(validSubmission ? { submission: { clientRequestId: submission.clientRequestId, editedAt: submission.editedAt } } : {}) };
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

export function writeJournalDraftRecord(anonId: string, draft: JournalDraft): { saved: boolean; revision: string; submission: JournalSubmission } {
  const revision = crypto.randomUUID();
  const submission = { clientRequestId: revision, editedAt: new Date().toISOString() };
  const previousStored = readStored(anonId);
  try {
    if (!draft.title && !draft.body && !draft.mood) localStorage.removeItem(key(anonId));
    else localStorage.setItem(key(anonId), JSON.stringify({ ...draft, revision, submission }));
    unsaved.delete(anonId);
    return { saved: true, revision, submission };
  } catch {
    unsaved.set(anonId, { record: { draft: { ...draft }, revision, submission, storageFailed: true }, clearVersion: clearVersion(anonId), previousStored });
    return { saved: false, revision, submission };
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
