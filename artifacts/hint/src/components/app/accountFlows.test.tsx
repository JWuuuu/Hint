// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { ReactNode } from "react";
import { OnboardingGate } from "./OnboardingGate";
import { LoginView } from "../../modules/auth/LoginView";
import { saveLocalAccount } from "../../lib/auth";
const mocks = vi.hoisted(() => ({ save: vi.fn(), navigate: vi.fn() }));
vi.mock("wouter", () => ({ useLocation: () => ["/app", mocks.navigate], Link: ({ children, href }: { children: ReactNode; href: string }) => <a href={href}>{children}</a> }));
vi.mock("../../lib/i18n", () => ({ useLanguage: () => ({ language: "en", t: (key: string) => key }) }));
vi.mock("../../lib/LocalizedText", () => ({ LocalizedText: ({ text }: { text: string }) => <>{text}</> }));
vi.mock("../../lib/useProfile", () => ({ useProfile: () => ({ anonId: "fixture", profile: { name: "Fixture", birthDate: "2000-02-29" }, saveProfile: mocks.save, isSaving: false }) }));
vi.mock("./AppChrome", () => ({ AppScreen: ({ children }: { children: ReactNode }) => <div>{children}</div>, GlassPanel: ({ children }: { children: ReactNode }) => <div>{children}</div>, SectionLabel: ({ children }: { children: ReactNode }) => <div>{children}</div>, ScreenHeader: () => null }));
beforeEach(() => { localStorage.clear(); sessionStorage.clear(); mocks.save.mockReset().mockResolvedValue({}); mocks.navigate.mockReset(); });
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

it("opens different-email input from a saved account during onboarding", async () => {
  saveLocalAccount({ provider: "email", identifier: "first@hint.test", name: "Fixture" });
  render(<OnboardingGate><p>Application</p></OnboardingGate>);
  fireEvent.click(screen.getByTestId("button-start-onboarding"));
  fireEvent.click(screen.getByTestId("button-save-onboarding-profile"));
  await waitFor(() => expect(screen.getByTestId("onboarding-focus-self")).toBeTruthy());
  fireEvent.click(screen.getByTestId("onboarding-focus-self"));
  fireEvent.click(screen.getByTestId("button-save-onboarding-focus"));
  fireEvent.click(screen.getByRole("button", { name: "Use a different email" }));
  expect((screen.getByTestId("onboarding-email") as HTMLInputElement).value).toBe("");
  expect(screen.queryByText("first@hint.test")).toBeNull();
});

function prepareLogin() {
  render(<LoginView />);
  fireEvent.change(screen.getByTestId("input-login-name"), { target: { value: "Fixture" } });
  fireEvent.change(screen.getByTestId("input-login-birthdate"), { target: { value: "2000-02-29" } });
  fireEvent.change(screen.getByTestId("input-login-email"), { target: { value: "fixture@hint.test" } });
  fireEvent.click(screen.getByRole("button", { name: "login.requestCode" }));
  const code = screen.getByText(/^\d{6}$/).textContent!;
  fireEvent.change(screen.getByTestId("input-login-code"), { target: { value: code } });
}
it("keeps a failed profile save on the login form without claiming a saved account", async () => {
  mocks.save.mockRejectedValueOnce(new Error("Storage full"));
  prepareLogin(); fireEvent.click(screen.getByRole("button", { name: "login.verifyCode" }));
  await waitFor(() => expect(screen.getByRole("alert").textContent).toBe("quality.accountSaveFailed"));
  expect((screen.getByTestId("input-login-name") as HTMLInputElement).value).toBe("Fixture");
  expect(localStorage.getItem("hint_local_auth_v1")).toBeNull(); expect(mocks.navigate).not.toHaveBeenCalled();
});
it("deduplicates verify and ignores navigation when leaving during a profile save", async () => {
  let resolve!: () => void; mocks.save.mockImplementation(() => new Promise<void>(done => { resolve = done; }));
  prepareLogin();
  fireEvent.click(screen.getByRole("button", { name: "login.verifyCode" }));
  fireEvent.click(screen.getByRole("button", { name: "profile.keeping" }));
  expect(mocks.save).toHaveBeenCalledTimes(1); cleanup();
  await act(async () => resolve()); expect(mocks.navigate).not.toHaveBeenCalled();
  expect(localStorage.getItem("hint_local_auth_v1")).toBeNull();
});
