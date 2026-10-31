import { listLocalTarotReadings, type LocalTarotReading } from "../../readings/localTarotReadings";

// Bound UTF-8 bytes as well as characters so non-English history leaves room
// for the active reading and conversation under the API's request limit.
export const MAX_SPREAD_HISTORY_BYTES = 24_000;

type HistoryOptions = {
  activeReadingId?: string;
  question?: string;
};

export function buildTarotSpreadHistory(
  readings: readonly LocalTarotReading[],
  { activeReadingId, question }: HistoryOptions = {},
): string {
  const seen = new Set<string>();
  const normalizedQuestion = question?.trim().toLocaleLowerCase();
  const available = readings.filter((reading) => {
    if (reading.id === activeReadingId || seen.has(reading.id) || !reading.cards.length) return false;
    seen.add(reading.id);
    return true;
  }).sort((a, b) => {
    // Preserve exact-question history first when not everything fits. This is
    // transport priority, not evidence that a newer or repeated draw is truer.
    const aMatches = Boolean(normalizedQuestion && a.question?.trim().toLocaleLowerCase() === normalizedQuestion);
    const bMatches = Boolean(normalizedQuestion && b.question?.trim().toLocaleLowerCase() === normalizedQuestion);
    return Number(bMatches) - Number(aMatches) || Date.parse(b.createdAt) - Date.parse(a.createdAt);
  });
  const entries = available.map((reading) => ({
    id: reading.id,
    createdAt: reading.createdAt,
    question: reading.question ?? null,
    spreadType: reading.spreadType,
    contextExcerpt: reading.story?.slice(0, 600) ?? null,
    answerExcerpt: (reading.detailedReading?.overall_summary
      ?? (reading.interpretationStatus === "ready" ? reading.structuredReading?.overall_summary : undefined))?.slice(0, 600) ?? null,
    cards: reading.cards.map((card) => ({
      cardId: card.cardId,
      name: card.name,
      orientation: card.orientation,
      position: card.positionLabel,
    })),
  }));
  const included: typeof entries = [];
  const serialize = () => JSON.stringify({
    scope: "Saved spreads on this device for the current profile; excludes the active spread. Excerpts are not complete transcripts.",
    availableReadings: available.length,
    includedReadings: included.length,
    omittedReadings: available.length - included.length,
    readings: included,
  });
  const encoder = new TextEncoder();
  for (const entry of entries) {
    included.push(entry);
    if (encoder.encode(serialize()).length > MAX_SPREAD_HISTORY_BYTES) included.pop();
  }
  return serialize();
}

/** Read at request time so corrections, deletions, and profile changes apply. */
export function getTarotSpreadHistory(options: HistoryOptions = {}): string {
  return buildTarotSpreadHistory(listLocalTarotReadings(), options);
}
