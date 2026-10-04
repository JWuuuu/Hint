import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { ritualCopy } from "../logic/ritualCopy";
import {
  forwardRef,
  memo,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
  type KeyboardEvent,
  type PointerEvent,
} from "react";
import { motion } from "../../../lib/quietMotion";
import { RotateCw } from "lucide-react";
import { triggerHaptic } from "../../../lib/feedback";
import { useTarotReducedMotion } from "../logic/useTarotReducedMotion";
import { useLanguage } from "../../../lib/i18n";
import type { RitualCard } from "../logic/createHiddenDeck";
import type { WashPointer } from "../logic/washPhysics";
import {
  getDefaultTarotCardBackForStyle,
  getTarotCardBackImage,
  type TarotCardBackId,
  type TarotCardBackStyle,
} from "../logic/cardBacks";

export type WashRitualTheme = {
  surface?: "light" | "dark";
  chamberOverlay: string;
  starClassName: string;
  tableBackground: string;
  tableBorderColor: string;
  tableShadow: string;
  tableRingColor: string;
  secondaryRingColor: string;
  cardBackStyle: TarotCardBackStyle;
  cardBackId: TarotCardBackId;
};

type CardWashRitualProps = {
  stage: "placed" | "washing" | "gathering" | "cutReady" | "cutting";
  ritualCards: RitualCard[];
  deckCount?: number;
  washProgress?: number;
  theme?: WashRitualTheme;
  onBeginWash: () => void;
  onWash: (pointer: WashPointer) => void;
  onWashRelease: () => void;
  onWashCancel?: () => void;
  autoWashing?: boolean;
  washDirection?: 1 | -1;
  onAutoWash?: () => void;
  onWashAgain?: () => void;
  onCutDeck?: () => void;
  onContinue?: () => void;
  onCardsSettled?: () => void;
  showControls?: boolean;
  heading?: string;
  helper?: string;
  children?: ReactNode;
};

export type CardWashRitualHandle = {
  paintCards: (cards: readonly RitualCard[]) => void;
};

type IntroStep = "stack" | "spread" | "closing" | "gather";

const DEFAULT_THEME: WashRitualTheme = {
  chamberOverlay:
    "linear-gradient(180deg, rgba(255,237,246,0.12), rgba(12,8,26,0.04) 28%, rgba(220,196,255,0.08) 62%, rgba(4,3,12,0.98) 100%), radial-gradient(ellipse at 50% 36%, rgba(246,187,207,0.24), transparent 30%), radial-gradient(circle at 50% 52%, rgba(26,19,50,0.94), rgba(7,6,18,0.98) 65%, #020106 100%)",
  starClassName:
    "opacity-44 [background-image:radial-gradient(circle_at_20%_30%,rgba(255,238,246,0.86)_0_1px,transparent_1px),radial-gradient(circle_at_82%_18%,rgba(248,214,152,0.82)_0_1px,transparent_1px),radial-gradient(circle_at_68%_74%,rgba(219,199,255,0.66)_0_1px,transparent_1px)] [background-size:120px_140px]",
  tableBackground:
    "radial-gradient(circle at 48% 42%, rgba(255,236,244,0.18), transparent 30%), radial-gradient(circle at 50% 54%, rgba(45,37,78,0.82), rgba(14,11,30,0.95) 58%, rgba(4,3,12,0.99) 100%)",
  tableBorderColor: "rgba(238,188,205,0.28)",
  tableShadow:
    "0 35px 110px rgba(0,0,0,0.68), 0 0 46px rgba(221,180,255,0.10), inset 0 0 92px rgba(246,187,207,0.13)",
  tableRingColor: "rgba(246,187,207,0.22)",
  secondaryRingColor: "rgba(248,214,152,0.14)",
  cardBackStyle: "nocturne",
  cardBackId: getDefaultTarotCardBackForStyle("nocturne"),
};

export const WASH_CARD_SIZE = "h-[86px] w-[54px] min-[430px]:h-[92px] min-[430px]:w-[58px]";

