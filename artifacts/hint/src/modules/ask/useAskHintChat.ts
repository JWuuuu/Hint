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
  historySaved: boolean | null;
  retrySaveHistory: () => void;
  newConversation: () => void;
  openConversation: (id: string) => void;
  sendMessage: (text: string) => Promise<void>;
}

function readStatus(error: unknown): number | null {
  return typeof error === "object" && error ? (error as { status?: number }).status ?? null : null;
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
        return;
      }

      beginVisit();

      inFlightRef.current = true;
      setIsThinking(true);
      const requestGeneration = ++generation.current;
      controller.current = new AbortController();
      const submitted = draftRef.current?.text.trim() === trimmed ? draftRef.current : writeTextDraft(draftKey, trimmed).draft;
      setError(null);

      const userMessage: ChatMessage = {
        id: newMessageId(),
        role: "user",
        content: trimmed,
        createdAt: new Date().toISOString(),
      };
      const withUser = [...messages, userMessage];
      setMessages(withUser);

      try {
        const reply = await sendAmbientChatMessage({
          messages: messages.map((m) => ({ role: m.role, content: m.content })),
          followUp: trimmed,
        }, { signal: controller.current.signal });
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
        const confirmed = [...withUser, assistantMessage];
        setMessages(confirmed);
        conversation.current = { id: conversation.current?.id ?? crypto.randomUUID(), anonId: owner,
          createdAt: conversation.current?.createdAt ?? userMessage.createdAt, updatedAt: assistantMessage.createdAt, messages: confirmed };
        setHistorySaved(saveAskConversation(conversation.current));
        setConversationLocation(conversation.current.id);
      } catch (e) {
        if (requestGeneration !== generation.current) return;
        const status = readStatus(e);
        const msg = e instanceof Error ? e.message : String(e ?? "");
        if (status === 429) {
          setLimitedUntil(Date.now() + Math.max(readRetryAfter(e), 10_000));
          setError(t("ask.error.limit"));
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
        if (requestGeneration === generation.current) {
          inFlightRef.current = false;
          setIsThinking(false);
        }
      }
    },
    [limitedUntil, messages, draftKey, t, owner]
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
    retrySaveHistory: () => { if (conversation.current) setHistorySaved(saveAskConversation(conversation.current)); },
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
    sendMessage,
  };
}
