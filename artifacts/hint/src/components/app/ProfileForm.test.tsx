// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { ProfileForm } from "./ProfileForm";
import type { HintLanguage } from "../../lib/i18n";

const state = vi.hoisted(() => ({ language: "es" as HintLanguage }));
vi.mock("../../lib/i18n", async importOriginal => {
  const original = await importOriginal<typeof import("../../lib/i18n")>();
  return { ...original, useLanguage: () => ({ language: state.language, t: (key: string) => original.TRANSLATIONS[state.language][key] ?? key }) };
});
afterEach(cleanup);

for (const [language, message] of [
  ["zh", "无法保存出生资料，请重试。"],
  ["es", "No se pudieron guardar tus datos. Inténtalo de nuevo."],
  ["ja", "出生情報を保存できませんでした。再試行してください。"],
  ["ko", "출생 정보를 저장하지 못했습니다. 다시 시도하세요."],
] as const) {
  it(`${language} announces a localized save failure without clearing entered details`, async () => {
    state.language = language;
    const save = vi.fn().mockRejectedValue(new Error("Storage full"));
    render(<ProfileForm submitLabel="Save" onSubmit={save} />);
    fireEvent.change(screen.getByTestId("input-name"), { target: { value: "Fictional Reader" } });
    fireEvent.change(screen.getByTestId("input-birthdate"), { target: { value: "2000-02-29" } });
    fireEvent.click(screen.getByTestId("button-save-profile"));
    expect((await screen.findByRole("alert")).textContent).toBe(message);
    expect((screen.getByTestId("input-name") as HTMLInputElement).value).toBe("Fictional Reader");
    expect((screen.getByTestId("input-birthdate") as HTMLInputElement).value).toBe("2000-02-29");
  });
}
