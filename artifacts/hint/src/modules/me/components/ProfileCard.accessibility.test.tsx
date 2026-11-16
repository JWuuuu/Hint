// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import type { HintLanguage } from "../../../lib/i18n";
import { ProfileCard } from "./ProfileCard";
import { ME_COPY } from "../meCopy";
const state = vi.hoisted(() => ({ language: "en" as HintLanguage }));
vi.mock("../../../lib/i18n", async importOriginal => {
  const original = await importOriginal<typeof import("../../../lib/i18n")>();
  return { ...original, useLanguage: () => ({ language: state.language, t: (key: string) => original.TRANSLATIONS[state.language][key] ?? key }) };
});
vi.mock("../../../lib/auth", () => ({ useLocalAccount: () => null }));
afterEach(cleanup);
for (const language of ["en", "zh", "es", "ja", "ko"] as const) {
  it(`${language} lets voice-control users identify Edit by its visible words`, () => {
    state.language = language;
    render(<ProfileCard profile={{ anonId: "fictional-reader", name: "Fictional Reader", birthDate: "2000-02-29", birthTime: null, birthPlace: null, createdAt: "2026-11-10" }} signs={null} onEdit={vi.fn()} />);
    expect(screen.getByRole("button", { name: ME_COPY[language].edit })).toBe(screen.getByTestId("button-edit-profile"));
  });
}
