/** @vitest-environment jsdom */
import { act, cleanup, render } from "@testing-library/react";
import { useRef } from "react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { ReceiptPaperRoll, receiptFeedProgress, receiptPaperProfile, receiptPaperFlutter, receiptFeedFlutter, PAPER_FLUTTER_MS, PAPER_SETTLE_MS, INVITATION_PRINT_MS } from "./ReceiptPaperRoll";

let frames: Map<number, FrameRequestCallback>;
let frameId: number;
let time: number;
beforeEach(() => {
  frames = new Map(); frameId = 0; time = 0;
  vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
    frames.set(++frameId, callback); return frameId;
  });
  vi.stubGlobal("cancelAnimationFrame", (id: number) => frames.delete(id));
  vi.stubGlobal("ResizeObserver", class { observe() {} disconnect() {} });
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

function advance(milliseconds: number) {
  act(() => {
    for (let step = 0; step < milliseconds; step += 20) {
      time += 20;
      const next = [...frames.values()]; frames.clear();
      next.forEach(callback => callback(time));
    }
  });
}
function fixture() {
  return { source: { current: null }, height: 380, duration: 4400, phase: "printing" as const,
    paused: false, onReady: vi.fn(), onComplete: vi.fn() };
}

it("finds artwork in a later sibling and shows its torn outline before a slow card loads", async () => {
  const outline = "M2 -2H98V178L90 197L82 178L74 197L2 178Z";
  const contexts = { setTransform: vi.fn(), clearRect: vi.fn(), drawImage: vi.fn(), fill: vi.fn(), stroke: vi.fn(), fillRect: vi.fn(), fillText: vi.fn(), beginPath: vi.fn(), moveTo: vi.fn(), lineTo: vi.fn(), save: vi.fn(), restore: vi.fn(), createLinearGradient: () => ({ addColorStop: vi.fn() }) };
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(contexts as unknown as CanvasRenderingContext2D);
  vi.stubGlobal("Path2D", class { constructor(public path: string) {} });
  // Deliberately leave the card undecoded: the blank paper leader must not wait for it.
  vi.stubGlobal("Image", class { onload = null; onerror = null; src = ""; });
  const props = { ...fixture(), phase: "idle" as const, height: 200 };
  function PrinterWithLaterArtwork() {
    const source = useRef<HTMLElement>(null);
    return <><ReceiptPaperRoll {...props} source={source} /><section ref={source} style={{ width: 100 }}><svg width="100" height="200"><path d={outline} fill="#fffaf5" stroke="#efbac7" strokeWidth="2"/><g><image href="/slow-card.png"/></g></svg></section></>;
  }
  render(<PrinterWithLaterArtwork />);
  await act(async () => {});
  expect(props.onReady).toHaveBeenCalledWith("preview");
  expect(props.onReady).not.toHaveBeenCalledWith("ready");
  expect(contexts.fill).toHaveBeenCalledWith(expect.objectContaining({ path: outline }));
  expect(contexts.drawImage).toHaveBeenCalled();
  advance(INVITATION_PRINT_MS);
  expect(contexts.fillText).not.toHaveBeenCalledWith("tap to reveal", expect.any(Number), expect.any(Number));
  expect(props.onComplete).not.toHaveBeenCalled();
});

it("shows only the paper leader while the export is pending, without finishing the receipt", () => {
  const props = { ...fixture(), phase: "idle" as const, onInvitationReady: vi.fn() };
  const view = render(<ReceiptPaperRoll {...props} />);
  advance(400); expect(props.onInvitationReady).not.toHaveBeenCalled();
  view.rerender(<ReceiptPaperRoll {...props} paused />);
  advance(5000); expect(props.onInvitationReady).not.toHaveBeenCalled();
  expect(frames.size).toBe(0);
  view.rerender(<ReceiptPaperRoll {...props} />);
  advance(INVITATION_PRINT_MS);
  expect(props.onInvitationReady).toHaveBeenCalledOnce();
  expect(props.onComplete).not.toHaveBeenCalled();
  expect(frames.size).toBe(0);
  advance(10000); expect(props.onComplete).not.toHaveBeenCalled();
});

it("shows the paper leader immediately with reduced motion without completing a pending export", () => {
  const props = { ...fixture(), phase: "idle" as const, reduced: true, onInvitationReady: vi.fn() };
  render(<ReceiptPaperRoll {...props} />);
  expect(props.onInvitationReady).toHaveBeenCalledOnce();
  expect(props.onComplete).not.toHaveBeenCalled();
  expect(frames.size).toBe(0);
});

