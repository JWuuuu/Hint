// @vitest-environment jsdom
import { createElement, forwardRef, useImperativeHandle, type ReactNode } from "react";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { TarotRoomFlow } from "./TarotRoomFlow";
import { MotionPolicyProvider } from "../../../lib/motionPolicy";
import { LanguageProvider } from "../../../lib/i18n";
import { saveActiveTarotSession } from "../logic/activeTarotSession";
const mock = vi.hoisted(() => ({ listeners: new Set<(active: boolean) => void>(), paintCards: vi.fn() }));
vi.mock("../../../lib/mobile/appLifecycle", () => ({
  addNativeAppStateListener: vi.fn(async callback => { mock.listeners.add(callback); return async () => { mock.listeners.delete(callback); }; }),
}));
vi.mock("./CardWashRitual", () => ({
  CardWashRitual: forwardRef(({ onBeginWash }: { onBeginWash: () => void }, ref) => {
    useImperativeHandle(ref, () => ({ paintCards: mock.paintCards }));
    return createElement("button", { onClick: onBeginWash }, "Begin manual wash");
  }),
}));
vi.mock("framer-motion", async importOriginal => {
  const actual = await importOriginal<Record<string, unknown>>();
  const React = await import("react");
  const cache = new Map();
  return { ...actual, MotionConfig: ({ children }: { children: ReactNode }) => children, AnimatePresence: ({ children }: { children: ReactNode }) => children,
    motion: new Proxy({}, { get: (_, tag: string) => {
      if (!cache.has(tag)) cache.set(tag, React.forwardRef((props: Record<string, unknown>, ref) => React.createElement(tag, {
        ref, className: props.className, "data-testid": props["data-testid"],
      }, props.children as ReactNode)));
      return cache.get(tag);
    } }),
  };
});
let sequence = 0;
let frames = new Map<number, FrameRequestCallback>();
beforeEach(() => {
  localStorage.clear(); sessionStorage.clear(); frames = new Map(); sequence = 0; mock.listeners.clear(); mock.paintCards.mockClear();
  window.history.replaceState({}, "", "/app/tarot?hintPreview=embedded");
  Object.defineProperty(document, "visibilityState", { configurable: true, get: () => "visible" });
  localStorage.setItem("hint.preferences.v1", JSON.stringify({ reduceMotion: false, soundAndHaptics: false }));
  vi.stubGlobal("matchMedia", (media: string) => ({ media, matches: false, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {} }));
  vi.stubGlobal("ResizeObserver", class { observe() {} unobserve() {} disconnect() {} });
  vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => { const id = ++sequence; frames.set(id, callback); return id; });
  vi.stubGlobal("cancelAnimationFrame", (id: number) => { frames.delete(id); });
  HTMLElement.prototype.scrollTo = vi.fn(); HTMLElement.prototype.scrollIntoView = vi.fn(); window.scrollTo = vi.fn();
  // Every unexpected network attempt is rejected; the tested ritual needs no API.
  vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("ISOLATED_NO_NETWORK")));
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });
it("stops manual table-current work on native background and recovers one loop after resume", async () => {
  saveActiveTarotSession({ phase: "prepare", question: "Fictional isolated motion check", spreadId: "three", focusLabel: "Clear signal", design: {
    id: "rose", label: "Rose Veil", mood: "Fixture", deckStyleId: "rose", backStyle: "rose", cardBackId: "01_Final_Eight_Set/02_Moon_Tide_Lavender_Gold.png", cardArtId: "hint-classic", backgroundId: "stars", background: "#ffffff", glow: "#ffffff",
  }, selectedCards: [], revealedIds: [] });
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  const page = render(<QueryClientProvider client={client}><LanguageProvider><MotionPolicyProvider><TarotRoomFlow /></MotionPolicyProvider></LanguageProvider></QueryClientProvider>);
  const button = await screen.findByRole("button", { name: "Begin manual wash" }, { timeout: 4000 });
  fireEvent.click(button);
  let now = performance.now();
  const flush = () => { now = Math.max(now, performance.now()) + 32; const pending = [...frames.values()]; frames.clear(); for (const callback of pending) callback(now); };
  act(flush);
  const beforeBackground = { paints: mock.paintCards.mock.calls.length, pendingRaf: frames.size };
  expect(beforeBackground.paints).toBeGreaterThan(0);
  await act(async () => { mock.listeners.forEach(callback => callback(false)); });
  expect(document.visibilityState).toBe("visible");
  expect(document.documentElement.dataset.hintMotionPaused).toBe("true");
  expect(screen.getByRole("button", { name: "Begin manual wash" })).toBeTruthy();
  act(() => { for (let index = 0; index < 8; index++) flush(); });
  const afterBackground = { paints: mock.paintCards.mock.calls.length, pendingRaf: frames.size };
  expect(afterBackground.paints).toBe(beforeBackground.paints);
  expect(afterBackground.pendingRaf).toBe(0);

  // Existing recovery behavior remains: resume returns to Prepare, then a new
  // manual wash starts one fresh loop without retaining the interrupted one.
  await act(async () => { mock.listeners.forEach(callback => callback(true)); });
  expect(document.documentElement.dataset.hintMotionPaused).toBe("false");
  expect(screen.getByRole("heading", { name: "Hold your question in your mind." })).toBeTruthy();
  expect(frames.size).toBe(0);
  fireEvent.click(await screen.findByRole("button", { name: "Begin manual wash" }, { timeout: 4000 }));
  act(flush);
  expect(mock.paintCards.mock.calls.length).toBe(beforeBackground.paints + 1);
  expect(frames.size).toBe(1);

  page.unmount(); client.clear();
  expect(frames.size).toBe(0);
  expect(mock.listeners.size).toBe(0);
  expect(fetch).not.toHaveBeenCalled();
});
