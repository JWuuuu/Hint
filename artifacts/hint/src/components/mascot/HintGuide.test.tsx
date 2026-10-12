// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { HintGuideProvider, HintGuideSlot } from "./HintGuide";
import { askGuideContext, voiceGuideContext } from "./hintGuideContext";

const state = vi.hoisted(() => ({
  policy: { reduced: false, pageVisible: true },
  player: { setContext: vi.fn(), setAnchor: vi.fn(), setMotionPolicy: vi.fn(), react: vi.fn(), destroy: vi.fn() },
  createPlayer: vi.fn(),
}));
vi.mock("../../lib/motionPolicy", () => ({ useMotionPolicy: () => state.policy }));
vi.mock("../../../mascot-library/versions/v3.2/src/index", () => ({ createHintScenePlayer: state.createPlayer }));
vi.mock("../../../mascot-library/versions/v3.2/preview/hint-assets.js", () => ({ assets: { images: { "empty-rest": "data:image/png;base64," } } }));

beforeEach(() => {
  state.policy = { reduced: false, pageVisible: true };
  vi.clearAllMocks();state.createPlayer.mockResolvedValue(state.player);
  vi.stubGlobal("ResizeObserver", class { observe() {} unobserve() {} disconnect() {} });
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function (this: HTMLElement) {
    return this.hasAttribute("data-hint-guide-slot")
      ? { x: 20, y: 40, left: 20, top: 40, right: 180, bottom: 200, width: 160, height: 160, toJSON() {} }
      : { x: 0, y: 0, left: 0, top: 0, right: 1024, bottom: 768, width: 1024, height: 768, toJSON() {} };
  });
});
afterEach(() => { cleanup();vi.restoreAllMocks();vi.unstubAllGlobals();window.history.replaceState({}, "", "/"); });

function Scene({ voice = false, active = true, enabled = true }: { voice?: boolean; active?: boolean; enabled?: boolean }) {
  return <HintGuideProvider enabled={enabled}>
    {active && <HintGuideSlot context={askGuideContext({ messageCount: 1, thinking: true })} fallback={<span>Original invitation</span>} />}
    {voice && <HintGuideSlot priority={100} context={voiceGuideContext("listening", "idle")} />}
  </HintGuideProvider>;
}

it("keeps the original invitation and avoids loading assets when disabled", async () => {
  const view = render(<Scene enabled={false} />);
  expect(view.getByText("Original invitation")).toBeTruthy();
  expect(view.container.querySelector("canvas")).toBeNull();
  await act(async () => {});
  expect(state.createPlayer).not.toHaveBeenCalled();
});

it("keeps one player through voice priority, return, exit, and native suspension", async () => {
  const view = render(<Scene />);
  await waitFor(() => expect(state.createPlayer).toHaveBeenCalledTimes(1));
  await waitFor(() => expect(state.player.setContext).toHaveBeenLastCalledWith(expect.objectContaining({ room: "ask", phase: "thinking", hasMessages: true })));
  const canvas = view.container.querySelector("canvas");
  view.rerender(<Scene voice />);
  expect(state.player.setContext).toHaveBeenLastCalledWith(expect.objectContaining({ room: "voice", phase: "listening" }));
  expect(view.container.querySelector("canvas")).toBe(canvas);
  expect(view.getByTestId("hint-guide-layer").style.zIndex).toBe("100");
  fireEvent.click(view.getAllByRole("button", { name: "Hint" }).at(-1)!);
  expect(state.player.react).toHaveBeenCalledTimes(1);
  state.policy = { reduced: true, pageVisible: false };view.rerender(<Scene voice />);
  expect(state.player.setMotionPolicy).toHaveBeenLastCalledWith({ reduced: true, visible: false });
  state.policy = { reduced: false, pageVisible: true };view.rerender(<Scene />);
  expect(state.player.setContext).toHaveBeenLastCalledWith(expect.objectContaining({ room: "ask", phase: "thinking", hasMessages: true }));
  view.rerender(<Scene active={false} />);
  expect(state.player.setContext).toHaveBeenLastCalledWith({ room: "away", phase: "idle", audioPlaying: false });
  expect(state.createPlayer).toHaveBeenCalledTimes(1);
  view.unmount();expect(state.player.destroy).toHaveBeenCalledTimes(1);
});

it("cleans up a player that finishes loading after its screen is unmounted", async () => {
  let finish!: (player: typeof state.player) => void;
  state.createPlayer.mockImplementation(() => new Promise(resolve => { finish = resolve; }));
  const view = render(<Scene />);
  await waitFor(() => expect(state.createPlayer).toHaveBeenCalledTimes(1));
  view.unmount();await act(async () => { finish(state.player); });
  expect(state.player.destroy).toHaveBeenCalledTimes(1);
  expect(state.player.setContext).not.toHaveBeenCalled();
});

it("returns to the existing UI if the player cannot load", async () => {
  state.createPlayer.mockRejectedValue(new Error("Asset unavailable"));
  const view = render(<Scene />);
  await waitFor(() => expect(view.getByText("Original invitation")).toBeTruthy());
  expect(view.container.querySelector("canvas")).toBeNull();
});

it("keeps an opted-in preview enabled when navigation removes the query string", async () => {
  window.history.replaceState({}, "", "/app/ask?hintGuide=v3.2");
  const content = <HintGuideSlot context={askGuideContext({ messageCount: 0, thinking: false })} />;
  const view = render(<HintGuideProvider>{content}</HintGuideProvider>);
  await waitFor(() => expect(state.createPlayer).toHaveBeenCalledTimes(1));
  window.history.replaceState({}, "", "/app/ask");
  view.rerender(<HintGuideProvider>{content}</HintGuideProvider>);
  expect(view.container.querySelector("canvas")).toBeTruthy();
  expect(state.player.destroy).not.toHaveBeenCalled();
});
