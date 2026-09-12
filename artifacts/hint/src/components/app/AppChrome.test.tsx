/** @vitest-environment jsdom */
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { Router } from "wouter";
import { memoryLocation } from "wouter/memory-location";
import { ScreenHeader, SpaceNavigation } from "./AppChrome";
import { TRANSLATIONS, type HintLanguage } from "../../lib/i18n";

const state = vi.hoisted(() => ({ language: "en" as HintLanguage }));
vi.mock("../../lib/i18n", async importOriginal => ({
  ...await importOriginal<typeof import("../../lib/i18n")>(),
  useLanguage: () => ({ language: state.language, t: (key: string) => TRANSLATIONS[state.language][key] ?? key }),
}));
vi.mock("../../lib/motionPolicy", () => ({ useMotionPolicy: () => ({ reduced: true, pageVisible: true }) }));
afterEach(() => { cleanup(); state.language = "en"; });

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
