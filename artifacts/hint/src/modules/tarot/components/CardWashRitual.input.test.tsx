// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { CardWashRitual } from "./CardWashRitual";
import { triggerHaptic } from "../../../lib/feedback";
const policy = vi.hoisted(() => ({ visible: true }));
vi.mock("../../../lib/motionPolicy", async importOriginal => ({ ...await importOriginal<typeof import("../../../lib/motionPolicy")>(), useMotionPolicy: () => ({ reduced: false, pageVisible: policy.visible }) }));
vi.mock("../../../lib/i18n", async importOriginal => ({ ...await importOriginal<typeof import("../../../lib/i18n")>(), useLanguage: () => ({ language: "en", t: (key: string) => key }) }));
vi.mock("../../../lib/feedback", () => ({ triggerHaptic: vi.fn() }));
vi.mock("../logic/useTarotReducedMotion", () => ({ useTarotReducedMotion: () => false }));
beforeEach(() => {
  policy.visible = true;
  vi.stubGlobal("PointerEvent", class extends MouseEvent { pointerId: number; constructor(name: string, init: PointerEventInit = {}) { super(name, init); this.pointerId = init.pointerId ?? 1; } });
  HTMLElement.prototype.setPointerCapture = vi.fn(); HTMLElement.prototype.releasePointerCapture = vi.fn(); HTMLElement.prototype.hasPointerCapture = () => false;
});

it.each(["auto", "hidden", "gathering"] as const)("discards the old pointer across %s and requires a fresh touch", phase => {
  const wash = vi.fn(), release = vi.fn(), cancel = vi.fn();
  const props = { ritualCards: [], onBeginWash: vi.fn(), onWash: wash, onWashRelease: release, onWashCancel: cancel };
  const view = render(<CardWashRitual {...props} stage="washing" />);
  const table = screen.getByTestId("tarot-wash-table");
  vi.spyOn(table, "getBoundingClientRect").mockReturnValue({ left: 0, top: 0, width: 400, height: 400 } as DOMRect);
  fireEvent.pointerDown(table, { pointerId: 1, clientX: 310, clientY: 200 });
  fireEvent.pointerMove(table, { pointerId: 1, clientX: 260, clientY: 100 });
  if (phase === "hidden") policy.visible = false;
  view.rerender(<CardWashRitual {...props} stage={phase === "gathering" ? "gathering" : "washing"} autoWashing={phase === "auto"} />);
  wash.mockClear(); release.mockClear(); cancel.mockClear(); vi.mocked(triggerHaptic).mockClear();
  fireEvent.pointerMove(table, { pointerId: 1, clientX: 280, clientY: 120 });
  fireEvent.pointerUp(table, { pointerId: 1, clientX: 280, clientY: 120 });
  fireEvent.pointerDown(table, { pointerId: 3, clientX: 280, clientY: 120 });
  fireEvent.pointerMove(table, { pointerId: 3, clientX: 240, clientY: 160 });
  fireEvent.pointerUp(table, { pointerId: 3, clientX: 240, clientY: 160 });
  fireEvent.keyDown(table, { key: "ArrowRight" });
  fireEvent.keyDown(table, { key: "Enter" });
  expect({ wash: wash.mock.calls.length, release: release.mock.calls.length, cancel: cancel.mock.calls.length, haptics: vi.mocked(triggerHaptic).mock.calls.length })
    .toEqual({ wash: 0, release: 0, cancel: 0, haptics: 0 });
  policy.visible = true;
  view.rerender(<CardWashRitual {...props} stage="washing" autoWashing={false} />);
  fireEvent.pointerMove(table, { pointerId: 1, clientX: 300, clientY: 140 });
  expect(wash).not.toHaveBeenCalled();
  fireEvent.pointerDown(table, { pointerId: 2, clientX: 300, clientY: 140 });
  fireEvent.pointerMove(table, { pointerId: 2, clientX: 250, clientY: 100 });
  fireEvent.pointerUp(table, { pointerId: 2, clientX: 250, clientY: 100 });
  expect(wash).toHaveBeenCalled();
  expect(release).toHaveBeenCalledTimes(1);
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
