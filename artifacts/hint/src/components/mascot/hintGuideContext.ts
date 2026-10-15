import type { HintSceneContext } from "../../../mascot-library/versions/v3.2/src/index";

export function askGuideContext({ messageCount, thinking, lastRole, error, typing = false, keyboardOpen = false }: {
  messageCount: number; thinking: boolean; lastRole?: string; error?: string | null; typing?: boolean; keyboardOpen?: boolean;
}): HintSceneContext {
  return {
    room: "ask",
    phase: thinking ? "thinking" : error ? "error" : lastRole === "assistant" ? "reading" : messageCount || typing ? "waiting" : "idle",
    hasMessages: messageCount > 0,
    keyboardOpen,
    typing,
    audioPlaying: false,
  };
}

export function voiceGuideContext(phase: HintSceneContext["phase"], playbackStatus: string): HintSceneContext {
  return {
    room: "voice",
    phase: phase === "speaking" && playbackStatus !== "playing" ? "preparing" : phase,
    audioPlaying: phase === "speaking" && playbackStatus === "playing",
    hasMessages: true,
    keyboardOpen: false,
    typing: false,
  };
}
