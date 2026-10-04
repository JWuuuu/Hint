/** @vitest-environment jsdom */
import { useEffect, useState } from "react";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { Router } from "wouter";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { RoomTransitions } from "./RoomTransitions";
import { entranceKeyframes, entranceRect, ROOM_ENTRANCES } from "./roomEntrance";

const policy = { reduced: false, pageVisible: true };
vi.mock("../../lib/motionPolicy", () => ({ useMotionPolicy: () => policy }));
const preload = vi.hoisted(() => vi.fn());
vi.mock("../../product/roomPreload", () => ({ preloadRoom: preload }));
const animations: { cancel: ReturnType<typeof vi.fn>; finish: () => void; frames: Keyframe[]; options: KeyframeAnimationOptions }[] = [];
let mountCount = 0;
function Content() {
  useEffect(() => { mountCount++; }, []);
  return <input aria-label="Question" defaultValue="Keep my question" />;
}
function Harness({ base = "", cancelled = false, initial = "/app", buttonTarget = "/app/tarot", buttonDisabled = false, loading = false, loadError = false }: { loading?: boolean; loadError?: boolean; base?: string; cancelled?: boolean; initial?: string; buttonTarget?: string; buttonDisabled?: boolean }) {
  const [path, setPath] = useState(initial);
  return <Router base={base}>
    <RoomTransitions location={path}>
      <div data-room-content>
      <output>{path}</output>
      <a href={`${base}/app/tarot`} onClick={event => { event.preventDefault(); if (!cancelled) setPath("/app/tarot"); }}>Tarot</a>
      <a href={`${base}/app/astrology`} onClick={event => { event.preventDefault(); setPath("/app/astrology"); }}>Astrology</a>
      <a href={`${base}/app/readings/fixture`} onClick={event => { event.preventDefault(); setPath("/app/readings/fixture"); }}>Reading detail</a>
      <button data-room-target={buttonTarget} disabled={buttonDisabled} onClick={() => { if (!cancelled) setPath("/app/tarot"); }}>Open Tarot</button>
      <button onClick={() => setPath("/app")}>Back</button>
      <button onClick={() => setPath("/app/tarot?spread=three")}>Selection</button>
      {loading && <p data-room-loading>Opening the room…</p>}
      {loadError && <p data-room-load-error>Unable to open this room.</p>}
      <Content />
      </div>
    </RoomTransitions>
    <button onClick={() => {
      window.dispatchEvent(new CustomEvent("hint:room-navigation-approved", { detail: { to: `${base}/app/tarot` } }));
      setPath("/app/tarot");
    }}>Approve Tarot</button>
    <button onClick={() => window.dispatchEvent(new CustomEvent("hint:room-navigation-cancelled"))}>Cancel departure</button>
  </Router>;
}
const arriving = () => document.querySelector("[data-room-entrance]");
const content = () => document.querySelector<HTMLElement>("[data-room-content]")!;
beforeEach(() => {
  vi.useFakeTimers();
  preload.mockClear();
  policy.reduced = false; policy.pageVisible = true; mountCount = 0; animations.length = 0;
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function(this: HTMLElement) {
    return this.tagName === "A" ? new DOMRect(24, 160, 80, 110) : this.hasAttribute("data-room-target") ? new DOMRect(281, 36, 44, 44) : new DOMRect(0, 0, 375, 667);
  });
  Object.defineProperty(HTMLElement.prototype, "animate", { configurable: true, value: vi.fn((frames: Keyframe[], options: KeyframeAnimationOptions) => {
    let finish!: () => void;
    const finished = new Promise<void>(resolve => { finish = resolve; });
    const animation = { cancel: vi.fn(), finish, frames, options };
    animations.push(animation);
    return { cancel: animation.cancel, finished };
  }) });
});

it("warms room code on intent without mounting or navigating to its content", () => {
  render(<Harness />);
  fireEvent.pointerOver(screen.getByRole("link", { name: "Tarot" }));
  expect(preload).toHaveBeenCalledWith("/app/tarot");
  expect(screen.getByRole("status").textContent).toBe("/app");
  expect(arriving()).toBeNull();
  expect(mountCount).toBe(1);
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.useRealTimers(); });

