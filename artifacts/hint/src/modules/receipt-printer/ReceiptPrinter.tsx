import { useEffect, useRef, useState, type AnimationEvent, type CSSProperties, type MutableRefObject, type PointerEvent } from "react";
import { getTarotCardImage } from "../tarot/logic/cardImageMap";
import "./receipt-printer.css";

type ReceiptPrinterPhase =
  | "intro-ready"
  | "intro-printing"
  | "idle"
  | "warming"
  | "printing"
  | "complete";

export type ReceiptPrinterData = {
  title: string;
  label: string;
  cardLabel: string;
  cardName: string;
  cardImage?: string;
  cardMessage: string;
  overallLuck: number;
  scores: Array<{
    label: string;
    value: number;
  }>;
  luckyColor: string;
  luckyNumber: number;
  footer: string;
};

export type ReceiptPrinterProps = {
  resultData?: ReceiptPrinterData;
  isPrinting?: boolean;
  resetSignal?: number;
  onPullToReveal?: () => void;
  onPrintComplete?: () => void;
  className?: string;
};

const DEFAULT_RECEIPT_DATA: ReceiptPrinterData = {
  title: "HINT",
  label: "DAILY RECEIPT",
  cardLabel: "TODAY'S CARD",
  cardName: "WHEEL OF FORTUNE",
  cardImage: getTarotCardImage("10-wheel", "hint-classic") ?? undefined,
  cardMessage: "Embrace today's turning point.",
  overallLuck: 66,
  scores: [
    { label: "LOVE", value: 67 },
    { label: "CAREER", value: 70 },
    { label: "STUDY", value: 58 },
  ],
  luckyColor: "Blush Pink",
  luckyNumber: 7,
  footer: "A little sign from the universe ✦",
};

const PAPER_FEED_PIXELS_PER_SECOND = 105;

function clearQueuedTimers(timers: MutableRefObject<number[]>) {
  timers.current.forEach((timer) => window.clearTimeout(timer));
  timers.current = [];
}

