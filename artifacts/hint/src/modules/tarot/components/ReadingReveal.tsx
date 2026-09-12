import { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import type { RitualCard } from "../logic/createHiddenDeck";
import type { TarotCardArtId } from "../logic/cardImageMap";
import type { TarotCardBackId, TarotCardBackStyle } from "../logic/cardBacks";
import type { SpreadChoice } from "../../hold/useHoldFlow";
import { TarotCardVisual } from "./TarotCardVisual";
import type { WashRitualTheme } from "./CardWashRitual";
import { getSpreadPositionLabel } from "../logic/spreadLabels";
import { useTarotReducedMotion } from "../logic/useTarotReducedMotion";
import { useLanguage } from "../../../lib/i18n";

type ReadingRevealProps = {
  selectedCards: RitualCard[];
  revealedIds: readonly string[];
  spread: SpreadChoice;
  backStyle?: TarotCardBackStyle;
  cardBackId?: TarotCardBackId;
  cardArtId?: TarotCardArtId;
  theme?: Pick<WashRitualTheme, "chamberOverlay" | "starClassName" | "tableRingColor" | "secondaryRingColor">;
  autoReveal?: boolean;
  onContinue?: () => void;
  onReveal: (visualId: string) => void;
  onRestart: () => void;
};

function revealGridClass(count: number) {
  if (count === 1) return "grid-cols-1 max-w-sm";
  if (count === 2) return "grid-cols-2 max-w-sm";
  if (count === 3) return "grid-cols-3 max-w-[380px]";
  if (count <= 5) return "grid-cols-3 xl:grid-cols-5 max-w-5xl";
  return "grid-cols-3 lg:grid-cols-4 2xl:grid-cols-7 max-w-5xl 2xl:max-w-6xl";
}

function revealCardSizeClass(count: number) {
  if (count === 1) return "";
  if (count === 2) return "!h-[202px] !w-[124px]";
  if (count === 3) return "!h-[clamp(156px,40vw,172px)] !w-[clamp(96px,25vw,106px)]";
  if (count <= 5) return "!h-[142px] !w-[88px]";
  return "!h-[134px] !w-[82px]";
}

function revealCardShellClass(count: number) {
  if (count === 1) return "h-[218px] w-[132px]";
  if (count === 2) return "h-[202px] w-[124px]";
  if (count === 3) return "h-[clamp(156px,40vw,172px)] w-[clamp(96px,25vw,106px)]";
  if (count <= 5) return "h-[142px] w-[88px]";
  return "h-[134px] w-[82px]";
}

export function ReadingReveal({
  selectedCards,
  revealedIds,
  spread,
  backStyle = "nocturne",
  cardBackId,
  cardArtId = "original",
  theme,
  autoReveal = false,
  onContinue,
  onReveal,
}: ReadingRevealProps) {
  const { t } = useLanguage();
  const reduceMotion = useTarotReducedMotion();
  const localizedPositionLabels = t(
    `tarot.spread.${spread.id}.positionLabels`,
  ).split("|");
  const [readyToReveal, setReadyToReveal] = useState(false);
  const sequenceStartedRef = useRef("");
  const onRevealRef = useRef(onReveal);
  const continueButtonRef = useRef<HTMLButtonElement | null>(null);
  const allRevealed = selectedCards.every((card) => revealedIds.includes(card.visualId));
  const oneCard = selectedCards.length === 1;
  const revealProgress = selectedCards.length === 0 ? 0 : revealedIds.length / selectedCards.length;
  const sequenceKey = useMemo(
    () => selectedCards.map((card) => card.visualId).join("|"),
    [selectedCards],
  );
  const title = allRevealed
    ? t("tarot.flow.reveal.openTitle")
    : autoReveal
      ? t("tarot.flow.reveal.openingTitle")
      : t("tarot.flow.reveal.manualTitle");
  const subtitle = allRevealed
    ? t("tarot.flow.reveal.openSubtitle")
    : autoReveal
      ? t("tarot.flow.reveal.openingSubtitle")
      : oneCard
        ? t("tarot.flow.reveal.turnPosition").replace(
            "{position}",
            localizedPositionLabels[0] ?? getSpreadPositionLabel(spread, 0),
          )
        : t("tarot.flow.reveal.manualSubtitle");
  const gridClass = revealGridClass(selectedCards.length);
  const cardSizeClass = revealCardSizeClass(selectedCards.length);
  const cardShellClass = revealCardShellClass(selectedCards.length);
  const pageOverlay = theme?.chamberOverlay ?? "var(--hint-page-bg)";
  const starClassName = theme?.starClassName ?? "";

  useEffect(() => {
    onRevealRef.current = onReveal;
  }, [onReveal]);

  useEffect(() => {
    setReadyToReveal(false);
    sequenceStartedRef.current = "";
    const timer = window.setTimeout(
      () => setReadyToReveal(true),
      reduceMotion ? 30 : 760,
    );
    return () => window.clearTimeout(timer);
  }, [reduceMotion, sequenceKey]);

  useEffect(() => {
    if (!autoReveal || !readyToReveal || sequenceStartedRef.current === sequenceKey) return;
    sequenceStartedRef.current = sequenceKey;
    const timers = selectedCards.map((card, index) =>
      window.setTimeout(
        () => onRevealRef.current(card.visualId),
        reduceMotion ? 30 + index * 70 : 220 + index * 430,
      ),
    );
    return () => timers.forEach((timer) => window.clearTimeout(timer));
  }, [autoReveal, readyToReveal, reduceMotion, selectedCards, sequenceKey]);

  useEffect(() => {
    if (!allRevealed || selectedCards.length <= 3 || window.innerHeight > 720) {
      return undefined;
    }
    const timer = window.setTimeout(() => {
      continueButtonRef.current?.scrollIntoView({
        block: "nearest",
        behavior: reduceMotion ? "auto" : "smooth",
      });
    }, reduceMotion ? 30 : 420);
    return () => window.clearTimeout(timer);
  }, [allRevealed, reduceMotion, selectedCards.length]);

  return (
    <section className="relative h-full w-full overflow-y-auto overflow-x-hidden px-4 pb-[calc(var(--hint-safe-bottom)+2rem)] pt-[calc(var(--hint-safe-top)+5.25rem)] text-center text-[#332d45]">
      <div className="absolute inset-0" style={{ background: pageOverlay }} />
      <div className={`pointer-events-none absolute inset-0 ${starClassName}`} />
      <div className="pointer-events-none absolute inset-x-0 top-[18%] mx-auto h-[58%] max-w-5xl rounded-full blur-3xl" style={{ background: "color-mix(in srgb, var(--hint-rose, #f0b6cf) 12%, transparent)" }} />
      <motion.div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-[45%] h-[410px] w-[410px] -translate-x-1/2 -translate-y-1/2 rounded-full blur-2xl"
        style={{ background: "radial-gradient(circle, color-mix(in srgb, var(--hint-aqua, #9dded9) 15%, transparent), transparent 60%)" }}
        animate={{
          opacity: allRevealed || reduceMotion ? 0.32 : [0.18, 0.42, 0.18],
          scale: allRevealed || reduceMotion ? 1.02 : [0.88, 1.08, 0.88],
        }}
        transition={{ duration: reduceMotion ? 0.01 : 5.6, repeat: allRevealed || reduceMotion ? 0 : Infinity, ease: "easeInOut" }}
      />
      <motion.div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-[45%] h-[260px] w-[260px] -translate-x-1/2 -translate-y-1/2 rounded-full border"
        style={{ borderColor: "color-mix(in srgb, var(--hint-gold, #dcc383) 18%, transparent)" }}
        animate={{ opacity: reduceMotion ? 0.26 : [0.16, 0.46, 0.16], scale: reduceMotion ? 1 : [0.9, 1.16, 0.9] }}
        transition={{ duration: reduceMotion ? 0.01 : 6.2, repeat: reduceMotion ? 0 : Infinity, ease: "easeInOut" }}
      />
      <motion.div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-[45%] h-[180px] w-[180px] -translate-x-1/2 -translate-y-1/2 rounded-full border"
        style={{ borderColor: "color-mix(in srgb, var(--hint-aqua, #9dded9) 15%, transparent)" }}
        animate={{ opacity: reduceMotion ? 0.22 : [0.12, 0.38, 0.12], scale: reduceMotion ? 1 : [1.08, 0.92, 1.08] }}
        transition={{ duration: reduceMotion ? 0.01 : 5.4, repeat: reduceMotion ? 0 : Infinity, ease: "easeInOut" }}
      />

      <div className="relative z-30 mx-auto mb-7 max-w-3xl sm:mb-9">
        <p className="font-serif text-[30px] leading-tight text-[#332d45]">{title}</p>
        <p className="mt-3 font-sans text-sm text-[#746276]">{subtitle}</p>
        <div className="mx-auto mt-4 flex w-fit flex-wrap items-center justify-center gap-2 rounded-full border border-[#d8b96e]/30 bg-white/48 px-3 py-2 font-sans text-[10px] uppercase tracking-[0.14em] text-[#756777] shadow-[0_8px_22px_rgba(86,62,92,0.08)] backdrop-blur-md">
          <span className="text-[#9a7442]">
            {allRevealed
              ? t("tarot.flow.reveal.spreadRevealed")
              : autoReveal
                ? t("tarot.flow.reveal.openingSequence")
                : t("tarot.flow.reveal.manualReveal")}
          </span>
          <span className="h-1 w-1 rounded-full" style={{ background: "var(--hint-aqua)" }} />
          <span>{revealedIds.length} / {selectedCards.length}</span>
        </div>
        <div className="mx-auto mt-3 h-1 w-full max-w-[18rem] overflow-hidden rounded-full" style={{ background: "color-mix(in srgb, var(--hint-border) 62%, transparent)" }}>
          <motion.div
            className="h-full rounded-full"
            style={{ background: "linear-gradient(90deg, var(--hint-aqua), var(--hint-rose), var(--hint-gold))", boxShadow: "0 0 18px color-mix(in srgb, var(--hint-gold) 22%, transparent)" }}
            initial={{ width: "0%" }}
            animate={{ width: `${Math.round(revealProgress * 100)}%` }}
            transition={{ duration: 0.45, ease: "easeOut" }}
          />
        </div>
      </div>

      <div className={`relative z-10 mx-auto grid w-full ${gridClass} place-items-start gap-x-4 gap-y-7 sm:gap-x-6 sm:gap-y-8`}>
        {selectedCards.map((card, index) => {
          const revealed = revealedIds.includes(card.visualId);
          const label =
            localizedPositionLabels[index] ?? getSpreadPositionLabel(spread, index);
          const canReveal = !autoReveal && !revealed && readyToReveal;
          const isNextAutoCard = autoReveal && !revealed && revealedIds.length === index;
          return (
            <motion.div
              key={card.visualId}
              layoutId={`spread-card-${card.visualId}`}
              initial={{ opacity: 0, y: 18, scale: 0.94 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={
                reduceMotion
                  ? { duration: 0.01 }
                  : { delay: index * 0.08, type: "spring", stiffness: 165, damping: 23 }
              }
              className={`relative grid justify-items-center gap-3 text-center ${canReveal ? "cursor-pointer" : ""}`}
              onClick={canReveal ? () => onReveal(card.visualId) : undefined}
            >
              <motion.div
                animate={{
                  y: revealed ? [0, -10, 0] : 0,
                  scale: revealed ? [1, 1.035, 1] : 1,
                }}
                transition={{ duration: reduceMotion ? 0.01 : 0.92, ease: [0.2, 0.74, 0.18, 1] }}
                className={`relative grid place-items-center ${cardShellClass}`}
              >
                <motion.div
                  className="pointer-events-none absolute -inset-6 rounded-[24px] blur-2xl"
                  style={{ background: "radial-gradient(circle, color-mix(in srgb, var(--hint-gold) 24%, transparent), color-mix(in srgb, var(--hint-aqua) 9%, transparent) 45%, transparent 72%)" }}
                  animate={{
                    opacity: revealed ? 0.82 : isNextAutoCard ? [0.28, 0.7, 0.28] : 0.24,
                    scale: revealed ? 1.08 : isNextAutoCard ? [0.86, 1.04, 0.86] : 0.86,
                  }}
                  transition={{ duration: reduceMotion ? 0.01 : 0.92, ease: [0.2, 0.74, 0.18, 1] }}
                />
                {!revealed && (canReveal || isNextAutoCard) && (
                  <motion.div
                    aria-hidden
                    className="pointer-events-none absolute -inset-3 rounded-[18px] border"
                    style={{ borderColor: "color-mix(in srgb, var(--hint-gold) 30%, transparent)" }}
                    animate={{ opacity: reduceMotion ? 0.4 : [0.22, 0.62, 0.22], scale: reduceMotion ? 1 : [0.96, 1.05, 0.96] }}
                    transition={{ duration: reduceMotion ? 0.01 : 2.4, repeat: reduceMotion ? 0 : Infinity, ease: "easeInOut" }}
                  />
                )}
                {revealed && (
                  <motion.div
                    aria-hidden
                    className="pointer-events-none absolute -inset-5 rounded-[22px] border"
                    style={{ borderColor: "color-mix(in srgb, var(--hint-aqua) 24%, transparent)" }}
                    initial={{ opacity: 0.7, scale: 0.78 }}
                    animate={{ opacity: 0, scale: 1.28 }}
                    transition={{ duration: 0.7, ease: "easeOut" }}
                  />
                )}
                <TarotCardVisual
                  card={card}
                  reduceMotion={reduceMotion}
                  faceDown={!revealed}
                  revealed={revealed}
                  active={!revealed}
                  backStyle={backStyle}
                  cardBackId={cardBackId}
                  cardArtId={cardArtId}
                  positionLabel={label}
                  ariaLabel={
                    revealed
                      ? undefined
                      : t("tarot.flow.reveal.faceDown").replace(
                          "{position}",
                          label,
                        )
                  }
                  showFrontCaption={false}
                  className={cardSizeClass}
                />
              </motion.div>
              <div className="grid justify-items-center gap-1.5">
                <p className="max-w-[7rem] truncate rounded-full border border-[#7b5b91]/14 bg-white/52 px-3 py-1.5 font-sans text-[10px] font-bold uppercase tracking-[0.14em] text-[#6d5d70] shadow-[0_6px_18px_rgba(83,65,92,0.06)]">
                  {label}
                </p>
                {revealed && (
                  <p className="max-w-[7rem] truncate font-serif text-[15px] leading-tight text-[#332d45]">
                    {card.name}
                  </p>
                )}
              </div>
            </motion.div>
          );
        })}
      </div>

      {allRevealed && (
        <button
          ref={continueButtonRef}
          type="button"
          onClick={onContinue}
          onKeyDown={(event) => {
            if (event.key !== "Enter" && event.key !== " ") return;
            event.preventDefault();
            onContinue?.();
          }}
          className="hint-soft-button hint-tap-sparkle relative z-10 mt-10 rounded-full px-7 py-3.5 font-sans text-xs uppercase tracking-[0.18em] transition-[background,transform] hover:scale-[1.02]"
        >
          {t("tarot.flow.reveal.read")}
        </button>
      )}
    </section>
  );
}
