/** @vitest-environment jsdom */
import { createElement, forwardRef, useImperativeHandle, type ReactNode } from "react";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { TarotRoomFlow } from "./TarotRoomFlow";
import { MotionPolicyProvider } from "../../../lib/motionPolicy";
import { LanguageProvider } from "../../../lib/i18n";
import { saveActiveTarotSession } from "../logic/activeTarotSession";
import { getAnonId } from "../../../lib/identity";

const mock = vi.hoisted(() => ({
  haptic: vi.fn(),
  cutCompletions: new Set<() => void>(),
  washGestures: [] as Array<() => void>,
  nativeListeners: new Set<(active: boolean) => void>(),
  riffleCompletions: new Set<() => void>(),
}));
vi.mock("../../../lib/feedback", async importOriginal => ({
  ...await importOriginal<Record<string, unknown>>(),
  triggerHaptic: mock.haptic,
}));
vi.mock("../../../lib/mobile/appLifecycle", () => ({
  addNativeAppStateListener: vi.fn(async callback => {
    mock.nativeListeners.add(callback);
    return async () => { mock.nativeListeners.delete(callback); };
  }),
}));
vi.mock("./CardWashRitual", async importOriginal => ({
  ...await importOriginal<Record<string, unknown>>(),
  CardWashRitual: forwardRef((props: {
    stage: string;
    children?: ReactNode;
    onBeginWash: () => void;
    onWashRelease: () => void;
    onWashCancel?: () => void;
    onCardsSettled?: () => void;
  }, ref) => {
    useImperativeHandle(ref, () => ({ paintCards: vi.fn(), getHeaderHeight: () => 142.5 }));
    if (props.stage === "cutting") return props.children;
    mock.washGestures = [props.onBeginWash, props.onWashRelease, props.onWashCancel, props.onCardsSettled].filter(
      (callback): callback is () => void => Boolean(callback),
    );
    return createElement("button", { onClick: props.onWashRelease }, "Finish fixture wash");
  }),
}));
vi.mock("framer-motion", async importOriginal => {
  const actual = await importOriginal<Record<string, unknown>>();
  const React = await import("react");
  const cache = new Map();
  return {
    ...actual,
    // Explicitly retain completion closures after their owner unmounts. This
    // represents a late renderer/gesture delivery, not animation performance.
    AnimatePresence: ({ children }: { children: ReactNode }) => children,
    motion: new Proxy({}, { get: (_, tag: string) => {
      if (!cache.has(tag)) cache.set(tag, React.forwardRef((props: Record<string, unknown>, ref) => {
        if (props["data-cut-packet"] === "C") mock.cutCompletions.add(props.onAnimationComplete as () => void);
        if (props["data-shuffle-card"] === 77) mock.riffleCompletions.add(props.onAnimationComplete as () => void);
        return React.createElement(tag, { ref, "data-testid": props["data-shuffle-card"] !== undefined ? "riffle-card" : props["data-testid"] }, props.children as ReactNode);
      }));
      return cache.get(tag);
    } }),
  };
});

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  localStorage.setItem("hint_anon_id", getAnonId());
  mock.haptic.mockClear();
  mock.cutCompletions.clear();
  mock.washGestures = [];
  mock.nativeListeners.clear();
  mock.riffleCompletions.clear();
  window.history.replaceState({}, "", "/app/tarot?hintPreview=embedded");
  Object.defineProperty(document, "visibilityState", { configurable: true, value: "visible" });
  vi.stubGlobal("matchMedia", (media: string) => ({ media, matches: false, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {} }));
  vi.stubGlobal("ResizeObserver", class { observe() {} unobserve() {} disconnect() {} });
  HTMLElement.prototype.scrollTo = vi.fn();
  HTMLElement.prototype.scrollIntoView = vi.fn();
  window.scrollTo = vi.fn();
  vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("ISOLATED_NO_NETWORK")));
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

