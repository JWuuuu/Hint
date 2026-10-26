// @vitest-environment jsdom
import type { ReactNode } from "react";
import { act, cleanup, fireEvent, render, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { HintGuideProvider, HintGuideSlot, useHintGuideGesture, useHintGuidePlayback } from "./HintGuide";
import { askGuideContext, voiceGuideContext } from "./hintGuideContext";

const state = vi.hoisted(() => ({
  policy: { reduced: false, pageVisible: true },
  player: { setContext: vi.fn(), setAnchor: vi.fn(), setDelivery: vi.fn(), setMotionPolicy: vi.fn(), react: vi.fn(), playGesture: vi.fn(), destroy: vi.fn(), pause: vi.fn(), resume: vi.fn(), setSpeed: vi.fn() },
  createPlayer: vi.fn(),
}));
vi.mock("../../lib/motionPolicy", () => ({ useMotionPolicy: () => state.policy }));
vi.mock("../../../mascot-library/versions/v3.2/src/index", () => ({ createHintScenePlayer: state.createPlayer }));
vi.mock("../../../mascot-library/versions/v3.2/preview/hint-assets.js", () => ({ assets: { images: { "empty-rest": "data:image/png;base64," } } }));

beforeEach(() => {
  state.policy = { reduced: false, pageVisible: true };
  vi.clearAllMocks();state.createPlayer.mockResolvedValue(state.player);
  state.player.pause.mockReset();state.player.resume.mockReset();
  vi.stubGlobal("ResizeObserver", class { observe() {} unobserve() {} disconnect() {} });
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function (this: HTMLElement) {
    return this.hasAttribute("data-hint-guide-slot")
      ? { x: 20, y: 40, left: 20, top: 40, right: 180, bottom: 200, width: 160, height: 160, toJSON() {} }
      : { x: 0, y: 0, left: 0, top: 0, right: 1024, bottom: 768, width: 1024, height: 768, toJSON() {} };
  });
});
afterEach(() => { cleanup();vi.restoreAllMocks();vi.unstubAllGlobals();vi.unstubAllEnvs();window.history.replaceState({}, "", "/"); });

it("gives explicit app feedback priority over a decorative gesture", async () => {
  function SavedCard() {
    const playGesture = useHintGuideGesture();
    return <button onClick={() => playGesture?.("celebration")}>Save card</button>;
  }
  const view = render(<HintGuideProvider enabled><HintGuideSlot context={askGuideContext({ messageCount: 0, thinking: false })} /><SavedCard /></HintGuideProvider>);
  await waitFor(() => expect(state.player.setContext).toHaveBeenCalled());
  fireEvent.click(view.getByRole("button", { name: "Save card" }));
  expect(state.player.playGesture).toHaveBeenCalledWith("celebration", { interrupt: true });
});

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
  await act(async () => view.rerender(<Scene voice />));
  expect(state.player.setContext).toHaveBeenLastCalledWith(expect.objectContaining({ room: "voice", phase: "listening" }));
  expect(view.container.querySelector("canvas")).toBe(canvas);
  expect(view.getByTestId("hint-guide-layer").style.zIndex).toBe("100");
  fireEvent.click(view.getAllByRole("button", { name: "Hint" }).at(-1)!);
  expect(state.player.react).toHaveBeenCalledTimes(1);
  state.policy = { reduced: true, pageVisible: false };view.rerender(<Scene voice />);
  expect(state.player.setMotionPolicy).toHaveBeenLastCalledWith({ reduced: true, visible: false });
  state.policy = { reduced: false, pageVisible: true };await act(async () => view.rerender(<Scene />));
  expect(state.player.setContext).toHaveBeenLastCalledWith(expect.objectContaining({ room: "ask", phase: "thinking", hasMessages: true }));
  await act(async () => view.rerender(<Scene active={false} />));
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

