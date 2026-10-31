// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeAll, beforeEach, expect, it, vi } from "vitest";
import type { HTMLAttributes, ReactNode } from "react";
import { Route, Router, Switch, useLocation } from "wouter";
import { AppShell } from "./AppShell";
import { OnboardingGate } from "./components/app/OnboardingGate";
import { saveLocalAccount } from "./lib/auth";

vi.mock("./lib/auth", () => {
  const account = { provider: "email", identifier: "returning@hint.test", email: "returning@hint.test", name: "Fixture" };
  return { useLocalAccount: () => account, saveLocalAccount: vi.fn() };
});
vi.mock("./modules/hold/atmosphere", () => {
  const nothing = () => null;
  return {
    PointerProvider: ({ children }: { children: ReactNode }) => <>{children}</>,
    RoomLight: nothing, Particles: nothing, Vignette: nothing, Grain: nothing, Haze: nothing, Moonlight: nothing,
  };
});
vi.mock("./components/app/ConstellationBackdrop", () => ({ ConstellationBackdrop: () => <canvas data-testid="shared-sky" /> }));
vi.mock("./components/app/AppLaunchIntro", () => ({ AppLaunchIntro: () => null }));
vi.mock("./components/app/RoomTransitions", () => ({
  RoomTransitions: ({ children, location: _location, ...props }: HTMLAttributes<HTMLDivElement> & { location: string }) => <div {...props}>{children}</div>,
}));
vi.mock("./components/mascot/HintGuide", () => ({
  useHintGuideEnabled: () => false, useHintGuideGesture: () => undefined, useHintGuideFrames: () => undefined,
  HintGuideSlot: ({ fallback }: { fallback?: ReactNode }) => <>{fallback}</>,
}));
vi.mock("./components/mascot/HintOnboarding", () => ({ HintOnboardingBackdrop: () => null, HintOnboardingWelcome: () => null, onboardingGuideContext: () => ({}) }));
vi.mock("./components/app/LocalProfileSwitcher", () => ({ LocalProfileSwitcher: () => null }));
vi.mock("./lib/analytics", () => ({ trackEvent: vi.fn() }));
vi.mock("./lib/feedback", () => ({ triggerFeedback: vi.fn() }));
vi.mock("./lib/motionPolicy", () => ({ useMotionPolicy: () => ({ reduced: true, pageVisible: true }) }));
vi.mock("./lib/i18n", () => ({ useLanguage: () => ({ language: "en", t: (key: string) => key }) }));
vi.mock("./lib/LocalizedText", () => ({ LocalizedText: ({ text }: { text: string }) => <>{text}</> }));
vi.mock("./lib/useProfile", () => ({
  useProfile: () => ({ anonId: "fixture", profile: { name: "Fixture", birthDate: "2000-02-29" }, saveProfile: vi.fn().mockResolvedValue({}), isSaving: false }),
}));

const COMPLETE_KEY = "hint_onboarding_complete_v3";
let go: (to: string) => void = () => undefined;

function Navigator() {
  const [, navigate] = useLocation();
  go = navigate;
  return null;
}

function TestApp({ base = "" }: { base?: string }) {
  return (
    <Router base={base}>
      <Navigator />
      <AppShell>
        <Switch>
          <Route path="/app/*?">
            <OnboardingGate>
              <Switch>
                <Route path="/app"><p>Today home</p></Route>
                <Route path="/app/daily"><p>Daily room</p></Route>
                <Route path="/app/tarot"><p>Tarot room</p></Route>
              </Switch>
            </OnboardingGate>
          </Route>
        </Switch>
      </AppShell>
    </Router>
  );
}

const appNav = () => screen.queryByRole("navigation", { name: "App" });

async function completeOnboardingWithSavedAccount() {
  fireEvent.click(screen.getByTestId("button-start-onboarding"));
  fireEvent.click(screen.getByTestId("button-save-onboarding-profile"));
  await waitFor(() => expect(screen.getByTestId("onboarding-focus-self")).toBeTruthy());
  fireEvent.click(screen.getByTestId("onboarding-focus-self"));
  fireEvent.click(screen.getByTestId("button-save-onboarding-focus"));
  fireEvent.click(screen.getByText("returning@hint.test"));
}

