// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { CardWashRitual } from "./CardWashRitual";
vi.mock("../../../lib/i18n", async importOriginal => ({ ...await importOriginal<typeof import("../../../lib/i18n")>(), useLanguage: () => ({ language: "en", t: (key: string) => key }) }));
vi.mock("../../../lib/feedback", () => ({ triggerHaptic: vi.fn() }));
vi.mock("../logic/useTarotReducedMotion", () => ({ useTarotReducedMotion: () => false }));
beforeEach(() => {
  vi.stubGlobal("PointerEvent", class extends MouseEvent { pointerId: number; constructor(name: string, init: PointerEventInit = {}) { super(name, init); this.pointerId = init.pointerId ?? 1; } });
  HTMLElement.prototype.setPointerCapture = vi.fn(); HTMLElement.prototype.releasePointerCapture = vi.fn(); HTMLElement.prototype.hasPointerCapture = () => false;
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });
it("keeps clockwise guidance and motion when a hand briefly reverses", () => {
  const wash = vi.fn();
  render(<CardWashRitual stage="washing" ritualCards={[]} onBeginWash={() => {}} onWash={wash} onWashRelease={() => {}} />);
  const table = screen.getByTestId("tarot-wash-table");
  vi.spyOn(table, "getBoundingClientRect").mockReturnValue({ left: 0, top: 0, width: 400, height: 400 } as DOMRect);
  fireEvent.pointerDown(table, { pointerId: 1, clientX: 310, clientY: 200 });
  fireEvent.pointerMove(table, { pointerId: 1, clientX: 260, clientY: 100 });
  fireEvent.pointerMove(table, { pointerId: 1, clientX: 310, clientY: 200 });
  expect(wash.mock.calls.every(([pointer]) => pointer.spinDirection === 1)).toBe(true);
});
it("keeps a second finger from taking over or completing the active wash", () => {
  const wash = vi.fn(), release = vi.fn();
  render(<CardWashRitual stage="washing" ritualCards={[]} onBeginWash={() => {}} onWash={wash} onWashRelease={release} />);
  const table = screen.getByTestId("tarot-wash-table");
  vi.spyOn(table, "getBoundingClientRect").mockReturnValue({ left: 0, top: 0, width: 400, height: 400 } as DOMRect);
  fireEvent.pointerDown(table, { pointerId: 1, clientX: 310, clientY: 200 });
  const calls = wash.mock.calls.length;
  fireEvent.pointerDown(table, { pointerId: 2, clientX: 100, clientY: 100 });
  fireEvent.pointerMove(table, { pointerId: 2, clientX: 150, clientY: 200 });
  fireEvent.pointerUp(table, { pointerId: 2, clientX: 150, clientY: 200 });
  expect(wash).toHaveBeenCalledTimes(calls);
  expect(release).not.toHaveBeenCalled();
});
