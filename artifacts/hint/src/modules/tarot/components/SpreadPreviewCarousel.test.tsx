/** @vitest-environment jsdom */
import { useState } from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SpreadPreviewCarousel } from "./SpreadPreviewCarousel";

const policy = vi.hoisted(() => ({ reduced: false, pageVisible: true }));
vi.mock("../logic/useTarotReducedMotion", () => ({ useTarotReducedMotion: () => policy.reduced }));
vi.mock("../../../lib/motionPolicy", () => ({ useMotionPolicy: () => policy }));

beforeEach(() => {
  policy.reduced = false;
  policy.pageVisible = true;
  vi.stubGlobal("PointerEvent", class extends MouseEvent {
    pointerId: number;
    isPrimary: boolean;
    constructor(type: string, init: PointerEventInit = {}) {
      super(type, init);
      this.pointerId = init.pointerId ?? 1;
      this.isPrimary = init.isPrimary ?? true;
    }
  });
  Object.defineProperties(HTMLElement.prototype, {
    setPointerCapture: { configurable: true, value: vi.fn() },
    hasPointerCapture: { configurable: true, value: () => true },
    releasePointerCapture: { configurable: true, value: vi.fn() },
  });
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

function mount(initialIndex = 1) {
  const onSelect = vi.fn();
  function Example() {
    const [index, setIndex] = useState(initialIndex);
    return <SpreadPreviewCarousel
      index={index} count={9} spreadId={`spread-${index}`} spreadLabel={`Spread ${index + 1}`}
      currentLabel="Current spread" previousLabel="Previous spread" nextLabel="Next spread"
      onSelect={next => { onSelect(next); setIndex(next); }}
    >
      <p data-testid="selected">Spread {index + 1}</p>
    </SpreadPreviewCarousel>;
  }
  const view = render(<Example />);
  return { stage: screen.getByTestId("spread-preview-stage"), onSelect, refresh: () => view.rerender(<Example />) };
}

const selected = () => document.querySelector('[data-spread-preview] [data-testid="selected"]')!;
const point = (clientX: number, clientY: number, extra: PointerEventInit = {}) => ({ clientX, clientY, pointerId: 1, isPrimary: true, button: 0, buttons: 1, ...extra });

describe("Personal spread navigation", () => {
  it("changes exactly once when a completed horizontal swipe releases capture", () => {
    const { stage, onSelect } = mount();
    fireEvent.pointerDown(stage, point(180, 150));
    fireEvent.pointerMove(stage, point(160, 152));
    fireEvent.pointerMove(stage, point(80, 153));
    fireEvent.pointerUp(stage, point(80, 153));
    fireEvent.lostPointerCapture(stage, point(80, 153));
    expect(onSelect.mock.calls).toEqual([[2]]);
    expect(selected().textContent).toBe("Spread 3");
  });

  it("leaves a vertical scroll alone even when the finger later moves sideways", () => {
    const { stage, onSelect } = mount();
    fireEvent.pointerDown(stage, point(180, 150));
    fireEvent.pointerMove(stage, point(177, 170));
    fireEvent.pointerMove(stage, point(80, 176));
    fireEvent.pointerUp(stage, point(80, 176));
    expect(onSelect).not.toHaveBeenCalled();
    expect(stage.setPointerCapture).not.toHaveBeenCalled();
  });

  it("does not finish a predominantly vertical gesture as a horizontal selection", () => {
    const { stage, onSelect } = mount();
    fireEvent.pointerDown(stage, point(180, 150));
    fireEvent.pointerMove(stage, point(166, 152));
    fireEvent.pointerMove(stage, point(130, 250));
    fireEvent.pointerUp(stage, point(130, 250));
    expect(onSelect).not.toHaveBeenCalled();
  });

  it.each(["pointerCancel", "lostPointerCapture"] as const)("does not select after %s", (eventName) => {
    const { stage, onSelect } = mount();
    fireEvent.pointerDown(stage, point(180, 150));
    fireEvent.pointerMove(stage, point(80, 150));
    fireEvent[eventName](stage, point(80, 150));
    fireEvent.pointerUp(stage, point(80, 150));
    expect(onSelect).not.toHaveBeenCalled();
  });

  it("ignores hover, a second pointer, right click and short gestures", () => {
    const { stage, onSelect } = mount();
    fireEvent.pointerMove(stage, point(80, 150));
    fireEvent.pointerUp(stage, point(80, 150));
    for (const extra of [{ isPrimary: false }, { button: 2 }]) {
      fireEvent.pointerDown(stage, point(180, 150, extra));
      fireEvent.pointerMove(stage, point(80, 150, extra));
      fireEvent.pointerUp(stage, point(80, 150, extra));
    }
    fireEvent.pointerDown(stage, point(180, 150));
    fireEvent.pointerUp(stage, point(80, 150, { pointerId: 2 }));
    fireEvent.pointerUp(stage, point(165, 151));
    expect(onSelect).not.toHaveBeenCalled();
  });

  it("makes all nine options reachable from the keyboard and respects both ends", () => {
    const { stage, onSelect } = mount(0);
    expect(screen.getByRole("button", { name: "Previous spread" }).hasAttribute("disabled")).toBe(true);
    fireEvent.keyDown(stage, { key: "ArrowLeft" });
    expect(onSelect).not.toHaveBeenCalled();
    for (let index = 1; index < 9; index++) {
      fireEvent.keyDown(stage, { key: "ArrowRight" });
      expect(selected().textContent).toBe(`Spread ${index + 1}`);
    }
    fireEvent.keyDown(stage, { key: "ArrowRight" });
    expect(onSelect).toHaveBeenCalledTimes(8);
    expect(screen.getByRole("button", { name: "Next spread" }).hasAttribute("disabled")).toBe(true);
    fireEvent.keyDown(stage, { key: "ArrowLeft" });
    expect(selected().textContent).toBe("Spread 8");
  });

  it("keeps button taps distinct from swipes and normal keyboard activation", async () => {
    const user = userEvent.setup();
    const { onSelect } = mount();
    const next = screen.getByRole("button", { name: "Next spread" });
    await user.click(next);
    expect(onSelect.mock.calls).toEqual([[2]]);
    fireEvent.keyDown(next, { key: "ArrowRight" });
    expect(onSelect).toHaveBeenCalledTimes(1);
    await user.keyboard("{Enter}");
    expect(onSelect.mock.calls).toEqual([[2], [3]]);
  });

  it("keeps reduced-motion swipe navigation immediately usable without translating the cards", () => {
    policy.reduced = true;
    const { stage, onSelect } = mount();
    fireEvent.pointerDown(stage, point(180, 150));
    fireEvent.pointerMove(stage, point(80, 150));
    const diagram = stage.querySelector(".tarot-spread-diagram > div") as HTMLElement;
    expect(["", "none"]).toContain(diagram.style.transform);
    fireEvent.pointerUp(stage, point(80, 150));
    expect(onSelect.mock.calls).toEqual([[2]]);
    const selected = stage.querySelector('[data-spread-preview="spread-2"]') as HTMLElement;
    expect(selected.style.opacity).toBe("1");
    expect(["", "none"]).toContain(selected.style.transform);
  });

  it("keeps the outgoing diagram mounted while moving horizontally to the latest selection", async () => {
    const { stage, onSelect } = mount();
    fireEvent.click(screen.getByRole("button", { name: "Next spread" }));
    expect(stage.dataset.spreadMotion).toBe("moving");
    const previous = stage.querySelector('[data-spread-retained="spread-1"]')!;
    expect(previous.textContent).toBe("Spread 2");
    expect(previous.getAttribute("aria-hidden")).toBe("true");
    expect(previous.hasAttribute("inert")).toBe(true);
    expect(selected().textContent).toBe("Spread 3");
    await waitFor(() => expect(stage.dataset.spreadMotion).toBe("idle"));
    expect(onSelect.mock.calls).toEqual([[2]]);
    expect((stage.querySelector(".tarot-spread-track") as HTMLElement).style.transform).toContain("-200%");
  });

  it("retargets rapid taps and reversal without an old completion replacing the current spread", async () => {
    const { stage, onSelect } = mount();
    const next = screen.getByRole("button", { name: "Next spread" });
    fireEvent.click(next);
    fireEvent.click(next);
    fireEvent.click(next);
    fireEvent.click(screen.getByRole("button", { name: "Previous spread" }));
    expect(selected().textContent).toBe("Spread 4");
    expect(stage.querySelectorAll("[data-spread-preview]")).toHaveLength(1);
    await waitFor(() => expect(stage.dataset.spreadMotion).toBe("idle"));
    expect(selected().textContent).toBe("Spread 4");
    expect(onSelect.mock.calls).toEqual([[2], [3], [4], [3]]);
    expect((stage.querySelector(".tarot-spread-track") as HTMLElement).style.transform).toContain("-300%");
  });

  it.each(["reduced", "pageVisible"] as const)("settles an interrupted transition when %s changes", async key => {
    const { stage, refresh } = mount();
    fireEvent.click(screen.getByRole("button", { name: "Next spread" }));
    expect(stage.dataset.spreadMotion).toBe("moving");
    policy[key] = key === "reduced";
    refresh();
    expect(stage.dataset.spreadMotion).toBe("idle");
    await waitFor(() => expect((stage.querySelector(".tarot-spread-track") as HTMLElement).style.transform).toContain("-200%"));
    expect(selected().textContent).toBe("Spread 3");
    policy.reduced = false; policy.pageVisible = true;
    refresh();
    expect(stage.dataset.spreadMotion).toBe("idle");
  });

  it("cancels a pointer released outside before hover can move the cards", () => {
    const { stage, onSelect } = mount();
    fireEvent.pointerDown(stage, point(180, 150));
    fireEvent.pointerMove(stage, point(80, 150, { buttons: 0 }));
    fireEvent.pointerUp(stage, point(80, 150, { buttons: 0 }));
    expect(onSelect).not.toHaveBeenCalled();
  });
});