export const RitualBackCard = memo(function RitualBackCard({
  cardBackId,
  className = "",
}: {
  cardBackId: TarotCardBackId;
  className?: string;
}) {
  return (
    <div
      className={`relative overflow-hidden rounded-[10px] border border-[#d7bd7c]/62 bg-[#182139] shadow-[0_2px_6px_rgba(0,0,0,0.2)] [backface-visibility:hidden] ${className}`}
      style={{
        backgroundImage: `url("${getTarotCardBackImage(cardBackId)}")`,
        backgroundPosition: "center",
        backgroundSize: "100% 100%",
      }}
    >
      <span className="pointer-events-none absolute inset-[5px] rounded-[7px] border border-white/12" />
    </div>
  );
});

function ritualHaptic(pattern: number | number[] = 6) {
  const longestPulse = Array.isArray(pattern)
    ? Math.max(...pattern.filter((_, index) => index % 2 === 0))
    : pattern;
  triggerHaptic(longestPulse >= 18 ? "select" : longestPulse <= 5 ? "soft" : "tap");
}

function getFullDeckTransform(index: number, total: number) {
  const midpoint = Math.max(1, (total - 1) / 2);
  const offset = index - midpoint;
  const depth = offset / midpoint;
  const wave = Math.sin(index * 1.37);

  return {
    x: 50 + offset * 0.05 + wave * 0.1,
    y: 50 + offset * 0.028 + Math.cos(index * 0.91) * 0.06,
    rotate: depth * 3.4 + wave * 0.28,
    zIndex: index,
  };
}

function getIntroCircleTransform(index: number, total: number, step: IntroStep) {
  const progress = total <= 1 ? 0 : index / (total - 1);
  const clockDegrees = step === "stack" ? 0 : step === "closing" ? 360 : progress * 360;

  return {
    x: 50,
    y: 50,
    rotate: 0,
    zIndex: (step === "stack" ? 1800 : 1000) + index,
    outerTransform: `${getFieldTransform(50, 50)} rotate(${clockDegrees}deg) translate3d(0, calc(var(--wash-field-height) * -0.31), 0)`,
  };
}

function getFieldTransform(x: number, y: number) {
  return `translate3d(calc(var(--wash-field-width) * ${x / 100}), calc(var(--wash-field-height) * ${y / 100}), 0)`;
}

function getIntroDeckTransform(index: number, total: number, step: IntroStep) {
  if (step === "stack" || step === "closing") {
    return getIntroCircleTransform(index, total, step);
  }

  if (step !== "spread") return getFullDeckTransform(index, total);

  return getIntroCircleTransform(index, total, step);
}

function getIntroTransition(index: number, total: number, step: IntroStep) {
  if (step === "spread") {
    return `transform 560ms cubic-bezier(0.18, 0.86, 0.2, 1) ${index * 0.0018}s`;
  }

  if (step === "closing") {
    return `transform 480ms cubic-bezier(0.2, 0.82, 0.2, 1) ${index * 0.0016}s`;
  }

  if (step === "gather") {
    return `transform 400ms cubic-bezier(0.24, 0.76, 0.18, 1) ${(total - index) * 0.0007}s`;
  }

  return `transform 360ms cubic-bezier(0.2, 0.78, 0.2, 1) ${index * 0.0006}s`;
}

