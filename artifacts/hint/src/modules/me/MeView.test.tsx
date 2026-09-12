// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { Profile } from "@workspace/api-client-react";
import type { HintLanguage } from "../../lib/i18n";
import { MeView } from "./MeView";
import { ME_COPY } from "./meCopy";

const state = vi.hoisted(() => ({
  language: "en" as HintLanguage, profile: null as Profile | null,
  storageStatus: "local" as "local" | "unsaved" | "synced",
  save: vi.fn(), deleteHistory: vi.fn(), setPreference: vi.fn(), setTheme: vi.fn(), reduced: false,
}));
vi.mock("../../lib/i18n", async importOriginal => {
  const original = await importOriginal<typeof import("../../lib/i18n")>();
  return { ...original, useLanguage: () => ({ language: state.language, t: (key: string) => original.TRANSLATIONS[state.language][key] ?? key }) };
});
vi.mock("../../lib/useProfile", () => ({ useProfile: () => ({ profile: state.profile, saveProfile: state.save, isSaving: false, storageStatus: state.storageStatus }) }));
vi.mock("../../lib/auth", () => ({ useLocalAccount: () => null }));
vi.mock("../../lib/motionPolicy", () => ({ useMotionPolicy: () => ({ reduced: state.reduced, pageVisible: true }) }));
vi.mock("../../lib/clearHistory", () => ({ deleteHistory: state.deleteHistory }));
vi.mock("../../lib/identity", () => ({ getAnonId: () => "fictional-me-owner" }));
vi.mock("../../lib/preferences", () => ({ HINT_PREFERENCES_UPDATED_EVENT: "hint:preferences-updated", useHintPreferences: () => ({ preferences: { reduceMotion: false, soundAndHaptics: false }, setPreference: state.setPreference }), setHintThemePreference: state.setTheme }));
vi.mock("../../components/LanguageToggle", () => ({ LanguageToggle: () => <button type="button">Language selector</button> }));
vi.mock("../../components/app/LocalProfileSwitcher", () => ({ LocalProfileSwitcher: () => <details><summary>Local profiles</summary></details> }));
vi.mock("../../components/app/DeviceConnectionStatus", () => ({ DeviceConnectionStatus: () => null }));

beforeEach(() => {
  state.language = "en"; state.profile = null; state.storageStatus = "local"; state.reduced = false;
  window.localStorage.removeItem("hint-theme");
  state.save.mockReset(); state.deleteHistory.mockReset(); state.setPreference.mockReset(); state.setTheme.mockReset();
  vi.spyOn(window, "confirm").mockReturnValue(true);
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

it("keeps chart, history and collection accessible without adding an email", () => {
  render(<MeView />);
  expect(screen.getByRole("link", { name: /My birth chart/ }).getAttribute("href")).toBe("/app/astrology?tab=chart");
  expect(screen.getByRole("link", { name: /Reading history/ }).getAttribute("href")).toBe("/app/readings");
  expect(screen.getByRole("link", { name: /My collection/ }).getAttribute("href")).toBe("/app/collection");
  expect(screen.getByText(ME_COPY.en.beta)).toBeTruthy();
  expect(screen.queryByRole("textbox", { name: /email/i })).toBeNull();
});

it("preserves failed edits and restores focus when the user returns", async () => {
  state.save.mockRejectedValue(new Error("Storage full"));
  render(<MeView />);
  fireEvent.click(screen.getByTestId("button-edit-profile"));
  expect(document.activeElement?.id).toBe("me-edit-heading");
  fireEvent.change(screen.getByTestId("input-name"), { target: { value: "Fictional Reader" } });
  fireEvent.change(screen.getByTestId("input-birthdate"), { target: { value: "2000-02-29" } });
  fireEvent.click(screen.getByTestId("button-save-profile"));
  expect((await screen.findByRole("alert")).textContent).toContain("Could not save");
  expect((screen.getByTestId("input-name") as HTMLInputElement).value).toBe("Fictional Reader");
  expect(screen.queryByTestId("button-edit-profile")).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: ME_COPY.en.back }));
  expect(document.activeElement).toBe(screen.getByTestId("button-edit-profile"));
});