function openRitual(reduced: boolean) {
  localStorage.setItem("hint.preferences.v1", JSON.stringify({ reduceMotion: reduced, soundAndHaptics: true }));
  saveActiveTarotSession({
    phase: "prepare", question: "Fictional callback check", spreadId: "three", focusLabel: "Clear signal",
    design: {
      id: "sea", label: "Sea", mood: "Fixture", deckStyleId: "rose", backStyle: "rose",
      cardBackId: "01_Final_Eight_Set/02_Moon_Tide_Lavender_Gold.png", cardArtId: "hint-classic",
      backgroundId: "sea", background: "#fff", glow: "#fff",
    }, selectedCards: [], revealedIds: [],
  });
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(<QueryClientProvider client={client}><LanguageProvider><MotionPolicyProvider><TarotRoomFlow /></MotionPolicyProvider></LanguageProvider></QueryClientProvider>);
}

it.each([false, true])("rejects canceled wash gestures without late feedback, reduced=%s", async reduced => {
  openRitual(reduced);
  await screen.findByRole("button", { name: "Finish fixture wash" }, { timeout: 4000 });
  const abandoned = [...mock.washGestures];
  fireEvent.click(screen.getByRole("button", { name: /^Back$/ }));
  expect(screen.getByRole("button", { name: "Begin the ritual" })).toBeTruthy();
  mock.haptic.mockClear();
  // Setup may read the fictional profile. Late gestures must add no request.
  const requestsBeforeLateGesture = vi.mocked(fetch).mock.calls.length;
  act(() => abandoned.forEach(callback => callback()));
  expect(mock.haptic).not.toHaveBeenCalled();
  expect(screen.getByRole("button", { name: "Begin the ritual" })).toBeTruthy();
  expect(fetch).toHaveBeenCalledTimes(requestsBeforeLateGesture);
}, 10000);

it("disposes the riffle on native inactivity even while the document stays visible", async () => {
  const page = openRitual(false);
  fireEvent.click(await screen.findByRole("button", { name: "Finish fixture wash" }, { timeout: 4000 }));
  expect(await screen.findAllByTestId("riffle-card", {}, { timeout: 4000 })).toHaveLength(78);
  const abandoned = [...mock.riffleCompletions];
  expect(abandoned.length).toBeGreaterThan(0);
  await act(async () => { mock.nativeListeners.forEach(callback => callback(false)); });
  expect(document.visibilityState).toBe("visible");
  expect(screen.queryAllByTestId("riffle-card")).toHaveLength(0);
  mock.haptic.mockClear();
  act(() => abandoned.forEach(callback => callback()));
  expect(mock.haptic).not.toHaveBeenCalled();
  await act(async () => { mock.nativeListeners.forEach(callback => callback(true)); });
  expect(screen.getByRole("heading", { name: "Hold your question in your mind." })).toBeTruthy();
  expect(screen.queryAllByTestId("riffle-card")).toHaveLength(0);
  page.unmount();
  expect(mock.nativeListeners.size).toBe(0);
  expect(fetch).not.toHaveBeenCalled();
}, 10000);

it.each([
  { reduced: false, leave: false }, { reduced: true, leave: false },
  { reduced: false, leave: true }, { reduced: true, leave: true },
])("rejects late cut animation feedback after Back/unmount, reduced=$reduced leave=$leave", async ({ reduced, leave }) => {
  const page = openRitual(reduced);
  fireEvent.click(await screen.findByRole("button", { name: "Finish fixture wash" }, { timeout: 4000 }));
  await screen.findByTestId("tarot-cut-table", {}, { timeout: 4000 });
  const abandoned = [...mock.cutCompletions];
  expect(abandoned.length).toBeGreaterThan(0);
  if (leave) page.unmount();
  else fireEvent.click(screen.getByRole("button", { name: /^Back$/ }));
  mock.haptic.mockClear();
  act(() => abandoned.forEach(callback => callback()));
  expect(mock.haptic).not.toHaveBeenCalled();
  expect(screen.queryByTestId("tarot-cut-table")).toBeNull();
  if (!leave) expect(screen.getByRole("button", { name: "Finish fixture wash" })).toBeTruthy();
  expect(fetch).not.toHaveBeenCalled();
}, 10000);
