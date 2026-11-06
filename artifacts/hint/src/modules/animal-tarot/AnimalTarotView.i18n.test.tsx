// @vitest-environment jsdom
import { cleanup, fireEvent, render, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { ReactNode } from "react";
import { LanguageProvider } from "../../lib/i18n";
import { AnimalTarotView } from "./AnimalTarotView";

const mocks = vi.hoisted(() => ({ receipt: {
  anonId: "animal-owner", anonymousDeviceId: "animal-owner", featureType: "animal-tarot", dailyKey: "2026-09-10", assignedCardId: "black-cat",
  assignedAt: "2026-09-10T12:00:00Z", expiresAt: "2026-09-11T00:00:00Z", openedAt: null as string | null, source: "api", syncStatus: "synced",
} }));
vi.mock("../../components/app/roomVisits", () => ({ roomVisitWasClosed: () => true, markRoomVisitStarted: () => {} }));
vi.mock("../../components/app/RoomVisitBoundary", () => ({ useRoomVisit: () => {} }));
vi.mock("../../lib/identity", () => ({ getAnonId: () => "animal-owner", getLocalDateString: () => "2026-09-10" }));
vi.mock("../../lib/useLocalDay", () => ({ useLocalDay: () => "2026-09-10" }));
vi.mock("../../lib/motionPolicy", () => ({ useMotionPolicy: () => ({ reduced: true, pageVisible: true }) }));
vi.mock("../../lib/dailyReceipts", () => ({ getOrCreateDailyReceipt: async () => mocks.receipt, getCachedDailyReceipt: () => mocks.receipt, openDailyReceipt: async () => ({ ...mocks.receipt, openedAt: "2026-09-10T12:00:00Z" }), subscribeToDailyReceiptFallbacks: () => () => {} }));
vi.mock("../../shared/tarot/cardCollection", () => ({ saveLocalCollectionUnlock: () => true }));
vi.mock("wouter", () => ({ Link: ({ children, href }: { children: ReactNode; href: string }) => <a href={href}>{children}</a> }));
vi.mock("../../components/app/AppChrome", () => ({ AppScreen: ({ children }: { children: ReactNode }) => <main>{children}</main>, GlassPanel: ({ children }: { children: ReactNode }) => <div>{children}</div>, SpaceNavigation: () => null, SectionLabel: ({ children }: { children: ReactNode }) => <h2>{children}</h2> }));
beforeEach(() => { localStorage.clear(); });
afterEach(cleanup);

const ENGLISH = ["Instinct", "Emotion", "Today", "Mystical animal ritual", "Hold the question loosely", "Draw one animal", "Use the prompt today", "Emotional meaning", "Today's message", "Reflection prompt", "Energy task"];

it.each(["zh", "es", "ja", "ko"])("shows the Animal Tarot chips, steps and reading labels in %s", async language => {
  localStorage.setItem("hint-language", language);
  const view = render(<LanguageProvider><AnimalTarotView /></LanguageProvider>);
  const draw = () => view.container.querySelector<HTMLButtonElement>(".animal-primary-button");
  await waitFor(() => expect(draw()?.disabled).toBe(false));
  const intro = view.container.textContent ?? "";
  for (const english of ENGLISH.slice(0, 7)) expect(intro, `${language} intro`).not.toContain(english);
  fireEvent.click(draw()!);
  await waitFor(() => expect(view.container.querySelector(".animal-reading")).toBeTruthy());
  const labels = [...view.container.querySelectorAll(".animal-reading .hint-app-card > p:first-child")].map(node => node.textContent);
  expect(labels).toHaveLength(4);
  for (const label of labels) expect(ENGLISH, `${language} reading label`).not.toContain(label);
});
