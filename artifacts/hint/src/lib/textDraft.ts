/** Scoped, revisioned drafts. Empty text is a draft too (it may delete a saved note). */
export type TextDraft = { text: string; revision: string; editedAt?: string };
export const textDraftKey = (scope: string, owner: string, date = "") =>
  `hint_text_draft_v1:${encodeURIComponent(owner)}:${scope}:${date}`;
export function readTextDraft(key: string): TextDraft | null {
  try {
    const value = JSON.parse(localStorage.getItem(key) ?? "null");
    return value && typeof value.text === "string" && typeof value.revision === "string" ? value : null;
  } catch { return null; }
}
export function writeTextDraft(key: string, text: string): { draft: TextDraft; saved: boolean } {
  const draft = { text, revision: crypto.randomUUID(), editedAt: new Date().toISOString() };
  try { localStorage.setItem(key, JSON.stringify(draft)); return { draft, saved: true }; }
  catch { return { draft, saved: false }; }
}
export function clearTextDraft(key: string, submitted: TextDraft): boolean {
  try {
    if (readTextDraft(key)?.revision === submitted.revision) localStorage.removeItem(key);
    return true;
  } catch { return false; }
}
