/**
 * Standalone ambient-chat hook — no tarot reading attached.
 * Mirrors useTarotChat in shape but talks to /hint/chat.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { sendAmbientChatMessage } from "@workspace/api-client-react";
import type { ChatMessage } from "../hold/chat/types";
import { newMessageId } from "../hold/chat/types";
import { useLanguage } from "../../lib/i18n";

import { getAnonId } from "../../lib/identity";
import { readTextDraft, writeTextDraft, clearTextDraft, textDraftKey, type TextDraft } from "../../lib/textDraft";
import { readActiveAskConversation, saveAskConversation, type AskConversation } from "./askHistory";
import { ASK_FALLBACK_COOLDOWN_MS, ASK_FOLLOW_UP_MAX_CHARS, ASK_REPLY_TIMEOUT_MS, buildAskContext, mergeAskMessages, settleOnAbort } from "./askContext";
import { historyClearVersion } from "../../lib/clearHistory";
import { markRoomVisitStarted, roomVisitWasClosed } from "../../components/app/roomVisits";
import { useRoomVisit } from "../../components/app/RoomVisitBoundary";

export interface UseAskHintChatResult {
  draft: string;
  setDraft: (value: string) => void;
  draftError: boolean;
  canRestoreDraft: boolean;
  restoreDraft: () => void;
  messages: ChatMessage[];
  isThinking: boolean;
  isLimited: boolean;
  error: string | null;
  /** False when sending the same text again cannot succeed (it is too long). */
  canRetry: boolean;
  historySaved: boolean | null;
  retrySaveHistory: () => void;
  newConversation: () => void;
  openConversation: (id: string) => void;
  sendMessage: (text: string) => Promise<void>;
}

function readStatus(error: unknown): number | null {
  return typeof error === "object" && error ? (error as { status?: number }).status ?? null : null;
}

/** A reply that arrived but must not become part of the conversation. */
class UnusableReplyError extends Error {
  constructor(readonly kind: "empty" | "fallback") { super(`Ask reply was ${kind}`); }
}

/** The server marks its offline fallback `source: "local"`; older servers send no source. */
function readReply(reply: unknown): { message: string; createdAt: string } {
  const value = (reply ?? {}) as { message?: unknown; createdAt?: unknown; source?: unknown };
  const message = typeof value.message === "string" ? value.message.trim() : "";
  if (!message) throw new UnusableReplyError("empty");
  if ("source" in value && value.source !== "api") throw new UnusableReplyError("fallback");
  return { message, createdAt: typeof value.createdAt === "string" ? value.createdAt : new Date().toISOString() };
}

function readRetryAfter(error: unknown): number {
  if (!error || typeof error !== "object") return 0;

  const headers = (error as { headers?: Headers }).headers;
  const retryAfter = headers?.get("retry-after");
  if (!retryAfter) return 0;

  const seconds = Number(retryAfter);
  if (Number.isFinite(seconds)) return Math.max(0, seconds * 1000);

  const retryAt = Date.parse(retryAfter);
  return Number.isNaN(retryAt) ? 0 : Math.max(0, retryAt - Date.now());
}

