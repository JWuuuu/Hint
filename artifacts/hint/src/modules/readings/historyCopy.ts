import type { HintLanguage } from "../../lib/i18n";

type HistoryCopy = { readings: string; daily: string; questions: string; openReading: string };
/** Contextual labels avoid translating the verb “read” or adjective “open”. */
export const HISTORY_COPY: Record<HintLanguage, HistoryCopy> = {
  en: { readings: "Readings", daily: "Daily cards", questions: "Questions", openReading: "Open reading" },
  zh: { readings: "阅读", daily: "每日牌", questions: "提问", openReading: "查看解读" },
  es: { readings: "Lecturas", daily: "Cartas diarias", questions: "Preguntas", openReading: "Abrir lectura" },
  ja: { readings: "リーディング", daily: "デイリーカード", questions: "質問", openReading: "リーディングを見る" },
  ko: { readings: "리딩", daily: "오늘의 카드", questions: "질문", openReading: "리딩 보기" },
};
