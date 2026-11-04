import { useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { CRISIS_COPY, CRISIS_HELPLINE_URL, type CrisisLanguage } from "../../../lib/crisisSupport";

/**
 * Shown instead of a reading when a question states an intent to end one's life or to
 * self-harm (T19). Plain on purpose: no cards, no mascot, nothing sent to a model.
 */
export function CrisisSupportPanel({ language, onBack }: { language: CrisisLanguage; onBack: () => void }) {
  const copy = CRISIS_COPY[language];
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => { heading.current?.focus(); }, []);
  return (
    // Same layer and safe-area padding as the other Tarot steps (StepShell), without the guide.
    <motion.section
      data-testid="crisis-support"
      aria-labelledby="crisis-support-title"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, transition: { duration: 0.12 } }}
      transition={{ duration: 0.2 }}
      className="hint-app-scroll absolute inset-0 z-10 flex w-full flex-col overflow-y-auto px-5 pb-[calc(var(--hint-safe-bottom)+1.25rem)] pt-[calc(var(--hint-safe-top)+4.5rem)]"
    >
      <div className="mx-auto w-full max-w-[26rem] rounded-[24px] border border-[#d9c7d3] bg-[#fffaf6] p-5 shadow-[0_16px_46px_rgba(102,72,105,0.10)]">
        <h1 id="crisis-support-title" ref={heading} tabIndex={-1} className="font-serif text-[26px] leading-[1.12] text-[#332d45] outline-none">
          {copy.title}
        </h1>
        <p className="mt-4 text-[15px] leading-[1.6] text-[#3d3348]">{copy.body}</p>
        <a
          href={CRISIS_HELPLINE_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-5 flex min-h-12 w-full items-center justify-center rounded-full bg-[#5f4a6b] px-5 text-center text-[15px] font-bold text-white"
        >
          {copy.helplineLabel}
        </a>
        <button
          type="button"
          onClick={onBack}
          className="mt-3 flex min-h-12 w-full items-center justify-center rounded-full border border-[#cdb9c8] px-5 text-[15px] font-bold text-[#4a3d55]"
        >
          {copy.back}
        </button>
      </div>
    </motion.section>
  );
}
