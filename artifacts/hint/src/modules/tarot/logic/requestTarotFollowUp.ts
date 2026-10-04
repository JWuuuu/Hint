import { sendTarotChatMessage, type TarotChatInput, type TarotChatReply } from "@workspace/api-client-react";

export const TAROT_FOLLOW_UP_TIMEOUT_MS = 12_000;

export function requestTarotFollowUp(
  input: TarotChatInput,
  { signal, timeoutMs = TAROT_FOLLOW_UP_TIMEOUT_MS }: {
    signal?: AbortSignal;
    timeoutMs?: number;
  } = {},
): Promise<TarotChatReply> {
  return new Promise((resolve, reject) => {
    const controller = new AbortController();
    let settled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const finish = (error?: unknown, reply?: TarotChatReply) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      signal?.removeEventListener("abort", cancel);
      if (reply === undefined) reject(error);
      else resolve(reply);
    };
    const cancel = () => {
      finish(new DOMException("Reading closed", "AbortError"));
      controller.abort();
    };
    if (signal?.aborted) {
      cancel();
      return;
    }
    signal?.addEventListener("abort", cancel, { once: true });
    timer = setTimeout(() => {
      finish(new DOMException("Tarot follow-up timed out", "TimeoutError"));
      controller.abort();
    }, timeoutMs);

    // Settle independently of the transport: a late or non-aborting response has no owner.
    void Promise.resolve()
      .then(() => sendTarotChatMessage(input, { signal: controller.signal }))
      .then((reply) => {
        if (settled) return;
        if (!reply || typeof reply !== "object" || typeof reply.message !== "string" || !reply.message.trim()) {
          finish(new Error("Tarot follow-up has no readable message"));
          return;
        }
        if ("source" in reply && reply.source !== "api") {
          finish(new Error("Tarot follow-up used local fallback"));
          return;
        }
        finish(undefined, { ...reply, message: reply.message.trim() });
      }, (error: unknown) => finish(error));
  });
}
