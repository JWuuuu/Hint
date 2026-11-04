import type { RequestHandler } from "express";
import { CRISIS_COPY, detectCrisis } from "./crisisSupport";
import { logger } from "./logger";

/**
 * Runs before the AI routes. A request whose user text states an intent to end one's
 * life or to self-harm gets the fixed crisis-support reply: no model call, no AI budget,
 * and only a counter is logged, never the text.
 */
type Guarded = { texts: (body: Record<string, unknown>) => unknown[]; reply: "chat" | "refuse" };

const GUARDED: Record<string, Guarded> = {
  // Chat replies keep their usual shape, so the existing message list shows the resources.
  "/hint/chat": { texts: body => [body.followUp], reply: "chat" },
  "/tarot/chat": { texts: body => [body.followUp], reply: "chat" },
  // Readings are never drawn for such a question. The app shows its own support panel
  // before calling these; the refusal is the server-side backstop.
  "/tarot/spread-recommendation": { texts: body => [body.question], reply: "refuse" },
  "/tarot/reading": { texts: body => [body.question, body.emotionalContext], reply: "refuse" },
  "/tarot/structured-reading": { texts: body => [body.question, body.additionalContext], reply: "refuse" },
};

let served = 0;
export function crisisSupportServed(): number {
  return served;
}

export const crisisGuard: RequestHandler = (req, res, next) => {
  const route = req.method === "POST" ? GUARDED[req.path] : undefined;
  if (!route) { next(); return; }
  const body = req.body && typeof req.body === "object" ? req.body as Record<string, unknown> : {};
  const language = route.texts(body).map(value => (typeof value === "string" ? detectCrisis(value) : null)).find(Boolean) ?? null;
  if (!language) { next(); return; }
  served += 1;
  logger.info({ event: "safety.crisis_support", route: req.path, served }, "Served the fixed crisis-support reply");
  const message = CRISIS_COPY[language].body;
  if (route.reply === "chat") {
    res.json({ message, source: "safety", safety: "crisis", createdAt: new Date().toISOString() });
    return;
  }
  res.status(409).json({ error: "CRISIS_SUPPORT", safety: "crisis", message });
};
