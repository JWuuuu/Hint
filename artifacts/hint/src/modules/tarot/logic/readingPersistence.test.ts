/** @vitest-environment jsdom */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  getLocalTarotReading,
  listLocalTarotReadings,
  normalizeLocalTarotReading,
  parseStructuredTarotReading,
  patchLocalTarotReading,
  saveLocalTarotReading,
  type LocalTarotReading,
} from "../../readings/localTarotReadings";
import {
  buildTarotReceiptModel,
  getTarotReceiptCardLayout,
} from "./shareReceipt";

const STORAGE_KEY = "hint_local_tarot_readings_v1";

beforeEach(() => localStorage.clear());
afterEach(() => vi.restoreAllMocks());

function legacyReading() {
  return {
    id: "tarot-old",
    anonId: "anon-1",
    source: "tarot" as const,
    spreadType: "three",
    spreadLabel: "Three cards",
    question: "What should stay private?",
    cardArtId: "original" as const,
    shortAnswer: "Keep the next step simple.",
    questionMeaning: "Pause before acting.",
    cardMeanings: ["Now: listen"],
    cards: [
      {
        cardId: "2-high-priestess",
        name: "The High Priestess",
        orientation: "upright" as const,
        positionLabel: "Now",
        keywords: ["intuition"],
      },
    ],
    createdAt: "2026-09-02T12:00:00.000Z",
  };
}

