// @vitest-environment jsdom
import { createElement, forwardRef, useImperativeHandle, type ReactNode } from "react";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { TarotRoomFlow } from "./TarotRoomFlow";
import { MotionPolicyProvider } from "../../../lib/motionPolicy";
import { LanguageProvider } from "../../../lib/i18n";
import { saveActiveTarotSession } from "../logic/activeTarotSession";
import type { WashPointer } from "../logic/washPhysics";
import type { RitualCard } from "../types/ritual.types";
import { getAnonId } from "../../../lib/identity";
const mock = vi.hoisted(() => ({ listeners: new Set<(active: boolean) => void>(), paintCards: vi.fn(), wash: (_pointer: WashPointer) => {} }));
vi.mock("../../../lib/mobile/appLifecycle", () => ({
  addNativeAppStateListener: vi.fn(async callback => { mock.listeners.add(callback); return async () => { mock.listeners.delete(callback); }; }),
}));
vi.mock("./CardWashRitual", () => ({
  CardWashRitual: forwardRef(({ onBeginWash, onWash }: { onBeginWash: () => void; onWash: (pointer: WashPointer) => void }, ref) => {
    mock.wash = onWash;
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

it.each([
  { name: "120 Hz", callbacks: Array.from({ length: 96 }, (_, i) => (i + 1) * 1000 / 120) },
  { name: "60 Hz", callbacks: Array.from({ length: 48 }, (_, i) => (i + 1) * 1000 / 60) },
  { name: "30 Hz", callbacks: Array.from({ length: 24 }, (_, i) => (i + 1) * 1000 / 30) },
  { name: "15 Hz", callbacks: Array.from({ length: 12 }, (_, i) => (i + 1) * 1000 / 15) },
  { name: "10 Hz", callbacks: Array.from({ length: 8 }, (_, i) => (i + 1) * 100) },
  { name: "5 Hz", callbacks: [200, 400, 600, 800] },
  { name: "irregular callbacks", callbacks: [33, 160, 177, 310, 500, 515, 640, 800] },
  { name: "a delayed callback", callbacks: [500, 800] },
])("settles the held manual wash in wall time with $name", async ({ callbacks }) => {
  saveActiveTarotSession({ phase: "prepare", question: "Fictional settling check", spreadId: "three", focusLabel: "Clear signal", design: {
    id: "sea", label: "Sea", mood: "Fixture", deckStyleId: "rose", backStyle: "rose", cardBackId: "01_Final_Eight_Set/02_Moon_Tide_Lavender_Gold.png", cardArtId: "hint-classic", backgroundId: "sea", background: "#ffffff", glow: "#ffffff",
  }, selectedCards: [], revealedIds: [] });
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  const page = render(<QueryClientProvider client={client}><LanguageProvider><MotionPolicyProvider><TarotRoomFlow /></MotionPolicyProvider></LanguageProvider></QueryClientProvider>);
  const button = await screen.findByRole("button", { name: "Begin manual wash" }, { timeout: 4000 });
  let now = performance.now();
  vi.spyOn(performance, "now").mockImplementation(() => now);
  const flush = (at: number) => {
    now = at;
    const pending = [...frames.values()];
    frames.clear();
    act(() => pending.forEach(callback => callback(now)));
  };
  const latest = () => mock.paintCards.mock.calls.at(-1)![0] as RitualCard[];
  fireEvent.click(button);
  // Drive the real manual effect with one clockwise hand circle, then hold.
  // Only frame delivery is mocked; force, damping, queued input and paint data
  // are production code. The browser case's 500/300 ms windows stay intact.
  let previous = { x: 0.77 * 400, y: 0.52 * 400 };
  for (let i = 1; i <= 24; i += 1) {
    const point = { x: (0.5 + Math.cos(i / 24 * Math.PI * 2) * 0.27) * 400,
      y: (0.52 + Math.sin(i / 24 * Math.PI * 2) * 0.25) * 400 };
    act(() => mock.wash({ ...point, movementX: point.x - previous.x, movementY: point.y - previous.y, width: 400, height: 400, spinDirection: 1 }));
    flush(now + 24);
    previous = point;
  }
  const heldAt = now;
  const moving = latest();
  expect(moving).toHaveLength(78);
  expect(moving.some(card => Math.hypot(card.velocityX ?? 0, card.velocityY ?? 0) > 0.1)).toBe(true);
  for (const offset of callbacks.filter(time => time <= 500)) flush(heldAt + offset);
  const resting = latest();
  for (const offset of callbacks.filter(time => time > 500)) flush(heldAt + offset);
  const later = latest();
  for (const { width, height } of [{ width: 440, height: 956 }, { width: 375, height: 667 }]) {
    const distance = Math.max(...later.map((card, i) => Math.hypot(
      (card.x - resting[i]!.x) / 100 * width, (card.y - resting[i]!.y) / 100 * height,
    )));
    expect(distance).toBeLessThan(0.5);
  }
  expect(later.map(card => [card.visualId, card.cardId, card.orientation])).toEqual(moving.map(card => [card.visualId, card.cardId, card.orientation]));
  expect(later.every(card => !card.revealed && !card.selected)).toBe(true);
  // Once the hand moves again, fresh input still moves the resting cards.
  act(() => mock.wash({ x: 300, y: 210, movementX: 0, movementY: 16, width: 400, height: 400, spinDirection: 1 }));
  flush(now + 24);
  expect(latest().some((card, i) => Math.hypot(card.x - later[i]!.x, card.y - later[i]!.y) > 0.1)).toBe(true);
  page.unmount(); client.clear();
  expect(frames.size).toBe(0);
  expect(fetch).not.toHaveBeenCalled();
});
let sequence = 0;
let frames = new Map<number, FrameRequestCallback>();
beforeEach(() => {
  localStorage.clear(); sessionStorage.clear(); frames = new Map(); sequence = 0; mock.listeners.clear(); mock.paintCards.mockClear();
  localStorage.setItem("hint_anon_id", getAnonId());
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
