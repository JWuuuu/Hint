/** @vitest-environment jsdom */
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { RareCardUnlock } from "./RareCardUnlock";
import { MotionPolicyProvider } from "../../lib/motionPolicy";
import { LanguageProvider } from "../../lib/i18n";
import { setHintPreference } from "../../lib/preferences";
import type { CollectionCard } from "../../shared/tarot/cardCollection";
const card: CollectionCard = { cardId: "19-sun", name: "The Sun", unlocked: false, sources: [], count: 0, image: "/fixture.png", rare: true };
beforeEach(() => {
  localStorage.clear();
  vi.stubGlobal("matchMedia", () => ({ matches: false, addEventListener() {}, removeEventListener() {} }));
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });
it("reduces the decorative wait without postponing the actual unlock", () => {
  setHintPreference("reduceMotion", true);
  const unlock = vi.fn(() => true);
  render(<LanguageProvider><MotionPolicyProvider><RareCardUnlock card={card} canUnlock onUnlock={unlock} /></MotionPolicyProvider></LanguageProvider>);
  fireEvent.click(screen.getByRole("button", { name: "Open today's rare reward for The Sun" }));
  expect(unlock).toHaveBeenCalledExactlyOnceWith("19-sun");
  expect(screen.queryByTestId("rare-card-popout")).toBeNull();
});
it("cancels a normal popout when the preference changes during its animation", () => {
  let frame: FrameRequestCallback = () => {};
  vi.spyOn(window, "requestAnimationFrame").mockImplementation(callback => { frame = callback; return 1; });
  vi.spyOn(window, "cancelAnimationFrame").mockImplementation(() => {});
  const unlock = vi.fn(() => true);
  render(<LanguageProvider><MotionPolicyProvider><RareCardUnlock card={card} canUnlock onUnlock={unlock} /></MotionPolicyProvider></LanguageProvider>);
  const button = screen.getByRole("button", { name: "Open today's rare reward for The Sun" });
  fireEvent.click(button); fireEvent.click(button);
  expect(unlock).toHaveBeenCalledOnce();
  act(() => frame(performance.now()));
  expect(screen.queryByTestId("rare-card-popout")).not.toBeNull();
  act(() => setHintPreference("reduceMotion", true));
  expect(screen.queryByTestId("rare-card-popout")).toBeNull();
});
it("does not reveal or animate when the business action rejects the card", () => {
  const unlock = vi.fn(() => false);
  render(<LanguageProvider><MotionPolicyProvider><RareCardUnlock card={card} canUnlock onUnlock={unlock} /></MotionPolicyProvider></LanguageProvider>);
  fireEvent.click(screen.getByRole("button"));
  expect(unlock).toHaveBeenCalledOnce();
  expect(screen.getByRole("button").textContent).toContain("Open today's");
  expect(document.querySelector(".rare-unlock-stage.is-saved, .rare-unlock-stage.is-unlocking")).toBeNull();
  expect(screen.queryByTestId("rare-card-popout")).toBeNull();
});
it("consumes an ineligible automatic activation without reviving it when ready", () => {
  const unlock = vi.fn(() => true);
  const view = (ready: boolean) => <LanguageProvider><MotionPolicyProvider><RareCardUnlock card={card} canUnlock={ready} autoUnlockKey={1} onUnlock={unlock} /></MotionPolicyProvider></LanguageProvider>;
  const { rerender } = render(view(false));
  expect(screen.getByRole("button").hasAttribute("disabled")).toBe(true);
  rerender(view(true));
  expect(unlock).not.toHaveBeenCalled();
  expect(screen.queryByTestId("rare-card-popout")).toBeNull();
});
it("reduced-motion rapid input accepts once and keeps accepted replay local", () => {
  setHintPreference("reduceMotion", true);
  const unlock = vi.fn(() => true);
  render(<LanguageProvider><MotionPolicyProvider><RareCardUnlock card={card} canUnlock onUnlock={unlock} /></MotionPolicyProvider></LanguageProvider>);
  const button = screen.getByRole("button");
  fireEvent.click(button); fireEvent.click(button); fireEvent.click(button);
  expect(unlock).toHaveBeenCalledOnce();
  expect(button.textContent).toContain("Replay");
});
