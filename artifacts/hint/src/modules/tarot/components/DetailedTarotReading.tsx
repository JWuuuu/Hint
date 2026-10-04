import { useEffect, useId, useRef, useState } from "react";
import { LoaderCircle } from "lucide-react";
import { useLanguage } from "../../../lib/i18n";
import type { LocalStructuredTarotReading, LocalTarotReading } from "../../readings/localTarotReadings";
import { requestDetailedTarotReading, type DetailedTarotRequest } from "../logic/requestDetailedTarotReading";
import { useTarotReducedMotion } from "../logic/useTarotReducedMotion";
import "./reading-motion.css";

export function DetailedTarotReading({ request, saved, savedContext = "", feedback, onContextChange, onFeedback, onGenerated }: {
  request: DetailedTarotRequest;
  saved?: LocalStructuredTarotReading;
  savedContext?: string;
  feedback?: LocalTarotReading["detailedFeedback"];
  onContextChange?: (context: string) => void;
  onFeedback?: (value: NonNullable<LocalTarotReading["detailedFeedback"]>) => void;
  onGenerated: (reading: LocalStructuredTarotReading) => void;
}) {
  const { t } = useLanguage();
  const reduceMotion = useTarotReducedMotion();
  const contentId = useId();
  const contextId = useId();
  const [detail, setDetail] = useState(saved);
  const [context, setContext] = useState(savedContext);
  const [expanded, setExpanded] = useState(false);
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const pending = useRef<AbortController | null>(null);
  const contextInput = useRef<HTMLTextAreaElement | null>(null);
  const toggleButton = useRef<HTMLButtonElement | null>(null);
  const returnTarget = useRef<HTMLElement | null>(null);

  useEffect(() => () => { pending.current?.abort(); pending.current = null; }, []);

  async function open() {
    returnTarget.current = null;
    if (detail) { setExpanded((value) => !value); return; }
    if (pending.current) return;
    contextInput.current?.blur();
    const controller = new AbortController();
    pending.current = controller;
    setStatus("loading");
    try {
      const reading = await requestDetailedTarotReading({ ...request, additionalContext: context.trim() || undefined }, { signal: controller.signal });
      if (controller.signal.aborted) return;
      setDetail(reading);
      setExpanded(true);
      setStatus("idle");
      onGenerated(reading);
    } catch {
      if (!controller.signal.aborted) setStatus("error");
    } finally {
      if (pending.current === controller) pending.current = null;
    }
  }

  const headingClass = "font-sans text-[11px] uppercase tracking-[0.16em] text-[#8b7a88]";
  const label = t(status === "loading" ? "tarot.flow.chat.deepLoading" : detail
    ? expanded ? "tarot.flow.chat.deepHide" : "tarot.flow.chat.deepShow"
    : status === "error" ? "tarot.flow.chat.deepRetry" : "tarot.flow.chat.deepOpen");

  return (
    <section aria-label={t("tarot.flow.chat.deepTitle")} className="tarot-reading-motion border-t border-[#d8b96e]/28 pt-4" data-reduced-motion={reduceMotion}>
      <h3 className="font-serif text-[19px] text-[#3b3045]">{t("tarot.flow.chat.deepTitle")}</h3>
      <p className="mt-1.5 font-sans text-[12.5px] leading-5 text-[#625467]">{t("tarot.flow.chat.deepBody")}</p>
      <div className="tarot-detail-disclosure" data-open={!detail} aria-hidden={Boolean(detail)} inert={Boolean(detail)}>
        <div className="tarot-detail-clip">
          <div className="pt-3">
            <label htmlFor={contextId} className="block font-sans text-[12px] leading-5 text-[#625467]">{t("tarot.flow.chat.deepContextLabel")}</label>
            <textarea ref={contextInput} id={contextId} rows={2} maxLength={600} value={context} disabled={status === "loading"}
              onChange={(event) => { setContext(event.target.value); onContextChange?.(event.target.value); }}
              placeholder={t("tarot.flow.chat.deepContextPlaceholder")}
              className="mt-1.5 min-h-20 w-full resize-none rounded-[12px] border border-[#7b5b91]/18 bg-white/65 px-3 py-2 font-sans text-[16px] leading-6 text-[#44374d] outline-none focus:border-[#7b5b91]/50 disabled:opacity-60" />
          </div>
        </div>
      </div>
      <button ref={toggleButton} type="button" onClick={() => void open()} disabled={status === "loading"}
        aria-expanded={expanded} aria-controls={contentId}
        className="tarot-reading-press mt-3 flex min-h-11 w-full items-center justify-center gap-2 rounded-[14px] bg-[#735583] px-4 py-3 font-sans text-[13px] font-semibold text-white disabled:opacity-70">
        {status === "loading" && <LoaderCircle aria-hidden="true" size={15} className="tarot-reading-spinner" />}{label}
      </button>
      <div className="min-h-10 pt-2">
        <p role={status === "error" ? "alert" : "status"} className={`font-sans text-[11px] leading-5 ${status === "error" ? "text-[#8b5167]" : "text-center text-[#817382]"}`}>
          {t(status === "loading" ? "tarot.flow.chat.deepLoadingBody" : status === "error" ? "tarot.flow.chat.deepError" : "tarot.flow.chat.deepDemo")}
        </p>
      </div>
      <div id={contentId} className="tarot-detail-disclosure" data-open={expanded} aria-hidden={!expanded} inert={!expanded} data-testid={detail ? "tarot-detailed-reading" : undefined}
        onTransitionEnd={(event) => {
          if (event.target !== event.currentTarget || event.propertyName !== "grid-template-rows" || expanded) return;
          // WebKit cancels smooth scrolling when the closing disclosure changes
          // the scroll range. Wait for that layout to settle before scrolling.
          returnTarget.current?.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "start" });
          returnTarget.current = null;
        }}>
        <div className="tarot-detail-clip">
          {detail && <div className="tarot-detail-content space-y-5 pt-3">
            <section>
              <h4 className={headingClass}>{t("tarot.flow.chat.deepWhy")}</h4>
              {context.trim() && <p className="mt-2 border-l border-[#d8b96e]/50 pl-3 font-serif text-[13px] italic leading-5 text-[#817382]">{context.trim()}</p>}
              <p className="mt-2 font-serif text-[16px] leading-7 text-[#3b3045]">{detail.overall_summary}</p>
            </section>
            <section>
              <h4 className={headingClass}>{t("tarot.flow.chat.deepConnection")}</h4>
              {detail.cards_connection && <p className="mt-2 font-sans text-[13px] leading-6 text-[#625467]">{detail.cards_connection}</p>}
              <div className="mt-3 space-y-4">
                {detail.cards.map((card, index) => <section key={`${index}-${card.card_name}`}>
                  <h5 className="font-serif text-[16px] text-[#3b3045]">{card.position} · {card.card_name}</h5>
                  <p className="mt-1 font-sans text-[13px] leading-6 text-[#625467]">{card.meaning}</p>
                </section>)}
              </div>
            </section>
            {detail.watch_for && <section>
              <h4 className={headingClass}>{t("tarot.flow.chat.deepWatch")}</h4>
              <p className="mt-2 font-sans text-[13px] leading-6 text-[#625467]">{detail.watch_for}</p>
            </section>}
            <section>
              <h4 className={headingClass}>{t("tarot.flow.chat.deepNext")}</h4>
              <p className="mt-2 font-sans text-[13px] leading-6 text-[#55475e]">{detail.final_action_advice}</p>
            </section>
            {onFeedback && <fieldset className="border-t border-[#d8b96e]/28 pt-4">
              <legend className="float-left mb-3 w-full font-serif text-[15px] leading-6 text-[#44374d]">{t("tarot.flow.chat.deepFeedbackQuestion")}</legend>
              <div className="clear-both grid grid-cols-3 gap-2">
                {(["yes", "somewhat", "no"] as const).map((value) => <button key={value} type="button" aria-pressed={feedback === value} onClick={() => onFeedback(value)}
                  className="tarot-reading-press min-h-11 rounded-[12px] border border-[#7b5b91]/20 bg-white/60 px-2 py-2 font-sans text-[12px] text-[#625467] aria-pressed:border-[#735583] aria-pressed:bg-[#735583]/10">
                  {t(`tarot.flow.chat.deepFeedback.${value}`)}
                </button>)}
              </div>
              <p role="status" className="mt-2 min-h-5 font-sans text-[11px] leading-5 text-[#817382]">{feedback ? t("tarot.flow.chat.deepFeedbackThanks") : t("tarot.flow.chat.deepFeedbackPrivacy")}</p>
            </fieldset>}
            <button type="button" className="tarot-reading-press min-h-11 w-full rounded-[12px] border border-[#7b5b91]/20 bg-white/60 px-3 py-2 font-sans text-[13px] text-[#625467]"
              onClick={() => {
                setExpanded(false);
                const target = toggleButton.current?.closest("article")?.querySelector<HTMLElement>('[data-testid="tarot-short-answer"]') ?? toggleButton.current;
                returnTarget.current = target;
                target?.focus({ preventScroll: true });
              }}>
              {t("tarot.flow.chat.deepBackToAnswer")}
            </button>
          </div>}
        </div>
      </div>
    </section>
  );
}
