// @vitest-environment jsdom
import { cleanup, render } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { useAskComposerVisibility } from "./useAskComposerVisibility";

let resize: () => void;
const disconnect = vi.fn();
function Fixture() {
  const ref = useAskComposerVisibility();
  return <div ref={ref} data-testid="room"><header>Home</header><div data-testid="composer"><div data-testid="row"><textarea defaultValue="A fictional question" /><button>Send</button></div></div></div>;
}
beforeEach(() => {
  vi.useFakeTimers();
  vi.stubGlobal("requestAnimationFrame", (fn: () => void) => setTimeout(fn, 0));
  vi.stubGlobal("cancelAnimationFrame", clearTimeout);
  vi.stubGlobal("ResizeObserver", class {
    constructor(callback: () => void) { resize = callback; }
    observe() {}
    disconnect = disconnect;
  });
  disconnect.mockClear();
});
afterEach(() => { cleanup(); vi.useRealTimers(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });

function setup() {
  const view = render(<Fixture />);
  const room = view.getByTestId("room"), composer = view.getByTestId("composer"), row = view.getByTestId("row");
  const textarea = view.getByRole("textbox") as HTMLTextAreaElement;
  Object.defineProperty(room, "clientHeight", { configurable: true, value: 340 });
  Object.defineProperty(composer, "offsetHeight", { configurable: true, value: 194 });
  vi.spyOn(room, "getBoundingClientRect").mockReturnValue({ top: 0, bottom: 340 } as DOMRect);
  const composerBox = vi.spyOn(composer, "getBoundingClientRect").mockReturnValue({ top: 244, bottom: 438 } as DOMRect);
  return { ...view, room, composer, row, textarea, composerBox };
}

it("reveals an overflowing focused composer without changing the draft, focus or backward selection", () => {
  const { room, textarea } = setup();
  textarea.focus(); textarea.setSelectionRange(2, 8, "backward");
  resize(); vi.runAllTimers();
  expect(room.scrollTop).toBe(98);
  expect(document.activeElement).toBe(textarea);
  expect([textarea.value, textarea.selectionStart, textarea.selectionEnd, textarea.selectionDirection]).toEqual(["A fictional question", 2, 8, "backward"]);
});

it("does not scroll a visible composer or move the reader after focus leaves the composer", () => {
  const { room, textarea, composerBox } = setup();
  resize(); vi.runAllTimers(); expect(room.scrollTop).toBe(0);
  textarea.focus(); composerBox.mockReturnValue({ top: 146, bottom: 340 } as DOMRect);
  resize(); vi.runAllTimers(); expect(room.scrollTop).toBe(0);
  textarea.blur(); composerBox.mockReturnValue({ top: 244, bottom: 438 } as DOMRect);
  resize(); vi.runAllTimers(); expect(room.scrollTop).toBe(0);
});

it("also keeps a focused composer button visible when a voice notice expands", () => {
  const { room, getByRole } = setup();
  getByRole("button", { name: "Send" }).focus();
  resize(); vi.runAllTimers();
  expect(room.scrollTop).toBe(98);
  expect(document.activeElement).toBe(getByRole("button", { name: "Send" }));
});

it("reveals an active dictation notice even when a pointer-activated button takes no focus", () => {
  const { room, textarea } = setup();
  textarea.readOnly = true;
  resize(); vi.runAllTimers();
  expect(room.scrollTop).toBe(98);
  expect(document.activeElement).not.toBe(textarea);
});

it("keeps the editable row reachable when an expanded notice is taller than the room", () => {
  const { room, textarea, composer, row } = setup();
  Object.defineProperty(composer, "offsetHeight", { value: 500 });
  vi.spyOn(row, "getBoundingClientRect").mockReturnValue({ top: 300, bottom: 466 } as DOMRect);
  textarea.focus(); resize(); vi.runAllTimers();
  expect(room.scrollTop).toBe(126);
});

it("cancels queued work and releases the resize observer on route removal", () => {
  const { room, textarea, unmount } = setup();
  textarea.focus(); resize(); unmount(); vi.runAllTimers();
  expect(room.scrollTop).toBe(0);
  expect(disconnect).toHaveBeenCalledOnce();
});