it("loads the production guide by default and keeps it through navigation", async () => {
  vi.stubEnv("VITE_HINT_GUIDE_V32", undefined);vi.stubEnv("DEV", false);
  window.history.replaceState({}, "", "/app/ask");
  const content = <HintGuideSlot context={askGuideContext({ messageCount: 0, thinking: false })} />;
  const view = render(<HintGuideProvider>{content}</HintGuideProvider>);
  await waitFor(() => expect(state.createPlayer).toHaveBeenCalledTimes(1));
  window.history.replaceState({}, "", "/app");
  view.rerender(<HintGuideProvider>{content}</HintGuideProvider>);
  expect(view.container.querySelector("canvas")).toBeTruthy();
  expect(state.player.destroy).not.toHaveBeenCalled();
});

it("honors the build opt-out even when a legacy preview query is present", async () => {
  vi.stubEnv("VITE_HINT_GUIDE_V32", "0");
  window.history.replaceState({}, "", "/app/ask?hintGuide=v3.2");
  const view = render(<HintGuideProvider><HintGuideSlot context={askGuideContext({ messageCount: 0, thinking: false })} fallback={<span>Original invitation</span>} /></HintGuideProvider>);
  expect(view.getByText("Original invitation")).toBeTruthy();
  await act(async () => {});
  expect(state.createPlayer).not.toHaveBeenCalled();
});

it("measures the real delivery target and removes it when the overlay closes", async () => {
  const target = document.createElement("div");document.body.append(target);
  const delivery = { key: "today:moon", cardBack: "/actual-back.png", done: false, target: { current: target } };
  const context = { ...askGuideContext({ messageCount: 0, thinking: false }), room: "home" as const };
  const view = render(<HintGuideProvider enabled><HintGuideSlot context={context} delivery={delivery} /></HintGuideProvider>);
  await waitFor(() => expect(state.player.setDelivery).toHaveBeenCalledWith(expect.objectContaining({ key: "today:moon", cardBack: "/actual-back.png", done: false, card: { x: 0, y: 0, width: 1, height: 1 } })));
  await act(async () => view.rerender(<HintGuideProvider enabled><HintGuideSlot context={context} delivery={{ ...delivery, done: true }} /></HintGuideProvider>));
  expect(state.player.setDelivery).toHaveBeenLastCalledWith(expect.objectContaining({ done: true }));
  await act(async () => view.rerender(<HintGuideProvider enabled><HintGuideSlot context={context} /></HintGuideProvider>));
  expect(state.player.setDelivery).toHaveBeenLastCalledWith(null);target.remove();
});

it("finishes an open delivery when its header scrolls away but still pauses with the app", async () => {
  const target = document.createElement("div");document.body.append(target);
  vi.mocked(HTMLElement.prototype.getBoundingClientRect).mockImplementation(function (this: HTMLElement) {
    if (this.hasAttribute("data-hint-guide-slot")) return { x: 150, y: -100, left: 150, top: -100, right: 222, bottom: -28, width: 72, height: 72, toJSON() {} };
    if (this === target) return { x: 116, y: 20, left: 116, top: 20, right: 258, bottom: 248, width: 142, height: 228, toJSON() {} };
    return { x: 0, y: 0, left: 0, top: 0, right: 375, bottom: 667, width: 375, height: 667, toJSON() {} };
  });
  const delivery = { key: "today:moon", cardBack: "/actual-back.png", done: false, target: { current: target } };
  const context = { ...askGuideContext({ messageCount: 0, thinking: false }), room: "home" as const };
  const content = (done = false) => <HintGuideProvider enabled><HintGuideSlot context={context} delivery={{ ...delivery, done }} /></HintGuideProvider>;
  const view = render(content());
  await waitFor(() => expect(state.player.setDelivery).toHaveBeenCalledWith(expect.objectContaining({ done: false })));
  expect(state.player.setMotionPolicy).toHaveBeenLastCalledWith({ reduced: false, visible: true });
  state.policy = { reduced: false, pageVisible: false };view.rerender(content());
  expect(state.player.setMotionPolicy).toHaveBeenLastCalledWith({ reduced: false, visible: false });
  state.policy = { reduced: false, pageVisible: true };view.rerender(content());
  expect(state.player.setMotionPolicy).toHaveBeenLastCalledWith({ reduced: false, visible: true });
  await act(async () => view.rerender(content(true)));
  expect(state.player.setMotionPolicy).toHaveBeenLastCalledWith({ reduced: false, visible: false });
  target.remove();
});

