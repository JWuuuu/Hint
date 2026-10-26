// @vitest-environment jsdom
import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { useDailyDelivery } from "./useDailyDelivery";
const state = vi.hoisted(() => ({ enabled: true, policy: { reduced: false, pageVisible: true }, listener: (_frame: any) => {} }));
vi.mock("./HintGuide", () => ({ useHintGuideEnabled: () => state.enabled, useHintGuideFrames: (listener: typeof state.listener) => { state.listener = listener; } }));
vi.mock("../../lib/motionPolicy", () => ({ useMotionPolicy: () => state.policy }));
const initial = { open: true, fresh: true, preparing: false, identity: "today:moon", cardBack: "/back.png" };
beforeEach(() => { vi.useFakeTimers();state.enabled = true;state.policy = { reduced: false, pageVisible: true }; });
afterEach(() => { cleanup();vi.useRealTimers(); });

it("gates only a new card and ignores completions from an obsolete receipt", () => {
  const view = renderHook(props => useDailyDelivery(props), { initialProps: initial });
  expect(view.result.current.active).toBe(true);
  act(() => state.listener({ delivery: { key: "yesterday:star", phase: "ready" } }));
  expect(view.result.current.active).toBe(true);
  act(() => state.listener({ delivery: { key: initial.identity, phase: "ready" } }));
  expect(view.result.current.active).toBe(false);expect(view.result.current.slot?.done).toBe(true);
  view.rerender({ ...initial, identity: "tomorrow:sun" });expect(view.result.current.active).toBe(true);
  view.rerender({ ...initial, open: false });view.rerender({ ...initial, fresh: false });
  expect(view.result.current.active).toBe(false);expect(view.result.current.slot).toBeUndefined();
});
it("skip, reduced motion and unavailable rendering immediately unblock the card", () => {
  const view = renderHook(props => useDailyDelivery(props), { initialProps: initial });
  act(() => view.result.current.skip());expect(view.result.current.active).toBe(false);
  view.rerender({ ...initial, identity: "tomorrow:sun" });act(() => state.listener({ fallback: true }));expect(view.result.current.active).toBe(false);
  state.policy.reduced = true;view.rerender({ ...initial, identity: "next:star" });expect(view.result.current.active).toBe(false);
  state.policy.reduced = false;state.enabled = false;view.rerender(initial);expect(view.result.current.active).toBe(false);
});
it("bounds loading waits but never skips an active or hidden delivery", () => {
  const view = renderHook(props => useDailyDelivery(props), { initialProps: initial });
  state.policy.pageVisible = false;view.rerender(initial);act(() => vi.advanceTimersByTime(30000));expect(view.result.current.active).toBe(true);
  state.policy.pageVisible = true;view.rerender(initial);act(() => vi.advanceTimersByTime(12000));expect(view.result.current.active).toBe(false);
  view.rerender({ ...initial, identity: "tomorrow:sun" });
  act(() => state.listener({ delivery: { key: "tomorrow:sun", phase: "offering" } }));
  act(() => vi.advanceTimersByTime(30000));expect(view.result.current.active).toBe(true);
});

it("exposes an opaque DOM card beneath the GPU while decorations follow the material handoff", () => {
  const view = renderHook(props => useDailyDelivery(props), { initialProps: initial });
  expect(view.result.current.materialVisible).toBe(false);expect(view.result.current.handoff.get()).toBe(0);
  act(() => state.listener({ delivery: { key: "yesterday:star", phase: "taking-card", handoff: 0.5 } }));
  expect(view.result.current.materialVisible).toBe(false);
  act(() => state.listener({ delivery: { key: initial.identity, phase: "taking-card", handoff: 0.5 } }));
  expect(view.result.current.materialVisible).toBe(true);expect(view.result.current.active).toBe(true);
  expect(view.result.current.handoff.get()).toBe(0.5);expect(view.result.current.delivered).toBe(false);
  act(() => state.listener({ delivery: { key: initial.identity, phase: "ready", handoff: 1 } }));
  expect(view.result.current.handoff.get()).toBe(1);expect(view.result.current.delivered).toBe(true);
  expect(view.result.current.active).toBe(false);
  view.rerender({ ...initial, identity: "tomorrow:sun" });
  expect(view.result.current.materialVisible).toBe(false);expect(view.result.current.handoff.get()).toBe(0);
  expect(view.result.current.delivered).toBe(false);
});
