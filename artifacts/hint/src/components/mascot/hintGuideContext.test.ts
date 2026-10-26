import { describe, expect, it } from "vitest";
import { askGuideContext, voiceGuideContext, dailyGuideContext } from "./hintGuideContext";

describe("guide context", () => {
  it("tracks real Ask response playback and yields to a new request", () => {
    const response = { messageCount: 2, thinking: false, lastRole: "assistant" };
    expect(askGuideContext({ ...response, playbackStatus: "loading" })).toMatchObject({ phase: "preparing", audioPlaying: false });
    expect(askGuideContext({ ...response, playbackStatus: "playing" })).toMatchObject({ phase: "speaking", audioPlaying: true });
    expect(askGuideContext({ ...response, playbackStatus: "error" })).toMatchObject({ phase: "error", audioPlaying: false });
    expect(askGuideContext({ ...response, playbackStatus: "idle" })).toMatchObject({ phase: "reading", audioPlaying: false });
    expect(askGuideContext({ ...response, playbackStatus: "playing", thinking: true })).toMatchObject({ phase: "thinking", audioPlaying: false });
  });
  it("distinguishes loading a saved daily receipt from an actual reveal", () => {
    expect(dailyGuideContext({ ready: false, revealed: false })).toMatchObject({ phase: "waiting", revealing: false });
    expect(dailyGuideContext({ ready: true, revealed: true })).toMatchObject({ phase: "reading", revealing: false });
    expect(dailyGuideContext({ ready: true, revealed: true, opening: true })).toMatchObject({ phase: "waiting", revealing: true });
    expect(dailyGuideContext({ ready: true, revealed: true, error: true })).toMatchObject({ phase: "error", audioPlaying: false });
  });
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
    expect(askGuideContext({ ...conversation, typing: true, keyboardOpen: true })).toMatchObject({ phase: "waiting", typing: true });
    expect(askGuideContext({ messageCount: 0, thinking: false, typing: true, keyboardOpen: true }))
      .toMatchObject({ phase: "waiting", hasMessages: false, keyboardOpen: true });
  });
});