export const CardWashRitual = forwardRef<CardWashRitualHandle, CardWashRitualProps>(function CardWashRitual({
  stage,
  ritualCards,
  deckCount = ritualCards.length,
  theme = DEFAULT_THEME,
  onBeginWash,
  onWash,
  onWashRelease,
  onWashCancel,
  autoWashing = false,

  onAutoWash,
  onWashAgain,
  onCutDeck,
  onCardsSettled,
  heading,
  helper,
  children,
}: CardWashRitualProps, ref) {
  const { t, language } = useLanguage();
  const [showDeckNote, setShowDeckNote] = useState(false);
  const deckNoteButton = useRef<HTMLButtonElement>(null);
  const deckCopy = ritualCopy(language);
  const reduceMotion = useTarotReducedMotion();
  const lightSurface = theme.surface === "light";
  const tableRef = useRef<HTMLDivElement | null>(null);
  const lastPoint = useRef<{ x: number; y: number } | null>(null);
  const activePointer = useRef<number | null>(null);
  const washing = useRef(false);
  const washDistance = useRef(0);
  const keyboardWashStep = useRef(0);
  const beginWashCallback = useRef(onBeginWash);
  const washReleaseCallback = useRef(onWashRelease);
  const washCardNodes = useRef<
    Array<{ wrapper: HTMLElement; face: HTMLElement | null }>
  >([]);
  const [introStep, setIntroStep] = useState<IntroStep>("stack");
  const [washIntroSettled, setWashIntroSettled] = useState(
    () => stage === "washing",
  );

  useLayoutEffect(() => {
    const table = tableRef.current;
    if (!table) return;
    const measure = () => {
      const { width, height } = table.getBoundingClientRect();
      table.style.setProperty("--wash-field-width", `${width}px`);
      table.style.setProperty("--wash-field-height", `${height}px`);
    };
    measure();
    if (typeof ResizeObserver !== "undefined") {
      const observer = new ResizeObserver(measure);
      observer.observe(table);
      return () => observer.disconnect();
    }
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, []);

  useImperativeHandle(ref, () => ({
    paintCards(cards) {
      const table = tableRef.current;
      if (!table || stage !== "washing") return;
      let nodes = washCardNodes.current;
      if (
        nodes.length !== cards.length ||
        nodes.some(({ wrapper }) => !wrapper.isConnected)
      ) {
        nodes = Array.from(
          table.querySelectorAll<HTMLElement>("[data-wash-card]"),
          (wrapper) => ({
            wrapper,
            face: wrapper.querySelector<HTMLElement>("[data-wash-card-face]"),
          }),
        );
        washCardNodes.current = nodes;
      }
      nodes.forEach(({ wrapper, face }, index) => {
        const card = cards[index];
        if (!card) return;
        const position = getFieldTransform(card.x, card.y);
        if (wrapper.style.transform !== position) wrapper.style.transform = position;
        if (face) {
          const angle = `translate3d(-50%, -50%, 0) rotate(${card.rotate}deg)`;
          if (face.style.transform !== angle) face.style.transform = angle;
        }
      });
    },
  }), [stage]);

  const introReady = stage !== "placed";
  const deckCountLabel = t("tarot.flow.wash.cards").replace(
    "{count}",
    String(deckCount),
  );
  const title = heading ?? (
    stage === "placed"
      ? t("tarot.flow.wash.fullDeck")
      : stage === "gathering"
        ? t("tarot.flow.wash.gathering")
        : stage === "cutReady"
          ? t("tarot.flow.wash.deckSquared")
          : stage === "cutting"
            ? t("tarot.flow.wash.cutDeck")
          : t("tarot.flow.wash.title"));
  const helperCopy = helper ?? (
    stage === "placed"
      ? t("tarot.flow.wash.placedBody")
      : stage === "washing"
        ? t("tarot.flow.wash.body")
        : stage === "cutReady"
          ? t("tarot.flow.wash.cutReadyBody")
        : stage === "cutting"
          ? t("tarot.flow.wash.cuttingBody")
        : "");
  const isDeckStackStage = stage === "gathering" || stage === "cutReady" || stage === "cutting";
  const isFullDeckStage = stage === "placed";
  const cardTransitionMs = reduceMotion
    ? 20
    : stage === "gathering"
      ? 440
      : stage === "cutting"
        ? 680
        : 116;
  const cardTransitionEase = stage === "gathering"
    ? "cubic-bezier(0.2, 0.82, 0.16, 1)"
    : stage === "cutting"
      ? "cubic-bezier(0.22, 0.78, 0.14, 1)"
      : "cubic-bezier(0.18, 0.72, 0.2, 1)";
  const settleCardIndex = ritualCards.reduce(
    (selectedIndex, card, index, cards) =>
      (card.gatherDelay ?? 0) >= (cards[selectedIndex]?.gatherDelay ?? 0)
        ? index
        : selectedIndex,
    0,
  );

  useEffect(() => {
    beginWashCallback.current = onBeginWash;
  }, [onBeginWash]);

  useEffect(() => {
    washReleaseCallback.current = onWashRelease;
  }, [onWashRelease]);

  useEffect(() => {
    if (stage !== "placed") return undefined;
    washDistance.current = 0;
    setIntroStep("stack");
    if (reduceMotion) {
      setIntroStep("gather");
      const washTimer = window.setTimeout(() => {
        beginWashCallback.current();
      }, 100);
      return () => window.clearTimeout(washTimer);
    }
    const spreadTimer = window.setTimeout(() => {
      ritualHaptic(4);
      setIntroStep("spread");
    }, 80);
    const closingTimer = window.setTimeout(() => {
      ritualHaptic(5);
      setIntroStep("closing");
    }, 700);
    const gatherTimer = window.setTimeout(() => {
      ritualHaptic([4, 22, 5]);
      setIntroStep("gather");
    }, 1120);
    const washTimer = window.setTimeout(() => {
      ritualHaptic([6, 24, 8]);
      beginWashCallback.current();
    }, 1520);

    return () => {
      window.clearTimeout(spreadTimer);
      window.clearTimeout(closingTimer);
      window.clearTimeout(gatherTimer);
      window.clearTimeout(washTimer);
    };
  }, [reduceMotion, stage]);

  useEffect(() => {
    if (stage !== "washing") {
      setWashIntroSettled(false);
      return undefined;
    }

    setWashIntroSettled(false);
    const settleTimer = window.setTimeout(
      () => setWashIntroSettled(true),
      reduceMotion ? 20 : 260,
    );
    return () => window.clearTimeout(settleTimer);
  }, [reduceMotion, stage]);

  function move(event: PointerEvent<HTMLDivElement>) {
    if (!washing.current || activePointer.current !== event.pointerId || !tableRef.current) return;
    const rect = tableRef.current.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    const previous = lastPoint.current ?? { x, y };
    washDistance.current += Math.hypot(x - previous.x, y - previous.y);
    lastPoint.current = { x, y };
    onWash({
      x,
      y,
      movementX: x - previous.x,
      movementY: y - previous.y,
      width: rect.width,
      height: rect.height,
      spinDirection: 1,
    });
  }

  function finishPointerWash(event: PointerEvent<HTMLDivElement>) {
    if (!washing.current || activePointer.current !== event.pointerId) return;
    washing.current = false;
    activePointer.current = null;
    lastPoint.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    if (washDistance.current < 24) {
      washDistance.current = 0;
      onWashCancel?.();
      ritualHaptic(4);
      return;
    }
    ritualHaptic([7, 30, 9]);
    washReleaseCallback.current();
  }

  function cancelPointerWash(event: PointerEvent<HTMLDivElement>) {
    if (!washing.current || activePointer.current !== event.pointerId) return;
    washing.current = false;
    activePointer.current = null;
    lastPoint.current = null;
    washDistance.current = 0;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    onWashCancel?.();
  }

  function handleKeyboardWash(event: KeyboardEvent<HTMLDivElement>) {
    if (stage !== "washing" || autoWashing || activePointer.current !== null || !tableRef.current) return;

    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      if (!washing.current && washDistance.current <= 0) return;
      washing.current = false;
      lastPoint.current = null;
      ritualHaptic([7, 30, 9]);
      washReleaseCallback.current();
      return;
    }

    if (!["ArrowRight", "ArrowDown", "ArrowLeft", "ArrowUp"].includes(event.key)) return;
    event.preventDefault();
    washing.current = true;
    keyboardWashStep.current += 1;
    const rect = tableRef.current.getBoundingClientRect();
    const angle = keyboardWashStep.current * (Math.PI / 5);
    const radiusX = Math.min(rect.width * 0.28, 132);
    const radiusY = Math.min(rect.height * 0.24, 118);
    const x = rect.width / 2 + Math.cos(angle) * radiusX;
    const y = rect.height / 2 + Math.sin(angle) * radiusY;
    const previous = lastPoint.current ?? { x: rect.width / 2 + radiusX, y: rect.height / 2 };
    const movementX = x - previous.x;
    const movementY = y - previous.y;
    washDistance.current += Math.hypot(movementX, movementY);
    lastPoint.current = { x, y };
    onBeginWash();
    onWash({
      x,
      y,
      movementX,
      movementY,
      width: rect.width,
      height: rect.height,
      spinDirection: 1,
    });
  }

  return (
    <section
      data-ritual-stage={stage}
      data-intro-step={isFullDeckStage ? introStep : ""}
      className="relative flex h-full w-full flex-col items-center justify-center overflow-hidden px-4 pb-[calc(var(--hint-safe-bottom)+4.5rem)] pt-[calc(var(--hint-safe-top)+1rem)] [@media(max-height:740px)]:pt-[calc(var(--hint-safe-top)+5rem)] text-[color:var(--tarot-page-ink,#332d45)]"
    >
      <div
        className="pointer-events-none absolute left-1/2 top-[50%] h-[min(112vw,560px)] w-[min(112vw,560px)] -translate-x-1/2 -translate-y-1/2 rounded-full border"
        style={{
          borderColor: lightSurface ? "rgba(123,91,145,0.12)" : "rgba(246,187,207,0.14)",
          boxShadow: lightSurface
            ? "inset 0 0 74px rgba(255,255,255,0.28), 0 0 64px rgba(185,151,201,0.10)"
            : "inset 0 0 74px rgba(246,187,207,0.10), 0 0 64px rgba(221,180,255,0.08)",
        }}
      />

      <div className="relative z-10 mt-4 min-h-[136px] shrink-0 text-center">
        <div data-testid="tarot-deck-count" className={`mx-auto mb-2 w-fit rounded-full border px-3 py-1 text-[9px] font-black uppercase tracking-[0.18em] backdrop-blur-md ${lightSurface ? "border-[#d8b96e]/38 bg-white/52 text-[#876c79] shadow-[0_8px_24px_rgba(96,72,104,0.08)]" : "border-[#f1d390]/28 bg-white/10 text-[#f6e0ce]/78 shadow-[0_10px_28px_rgba(0,0,0,0.16)]"}`}>
          {deckCountLabel}
        </div>
        <motion.h1
          key={title}
          initial={stage === "cutting" || reduceMotion ? false : { opacity: 0, y: 3 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: reduceMotion ? 0.01 : 0.22, ease: [0.2, 0.76, 0.2, 1] }}
          className="font-serif text-[26px] leading-tight text-[color:var(--tarot-page-ink,#332d45)] md:text-[34px]"
        >
          {title}
        </motion.h1>
        {helperCopy ? (
          <motion.p
            key={helperCopy}
            initial={stage === "cutting" || reduceMotion ? false : { opacity: 0, y: 3 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: reduceMotion ? 0.01 : 0.22, ease: [0.2, 0.76, 0.2, 1] }}
            className="mx-auto mt-2 max-w-[22rem] px-3 font-sans text-[12px] font-semibold leading-snug text-[color:var(--tarot-page-muted,#756777)]"
          >
            {helperCopy}
          </motion.p>
        ) : null}
        {stage === "washing" ? (
          <motion.div
            aria-live="polite"
            className={`mx-auto mt-2 flex w-fit items-center gap-1.5 rounded-full border px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.12em] ${
              lightSurface
                ? "border-[#d8b96e]/30 bg-white/48 text-[#806879]"
                : "border-[#f1d390]/24 bg-white/8 text-[#f0dce3]/76"
            }`}
            initial={{ opacity: 0, y: 2 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: reduceMotion ? 0.01 : 0.2 }}
          >
            <RotateCw size={13} strokeWidth={1.8} aria-hidden="true" />
            {t("tarot.flow.wash.clockwise")}
          </motion.div>
        ) : null}
      </div>

      <div
        ref={tableRef}
        data-testid="tarot-wash-table"
        role="application"
        aria-label={t("tarot.flow.wash.aria")}
        tabIndex={stage === "washing" ? 0 : -1}
        className={`relative z-10 mt-3 touch-none overflow-hidden rounded-[32px] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#7b5b91]/55 ${
          isFullDeckStage
              ? "h-[min(86vw,430px)] w-[min(86vw,430px)]"
              : "h-[min(58vh,490px)] w-[calc(100%+2rem)] max-w-[460px]"
        }`}
        style={{
          filter: isFullDeckStage
            ? lightSurface
              ? "drop-shadow(0 22px 34px rgba(74,52,83,0.18))"
              : "drop-shadow(0 24px 36px rgba(0,0,0,0.38))"
            : undefined,
        }}
        onPointerDown={(event) => {
          if (autoWashing || activePointer.current !== null || event.button > 0) return;
          if (stage === "gathering" || stage === "cutReady" || stage === "cutting") return;
          if (stage === "placed" && !introReady) return;
          activePointer.current = event.pointerId;
          washing.current = true;
          washDistance.current = 0;
          lastPoint.current = null;
          ritualHaptic(5);
          try {
            event.currentTarget.setPointerCapture(event.pointerId);
          } catch {
            // Pointer capture is not available in every embedded WebView.
          }
          onBeginWash();
          move(event);
        }}
        onPointerMove={move}
        onPointerUp={finishPointerWash}
        onPointerCancel={cancelPointerWash}
        onKeyDown={handleKeyboardWash}
        onLostPointerCapture={(event) => {
          if (stage === "washing") cancelPointerWash(event);
        }}
      >
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-[2%] top-[7%] h-[90%] rounded-full opacity-35"
          style={{
            background:
              isFullDeckStage
                ? "radial-gradient(ellipse at 50% 54%, rgba(255,225,236,0.14), rgba(220,196,255,0.12) 34%, transparent 64%)"
                : `radial-gradient(circle at 50% 44%, rgba(255,238,246,0.14), transparent 32%), ${theme.tableBackground}`,
          }}
        />
        {(isFullDeckStage || !isDeckStackStage) && (
          <>
            <div className="pointer-events-none absolute inset-[4%] rounded-full border opacity-25" style={{ borderColor: theme.tableRingColor }} />
          </>
        )}
        <div className="pointer-events-none absolute inset-0">
        {ritualCards.map((card, index) => {
          const fullDeck = getIntroDeckTransform(index, ritualCards.length, introStep);
          const introCardsAreSmall = introStep === "stack" || introStep === "spread" || introStep === "closing";
          const x = isFullDeckStage ? fullDeck.x : card.x;
          const y = isFullDeckStage ? fullDeck.y : card.y;
          const rotate = isFullDeckStage ? fullDeck.rotate : card.rotate;
          const zIndex = isFullDeckStage ? fullDeck.zIndex : card.zIndex;
          const outerTransform = isFullDeckStage && "outerTransform" in fullDeck && typeof fullDeck.outerTransform === "string"
            ? fullDeck.outerTransform
            : getFieldTransform(x, y);
          const cardClassName = isFullDeckStage
            ? `${
              introCardsAreSmall
                ? "h-[92px] w-[58px] min-[430px]:h-[104px] min-[430px]:w-[66px] sm:h-[118px] sm:w-[74px]"
                : "h-[180px] w-[114px] min-[430px]:h-[208px] min-[430px]:w-[132px] sm:h-[236px] sm:w-[150px]"
            } transition-[height,width] duration-700 ease-out`
            : WASH_CARD_SIZE;
          return (
          <div
            key={card.visualId}
            data-intro-card-index={index}
            data-wash-card
            className="absolute left-0 top-0 h-0 w-0 transform-gpu will-change-transform [backface-visibility:hidden]"
            style={{
              zIndex,
              transform: outerTransform,
              transformOrigin: isFullDeckStage ? "0 0" : undefined,
              transition:
                isFullDeckStage
                  ? getIntroTransition(index, ritualCards.length, introStep)
                  : isDeckStackStage
                    ? `transform ${cardTransitionMs}ms ${cardTransitionEase} ${reduceMotion ? 0 : Math.min(card.gatherDelay ?? 0, 0.08)}s`
                    : stage === "washing" && !washIntroSettled
                      ? "transform 240ms cubic-bezier(0.22, 0.78, 0.18, 1)"
                      : stage === "washing"
                        ? "none"
                        : "transform 90ms cubic-bezier(0.18, 0.72, 0.2, 1)",
            }}
            onTransitionEnd={(event) => {
              if (
                stage === "gathering" &&
                index === settleCardIndex &&
                event.propertyName === "transform" &&
                event.currentTarget === event.target
              ) {
                onCardsSettled?.();
              }
            }}
          >
            <div
              data-wash-card-face
              className="absolute left-0 top-0 transform-gpu [backface-visibility:hidden]"
              style={{
                transform: `translate3d(-50%, -50%, 0) rotate(${rotate}deg)`,
                transition:
                  isFullDeckStage
                    ? getIntroTransition(index, ritualCards.length, introStep)
                    : isDeckStackStage
                      ? `transform ${cardTransitionMs}ms ${cardTransitionEase} ${reduceMotion ? 0 : Math.min(card.gatherDelay ?? 0, 0.08)}s`
                      : stage === "washing" && !washIntroSettled
                        ? "transform 240ms cubic-bezier(0.22, 0.78, 0.18, 1)"
                        : stage === "washing"
                          ? "none"
                          : `transform ${cardTransitionMs}ms ${cardTransitionEase}`,
              }}
            >
              <RitualBackCard cardBackId={theme.cardBackId} className={cardClassName} />
            </div>
          </div>
        );
        })}
        </div>
        {children}
      </div>

      <Dialog open={showDeckNote} onOpenChange={setShowDeckNote}><DialogContent onCloseAutoFocus={event=>{event.preventDefault();deckNoteButton.current?.focus({preventScroll:true});}} className="max-h-[80dvh] overflow-y-auto"><DialogTitle>{deckCopy.title}</DialogTitle><DialogDescription>{deckCopy.body}</DialogDescription>{reduceMotion&&<p className="text-sm leading-relaxed">{deckCopy.reduced}</p>}</DialogContent></Dialog>
      <div className="absolute inset-x-4 bottom-[calc(var(--hint-safe-bottom)+0.8rem)] z-30 mx-auto max-w-[24rem]">
        {stage === "washing" && <button type="button" data-testid="tarot-deck-choice-note" ref={deckNoteButton} className={`mx-auto mb-1 flex min-h-11 w-full items-center justify-center rounded-xl px-3 text-center text-[11px] leading-relaxed underline underline-offset-4 ${lightSurface?"bg-[#fbf7f1]/85 text-[#67516c]":"bg-[#281d35]/90 text-[#f4e5ef]"}`} onClick={()=>setShowDeckNote(true)}>{deckCopy.short}</button>}
        {stage === "washing" && onAutoWash ? (
          <button
            type="button"
            onClick={onAutoWash}
            disabled={autoWashing}
            className="min-h-13 w-full rounded-full border border-white/38 bg-[#705780] px-6 text-[12px] font-black text-[#fff9f4] shadow-[0_14px_34px_rgba(70,50,84,0.22),inset_0_1px_0_rgba(255,255,255,0.28)] transition active:scale-[0.985] disabled:cursor-wait disabled:bg-[#8c7897] disabled:text-white/76"
          >
            {autoWashing
              ? t("tarot.flow.wash.washing")
              : t("tarot.flow.wash.auto")}
          </button>
        ) : null}
        {stage === "cutReady" && onCutDeck ? (
          <div className="rounded-[24px] border border-white/66 bg-white/72 p-2 shadow-[0_18px_46px_rgba(90,67,100,0.16)] backdrop-blur-xl">
            <button
              type="button"
              onClick={onCutDeck}
              className="min-h-12 w-full rounded-full bg-[#2f2544] px-6 text-[13px] font-black text-[#fff8ec] shadow-[0_12px_28px_rgba(70,50,84,0.22)] transition active:scale-[0.98]"
            >
              {t("tarot.flow.wash.cutDeck")}
            </button>
            {onWashAgain ? (
              <button
                type="button"
                onClick={onWashAgain}
                className="mt-2 min-h-11 w-full rounded-full text-[12px] font-black text-[#756276] transition active:bg-white/54"
              >
                {t("tarot.flow.wash.again")}
              </button>
            ) : null}
          </div>
        ) : null}
      </div>
      </section>
  );
});