it("shares an inspection pause with the card and really resumes when Continue clears the hold", async () => {
  vi.stubEnv("DEV", true);
  const onPauseChange = vi.fn();
  function Playback() {
    const { paused, speed } = useHintGuidePlayback();
    return <output aria-label="Review state">{paused ? "paused" : "playing"}:{speed}</output>;
  }
  const content = (holdAt: number | undefined, paused = false) => <HintGuideProvider enabled review={{ speed: 0.5, holdAt, paused, onPauseChange }}>
    <HintGuideSlot context={askGuideContext({ messageCount: 0, thinking: false })} /><Playback />
  </HintGuideProvider>;
  const view = render(content(2.1));
  await waitFor(() => expect(state.createPlayer).toHaveBeenCalledTimes(1));
  expect(state.player.setSpeed).toHaveBeenCalledWith(0.5);
  const onFrame = state.createPlayer.mock.calls[0][1].onFrame;
  const frame = { actor: { x: 0, y: 0, width: 0.2, height: 0.2 },
    state: { placement: "dock", context: { phase: "idle" }, paused: false, clock: 2.2 },
    shadow: { x: 0, y: 0, width: 0.2, opacity: 1 }, letter: "holding",
    delivery: { key: "today:moon", phase: "offering", time: 2.2, handoff: 0 } };
  // A real pause synchronously draws another frame. That redraw must not
  // re-arm the breakpoint or issue a second controlled pause notification.
  state.player.pause.mockImplementation(() => onFrame(frame));
  await act(async () => { onFrame(frame); });
  expect(onPauseChange).toHaveBeenCalledExactlyOnceWith(true);
  expect(view.getByLabelText("Review state").textContent).toBe("paused:0.5");
  view.rerender(content(2.1, true));
  await act(async () => {});
  expect(onPauseChange).toHaveBeenCalledTimes(1);
  state.player.resume.mockClear();view.rerender(content(undefined, false));
  expect(state.player.resume).toHaveBeenCalledTimes(1);
  expect(view.getByLabelText("Review state").textContent).toBe("playing:0.5");
  await act(async () => { onFrame(frame); });
  expect(onPauseChange).toHaveBeenCalledTimes(1);
  expect(state.createPlayer).toHaveBeenCalledTimes(1);
});

it("replaces a keyboard slot without an intermediate departure or cancelled delivery", async () => {
  const target = document.createElement("div");document.body.append(target);
  const context = { ...askGuideContext({ messageCount: 1, thinking: true }), room: "home" as const };
  const delivery = { key: "today:moon", cardBack: "/back.png", done: false, target: { current: target } };
  const content = (compact: boolean) => <HintGuideProvider enabled>
    {compact ? <HintGuideSlot key="compact" context={context} delivery={delivery} className="h-24 w-24" />
      : <HintGuideSlot key="large" context={context} delivery={delivery} className="h-60 w-60" />}
  </HintGuideProvider>;
  const view = render(content(false));
  await waitFor(() => expect(state.player.setDelivery).toHaveBeenCalled());
  state.player.setContext.mockClear();state.player.setDelivery.mockClear();
  await act(async () => view.rerender(content(true)));
  expect(state.player.setContext).toHaveBeenCalledTimes(1);
  expect(state.player.setContext).toHaveBeenCalledWith(context);
  expect(state.player.setDelivery).not.toHaveBeenCalledWith(null);
  expect(state.player.setDelivery).toHaveBeenCalledWith(expect.objectContaining({ key: "today:moon", done: false }));
  expect(state.createPlayer).toHaveBeenCalledTimes(1);target.remove();
});