beforeAll(() => {
  globalThis.ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} } as unknown as typeof ResizeObserver;
  window.scrollTo = vi.fn() as unknown as typeof window.scrollTo;
  Element.prototype.scrollTo = vi.fn() as unknown as typeof Element.prototype.scrollTo;
});
beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  localStorage.setItem("hint_launch_seen_v2", "1");
  vi.mocked(saveLocalAccount).mockClear();
});
afterEach(() => cleanup());

it("shows the app navigation as soon as first-run onboarding finishes, without a reload", async () => {
  window.history.replaceState({}, "", "/app");
  render(<TestApp />);
  expect(screen.getByTestId("onboarding-flow")).toBeTruthy();
  expect(appNav()).toBeNull();

  await completeOnboardingWithSavedAccount();

  expect(await screen.findByText("Today home")).toBeTruthy();
  expect(localStorage.getItem(COMPLETE_KEY)).toBe("1");
  const nav = appNav();
  expect(nav).toBeTruthy();
  expect(within(nav!).getAllByRole("link").map((link) => link.getAttribute("href"))).toEqual(["/app", "/app/daily", "/app/ask", "/app/readings", "/app/profile"]);
});

it("consumes onboarding=reset on replay completion and keeps unrelated query, hash and app base", async () => {
  localStorage.setItem(COMPLETE_KEY, "1");
  window.history.replaceState({}, "", "/hint/app?hintPreview=frame&onboarding=reset#sky");
  render(<TestApp base="/hint" />);
  expect(screen.getByTestId("onboarding-flow")).toBeTruthy();
  expect(appNav()).toBeNull();

  await completeOnboardingWithSavedAccount();

  expect(await screen.findByText("Today home")).toBeTruthy();
  expect(appNav()).toBeTruthy();
  expect(`${window.location.pathname}${window.location.search}${window.location.hash}`).toBe("/hint/app?hintPreview=frame#sky");
});

it("keeps the navigation across normal homepage routes and only hides it for full-screen flows", async () => {
  localStorage.setItem(COMPLETE_KEY, "1");
  window.history.replaceState({}, "", "/app");
  render(<TestApp />);
  expect(screen.getByText("Today home")).toBeTruthy();
  expect(within(appNav()!).getByRole("link", { name: /nav\.today/ }).getAttribute("aria-current")).toBe("page");

  fireEvent.click(within(appNav()!).getByRole("link", { name: /nav\.daily/ }));
  expect(await screen.findByText("Daily room")).toBeTruthy();
  expect(within(appNav()!).getByRole("link", { name: /nav\.daily/ }).getAttribute("aria-current")).toBe("page");

  act(() => go("/app/tarot"));
  expect(await screen.findByText("Tarot room")).toBeTruthy();
  expect(appNav()).toBeNull();

  act(() => go("/app"));
  expect(await screen.findByText("Today home")).toBeTruthy();
  expect(appNav()).toBeTruthy();
});

it("keeps one shared sky mounted across Today, other pages and full-screen rooms", async () => {
  localStorage.setItem(COMPLETE_KEY, "1");
  window.history.replaceState({}, "", "/app");
  render(<TestApp />);
  const sky = screen.getByTestId("shared-sky");
  for (const [path, text] of [["/app/daily", "Daily room"], ["/app/tarot", "Tarot room"], ["/app", "Today home"]] as const) {
    act(() => go(path));
    expect(await screen.findByText(text)).toBeTruthy();
    expect(screen.getAllByTestId("shared-sky")).toEqual([sky]);
  }
});

it("hides the navigation when a replay is opened in-app and restores it when the flag leaves the URL", async () => {
  localStorage.setItem(COMPLETE_KEY, "1");
  window.history.replaceState({}, "", "/app");
  render(<TestApp />);
  expect(appNav()).toBeTruthy();

  act(() => go("/app?onboarding=reset"));
  await waitFor(() => expect(appNav()).toBeNull());

  act(() => go("/app"));
  await waitFor(() => expect(appNav()).toBeTruthy());
});
