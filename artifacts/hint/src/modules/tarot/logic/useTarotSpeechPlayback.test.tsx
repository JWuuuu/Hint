/** @vitest-environment jsdom */
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
const transport = vi.hoisted(() => ({ fetch: vi.fn() }));
vi.mock("../../../lib/api", () => ({ apiFetch: transport.fetch, apiUrl: (path: string) => path }));
vi.mock("../../../lib/mobile/appLifecycle", () => ({ addNativeAppStateListener: async () => async () => undefined }));
import { splitSpokenReading, useTarotSpeechPlayback } from "./useTarotSpeechPlayback";
const players: Array<{ play: ReturnType<typeof vi.fn>; pause: ReturnType<typeof vi.fn>; onended: (() => void) | null; onerror: (() => void) | null }> = [];
beforeEach(() => {
  players.length = 0; transport.fetch.mockReset();
  transport.fetch.mockResolvedValue({ ok: true, blob: async () => new Blob(["speech"]) });
  vi.stubGlobal("Audio", class { play = vi.fn(async () => undefined); pause = vi.fn(); onended = null; onerror = null; constructor() { players.push(this); } });
  vi.stubGlobal("URL", class extends URL { static createObjectURL = vi.fn(() => "blob:reading"); static revokeObjectURL = vi.fn(); });
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
it("keeps long readings in ordered chunks, including text without spaces", () => {
  for (const text of ["a".repeat(8200), "A complete sentence. ".repeat(500)]) {
    const chunks = splitSpokenReading(text);
    expect(chunks.every(chunk => chunk.length > 0 && chunk.length <= 3900)).toBe(true);
    expect(chunks.join("").replace(/\s/g, "")).toBe(text.replace(/\s/g, ""));
    expect(chunks.length).toBeLessThan(5);
  }
});
it("plays each chunk in order and releases audio on completion", async () => {
  const { result } = renderHook(useTarotSpeechPlayback);
  let playback!: Promise<boolean>;
  act(() => { playback = result.current.play("a".repeat(4000), "reading"); });
  await waitFor(() => expect(players).toHaveLength(1));
  expect(transport.fetch).toHaveBeenCalledTimes(1);
  await act(async () => players[0].onended?.());
  await waitFor(() => expect(players).toHaveLength(2));
  await act(async () => { players[1].onended?.(); await playback; });
  expect(result.current.status).toBe("idle");
  expect(URL.revokeObjectURL).toHaveBeenCalledTimes(2);
});
it("stops playback and never starts another chunk after cancellation", async () => {
  const { result } = renderHook(useTarotSpeechPlayback);
  let playback!: Promise<boolean>;
  act(() => { playback = result.current.play("a".repeat(4000), "reading"); });
  await waitFor(() => expect(result.current.status).toBe("playing"));
  await act(async () => { result.current.stop(); await playback; });
  expect(players[0].pause).toHaveBeenCalled();
  expect(transport.fetch).toHaveBeenCalledTimes(1);
  expect(result.current.status).toBe("idle");
});
it("ignores a late speech response after unmount", async () => {
  let finish!: (response: unknown) => void;
  transport.fetch.mockReturnValue(new Promise(resolve => { finish = resolve; }));
  const { result, unmount } = renderHook(useTarotSpeechPlayback);
  let playback!: Promise<boolean>;
  act(() => { playback = result.current.play("A reading", "reading"); });
  unmount();
  await act(async () => { finish({ ok: true, blob: async () => new Blob(["late"]) }); await playback; });
  expect(players).toHaveLength(0);
  expect(transport.fetch.mock.calls[0][1].signal.aborted).toBe(true);
});
