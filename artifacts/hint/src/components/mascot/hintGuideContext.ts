import type { HintSceneContext } from "../../../mascot-library/versions/v3.2/src/index";

export function askGuideContext({ messageCount, thinking, lastRole, error, typing = false, keyboardOpen = false, playbackStatus = "idle" }: {
  messageCount: number; thinking: boolean; lastRole?: string; error?: string | null; typing?: boolean; keyboardOpen?: boolean; playbackStatus?: string;
}): HintSceneContext {
  const speaking = playbackStatus === "playing" && !thinking && !error;
  return {
    room: "ask",
    phase: thinking ? "thinking" : error || playbackStatus === "error" ? "error" : speaking ? "speaking"
      : playbackStatus === "loading" ? "preparing" : typing ? "waiting" : lastRole === "assistant" ? "reading" : messageCount ? "waiting" : "idle",
    hasMessages: messageCount > 0,
    keyboardOpen,
    typing,
    audioPlaying: speaking,
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

export function dailyGuideContext({ ready, revealed, opening = false, error = false, resting = false }: {
  ready: boolean; revealed: boolean; opening?: boolean; error?: boolean; resting?: boolean;
}): HintSceneContext {
  return {
    room: "home",
    resting,
    revealing: opening,
    phase: error ? "error" : !ready || opening ? "waiting" : revealed ? "reading" : "idle",
    hasMessages: revealed,
    keyboardOpen: false,
    typing: false,
    audioPlaying: false,
  };
}