type Box = { left: number; top: number; width: number; height: number };
const rect = ({ left, top, width, height }: Box) => ({ x: left, y: top, left, top, width, height, right: left + width, bottom: top + height, toJSON() {} });
/** A 375x667 phone stage whose scroll body sits between a fixed header and footer. */
function phone(slot: () => Box, extra: (element: HTMLElement) => Box | undefined = () => undefined) {
  vi.mocked(HTMLElement.prototype.getBoundingClientRect).mockImplementation(function (this: HTMLElement) {
    if (this.hasAttribute("data-hint-guide-slot")) return rect(slot());
    if (this.dataset.testid === "scroll-body") return rect({ left: 0, top: 92, width: 375, height: 477.5 });
    return rect(extra(this) ?? { left: 0, top: 0, width: 375, height: 667 });
  });
}
function ScrollRoom({ compact = false, children }: { compact?: boolean; children?: ReactNode }) {
  const context = askGuideContext({ messageCount: 0, thinking: false });
  return <HintGuideProvider enabled>
    {compact && <HintGuideSlot key="compact" context={context} className="h-24 w-24" />}
    <div data-testid="scroll-body" style={{ overflowX: "hidden", overflowY: "auto" }}>
      {!compact && <HintGuideSlot key="large" context={context} className="h-60 w-60" />}
      {children}
    </div>
  </HintGuideProvider>;
}
function frames() {
  const queue = new Map<number, FrameRequestCallback>();let next = 0;
  vi.stubGlobal("requestAnimationFrame", vi.fn((callback: FrameRequestCallback) => { queue.set(++next, callback);return next; }));
  vi.stubGlobal("cancelAnimationFrame", vi.fn((id: number) => { queue.delete(id); }));
  return { queue, run() { const pending = [...queue.values()];queue.clear();pending.forEach(callback => callback(performance.now())); } };
}
const roomMotion = (active: boolean, id = "1") => window.dispatchEvent(new CustomEvent("hint:room-motion", { detail: { id, active } }));
// Anchors are normalized to the window, which jsdom reports without a visual viewport.
const anchor = (x: number, y: number, width: number) => ({ x: x / window.innerWidth, y: y / window.innerHeight, width: width / window.innerWidth });

it("clips the guide to its scrolling body instead of painting over the fixed header", async () => {
  let slot: Box = { left: 67.5, top: -80.667, width: 240, height: 240 };
  phone(() => slot);
  const view = render(<ScrollRoom />);
  await waitFor(() => expect(state.player.setAnchor).toHaveBeenCalled());
  const layer = view.getByTestId("hint-guide-layer");
  expect(layer.dataset.clip).toBe("inset(92px 0px 97.5px 0px)");
  expect(state.player.setMotionPolicy).toHaveBeenLastCalledWith({ reduced: false, visible: true });
  // The canvas keeps its own entrance mask inside the layer's scroll clip.
  const onFrame = state.createPlayer.mock.calls[0][1].onFrame;
  onFrame({ actor: { x: 0, y: 0, width: 0.2, height: 0.2 }, state: { placement: "dock", context: { phase: "idle" }, paused: false, clock: 1, transitioning: false },
    shadow: { x: 0, y: 0, width: 0.2, opacity: 1 }, letter: "delivered", intro: { phase: "rise", maskY: 0.5, logoOpacity: 1, logo: { x: 0.5, y: 0.5, width: 0.3 },
      actor: { opacity: 1, front: false }, shadow: { opacity: 1 } } });
  expect(view.container.querySelector("canvas")!.style.clipPath).toBe("inset(0 0 50% 0)");
  expect(layer.dataset.clip).toBe("inset(92px 0px 97.5px 0px)");
  // Within the phone but entirely under the header: nothing is reachable.
  slot = { left: 67.5, top: -180, width: 240, height: 240 };
  await act(async () => { fireEvent.scroll(window); });
  expect(state.player.setMotionPolicy).toHaveBeenLastCalledWith({ reduced: false, visible: false });
  expect(layer.dataset.clip).toBe("inset(92px 0px 97.5px 0px)");
  slot = { left: 67.5, top: 120, width: 240, height: 240 };
  await act(async () => { fireEvent.scroll(window); });
  expect(state.player.setMotionPolicy).toHaveBeenLastCalledWith({ reduced: false, visible: true });
});

