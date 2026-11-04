import type { ChatMessage } from "../hold/chat/types";

/** Recent turns sent with each question. The full conversation stays saved on the device. */
export const ASK_CONTEXT_MAX_MESSAGES = 16;
/** Character budget for those turns, so long messages cannot inflate cost or exceed the request size limit. */
export const ASK_CONTEXT_MAX_CHARS = 12_000;
/** Server limit for one prior turn (`routes/hint.ts`). */
export const ASK_MESSAGE_MAX_CHARS = 4_000;
/** Server limit for the new question (`routes/hint.ts`). */
export const ASK_FOLLOW_UP_MAX_CHARS = 2_000;
/** The server gives the AI provider 20 s. Past this the request is treated as lost and can be retried. */
export const ASK_REPLY_TIMEOUT_MS = 30_000;
/** After the service answers with its offline fallback, wait before another attempt:
 * each attempt still counts toward the daily Ask allowance. */
export const ASK_FALLBACK_COOLDOWN_MS = 60_000;

export type AskContextTurn = { role: ChatMessage["role"]; content: string };

/** Newest whole turns within both budgets, oldest first. */
export function buildAskContext(messages: readonly ChatMessage[]): AskContextTurn[] {
  const selected: AskContextTurn[] = [];
  let chars = 0;
  for (let index = messages.length - 1; index >= 0 && selected.length < ASK_CONTEXT_MAX_MESSAGES; index--) {
    const message = messages[index]!;
    const content = message.content.trim().slice(0, ASK_MESSAGE_MAX_CHARS);
    if (!content) continue;
    if (chars + content.length > ASK_CONTEXT_MAX_CHARS) break;
    chars += content.length;
    selected.push({ role: message.role, content });
  }
  return selected.reverse();
}

/** Turns saved by another tab come first; this tab's unsaved turns follow, each id once. */
export function mergeAskMessages(stored: readonly ChatMessage[], local: readonly ChatMessage[]): ChatMessage[] {
  const storedIds = new Set(stored.map(message => message.id));
  return [...stored, ...local.filter(message => !storedIds.has(message.id))];
}

/** Settles when `signal` aborts even if the transport never does
 * (for example while waiting for the device-session lock before fetch starts). */
export function settleOnAbort<T>(work: Promise<T>, signal: AbortSignal): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const abort = () => reject(signal.reason ?? new DOMException("Request cancelled", "AbortError"));
    if (signal.aborted) { abort(); return; }
    signal.addEventListener("abort", abort, { once: true });
    work.then(
      value => { signal.removeEventListener("abort", abort); resolve(value); },
      (error: unknown) => { signal.removeEventListener("abort", abort); reject(error); },
    );
  });
}
