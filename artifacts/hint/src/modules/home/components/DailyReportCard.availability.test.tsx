/** @vitest-environment jsdom */
import { cleanup, render } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { LanguageProvider } from "../../../lib/i18n";
import { getDailyPullById } from "../data/dailyPulls";
import { DailyReportCard } from "./DailyReportCard";

vi.mock("../../../lib/useDailyTarotDay", () => ({ useDailyTarotDay: () => "2026-11-15" }));
vi.mock("../../../lib/useProfile", () => ({ useProfile: () => ({ profile: null }) }));
vi.mock("../../receipt-printer/ReceiptShareDialog", () => ({ DailyReceiptButton: () => <button>Keep card</button> }));
beforeEach(() => localStorage.clear());
afterEach(cleanup);

it.each([undefined, "The card service is unavailable. Try again."])("keeps the day report available without exposing a provisional card: %s", statusMessage => {
  const view = render(<LanguageProvider><DailyReportCard detailed appearance="page" cardOverride={null} statusMessage={statusMessage} /></LanguageProvider>);
  expect(view.getByRole("status").textContent).toContain(statusMessage ?? "Checking today's signal...");
  expect(view.container.querySelector(".hint-report-header h2")?.textContent).toBeTruthy();
  expect(view.container.querySelector(".hint-report-overall-score")?.textContent).toBeTruthy();
  expect(view.container.querySelectorAll(".hint-report-lucky")).toHaveLength(6);
  expect(view.container.querySelector("[data-daily-card-id]")).toBeNull();
  expect(view.container.querySelector(".hint-report-card-preview")).toBeNull();
  expect(view.queryByRole("button", { name: "Keep card" })).toBeNull();
});

it("adds only the confirmed card when the service recovers", () => {
  const view = render(<LanguageProvider><DailyReportCard detailed cardOverride={null} /></LanguageProvider>);
  const card = getDailyPullById("17-star", "en")!;
  view.rerender(<LanguageProvider><DailyReportCard detailed cardOverride={card} /></LanguageProvider>);
  expect(view.container.querySelector("[data-daily-card-id]")?.getAttribute("data-daily-card-id")).toBe("17-star");
  expect(view.queryByRole("status")).toBeNull();
});
