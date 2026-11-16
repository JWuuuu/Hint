/** @vitest-environment jsdom */
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { createPortal } from "react-dom";
import { afterEach, expect, it, vi } from "vitest";
import { Router } from "wouter";
import { memoryLocation } from "wouter/memory-location";
import { AppScreen, ScreenHeader, SpaceNavigation } from "./AppChrome";
import { TRANSLATIONS, type HintLanguage } from "../../lib/i18n";

const state = vi.hoisted(() => ({ language: "en" as HintLanguage }));
vi.mock("../../lib/i18n", async importOriginal => ({
  ...await importOriginal<typeof import("../../lib/i18n")>(),
  useLanguage: () => ({ language: state.language, t: (key: string) => TRANSLATIONS[state.language][key] ?? key }),
}));
vi.mock("../../lib/motionPolicy", () => ({ useMotionPolicy: () => ({ reduced: true, pageVisible: true }) }));
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); state.language = "en"; });

it.each(["en", "zh", "es", "ja", "ko"] as const)("provides a named Home destination in %s after a direct link", language => {
  state.language = language;
  const route = memoryLocation({ path: "/app/astrology?tab=chart", record: true });
  render(<Router hook={route.hook}><SpaceNavigation /></Router>);
  const home = screen.getByRole("link", { name: TRANSLATIONS[language]["common.home"] });
  expect(home.getAttribute("href")).toBe("/app");
  fireEvent.click(home);
  expect(route.history?.at(-1)).toBe("/app");
});

it("keeps the known parent and Home distinct without relying on browser history", () => {
  const route = memoryLocation({ path: "/app/readings/missing", record: true });
  render(<Router hook={route.hook}><ScreenHeader title="Reading" backHref="/app/readings" backLabel="History" /></Router>);
  expect(screen.getByRole("link", { name: "Home" }).getAttribute("href")).toBe("/app");
  fireEvent.click(screen.getByRole("link", { name: "History" }));
  expect(route.history?.at(-1)).toBe("/app/readings");
});

it("uses one Home control for top-level headers and respects a scoped app base", () => {
  const route = memoryLocation({ path: "/preview/app/daily", record: true });
  render(<Router base="/preview" hook={route.hook}><ScreenHeader title="Daily" /></Router>);
  expect(screen.getAllByRole("link")).toHaveLength(1);
  const home = screen.getByRole("link", { name: "Home" });
  expect(home.getAttribute("href")).toBe("/preview/app");
  fireEvent.click(home);
  expect(route.history?.at(-1)).toBe("/preview/app");
});

it("does not scroll the background when a React descendant focuses inside a portal", () => {
  const frames: FrameRequestCallback[] = [];
  vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => { frames.push(callback); return frames.length; });
  vi.stubGlobal("cancelAnimationFrame", vi.fn());
  render(<AppScreen><p>Background content</p>{createPortal(<div role="dialog"><button>Dialog action</button></div>, document.body)}</AppScreen>);
  const scroller = document.querySelector<HTMLElement>(".hint-app-scroll")!;
  const button = screen.getByRole("button", { name: "Dialog action" });
  vi.spyOn(scroller, "getBoundingClientRect").mockReturnValue(new DOMRect(0, 0, 375, 600));
  vi.spyOn(button, "getBoundingClientRect").mockReturnValue(new DOMRect(20, 900, 100, 44));
  scroller.style.scrollPaddingTop = "20px";
  scroller.style.scrollPaddingBottom = "120px";
  scroller.scrollTop = 120;
  act(() => button.focus());
  expect(document.activeElement).toBe(button);
  expect(scroller.contains(button)).toBe(false);
  expect(frames.length).toBeGreaterThan(0);
  act(() => { for (const frame of frames.splice(0)) frame(performance.now()); });
  expect(scroller.scrollTop).toBe(120);
});
