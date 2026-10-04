/** @vitest-environment jsdom */
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { MotionPolicyProvider } from "./motionPolicy";
import { motion } from "./quietMotion";
import { setHintPreference } from "./preferences";
import { addNativeAppStateListener } from "./mobile/appLifecycle";

let nativeChanged: (active: boolean) => void;
const nativeRemove = vi.fn(async () => {});
vi.mock("./mobile/appLifecycle", () => ({ addNativeAppStateListener: vi.fn((callback: (active: boolean) => void) => {
  nativeChanged = callback;
  return Promise.resolve(nativeRemove);
}) }));

vi.mock("framer-motion", async () => {
  const React = await import("react");
  const cache = new Map();
  return {
    MotionConfig: ({ children }: { children: React.ReactNode }) => children,
    motion: new Proxy({}, { get: (_, tag: string) => {
      if (!cache.has(tag)) cache.set(tag, React.forwardRef((props: Record<string, unknown>, ref) => React.createElement(tag, {
        ref, "data-testid": "effect", "data-target": JSON.stringify(props.animate), "data-transition": JSON.stringify(props.transition),
      })));
      return cache.get(tag);
    } }),
  };
});
let systemReduced = false;
let systemListeners = new Set<() => void>();
let intersect: (entries: { isIntersecting: boolean }[]) => void;
let disconnect = vi.fn();
beforeEach(() => {
  nativeRemove.mockClear();
  localStorage.clear(); systemReduced = false; systemListeners = new Set(); disconnect = vi.fn();
  vi.stubGlobal("matchMedia", () => ({ get matches() { return systemReduced; },
    addEventListener: (_: string, cb: () => void) => systemListeners.add(cb),
    removeEventListener: (_: string, cb: () => void) => systemListeners.delete(cb),
  }));
  vi.stubGlobal("IntersectionObserver", class { constructor(cb: typeof intersect) { intersect = cb; } observe() {} disconnect() { disconnect(); } });
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });
function Effect() { return <MotionPolicyProvider><motion.div animate={{ y: [0, -3, 0], opacity: [0.5, 1, 0.5] }} transition={{ duration: 5, repeat: Infinity }} /></MotionPolicyProvider>; }
it.each([[false, false, false], [true, false, true], [false, true, true], [true, true, true]])(
  "settles JavaScript effects with app=%s system=%s", (app, system, quiet) => {
    setHintPreference("reduceMotion", app); systemReduced = system;
    render(<Effect />);
    const target = JSON.parse(screen.getByTestId("effect").getAttribute("data-target")!);
    expect(Array.isArray(target.y)).toBe(!quiet);
    expect(document.documentElement.dataset.hintReduceMotion).toBe(String(quiet));
    if (quiet) expect(JSON.parse(screen.getByTestId("effect").getAttribute("data-transition")!).repeat).toBe(0);
  },
);
it("stops hidden and offscreen repeated effects and resumes only when visible", () => {
  const { unmount } = render(<Effect />);
  act(() => intersect([{ isIntersecting: false }]));
  expect(JSON.parse(screen.getByTestId("effect").getAttribute("data-target")!).y).toBe(0);
  act(() => intersect([{ isIntersecting: true }]));
  expect(JSON.parse(screen.getByTestId("effect").getAttribute("data-target")!).y).toEqual([0, -3, 0]);
  const visibility = vi.spyOn(document, "visibilityState", "get").mockReturnValue("hidden");
  fireEvent(document, new Event("visibilitychange"));
  expect(document.documentElement.dataset.hintMotionPaused).toBe("true");
  expect(JSON.parse(screen.getByTestId("effect").getAttribute("data-target")!).y).toBe(0);
  visibility.mockReturnValue("visible"); fireEvent(document, new Event("visibilitychange"));
  expect(JSON.parse(screen.getByTestId("effect").getAttribute("data-target")!).y).toEqual([0, -3, 0]);
  unmount(); expect(systemListeners.size).toBe(0); expect(disconnect).toHaveBeenCalledOnce();
});
it("responds to live system changes without waiting for a route remount", () => {
  render(<Effect />);
  act(() => { systemReduced = true; systemListeners.forEach(cb => cb()); });
  expect(JSON.parse(screen.getByTestId("effect").getAttribute("data-target")!).y).toBe(0);
});
it("pauses on native background events even while the document stays visible", async () => {
  const { unmount } = render(<Effect />);
  await act(async () => {});
  act(() => nativeChanged(false));
  expect(document.visibilityState).not.toBe("hidden");
  expect(document.documentElement.dataset.hintMotionPaused).toBe("true");
  expect(JSON.parse(screen.getByTestId("effect").getAttribute("data-target")!).y).toBe(0);
  act(() => nativeChanged(true));
  expect(document.documentElement.dataset.hintMotionPaused).toBe("false");
  unmount(); expect(nativeRemove).toHaveBeenCalledOnce();
});
it("removes a native listener whose registration finishes after unmount", async () => {
  let finish!: (remove: () => Promise<void>) => void;
  vi.mocked(addNativeAppStateListener).mockReturnValueOnce(new Promise(resolve => { finish = resolve; }));
  const remove = vi.fn(async () => {});
  const { unmount } = render(<Effect />);
  unmount();
  await act(async () => finish(remove));
  expect(remove).toHaveBeenCalledOnce();
});
