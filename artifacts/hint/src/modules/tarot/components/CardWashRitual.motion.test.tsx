// @vitest-environment jsdom
import type { ReactNode } from "react";
import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { CardWashRitual } from "./CardWashRitual";
import { MotionPolicyProvider } from "../../../lib/motionPolicy";

const lifecycle = vi.hoisted(() => ({ changed: (_active: boolean) => {}, remove: vi.fn(async () => {}) }));
vi.mock("../../../lib/mobile/appLifecycle", () => ({ addNativeAppStateListener: vi.fn(async callback => {
  lifecycle.changed = callback;
  return lifecycle.remove;
}) }));
vi.mock("../../../lib/i18n", async importOriginal => ({ ...await importOriginal<typeof import("../../../lib/i18n")>(), useLanguage: () => ({ language: "en", t: (key: string) => key }) }));
vi.mock("framer-motion", async () => {
  const React = await import("react");
  const components = new Map();
  return {
    MotionConfig: ({ children }: { children: ReactNode }) => children,
    motion: new Proxy({}, { get: (_, tag: string) => {
      if (!components.has(tag)) components.set(tag, React.forwardRef((props: Record<string, unknown>, ref) => {
        const transition = props.transition as { repeat?: number } | undefined;
        return React.createElement(tag, { ref, "data-testid": "wash-motion", "data-repeat": String(transition?.repeat ?? 0) }, props.children as ReactNode);
      }));
      return components.get(tag);
    } }),
  };
});
beforeEach(() => {
  localStorage.clear();
  lifecycle.remove.mockClear();
  vi.stubGlobal("matchMedia", () => ({ matches: false, addEventListener() {}, removeEventListener() {} }));
  Object.defineProperty(document, "visibilityState", { configurable: true, get: () => "visible" });
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

it("keeps the retired room background pulse stopped across native app transitions", async () => {
  const { unmount } = render(<MotionPolicyProvider><CardWashRitual stage="washing" ritualCards={[]} onBeginWash={() => {}} onWash={() => {}} onWashRelease={() => {}} /></MotionPolicyProvider>);
  await act(async () => {});
  expect(screen.getAllByTestId("wash-motion").every(el => el.getAttribute("data-repeat") === "0")).toBe(true);
  act(() => lifecycle.changed(false));
  expect(document.visibilityState).toBe("visible");
  expect(document.documentElement.dataset.hintMotionPaused).toBe("true");
  expect(screen.getAllByTestId("wash-motion").every(el => el.getAttribute("data-repeat") === "0")).toBe(true);
  act(() => lifecycle.changed(true));
  expect(document.documentElement.dataset.hintMotionPaused).toBe("false");
  expect(screen.getAllByTestId("wash-motion").every(el => el.getAttribute("data-repeat") === "0")).toBe(true);
  unmount();
  expect(lifecycle.remove).toHaveBeenCalledOnce();
});
