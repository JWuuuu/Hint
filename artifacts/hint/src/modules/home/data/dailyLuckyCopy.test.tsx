// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { HintLanguage } from "../../../lib/i18n";
import { DAILY_LUCKY_OPTIONS, getDailyReport } from "./dailyReport";
import { DAILY_LUCKY_COPY, localizeDailyLuckyItem } from "./dailyLuckyCopy";
import { getDailyPullById } from "./dailyPulls";
import { DailyReportCard } from "../components/DailyReportCard";
import { LuckyIllustration } from "../components/LuckyIllustration";
const state = vi.hoisted(() => ({ language: "en" as HintLanguage }));
vi.mock("../../../lib/useProfile", () => ({ useProfile: () => ({ profile: null }) }));
vi.mock("../../../lib/i18n", async (importOriginal) => ({ ...await importOriginal<typeof import("../../../lib/i18n")>(), useLanguage: () => ({ language: state.language, t: (key: string) => key }) }));
beforeEach(() => { localStorage.clear(); sessionStorage.clear(); });
afterEach(() => { cleanup(); });

it("every canonical lucky option has a complete translated name and advice in all four locales", () => {
  expect(Object.values(DAILY_LUCKY_OPTIONS).reduce((total, options) => total + options.length, 0)).toBe(148);
  for (const language of ["zh", "es", "ja", "ko"] as const) {
    for (const key of Object.keys(DAILY_LUCKY_OPTIONS) as Array<keyof typeof DAILY_LUCKY_OPTIONS>) {
      expect(Object.keys(DAILY_LUCKY_COPY[language][key]).sort()).toEqual(DAILY_LUCKY_OPTIONS[key].map(([value]) => value).sort());
      for (const [value, hint] of DAILY_LUCKY_OPTIONS[key]) {
        const translated = localizeDailyLuckyItem({ key, label: key, value, hint }, language);
        expect(translated.value, `${language}:${key}:${value}:name`).toBeTruthy();
        expect(translated.hint, `${language}:${key}:${value}:advice`).toBeTruthy();
        expect(translated.hint, `${language}:${key}:${value}:English fallback`).not.toBe(hint);
        expect(translated.illustrationValue).toBe(value);
      }
    }
  }
});

it("localized jewelry, food, scent and flower names keep their exact artwork and one localized accessible label", () => {
  const cases = [
    ["jewelry", "Shell Necklace", "/lucky/jewelry/shell-necklace.png"],
    ["food", "Tacos", "/lucky/food/tacos.png"],
    ["carry", "Perfume", "/lucky/carry/perfume.png"],
    ["flower", "Baby's Breath", "/lucky/flower/babys-breath.png"],
  ] as const;
  for (const language of ["zh", "es", "ja", "ko"] as const) for (const [key, value, asset] of cases) {
    const item = localizeDailyLuckyItem({ key, label: key, value, hint: "fixture" }, language);
    const view = render(<LuckyIllustration item={item} />);
    expect(screen.getAllByRole("img")).toHaveLength(1);
    expect(screen.getByRole("img", { name: item.value })).toBeTruthy();
    expect(view.container.querySelector("img")?.getAttribute("src")).toContain(asset);
    expect(view.container.querySelector("img")?.getAttribute("alt")).toBe("");
    cleanup();
  }
});

it("localized color and number illustrations preserve the canonical swatch and both digits", () => {
  for (const language of ["zh", "es", "ja", "ko"] as const) {
    const color = localizeDailyLuckyItem({ key: "color", label: "color", value: "Sky Blue", hint: "Good for calm replies" }, language);
    const view = render(<LuckyIllustration item={color} />);
    expect(view.container.innerHTML).toContain("rgb(145, 216, 246) 54%");
    expect(screen.getByRole("img", { name: color.value })).toBeTruthy();
    view.rerender(<LuckyIllustration item={localizeDailyLuckyItem({ key: "number", label: "number", value: "3 and 4", hint: "rhythm" }, language)} />);
    expect(view.container.querySelector("text")?.textContent).toBe("3/4");
    cleanup();
  }
});

for (const language of ["zh", "es", "ja", "ko"] as const) {
  it(`${language} daily lucky items translate advice while preserving canonical artwork and number identity`, () => {
    const input = { anonId: "lucky-copy-fixture", date: new Date(2026, 8, 9, 12) };
    const english = getDailyReport({ ...input, language: "en" });
    const localized = getDailyReport({ ...input, language });
    expect(localized.lucky.find(item => item.key === "jewelry")!.hint).not.toBe(english.lucky.find(item => item.key === "jewelry")!.hint);
    for (const [index, item] of localized.lucky.entries()) {
      const original = english.lucky[index]!;
      expect(item.hint).not.toBe(original.hint);
      expect(item.illustrationValue).toBe(original.value);
      if (item.key === "number") expect(item.value).not.toContain(" and ");
    }
  });
}

for (const [language, upright, major, minor] of [
  ["zh", "正位", "更深的讯息", "日常指引"],
  ["es", "Al derecho", "Mensaje más amplio", "Guía cotidiana"],
  ["ja", "正位置", "大きなメッセージ", "日常のヒント"],
  ["ko", "정방향", "더 큰 메시지", "일상의 안내"],
] as const) {
  it(`${language} daily card metadata renders localized major and minor badges`, () => {
    state.language = language;
    const view = render(<DailyReportCard detailed cardOverride={getDailyPullById("0-fool", "en")} dateOverride={new Date()} />);
    expect(screen.getByText(upright)).toBeTruthy();
    expect(screen.getByText(major)).toBeTruthy();
    expect(screen.queryByText("Upright")).toBeNull();
    expect(screen.queryByText("Bigger message")).toBeNull();
    view.rerender(<DailyReportCard detailed cardOverride={getDailyPullById("ace-cups", "en")} dateOverride={new Date()} />);
    expect(screen.getByText(minor)).toBeTruthy();
    expect(screen.queryByText("Daily guidance")).toBeNull();
  });
}
