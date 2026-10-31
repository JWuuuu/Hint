import type { HintLanguage } from "../../lib/i18n";

type HistoryCopy = { readings: string; daily: string; questions: string; openReading: string; filter: string };
/** Contextual labels avoid translating the verb “read” or adjective “open”. */
export const HISTORY_COPY: Record<HintLanguage, HistoryCopy> = {
  en: { readings: "Readings", daily: "Daily cards", questions: "Questions", openReading: "Open reading", filter: "Show saved entries" },
  zh: { readings: "阅读", daily: "每日牌", questions: "提问", openReading: "查看解读", filter: "筛选已保存记录" },
  es: { readings: "Lecturas", daily: "Cartas diarias", questions: "Preguntas", openReading: "Abrir lectura", filter: "Mostrar entradas guardadas" },
  ja: { readings: "リーディング", daily: "デイリーカード", questions: "質問", openReading: "リーディングを見る", filter: "保存した記録を絞り込む" },
  ko: { readings: "리딩", daily: "오늘의 카드", questions: "질문", openReading: "리딩 보기", filter: "저장한 기록 보기" },
};

export const HISTORY_LOCALES: Record<HintLanguage, string> = { en: "en-US", zh: "zh-CN", es: "es-ES", ja: "ja-JP", ko: "ko-KR" };
