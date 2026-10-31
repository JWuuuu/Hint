/** @vitest-environment jsdom */
import { beforeEach, describe, expect, it } from "vitest";
import { getAnonId } from "../../../lib/identity";
import { normalizeLocalTarotReading, saveLocalTarotReading, type LocalTarotReading } from "../../readings/localTarotReadings";
import { buildTarotSpreadHistory, getTarotSpreadHistory, MAX_SPREAD_HISTORY_BYTES } from "./buildTarotSpreadHistory";

function reading(id: string, overrides: Partial<LocalTarotReading> = {}): LocalTarotReading {
  return normalizeLocalTarotReading({
    id, anonId: getAnonId(), source: "tarot", spreadType: "three", spreadLabel: "Three cards",
    question: "Will we reconnect this month?", story: "We last spoke in September.",
    shortAnswer: "An earlier interpretation.", questionMeaning: "", cardMeanings: [],
    cards: [
      { cardId: "6-lovers", name: "The Lovers", orientation: "reversed", positionLabel: "Their intentions", keywords: [] },
      { cardId: "16-tower", name: "The Tower", orientation: "upright", positionLabel: "Obstacle", keywords: [] },
    ], createdAt: "2026-10-01T12:00:00.000Z", ...overrides,
  });
}

beforeEach(() => localStorage.clear());

describe("saved spread context", () => {
  it("preserves the original question, date, and every ordered card without reusing the active spread", () => {
    const previous = reading("previous");
    const data = JSON.parse(buildTarotSpreadHistory([reading("active"), previous, previous], { activeReadingId: "active" }));
    expect(data).toMatchObject({ availableReadings: 1, includedReadings: 1, omittedReadings: 0 });
    expect(data.readings[0]).toMatchObject({ question: previous.question, createdAt: previous.createdAt, contextExcerpt: previous.story });
    expect(data.readings[0].cards).toEqual(previous.cards.map(({ cardId, name, orientation, positionLabel }) => ({ cardId, name, orientation, position: positionLabel })));
    expect(data.readings[0].answerExcerpt).toBeNull();
  });

  it("reads only the active profile and uses corrections on the next request", () => {
    saveLocalTarotReading(reading("mine"));
    saveLocalTarotReading(reading("private-other-profile", { anonId: "another-owner" }));
    expect(JSON.parse(getTarotSpreadHistory()).readings.map((item: { id: string }) => item.id)).toEqual(["mine"]);
    saveLocalTarotReading(reading("mine", { question: "Will we reconnect next year?", cards: [...reading("mine").cards].reverse() }));
    const history = JSON.parse(getTarotSpreadHistory());
    expect(history.availableReadings).toBe(1);
    expect(history.readings[0].question).toBe("Will we reconnect next year?");
    expect(history.readings[0].cards[0].name).toBe("The Tower");
  });

  it("reports empty or unreadable history without inventing earlier draws", () => {
    expect(JSON.parse(getTarotSpreadHistory())).toMatchObject({ availableReadings: 0, readings: [] });
    localStorage.setItem("hint_local_tarot_readings_v1", "{damaged");
    expect(JSON.parse(getTarotSpreadHistory()).readings).toEqual([]);
  });

  it("keeps all nine supported spread types when the history fits", () => {
    const types = ["single", "three", "relationship", "futureLover", "peachBlossom", "reconciliation", "trueHeart", "loveTree", "xRelationship"];
    const data = JSON.parse(buildTarotSpreadHistory(types.map((spreadType) => reading(spreadType, { spreadType }))));
    expect(data.readings.map((item: { spreadType: string }) => item.spreadType)).toEqual(types);
    expect(data.omittedReadings).toBe(0);
  });

  it("bounds multilingual history by bytes, preserves whole spreads, and declares omissions", () => {
    const readings = Array.from({ length: 80 }, (_, index) => reading(`reading-${index}`, {
      question: index === 79 ? "The exact question" : "問題".repeat(400), story: "背景".repeat(400),
      cards: Array.from({ length: 10 }, (_, position) => ({ ...reading("base").cards[position % 2]!, positionLabel: `位置 ${position}` })),
    }));
    const before = JSON.stringify(readings);
    const serialized = buildTarotSpreadHistory(readings, { question: "The exact question" });
    const data = JSON.parse(serialized);
    expect(new TextEncoder().encode(serialized).length).toBeLessThanOrEqual(MAX_SPREAD_HISTORY_BYTES);
    expect(data.readings[0].id).toBe("reading-79");
    expect(data.omittedReadings).toBeGreaterThan(0);
    expect(data.includedReadings + data.omittedReadings).toBe(80);
    for (const entry of data.readings) expect(entry.cards).toHaveLength(10);
    expect(JSON.stringify(readings)).toBe(before);
  });
});
