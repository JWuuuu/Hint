/** @vitest-environment jsdom */
import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { useHintTyping } from "./useHintTyping";
import { companionRoom } from "./RoomCompanion";
afterEach(() => { cleanup(); vi.useRealTimers(); });
it("settles a typing gesture on pause and does not animate an untouched saved draft", () => {
  vi.useFakeTimers();
  const view = renderHook(({ value }) => useHintTyping(value), { initialProps: { value: "Saved thought" } });
  expect(view.result.current).toBe(false);
  view.rerender({ value: "Saved thought, continued" }); expect(view.result.current).toBe(true);
  act(() => vi.advanceTimersByTime(1500)); expect(view.result.current).toBe(true);
  view.rerender({ value: "Saved thought, continued now" });
  act(() => vi.advanceTimersByTime(1800)); expect(view.result.current).toBe(false);
});
it("provides companion rooms for supported pages and leaves login and legal screens alone", () => {
  expect(companionRoom("/app/astrology/chart?tab=now")).toBe("astrology");
  expect(companionRoom("/app/profile")).toBe("settings");
  expect(companionRoom("/app/readings/saved")).toBe("history");
  expect(companionRoom("/app/login")).toBeUndefined();
  expect(companionRoom("/privacy")).toBeUndefined();
});