it("returns to the personal page only after save succeeds", async () => {
  let finish!: () => void;
  state.save.mockImplementation(() => new Promise<void>(resolve => { finish = resolve; }));
  render(<MeView />);
  fireEvent.click(screen.getByTestId("button-edit-profile"));
  fireEvent.change(screen.getByTestId("input-name"), { target: { value: "Fictional Reader" } });
  fireEvent.change(screen.getByTestId("input-birthdate"), { target: { value: "2000-02-29" } });
  fireEvent.click(screen.getByTestId("button-save-profile"));
  expect(screen.queryByTestId("button-edit-profile")).toBeNull();
  finish();
  await waitFor(() => expect(screen.getByTestId("button-edit-profile")).toBeTruthy());
});

for (const leaveLabel of [ME_COPY.en.back, "Cancel"]) {
  it(`keeps a reopened draft and its focus after an old save completes through ${leaveLabel}`, async () => {
    let finish!: () => void;
    state.save.mockImplementation(() => new Promise<void>(resolve => { finish = resolve; }));
    render(<MeView />);
    fireEvent.click(screen.getByTestId("button-edit-profile"));
    fireEvent.change(screen.getByTestId("input-name"), { target: { value: "First saved name" } });
    fireEvent.change(screen.getByTestId("input-birthdate"), { target: { value: "2000-02-29" } });
    fireEvent.click(screen.getByTestId("button-save-profile"));
    fireEvent.click(screen.getByRole("button", { name: leaveLabel }));
    fireEvent.click(screen.getByTestId("button-edit-profile"));
    const newer = screen.getByTestId("input-name") as HTMLInputElement;
    fireEvent.change(newer, { target: { value: "New unsaved draft" } });
    newer.focus();
    await act(async () => finish());
    expect(screen.queryByTestId("input-name")).toBe(newer);
    expect(newer.value).toBe("New unsaved draft");
    expect(document.activeElement).toBe(newer);
    expect(screen.queryByTestId("button-edit-profile")).toBeNull();
  });
}

it("keeps newer input in the same editor after the submitted revision finishes", async () => {
  let finish!: () => void;
  state.save.mockImplementation(() => new Promise<void>(resolve => { finish = resolve; }));
  render(<MeView />);
  fireEvent.click(screen.getByTestId("button-edit-profile"));
  fireEvent.change(screen.getByTestId("input-name"), { target: { value: "First saved name" } });
  fireEvent.change(screen.getByTestId("input-birthdate"), { target: { value: "2000-02-29" } });
  fireEvent.click(screen.getByTestId("button-save-profile"));
  const newer = screen.getByTestId("input-name") as HTMLInputElement;
  fireEvent.change(newer, { target: { value: "New unsaved draft" } });
  newer.focus();
  await act(async () => finish());
  expect(screen.queryByTestId("input-name")).toBe(newer);
  expect(newer.value).toBe("New unsaved draft");
  expect(document.activeElement).toBe(newer);
  // The retained revision can still be saved normally after the old request settles.
  state.save.mockResolvedValueOnce(undefined);
  fireEvent.click(screen.getByTestId("button-save-profile"));
  await waitFor(() => expect(screen.getByTestId("button-edit-profile")).toBeTruthy());
  expect(state.save.mock.calls[1]?.[0].name).toBe("New unsaved draft");
});

it("does not show an old editor's rejected save in a newly opened draft", async () => {
  let fail!: (error: Error) => void;
  state.save.mockImplementation(() => new Promise<void>((_, reject) => { fail = reject; }));
  render(<MeView />);
  fireEvent.click(screen.getByTestId("button-edit-profile"));
  fireEvent.change(screen.getByTestId("input-name"), { target: { value: "First saved name" } });
  fireEvent.change(screen.getByTestId("input-birthdate"), { target: { value: "2000-02-29" } });
  fireEvent.click(screen.getByTestId("button-save-profile"));
  fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
  fireEvent.click(screen.getByTestId("button-edit-profile"));
  const newer = screen.getByTestId("input-name") as HTMLInputElement;
  fireEvent.change(newer, { target: { value: "New unsaved draft" } });
  newer.focus();
  await act(async () => fail(new Error("Storage full")));
  expect(screen.getByTestId("input-name")).toBe(newer);
  expect(newer.value).toBe("New unsaved draft");
  expect(document.activeElement).toBe(newer);
  expect(screen.queryByRole("alert")).toBeNull();
});

