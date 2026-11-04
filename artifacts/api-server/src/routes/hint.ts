/**
 * Hint ambient chat route — standalone "Ask Hint" conversation
 * with no tarot reading attached.
 */

import { Router } from "express";
import * as z from "zod";
import { EmptyAmbientReplyError, generateAmbientChatReply } from "../modules/hint/chat/ambientReader.js";
import { aiRequestSignal, consumeAiBudget, withAiLease } from "../lib/aiCostGuards.js";
import { logger } from "../lib/logger.js";

const router = Router();
function isQuotaError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error ?? "");
  return /429|quota|billing|too many requests|missing openai|credentials|api[_\s-]?key/i.test(message);
}

const chatMessageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string().min(1).max(4000),
});

/** Turns validated per request. Older turns are dropped, not rejected: clients
 * that send a whole long conversation keep working, and the reader selects a
 * smaller context window from what remains. */
const MAX_VALIDATED_TURNS = 40;

const ambientChatInputSchema = z.object({
  messages: z.preprocess(
    (value) => (Array.isArray(value) ? value.slice(-MAX_VALIDATED_TURNS) : value),
    z.array(chatMessageSchema).max(MAX_VALIDATED_TURNS),
  ),
  followUp: z.string().trim().min(1).max(2000),
});

function buildLocalAmbientReply({
  messages,
  followUp,
}: z.infer<typeof ambientChatInputSchema>): string {
  const lastAssistant = [...messages]
    .reverse()
    .find((message) => message.role === "assistant")?.content;

  return [
    "The live AI room is unavailable right now, but I can still help you slow the thought down.",
    lastAssistant
      ? `The last thread here was: "${lastAssistant.slice(0, 180)}${lastAssistant.length > 180 ? "..." : ""}"`
      : "Start with the plain version of what happened, without making it poetic yet.",
    `For what you just said, "${followUp}", try naming three things: what happened, what you felt first, and what you are afraid it means.`,
    "That will make the next question much easier to ask.",
  ].join("\n\n");
}

router.post("/hint/chat", withAiLease(async (req, res) => {
  const parsed = ambientChatInputSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid input" });
    return;
  }

  if (!await consumeAiBudget(req, res, { feature: "hint_chat", dailyLimit: 20 })) {
    return;
  }

  let message: string;
  // "local" marks the offline fallback below. Clients must show it as a
  // service problem and keep the question for retry, never save it as Hint's answer.
  let source: "api" | "local" = "api";

  try {
    message = await generateAmbientChatReply({
      messages: parsed.data.messages,
      followUp: parsed.data.followUp,
      signal: aiRequestSignal(req),
    });
  } catch (err) {
    if (aiRequestSignal(req).aborted) return;
    logger.error({ err }, "Failed to generate ambient chat reply");
    if (err instanceof EmptyAmbientReplyError || !isQuotaError(err)) {
      res.status(502).json({
        error: "The AI room could not answer right now.",
        code: "PROVIDER_UNAVAILABLE",
      });
      return;
    }

    message = buildLocalAmbientReply(parsed.data);
    source = "local";
  }

  if (res.destroyed) return;
  res.json({
    message,
    source,
    createdAt: new Date().toISOString(),
  });
}));

export default router;
