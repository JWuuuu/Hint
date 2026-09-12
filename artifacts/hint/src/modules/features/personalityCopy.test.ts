import { expect, it } from "vitest";
import { PERSONALITY_TRANSLATIONS } from "./personalityCopy";
it("all 18 personality results include names, descriptions and traits in all supported translations", () => {
  expect(Object.keys(PERSONALITY_TRANSLATIONS)).toHaveLength(18);
  for (const result of Object.values(PERSONALITY_TRANSLATIONS)) for (const locale of ["zh", "es", "ja", "ko"] as const) {
    expect(result[locale]?.name).toBeTruthy(); expect(result[locale]?.body).toBeTruthy();
    expect(result[locale]?.subtitle).toBeTruthy(); expect(result[locale]?.traits).toHaveLength(3);
  }
});
