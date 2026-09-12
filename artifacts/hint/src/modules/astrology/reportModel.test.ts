import { describe, it, expect } from "vitest";
import { normalizeClientNatal } from "@/lib/astro/normalizeClientAstro";
import type { AstroNatalResponse } from "@/lib/astro/astroClient";
import type { BirthProfile, AstroSynastryResponse } from "@/types/astrology";
import { createLetter, REPORT_LANGUAGES, placementLabel } from "./reportModel";
import { placementReading } from "./interpretationLibrary";
import { SIGN_ORDER } from "./astrologyLibrary";
const profile: BirthProfile = {
  id: "fixture",
  name: "Alex",
  birthDate: "2000-01-01",
  birthTime: "08:00",
  birthPlace: "Test City",
  createdAt: "2026-09-12T00:00:00Z",
  updatedAt: "2026-09-12T00:00:00Z",
};
const response = {
  source: "astrologyapi",
  mode: "live",
  cached: false,
  profileHash: "fixture",
  fetchedAt: "2026-09-12T00:00:00Z",
  chart: {
    placements: [
      { body: "sun", sign: "aries", degree: 0.123456 },
      {
        body: "venus",
        sign: "taurus",
        degree: 29.9999,
        retrograde: true,
        house: 2,
      },
      { body: "rising", sign: "taurus", degree: 2.4 },
    ],
    houses: [{ house: 2, sign: "taurus", degree: 23.7654 }],
    aspects: [{ from: "sun", to: "venus", type: "sextile" }],
  },
} as AstroNatalResponse;
const chart = () => normalizeClientNatal(profile, structuredClone(response))!;
describe("curated celestial letters", () => {
  it("counts only returned planets and leaves tied or missing dominance unknown", () => {
    const c = chart();
    expect(c.elementBalance).toMatchObject({
      fire: 1,
      earth: 1,
      air: 0,
      water: 0,
      dominant: undefined,
    });
    expect(c.modalityBalance).toMatchObject({
      cardinal: 1,
      fixed: 1,
      mutable: 0,
      dominant: undefined,
    });
    const empty = normalizeClientNatal(profile, {
      ...response,
      chart: { ...response.chart, placements: [] },
    })!;
    expect(empty.elementBalance.dominant).toBeUndefined();
    expect(empty.modalityBalance.dominant).toBeUndefined();
  });
  it("keeps exact input geometry, separate unknown orb, and all five saved languages", () => {
    const c = chart(),
      letter = createLetter("owner", "generation", c, "en");
    expect(letter.charts.user.placements[0].degree).toBe(0.123456);
    expect(letter.partial).toBe(true);
    for (const lang of REPORT_LANGUAGES) {
      expect(letter.text[lang].chapters).toHaveLength(8);
      expect(
        letter.text[lang].chapters.flatMap((c) => c.passages),
      ).not.toHaveLength(0);
    }
    expect(
      letter.text.en.chapters.find((c) => c.id === "aspects")!.passages[0]
        .title,
    ).toContain("Not supplied");
    c.birthProfile.name = "Changed";
    c.placements[0].degree = 19;
    expect(letter.charts.user.birthProfile.name).toBe("Alex");
    expect(letter.charts.user.placements[0].degree).toBe(0.123456);
    expect(
      letter.text.en.chapters.find((c) => c.id === "emotions")!.passages,
    ).toEqual([]);
    expect(placementLabel(letter.charts.user.placements[1], "en")).toContain(
      "29.9999°",
    );
  });
  it("covers every sign for ten planets and the Ascendant without reusing Venus as Mars", () => {
    for (const sign of SIGN_ORDER)
      for (const body of [
        "sun",
        "moon",
        "rising",
        "mercury",
        "venus",
        "mars",
        "jupiter",
        "saturn",
        "uranus",
        "neptune",
        "pluto",
      ] as const)
        for (const language of REPORT_LANGUAGES) {
          const paragraphs = placementReading(
            { body, sign, meaning: "" },
            language,
          );
          expect(paragraphs.length).toBeGreaterThanOrEqual(2);
          expect(paragraphs.join(" ")).not.toMatch(/undefined|NaN/);
        }
    expect(
      placementReading({ body: "venus", sign: "taurus", meaning: "" }, "en"),
    ).not.toEqual(
      placementReading({ body: "mars", sign: "taurus", meaning: "" }, "en"),
    );
  });
  it("rejects a fallback chart or unproven composite result", () => {
    expect(() =>
      createLetter("owner", "", { ...chart(), mode: "fallback" }, "en"),
    ).toThrow();
    expect(() =>
      createLetter("owner", "", chart(), "en", {
        partner: chart(),
        result: {
          mode: "live",
          aspects: [],
        } as unknown as AstroSynastryResponse,
      }),
    ).toThrow();
  });
  it("retains all cross-person evidence and immutable name ownership", () => {
    const other = chart();
    other.id = "second";
    other.birthProfile = { ...other.birthProfile, name: "Bea" };
    const result = {
      source: "astrologyapi",
      mode: "live",
      fetchedAt: response.fetchedAt,
      calculation: { aspectSource: "hint-geometry" },
      aspects: Array.from({ length: 10 }, (_, i) => ({
        id: `cross-${i}`,
        from: "venus",
        to: "mars",
        type: "trine",
        orb: i / 10,
        separation: 120 + i / 10,
      })),
    } as AstroSynastryResponse;
    const letter = createLetter("owner", "", chart(), "en", {
      partner: other,
      result,
    });
    expect(letter.synastry!.aspects).toHaveLength(10);
    const links = letter.text.en.chapters.find(
      (c) => c.id === "relationships",
    )!.passages;
    expect(links).toHaveLength(10);
    expect(links[0].title).toContain("Alex · Venus → Bea · Mars");
    expect(links[9].evidence).toEqual([{ kind: "aspect", id: "cross-9" }]);
    result.aspects = [];
    expect(letter.synastry!.aspects).toHaveLength(10);
  });
});
