// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { SettingsList } from "./SettingsList";
import { LanguageProvider } from "../../../lib/i18n";
import { saveHintPreferences, setHintThemePreference } from "../../../lib/preferences";
import { ME_COPY } from "../meCopy";

vi.mock("../../../components/LanguageToggle", () => ({ LanguageToggle: () => <button>Language</button> }));

beforeEach(() => {
  localStorage.clear();
  localStorage.setItem("hint-language", "en");
  saveHintPreferences({ reduceMotion: false, soundAndHaptics: true });
  setHintThemePreference("dark");
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

function mount() { return render(<LanguageProvider><SettingsList /></LanguageProvider>); }

it("explains session-only feedback and offers a keyboard retry without undoing disable", async () => {
  const user = userEvent.setup();
  mount();
  const write = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new DOMException("Full", "QuotaExceededError"); });
  const feedback = screen.getByRole("switch", { name: "Touch feedback" });
  feedback.focus();
  await user.keyboard(" ");
  expect(feedback.getAttribute("aria-checked")).toBe("false");
  expect(screen.getByText(/only for this session/)).toBeTruthy();
  const retry = screen.getByRole("button", { name: "Retry saving motion and feedback" });
  write.mockRestore();
  retry.focus();
  await user.keyboard("{Enter}");
  expect(screen.queryByText(/only for this session/)).toBeNull();
  expect(JSON.parse(localStorage.getItem("hint.preferences.v1")!).soundAndHaptics).toBe(false);
  expect(document.activeElement).toBe(feedback);
});

it("reports a failed theme without selecting it, then applies the explicit retry", async () => {
  const user = userEvent.setup();
  mount();
  const write = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new DOMException("Blocked", "SecurityError"); });
  await user.click(screen.getByRole("button", { name: "Pearl light" }));
  expect(screen.getByRole("button", { name: "Evening plum" }).getAttribute("aria-pressed")).toBe("true");
  expect(screen.getByText(/Your appearance is unchanged/)).toBeTruthy();
  write.mockRestore();
  await user.click(screen.getByRole("button", { name: "Retry Pearl light" }));
  expect(screen.queryByText(/Your appearance is unchanged/)).toBeNull();
  expect(screen.getByRole("button", { name: "Pearl light" }).getAttribute("aria-pressed")).toBe("true");
  expect(localStorage.getItem("hint-theme")).toBe("bright");
});

it.each(["en", "zh", "es", "ja", "ko"] as const)("associates localized %s failures, retains failed retry focus and separates mixed outcomes", async language => {
  localStorage.setItem("hint-language", language);
  const copy = ME_COPY[language];
  const user = userEvent.setup();
  mount();
  const original = Storage.prototype.setItem;
  let deny = new Set(["hint-theme", "hint.preferences.v1"]);
  vi.spyOn(Storage.prototype, "setItem").mockImplementation(function (this: Storage, key, value) {
    if (deny.has(key)) throw new DOMException("Denied", "SecurityError");
    return original.call(this, key, value);
  });
  const theme = screen.getByRole("button", { name: copy.bright });
  const feedback = screen.getByRole("switch", { name: copy.feedback });
  await user.click(theme); await user.click(feedback);
  expect(document.getElementById(theme.getAttribute("aria-describedby")!)?.textContent).toBe(copy.themeUnsaved.replace("{theme}", copy.bright));
  expect(document.getElementById(feedback.getAttribute("aria-describedby")!)?.textContent).toBe(copy.preferencesUnsaved);
  const retry = screen.getByRole("button", { name: copy.retryPreferences });
  retry.focus(); await user.keyboard("{Enter}");
  expect(document.activeElement).toBe(retry);
  expect(screen.queryByText(copy.preferencesSaved)).toBeNull();
  deny = new Set(["hint.preferences.v1"]);
  await user.click(screen.getByRole("button", { name: copy.retryTheme.replace("{theme}", copy.bright) }));
  expect(screen.getByText(copy.themeSaved)).toBeTruthy();
  expect(screen.getByText(copy.preferencesUnsaved)).toBeTruthy();
  expect(feedback.getAttribute("aria-checked")).toBe("false");
  deny.clear();
  await user.click(retry);
  expect(screen.queryByText(copy.preferencesUnsaved)).toBeNull();
  expect(screen.getByText(copy.preferencesSaved)).toBeTruthy();
});
