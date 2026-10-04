import { test, expect, type Locator, type Page } from "./fixtures";

const owner = "isolated-period-history-owner";
const today = "2026-09-09";
const now = "2026-09-09T12:00:00.000Z";

function daily(id: string, date: string) {
  return { id, anonId: owner, source: "daily-pull", cardId: "17-star", cardName: "The Star", whisper: `Fictional daily reflection ${id}.`, spreadType: "daily-pull", question: "Tonight's daily card", territory: "daily", createdAt: `${date}T12:00:00.000Z` };
}

function tarot(id: string, date: string) {
  return {
    schemaVersion: 2, id, anonId: owner, source: "tarot", spreadType: "single", spreadLabel: "One card",
    question: `Fictional question ${id}?`, focusLabel: "Self reflection", shortAnswer: `Fictional saved answer ${id}.`,
    questionMeaning: `Fictional context ${id}.`, cardMeanings: ["A small beginning is enough."],
    cards: [{ cardId: "0-fool", name: "The Fool", orientation: "upright", positionLabel: "Your card", keywords: ["Beginning"] }],
    chatMessages: [], interpretationStatus: "local", createdAt: `${date}T14:00:00.000Z`,
  };
}

async function seedHistory(page: Page, dailyRows: ReturnType<typeof daily>[], tarotRows: ReturnType<typeof tarot>[], questions: unknown[] = []) {
  await page.addInitScript(({ dailyRows, tarotRows, questions }) => {
    localStorage.setItem("hint_local_daily_readings", JSON.stringify(dailyRows));
    localStorage.setItem("hint_local_tarot_readings_v1", JSON.stringify(tarotRows));
    localStorage.setItem("hint_local_question_history_v1", JSON.stringify(questions));
  }, { dailyRows, tarotRows, questions });
}

async function daysRead(page: Page, count: number) {
  const stat = page.getByText("Days read", { exact: true }).locator("..");
  await stat.scrollIntoViewIfNeeded();
  await expect(stat.locator("p").last()).toHaveText(String(count));
}

async function expectTouchTargets(controls: Locator) {
  for (const control of await controls.all()) {
    const label = await control.getAttribute("aria-label") ?? await control.innerText();
    const bounds = await control.boundingBox();
    expect(bounds, `${label}: rendered control`).not.toBeNull();
    expect(bounds!.width, `${label}: touch width`).toBeGreaterThanOrEqual(44);
    expect(bounds!.height, `${label}: touch height`).toBeGreaterThanOrEqual(44);
  }
}

test.use({ timezoneId: "UTC", reducedMotion: "reduce" });
test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(new Date(now));
  await page.addInitScript(id => {
    localStorage.setItem("hint_anon_id", id);
    localStorage.setItem("hint_onboarding_complete_v3", "1");
    localStorage.setItem("hint-language", "en");
  }, owner);
  // The shared fixture blocks every other API request, including paid providers.
  await page.route("**/api/profile**", route => route.fulfill({ json: null }));
  await page.route("**/api/readings**", route => route.fulfill({ json: [] }));
  await page.route("**/api/reading-days**", route => route.fulfill({ json: [] }));
  await page.route("**/api/daily-pull", route => {
    const data = route.request().postDataJSON();
    return route.fulfill({ json: { anonId: owner, pullDate: data.date, cardId: "17-star", cardName: "The Star", whisper: "Fictional stable daily card.", isFlipped: true, note: `Fictional note for ${data.date}`, createdAt: now } });
  });
  await page.route("**/api/daily-receipts/**", route => {
    const data = route.request().postDataJSON();
    return route.fulfill({ json: { ...data, anonId: owner, anonymousDeviceId: owner, assignedCardId: data.assignedCardId ?? "17-star", assignedAt: now, openedAt: now, expiresAt: "2026-09-10T00:00:00.000Z", source: "server" } });
  });
});

