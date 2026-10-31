// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { ReadingsView } from "./ReadingsView";
import type { HintLanguage } from "../../lib/i18n";

const state = vi.hoisted(() => ({ language: "es" as HintLanguage, readings: [] as Array<Record<string, unknown>> }));
vi.mock("@workspace/api-client-react", () => ({ useListReadings: () => ({ data: state.readings, isLoading: false, isError: false }) }));
vi.mock("../../lib/i18n", async importOriginal => {
  const original = await importOriginal<typeof import("../../lib/i18n")>();
  return { ...original, useLanguage: () => ({ language: state.language, t: (key: string) => original.TRANSLATIONS[state.language][key] ?? key }) };
});
beforeEach(() => {
  state.readings = [];
  vi.stubGlobal("IntersectionObserver", class { observe() {} unobserve() {} disconnect() {} });
  localStorage.clear(); sessionStorage.clear(); localStorage.setItem("hint_anon_id", "history-copy-fixture");
  localStorage.setItem("hint_local_question_history_v1", JSON.stringify([{
    id: "question-fixture", anonId: "history-copy-fixture", question: "A private question", focus: "Self", spreadType: "single", createdAt: "2026-09-10T12:00:00Z",
  }]));
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

for (const [language, reads, daily, questions, open] of [
  ["zh", "阅读", "每日牌", "提问", "查看解读"],
  ["es", "Lecturas", "Cartas diarias", "Preguntas", "Abrir lectura"],
  ["ja", "リーディング", "デイリーカード", "質問", "リーディングを見る"],
  ["ko", "리딩", "오늘의 카드", "질문", "리딩 보기"],
] as const) {
  it(`${language} renders contextual history counters and an action that opens the reading`, () => {
    state.language = language; render(<ReadingsView />);
    for (const label of [reads, daily, questions]) expect(screen.getAllByText(label, { exact: true }).length).toBeGreaterThan(0);
    expect(screen.getByRole("link", { name: open }).getAttribute("href")).toBe("/app/readings/question-fixture");
    expect(screen.queryByText("Reads", { exact: true })).toBeNull();
    expect(screen.queryByText("Asks", { exact: true })).toBeNull();
  });
}

const readingLinks = () => screen.queryAllByRole("link").map(link => link.getAttribute("href")).filter(href => /^\/app\/readings\/server-/.test(href ?? ""));

it("lists each reading once in All and keeps server-only records in their own filter", () => {
  state.language = "en";
  state.readings = [
    { id: "server-tarot", cardName: "Three cards", whisper: "Saved server words", spreadType: "three", question: null, territory: "tarot", createdAt: "2026-09-12T12:00:00Z" },
    { id: "server-daily", cardName: "The Star", whisper: "Saved daily words", spreadType: "daily-pull", question: null, territory: "daily", createdAt: "2026-09-11T12:00:00Z" },
  ];
  render(<ReadingsView />);
  expect(readingLinks().sort()).toEqual(["/app/readings/server-daily", "/app/readings/server-tarot"]);

  fireEvent.click(screen.getByRole("button", { name: /^Tarot/ }));
  expect(readingLinks()).toEqual(["/app/readings/server-tarot"]);
  expect(screen.getByText("Saved server words")).toBeTruthy();

  fireEvent.click(screen.getByRole("button", { name: /^Daily/ }));
  expect(readingLinks()).toEqual(["/app/readings/server-daily"]);
});
