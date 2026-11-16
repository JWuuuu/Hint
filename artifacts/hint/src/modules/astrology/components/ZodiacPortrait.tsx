import { useId } from "react";
import { ArrowRight } from "lucide-react";
import type { HintLanguage } from "@/lib/i18n";
import type { NatalChart, ZodiacSign } from "@/types/astrology";
import { astroText, type AstroCopy } from "../astrologyCopy";
import { bodyName, SIGN_ORDER, signArticle, signName } from "../astrologyLibrary";
import { ZodiacSymbol } from "./NatalWheel";
import "./zodiac-portrait.css";

const PLACEMENTS = ["rising", "sun", "moon", "mercury", "venus", "mars", "north_node", "juno"] as const;
type PortraitBody = (typeof PLACEMENTS)[number];

const copy = {
  firstLine: ["Independent mind.", "思考独立。", "Mente independiente.", "自由な発想。", "독립적인 생각."],
  secondLine: ["Curious heart.", "保持好奇。", "Corazón curioso.", "好奇心に満ちた心。", "호기심 가득한 마음."],
  title: ["Your zodiac portrait", "你的星座画像", "Tu retrato zodiacal", "あなたの星座ポートレート", "나의 별자리 초상"],
  read: ["Read my portrait", "阅读我的画像", "Leer mi retrato", "私のポートレートを読む", "나의 초상 읽기"],
  rising: ["Rising", "上升", "Ascendente", "アセンダント", "상승점"],
  northNode: ["North Node", "北交点", "Nodo Norte", "ドラゴンヘッド", "북노드"],
  juno: ["Juno", "婚神星", "Juno", "ジュノー", "주노"],
  unavailable: ["Unavailable", "暂无数据", "Sin datos", "データなし", "데이터 없음"],
} satisfies Record<string, AstroCopy>;

const GLYPH_PATHS = {
  sun: "M12 2.5a9.5 9.5 0 1 0 0 19 9.5 9.5 0 0 0 0-19Z M12 11.25a.75.75 0 1 0 0 1.5.75.75 0 0 0 0-1.5Z",
  moon: "M9.5 2.8a9.5 9.5 0 1 1-4.6 17.1A9.5 9.5 0 0 0 9.5 2.8Z",
  mercury: "M12 5.5a5.5 5.5 0 1 0 0 11 5.5 5.5 0 0 0 0-11ZM6.5 2.5q1.2 3 5.5 3t5.5-3M12 16.5v5.5M8.5 20h7",
  venus: "M12 2.5a6.25 6.25 0 1 0 0 12.5 6.25 6.25 0 0 0 0-12.5ZM12 15v7m-3.5-3.5h7",
  mars: "M9.5 8a6.5 6.5 0 1 0 0 13 6.5 6.5 0 0 0 0-13Zm4.7 1.8 7-7m-5.4 0h5.4v5.4",
  north_node: "M6 16a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5Zm12 0a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5ZM6 16C2 2 22 2 18 16",
  juno: "M12 2v20M5.5 6 12 12l6.5-6M4.5 12h15m-11 5h7",
} as const;

function PlacementGlyph({ body }: { body: PortraitBody }) {
  return body === "rising" ? (
    <span className="zodiac-portrait-glyph zodiac-portrait-asc" aria-hidden="true">ASC</span>
  ) : (
    <svg className="zodiac-portrait-glyph" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={GLYPH_PATHS[body]} />
    </svg>
  );
}

function isZodiacSign(sign: unknown): sign is ZodiacSign {
  return SIGN_ORDER.includes(sign as ZodiacSign);
}

function placementName(body: PortraitBody, language: HintLanguage): string {
  if (body === "rising") return astroText(language, copy.rising);
  if (body === "north_node") return astroText(language, copy.northNode);
  if (body === "juno") return astroText(language, copy.juno);
  return bodyName(body, language);
}

function PortraitCenter({ sign, language }: { sign?: ZodiacSign; language: HintLanguage }) {
  if (!sign) return <div className="zodiac-portrait-center" aria-hidden="true" />;
  return (
    <div className="zodiac-portrait-center" aria-hidden="true">
      <span>{signName(sign, language)}</span>
      {sign === "aquarius" ? (
        <svg className="zodiac-portrait-waves" viewBox="0 0 80 61" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round">
          <path d="M5 16C21 3 28 3 40 9S58 17 75 4M5 33C21 20 28 20 40 26S58 34 75 21M5 50C21 37 28 37 40 43S58 51 75 38" />
        </svg>
      ) : <ZodiacSymbol className="zodiac-portrait-sign-symbol" index={SIGN_ORDER.indexOf(sign)} />}
    </div>
  );
}

type ZodiacPortraitProps = {
  chart: NatalChart;
  language: HintLanguage;
  onOpenPortrait: () => void;
  onSelectPlacement: (body: string) => void;
};

export function ZodiacPortrait({ chart, language, onOpenPortrait, onSelectPlacement }: ZodiacPortraitProps) {
  const headingId = useId();
  const summarySigns: Partial<Record<PortraitBody, ZodiacSign>> = {
    rising: chart.risingSign,
    sun: chart.sunSign,
    moon: chart.moonSign,
    venus: chart.venusSign,
    mars: chart.marsSign,
  };
  const placements = PLACEMENTS.map(body => {
    const source = body === "north_node" || body === "juno" ? chart.additionalPlacements ?? [] : chart.placements;
    const placement = source.find(item => item.body === body && isZodiacSign(item.sign));
    const sign = placement?.sign ?? summarySigns[body];
    return { body, sign: isZodiacSign(sign) ? sign : undefined };
  });
  const sunSign = placements.find(item => item.body === "sun")?.sign;
  const heading = sunSign === "aquarius" ? (
    <>{astroText(language, copy.firstLine)}<br />{" "}{astroText(language, copy.secondLine)}</>
  ) : sunSign ? signArticle(sunSign, language).theme : astroText(language, copy.title);

  return (
    <section className="zodiac-portrait" aria-labelledby={headingId} data-testid="zodiac-portrait">
      <h2 className="zodiac-portrait-heading" id={headingId}>{heading}</h2>
      <div className="zodiac-portrait-grid">
        {placements.map(({ body, sign }) => {
          const label = placementName(body, language);
          const value = sign ? signName(sign, language) : astroText(language, copy.unavailable);
          const tile = (
            <>
              <PlacementGlyph body={body} />
              <span className="zodiac-portrait-placement">{label}</span>
              <span className="zodiac-portrait-result">{value}</span>
            </>
          );
          return sign ? (
            <button key={body} type="button" className="zodiac-portrait-tile" data-placement={body} aria-label={`${label} ${value}`} onClick={() => onSelectPlacement(body)}>
              {tile}
            </button>
          ) : (
            <div key={body} className="zodiac-portrait-tile" data-placement={body} data-unavailable="true">
              {tile}
            </div>
          );
        })}
        <PortraitCenter sign={sunSign} language={language} />
      </div>
      <button type="button" className="zodiac-portrait-cta" onClick={onOpenPortrait}>
        {astroText(language, copy.read)}
        <ArrowRight size={19} strokeWidth={1.5} aria-hidden="true" />
        <span className="zodiac-portrait-cta-rim" aria-hidden="true">
          <span className="zodiac-portrait-cta-trail" />
        </span>
      </button>
    </section>
  );
}