for (const language of ["en", "zh", "es", "ja", "ko"] as const) {
  it(`${language} shows actual birth data and unknown time without inventing chart results`, () => {
    state.language = language;
    state.profile = { anonId: "fictional-me-owner", name: "Fictional Reader", birthDate: "2000-02-29", birthTime: null, birthPlace: "Fictional City", createdAt: "2026-01-01" };
    render(<MeView />);
    expect(screen.getByRole("heading", { name: ME_COPY[language].title })).toBeTruthy();
    expect(screen.getByText(ME_COPY[language].unknownTime)).toBeTruthy();
    expect(screen.getByText("Fictional City")).toBeTruthy();
    expect(screen.getByRole("status").textContent).not.toMatch(/undefined|quality\./);
    expect(screen.queryByText(/Pisces|双鱼座|魚座|물고기자리/)).toBeNull();
  });
}

it("connects appearance and accessible preference controls to the existing settings", () => {
  render(<MeView />);
  fireEvent.click(screen.getByRole("button", { name: ME_COPY.en.bright }));
  expect(state.setTheme).toHaveBeenCalledWith("bright");
  fireEvent.click(screen.getByRole("switch", { name: ME_COPY.en.feedback }));
  expect(state.setPreference).toHaveBeenCalledWith("soundAndHaptics", true);
  fireEvent.click(screen.getByRole("switch", { name: /Reduce motion/i }));
  expect(state.setPreference).toHaveBeenCalledWith("reduceMotion", true);
});

it("updates the selected theme when another surface changes the saved preference", () => {
  render(<MeView />);
  expect(screen.getByRole("button", { name: ME_COPY.en.dark }).getAttribute("aria-pressed")).toBe("true");
  window.localStorage.setItem("hint-theme", "bright");
  fireEvent(window, new StorageEvent("storage", { key: "hint-theme", newValue: "bright" }));
  expect(screen.getByRole("button", { name: ME_COPY.en.bright }).getAttribute("aria-pressed")).toBe("true");
  window.localStorage.setItem("hint-theme", "dark");
  fireEvent(window, new Event("hint:preferences-updated"));
  expect(screen.getByRole("button", { name: ME_COPY.en.dark }).getAttribute("aria-pressed")).toBe("true");
});

it("does not duplicate a history deletion and exposes a retry after failure", async () => {
  let fail!: (error: Error) => void;
  state.deleteHistory.mockImplementation(() => new Promise((_, reject) => { fail = reject; }));
  render(<MeView />);
  fireEvent.click(screen.getByText(ME_COPY.en.clearLabel));
  const clear = screen.getByTestId("button-clear-history");
  fireEvent.click(clear); fireEvent.click(clear);
  expect(state.deleteHistory).toHaveBeenCalledTimes(1);
  expect(state.deleteHistory).toHaveBeenCalledWith("fictional-me-owner");
  fail(new Error("offline"));
  expect(await screen.findByRole("alert")).toBeTruthy();
  expect(screen.getByRole("button", { name: "Retry" })).toBeTruthy();
  expect((screen.getByTestId("button-clear-history") as HTMLButtonElement).disabled).toBe(false);
});

it("cancelling history confirmation never sends a request", () => {
  vi.mocked(window.confirm).mockReturnValue(false);
  render(<MeView />);
  fireEvent.click(screen.getByText(ME_COPY.en.clearLabel));
  fireEvent.click(screen.getByTestId("button-clear-history"));
  expect(state.deleteHistory).not.toHaveBeenCalled();
});
