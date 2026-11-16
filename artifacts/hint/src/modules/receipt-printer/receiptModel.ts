import { SCORE_LABELS, LUCKY_LABELS } from "../home/data/dailyReport";
import { localizeDailyLuckyItem } from "../home/data/dailyLuckyCopy";
import type { HintLanguage } from "../../lib/i18n";
import { getDailyPullById } from "../home/data/dailyPulls";
import type { DailyReport } from "../home/types/home.types";
import { getTarotCardImage } from "../tarot/logic/cardImageMap";
import { RITUAL_TAROT_DECK } from "../tarot/logic/createHiddenDeck";
import { getHintDownloadUrl, type TarotReceiptModel } from "../tarot/logic/shareReceipt";
import { receiptText } from "./receiptStrings";
import { LUCKY_COLOR_SWATCHES } from "../home/components/LuckyIllustration";

/** Receives the displayed snapshot; never draws a card or regenerates a report. */
export function buildDailyReceiptModel(report: DailyReport, language: HintLanguage, includeScores = true): TarotReceiptModel {
  if (!RITUAL_TAROT_DECK.some(card => card.cardId === report.card.cardId)) throw new Error("Unknown daily card");
  const card = getDailyPullById(report.card.cardId, language);
  const localDate = new Date(`${report.date}T12:00:00`);
  if (Number.isNaN(localDate.getTime())) throw new Error("Invalid daily date");
  return {
    kind: "daily",
    language,
    title: receiptText(language, "daily"),
    date: localDate.toLocaleDateString(language, { year: "numeric", month: "long", day: "numeric" }),
    insight: card.whisper,
    cards: [{ name: card.cardName, position: receiptText(language, "card"), orientation: "upright", image: getTarotCardImage(card.cardId, "hint-classic") ?? undefined }],
    downloadUrl: getHintDownloadUrl(),
    daily: includeScores ? {
      scores: report.scores.map(score => ({ key: score.key, label: SCORE_LABELS[language][score.key], score: score.score })),
      lucky: report.lucky.flatMap(item => {
        if (item.key !== "color" && item.key !== "number") return [];
        const canonical = item.illustrationValue ?? item.value;
        return [{ key: item.key, label: LUCKY_LABELS[language][item.key],
          value: localizeDailyLuckyItem({ ...item, value: canonical }, language).value,
          swatch: item.key === "color" ? LUCKY_COLOR_SWATCHES[canonical] : undefined }];
      }),
    } : undefined,
    details: includeScores ? [
      { label: receiptText(language, "energy"), value: String(report.overallScore) },
      ...report.scores.map(score => ({ label: SCORE_LABELS[language][score.key], value: String(score.score) })),
      ...report.lucky.filter(item => item.key === "color" || item.key === "number").map(item => ({ label: LUCKY_LABELS[language][item.key], value: localizeDailyLuckyItem({ ...item, value: item.illustrationValue ?? item.value }, language).value })),
    ] : undefined,
    labels: { brand: "HINT", reading: receiptText(language, "card"), footer: receiptText(language, "footer") },
  };
}