test("Daily day, week, month and year controls retain calendar-selected periods", async ({ page }, testInfo) => {
  await page.goto("/app/daily?hintPreview=embedded");
  const note = page.getByTestId("input-pull-note");
  await expect(note).toHaveValue(`Fictional note for ${today}`);
  await expectTouchTargets(page.getByRole("button", { name: /^(Day|Week|Month|Year|Previous Day|Next Day)$/ }));

  for (const [period, heading] of [["Week", "Weekly score"], ["Month", "Monthly score"], ["Year", "Yearly score"]]) {
    const button = page.getByRole("button", { name: period, exact: true });
    await button.click();
    await expect(button).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByRole("heading", { name: heading, exact: true })).toBeVisible();
    await expect(note).toHaveCount(0);
    await expectTouchTargets(page.getByRole("button", { name: new RegExp(`^(Previous|Next) ${period}$`) }));
  }

  await page.getByRole("button", { name: "Day", exact: true }).click();
  await page.getByTestId("button-calendar-jump").click();
  const calendar = page.getByTestId("daily-calendar-jump-menu");
  await expect(calendar).toBeVisible();
  await expectTouchTargets(calendar.getByRole("button"));
  await calendar.getByRole("button", { name: "17", exact: true }).click();
  await expect(calendar).toHaveCount(0);
  await expect(note).toHaveValue("Fictional note for 2026-09-17");

  await page.getByRole("button", { name: "Week", exact: true }).click();
  await page.getByTestId("button-calendar-jump").click();
  await expectTouchTargets(calendar.getByRole("button"));
  await calendar.getByRole("button", { name: "14", exact: true }).click();
  await expect(page.getByText("Sep 14 - Sep 20", { exact: true }).first()).toBeVisible();

  await page.getByTestId("button-calendar-jump").click();
  await calendar.getByRole("button", { name: "Month", exact: true }).click();
  await expectTouchTargets(calendar.getByRole("button"));
  await calendar.getByRole("button", { name: "Aug", exact: true }).click();
  await expect(page.getByRole("button", { name: "Month", exact: true })).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByText("August 2026", { exact: true }).first()).toBeVisible();

  await page.getByTestId("button-calendar-jump").click();
  await calendar.getByRole("button", { name: "Year", exact: true }).click();
  await expectTouchTargets(calendar.getByRole("button"));
  await calendar.getByRole("button", { name: "2025", exact: true }).click();
  await expect(page.getByRole("button", { name: "Year", exact: true })).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("heading", { name: "Yearly score", exact: true })).toBeVisible();
  await expect(page.getByText("2025", { exact: true }).first()).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath("calendar-year-selection.png") });
});

test("Days read displays unique dates across local and server records within each period", async ({ page }, testInfo) => {
  await seedHistory(page, [daily("daily-2026-09-09", today), daily("daily-2026-09-08", "2026-09-08"), daily("daily-2026-08-31", "2026-08-31"), daily("daily-2025-12-31", "2025-12-31")],
    [tarot("tarot-duplicate-day", "2026-09-08"), tarot("tarot-week", "2026-09-07"), tarot("tarot-month", "2026-09-01"), tarot("tarot-year", "2026-01-01")]);
  await page.route("**/api/reading-days**", route => route.fulfill({ json: ["2026-09-08", "2026-09-08", "2026-09-10", "2026-09-02", "2026-01-02", "2025-12-30"] }));
  await page.goto("/app/daily?hintPreview=embedded");
  await expect(page.getByTestId("input-pull-note")).toHaveValue(`Fictional note for ${today}`);

  await page.getByRole("button", { name: "Week", exact: true }).click();
  await daysRead(page, 4);
  await page.getByRole("button", { name: "Previous Week", exact: true }).click();
  await daysRead(page, 3);
  await page.getByRole("button", { name: "Next Week", exact: true }).click();
  await daysRead(page, 4);
  await page.getByRole("button", { name: "Month", exact: true }).click();
  await daysRead(page, 6);
  await page.getByRole("button", { name: "Year", exact: true }).click();
  await daysRead(page, 9);
  await page.getByRole("button", { name: "Previous Year", exact: true }).click();
  await daysRead(page, 2);
  await page.reload();
  await expect(page.getByTestId("input-pull-note")).toHaveValue(`Fictional note for ${today}`);
  await page.getByRole("button", { name: "Week", exact: true }).click();
  await daysRead(page, 4);
  await page.screenshot({ path: testInfo.outputPath("unique-reading-days.png") });
});

