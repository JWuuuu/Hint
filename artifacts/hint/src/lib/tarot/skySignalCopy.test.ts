import { expect, it } from "vitest";
import { getDailySkySignals, type SkySignal } from "./skyGuidedTarot";
import { skySignalLabel } from "./skySignalCopy";
import { LITERAL_COPY } from "../literalCopy";
import type { HintLanguage } from "../i18n";
const languages: HintLanguage[] = ["en", "zh", "es", "ja", "ko"];
it("localizes all current signal kinds without mutating the canonical sky", () => {
  const seen = new Set<string>();
  for (let day = 1; day <= 32; day++) {
    const signals = getDailySkySignals({ date: new Date(Date.UTC(2026, 10, day)) });
    const before = JSON.stringify(signals);
    for (const signal of signals) for (const language of languages) {
      const label = skySignalLabel(signal, language); expect(label).not.toMatch(/\{(?:sign|element)\}/);
      if (language === "en") expect(label).toBe(signal.label); else expect(label).not.toBe(signal.label);
      if (signal.zodiac) expect(label).toContain(LITERAL_COPY[signal.zodiac]![language]);
      if (signal.id.startsWith("dominant-")) expect(label).toContain(LITERAL_COPY[signal.element!]![language]);
      if (signal.id.startsWith("moon-phase-")) seen.add(signal.id);
    }
    expect(JSON.stringify(signals)).toBe(before);
  }
  expect(seen.size).toBe(5);
});
it("retains unknown signal meaning and does not guess missing structured names", () => {
  const signal: SkySignal = { id: "unknown", source: "daily-sky", bodies: [], strength: 1, label: "Fictional new provider signal" };
  expect(skySignalLabel(signal, "zh")).toBe(signal.label);
  expect(skySignalLabel({ ...signal, id: "moon-house-1", zodiac: "Unknown" }, "ja")).toBe(signal.label);
});
