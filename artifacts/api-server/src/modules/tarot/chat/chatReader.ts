/**
 * Tarot chat reader — handles follow-up turns in an ongoing reading session.
 * Same OpenAI integration pattern as tarotReader.ts.
 */

import type { ChatCompletionMessageParam } from "openai/resources/chat/completions";
import {
  getOpenAIClient,
  openaiModel,
} from "../../../lib/openaiConfig.js";
import type { DrawnCard } from "../logic/drawCards.js";
import {
  HINT_CHAT_SYSTEM_PROMPT,
  buildSessionContextBlock,
} from "./chatPrompt.js";

export interface TarotChatTurn {
  role: "user" | "assistant";
  content: string;
}

export async function generateTarotChatReply(params: {
  originalQuestion: string;
  territory: string;
  emotionalContext: string | null | undefined;
  spreadType: string;
  cards: DrawnCard[];
  initialReading: string;
  messages: TarotChatTurn[];
  followUp: string;
  signal?: AbortSignal;
}): Promise<string> {
  const sessionContext = buildSessionContextBlock({
    originalQuestion: params.originalQuestion,
    territory: params.territory,
    emotionalContext: params.emotionalContext,
    spreadType: params.spreadType,
    cards: params.cards,
    initialReading: params.initialReading,
  });

  // Cap prior history to the last 12 turns to keep context bounded.
  const trimmed = params.messages.slice(-12);

  const messages: ChatCompletionMessageParam[] = [
    { role: "system", content: HINT_CHAT_SYSTEM_PROMPT },
    { role: "system", content: sessionContext },
    ...trimmed.map<ChatCompletionMessageParam>((m) => ({
      role: m.role,
      content: m.content,
    })),
    { role: "user", content: params.followUp },
  ];

  const response = await getOpenAIClient().chat.completions.create({
    model: openaiModel,
    max_completion_tokens: 700,
    messages,
  }, { signal: params.signal, timeout: 11_500 });

  const choice = response.choices[0];
  const reply = choice?.message.content?.trim();
  if (choice?.finish_reason !== "stop" || choice.message.refusal || !reply) {
    throw new Error("Tarot follow-up did not complete");
  }
  return reply;
}
