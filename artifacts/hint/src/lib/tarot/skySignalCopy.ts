import type { HintLanguage } from "../i18n";
import { LITERAL_COPY } from "../literalCopy";
import type { SkySignal } from "./skyGuidedTarot";

type Copy = { moon: string; element: string; sun: string; mercury: string; venusSaturn: string; phases: string[] };
export const SKY_SIGNAL_COPY: Record<HintLanguage, Copy> = {
  en: { moon: "General sky reflection: Moon in {sign}", element: "{element} energy is strong today", sun: "Sun in {sign}", mercury: "Mercury sharpens {sign} communication", venusSaturn: "Venus and Saturn highlight self-worth and patterns", phases: ["New Moon opens a clean beginning", "Waxing Moon builds momentum", "Full Moon brings the pattern into view", "Waning Moon asks for release", "Balsamic Moon softens what is ready to close"] },
  zh: { moon: "整体星象参考：月亮位于{sign}", element: "今天{element}能量较强", sun: "太阳位于{sign}", mercury: "水星让{sign}的表达更清晰", venusSaturn: "金星与土星让自我价值和惯有模式更清晰", phases: ["新月开启新的起点", "盈月积蓄前进的力量", "满月让模式更清晰", "亏月提醒你适时放下", "残月让即将结束的事温柔收尾"] },
  es: { moon: "Referencia general del cielo: Luna en {sign}", element: "La energía de {element} destaca hoy", sun: "Sol en {sign}", mercury: "Mercurio afina la comunicación de {sign}", venusSaturn: "Venus y Saturno destacan la autoestima y los patrones", phases: ["La Luna nueva abre un nuevo comienzo", "La Luna creciente impulsa el avance", "La Luna llena revela el patrón", "La Luna menguante invita a soltar", "La Luna balsámica suaviza lo que está listo para cerrar"] },
  ja: { moon: "全体の星空の参考：月は{sign}", element: "今日は{element}のエネルギーが強い日", sun: "太陽は{sign}", mercury: "水星が{sign}の表現を明確にします", venusSaturn: "金星と土星が自己価値やいつものパターンに光を当てます", phases: ["新月が新しい始まりを開きます", "満ちていく月が勢いを育てます", "満月がパターンを明らかにします", "欠けていく月が手放すことを促します", "新月前の月が終わりを優しく包みます"] },
  ko: { moon: "전체 하늘 참고: 달은 {sign}에 있어요", element: "오늘은 {element} 에너지가 강해요", sun: "태양은 {sign}에 있어요", mercury: "수성이 {sign}의 표현을 또렷하게 해요", venusSaturn: "금성과 토성이 자기 가치와 반복되는 패턴을 비춰요", phases: ["신월이 새로운 시작을 열어요", "차오르는 달이 추진력을 키워요", "보름달이 패턴을 드러내요", "기우는 달이 내려놓기를 권해요", "그믐달이 끝맺을 준비가 된 일을 부드럽게 감싸요"] },
};

const PHASE_IDS = ["new-moon", "waxing-moon", "full-moon", "waning-moon", "balsamic-moon"];

/** Translate presentation only. Canonical signal IDs, values and selection stay untouched. */
export function skySignalLabel(signal: SkySignal, language: HintLanguage = "en"): string {
  const copy = SKY_SIGNAL_COPY[language];
  const sign = signal.zodiac && LITERAL_COPY[signal.zodiac]?.[language];
  const element = signal.element && LITERAL_COPY[signal.element]?.[language];
  if (signal.source === "daily-sky") {
    if (signal.id.startsWith("moon-house-") && sign) return copy.moon.replace("{sign}", sign);
    if (signal.id.startsWith("dominant-") && element) return copy.element.replace("{element}", element);
    if (signal.id.startsWith("sun-in-") && sign) return copy.sun.replace("{sign}", sign);
    if (signal.id.startsWith("mercury-in-") && sign) return copy.mercury.replace("{sign}", sign);
    if (signal.id.startsWith("venus-") && signal.bodies.includes("saturn")) return copy.venusSaturn;
    const phase = PHASE_IDS.findIndex(id => signal.id.startsWith(`moon-phase-${id}-`));
    if (phase >= 0) return copy.phases[phase]!;
  }
  // Unknown provider/authored signals retain their meaning rather than being guessed.
  return LITERAL_COPY[signal.label]?.[language] ?? signal.label;
}
