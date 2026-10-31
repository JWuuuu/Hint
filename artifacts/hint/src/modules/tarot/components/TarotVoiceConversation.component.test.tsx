/** @vitest-environment jsdom */
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { HintSpeechOptions } from "../../../lib/speechRecognition";
const recognition = vi.hoisted(() => ({ start: vi.fn() }));
vi.mock("../../../lib/speechRecognition", () => ({ startHintSpeechRecognition: recognition.start }));
vi.mock("../../../lib/mobile/appLifecycle", () => ({ addNativeAppStateListener: async () => async () => undefined }));
vi.mock("../../../lib/i18n", async importOriginal => ({ ...await importOriginal<typeof import("../../../lib/i18n")>(), useLanguage: () => ({ language: "en", t: (key: string) => key }) }));
vi.mock("../logic/useTarotReducedMotion", () => ({ useTarotReducedMotion: () => true }));
import { TarotVoiceConversation } from "./TarotVoiceConversation";
let callbacks: HintSpeechOptions[];
let cancel: ReturnType<typeof vi.fn>;
const playback = () => ({ id: null, status: "idle" as const, play: vi.fn(async (_text: string, _id: string) => true), stop: vi.fn() });
beforeEach(() => {
  Element.prototype.scrollTo = vi.fn();
  callbacks = []; cancel = vi.fn(async () => undefined);
  recognition.start.mockReset().mockImplementation(async (options: HintSpeechOptions) => {
    callbacks.push(options); options.onStart?.(); return { stop: vi.fn(async () => undefined), cancel };
  });
});
afterEach(() => { cleanup(); vi.useRealTimers(); });
it("sends one transcript, speaks its reply, then listens for the next turn", async () => {
  const voice = playback(); const send = vi.fn(async () => "Take one small step.");
  render(<TarotVoiceConversation onSend={send} onClose={vi.fn()} playback={voice} busy={false} />);
  expect(callbacks[0].language).toBe("en-US");
  expect(callbacks[0].continuous).toBe(false);
  await act(async () => { callbacks[0].onTranscript("What should I do?"); callbacks[0].onEnd(); callbacks[0].onEnd(); });
  await waitFor(() => expect(callbacks).toHaveLength(2));
  expect(send).toHaveBeenCalledExactlyOnceWith("What should I do?");
  expect(voice.play).toHaveBeenCalledWith("Take one small step.", "voice-conversation");
});
it("does not send denied microphone input or keep listening", async () => {
  const send = vi.fn();
  render(<TarotVoiceConversation onSend={send} onClose={vi.fn()} playback={playback()} busy={false} />);
  act(() => { callbacks[0].onError("permission"); callbacks[0].onTranscript("late words"); callbacks[0].onEnd(); });
  expect(screen.getByRole("alert").textContent).toBe("tarot.voice.permission");
  expect(send).not.toHaveBeenCalled();
  expect(callbacks[0].signal?.aborted).toBe(true);
});
it("pauses without sending a partial recording and ignores late transcripts", async () => {
  const send = vi.fn();
  render(<TarotVoiceConversation onSend={send} onClose={vi.fn()} playback={playback()} busy={false} />);
  act(() => callbacks[0].onTranscript("A partial question"));
  fireEvent.click(screen.getByRole("button", { name: "tarot.chatVoice.pause" }));
  act(() => { callbacks[0].onTranscript("late words"); callbacks[0].onEnd(); });
  expect(send).not.toHaveBeenCalled();
  expect(screen.getByRole("button", { name: "tarot.chatVoice.resume" })).toBeTruthy();
});
it("does not play or reopen the microphone when a reply arrives after closing", async () => {
  let finish!: (text: string) => void;
  const voice = playback();
  const send = vi.fn(() => new Promise<string>(resolve => { finish = resolve; }));
  const view = render(<TarotVoiceConversation onSend={send} onClose={vi.fn()} playback={voice} busy={false} />);
  act(() => { callbacks[0].onTranscript("My question"); callbacks[0].onEnd(); });
  view.unmount();
  await act(async () => finish("A late reply"));
  expect(voice.play).not.toHaveBeenCalled();
  expect(callbacks).toHaveLength(1);
  expect(voice.stop).toHaveBeenCalled();
});
it("shows a saved text reply if playback fails and waits for an explicit retry", async () => {
  const voice = playback(); voice.play.mockResolvedValue(false);
  render(<TarotVoiceConversation onSend={async () => "Your answer stays here."} onClose={vi.fn()} playback={voice} busy={false} />);
  await act(async () => { callbacks[0].onTranscript("My question"); callbacks[0].onEnd(); });
  expect(screen.getByText("Your answer stays here.")).toBeTruthy();
  expect(screen.getByRole("alert").textContent).toBe("tarot.chatVoice.playbackError");
  expect(callbacks).toHaveLength(1);
});

