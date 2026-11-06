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
  window.localStorage.removeItem("hint_local_tarot_readings_v1");
  state.save.mockReset(); state.deleteHistory.mockReset(); state.setPreference.mockReset(); state.setTheme.mockReset();
  vi.spyOn(window, "confirm").mockReturnValue(true);
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

const READINGS_KEY = "hint_local_tarot_readings_v1";

it("invites a first reading and birth details instead of showing empty counts", () => {
  render(<MeView />);
  expect(screen.getByText(ME_COPY.en.firstLetterTitle)).toBeTruthy();
  expect(screen.getByRole("link", { name: ME_COPY.en.firstLetterAction }).getAttribute("href")).toBe("/app/daily");
  expect(screen.getByTestId("button-edit-profile").textContent).toBe(ME_COPY.en.addBirth);
  expect(screen.queryByText(/\b0 of\b/)).toBeNull();
  // Nothing kept yet, so the envelope carries no postmark.
  expect(document.querySelector(".me-postmark")).toBeNull();
  expect(screen.queryByRole("link", { name: /See all/ })).toBeNull();
  expect(screen.getByRole("link", { name: /Find your type/ }).getAttribute("href")).toBe("/app/personalities");
  expect(screen.queryByRole("textbox", { name: /email/i })).toBeNull();
});

it("shows the newest kept reading on a stack of letters, opens history and postmarks the days kept", () => {
  const card = (cardId: string, name: string, orientation: "upright" | "reversed") => ({ cardId, name, orientation, positionLabel: "Now", keywords: [] });
  const reading = (id: string, question: string, createdAt: string) => ({
    schemaVersion: 2, id, anonId: "fictional-me-owner", source: "tarot", spreadType: "three", spreadLabel: "Three cards", question,
    chatMessages: [], shortAnswer: "A fictional answer", questionMeaning: "", cardMeanings: ["", "", ""],
    cards: [card("the-star", "The Star", "upright"), card("two-of-cups", "Two of Cups", "reversed"), card("page-of-pentacles", "Page of Pentacles", "upright")],
    createdAt,
  });
  window.localStorage.setItem(READINGS_KEY, JSON.stringify([
    reading("older", "An older fictional question?", new Date(Date.now() - 3 * 86400000).toISOString()),
    reading("newer", "What is opening for me?", new Date(Date.now() - 3600000).toISOString()),
  ]));
  render(<MeView />);
  expect(screen.getByText("“What is opening for me?”")).toBeTruthy();
  expect(screen.queryByText("“An older fictional question?”")).toBeNull();
  expect(screen.getByText("The Star, Two of Cups, Page of Pentacles")).toBeTruthy();
  expect(screen.getByRole("link", { name: "See all 2" }).getAttribute("href")).toBe("/app/readings");
  // Two letters kept: the newest on top with one older edge beneath it.
  expect(document.querySelector(".me-letter-stack")?.getAttribute("data-depth")).toBe("2");
  // Both readings fall inside the last 14 days, on two different days.
  expect(screen.getByRole("img", { name: `${ME_COPY.en.rhythm}: 2 of the last 14 days` })).toBeTruthy();
  expect(document.querySelectorAll(".me-postmark-day")).toHaveLength(14);
  expect(document.querySelectorAll(".me-postmark-day[data-on]")).toHaveLength(2);
  // The rhythm and deck tiles are gone: rhythm moved to the postmark, and the deck led to Collection.
  expect(screen.queryByRole("link", { name: new RegExp(ME_COPY.en.deck) })).toBeNull();
  expect(screen.queryByText(ME_COPY.en.firstLetterTitle)).toBeNull();
});

it("keeps device storage one step away and returns focus when leaving it", () => {
  render(<MeView />);
  expect(screen.queryByText(ME_COPY.en.beta)).toBeNull();
  fireEvent.click(screen.getByTestId("button-open-storage"));
  expect(document.activeElement?.id).toBe("me-storage-heading");
  expect(screen.getByText(ME_COPY.en.beta)).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: ME_COPY.en.back }));
  expect(document.activeElement).toBe(screen.getByTestId("button-open-storage"));
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
    expect(screen.getByRole("link", { name: ME_COPY[language].openChart }).getAttribute("href")).toBe("/app/astrology?tab=chart");
    expect(screen.getByRole("status").textContent).not.toMatch(/undefined|quality\./);
    // No calculated chart: no Sun/Moon/Rising placements are shown. February 29
    // is far from a sign change, so the letter shows the Sun constellation the
    // date alone decides.
    expect(document.querySelector(".me-sky-signs")).toBeNull();
    expect(screen.queryByText(ME_COPY[language].moon)).toBeNull();
    expect(screen.queryByText(ME_COPY[language].rising)).toBeNull();
    expect(document.querySelector(".me-constellation")?.getAttribute("data-sign")).toBe("pisces");
  });
}

it("leaves the constellation unwritten on the days around a sign change until a chart decides", () => {
  for (const birthDate of ["1997-03-20", "1997-03-21", "2001-12-21", "2001-12-22", "2000-01-19"]) {
    state.profile = { anonId: "fictional-me-owner", name: "Fictional Reader", birthDate, birthTime: null, birthPlace: null, createdAt: "2026-01-01" };
    const view = render(<MeView />);
    expect(document.querySelector(".me-constellation")?.hasAttribute("data-sign")).toBe(false);
    expect(screen.getAllByText(ME_COPY.en.unwrittenSky).length).toBeGreaterThan(0);
    view.unmount();
  }
  for (const [birthDate, sign] of [["1997-03-22", "aries"], ["1990-08-02", "leo"], ["2001-12-23", "capricorn"]] as const) {
    state.profile = { anonId: "fictional-me-owner", name: "Fictional Reader", birthDate, birthTime: null, birthPlace: null, createdAt: "2026-01-01" };
    const view = render(<MeView />);
    expect(document.querySelector(".me-constellation")?.getAttribute("data-sign")).toBe(sign);
    view.unmount();
  }
});

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

for (const language of ["en", "zh", "es", "ja", "ko"] as const) {
  it(`${language} closes the page with a sign-off and a P.S. holding the data rows and help`, () => {
    state.language = language;
    render(<MeView />);
    const footer = document.querySelector(".me-footer")!;
    // The P.S. is the last thing on the page, after the sign-off.
    expect(footer.nextElementSibling).toBeNull();
    expect(footer.querySelector(".me-signoff")?.textContent).toContain(ME_COPY[language].footer);
    const ps = screen.getByRole("heading", { level: 2, name: `${ME_COPY[language].ps} ${ME_COPY[language].psLead}` });
    const section = ps.closest("section")!;
    expect(section.querySelector('[data-testid="button-open-storage"]')).toBeTruthy();
    expect(section.querySelector(".me-data-disclosure summary")?.textContent).toContain(ME_COPY[language].clearLabel);
    const links = [...section.querySelectorAll<HTMLAnchorElement>("nav a")].map(link => link.getAttribute("href"));
    expect(links).toEqual(["/about", "/contact", "/privacy", "/terms", "/disclaimer"]);
    // The old separate data and help headings are gone.
    expect(screen.queryByRole("heading", { name: ME_COPY[language].dataHeading })).toBeNull();
    expect(screen.queryByRole("heading", { name: ME_COPY[language].help })).toBeNull();
    expect(screen.getByRole("navigation", { name: ME_COPY[language].help })).toBeTruthy();
  });
}

it("labels the motion switch in sentence case", () => {
  render(<MeView />);
  expect(screen.getByRole("switch", { name: "Reduce motion" })).toBeTruthy();
});
