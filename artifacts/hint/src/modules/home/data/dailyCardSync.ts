import type { HintLanguage } from "../../../lib/i18n";
import type { DailyPull } from "../types/home.types";
import { getDailyPullById } from "./dailyPulls";

export type SavedDailyCard = {
  pullDate: string;
  cardId: string;
  cardName: string;
  whisper: string;
};

/** Hydrates the saved server draw with the full local tarot metadata. */
export function getSyncedDailyCard(
  savedPull: SavedDailyCard | null,
  selectedDateKey: string,
  language: HintLanguage,
): DailyPull | null {
  if (!savedPull || savedPull.pullDate !== selectedDateKey) return null;

  const canonical = getDailyPullById(savedPull.cardId, language);
  return {
    ...canonical,
    cardName: language === "en" ? savedPull.cardName || canonical.cardName : canonical.cardName,
    whisper: language === "en" ? savedPull.whisper || canonical.whisper : canonical.whisper,
  };
}

/** All card-specific copy must describe the frozen identity, never a freshly sampled candidate. */
export function withDailyCardIdentity(base: DailyPull, cardId: string, language: HintLanguage): DailyPull {
  const card = getDailyPullById(cardId, language);
  const why = {
    en: `${card.cardName} is your saved daily card. Its theme is ${card.keyword}. This reflection follows the card you revealed.`,
    zh: `${card.cardName}是你已保存的今日牌。主题是${card.keyword}。此反思对应你已揭示的牌。`,
    es: `${card.cardName} es tu carta diaria guardada. Su tema es ${card.keyword}. Esta reflexión corresponde a la carta revelada.`,
    ja: `${card.cardName}は保存された今日のカードです。テーマは${card.keyword}です。公開したカードに基づく振り返りです。`,
    ko: `${card.cardName}은 저장된 오늘의 카드입니다. 주제는 ${card.keyword}입니다. 공개한 카드에 따른 성찰입니다.`,
  };
  // A frozen receipt proves the card identity, not that today's newly sampled
  // candidate pool selected it. Do not attach another candidate's sky evidence.
  return { ...card, themeNote: why[language], skyGuided: undefined };
}
