import { describe, expect, it } from "vitest";
import { DAILY_TAROT_DECK, getDailyPullById } from "./dailyPulls";

describe("translated daily card identities", () => {
  it("covers every card in each supported locale without changing its identity or artwork", () => {
    expect(DAILY_TAROT_DECK).toHaveLength(78);
    for (const card of DAILY_TAROT_DECK) {
      const english = getDailyPullById(card.id, "en");
      for (const language of ["zh", "es", "ja", "ko"] as const) {
        const translated = getDailyPullById(card.id, language);
        expect(translated.cardId).toBe(english.cardId);
        expect(translated.suit).toBe(english.suit);
        for (const key of ["cardName", "whisper", "keyword", "do", "avoid", "love", "work", "self", "themeNote"] as const) {
          expect(translated[key], `${language}:${card.id}:${key}`).toBeTruthy();
          expect(translated[key], `${language}:${card.id}:${key}`).not.toBe(english[key]);
          expect(translated[key]).not.toContain("undefined");
          expect(translated[key]).not.toMatch(/\{(?:domain|rankWhisper|suitWhisper)\}/);
        }
      }
    }
  });

  it("preserves the original major-card advice when the language changes", () => {
    const empress = getDailyPullById("3-empress", "zh");
    expect(empress.work).toBe("整理工作空间，让自己更容易回来继续。");
    expect(getDailyPullById("4-emperor", "es").avoid).toBe("Cargarte de presión por los plazos de otra persona.");
    expect(getDailyPullById("10-wheel", "zh").avoid).toBe("把一次情绪变化当成最终定论。");
    expect(getDailyPullById("16-tower", "es").love).toBe("Sé honesto sobre lo que ya no se siente seguro o verdadero.");
  });

  it("keeps the minor-card narrative and suit domain instead of substituting action tips", () => {
    const wands = getDailyPullById("four-wands", "zh");
    expect(wands.whisper).toContain("更稳定的基础，比更大的动作更重要。");
    expect(wands.whisper).toContain("精力、创造力与行动");
    expect(wands.whisper).toContain("让精力流动，同时给它一个清楚的方向。");
    const pentacles = getDailyPullById("knight-pentacles", "es");
    expect(pentacles.whisper).toContain("Moverse ayuda, pero la dirección importa.");
    expect(pentacles.whisper).toContain("el cuerpo, el trabajo, el dinero y las rutinas");
    expect(pentacles.self).toContain("dinero");
    expect(pentacles.themeNote).toContain("Arcano menor");
    expect(pentacles.themeNote).toContain("el cuerpo, el trabajo, el dinero y las rutinas");
  });

  it("keeps the Japanese Hermit's noise contrast and the Devil's non-punitive guidance", () => {
    expect(getDailyPullById("9-hermit", "ja").whisper).toContain("騒がしい部屋");
    expect(getDailyPullById("15-devil", "ja").self).toBe("気づくことが、抜け出す最初の道です。");
    expect(getDailyPullById("15-devil", "ko").self).toBe("알아차림이 벗어나는 첫걸음이에요.");
  });

  it("retains each major theme and every suit's complete practical context in all four locales", () => {
    const domains = {
      zh: { wands: "精力、创造力与行动", cups: "感受、关系与直觉", swords: "思想、语言与决定", pentacles: "身体、工作、金钱与日常习惯" },
      es: { wands: "la energía, la creatividad y la acción", cups: "los sentimientos, las relaciones y la intuición", swords: "los pensamientos, las palabras y las decisiones", pentacles: "el cuerpo, el trabajo, el dinero y las rutinas" },
      ja: { wands: "エネルギー、創造性、行動", cups: "感情、人との関係、直感", swords: "思考、言葉、決断", pentacles: "体、仕事、お金、日々の習慣" },
      ko: { wands: "에너지, 창의성, 행동", cups: "감정, 관계, 직관", swords: "생각, 말, 결정", pentacles: "몸, 일, 돈, 일상의 습관" },
    };
    for (const language of ["zh", "es", "ja", "ko"] as const) {
      const themes = new Set<string | undefined>();
      for (const card of DAILY_TAROT_DECK) {
        const localized = getDailyPullById(card.id, language);
        if (card.arcana === "major") {
          themes.add(localized.themeNote);
        } else {
          const domain = domains[language][card.suit as keyof typeof domains.zh];
          expect(localized.whisper, `${language}:${card.id}:whisper`).toContain(domain);
          expect(localized.themeNote, `${language}:${card.id}:theme`).toContain(domain);
        }
      }
      expect(themes.size, `${language}:individual major themes`).toBe(22);
    }
  });
});
