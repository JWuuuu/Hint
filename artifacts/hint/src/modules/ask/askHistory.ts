import type { ChatMessage } from "../hold/chat/types";
export type AskConversation = { id: string; anonId: string; messages: ChatMessage[]; createdAt: string; updatedAt: string };
export const askHistoryKey = (owner: string) => `hint_ask_history_v1:${encodeURIComponent(owner)}`;
export const askActiveKey = (owner: string) => `hint_ask_active_v1:${encodeURIComponent(owner)}`;
const EVENT = "hint:ask-history-updated";

export function listAskHistory(owner: string): AskConversation[] {
  try {
    const rows = JSON.parse(localStorage.getItem(askHistoryKey(owner)) || "[]");
    return Array.isArray(rows) ? rows.filter((row): row is AskConversation => row?.anonId === owner && typeof row.id === "string" && typeof row.updatedAt === "string" && Array.isArray(row.messages) && row.messages.every((message: ChatMessage | null) => message && (message.role === "user" || message.role === "assistant") && typeof message.content === "string" && typeof message.id === "string")) : [];
  } catch { return []; }
}
export function readActiveAskConversation(owner: string, id?: string | null): AskConversation | null {
  try {
    const requested = id ?? localStorage.getItem(askActiveKey(owner));
    return listAskHistory(owner).find(row => row.id === requested) ?? null;
  } catch { return null; }
}
const MAX_SAVED_CONVERSATIONS = 30;
function isStorageFull(error: unknown): boolean {
  const { name, code } = (error ?? {}) as { name?: unknown; code?: unknown };
  return name === "QuotaExceededError" || name === "NS_ERROR_DOM_QUOTA_REACHED" || code === 22 || code === 1014;
}
export function saveAskConversation(conversation: AskConversation): boolean {
  try {
    let rows = [conversation, ...listAskHistory(conversation.anonId).filter(row => row.id !== conversation.id)].slice(0, MAX_SAVED_CONVERSATIONS);
    for (;;) {
      try { localStorage.setItem(askHistoryKey(conversation.anonId), JSON.stringify(rows)); break; }
      catch (error) {
        // Storage shared with the rest of the app is full: give up the oldest saved
        // threads before the one the person is in. Other failures change nothing.
        if (!isStorageFull(error) || rows.length <= 1) return false;
        rows = rows.slice(0, -1);
      }
    }
    localStorage.setItem(askActiveKey(conversation.anonId), conversation.id);
    window.dispatchEvent(new Event(EVENT));
    return true;
  } catch { return false; }
}
export function clearActiveAskConversation(owner: string): boolean {
  try { localStorage.setItem(askActiveKey(owner), ""); return true; }
  catch { return false; }
}
export function subscribeToAskHistory(callback: () => void): () => void {
  window.addEventListener(EVENT, callback); window.addEventListener("storage", callback);
  return () => { window.removeEventListener(EVENT, callback); window.removeEventListener("storage", callback); };
}