it("keeps one canvas and player when the keyboard swaps in a compact slot outside the scroll body", async () => {
  phone(() => ({ left: 67.5, top: 40, width: 240, height: 240 }));
  const view = render(<ScrollRoom />);
  await waitFor(() => expect(view.getByTestId("hint-guide-layer").dataset.clip).toBe("inset(92px 0px 97.5px 0px)"));
  const canvas = view.container.querySelector("canvas");
  state.player.setContext.mockClear();
  await act(async () => view.rerender(<ScrollRoom compact />));
  expect(view.getByTestId("hint-guide-layer").dataset.clip).toBe("none");
  expect(view.container.querySelector("canvas")).toBe(canvas);
  expect(state.player.setContext).toHaveBeenCalledTimes(1);
  expect(state.createPlayer).toHaveBeenCalledTimes(1);
});

it("lets an open delivery use its modal instead of the header slot that scrolled away", async () => {
  const target = document.createElement("div");
  const view = render(<HintGuideProvider enabled>
    <div data-testid="modal" style={{ position: "fixed", overflowY: "auto" }}>
      <HintGuideSlot context={{ ...askGuideContext({ messageCount: 0, thinking: false }), room: "home" }} delivery={{ key: "today:moon", cardBack: "/back.png", done: false, target: { current: target } }} />
    </div>
  </HintGuideProvider>);
  view.getByTestId("modal").append(target);
  phone(() => ({ left: 150, top: -100, width: 72, height: 72 }), element =>
    element === target ? { left: 116, top: 20, width: 142, height: 228 } : element.dataset.testid === "modal" ? { left: 0, top: 0, width: 375, height: 600 } : undefined);
  await act(async () => { fireEvent.scroll(window); });
  await waitFor(() => expect(state.player.setDelivery).toHaveBeenCalledWith(expect.objectContaining({ done: false })));
  expect(state.player.setMotionPolicy).toHaveBeenLastCalledWith({ reduced: false, visible: true });
  expect(view.getByTestId("hint-guide-layer").dataset.clip).toBe("inset(0px 0px 67px 0px)");
});

it("follows a moving room entrance every frame and settles at its final place", async () => {
  const raf = frames();
  let slot: Box = { left: 67.5, top: 120, width: 240, height: 240 };
  phone(() => slot);
  render(<ScrollRoom />);
  await waitFor(() => expect(state.player.setAnchor).toHaveBeenCalled());
  state.player.setAnchor.mockClear();state.player.setContext.mockClear();
  act(() => roomMotion(true));
  expect(raf.queue.size).toBe(1);
  // A native transform and scale move the slot with no resize or scroll event.
  slot = { left: 60, top: 150, width: 260, height: 260 };
  act(() => raf.run());
  expect(state.player.setAnchor).toHaveBeenLastCalledWith(anchor(190, 280, 260), { followLayout: true });
  slot = { left: 64, top: 135, width: 250, height: 250 };
  act(() => raf.run());
  expect(state.player.setAnchor).toHaveBeenLastCalledWith(anchor(189, 260, 250), { followLayout: true });
  expect(raf.queue.size).toBe(1);
  slot = { left: 67.5, top: 120, width: 240, height: 240 };
  await act(async () => roomMotion(false));
  expect(state.player.setAnchor).toHaveBeenLastCalledWith(anchor(187.5, 240, 240), { followLayout: true });
  expect(raf.queue.size).toBe(0);
  // Positioning never restarts the scene or its context.
  expect(state.player.setContext).not.toHaveBeenCalled();
  expect(state.createPlayer).toHaveBeenCalledTimes(1);
});