export function useAskHintChat(): UseAskHintChatResult {
  const { t } = useLanguage();
  const owner = getAnonId();
  const [entry] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    const selected = params.get("conversation");
    // A saved History link is an explicit restore. Our own in-visit URL only
    // supports refresh; returning to it with Back must still start fresh.
    const explicitHistory = Boolean(selected) && !params.has("askVisit");
    const fresh = roomVisitWasClosed("ask") && !explicitHistory;
    return { fresh, conversation: fresh ? null : readActiveAskConversation(owner, selected), draft: readTextDraft(textDraftKey("ask", owner)) };
  });
  const started = useRef(!entry.fresh);
  const conversation = useRef<AskConversation | null>(entry.conversation);
  const [messages, setMessages] = useState<ChatMessage[]>(() => conversation.current?.messages ?? []);
  const [historySaved, setHistorySaved] = useState<boolean | null>(conversation.current ? true : null);
  const [error, setError] = useState<string | null>(null);
  const [canRetry, setCanRetry] = useState(true);
  const [limitedUntil, setLimitedUntil] = useState(0);
  const inFlightRef = useRef(false);
  const [isThinking, setIsThinking] = useState(false);
  const draftKey = textDraftKey("ask", getAnonId());
  const draftRef = useRef<TextDraft | null>(entry.fresh ? null : entry.draft);
  const [draft, setDraftText] = useState(draftRef.current?.text ?? "");
  const [recoverableDraft, setRecoverableDraft] = useState(entry.fresh ? entry.draft : null);
  const [draftError, setDraftError] = useState(false);
  const controller = useRef<AbortController | null>(null);
  const generation = useRef(0);
  function setConversationLocation(id: string, explicitHistory = false) {
    const url = new URL(window.location.href); url.searchParams.set("conversation", id);
    if (explicitHistory) url.searchParams.delete("askVisit"); else url.searchParams.set("askVisit", "1");
    window.history.replaceState(window.history.state, "", url);
  }
  function beginVisit() {
    if (!started.current) setConversationLocation("");
    started.current = true;
    markRoomVisitStarted("ask");
  }
  useRoomVisit({ room: "ask", hasProgress: Boolean(draft.trim() || messages.length || isThinking), onLeave: () => {
    generation.current++; controller.current?.abort(); inFlightRef.current = false;
  } });
  useEffect(() => {
    let version = historyClearVersion(owner);
    const changed = () => {
      const current = historyClearVersion(owner);
      if (current === version) return;
      version = current; generation.current++; controller.current?.abort();
      inFlightRef.current = false; setIsThinking(false); setMessages([]); conversation.current = null; setHistorySaved(null); setError(null);
      draftRef.current = readTextDraft(draftKey); setDraftText(draftRef.current?.text ?? "");
      setRecoverableDraft(null);
    };
    window.addEventListener("storage", changed);
    return () => window.removeEventListener("storage", changed);
  }, [owner, draftKey]);
  const setDraft = useCallback((value: string) => {
    beginVisit();
    setRecoverableDraft(null);
    const result = writeTextDraft(draftKey, value);
    draftRef.current = result.draft;
    setDraftText(value);
    setDraftError(!result.saved);
  }, [draftKey]);
  useEffect(() => () => { generation.current++; controller.current?.abort(); }, []);

  /** Save without overwriting turns another tab added to the same conversation since it loaded here. */
  const persistConversation = useCallback((next: AskConversation) => {
    const stored = readActiveAskConversation(owner, next.id);
    const merged: AskConversation = stored
      ? { ...next, createdAt: stored.createdAt, messages: mergeAskMessages(stored.messages, next.messages) }
      : next;
    conversation.current = merged;
    setMessages(merged.messages);
    setHistorySaved(saveAskConversation(merged));
    return merged;
  }, [owner]);

  useEffect(() => {
    if (limitedUntil <= Date.now()) return;

    const timeout = window.setTimeout(
      () => setLimitedUntil(0),
      Math.max(0, limitedUntil - Date.now()),
    );

    return () => window.clearTimeout(timeout);
  }, [limitedUntil]);

  const sendMessage = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed) return;
      if (inFlightRef.current) return;

      if (limitedUntil > Date.now()) {
        setError(t("ask.error.limit"));
        setCanRetry(true);
        return;
      }

      if (trimmed.length > ASK_FOLLOW_UP_MAX_CHARS) {
        setError(t("ask.error.tooLong").replace("{count}", String(ASK_FOLLOW_UP_MAX_CHARS)));
        setCanRetry(false);
        return;
      }

      beginVisit();

      inFlightRef.current = true;
      setIsThinking(true);
      const requestGeneration = ++generation.current;
      const request = new AbortController();
      controller.current = request;
      // A stalled connection must end in a retryable error, not an endless "thinking" state.
      const timeout = window.setTimeout(
        () => request.abort(new DOMException("Ask reply timed out", "TimeoutError")),
        ASK_REPLY_TIMEOUT_MS,
      );
      const submitted = draftRef.current?.text.trim() === trimmed ? draftRef.current : writeTextDraft(draftKey, trimmed).draft;
      setError(null);
      setCanRetry(true);

      const userMessage: ChatMessage = {
        id: newMessageId(),
        role: "user",
        content: trimmed,
        createdAt: new Date().toISOString(),
      };
      const withUser = [...messages, userMessage];
      setMessages(withUser);

      try {
        // Only a bounded recent window is sent; the server rejects unbounded history.
        const reply = readReply(await settleOnAbort(sendAmbientChatMessage({
          messages: buildAskContext(messages),
          followUp: trimmed,
        }, { signal: request.signal }), request.signal));
        if (requestGeneration !== generation.current) return;
        setDraftError(!clearTextDraft(draftKey, submitted));
        if (draftRef.current?.revision === submitted.revision) {
          draftRef.current = null;
          setDraftText("");
        }

        const assistantMessage: ChatMessage = {
          id: newMessageId(),
          role: "assistant",
          content: reply.message,
          createdAt: reply.createdAt,
        };
        const saved = persistConversation({ id: conversation.current?.id ?? crypto.randomUUID(), anonId: owner,
          createdAt: conversation.current?.createdAt ?? userMessage.createdAt, updatedAt: assistantMessage.createdAt,
          messages: [...withUser, assistantMessage] });
        setConversationLocation(saved.id);
      } catch (e) {
        if (requestGeneration !== generation.current) return;
        const status = readStatus(e);
        const msg = e instanceof Error ? e.message : String(e ?? "");
        if (status === 429) {
          setLimitedUntil(Date.now() + Math.max(readRetryAfter(e), 10_000));
          setError(t("ask.error.limit"));
        } else if (e instanceof UnusableReplyError && e.kind === "fallback") {
          setLimitedUntil(Date.now() + ASK_FALLBACK_COOLDOWN_MS);
          setError(t("ask.error.quota"));
        } else if (e instanceof UnusableReplyError) {
          setError(t("ask.error.quiet"));
        } else {
          setError(
            /quota|billing|too many requests/i.test(msg)
              ? t("ask.error.quota")
              : t("ask.error.quiet"),
          );
        }
        // Roll the user message back out so the user can retry without a stranded turn
        setMessages(messages);
      } finally {
        window.clearTimeout(timeout);
        if (requestGeneration === generation.current) {
          inFlightRef.current = false;
          setIsThinking(false);
        }
      }
    },
    [limitedUntil, messages, draftKey, t, owner, persistConversation]
  );

  return {
    messages,
    draft, setDraft, draftError,
    canRestoreDraft: Boolean(recoverableDraft?.text),
    restoreDraft: () => {
      if (!recoverableDraft || inFlightRef.current) return;
      const latest = readTextDraft(draftKey);
      beginVisit(); draftRef.current = latest;
      setDraftText(latest?.text ?? ""); setRecoverableDraft(null); setDraftError(false);
    },
    historySaved,
    retrySaveHistory: () => { if (conversation.current) persistConversation(conversation.current); },
    openConversation: (id: string) => {
      if (inFlightRef.current || historySaved === false) return;
      const selected = readActiveAskConversation(owner, id);
      if (!selected) return;
      started.current = true; markRoomVisitStarted("ask");
      conversation.current = selected; setMessages(selected.messages); setHistorySaved(true); setError(null);
      setConversationLocation(id, true);
    },
    newConversation: () => {
      if (inFlightRef.current) return;
      started.current = true; markRoomVisitStarted("ask");
      conversation.current = null; setMessages([]); setHistorySaved(null); setError(null);
      setConversationLocation("");
    },
    isThinking,
    isLimited: limitedUntil > Date.now(),
    error,
    canRetry,
    sendMessage,
  };
}
