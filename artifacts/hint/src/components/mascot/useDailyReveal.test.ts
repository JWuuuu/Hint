// @vitest-environment jsdom
import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { useDailyReveal } from "./useDailyReveal";

const policy = vi.hoisted(() => ({ reduced: false, pageVisible: true }));
const playback = vi.hoisted(() => ({ speed: 1, paused: false }));
vi.mock("../../lib/motionPolicy", () => ({ useMotionPolicy: () => policy }));
vi.mock("./HintGuide", () => ({ useHintGuidePlayback: () => playback }));
beforeEach(() => {
  policy.reduced = false;policy.pageVisible = true;playback.speed = 1;playback.paused = false;
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "performance"] });
  vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => window.setTimeout(() => callback(performance.now()), 10));
  vi.stubGlobal("cancelAnimationFrame", (id: number) => window.clearTimeout(id));
});
afterEach(() => { cleanup();vi.unstubAllGlobals();vi.useRealTimers(); });
const advance = (ms: number) => act(() => { vi.advanceTimersByTime(ms); });
function setup(overrides = {}) {
  const props = { open: true, preparing: false, fresh: true, delivered: false, identity: "2026-10-20:star", onRevealed: vi.fn(), onFlip: vi.fn(), ...overrides };
  return { props, ...renderHook(props => useDailyReveal(props), { initialProps: props }) };
}

it("waits for the real receipt and the full card turn, then announces exactly once", () => {
  const view = setup({ preparing: true });
  advance(5000); expect(view.result.current.flipped).toBe(false);
  view.rerender({ ...view.props, preparing: false });
  advance(620); expect(view.result.current.flipped).toBe(true);
  expect(view.result.current.detailsReady).toBe(false);
  advance(859); expect(view.props.onRevealed).not.toHaveBeenCalled();
  advance(1); expect(view.props.onRevealed).toHaveBeenCalledTimes(1);
  advance(5000); expect(view.props.onFlip).toHaveBeenCalledTimes(1);
  expect(view.props.onRevealed).toHaveBeenCalledTimes(1);
});

it("pauses the remaining delay when hidden instead of skipping the reveal", () => {
  const view = setup(); advance(300);
  policy.pageVisible = false; view.rerender(view.props); advance(60000);
  expect(view.result.current.flipped).toBe(false);
  policy.pageVisible = true; view.rerender(view.props);
  advance(319); expect(view.result.current.flipped).toBe(false);
  advance(1); expect(view.result.current.flipped).toBe(true);
  advance(300);const angle = view.result.current.rotation.get();
  expect(angle).toBeGreaterThan(0);expect(angle).toBeLessThan(180);
  policy.pageVisible = false; view.rerender(view.props); advance(60000);
  expect(view.result.current.detailsReady).toBe(false);
  expect(view.result.current.rotation.get()).toBe(angle);
  policy.pageVisible = true; view.rerender(view.props); advance(550);
  expect(view.result.current.detailsReady).toBe(false);advance(10);
  expect(view.result.current.detailsReady).toBe(true);
  expect(view.result.current.rotation.get()).toBe(180);
});

it("makes reduced motion immediate once ready, without a flip or replay", () => {
  policy.reduced = true;
  const view = setup({ preparing: true });
  expect(view.result.current.detailsReady).toBe(false);
  view.rerender({ ...view.props, preparing: false });
  expect(view.result.current.detailsReady).toBe(true);
  expect(view.props.onRevealed).toHaveBeenCalledTimes(1);
  expect(view.props.onFlip).not.toHaveBeenCalled();
  policy.reduced = false; view.rerender({ ...view.props, preparing: false }); advance(5000);
  expect(view.props.onFlip).not.toHaveBeenCalled();
});

it("opens saved cards immediately and cancels a pending reveal on close", () => {
  const view = setup(); advance(300);
  view.rerender({ ...view.props, open: false }); advance(3000);
  expect(view.props.onRevealed).not.toHaveBeenCalled();
  view.rerender({ ...view.props, fresh: false });
  expect(view.result.current.flipped).toBe(true);
  expect(view.result.current.detailsReady).toBe(true);
  advance(3000); expect(view.props.onFlip).not.toHaveBeenCalled();
  expect(view.props.onRevealed).not.toHaveBeenCalled();
});

it("does not announce a new receipt using the previous card's ready state", () => {
  const view = setup(); advance(620); advance(900);
  view.rerender({ ...view.props, identity: "2026-10-21:moon", preparing: true });
  expect(view.result.current.detailsReady).toBe(false);
  expect(view.props.onRevealed).toHaveBeenCalledTimes(1);
  view.rerender({ ...view.props, identity: "2026-10-21:moon", preparing: false });
  advance(620); advance(900);
  expect(view.props.onRevealed).toHaveBeenCalledTimes(2);
});

it("rapid manual taps cannot duplicate the reveal or finish after unmount", () => {
  const view = setup(); act(() => { view.result.current.flip(); view.result.current.flip(); });
  expect(view.result.current.flipped).toBe(true);
  expect(view.props.onFlip).toHaveBeenCalledTimes(1);
  view.unmount(); advance(5000);
  expect(view.props.onRevealed).not.toHaveBeenCalled();
});

it("starts turning immediately after the completed letter but preserves the ordinary arrival delay", () => {
  const view = setup({ preparing: true, delivered: true });
  advance(5000);expect(view.props.onFlip).not.toHaveBeenCalled();
  view.rerender({ ...view.props, preparing: false });
  expect(view.result.current.flipped).toBe(true);expect(view.props.onFlip).toHaveBeenCalledTimes(1);
  expect(view.result.current.rotation.get()).toBe(0);
  advance(860);expect(view.result.current.detailsReady).toBe(true);
  expect(view.props.onRevealed).toHaveBeenCalledTimes(1);
});

it("uses review speed and pause for the visible transform and the completion together", () => {
  playback.speed = 0.5;
  const view = setup({ delivered: true });
  advance(860);const halfway = view.result.current.rotation.get();
  expect(halfway).toBeGreaterThan(0);expect(halfway).toBeLessThan(180);
  expect(view.result.current.detailsReady).toBe(false);
  playback.paused = true;view.rerender(view.props);advance(60000);
  expect(view.result.current.rotation.get()).toBe(halfway);
  expect(view.props.onRevealed).not.toHaveBeenCalled();
  playback.paused = false;view.rerender(view.props);advance(850);
  expect(view.result.current.detailsReady).toBe(false);advance(10);
  expect(view.result.current.rotation.get()).toBe(180);
  expect(view.props.onRevealed).toHaveBeenCalledTimes(1);
});
