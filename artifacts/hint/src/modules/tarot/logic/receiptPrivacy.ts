import { RITUAL_TAROT_DECK, type CardOrientation } from "./createHiddenDeck";
import { getReadableCardMeaning } from "./cardMeanings";

type ReceiptCard = { cardId: string; orientation: CardOrientation };

export function getTarotReceiptInsight(
  cards: readonly ReceiptCard[],
  personalInsight: string,
  includeQuestion: boolean,
) {
  if (includeQuestion && personalInsight.trim()) return personalInsight.trim();

  // AI answers can echo private context. Resolve public copy from canonical IDs,
  // never archived names, keywords, questions, or conversation messages.
  const selected = cards.flatMap((card) => {
    const canonical = RITUAL_TAROT_DECK.find((entry) => entry.cardId === card.cardId);
    return canonical ? [{ ...canonical, orientation: card.orientation }] : [];
  });
  const first = selected[0];
  if (!first) return "Pause, reflect, and choose one thoughtful next step.";
  const last = selected.at(-1)!;
  return (first.cardId === last.cardId ? [first] : [first, last])
    .map((card) => getReadableCardMeaning(card).sentence)
    .join(" ");
}
