/** @vitest-environment jsdom */

import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { setHintPreference } from "../../../lib/preferences";
import { useTarotReducedMotion } from "./useTarotReducedMotion";

let systemReduced = false;
let listeners = new Set<() => void>();

beforeEach(() => {
  localStorage.clear();
  systemReduced = false;
  listeners = new Set();
  vi.stubGlobal("matchMedia", vi.fn(() => ({
    get matches() { return systemReduced; },
    addEventListener: (_event: string, listener: () => void) => listeners.add(listener),
    removeEventListener: (_event: string, listener: () => void) => listeners.delete(listener),
  })));
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("Tarot reduced motion", () => {
  it.each([
    [false, false, false],
    [true, false, true],
    [false, true, true],
    [true, true, true],
  ])("combines app=%s and system=%s into %s", (app, system, expected) => {
    setHintPreference("reduceMotion", app);
    systemReduced = system;
    const { result } = renderHook(useTarotReducedMotion);
    expect(result.current).toBe(expected);
  });

  it("responds to live system and Hint settings changes and removes its listener", () => {
    const { result, unmount } = renderHook(useTarotReducedMotion);
    expect(result.current).toBe(false);
    act(() => {
      systemReduced = true;
      listeners.forEach((listener) => listener());
    });
    expect(result.current).toBe(true);
    act(() => {
      systemReduced = false;
      listeners.forEach((listener) => listener());
    });
    expect(result.current).toBe(false);
    act(() => { setHintPreference("reduceMotion", true); });
    expect(result.current).toBe(true);
    unmount();
    expect(listeners.size).toBe(0);
  });
});
