import { describe, expect, it } from "vitest";
import { getSyncedDailyCard, withDailyCardIdentity } from "./dailyCardSync";

const savedPull = {
  pullDate: "2026-09-02",
  cardId: "17-star",
  cardName: "The Star",
  whisper: "A saved message from today's draw.",
};

describe("getSyncedDailyCard", () => {
  it("uses the saved card for the matching daily report", () => {
    const card = getSyncedDailyCard(savedPull, "2026-09-02", "en");

    expect(card?.cardId).toBe("17-star");
    expect(card?.cardName).toBe("The Star");
    expect(card?.whisper).toBe("A saved message from today's draw.");
    expect(card?.keyword).toBeTruthy();
  });

  it("does not leak today's card into another calendar day", () => {
    expect(getSyncedDailyCard(savedPull, "2026-09-03", "en")).toBeNull();
  });
  it("uses the current locale for an archived card without changing its saved identity", () => {
    const translated = getSyncedDailyCard(savedPull, savedPull.pullDate, "ja");
    expect(translated?.cardId).toBe(savedPull.cardId);
    expect(translated?.cardName).not.toBe(savedPull.cardName);
    expect(translated?.whisper).not.toBe(savedPull.whisper);
  });
  it("never carries a newly sampled candidate's explanation into an already revealed card", () => {
    const card = withDailyCardIdentity({ cardId: "18-moon", cardName: "The Moon", whisper: "Another draw", skyGuided: { selectedCardId: "18-moon", whyThisCard: "Old candidate explanation" } as any }, "3-empress", "en");
    expect(card.cardId).toBe("3-empress");
    expect(card.themeNote).toContain("The Empress");
    expect(card.themeNote).not.toContain("Moon");
    expect(card.skyGuided).toBeUndefined();
  });
});