it("retries failed audio without sending the question again", async () => {
  const voice = playback(); voice.play.mockResolvedValueOnce(false).mockResolvedValueOnce(true);
  const send = vi.fn(async () => "An answer to replay.");
  render(<TarotVoiceConversation onSend={send} onClose={vi.fn()} playback={voice} busy={false} />);
  await act(async () => { callbacks[0].onTranscript("My question"); callbacks[0].onEnd(); });
  expect(callbacks).toHaveLength(1);
  fireEvent.click(screen.getByRole("button", { name: "tarot.chatVoice.retryReading" }));
  await waitFor(() => expect(callbacks).toHaveLength(2));
  expect(send).toHaveBeenCalledOnce();
  expect(voice.play).toHaveBeenCalledTimes(2);
  expect(voice.play.mock.calls.map(call => call[0])).toEqual(["An answer to replay.", "An answer to replay."]);
});

it("lets the user show and hide the transcript without stopping listening", async () => {
  render(<TarotVoiceConversation onSend={vi.fn()} onClose={vi.fn()} playback={playback()} busy={false} />);
  act(() => callbacks[0].onTranscript("Can you hear me?"));
  expect(screen.queryByRole("region", { name: "tarot.chatVoice.transcript" })).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "tarot.chatVoice.showTranscript" }));
  expect(screen.getByRole("region").textContent).toContain("Can you hear me?");
  expect(screen.getByRole("button", { name: "tarot.chatVoice.hideTranscript" }).getAttribute("aria-pressed")).toBe("true");
  fireEvent.click(screen.getByRole("button", { name: "tarot.chatVoice.hideTranscript" }));
  expect(screen.queryByRole("region")).toBeNull();
  expect(callbacks).toHaveLength(1);
  expect(callbacks[0].signal?.aborted).toBe(false);
});

it("shows connecting, listening, thinking, audio preparation, speaking, and paused states accurately", async () => {
  recognition.start.mockImplementation(async (options: HintSpeechOptions) => {
    callbacks.push(options); return { stop: vi.fn(async () => undefined), cancel };
  });
  let finish!: (answer: string) => void;
  const voice = playback(); voice.play.mockReturnValue(new Promise(() => undefined));
  const send = vi.fn(() => new Promise<string>(resolve => { finish = resolve; }));
  const view = render(<TarotVoiceConversation onSend={send} onClose={vi.fn()} playback={voice} busy={false} />);
  const phase = () => screen.getByTestId("tarot-voice-orb").getAttribute("data-phase");
  expect(phase()).toBe("starting");
  act(() => callbacks[0].onStart?.());
  expect(phase()).toBe("listening");
  expect(screen.getByRole("status").textContent).toBe("tarot.chatVoice.listening");
  act(() => { callbacks[0].onTranscript("My question"); callbacks[0].onEnd(); });
  expect(phase()).toBe("thinking");
  await act(async () => finish("Your answer"));
  expect(phase()).toBe("preparing");
  view.rerender(<TarotVoiceConversation onSend={send} onClose={vi.fn()} playback={{ ...voice, status: "playing" }} busy={false} />);
  expect(phase()).toBe("speaking");
  fireEvent.click(screen.getByRole("button", { name: "tarot.chatVoice.pause" }));
  expect(phase()).toBe("paused");
  expect(screen.getByRole("button", { name: "tarot.chatVoice.resume" })).toBeTruthy();
  expect(voice.stop).toHaveBeenCalled();
});

it("automatically sends after speech settles and keeps prior turns in the optional transcript", async () => {
  vi.useFakeTimers();
  const send = vi.fn(async () => "Take your time.");
  render(<TarotVoiceConversation onSend={send} onClose={vi.fn()} playback={playback()} busy={false} />);
  await act(async () => {
    callbacks[0].onTranscript("One question");
    await vi.advanceTimersByTimeAsync(1200);
  });
  expect(send).toHaveBeenCalledExactlyOnceWith("One question");
  expect(callbacks).toHaveLength(2);
  fireEvent.click(screen.getByRole("button", { name: "tarot.chatVoice.showTranscript" }));
  expect(screen.getByRole("region").textContent).toContain("One question");
  expect(screen.getByRole("region").textContent).toContain("Take your time.");
  expect(screen.getByTestId("tarot-voice-orb").getAttribute("data-reduced-motion")).toBe("true");
});
