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
  const unlock = vi.fn();
  render(<LanguageProvider><MotionPolicyProvider><RareCardUnlock card={card} onUnlock={unlock} /></MotionPolicyProvider></LanguageProvider>);
  fireEvent.click(screen.getByRole("button", { name: "Open today's rare reward for The Sun" }));
  expect(unlock).toHaveBeenCalledExactlyOnceWith("19-sun");
  expect(screen.queryByTestId("rare-card-popout")).toBeNull();
});
it("cancels a normal popout when the preference changes during its animation", () => {
  let frame: FrameRequestCallback = () => {};
  vi.spyOn(window, "requestAnimationFrame").mockImplementation(callback => { frame = callback; return 1; });
  vi.spyOn(window, "cancelAnimationFrame").mockImplementation(() => {});
  const unlock = vi.fn();
  render(<LanguageProvider><MotionPolicyProvider><RareCardUnlock card={card} onUnlock={unlock} /></MotionPolicyProvider></LanguageProvider>);
  const button = screen.getByRole("button", { name: "Open today's rare reward for The Sun" });
  fireEvent.click(button); fireEvent.click(button);
  expect(unlock).toHaveBeenCalledOnce();
  act(() => frame(performance.now()));
  expect(screen.queryByTestId("rare-card-popout")).not.toBeNull();
  act(() => setHintPreference("reduceMotion", true));
  expect(screen.queryByTestId("rare-card-popout")).toBeNull();
});