it("commits navigation immediately and settles the same readable content without remounting it", async () => {
  render(<Harness />);
  const wrapper = content();
  const input = screen.getByRole("textbox"); input.focus();
  fireEvent.change(input, { target: { value: "Still mine" } });
  fireEvent.click(screen.getByRole("link", { name: "Tarot" }));
  expect(screen.getByRole("status").textContent).toBe("/app/tarot");
  expect(arriving()).toBe(wrapper);
  expect(arriving()?.getAttribute("aria-hidden")).toBeNull();
  expect(document.querySelector(".hint-room-entrance-surface,.hint-room-entrance-mark")).toBeNull();
  expect(arriving()?.getAttribute("data-room-entrance")).toBe("tarot");
  expect(document.activeElement).toBe(input);
  expect(screen.getByRole("textbox")).toBe(input);
  expect((input as HTMLInputElement).value).toBe("Still mine");
  expect(mountCount).toBe(1);
  await act(async () => animations[0]!.finish());
  expect(arriving()).toBeNull();
  expect(content()).toBe(wrapper);
  expect(animations.every(animation => animation.cancel.mock.calls.length === 1)).toBe(true);
});

it("query-only changes preserve the entered content without another entrance", () => {
  render(<Harness />);
  fireEvent.click(screen.getByRole("link", { name: "Tarot" }));
  act(() => vi.advanceTimersByTime(ROOM_ENTRANCES.tarot.duration + 80));
  const calls = animations.length;
  fireEvent.click(screen.getByText("Selection"));
  expect(animations.length).toBe(calls);
  expect(arriving()).toBeNull();
  expect(mountCount).toBe(1);
});

it("cancels previous animation on back and cannot let an old finish remove a fresh entrance", async () => {
  render(<Harness />);
  fireEvent.click(screen.getByRole("link", { name: "Tarot" }));
  const first = animations[0]!;
  fireEvent.click(screen.getByText("Back"));
  expect(arriving()).toBeNull(); expect(first.cancel).toHaveBeenCalledOnce();
  fireEvent.click(screen.getByRole("link", { name: "Astrology" }));
  await act(async () => first.finish());
  expect(arriving()?.getAttribute("data-room-entrance")).toBe("astrology");
});

it("continues a deliberate cross-room visit and cancels the previous entrance", async () => {
  render(<Harness initial="/app/collection" />);
  fireEvent.click(screen.getByRole("link", { name: "Tarot" }));
  expect(arriving()?.getAttribute("data-room-entrance")).toBe("tarot");
  const first = animations[0]!;
  fireEvent.click(screen.getByRole("link", { name: "Astrology" }));
  expect(first.cancel).toHaveBeenCalledOnce();
  expect(arriving()?.getAttribute("data-room-entrance")).toBe("astrology");
  await act(async () => first.finish());
  expect(arriving()?.getAttribute("data-room-entrance")).toBe("astrology");
  expect(mountCount).toBe(1);
});

it("keeps a nested reading within its room without replaying an entrance", () => {
  render(<Harness initial="/app/readings" />);
  fireEvent.click(screen.getByRole("link", { name: "Reading detail" }));
  expect(screen.getByRole("status").textContent).toBe("/app/readings/fixture");
  expect(arriving()).toBeNull();
  expect(animations).toHaveLength(0);
});

