import { describe, expect, it } from "vitest";
import {
  createInitialWashRitualState,
  createWashFrameClock,
  getWashRitualTiming,
  washRitualReducer,
} from "./washRitualMachine";

describe("wash ritual machine", () => {
  it("enters manual wash immediately without a readiness gate", () => {
    const state = washRitualReducer(createInitialWashRitualState(), {
      type: "MANUAL_START",
    });

    expect(state).toMatchObject({
      stage: "washing",
      mode: "manual",
    });
  });

  it("accepts manual progress without creating a second confirmation state", () => {
    const manual = washRitualReducer(createInitialWashRitualState(), {
      type: "MANUAL_START",
    });
    const moved = washRitualReducer(manual, { type: "PROGRESS", progress: 0.64 });

    expect(moved).toMatchObject({ mode: "manual", progress: 0.64 });
    expect("manualRestReady" in moved).toBe(false);
  });

  it("returns an interrupted manual wash to an idle table", () => {
    const manual = washRitualReducer(createInitialWashRitualState(), {
      type: "MANUAL_START",
    });
    const cancelled = washRitualReducer(manual, { type: "MANUAL_CANCEL" });

    expect(cancelled).toMatchObject({
      stage: "washing",
      mode: null,
      autoWashing: false,
    });
  });

  it("locks Auto Wash against repeated activation", () => {
    const first = washRitualReducer(createInitialWashRitualState(), {
      type: "AUTO_START",
    });
    const repeated = washRitualReducer(first, { type: "AUTO_START" });

    expect(first).toMatchObject({ mode: "auto", autoWashing: true });
    expect(repeated).toBe(first);
  });

  it("progresses from completed wash through gather to ready", () => {
    const washing = washRitualReducer(createInitialWashRitualState(), {
      type: "AUTO_START",
    });
    const gathering = washRitualReducer(washing, { type: "WASH_COMPLETE" });
    const ready = washRitualReducer(gathering, { type: "GATHER_COMPLETE" });

    expect(gathering).toMatchObject({ stage: "gathering", autoWashing: false });
    expect(ready.stage).toBe("cutReady");
  });

  it("returns to a clean wash state only from the ready deck", () => {
    const ignored = washRitualReducer(createInitialWashRitualState(), {
      type: "WASH_AGAIN",
    });
    const ready = washRitualReducer(
      washRitualReducer(
        washRitualReducer(createInitialWashRitualState(), { type: "AUTO_START" }),
        { type: "WASH_COMPLETE" },
      ),
      { type: "GATHER_COMPLETE" },
    );
    const restarted = washRitualReducer(ready, { type: "WASH_AGAIN" });

    expect(ignored).toEqual(createInitialWashRitualState());
    expect(restarted).toEqual(createInitialWashRitualState());
  });

  it("shortens every decorative wait when reduced motion is enabled", () => {
    const standard = getWashRitualTiming(false);
    const reduced = getWashRitualTiming(true);

    expect(reduced.autoWashMs).toBeLessThan(standard.autoWashMs);
    expect(reduced.squareMs).toBeLessThan(standard.squareMs);
    expect(reduced.readyMs).toBeLessThan(standard.readyMs);
  });

  it("lets the gather motion finish before the deck squares", () => {
    const standard = getWashRitualTiming(false);

    expect(standard.squareMs).toBeGreaterThanOrEqual(440);
    expect(standard.readyMs).toBeGreaterThan(standard.squareMs);
    expect(standard.readyMs).toBeLessThan(1200);
  });

  it("keeps the same wash speed on 60 Hz and 120 Hz displays", () => {
    const simulate = (refreshRate: number) => {
      const clock = createWashFrameClock(0);
      let steps = 0;
      for (let frame = 1; frame <= refreshRate * 2; frame += 1) {
        steps += clock(frame * (1000 / refreshRate));
      }
      return steps;
    };
    expect(simulate(60)).toBe(120);
    expect(simulate(120)).toBe(120);
  });

  it("does not jump through a backlog after the browser pauses animation frames", () => {
    const clock = createWashFrameClock(0);
    expect(clock(1000 / 60)).toBe(1);
    expect(clock(30_000)).toBeLessThanOrEqual(3);
  });

  it("keeps automatic washing quick without making it abrupt", () => {
    const standard = getWashRitualTiming(false);

    expect(standard.autoWashMs).toBeGreaterThanOrEqual(3200);
    expect(standard.autoWashMs).toBeLessThanOrEqual(4000);
  });
});
