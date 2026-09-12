import { TRANSLATIONS, type HintLanguage } from "../../../lib/i18n";
import { translateText } from "../../../lib/LocalizedText";
import { getDailyPullById } from "../../home/data/dailyPulls";
import { RITUAL_TAROT_DECK } from "./createHiddenDeck";

const canonicalIds = new Set(RITUAL_TAROT_DECK.map(card => card.cardId));
export function receiptCardName(cardId: string, index: number, language: HintLanguage) {
  return canonicalIds.has(cardId) ? getDailyPullById(cardId, language).cardName : receiptPosition("", index, language);
}
export function receiptSpreadLabel(spreadId: string, language: HintLanguage) {
  return TRANSLATIONS[language][`tarot.spread.${spreadId}.label`] ?? translateText("Tarot reading", language);
}
export function receiptPosition(spreadId: string, index: number, language: HintLanguage) {
  return TRANSLATIONS[language][`tarot.spread.${spreadId}.positionLabels`]?.split("|")[index]
    ?? TRANSLATIONS[language]["tarot.flow.pick.card"].replace("{number}", String(index + 1));
}
export function receiptOriginalTextLabel(includePersonalText: boolean, language: HintLanguage) {
  if (language === "en") return undefined;
  return includePersonalText ? TRANSLATIONS[language]["quality.originalText"] : translateText("Card reflection · original English", language);
}
