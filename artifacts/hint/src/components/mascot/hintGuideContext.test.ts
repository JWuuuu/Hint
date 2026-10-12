import { describe, expect, it } from "vitest";
import { askGuideContext, voiceGuideContext } from "./hintGuideContext";

describe("guide context", () => {
  it("only starts speaking after playback has started", () => {
    for (const status of ["idle", "loading", "paused", "error", "unavailable"]) {
      expect(voiceGuideContext("speaking", status)).toMatchObject({ phase: "preparing", audioPlaying: false });
    }
    expect(voiceGuideContext("speaking", "playing")).toMatchObject({ phase: "speaking", audioPlaying: true });
    expect(voiceGuideContext("listening", "playing")).toMatchObject({ phase: "listening", audioPlaying: false });
    expect(voiceGuideContext("paused", "paused")).toMatchObject({ phase: "paused", audioPlaying: false });
  });

  it("uses the current request state before an earlier response", () => {
    const conversation = { messageCount: 3, lastRole: "assistant", thinking: false };
    expect(askGuideContext(conversation)).toMatchObject({ phase: "reading", hasMessages: true, audioPlaying: false });
    expect(askGuideContext({ ...conversation, thinking: true })).toMatchObject({ phase: "thinking" });
    expect(askGuideContext({ ...conversation, error: "Offline" })).toMatchObject({ phase: "error" });
    expect(askGuideContext({ messageCount: 0, thinking: false, typing: true, keyboardOpen: true }))
      .toMatchObject({ phase: "waiting", hasMessages: false, keyboardOpen: true });
  });
});
