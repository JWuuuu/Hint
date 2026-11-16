/** @vitest-environment jsdom */
import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { useCardPreviewReturnFocus } from "./useCardPreviewReturnFocus";

let frames: Map<number, FrameRequestCallback>;
let nextFrame: number;
let background: HTMLDivElement;
let opener: HTMLButtonElement;
let fallback: HTMLElement;
let animations: Animation[];

class VisibilityEffect {
  getKeyframes() { return [{ visibility: "hidden" }, { visibility: "visible" }]; }
}

beforeEach(() => {
  frames = new Map(); nextFrame = 0; animations = [];
  vi.stubGlobal("KeyframeEffect", VisibilityEffect);
  vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => { frames.set(++nextFrame, callback); return nextFrame; });
  vi.stubGlobal("cancelAnimationFrame", (id: number) => frames.delete(id));
  background = document.createElement("div");
  opener = document.createElement("button");
  fallback = document.createElement("section");
  fallback.tabIndex = -1; fallback.dataset.testid = "tarot-short-answer";
  background.append(opener, fallback); document.body.append(background);
  background.getAnimations = () => animations;
});
afterEach(() => { cleanup(); document.body.replaceChildren(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

function frame() {
  const callbacks = [...frames.values()]; frames.clear();
  act(() => callbacks.forEach(callback => callback(performance.now())));
}
function preview(waitForVisibility = false) {
  const hook = renderHook(({ open }) => useCardPreviewReturnFocus(open, { current: background }), { initialProps: { open: false } });
  opener.focus(); hook.result.current.captureOpener(opener); hook.rerender({ open: true });
  const closeCallback = hook.result.current.restoreFocus;
  opener.blur(); hook.rerender({ open: false });
  if (waitForVisibility) animations = [{ effect: new VisibilityEffect() }] as unknown as Animation[];
  const close = () => { const event = new Event("closeAutoFocus", { cancelable: true }); act(() => closeCallback(event)); expect(event.defaultPrevented).toBe(true); };
  return { ...hook, close, closeCallback };
}

it("returns to the connected opener after the dialog has closed", () => {
  const p = preview(); p.close(); expect(document.activeElement).toBe(opener);
  frame(); expect(document.activeElement).toBe(opener); expect(frames.size).toBe(0);
});

it("waits through cascading visibility transitions even when the opener briefly computes visible", () => {
  const p = preview(); animations = [{ effect: new VisibilityEffect() }] as unknown as Animation[];
  p.close(); frame(); expect(document.activeElement).toBe(document.body);
  opener.style.visibility = "hidden"; frame(); expect(document.activeElement).toBe(document.body);
  opener.style.visibility = "visible"; animations = []; frame();
  expect(document.activeElement).toBe(opener); expect(frames.size).toBe(0);
});

it.each(["disconnected", "hidden", "disabled", "inert"])("uses the reading answer when the opener is %s", kind => {
  const p = preview();
  if (kind === "disconnected") opener.remove();
  if (kind === "hidden") opener.style.visibility = "hidden";
  if (kind === "disabled") opener.disabled = true;
  if (kind === "inert") opener.setAttribute("inert", "");
  p.close(); frame(); expect(document.activeElement).toBe(fallback); expect(frames.size).toBe(0);
});

it("does not focus a hidden fallback or keep retrying when no visibility transition is pending", () => {
  const p = preview(); background.style.visibility = "hidden"; p.close(); frame();
  expect(document.activeElement).toBe(document.body); expect(frames.size).toBe(0);
});

it("cancels a pending restoration on reopen and rejects that old callback after the newer preview closes", () => {
  const p = preview(true); p.close();
  p.result.current.captureOpener(opener); p.rerender({ open: true });
  frame(); expect(document.activeElement).toBe(document.body);
  p.rerender({ open: false }); p.close(); frame();
  expect(document.activeElement).toBe(document.body); expect(frames.size).toBe(0);
});

it("ignores close callbacks while the preview is open", () => {
  const p = preview(); p.rerender({ open: true }); p.close(); frame();
  expect(document.activeElement).toBe(document.body); expect(frames.size).toBe(0);
});

it("cancels on owner unmount, including a late Radix callback", () => {
  const p = preview(true); p.close(); p.unmount(); frame(); p.close(); frame();
  expect(document.activeElement).toBe(document.body); expect(frames.size).toBe(0);
});

it("does not take focus after navigation", () => {
  const p = preview(true); p.close(); const previous = window.location.href;
  window.history.replaceState({}, "", "#another-room"); frame();
  expect(document.activeElement).toBe(document.body); expect(frames.size).toBe(0);
  window.history.replaceState({}, "", previous);
});

it("respects a user-selected control and another open dialog", () => {
  const p = preview(true); p.close(); const other = document.createElement("button");
  document.body.append(other); other.focus(); frame(); expect(document.activeElement).toBe(other);
  other.blur(); p.close(); const dialog = document.createElement("div"); dialog.role = "dialog"; document.body.append(dialog);
  frame(); expect(document.activeElement).toBe(document.body); expect(frames.size).toBe(0);
});

it.each(["before-callback", "while-waiting"])("remembers a user focus change followed by blur, %s", phase => {
  const p = preview(true);
  if (phase === "while-waiting") p.close();
  const other = document.createElement("button"); document.body.append(other);
  other.focus(); other.blur(); animations = [];
  if (phase === "before-callback") p.close();
  frame(); expect(document.activeElement).toBe(document.body); expect(frames.size).toBe(0);
});
