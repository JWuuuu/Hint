// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { ReactNode } from "react";
import { PersonalitiesView } from "./PersonalitiesView";
import { readPersonalityProgress, readPersonalityResults, writePersonalityProgress } from "./personalityProgress";

const visit = vi.hoisted(() => ({ closed: false }));
vi.mock("../../components/app/roomVisits", () => ({ roomVisitWasClosed: () => visit.closed, markRoomVisitStarted: () => { visit.closed = false; } }));
vi.mock("../../components/app/RoomVisitBoundary", () => ({ useRoomVisit: () => {} }));
vi.mock("../../lib/identity", () => ({ getAnonId: () => "quiz-owner" }));
vi.mock("../../lib/clearHistory", () => ({ historyClearVersion: () => "" }));
vi.mock("../../lib/i18n", () => ({ useLanguage: () => ({ language: "en", t: (key: string) => key }) }));
vi.mock("../../lib/LocalizedText", () => ({ translateText: (text: string) => text, LocalizedText: ({ text }: { text: string }) => text }));
vi.mock("../../lib/astro/userBirthProfile", () => ({ readBirthProfile: () => null }));
vi.mock("../../components/app/AppChrome", () => ({ AppScreen: ({ children }: { children: ReactNode }) => <main>{children}</main>, GlassPanel: ({ children }: { children: ReactNode }) => <div>{children}</div>, ScreenHeader: () => <h1>Personalities</h1>, SectionLabel: ({ children }: { children: ReactNode }) => <h2>{children}</h2> }));
beforeEach(() => { localStorage.clear(); visit.closed = false; });
afterEach(cleanup);

it("opens a fresh quiz after departure and manually restores the saved question position", () => {
  const saved = { answers: ["avoid", "think"] as const, questionIndex: 1, result: null };
  writePersonalityProgress("quiz-owner", { ...saved, answers: [...saved.answers] }); visit.closed = true;
  const view = render(<PersonalitiesView />);
  expect(screen.getByText("1 / 6")).toBeTruthy(); expect(readPersonalityProgress("quiz-owner")).toEqual(saved);
  fireEvent.click(screen.getByRole("button", { name: "Return to previous quiz" }));
  expect(screen.getByText("2 / 6")).toBeTruthy(); expect(visit.closed).toBe(false); view.unmount();
  render(<PersonalitiesView />); expect(screen.getByText("2 / 6")).toBeTruthy();
});

it("keeps a previous completed result accessible after starting new answers", () => {
  const saved = { answers: ["avoid", "think", "avoid", "think", "avoid", "think"] as const, questionIndex: 6, result: "The Professional Avoider" };
  writePersonalityProgress("quiz-owner", { ...saved, answers: [...saved.answers] }); visit.closed = true;
  render(<PersonalitiesView />);
  expect(screen.queryByTestId("personality-share")).toBeNull();
  fireEvent.click(screen.getAllByTestId("personality-option")[0]!);
  expect(screen.getByText("2 / 6")).toBeTruthy(); expect(readPersonalityResults("quiz-owner")).toEqual([saved]);
  fireEvent.click(screen.getByText("View previous result"));
  fireEvent.click(screen.getByRole("button", { name: "The Professional Avoider" }));
  expect(screen.getByTestId("personality-share")).toBeTruthy();
});

it("refreshes within the newly started quiz without reviving the previous attempt", () => {
  writePersonalityProgress("quiz-owner", { answers: ["avoid", "think"], questionIndex: 2, result: null }); visit.closed = true;
  const first = render(<PersonalitiesView />);
  fireEvent.click(screen.getAllByTestId("personality-option")[2]!); first.unmount();
  render(<PersonalitiesView />);
  expect(screen.getByText("2 / 6")).toBeTruthy(); expect(readPersonalityProgress("quiz-owner").answers).toEqual(["control"]);
});
