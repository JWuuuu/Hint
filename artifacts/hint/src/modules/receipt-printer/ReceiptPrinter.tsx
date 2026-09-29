import { useEffect, useLayoutEffect, useRef, useState, type AnimationEvent, type CSSProperties, type ReactNode } from "react";
import { useMotionPolicy } from "../../lib/motionPolicy";
import { useLanguage } from "../../lib/i18n";
import { receiptText } from "./receiptStrings";
import "./receipt-printer.css";

type Phase = "warming" | "printing" | "complete";
export type ReceiptPrinterProps = { children: ReactNode; skip?: boolean; onPrintComplete?: () => void };
/** Tiantian's printer artwork and paper geometry, driven by a real receipt. */
export function ReceiptPrinter({ children, skip = false, onPrintComplete }: ReceiptPrinterProps) {
  const { reduced, pageVisible } = useMotionPolicy();
  const { language } = useLanguage();
  const [animationPhase, setPhase] = useState<Phase>("warming");
  const phase = reduced || skip ? "complete" : animationPhase;
  const [height, setHeight] = useState(0);
  const result = useRef<HTMLElement>(null);
  const completed = useRef(false);
  const callback = useRef(onPrintComplete);
  callback.current = onPrintComplete;
  useLayoutEffect(() => {
    const element = result.current;
    if (!element) return;
    const measure = () => setHeight(element.offsetHeight);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  const duration = Math.min(5000, Math.max(1600, Math.ceil(height / 105 * 1000)));
  useEffect(() => {
    if (reduced || skip) return;
    if (!pageVisible || phase === "complete") return;
    // The timer is a fallback for interrupted/unsupported CSS animations.
    const timer = window.setTimeout(() => setPhase(phase === "warming" ? "printing" : "complete"), phase === "warming" ? 280 : duration + 150);
    return () => window.clearTimeout(timer);
  }, [phase, reduced, skip, pageVisible, duration]);
  useEffect(() => {
    if (phase === "complete" && !completed.current) { completed.current = true; callback.current?.(); }
  }, [phase]);
  function feedEnd(event: AnimationEvent<HTMLElement>) {
    if (phase === "printing" && event.target === event.currentTarget && event.animationName === "receipt-result-feed") setPhase("complete");
  }
  return <section className="receipt-printer receipt-printer--share" data-phase={phase} data-paused={!pageVisible} data-reduced={reduced} aria-label={receiptText(language, "title")} style={{
    "--receipt-result-height": `${height}px`, "--receipt-print-duration": `${duration}ms`, "--receipt-print-steps": Math.max(1, height),
  } as CSSProperties}>
    <div className="receipt-printer__interaction"><div className="receipt-printer__reference-frame">
      <img className="receipt-printer__reference-image" src="/receipt-printer/hint-printer-machine.png" alt="" draggable={false} />
      <span className="receipt-printer__slot-frame" aria-hidden />
      <div className="receipt-printer__paper-window">
        <article className="receipt-printer__paper" onAnimationEnd={feedEnd}>
          <section ref={result} className="receipt-printer__result-content" aria-hidden={phase !== "complete"}>{children}</section>
          <span className="receipt-printer__tear-edge" aria-hidden />
        </article>
        <span className="receipt-printer__slot-shadow" aria-hidden />
      </div>
      <span className="receipt-printer__slot-occluder" aria-hidden />
      <span className="receipt-printer__power-light" aria-hidden />
    </div></div>
  </section>;
}
