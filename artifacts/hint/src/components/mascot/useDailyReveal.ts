import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { cubicBezier, useMotionValue } from "framer-motion";
import { useMotionPolicy } from "../../lib/motionPolicy";
import { useHintGuidePlayback } from "./HintGuide";

type Phase = "waiting" | "turning" | "ready";
const turnEase = cubicBezier(0.18, 0.9, 0.2, 1);
const TURN_MS = 860;

// The transform and completion share visible time. Backgrounding or pausing a
// review therefore freezes the actual card, not just its completion callback.
export function useDailyReveal({ open, preparing, fresh, identity, delivered = false, onRevealed, onFlip }: {
  open: boolean; preparing: boolean; fresh: boolean; identity: string; delivered?: boolean;
  onRevealed: () => void; onFlip: () => void;
}) {
  const { reduced, pageVisible } = useMotionPolicy();
  const { speed, paused } = useHintGuidePlayback();
  const key = `${identity}:${open}:${fresh}`;
  const initialPhase: Phase = fresh ? "waiting" : "ready";
  const [state, setState] = useState<{ key: string; phase: Phase }>({ key, phase: initialPhase });
  const phase = state.key === key ? state.phase : initialPhase;
  const rotation = useMotionValue(fresh ? 0 : 180);
  const callbacks = useRef({ onRevealed, onFlip });
  callbacks.current = { onRevealed, onFlip };
  const announced = useRef(false);
  const flipStarted = useRef(false);
  const clock = useRef({ key: "", elapsed: 0 });

  useLayoutEffect(() => {
    announced.current = false;
    flipStarted.current = false;
    clock.current.key = "";rotation.set(fresh ? 0 : 180);
    setState({ key, phase: initialPhase });
  }, [key, initialPhase, fresh, rotation]);

  useEffect(() => {
    if (!open || preparing) return;
    if (reduced || !fresh || phase === "ready") {
      rotation.set(180);
      if (phase !== "ready") setState({ key, phase: "ready" });
      return;
    }
    const clockKey = `${key}:${phase}`;
    if (clock.current.key !== clockKey) clock.current = { key: clockKey, elapsed: 0 };
    if (!pageVisible || paused) return;
    const duration = phase === "waiting" ? delivered ? 0 : 620 : TURN_MS;
    const finish = () => {
      if (phase === "waiting" && !flipStarted.current) {
        flipStarted.current = true;
        callbacks.current.onFlip();
      }
      setState({ key, phase: phase === "waiting" ? "turning" : "ready" });
    };
    if (duration === 0) { finish();return; }
    let previous = performance.now(), frame = 0;
    const tick = (now: number) => {
      // Match the mascot's bound on a dropped frame; never jump through a turn.
      clock.current.elapsed += Math.min(Math.max(0, now - previous), 100) * speed;previous = now;
      if (phase === "turning") rotation.set(180 * turnEase(Math.min(1, clock.current.elapsed / duration)));
      if (clock.current.elapsed >= duration) finish();else frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [open, preparing, fresh, key, phase, reduced, pageVisible, delivered, speed, paused, rotation]);

  useEffect(() => {
    if (!open || preparing || phase !== "ready" || announced.current) return;
    announced.current = true;
    if (fresh) callbacks.current.onRevealed();
  }, [open, preparing, phase, fresh]);

  return {
    rotation,
    flipped: !preparing && (phase !== "waiting" || reduced || !fresh),
    detailsReady: !preparing && (phase === "ready" || reduced || !fresh),
    flip() {
      if (!open || preparing || phase !== "waiting" || !pageVisible || paused || flipStarted.current) return;
      flipStarted.current = true;
      if (!reduced) callbacks.current.onFlip();
      setState({ key, phase: reduced ? "ready" : "turning" });
    },
  };
}
