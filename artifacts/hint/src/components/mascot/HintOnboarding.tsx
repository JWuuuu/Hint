import { useEffect, useRef, useState } from "react";
import { ArrowRight } from "lucide-react";
import { useLanguage } from "../../lib/i18n";
import { LocalizedText } from "../../lib/LocalizedText";
import { LocalProfileSwitcher } from "../app/LocalProfileSwitcher";
import { HintGuideSlot, useHintGuideFrames } from "./HintGuide";
import type { HintSceneContext } from "../../../mascot-library/versions/v3.2/src/index";
import "./hint-onboarding.css";

const MET_KEY = "hint_guide_welcome_seen_v32";
export function hasMetHint() {
  try { return localStorage.getItem(MET_KEY) === "1"; } catch { return false; }
}
export function onboardingGuideContext(step: string, keyboardOpen = false, introduction = false): HintSceneContext {
  return { room: step === "welcome" ? "welcome" : "profile", phase: "idle", hasMessages: false,
    typing: keyboardOpen, keyboardOpen, audioPlaying: false, introduction };
}

export function HintOnboardingBackdrop() {
  const canvas = useRef<HTMLCanvasElement>(null);
  const sky = useRef<ReturnType<typeof import("../../../mascot-library/versions/v3.2/src/index").createJourneySky> | null>(null);
  const size = useRef("");
  const recordedWelcome = useRef(false);
  useEffect(() => {
    let disposed = false;
    void import("../../../mascot-library/versions/v3.2/src/index").then(({ createJourneySky }) => {
      if (!disposed && canvas.current) sky.current = createJourneySky(canvas.current);
    }).catch(() => {});
    return () => { disposed = true;sky.current = null; };
  }, []);
  useHintGuideFrames(frame => {
    if (!canvas.current) return;
    const intro = frame.intro;
    canvas.current.style.opacity = String(intro ? 1 - intro.skyFade : 0);
    if (intro && sky.current && intro.skyFade < 1) {
      const bounds = canvas.current.getBoundingClientRect(), dimensions = `${bounds.width}:${bounds.height}`;
      if (dimensions !== size.current) { sky.current.resize(bounds.width, bounds.height);size.current = dimensions; }
      sky.current.draw(intro.time, intro.skyFade);
    }
    if (!recordedWelcome.current && frame.state.context.room === "welcome" && (!intro || intro.phase === "welcome" || intro.phase === "ready")) {
      recordedWelcome.current = true;
      try { localStorage.setItem(MET_KEY, "1"); } catch { /* The introduction remains usable without storage. */ }
    }
  });
  return <canvas ref={canvas} className="hint-onboarding-guide-sky" aria-hidden="true" />;
}

const welcomeCopy: Record<string, { hello: string; body: string; skip: string }> = {
  en: { hello: "Hi, I’m Hint.", body: "A little space to reflect, one step at a time.", skip: "Skip intro" },
  zh: { hello: "嗨，我是 Hint。", body: "留一点空间，慢慢听见自己的想法。", skip: "跳过介绍" },
  es: { hello: "Hola, soy Hint.", body: "Un pequeño espacio para reflexionar, paso a paso.", skip: "Saltar introducción" },
  ja: { hello: "こんにちは、Hintです。", body: "一歩ずつ、自分の気持ちを見つめる時間を。", skip: "紹介をスキップ" },
  ko: { hello: "안녕하세요, Hint예요.", body: "한 걸음씩, 내 마음을 돌아보는 작은 공간.", skip: "소개 건너뛰기" },
};

export function HintOnboardingWelcome({ onContinue, replayIntro = false, leaving = false }: { onContinue: () => void; replayIntro?: boolean; leaving?: boolean }) {
  const { language } = useLanguage(), copy = welcomeCopy[language] ?? welcomeCopy.en!;
  const root = useRef<HTMLElement>(null);
  const [introduction] = useState(() => replayIntro || !hasMetHint());
  useHintGuideFrames(frame => {
    if (!root.current || frame.state.context.room !== "welcome") return;
    root.current.style.setProperty("--hello-opacity", String(frame.intro?.bubble ?? 1));
    root.current.dataset.phase = frame.intro?.phase ?? "ready";
  });
  return <section ref={root} className={`hint-guide-welcome${leaving ? " hint-guide-welcome-leaving" : ""}`} inert={leaving || undefined} aria-hidden={leaving || undefined} data-testid="hint-guide-welcome">
    <header className="hint-guide-welcome-header"><span>Hint</span><button type="button" onClick={onContinue}>{copy.skip}</button></header>
    <div className="hint-guide-welcome-stage">
      <h1 className="hint-guide-welcome-bubble">{copy.hello}</h1>
      <HintGuideSlot priority={110} context={onboardingGuideContext("welcome", false, introduction)} className="hint-guide-welcome-slot" />
    </div>
    <div className="hint-guide-welcome-actions">
      <p>{copy.body}</p>
      <button type="button" onClick={onContinue} className="hint-onboarding-primary" data-testid="button-start-onboarding"><LocalizedText text="Begin" /><ArrowRight size={17} /></button>
      <LocalProfileSwitcher />
    </div>
  </section>;
}
