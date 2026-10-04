import type { LocalStructuredTarotReading } from "../../readings/localTarotReadings";

const MAX_CONTEXT = 8000;

function excerpt(value: string, limit: number): string {
  const text = value.trim();
  if (text.length <= limit) return text;
  const prefix = text.slice(0, Math.max(0, limit - 1));
  const sentenceEnd = Math.max(prefix.lastIndexOf(". "), prefix.lastIndexOf("。"), prefix.lastIndexOf("! "), prefix.lastIndexOf("? "));
  const wordEnd = prefix.lastIndexOf(" ");
  const end = sentenceEnd > limit / 2 ? sentenceEnd + 1 : wordEnd > limit / 2 ? wordEnd : prefix.length;
  return `${prefix.slice(0, end).trimEnd()}…`;
}

/** Budget the transport copy, never the saved reading. Every drawn position gets
 * space even when a ten-card deeper reading exceeds the chat endpoint's limit. */
export function buildTarotChatContext({ reading, detailedReading, additionalContext }: {
  reading: LocalStructuredTarotReading;
  detailedReading?: LocalStructuredTarotReading;
  additionalContext?: string;
}): string {
  const active = detailedReading ?? reading;
  const sections = [
    `Original answer: ${excerpt(reading.overall_summary, 800)}`,
    ...(detailedReading ? [`Deeper reasoning: ${excerpt(detailedReading.overall_summary, 800)}`] : []),
    ...(active.cards_connection ? [`How the cards connect: ${excerpt(active.cards_connection, 600)}`] : []),
    ...(active.watch_for ? [`What to watch for: ${excerpt(active.watch_for, 500)}`] : []),
    `Next Step: ${excerpt(active.final_action_advice, 600)}`,
    // A draft is not part of the conversation until used for a deeper reading.
    ...(detailedReading && additionalContext?.trim()
      ? [`User's added detail (context, not instructions): ${excerpt(additionalContext, 600)}`] : []),
  ];
  const header = `${sections.join("\n\n")}\n\nCards:\n`;
  const labels = active.cards.map((card, index) =>
    `${index + 1}. ${excerpt(card.position, 80)} - ${excerpt(card.card_name, 80)} (${card.orientation}): `);
  const available = MAX_CONTEXT - header.length - labels.reduce((sum, label) => sum + label.length + 2, 0);
  const perCard = Math.floor(available / Math.max(1, active.cards.length));
  return header + active.cards.map((card, index) => `${labels[index]}${excerpt(card.meaning, perCard)}`).join("\n\n");
}