it("captures the final place when an entrance is cancelled and stops tracking when hidden", async () => {
  const raf = frames();
  let slot: Box = { left: 67.5, top: 120, width: 240, height: 240 };
  phone(() => slot);
  const view = render(<ScrollRoom />);
  await waitFor(() => expect(state.player.setAnchor).toHaveBeenCalled());
  act(() => roomMotion(true, "1"));
  act(() => raf.run());
  // A newer entrance replaces a cancelled one; tracking continues for it alone.
  act(() => { roomMotion(true, "2");roomMotion(false, "1"); });
  expect(raf.queue.size).toBe(1);
  state.policy = { reduced: false, pageVisible: false };view.rerender(<ScrollRoom />);
  // The pending frame measures the final place once, then stops.
  slot = { left: 70, top: 100, width: 240, height: 240 };
  act(() => raf.run());
  expect(state.player.setAnchor).toHaveBeenLastCalledWith(anchor(190, 220, 240), { followLayout: true });
  expect(raf.queue.size).toBe(0);
  state.policy = { reduced: false, pageVisible: true };view.rerender(<ScrollRoom />);
  act(() => raf.run());
  expect(raf.queue.size).toBe(0);
});

it("resumes tracking an entrance whose first frame ran before the player was ready", async () => {
  const raf = frames();
  let finish!: (player: typeof state.player) => void;
  state.createPlayer.mockImplementation(() => new Promise(resolve => { finish = resolve; }));
  let slot: Box = { left: 60, top: 150, width: 260, height: 260 };
  phone(() => slot);
  render(<ScrollRoom />);
  await waitFor(() => expect(state.createPlayer).toHaveBeenCalledTimes(1));
  act(() => roomMotion(true));
  // A cold first request: the early frame finds no player and schedules nothing more.
  act(() => raf.run());
  expect(raf.queue.size).toBe(0);
  await act(async () => { finish(state.player); });
  expect(raf.queue.size).toBe(1);
  slot = { left: 64, top: 135, width: 250, height: 250 };
  act(() => raf.run());
  expect(state.player.setAnchor).toHaveBeenLastCalledWith(anchor(189, 260, 250), { followLayout: true });
  expect(raf.queue.size).toBe(1);
  slot = { left: 67.5, top: 120, width: 240, height: 240 };
  await act(async () => roomMotion(false));
  expect(state.player.setAnchor).toHaveBeenLastCalledWith(anchor(187.5, 240, 240), { followLayout: true });
  expect(raf.queue.size).toBe(0);
  expect(state.player.setContext).toHaveBeenCalledTimes(1);
});

it("does not track frames under reduced motion and cancels them on unmount", async () => {
  const raf = frames();
  let slot: Box = { left: 67.5, top: 120, width: 240, height: 240 };
  phone(() => slot);
  state.policy = { reduced: true, pageVisible: true };
  const view = render(<ScrollRoom />);
  await waitFor(() => expect(state.player.setAnchor).toHaveBeenCalled());
  act(() => roomMotion(true));
  expect(raf.queue.size).toBe(0);
  slot = { left: 67.5, top: 100, width: 240, height: 240 };
  await act(async () => roomMotion(false));
  expect(state.player.setAnchor).toHaveBeenLastCalledWith(anchor(187.5, 220, 240), { followLayout: true });
  state.policy = { reduced: false, pageVisible: true };view.rerender(<ScrollRoom />);
  act(() => roomMotion(true));
  expect(raf.queue.size).toBe(1);
  view.unmount();
  expect(raf.queue.size).toBe(0);
  state.player.setAnchor.mockClear();
  await act(async () => roomMotion(false));
  expect(state.player.setAnchor).not.toHaveBeenCalled();
});

it("discards delayed feedback from a screen that has closed", async () => {
  let finish!: () => void;
  function SavingScreen() {
    const play = useHintGuideGesture();
    return <button onClick={() => { void new Promise<void>(resolve => { finish = resolve; }).then(() => play("nod")); }}>Save profile</button>;
  }
  const content = (saving: boolean) => <HintGuideProvider enabled>
    <HintGuideSlot context={askGuideContext({ messageCount: 0, thinking: false })} />{saving && <SavingScreen />}
  </HintGuideProvider>;
  const view = render(content(true));
  await waitFor(() => expect(state.createPlayer).toHaveBeenCalledTimes(1));
  fireEvent.click(view.getByRole("button", { name: "Save profile" }));
  await act(async () => view.rerender(content(false)));
  await act(async () => finish());
  expect(state.player.playGesture).not.toHaveBeenCalled();
});