test("unread earlier periods display zero Days read", async ({ page }) => {
  await page.goto("/app/daily?hintPreview=embedded");
  await expect(page.getByTestId("input-pull-note")).toHaveValue(`Fictional note for ${today}`);
  for (const period of ["Week", "Month", "Year"]) {
    await page.getByRole("button", { name: period, exact: true }).click();
    await page.getByRole("button", { name: `Previous ${period}`, exact: true }).click();
    await daysRead(page, 0);
  }
});

test("History filters isolate fictional records and preserve daily, Tarot and question details", async ({ page }, testInfo) => {
  const dailyId = "daily-2026-09-08";
  const tarotId = "tarot-history-fixture";
  const questionId = "question-history-fixture";
  await seedHistory(page, [daily(dailyId, "2026-09-08")], [tarot(tarotId, today)], [
    { id: questionId, anonId: owner, question: "Fictional standalone question?", focus: "A fictional saved focus", spreadType: "single", createdAt: "2026-09-07T10:00:00.000Z" },
  ]);
  await page.goto("/app/readings?hintPreview=embedded");
  const dailyLink = page.locator(`a[href$="/app/readings/${dailyId}"]`);
  const tarotLink = page.locator(`a[href$="/app/readings/${tarotId}"]`);
  await expect(dailyLink.first()).toBeAttached();
  await expect(tarotLink.first()).toBeAttached();

  await page.getByRole("button", { name: /^Tarot\s*\d+$/ }).click();
  await expect(page.getByText("Tarot history", { exact: true })).toBeVisible();
  await expect(dailyLink).toHaveCount(0);
  await tarotLink.click();
  await expect(page.getByTestId("tarot-history-detail")).toBeVisible();
  await expect(page.getByText(`Fictional saved answer ${tarotId}.`, { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByTestId("tarot-history-detail")).toBeVisible();
  await expect(page.getByText(`Fictional question ${tarotId}?`)).toBeVisible();

  await page.goto("/app/readings?hintPreview=embedded");
  await page.getByRole("button", { name: /^Daily\s*\d+$/ }).click();
  await expect(page.getByText("Daily calendar history", { exact: true })).toBeVisible();
  await expect(tarotLink).toHaveCount(0);
  await dailyLink.click();
  await expect(page.getByRole("heading", { name: "The Star", exact: true })).toBeVisible();
  await expect(page.getByText(`Fictional daily reflection ${dailyId}.`, { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByText(`Fictional daily reflection ${dailyId}.`, { exact: true })).toBeVisible();

  await page.goto("/app/readings?hintPreview=embedded");
  await page.getByRole("button", { name: "Astrology", exact: true }).click();
  await expect(page.getByText("Astrology history", { exact: true })).toBeVisible();
  await expect(page.getByText("Birth profile", { exact: true })).toBeVisible();
  await expect(page.getByText("Chart graph", { exact: true })).toBeVisible();
  await expect(dailyLink).toHaveCount(0);

  await page.getByRole("button", { name: /^Questions\s*\d+$/ }).click();
  await expect(page.getByText("Fictional standalone question?", { exact: true })).toBeVisible();
  await page.locator(`a[href$="/app/readings/${questionId}"]`).click();
  await expect(page.getByText("Question detail", { exact: true })).toBeVisible();
  await expect(page.getByText("Fictional standalone question?")).toBeVisible();
  await page.reload();
  await expect(page.getByText("Fictional standalone question?")).toBeVisible();

  await page.goto("/app/readings?hintPreview=embedded");
  await page.getByRole("button", { name: /^Tarot\s*\d+$/ }).click();
  await page.getByRole("button", { name: /^All\s*\d+$/ }).click();
  await expect(dailyLink.first()).toBeAttached();
  await expect(tarotLink.first()).toBeAttached();
  await page.screenshot({ path: testInfo.outputPath("history-all-filters.png") });
});
