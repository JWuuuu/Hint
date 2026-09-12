/** @vitest-environment jsdom */
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const transport = vi.hoisted(() => ({ fetch: vi.fn() }));
vi.mock("../../../../lib/api", () => ({ apiFetch: transport.fetch, apiUrl: (path: string) => path }));
vi.mock("../../../../lib/i18n", () => ({ useLanguage: () => ({ t: (key: string) => key }) }));
import { SpeechButton } from "./SpeechButton";

const audioInstances: Array<{ play: ReturnType<typeof vi.fn>; pause: ReturnType<typeof vi.fn>; onended: (() => void) | null; onerror: (() => void) | null }> = [];
let createUrl: ReturnType<typeof vi.fn>;
let revokeUrl: ReturnType<typeof vi.fn>;
let playbackStart: Promise<void>;
beforeEach(() => {
  transport.fetch.mockReset(); audioInstances.length = 0;
  playbackStart = Promise.resolve();
  createUrl = vi.fn(() => "blob:speech-fixture"); revokeUrl = vi.fn();
  vi.stubGlobal("Audio", class {
    play = vi.fn(() => playbackStart); pause = vi.fn(); onended = null; onerror = null;
    constructor() { audioInstances.push(this); }
  });
  vi.stubGlobal("URL", class extends URL { static createObjectURL = createUrl; static revokeObjectURL = revokeUrl; });
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe("speech request lifecycle", () => {
  it("prevents double requests, offers a retry after failure, and releases playback on stop", async () => {
    let reject!: (error: Error) => void;
    transport.fetch.mockImplementationOnce(() => new Promise((_resolve, rejectRequest) => { reject = rejectRequest; }));
    render(<SpeechButton text="Fictional reading" />);
    const play = screen.getByRole("button", { name: "reading.speech.play" });
    fireEvent.click(play); fireEvent.click(play);
    expect(transport.fetch).toHaveBeenCalledTimes(1);
    await act(async () => reject(new Error("offline")));
    transport.fetch.mockResolvedValueOnce({ ok: true, blob: async () => new Blob(["fixture"]) });
    fireEvent.click(screen.getByRole("button", { name: "reading.speech.retry" }));
    const stop = await screen.findByRole("button", { name: "reading.speech.stop" });
    fireEvent.click(stop);
    expect(audioInstances[0].pause).toHaveBeenCalled();
    expect(revokeUrl).toHaveBeenCalledWith("blob:speech-fixture");
    expect(screen.getByRole("button", { name: "reading.speech.play" })).toBeTruthy();
  });

  it("aborts a previous reading and ignores its late audio without replacing the current player", async () => {
    let finishOld!: (value: unknown) => void;
    transport.fetch.mockImplementationOnce(() => new Promise(resolve => { finishOld = resolve; }));
    const view = render(<SpeechButton text="First reading" />);
    fireEvent.click(screen.getByRole("button"));
    const oldSignal = transport.fetch.mock.calls[0][1].signal as AbortSignal;
    view.rerender(<SpeechButton text="Second reading" />);
    expect(oldSignal.aborted).toBe(true);
    transport.fetch.mockResolvedValueOnce({ ok: true, blob: async () => new Blob(["current"]) });
    fireEvent.click(screen.getByRole("button"));
    await screen.findByRole("button", { name: "reading.speech.stop" });
    await act(async () => finishOld({ ok: true, blob: async () => new Blob(["stale"]) }));
    expect(createUrl).toHaveBeenCalledTimes(1);
    expect(audioInstances).toHaveLength(1);
    expect(screen.getByRole("button", { name: "reading.speech.stop" })).toBeTruthy();
  });

  it("cancels and releases audio when the component leaves while playback is starting", async () => {
    let finishPlayback!: () => void;
    playbackStart = new Promise(resolve => { finishPlayback = resolve; });
    transport.fetch.mockResolvedValueOnce({ ok: true, blob: async () => new Blob(["fixture"]) });
    const view = render(<SpeechButton text="Reading" />);
    fireEvent.click(screen.getByRole("button"));
    await waitFor(() => expect(audioInstances).toHaveLength(1));
    view.unmount();
    expect((transport.fetch.mock.calls[0][1].signal as AbortSignal).aborted).toBe(true);
    expect(audioInstances[0].pause).toHaveBeenCalled();
    expect(audioInstances[0].onended).toBeNull();
    expect(revokeUrl).toHaveBeenCalled();
    await act(async () => finishPlayback());
  });
});
