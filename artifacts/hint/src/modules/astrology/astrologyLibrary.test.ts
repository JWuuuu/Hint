import { describe, expect, it } from "vitest";
import type { HintLanguage } from "../../lib/i18n";
import { SIGN_ORDER, SIGN_SYMBOLS, aspectDescription, aspectName, bodyDescription, bodyName, canonicalBody, houseDescription, signArticle, signName } from "./astrologyLibrary";

const languages: HintLanguage[] = ["en", "zh", "es", "ja", "ko"];
const bodies = ["sun", "moon", "rising", "mercury", "venus", "mars", "jupiter", "saturn", "uranus", "neptune", "pluto"];
const aspects = ["conjunction", "sextile", "square", "trine", "opposition"];

describe("astrology educational library", () => {
  it.each(languages)("offers distinct, complete authored articles and explanations in %s", language => {
    const articles = SIGN_ORDER.map(sign => signArticle(sign, language));
    for (const field of ["theme", "description", "example", "question", "sun", "moon", "rising"] as const) {
      expect(new Set(articles.map(article => article[field])).size).toBe(12);
      for (const [index, article] of articles.entries()) {
        expect(article[field].length).toBeGreaterThan(4);
        expect(article[field]).not.toMatch(/undefined|\{[^}]+\}|TODO/);
        if (language !== "en") expect(article[field]).not.toBe(signArticle(SIGN_ORDER[index]!, "en")[field]);
      }
    }
    for (const sign of SIGN_ORDER) expect(signName(sign, language)).toBeTruthy();
    for (const body of bodies) {
      expect(bodyName(body, language)).toBeTruthy();
      expect(bodyDescription(body, language).length).toBeGreaterThan(20);
      if (language !== "en") expect(bodyDescription(body, language)).not.toBe(bodyDescription(body, "en"));
    }
    for (let house = 1; house <= 12; house++) {
      expect(houseDescription(house, language).length).toBeGreaterThan(20);
      if (language !== "en") expect(houseDescription(house, language)).not.toBe(houseDescription(house, "en"));
    }
    for (const aspect of aspects) {
      expect(aspectName(aspect, language)).toBeTruthy();
      expect(aspectDescription(aspect, language).length).toBeGreaterThan(20);
      if (language !== "en") expect(aspectDescription(aspect, language)).not.toBe(aspectDescription(aspect, "en"));
    }
  });
  it("keeps the zodiac order and element/modality categories aligned", () => {
    expect(SIGN_ORDER).toHaveLength(12);
    expect(new Set(SIGN_ORDER).size).toBe(12);
    expect(SIGN_SYMBOLS).toEqual(["♈", "♉", "♊", "♋", "♌", "♍", "♎", "♏", "♐", "♑", "♒", "♓"]);
    expect(SIGN_ORDER.filter(sign => signArticle(sign, "en").element === "Fire")).toEqual(["aries", "leo", "sagittarius"]);
    expect(SIGN_ORDER.filter(sign => signArticle(sign, "en").element === "Earth")).toEqual(["taurus", "virgo", "capricorn"]);
    expect(SIGN_ORDER.filter(sign => signArticle(sign, "en").element === "Air")).toEqual(["gemini", "libra", "aquarius"]);
    expect(SIGN_ORDER.filter(sign => signArticle(sign, "en").element === "Water")).toEqual(["cancer", "scorpio", "pisces"]);
    expect(SIGN_ORDER.filter(sign => signArticle(sign, "en").modality === "Cardinal")).toEqual(["aries", "cancer", "libra", "capricorn"]);
    expect(SIGN_ORDER.filter(sign => signArticle(sign, "en").modality === "Fixed")).toEqual(["taurus", "leo", "scorpio", "aquarius"]);
  });
  it("explains the five major angles and recognizes provider aliases", () => {
    for (const [aspect, angle] of [["conjunction", 0], ["sextile", 60], ["square", 90], ["trine", 120], ["opposition", 180]] as const) {
      for (const language of languages) expect(aspectDescription(aspect, language)).toContain(`${angle}°`);
    }
    expect(aspectName("Conjunct", "zh")).toBe(aspectName("conjunction", "zh"));
    expect(aspectName("opposite", "ja")).toBe(aspectName("opposition", "ja"));
    expect(bodyName("Ascendant", "ko")).toBe(bodyName("rising", "ko"));
    expect(bodyDescription("rising", "en")).toContain("not a planet");
  });
  it("leaves unknown provider points identifiable without inventing a matching explanation", () => {
    expect(bodyName("Unmapped point", "ja")).toBe("Unmapped point");
    expect(bodyDescription("Unmapped point", "en")).toContain("no explanation");
    expect(aspectName("Quincunx", "es")).toBe("Quincunx");
    for (const house of [0, 13, 1.5, NaN]) expect(houseDescription(house, "en")).toContain("1 to 12");
  });
  it("maps supported provider body aliases to actual placement IDs and rejects unknown points", () => {
    for (const body of bodies) expect(canonicalBody(body.toUpperCase())).toBe(body);
    for (const alias of ["Ascendant", "ASC", " rising "]) expect(canonicalBody(alias)).toBe("rising");
    // A provider Ascendant previously navigated to 'ascendant', which never matches a natal placement.
    const returned = [{ body: "rising" }];
    expect(returned.find(p => p.body === "Ascendant".toLowerCase())).toBeUndefined();
    expect(returned.find(p => p.body === canonicalBody("Ascendant"))).toEqual(returned[0]);
    for (const unknown of ["MC", "Midheaven", "Chiron", "constructor", "__proto__", ""]) {
      expect(canonicalBody(unknown)).toBeNull();
      expect(bodyName(unknown, "en")).toBe(unknown);
      expect(bodyDescription(unknown, "en")).toContain("no explanation");
    }
  });
});
