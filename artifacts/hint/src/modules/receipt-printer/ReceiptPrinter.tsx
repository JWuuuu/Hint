import { useEffect, useLayoutEffect, useRef, useState, type AnimationEvent, type CSSProperties, type ReactNode } from "react";
import { motion, useAnimationControls } from "framer-motion";
import { useMotionPolicy } from "../../lib/motionPolicy";
import { useLanguage } from "../../lib/i18n";
import { receiptText } from "./receiptStrings";
import "./receipt-printer.css";
import { ReceiptPaperRoll } from "./ReceiptPaperRoll";
import { RECEIPT_LEADER_RATIO } from "./dailyReceiptArtwork";

type Phase = "idle" | "warming" | "printing" | "complete";
export type ReceiptPrinterProps = { children: ReactNode; theme?: "bright" | "dark"; started?: boolean; onStart?: () => void; skip?: boolean; variant?: "classic" | "daily" | "tarot"; onPrintComplete?: () => void; disabled?: boolean };
/** Reference-matched printer artwork and paper geometry, driven by a live receipt. */
export function ReceiptPrinter({ children, theme = "dark", started = false, onStart, skip = false, variant = "classic", onPrintComplete, disabled = false }: ReceiptPrinterProps) {
  const physicalPaper = variant !== "classic";
  const { reduced, pageVisible } = useMotionPolicy();
  const { language } = useLanguage();
  const [animationPhase, setPhase] = useState<Phase>("warming");
  const phase: Phase = !started ? "idle" : reduced || skip ? "complete" : animationPhase;
  const [height, setHeight] = useState(0);
  const [surface, setSurface] = useState<"loading" | "preview" | "ready" | "fallback">(physicalPaper ? "loading" : "fallback");
  const [invitationReady, setInvitationReady] = useState(!physicalPaper);
  const result = useRef<HTMLElement>(null);
  const root = useRef<HTMLElement>(null);
  const tapMotion = useAnimationControls();
  const paperMotion = useAnimationControls();
  const [tapImpulse, setTapImpulse] = useState(0);
  const completed = useRef(false);
  const callback = useRef(onPrintComplete);
  callback.current = onPrintComplete;
  function tapMachine() {
    if (reduced || !pageVisible || disabled) return;
    tapMotion.stop();
    tapMotion.set({ rotate: 0, y: 0 });
    void tapMotion.start({
      rotate: [0, -.28, .2, -.08, 0],
      y: [0, .55, -.2, .1, 0],
      transition: { duration: .32, ease: "easeOut" },
    });
    setTapImpulse(value => value + 1);
    // The canvas bends the illustrated sheet itself; this is only the HTML fallback.
    if (surface === "fallback") {
      paperMotion.stop();
      paperMotion.set({ rotateX: 0, skewX: 0 });
      void paperMotion.start({
        rotateX: [0, -2.6, 1.5, -.7, .25, 0],
        skewX: [0, .8, -.5, .24, -.08, 0],
        transition: { delay: .07, duration: 1.35, ease: "easeInOut" },
      });
    }
  }
  useEffect(() => {
    if (reduced || !pageVisible) {
      tapMotion.stop();
      tapMotion.set({ rotate: 0, y: 0 });
      paperMotion.stop();
      paperMotion.set({ rotateX: 0, skewX: 0 });
    }
    return () => { tapMotion.stop(); paperMotion.stop(); };
  }, [reduced, pageVisible, tapMotion, paperMotion]);
  useLayoutEffect(() => {
    const element = result.current;
    if (!element) return;
    const viewport = root.current?.closest<HTMLElement>(".receipt-share-scroll");
    const measure = () => {
      // Daily fits the viewport. Tarot keeps a readable width and scrolls vertically.
      if (physicalPaper && variant !== "tarot" && viewport && root.current && element.offsetHeight > 0) {
        const viewBox = element.querySelector("svg")?.getAttribute("viewBox")?.split(/[\s,]+/).map(Number);
        if (viewBox?.length === 4 && viewBox[2] > 0 && viewBox[3] > 0) {
          const padding = getComputedStyle(viewport);
          const sheetRatio = viewBox[3] / viewBox[2] * 952 / 1434;
          const available = viewport.clientHeight - parseFloat(padding.paddingTop) - parseFloat(padding.paddingBottom);
          const fittedWidth = Math.floor((available - 28) / (790 / 1434 + sheetRatio));
          if (fittedWidth > 0) root.current.style.setProperty("--receipt-fitted-width", `${fittedWidth}px`);
        }
      }
      // Retain the roll geometry if the scene is temporarily hidden.
      if (element.offsetHeight > 0) setHeight(element.offsetHeight);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    if (viewport) observer.observe(viewport);
    return () => observer.disconnect();
  }, [variant, physicalPaper]);
  // Print the short invitation first; feed the rest only after the user's tap.
  // Shared by Daily and Tarot, including the canvas and CSS fallback feeds.
  const duration = Math.round(Math.min(10100, Math.max(4400, Math.ceil(height / 59 * 1000))) * 0.8);
  useEffect(() => {
    if (reduced || skip) return;
    if (!pageVisible || phase === "idle" || phase === "complete" || !height || surface === "loading" || surface === "preview") return;
    // The flexible sheet owns completion, including its brief settling motion.
    if (surface === "ready" && phase === "printing") return;
    // The timer is a fallback for interrupted/unsupported CSS animations.
    const timer = window.setTimeout(() => setPhase(phase === "warming" ? "printing" : "complete"), phase === "warming" ? 280 : duration + 150);
    return () => window.clearTimeout(timer);
  }, [phase, reduced, skip, pageVisible, duration, height, surface]);
  useEffect(() => {
    if (phase === "complete" && !completed.current) { completed.current = true; callback.current?.(); }
  }, [phase]);
  function feedEnd(event: AnimationEvent<HTMLElement>) {
    if (phase === "printing" && event.target === event.currentTarget && event.animationName === "receipt-roll-feed") setPhase("complete");
  }
  return <section ref={root} className={`receipt-printer receipt-printer--share${physicalPaper ? " receipt-printer--illustrated" : ""}`} data-variant={variant} data-phase={phase} data-surface={surface} data-intro={!invitationReady} data-paused={!pageVisible} data-reduced={reduced} aria-label={receiptText(language, "title")} style={{
    "--receipt-result-height": `${height}px`, "--receipt-print-duration": `${duration}ms`, "--receipt-feed-start": `calc(var(--receipt-roll-width) * ${RECEIPT_LEADER_RATIO})`,
  } as CSSProperties}>
    <div className="receipt-printer__interaction">
      <motion.div className="receipt-printer__machine-layer receipt-printer__machine-layer--back" animate={tapMotion}><div className="receipt-printer__reference-frame">
      <img className="receipt-printer__reference-image" src={`/receipt-printer/hint-printer-${theme === "bright" ? "blush-soft-base" : "midnight"}.png`} alt="" draggable={false} />
      <span className="receipt-printer__lower-reflection" aria-hidden />
      <button type="button" className="receipt-printer__tap-zone" aria-label={receiptText(language, "machineTouch")} disabled={disabled || !invitationReady || (phase !== "idle" && phase !== "complete")} onClick={tapMachine} />
      <span className="receipt-printer__slot-frame" aria-hidden />
      </div></motion.div>
      <motion.div className="receipt-printer__paper-window" animate={paperMotion}>
        {physicalPaper && <ReceiptPaperRoll source={result} theme={theme} height={height} duration={duration} phase={phase} paused={!pageVisible} reduced={reduced} tapImpulse={tapImpulse} onReady={value => { setSurface(value); if (value === "fallback") setInvitationReady(true); }} onInvitationReady={() => setInvitationReady(true)} onComplete={() => setPhase("complete")} />}
        <article className="receipt-printer__paper" onAnimationEnd={feedEnd}>
          <section ref={result} className="receipt-printer__result-content" aria-hidden={phase !== "complete"}>{children}</section>
          <span className="receipt-printer__tear-edge" aria-hidden />
        </article>
        <span className="receipt-printer__slot-shadow" aria-hidden />
        <button type="button" className="receipt-printer__invitation" aria-label={receiptText(language, "reveal")} aria-hidden={phase !== "idle"} tabIndex={phase === "idle" ? 0 : -1} disabled={disabled || !invitationReady || phase !== "idle"} onClick={onStart}>
          <span className="receipt-printer__invitation-label"><span className="receipt-printer__invitation-star" aria-hidden>✧</span><span>tap to reveal</span><span className="receipt-printer__invitation-star" aria-hidden>✧</span></span>
          <span className="receipt-printer__invitation-arrow" aria-hidden />
        </button>
      </motion.div>
      <motion.div className="receipt-printer__machine-layer receipt-printer__machine-layer--front" animate={tapMotion}><div className="receipt-printer__reference-frame">
      <span className="receipt-printer__slot-occluder" aria-hidden />
      <span className="receipt-printer__surface-sheen" aria-hidden />
      <button type="button" className="receipt-printer__print-button" aria-label={receiptText(language, phase === "idle" ? "machineStart" : "machineButton")} title={receiptText(language, phase === "idle" ? "machineStart" : "machineButton")} disabled={disabled || !invitationReady || (phase === "idle" ? !onStart : phase !== "complete")} onClick={phase === "idle" ? onStart : tapMachine}>
        <span className="receipt-printer__button-cap" aria-hidden />
      </button>
      </div></motion.div>
    </div>
  </section>;
}
