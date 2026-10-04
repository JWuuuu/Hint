import { useEffect, useLayoutEffect, useRef, useState, type PointerEvent, type ReactNode } from "react";
import { animate, motion, useMotionValue, useTransform } from "framer-motion";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useTarotReducedMotion } from "../logic/useTarotReducedMotion";
import { useMotionPolicy } from "../../../lib/motionPolicy";

type Swipe = {
  x: number;
  y: number;
  pointerId: number;
  axis: "undecided" | "horizontal" | "vertical";
};

export function SpreadPreviewCarousel({
  index,
  count,
  spreadId,
  spreadLabel,
  currentLabel,
  previousLabel,
  nextLabel,
  onSelect,
  children,
}: {
  index: number;
  count: number;
  spreadId: string;
  spreadLabel: string;
  currentLabel: string;
  previousLabel: string;
  nextLabel: string;
  onSelect: (index: number) => void;
  children: ReactNode;
}) {
  const reduceMotion = useTarotReducedMotion();
  const { pageVisible } = useMotionPolicy();
  const swipe = useRef<Swipe | null>(null);
  const selectedIndex = useRef(index);
  const dragOffset = useMotionValue(0);
  const position = useMotionValue(index);
  const trackX = useTransform(position, value => `${-value * 100}%`);
  const lastIndex = useRef(index);
  const [moving, setMoving] = useState(false);
  const visited = useRef(new Map<number, { spreadId: string; children: ReactNode }>());
  selectedIndex.current = index;

  // Preserve the committed diagram beside the incoming one. A single track can
  // reverse or retarget while moving without stacking exits or emptying the stage.
  useLayoutEffect(() => {
    visited.current.set(index, { spreadId, children });
  }, [index, spreadId, children]);

  useLayoutEffect(() => {
    const jump = Math.abs(index - lastIndex.current) > 1;
    lastIndex.current = index;
    if (reduceMotion || !pageVisible || jump || position.get() === index) {
      position.stop();
      position.set(index);
      setMoving(false);
      if (!pageVisible || reduceMotion) {
        swipe.current = null;
        dragOffset.stop();
        dragOffset.set(0);
      }
      return;
    }
    let active = true;
    setMoving(true);
    const movement = animate(position, index, { duration: 0.29, ease: [0.22, 0.72, 0.2, 1] });
    void movement.then(() => { if (active) setMoving(false); });
    return () => { active = false; movement.stop(); };
  }, [index, reduceMotion, pageVisible, position, dragOffset]);

  useEffect(() => () => { dragOffset.stop(); position.stop(); }, [dragOffset, position]);

  function select(delta: number) {
    const next = Math.max(0, Math.min(count - 1, selectedIndex.current + delta));
    if (next === selectedIndex.current) return;
    selectedIndex.current = next;
    swipe.current = null;
    onSelect(next);
  }

  function lockAxis(start: Swipe, x: number, y: number) {
    if (start.axis !== "undecided") return;
    const dx = Math.abs(x - start.x);
    const dy = Math.abs(y - start.y);
    if (Math.max(dx, dy) < 8) return;
    if (dy >= dx) start.axis = "vertical";
    else if (dx > dy * 1.25) start.axis = "horizontal";
  }

  function finishSwipe(event: PointerEvent<HTMLDivElement>, cancelled = false) {
    const start = swipe.current;
    if (!start || start.pointerId !== event.pointerId) return;
    // Clear first: releasing capture also emits lostpointercapture.
    swipe.current = null;
    if (event.currentTarget.hasPointerCapture?.(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    animate(dragOffset, 0, { duration: reduceMotion ? 0 : 0.18, ease: "easeOut" });
    lockAxis(start, event.clientX, event.clientY);
    const delta = event.clientX - start.x;
    if (cancelled || start.axis !== "horizontal" || Math.abs(delta) < 34 || Math.abs(delta) <= Math.abs(event.clientY - start.y)) return;
    select(delta > 0 ? -1 : 1);
  }

  return (
    <>
      <div
        className="tarot-spread-stage"
        data-testid="spread-preview-stage"
        data-spread-motion={moving ? "moving" : "idle"}
        role="group"
        aria-label={currentLabel}
        aria-keyshortcuts="ArrowLeft ArrowRight"
        tabIndex={0}
        onKeyDown={(event) => {
          if (event.target !== event.currentTarget || event.altKey || event.ctrlKey || event.metaKey) return;
          if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
          event.preventDefault();
          select(event.key === "ArrowLeft" ? -1 : 1);
        }}
        onPointerDown={(event) => {
          if (!event.isPrimary || event.button !== 0 || (event.target as HTMLElement).closest("button")) return;
          dragOffset.stop();
          swipe.current = { x: event.clientX, y: event.clientY, pointerId: event.pointerId, axis: "undecided" };
        }}
        onPointerMove={(event) => {
          const start = swipe.current;
          if (!start || start.pointerId !== event.pointerId) return;
          if (event.buttons === 0) { finishSwipe(event, true); return; }
          lockAxis(start, event.clientX, event.clientY);
          if (start.axis !== "horizontal") return;
          try { event.currentTarget.setPointerCapture?.(event.pointerId); }
          catch { /* Pointer cancellation can race a WebView capture request. */ }
          dragOffset.set(reduceMotion ? 0 : Math.max(-18, Math.min(18, (event.clientX - start.x) * 0.18)));
        }}
        onPointerUp={event => finishSwipe(event)}
        onPointerCancel={event => finishSwipe(event, true)}
        onLostPointerCapture={event => finishSwipe(event, true)}
        onPointerLeave={event => {
          if (!event.currentTarget.hasPointerCapture?.(event.pointerId)) finishSwipe(event, true);
        }}
      >
        <button
          type="button"
          onClick={() => select(-1)}
          disabled={index === 0}
          aria-label={previousLabel}
          className="tarot-spread-arrow tarot-spread-arrow-previous"
        >
          <ChevronLeft size={28} strokeWidth={1.5} aria-hidden="true" />
        </button>
        <div className="tarot-spread-diagram">
          <motion.div className="tarot-spread-drag-layer" style={{ x: dragOffset }}>
            <motion.div className="tarot-spread-track" style={{ x: trackX }}>
              {moving && [...visited.current.entries()].filter(([slot]) => slot !== index).map(([slot, previous]) => (
                <div
                  key={previous.spreadId}
                  className="tarot-spread-slide"
                  data-spread-retained={previous.spreadId}
                  aria-hidden="true"
                  inert
                  style={{ left: `${slot * 100}%` }}
                >
                  {previous.children}
                </div>
              ))}
              <div key={spreadId} className="tarot-spread-slide" data-spread-preview={spreadId} style={{ left: `${index * 100}%`, opacity: 1 }}>
                {children}
              </div>
            </motion.div>
          </motion.div>
        </div>
        <button
          type="button"
          onClick={() => select(1)}
          disabled={index === count - 1}
          aria-label={nextLabel}
          className="tarot-spread-arrow tarot-spread-arrow-next"
        >
          <ChevronRight size={28} strokeWidth={1.5} aria-hidden="true" />
        </button>
      </div>
      <div className="tarot-spread-navigation">
        <span className="sr-only" aria-live="polite" aria-atomic="true">{spreadLabel}</span>
        <span className="tarot-spread-count" aria-hidden="true">
          <span>{String(index + 1).padStart(2, "0")}</span>
          <span>/</span>
          {String(count).padStart(2, "0")}
        </span>
      </div>
    </>
  );
}