it("uses the measured source after a delayed, approved room departure", () => {
  render(<Harness cancelled initial="/app/collection" base="/hint" />);
  fireEvent.click(screen.getByRole("link", { name: "Tarot" }));
  act(() => vi.advanceTimersByTime(2_000));
  expect(arriving()).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Approve Tarot" }));
  expect(arriving()?.getAttribute("data-room-entrance")).toBe("tarot");
  expect(String(animations[0]!.frames[0]!.transform)).toMatch(/translate(?:3d)?\(-/);
});

it("warms an explicit programmatic button without taking over its navigation", () => {
  render(<Harness cancelled initial="/app/collection" />);
  const button = screen.getByRole("button", { name: "Open Tarot" });
  fireEvent.focus(button);
  expect(preload).toHaveBeenCalledWith("/app/tarot");
  fireEvent.click(button);
  expect(screen.getByRole("status").textContent).toBe("/app/collection");
  expect(arriving()).toBeNull();
});

it("uses the original programmatic button geometry after a delayed scoped approval", () => {
  render(<Harness cancelled initial="/app/collection" base="/hint" />);
  fireEvent.click(screen.getByRole("button", { name: "Open Tarot" }));
  act(() => vi.advanceTimersByTime(2_000));
  fireEvent.click(screen.getByRole("button", { name: "Approve Tarot" }));
  expect(arriving()?.getAttribute("data-room-entrance")).toBe("tarot");
  expect(String(animations[0]!.frames[0]!.transform)).toMatch(/translate(?:3d)?\([0-9]/);
});

it.each(["https://example.invalid/app/tarot", "javascript:alert(1)", "/app", ""])("ignores a button target outside a destination room: %s", buttonTarget => {
  render(<Harness buttonTarget={buttonTarget} />);
  fireEvent.click(screen.getByRole("button", { name: "Open Tarot" }));
  expect(arriving()).toBeNull();
  // The existing callback, including custom behavior, still runs normally.
  expect(screen.getByRole("status").textContent).toBe("/app/tarot");
});

it("does not preload or animate a disabled destination button", () => {
  render(<Harness buttonDisabled />);
  const button = screen.getByRole("button", { name: "Open Tarot" });
  fireEvent.pointerOver(button); fireEvent.click(button);
  expect(preload).not.toHaveBeenCalledOnce(); expect(arriving()).toBeNull();
});

it("a cancelled departure cannot replay its previous source on later navigation", () => {
  render(<Harness cancelled initial="/app/collection" />);
  fireEvent.click(screen.getByRole("link", { name: "Tarot" }));
  fireEvent.click(screen.getByRole("button", { name: "Cancel departure" }));
  fireEvent.click(screen.getByRole("button", { name: "Approve Tarot" }));
  expect(screen.getByRole("status").textContent).toBe("/app/tarot");
  expect(arriving()).toBeNull();
});

it("settles the real Tarot content for 1.3 seconds without a cover or opacity fade", () => {
  render(<Harness />);
  fireEvent.click(screen.getByRole("link", { name: "Tarot" }));
  expect(animations).toHaveLength(1);
  const movement = animations[0]!;
  expect(movement.options.duration).toBeGreaterThanOrEqual(1200);
  expect(movement.options.duration).toBeLessThanOrEqual(1400);
  expect(movement.frames.every(frame => frame.opacity === undefined || Number(frame.opacity) === 1)).toBe(true);
  expect(movement.frames.every(frame => frame.clipPath === undefined && frame.filter === undefined)).toBe(true);
  expect(movement.frames[0]!.transform).not.toBe(movement.frames.at(-1)!.transform);
  expect(document.querySelector(".hint-room-entrance-surface,.hint-room-entrance-mark")).toBeNull();
  act(() => vi.advanceTimersByTime(1100));
  expect(arriving()).toBe(content());
  act(() => vi.advanceTimersByTime(400));
  expect(arriving()).toBeNull();
  expect(content().style.transform).toBe("");
  expect(animations.every(animation => animation.cancel.mock.calls.length === 1)).toBe(true);
});

it.each(["focus", "click", "typing", "pointerdown", "wheel"])("a real %s interaction settles movement without intercepting input", kind => {
  render(<Harness />);
  const input = screen.getByRole("textbox");
  fireEvent.click(screen.getByRole("link", { name: "Tarot" }));
  expect(arriving()).toBe(content());
  if (kind === "focus") fireEvent.focusIn(input);
  else if (kind === "click") fireEvent.click(input);
  else if (kind === "pointerdown") fireEvent.pointerDown(input);
  else if (kind === "wheel") fireEvent.wheel(input);
  else fireEvent.keyDown(input, { key: "a" });
  fireEvent.change(input, { target: { value: "My question remains editable" } });
  expect(arriving()).toBeNull();
  expect(animations[0]!.cancel).toHaveBeenCalledOnce();
  expect((input as HTMLInputElement).value).toBe("My question remains editable");
  expect(mountCount).toBe(1);
});

it("reduced motion navigates immediately without starting any animation", () => {
  policy.reduced = true;
  render(<Harness />);
  fireEvent.click(screen.getByRole("link", { name: "Tarot" }));
  expect(screen.getByRole("status").textContent).toBe("/app/tarot");
  expect(arriving()).toBeNull();
  expect(animations).toHaveLength(0);
  expect(screen.getByRole("textbox")).toBeTruthy();
});

it("dismisses for native/browser background, and does not replay on resume", () => {
  const view = render(<Harness />);
  fireEvent.click(screen.getByRole("link", { name: "Tarot" }));
  policy.pageVisible = false; view.rerender(<Harness />);
  expect(arriving()).toBeNull();
  expect(animations.every(animation => animation.cancel.mock.calls.length === 1)).toBe(true);
  policy.pageVisible = true; view.rerender(<Harness />);
  expect(arriving()).toBeNull();
});

it("switching to reduced motion settles immediately without introducing a replacement fade", () => {
  const view = render(<Harness />);
  fireEvent.click(screen.getByRole("link", { name: "Tarot" }));
  policy.reduced = true; view.rerender(<Harness />);
  expect(animations[0]!.cancel).toHaveBeenCalledOnce();
  expect(animations).toHaveLength(1);
  expect(arriving()).toBeNull();
  expect(content().style.transform).toBe("");
  expect(document.querySelector(".hint-room-entrance-mark")).toBeNull();
});

it.each(["cancelled", "modified", "pointer-only"])("does not introduce an entrance for %s clicks", kind => {
  render(<Harness cancelled={kind === "cancelled"} />);
  const link = screen.getByRole("link", { name: "Tarot" });
  if (kind === "pointer-only") fireEvent.pointerDown(link);
  else fireEvent.click(link, { metaKey: kind === "modified" });
  expect(arriving()).toBeNull();
  expect(animations.length).toBe(0);
});

it("supports a scoped hosting base without using a different route identity", () => {
  render(<Harness base="/hint" />);
  fireEvent.click(screen.getByRole("link", { name: "Tarot" }));
  expect(arriving()?.getAttribute("data-room-entrance")).toBe("tarot");
});

it("does not block navigation on a browser without Web Animations", () => {
  Object.defineProperty(HTMLElement.prototype, "animate", { configurable: true, value: undefined });
  render(<Harness />);
  fireEvent.click(screen.getByRole("link", { name: "Tarot" }));
  expect(screen.getByRole("status").textContent).toBe("/app/tarot");
  expect(arriving()).toBeNull();
});

it("clamps a partially scrolled source to its phone canvas and ignores offscreen sources", () => {
  const canvas = new DOMRect(50, 40, 375, 667);
  expect(entranceRect(new DOMRect(40, 20, 100, 100), canvas)).toEqual({ x: 0, y: 0, width: 90, height: 80 });
  expect(entranceRect(new DOMRect(50, 900, 100, 100), canvas)).toBeNull();
  for (const room of Object.keys(ROOM_ENTRANCES) as (keyof typeof ROOM_ENTRANCES)[]) {
    const frames = entranceKeyframes(room, { x: 10, y: 50, width: 80, height: 110 }, canvas, true);
    expect(frames).toEqual([]);
  }
});

it("the translated content stays large enough to cover the viewport at every source edge", () => {
  for (const canvas of [{ width: 375, height: 667 }, { width: 440, height: 956 }]) {
    for (const room of Object.keys(ROOM_ENTRANCES) as (keyof typeof ROOM_ENTRANCES)[]) {
      for (const [x, y] of [[0, 0], [canvas.width - 44, 0], [0, canvas.height - 44], [canvas.width - 44, canvas.height - 44]]) {
        const frame = entranceKeyframes(room, { x, y, width: 44, height: 44 }, canvas, false)[0]!;
        const values = String(frame.transform).match(/translate3d\(([-.\d]+)px, ([-.\d]+)px, 0\) scale\(([-.\d]+)\)/)!;
        const dx = Math.abs(Number(values[1])), dy = Math.abs(Number(values[2])), scale = Number(values[3]);
        expect(dx).toBeLessThanOrEqual(Math.min(5, (scale - 1) * canvas.width / 2));
        expect(dy).toBeLessThanOrEqual(Math.min(12, (scale - 1) * canvas.height / 2));
      }
    }
  }
});

it("waits for a cold module to render without hiding its status or shortening its own arrival", async () => {
  const view = render(<Harness loading />);
  fireEvent.click(screen.getByRole("link", { name: "Tarot" }));
  expect(screen.getByText("Opening the room…")).toBeTruthy();
  expect(animations).toHaveLength(0);
  act(() => vi.advanceTimersByTime(2000));
  await act(async () => { view.rerender(<Harness />); });
  expect(animations).toHaveLength(1);
  expect(animations[0]!.options.duration).toBe(1300);
  expect(arriving()).toBe(content());
});

it.each(["departure", "deadline", "error"])("a cold module cannot replay motion after %s", async kind => {
  const view = render(<Harness loading />);
  fireEvent.click(screen.getByRole("link", { name: "Tarot" }));
  expect(animations).toHaveLength(0);
  if (kind === "departure") fireEvent.click(screen.getByText("Back"));
  else if (kind === "deadline") act(() => vi.advanceTimersByTime(10001));
  else await act(async () => { view.rerender(<Harness loadError />); });
  await act(async () => { view.rerender(<Harness />); });
  expect(animations).toHaveLength(0);
  expect(arriving()).toBeNull();
  expect(screen.getByRole("textbox")).toBeTruthy();
});
