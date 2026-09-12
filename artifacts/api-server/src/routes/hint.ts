/**
 * Hint ambient chat route — standalone "Ask Hint" conversation
 * with no tarot reading attached.
 */

import { Router } from "express";
import * as z from "zod";
import { generateAmbientChatReply } from "../modules/hint/chat/ambientReader.js";
import { consumeAiBudget } from "../lib/aiCostGuards.js";
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

const ambientChatInputSchema = z.object({
  messages: z.array(chatMessageSchema).max(40),
  followUp: z.string().min(1).max(2000),
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

router.post("/hint/chat", async (req, res) => {
  const parsed = ambientChatInputSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid input" });
    return;
  }

  if (!await consumeAiBudget(req, res, { feature: "hint_chat", dailyLimit: 20 })) {
    return;
  }

  let message: string;

  try {
    message = await generateAmbientChatReply({
      messages: parsed.data.messages,
      followUp: parsed.data.followUp,
    });
  } catch (err) {
    logger.error({ err }, "Failed to generate ambient chat reply");
    if (!isQuotaError(err)) {
      res.status(502).json({
        error: "The AI room could not answer right now.",
      });
      return;
    }

    message = buildLocalAmbientReply(parsed.data);
  }

  res.json({
    message,
    createdAt: new Date().toISOString(),
  });
});

export default router;