describe("Tarot reading v2 persistence", () => {
  it("saves detail separately and ignores damaged detail without changing the basic answer", () => {
    const original = legacyReading();
    const detail = {
      signal_type: "opening" as const, overall_summary: "A detailed answer.",
      cards: [{ card_name: "The High Priestess", position: "Now", orientation: "upright" as const, meaning: "A detailed card explanation." }],
      final_action_advice: "Ask one clear question.", follow_up_invitation: "What else?",
      cards_connection: "Listen before assuming you know the answer.", watch_for: "Check whether a direct conversation changes your assumption.",
    };
    const result = saveLocalTarotReading({ ...original, detailedReading: detail, detailedContext: "I have fifteen minutes.", detailedFeedback: "somewhat" });
    expect(getLocalTarotReading(result.reading.id, original.anonId)?.detailedReading).toEqual(detail);
    expect(getLocalTarotReading(result.reading.id, original.anonId)).toMatchObject({ detailedContext: "I have fifteen minutes.", detailedFeedback: "somewhat" });
    const damaged = normalizeLocalTarotReading({ ...result.reading, detailedReading: { ...detail, cards: [{ ...detail.cards[0]!, card_name: "The Tower" }] } });
    expect(damaged.detailedReading).toBeUndefined();
    expect(damaged.shortAnswer).toBe(original.shortAnswer);
    expect(damaged.cards[0]?.cardId).toBe(original.cards[0]!.cardId);
    const damagedOptional = normalizeLocalTarotReading({ ...result.reading, detailedFeedback: "unexpected", detailedContext: "a".repeat(700), detailedReading: { ...detail, cards_connection: {}, watch_for: null } });
    expect(damagedOptional.detailedFeedback).toBeUndefined();
    expect(damagedOptional.detailedContext).toHaveLength(600);
    expect(damagedOptional.detailedReading?.overall_summary).toBe(detail.overall_summary);
    expect(damagedOptional.detailedReading?.cards_connection).toBeUndefined();
    expect(damagedOptional.detailedReading?.watch_for).toBeUndefined();
  });
  it("reports quota failure without losing the draft or changing previous History", () => {
    saveLocalTarotReading(legacyReading());
    const previous = localStorage.getItem(STORAGE_KEY);
    const changed = vi.fn();
    window.addEventListener("hint:local-tarot-readings-updated", changed);
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("Storage is full", "QuotaExceededError");
    });
    const result = saveLocalTarotReading({ ...legacyReading(), id: "new-reading" });
    expect(result.saved).toBe(false);
    expect(result.reading.id).toBe("new-reading");
    expect(result.reading.cards).toEqual(legacyReading().cards);
    expect(localStorage.getItem(STORAGE_KEY)).toBe(previous);
    expect(changed).not.toHaveBeenCalled();
    expect(patchLocalTarotReading("tarot-old", { shortAnswer: "New answer" }, "anon-1")).toBeNull();
    expect(localStorage.getItem(STORAGE_KEY)).toBe(previous);
    window.removeEventListener("hint:local-tarot-readings-updated", changed);
  });

  it.each(["{unfinished", '{"unexpected":"object"}'])("does not overwrite an unreadable collection: %s", (raw) => {
    localStorage.setItem(STORAGE_KEY, raw);
    expect(saveLocalTarotReading(legacyReading()).saved).toBe(false);
    expect(localStorage.getItem(STORAGE_KEY)).toBe(raw);
    expect(listLocalTarotReadings("anon-1")).toEqual([]);
  });

  it("preserves damaged entries and another user's matching id when saving", () => {
    const damaged = { ...legacyReading(), id: "damaged", cards: [null], privateNote: "Recover later" };
    const otherUser = { ...legacyReading(), anonId: "anon-2" };
    localStorage.setItem(STORAGE_KEY, JSON.stringify([damaged, otherUser, null]));
    expect(saveLocalTarotReading(legacyReading()).saved).toBe(true);
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY)!);
    expect(stored).toContainEqual(damaged);
    expect(stored).toContainEqual(otherUser);
    expect(stored).toContain(null);
    expect(listLocalTarotReadings("anon-1").map((reading) => reading.id)).toEqual(["tarot-old"]);
  });

  it("recovers malformed interpretation metadata without changing the selected card", () => {
    const damaged = {
      ...legacyReading(),
      question: 123,
      shortAnswer: { incomplete: true },
      cardMeanings: [null, "Keep this position"],
      createdAt: "not a date",
      interpretationStatus: "ready",
      structuredReading: { cards: [{ meaning: null }] },
      roomDesign: { backgroundId: "sea", cardArtId: [], backStyle: "unknown", cardBackId: 4 },
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify([damaged]));
    const restored = getLocalTarotReading("tarot-old", "anon-1")!;
    expect(restored.cards[0]?.cardId).toBe("2-high-priestess");
    expect(restored.structuredReading).toBeUndefined();
    expect(restored.interpretationStatus).toBe("local");
    expect(restored.shortAnswer).toBe("");
    expect(restored.question).toBeUndefined();
    expect(restored.cardMeanings).toEqual(["", "Keep this position"]);
    expect(Number.isFinite(Date.parse(restored.createdAt))).toBe(true);
    expect(restored.roomDesign).toMatchObject({ backgroundId: "sea", cardArtId: "original", backStyle: "rose" });
    expect(typeof restored.roomDesign?.cardBackId).toBe("string");
  });

  it.each([null, {}, { cards: [] }, { overall_summary: 3, cards: [{ meaning: null }] }])("rejects an incomplete structured response: %j", (response) => {
    expect(parseStructuredTarotReading(response)).toBeNull();
  });

  it("preserves a complete interpretation without truncating its copy", () => {
    const response = {
      signal_type: "opening",
      overall_summary: "A complete thought. ".repeat(80),
      cards: [{ position: "Now", card_name: "The High Priestess", orientation: "upright", meaning: "Listen carefully. ".repeat(80) }],
      final_action_advice: "Take one small step.",
      follow_up_invitation: "What would you like to understand?",
    };
    const parsed = parseStructuredTarotReading(response)!;
    expect(parsed.overall_summary).toBe(response.overall_summary.trim());
    expect(parsed.cards[0]?.meaning).toBe(response.cards[0]!.meaning.trim());
    const restored = normalizeLocalTarotReading({ ...legacyReading(), structuredReading: { ...parsed, cards: [...parsed.cards, ...parsed.cards] } });
    expect(restored.structuredReading).toBeUndefined();
    expect(restored.interpretationStatus).toBe("local");
  });

  it("migrates a v1 reading without losing its card identity", () => {
    const migrated = normalizeLocalTarotReading(legacyReading());

    expect(migrated.schemaVersion).toBe(2);
    expect(migrated.chatMessages).toEqual([]);
    expect(migrated.interpretationStatus).toBeUndefined();
    expect(migrated.cards[0]?.visualId).toBe(
      "tarot-old-0-2-high-priestess",
    );
  });

  it.each(["pending", "local", "ready"] as const)("preserves the %s interpretation state", (status) => {
    expect(normalizeLocalTarotReading({
      ...legacyReading(),
      interpretationStatus: status,
    }).interpretationStatus).toBe(status);
  });

  it("ignores an invalid stored interpretation state", () => {
    expect(normalizeLocalTarotReading({
      ...legacyReading(),
      interpretationStatus: "invalid" as LocalTarotReading["interpretationStatus"],
    }).interpretationStatus).toBeUndefined();
  });

  it("keeps valid persisted chat while dropping malformed messages", () => {
    const migrated = normalizeLocalTarotReading({
      ...legacyReading(),
      chatMessages: [
        { id: "u1", role: "user", content: "Tell me more" },
        { id: "bad", role: "system" as "assistant", content: "hidden" },
      ],
    });

    expect(migrated.chatMessages).toEqual([
      { id: "u1", role: "user", content: "Tell me more" },
    ]);
  });

  it("keeps valid History entries when another stored reading is damaged", () => {
    const valid = legacyReading();
    localStorage.setItem(
      "hint_local_tarot_readings_v1",
      JSON.stringify([
        { ...valid, id: "tarot-damaged", cards: [null] },
        valid,
      ]),
    );

    expect(listLocalTarotReadings("anon-1").map((reading) => reading.id)).toEqual([
      "tarot-old",
    ]);
  });

  it("never places chat into the share receipt and hides the question by default", () => {
    const reading: LocalTarotReading = {
      ...normalizeLocalTarotReading(legacyReading()),
      shortAnswer: `For "${legacyReading().question}", listen to your intuition.`,
      chatMessages: [
        { id: "u1", role: "user", content: "Private follow-up" },
      ],
    };
    const privateReceipt = buildTarotReceiptModel(
      reading,
      false,
      "https://hint.example/download",
    );
    const optedInReceipt = buildTarotReceiptModel(
      reading,
      true,
      "https://hint.example/download",
    );

    expect(privateReceipt.question).toBeUndefined();
    expect(JSON.stringify(privateReceipt)).not.toContain(reading.question);
    expect(privateReceipt.insight).not.toBe(reading.shortAnswer);
    expect(JSON.stringify(privateReceipt)).not.toContain("Private follow-up");
    expect(optedInReceipt.question).toBe(reading.question);
    expect(optedInReceipt.insight).toBe(reading.shortAnswer);
    expect(JSON.stringify(optedInReceipt)).not.toContain("Private follow-up");
  });

  it.each([1, 3, 5, 7, 9])(
    "keeps a %i-card receipt inside the printable canvas",
    (cardCount) => {
      const layout = getTarotReceiptCardLayout(cardCount);
      expect(layout.startX).toBeGreaterThanOrEqual(70);
      expect(layout.startX + layout.visibleWidth).toBeLessThanOrEqual(830);
      expect(layout.cardWidth).toBeGreaterThanOrEqual(75);
    },
  );
});
