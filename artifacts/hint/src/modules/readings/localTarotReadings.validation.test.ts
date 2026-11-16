// @vitest-environment jsdom
import { beforeEach, expect, it } from "vitest";
import { listLocalTarotReadings, parseStructuredTarotReading } from "./localTarotReadings";

const card = { position: "Present", card_name: "The Fool", orientation: "upright", meaning: "A beginning." };
const reading = { signal_type: "clear_signal", overall_summary: "A summary.", cards: [card],
  final_action_advice: "Take a moment.", follow_up_invitation: "What next?" };
beforeEach(() => { localStorage.clear(); localStorage.setItem("hint_anon_id", "owner"); });

it.each([card, {}])("rejects oversized stored/API card arrays before reading their elements", item => {
  let visits = 0;
  const cards = Array.from({ length: 200 }, (_, index) => index);
  for (let index = 0; index < cards.length; index++) {
    Object.defineProperty(cards, index, { get: () => { visits++; return item; } });
  }
  expect(parseStructuredTarotReading({ ...reading, cards })).toBeNull();
  expect(visits).toBe(0);
});

it("preserves valid legacy and detailed readings, optional-field fallback, and trimming", () => {
  expect(parseStructuredTarotReading(reading)).toEqual(reading);
  const detailed = { ...reading, cards_connection: " Connected. ", watch_for: " Notice the pattern. " };
  expect(parseStructuredTarotReading(detailed)).toEqual({ ...reading, cards_connection: "Connected.", watch_for: "Notice the pattern." });
  expect(parseStructuredTarotReading({ ...reading, cards_connection: 12, watch_for: "" })).toEqual({
    ...reading, cards_connection: undefined, watch_for: undefined,
  });
  expect(parseStructuredTarotReading({ ...reading, cards: Array(10).fill(card) })?.cards).toHaveLength(10);
  expect(parseStructuredTarotReading({ ...reading, cards: [] })).toBeNull();
});

it("loads valid saved structured and detailed readings without losing their text", () => {
  const detailed = { ...reading, cards_connection: "Connected.", watch_for: "Notice the pattern." };
  localStorage.setItem("hint_local_tarot_readings_v1", JSON.stringify([{
    id: "saved", anonId: "owner", question: "What should I notice?", spreadType: "single",
    createdAt: "2026-11-10T10:00:00.000Z", cards: [{ cardId: "0-fool", name: "The Fool", orientation: "upright", positionLabel: "Present", keywords: ["beginnings"] }],
    structuredReading: reading, detailedReading: detailed,
  }]));
  const saved = listLocalTarotReadings("owner");
  expect(saved).toHaveLength(1);
  expect(saved[0]!.structuredReading).toEqual(reading);
  expect(saved[0]!.detailedReading).toEqual(detailed);
});