export function ReceiptPrinter({
  resultData = DEFAULT_RECEIPT_DATA,
  isPrinting = false,
  resetSignal = 0,
  onPullToReveal,
  onPrintComplete,
  className,
}: ReceiptPrinterProps) {
  const [phase, setPhase] = useState<ReceiptPrinterPhase>("intro-ready");
  const timers = useRef<number[]>([]);
  const wasPrinting = useRef(false);
  const didMountReset = useRef(false);
  const onPrintCompleteRef = useRef(onPrintComplete);
  const resultRef = useRef<HTMLElement>(null);
  const interactionRef = useRef<HTMLDivElement>(null);
  const [resultHeight, setResultHeight] = useState(0);
  const [printerHeight, setPrinterHeight] = useState(359.2);
  const [isPressed, setIsPressed] = useState(false);

  useEffect(() => {
    const result = resultRef.current;
    if (!result) return;

    const measure = () => {
      setResultHeight(result.offsetHeight);
      if (interactionRef.current) setPrinterHeight(parseFloat(getComputedStyle(interactionRef.current).height));
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(result);
    if (interactionRef.current) observer.observe(interactionRef.current);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    onPrintCompleteRef.current = onPrintComplete;
  }, [onPrintComplete]);

  useEffect(() => {
    timers.current.push(window.setTimeout(() => setPhase("intro-printing"), 120));

    return () => clearQueuedTimers(timers);
  }, []);

  useEffect(() => {
    if (!didMountReset.current) {
      didMountReset.current = true;
      return;
    }

    clearQueuedTimers(timers);
    wasPrinting.current = false;
    setPhase("idle");
  }, [resetSignal]);

  useEffect(() => {
    if (!isPrinting || wasPrinting.current) {
      wasPrinting.current = isPrinting;
      return;
    }

    clearQueuedTimers(timers);
    wasPrinting.current = true;
    setPhase("warming");

    timers.current.push(window.setTimeout(() => setPhase("printing"), 280));

  }, [isPrinting]);

  // Each feed step advances at most one CSS pixel, independent of sheet length.
  const introFeedSteps = Math.ceil(printerHeight * 255 / 449);
  const resultPaperHeight = resultHeight + printerHeight * 27 / 449;
  const exposedPaperHeight = printerHeight * (255 + 10) / 449;
  const resultFeedSteps = Math.max(1, Math.ceil(resultPaperHeight - exposedPaperHeight));
  const introFeedDuration = Math.ceil(introFeedSteps / PAPER_FEED_PIXELS_PER_SECOND * 1000);
  const resultFeedDuration = Math.ceil(resultFeedSteps / PAPER_FEED_PIXELS_PER_SECOND * 1000);

  function handlePaperFeedEnd(event: AnimationEvent<HTMLElement>) {
    if (event.target !== event.currentTarget) return;
    if (phase === "intro-printing" && event.animationName === "receipt-paper-feed") {
      setPhase("idle");
    } else if (phase === "printing" && event.animationName === "receipt-result-feed" && wasPrinting.current) {
      wasPrinting.current = false;
      setPhase("complete");
      onPrintCompleteRef.current?.();
    }
  }

  const displayText =
    phase === "complete"
      ? "REVEALED"
      : phase === "idle"
        ? "READY"
        : phase === "intro-ready" || phase === "intro-printing"
          ? "PRINTING..."
          : "REVEALING...";
  const canPull = phase === "idle" && !isPrinting;
  const showingResult = phase === "printing" || phase === "complete";
  const canActivateMachine = (phase === "idle" || phase === "complete") && !isPrinting && Boolean(onPullToReveal);
  const machineLabel = phase === "complete" ? "Print another receipt" : "Print receipt";

  function resetMachineFeedback() {
    setIsPressed(false);
    interactionRef.current?.style.removeProperty("--printer-lean-x");
    interactionRef.current?.style.removeProperty("--printer-lean-angle");
  }

  function handleMachinePointerMove(event: PointerEvent<HTMLButtonElement>) {
    if (!canActivateMachine || event.pointerType !== "mouse") return;
    const bounds = event.currentTarget.getBoundingClientRect();
    const position = Math.max(-1, Math.min(1, ((event.clientX - bounds.left) / bounds.width - 0.5) * 2));
    interactionRef.current?.style.setProperty("--printer-lean-x", `${position * 1.2}px`);
    interactionRef.current?.style.setProperty("--printer-lean-angle", `${position * 0.45}deg`);
  }

  function activateMachine() {
    resetMachineFeedback();
    if (canActivateMachine) onPullToReveal?.();
  }

  return (
    <section
      className={["receipt-printer", className].filter(Boolean).join(" ")}
      data-phase={phase}
      data-pressed={isPressed}
      style={{
        "--receipt-result-height": `${resultHeight}px`,
        "--receipt-intro-duration": `${introFeedDuration}ms`,
        "--receipt-print-duration": `${resultFeedDuration}ms`,
        "--receipt-intro-steps": introFeedSteps,
        "--receipt-print-steps": resultFeedSteps,
      } as CSSProperties}
      aria-label="HINT receipt printer preview"
    >
      <div className="receipt-printer__interaction" ref={interactionRef}>
        <div className="receipt-printer__reference-frame">
          <img
            className="receipt-printer__reference-image"
            src="/receipt-printer/hint-printer-machine.png?v=3"
            alt=""
            draggable={false}
          />
          <span className="receipt-printer__slot-frame" aria-hidden />
          <button
            className="receipt-printer__machine-action"
            type="button"
            aria-label={machineLabel}
            title={machineLabel}
            disabled={!canActivateMachine}
            onClick={activateMachine}
            onPointerMove={handleMachinePointerMove}
            onPointerDown={() => { if (canActivateMachine) setIsPressed(true); }}
            onPointerUp={() => setIsPressed(false)}
            onPointerLeave={resetMachineFeedback}
            onPointerCancel={resetMachineFeedback}
            onBlur={resetMachineFeedback}
            onKeyDown={(event) => {
              if (event.key === " " || event.key === "Enter") setIsPressed(true);
            }}
            onKeyUp={() => setIsPressed(false)}
          />
          <div className="receipt-printer__paper-window">
            <article className="receipt-printer__paper" onAnimationEnd={handlePaperFeedEnd}>
              <section className="receipt-printer__teaser" aria-hidden={showingResult}>
                <p className="receipt-printer__accessible-text">Trust the little signs today.</p>
                <button
                  className="receipt-printer__paper-reveal"
                  type="button"
                  disabled={!canPull}
                  onClick={onPullToReveal}
                >
                  <span className="receipt-printer__accessible-text">Pull to reveal</span>
                </button>
              </section>
              <section
                ref={resultRef}
                className="receipt-printer__result-content"
                aria-label="Daily receipt result"
                aria-hidden={phase !== "complete"}
              >
                <header className="receipt-printer__result-header">
                  <span>{resultData.title}</span>
                  <small>{resultData.label}</small>
                </header>
                <section className="receipt-printer__card-block">
                  <p className="receipt-printer__label">{resultData.cardLabel}</p>
                  {resultData.cardImage && (
                    <img
                      className="receipt-printer__card-image"
                      src={resultData.cardImage}
                      alt={`${resultData.cardName} tarot card`}
                      width={80}
                      height={120}
                      draggable={false}
                    />
                  )}
                  <h2>{resultData.cardName}</h2>
                  <p>{resultData.cardMessage}</p>
                </section>
                <section className="receipt-printer__luck-block">
                  <strong>{resultData.overallLuck}</strong>
                  <span>OVERALL LUCK</span>
                </section>
                <div className="receipt-printer__mini-scores" aria-label="Love career and study scores">
                  {resultData.scores.map((score) => (
                    <span key={score.label}>
                      {score.label} {score.value}
                    </span>
                  ))}
                </div>
                <div className="receipt-printer__lucky-pair">
                  <div>
                    <span>LUCKY COLOR</span>
                    <strong>{resultData.luckyColor}</strong>
                  </div>
                  <div>
                    <span>LUCKY NUMBER</span>
                    <strong>{resultData.luckyNumber}</strong>
                  </div>
                </div>
                <footer>{resultData.footer}</footer>
              </section>
              <span className="receipt-printer__tear-edge" aria-hidden />
            </article>
            <span className="receipt-printer__slot-shadow" aria-hidden />
          </div>
          <span className="receipt-printer__slot-occluder" aria-hidden />
          <span className="receipt-printer__power-light" aria-hidden />
          <span className="receipt-printer__state-label" aria-live="polite">
            {displayText}
          </span>
        </div>
      </div>
    </section>
  );
}
