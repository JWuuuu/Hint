/**
 * Ambient Hint chat — no tarot reading required.
 * Same OpenAI integration pattern as chatReader.ts.
 */

import type { ChatCompletionMessageParam } from "openai/resources/chat/completions";
import {
  getOpenAIClient,
  openaiModel,
} from "../../../lib/openaiConfig.js";
import { HINT_AMBIENT_SYSTEM_PROMPT } from "./ambientPrompt.js";

export interface AmbientChatTurn {
  role: "user" | "assistant";
  content: string;
}

/** Most recent turns the model sees. Older turns stay in the client's saved history. */
export const AMBIENT_HISTORY_MAX_MESSAGES = 16;
/** Bounds prompt size (and cost) when individual turns are long. */
export const AMBIENT_HISTORY_MAX_CHARS = 12_000;

/** The model returned no usable text; callers should offer a retry, not a canned answer. */
export class EmptyAmbientReplyError extends Error {
  constructor() {
    super("The ambient chat model returned an empty reply.");
    this.name = "EmptyAmbientReplyError";
  }
}

/** Newest whole turns that fit both the turn and character budgets, in their original order. */
export function selectAmbientHistory(messages: AmbientChatTurn[]): AmbientChatTurn[] {
  const selected: AmbientChatTurn[] = [];
  let chars = 0;
  for (let index = messages.length - 1; index >= 0 && selected.length < AMBIENT_HISTORY_MAX_MESSAGES; index--) {
    const turn = messages[index]!;
    if (chars + turn.content.length > AMBIENT_HISTORY_MAX_CHARS) break;
    chars += turn.content.length;
    selected.push(turn);
  }
  return selected.reverse();
}

export async function generateAmbientChatReply(params: {
  messages: AmbientChatTurn[];
  followUp: string;
  signal?: AbortSignal;
}): Promise<string> {
  const messages: ChatCompletionMessageParam[] = [
    { role: "system", content: HINT_AMBIENT_SYSTEM_PROMPT },
    ...selectAmbientHistory(params.messages).map<ChatCompletionMessageParam>((m) => ({
      role: m.role,
      content: m.content,
    })),
    { role: "user", content: params.followUp },
  ];

  const response = await getOpenAIClient().chat.completions.create({
    model: openaiModel,
    max_completion_tokens: 600,
    messages,
  }, { signal: params.signal });

  const reply = response.choices[0]?.message?.content?.trim() ?? "";
  if (!reply) throw new EmptyAmbientReplyError();
  return reply;
}