it("feeds continuously with no repeated stops or speed jumps through the middle", () => {
  const positions = Array.from({ length: 1001 }, (_, index) => receiptFeedProgress(index / 1000));
  expect(positions[0]).toBe(0); expect(positions.at(-1)).toBe(1);
  positions.forEach((position, index) => {
    expect(position).toBeGreaterThanOrEqual(positions[Math.max(0, index - 1)]);
    expect(position).toBeLessThanOrEqual(1);
    if (index > 0) expect(position).toBeGreaterThan(positions[index - 1]);
    if (index > 50 && index < 950) {
      const advance = position - positions[index - 1];
      expect(advance).toBeGreaterThan(.001);
      expect(advance).toBeLessThan(.0011);
    }
  });
  expect(receiptFeedProgress(-1)).toBe(0);
  expect(receiptFeedProgress(2)).toBe(1);
});

it("keeps the sheet pinned at the slot and never stretches or folds through itself", () => {
  for (const length of [0, 2, 24, 80, 380]) {
    for (const tension of [0, 1]) {
      const points = receiptPaperProfile(length, tension);
      expect(points[0].y).toBe(0);
      expect(points.at(-1)!.distance).toBe(length);
      for (let index = 1; index < points.length; index++) {
        const travel = points[index].distance - points[index - 1].distance;
        const projectedTravel = points[index].y - points[index - 1].y;
        expect(projectedTravel).toBeGreaterThan(0);
        expect(projectedTravel).toBeLessThanOrEqual(travel);
      }
    }
  }
  const resting = receiptPaperProfile(380, 0);
  const feeding = receiptPaperProfile(380, 1);
  expect(resting[150].y).toBe(feeding[150].y);
  expect(Math.abs(resting.at(-1)!.y - feeding.at(-1)!.y)).toBeLessThan(2);
});

it("finishes once after the feed and settling, then stops rendering", () => {
  const props = fixture(); render(<ReceiptPaperRoll {...props} />);
  advance(4500); expect(props.onComplete).not.toHaveBeenCalled();
  advance(900); expect(props.onComplete).toHaveBeenCalledOnce();
  expect(frames.size).toBe(0);
  advance(5000); expect(props.onComplete).toHaveBeenCalledOnce();
});

it("keeps feeding steady and lets only the free edge sway once near completion", () => {
  const duration = 4400;
  for (const length of [40, 150, 380]) {
    const resting = receiptPaperProfile(length, 1);
    for (const elapsed of [0, 300, 850, 1800, 3600, duration - 300, duration, duration + 300]) {
      const points = receiptPaperProfile(length, 1, null, { elapsed, duration });
      expect(points.slice(0, 13)).toEqual(resting.slice(0, 13));
      for (let index = 1; index < points.length; index++) {
        const a = points[index - 1], b = points[index];
        expect(b.y).toBeGreaterThan(a.y);
        expect(Math.hypot(b.x - a.x, b.y - a.y)).toBeLessThanOrEqual(b.distance - a.distance + 1e-9);
        expect(Math.abs(b.x)).toBeLessThan(2.7);
      }
    }
    expect(receiptPaperProfile(length, 0, null, { elapsed: duration + PAPER_SETTLE_MS, duration }))
      .toEqual(receiptPaperProfile(length, 0));
  }
  for (const elapsed of [0, 850, 1800, 3600]) {
    expect(receiptFeedFlutter(380, 380, elapsed, duration)).toEqual({ x: 0, bend: 0 });
    expect(receiptPaperProfile(380, 1, null, { elapsed, duration }).every(point => point.x === 0)).toBe(true);
  }
  expect(receiptFeedFlutter(380, 380, duration - 300, duration).x).toBeGreaterThan(1);
  expect(receiptFeedFlutter(380, 380, duration + 150, duration).x).toBeLessThan(0);
  expect(Math.abs(receiptFeedFlutter(80, 380, duration - 300, duration).x)).toBeLessThan(.1);
  expect(receiptFeedFlutter(380, 380, duration + PAPER_SETTLE_MS, duration)).toEqual({ x: 0, bend: 0 });
});

it("gives feeding paper shallow depth without sideways drift or stretching", () => {
  for (const length of [40, 150, 380]) {
    const resting = receiptPaperProfile(length, 1);
    for (const elapsed of [500, 1800, 3200]) {
      const points = receiptPaperProfile(length, 1, null, { elapsed, duration: 4400 });
      expect(points.slice(0, 13)).toEqual(resting.slice(0, 13));
      for (let index = 1; index < points.length; index++) {
        const a = points[index - 1], b = points[index];
        expect(b.x).toBe(0);
        expect(Math.abs(b.tilt)).toBeLessThanOrEqual(.026);
        if (b.distance < length - 58) expect(Math.abs(b.tilt)).toBe(0);
        expect(Math.hypot(b.x - a.x, b.y - a.y, b.depth - a.depth)).toBeCloseTo(b.distance - a.distance, 8);
        expect(Math.abs(b.depth)).toBeLessThan(45);
      }
    }
  }
  const moving = receiptPaperProfile(380, 1, null, { elapsed: 1800, duration: 4400 });
  expect(moving[260].depth).toBeGreaterThan(receiptPaperProfile(380, 1)[260].depth + 5);
  expect(Math.abs(moving.at(-1)!.tilt)).toBeGreaterThan(.01);
  expect(receiptPaperProfile(380, 0, null, { elapsed: 4900, duration: 4400 }).every(point => point.tilt === 0)).toBe(true);
});

