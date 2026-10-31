import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useMotionValue } from "framer-motion";
import { useMotionPolicy } from "../../lib/motionPolicy";
import { useHintGuideEnabled, useHintGuideFrames } from "./HintGuide";

export function useDailyDelivery({ open, fresh, preparing, identity, cardBack }: {
  open: boolean; fresh: boolean; preparing: boolean; identity: string; cardBack: string;
}) {
  const enabled = useHintGuideEnabled();
  const { reduced, pageVisible } = useMotionPolicy();
  const target = useRef<HTMLDivElement>(null);
  const [completed, setCompleted] = useState<string | null>(null);
  const [started, setStarted] = useState<string | null>(null);
  const [arrived, setArrived] = useState<string | null>(null);
  const [delivered, setDelivered] = useState<string | null>(null);
  const handoff = useMotionValue(0);
  const presentation = enabled && fresh;
  const active = open && presentation && !reduced && completed !== identity;
  useEffect(() => { if (!open) { setCompleted(null);setStarted(null);setArrived(null);setDelivered(null); } }, [open]);
  useLayoutEffect(() => { handoff.set(active ? 0 : 1); }, [active, identity, handoff]);
  useHintGuideFrames(frame => {
    if (active && frame.delivery?.key === identity && frame.delivery.phase !== "loading") setStarted(identity);
    if (active && frame.delivery?.key === identity) {
      const progress = Math.max(0, Math.min(1, frame.delivery.handoff ?? 0));
      handoff.set(progress);
      if (progress > 0) setArrived(identity);
      if (frame.delivery.phase === "ready" && progress === 1 && !frame.fallback) setDelivered(identity);
    }
    if (active && (frame.fallback || frame.delivery?.key === identity && frame.delivery.phase === "ready")) setCompleted(identity);
  });
  // A broken or stalled asset must never leave a receipt behind an empty panel.
  useEffect(() => {
    if (!active || preparing || !pageVisible || started === identity) return;
    const timer = window.setTimeout(() => setCompleted(identity), 12000);
    return () => window.clearTimeout(timer);
  }, [active, preparing, pageVisible, identity, started]);
  return { active, presentation, target, handoff, materialVisible: !active || arrived === identity, delivered: delivered === identity, skip: () => setCompleted(identity),
    slot: open && presentation && !preparing ? { key: identity, cardBack, target, done: !active } : undefined };
}
