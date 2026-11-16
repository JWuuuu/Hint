// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { ReactNode } from "react";
import { LoginView } from "./LoginView";
import { getAnonId } from "../../lib/identity";
const state = vi.hoisted(() => ({ save: vi.fn(), navigate: vi.fn() }));
vi.mock("wouter", () => ({ useLocation: () => ["/app/login", state.navigate], Link: ({ children, href }: { children: ReactNode; href: string }) => <a href={href}>{children}</a> }));
vi.mock("../../lib/i18n", () => ({ useLanguage: () => ({ language: "en", t: (key: string) => key }) }));
vi.mock("../../lib/useProfile", () => ({ useProfile: () => ({ saveProfile: state.save }) }));
vi.mock("../../components/app/AppChrome", () => ({ AppScreen: ({ children }: { children: ReactNode }) => <div>{children}</div>, GlassPanel: ({ children }: { children: ReactNode }) => <div>{children}</div>, SectionLabel: ({ children }: { children: ReactNode }) => <div>{children}</div>, ScreenHeader: () => null }));
beforeEach(() => { localStorage.clear(); localStorage.setItem("hint_anon_id", getAnonId()); sessionStorage.clear(); state.save.mockReset().mockResolvedValue({}); state.navigate.mockReset(); });
afterEach(() => { cleanup(); vi.restoreAllMocks(); });
function requestCode() {
  render(<LoginView />);
  fireEvent.change(screen.getByTestId("input-login-name"), { target: { value: "Fictional Reader" } });
  fireEvent.change(screen.getByTestId("input-login-birthdate"), { target: { value: "2000-02-29" } });
  fireEvent.change(screen.getByTestId("input-login-email"), { target: { value: "reader@example.invalid" } });
  fireEvent.click(screen.getByRole("button", { name: "login.requestCode" }));
  return screen.getByText(/^\d{6}$/).textContent!;
}
it("focuses the newly requested code with a concise label and separate help, then associates a mismatch", () => {
  const correct = requestCode();
  const input = screen.getByRole("textbox", { name: "login.verificationCode" });
  expect(document.activeElement).toBe(input);
  expect(document.getElementById(input.getAttribute("aria-describedby")!)?.textContent).toContain("login.betaCodeSuffix");
  expect(screen.getByRole("status").textContent).toBe("login.notice.codeRequested");
  fireEvent.change(input, { target: { value: correct === "000000" ? "111111" : "000000" } });
  fireEvent.click(screen.getByRole("button", { name: "login.verifyCode" }));
  expect(input.getAttribute("aria-invalid")).toBe("true");
  expect(input.getAttribute("aria-describedby")?.split(" ")).toContain(screen.getByRole("alert").id);
  expect(document.activeElement).toBe(input);
});
it("exposes selection and disables unavailable method/provider actions while saving; failure remains reachable for retry", async () => {
  let reject!: (reason: Error) => void;
  state.save.mockImplementationOnce(() => new Promise((_, no) => { reject = no; }));
  const code = requestCode();
  expect(screen.getByRole("button", { name: "account.signup" }).getAttribute("aria-pressed")).toBe("true");
  expect(screen.getByRole("button", { name: "login.email" }).getAttribute("aria-pressed")).toBe("true");
  fireEvent.change(screen.getByTestId("input-login-code"), { target: { value: code } });
  fireEvent.click(screen.getByRole("button", { name: "login.verifyCode" }));
  for (const name of ["login.phone", "login.email", "Apple", "Google", "Facebook", "account.login"]) expect((screen.getByRole("button", { name }) as HTMLButtonElement).disabled).toBe(true);
  expect(document.querySelector('form')?.getAttribute("aria-busy")).toBe("true");
  await act(async () => reject(new Error("Fictional storage denial")));
  const alert = await screen.findByRole("alert");
  expect(document.activeElement).toBe(alert);
  expect(screen.getByRole("button", { name: "login.verifyCode" }).getAttribute("aria-describedby")).toBe(alert.id);
  expect((screen.getByTestId("input-login-code") as HTMLInputElement).value).toBe(code);
  fireEvent.click(screen.getByRole("button", { name: "login.verifyCode" }));
  await waitFor(() => expect(state.navigate).toHaveBeenCalledWith("/app/profile"));
  expect(state.save).toHaveBeenCalledTimes(2);
});