it("keeps the mouth pinned while a delayed wave travels to the flexible paper tip", () => {
  expect(receiptPaperFlutter(380, 380, 50).x).toBe(0);
  const tip = receiptPaperFlutter(380, 380, 280).x;
  expect(tip).toBeGreaterThan(3);
  expect(Math.abs(receiptPaperFlutter(100, 380, 280).x)).toBeLessThan(tip / 3);
  expect(receiptPaperFlutter(380, 380, 650).x).toBeLessThan(0);
  expect(receiptPaperFlutter(380, 380, PAPER_FLUTTER_MS)).toEqual({ x: 0, bend: 0 });
  for (const length of [40, 380]) {
    for (const time of [120, 280, 650, 1000, PAPER_FLUTTER_MS]) {
      const points = receiptPaperProfile(length, 0, time);
      const resting = receiptPaperProfile(length, 0);
      expect(points.slice(0, 13)).toEqual(resting.slice(0, 13));
      for (let index = 1; index < points.length; index++) {
        const a = points[index - 1], b = points[index];
        expect(b.y).toBeGreaterThan(a.y);
        expect(Math.hypot(b.x - a.x, b.y - a.y)).toBeLessThanOrEqual(b.distance - a.distance + 1e-9);
        expect(Math.abs(b.x)).toBeLessThan(10);
      }
    }
  }
});

it("flutters a finished receipt without printing again and stops after settling", () => {
  const props = { ...fixture(), phase: "complete" as const };
  const view = render(<ReceiptPaperRoll {...props} />);
  view.rerender(<ReceiptPaperRoll {...props} tapImpulse={1} />);
  expect(frames.size).toBe(1);
  advance(500); expect(frames.size).toBe(1);
  expect(props.onComplete).not.toHaveBeenCalled();
  advance(PAPER_FLUTTER_MS); expect(frames.size).toBe(0);
  expect(props.onComplete).not.toHaveBeenCalled();
});

it("repeated taps restart one bounded flutter and reduced motion or hiding cancels it", () => {
  const props = { ...fixture(), phase: "complete" as const };
  const view = render(<ReceiptPaperRoll {...props} />);
  view.rerender(<ReceiptPaperRoll {...props} tapImpulse={1} />); advance(600);
  view.rerender(<ReceiptPaperRoll {...props} tapImpulse={2} />);
  expect(frames.size).toBe(1);
  advance(1200); expect(frames.size).toBe(1);
  view.rerender(<ReceiptPaperRoll {...props} tapImpulse={2} paused />);
  expect(frames.size).toBe(0);
  view.rerender(<ReceiptPaperRoll {...props} tapImpulse={3} reduced />);
  expect(frames.size).toBe(0);
  view.rerender(<ReceiptPaperRoll {...props} tapImpulse={4} />);
  expect(frames.size).toBe(1);
  view.unmount(); expect(frames.size).toBe(0);
});

it("pauses offscreen without counting hidden time as paper travel", () => {
  const props = fixture(); const view = render(<ReceiptPaperRoll {...props} />);
  advance(2000);
  view.rerender(<ReceiptPaperRoll {...props} paused />);
  expect(frames.size).toBe(0);
  advance(10000); expect(props.onComplete).not.toHaveBeenCalled();
  view.rerender(<ReceiptPaperRoll {...props} />);
  advance(2500); expect(props.onComplete).not.toHaveBeenCalled();
  advance(900); expect(props.onComplete).toHaveBeenCalledOnce();
});

it("keeps real elapsed feed time when the browser drops frames", () => {
  const props = fixture(); render(<ReceiptPaperRoll {...props} />);
  advance(100);
  act(() => {
    const next = [...frames.values()]; frames.clear();
    time += 6000;
    next.forEach(callback => callback(time));
  });
  expect(props.onComplete).toHaveBeenCalledOnce();
  expect(frames.size).toBe(0);
});

it("cancels pending movement on close and skips movement for the completed view", () => {
  const props = fixture(); const view = render(<ReceiptPaperRoll {...props} />);
  advance(500); view.unmount();
  expect(frames.size).toBe(0);
  advance(6000); expect(props.onComplete).not.toHaveBeenCalled();
  render(<ReceiptPaperRoll {...props} phase="complete" />);
  expect(frames.size).toBe(0);
});
