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
export function saveAskConversation(conversation: AskConversation): boolean {
  try {
    const rows = listAskHistory(conversation.anonId).filter(row => row.id !== conversation.id);
    localStorage.setItem(askHistoryKey(conversation.anonId), JSON.stringify([conversation, ...rows].slice(0, 30)));
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
