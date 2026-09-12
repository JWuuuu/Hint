import { test, expect, type Locator, type Page, type TestInfo } from "./fixtures";

const owner = "quality-gap-fictional-owner";
const longQuestion = `https://reflection.example/${"unbrokenprivatequestion".repeat(12)}end`;
const timestamp = "2026-09-10T12:00:00.000Z";
const historyLocales = [
  ["en", "Readings", "Daily cards", "Questions", "Open reading"],
  ["zh", "阅读", "每日牌", "提问", "查看解读"],
  ["es", "Lecturas", "Cartas diarias", "Preguntas", "Abrir lectura"],
  ["ja", "リーディング", "デイリーカード", "質問", "リーディングを見る"],
  ["ko", "리딩", "오늘의 카드", "질문", "리딩 보기"],
] as const;

test.use({ timezoneId: "UTC" });

async function seed(page: Page, language: string, onboardingComplete = true) {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.addInitScript(({ owner, language, onboardingComplete }) => {
    localStorage.setItem("hint_anon_id", owner);
    localStorage.setItem("hint-language", language);
    localStorage.setItem("hint-theme", "bright");
    localStorage.setItem("hint.preferences.v1", JSON.stringify({ reduceMotion: true, soundAndHaptics: false }));
    if (onboardingComplete) localStorage.setItem("hint_onboarding_complete_v3", "1");
  }, { owner, language, onboardingComplete });
  await page.route("**/api/profile**", route => route.fulfill({ status: 404, json: { error: "PROFILE_NOT_FOUND" } }));
  await page.route("**/api/readings**", route => route.fulfill({ json: [] }));
}

async function magnifyText(scope: Locator) {
  // Browser text reflow is evidence for CSS layout, not native Dynamic Type.
  await scope.evaluate(element => {
    const targets = [...element.querySelectorAll<HTMLElement>("h1,h2,h3,p,span,button,input,a,label")]
      .filter(node => !node.closest('[aria-hidden="true"],.sr-only') && node.getBoundingClientRect().height > 0);
    const sizes = targets.map(node => [node, parseFloat(getComputedStyle(node).fontSize)] as const);
    for (const [node, size] of sizes) node.style.fontSize = `${size * 2}px`;
  });
}

async function containedText(element: Locator) {
  const metrics = await element.evaluate(el => {
    const box = el.getBoundingClientRect();
    const range = document.createRange(); range.selectNodeContents(el);
    const lines = [...range.getClientRects()].filter(line => line.width > 0 && line.height > 0);
    return {
      text: el.textContent,
      horizontalOverflow: el.scrollWidth - el.clientWidth,
      verticalOverflow: el.scrollHeight - el.clientHeight,
      textOverflow: getComputedStyle(el).textOverflow,
      outside: lines.some(line => line.left < box.left - 1 || line.right > box.right + 1 || line.top < box.top - 1 || line.bottom > box.bottom + 1),
      lines: new Set(lines.map(line => Math.round(line.top))).size,
    };
  });
  expect(metrics.horizontalOverflow, `${metrics.text}: horizontal clipping`).toBeLessThanOrEqual(1);
  expect(metrics.verticalOverflow, `${metrics.text}: vertical clipping`).toBeLessThanOrEqual(1);
  expect(metrics.textOverflow, `${metrics.text}: full text retained`).not.toBe("ellipsis");
  expect(metrics.outside, `${metrics.text}: line bounds remain inside the element`).toBe(false);
  return metrics;
}

async function reachable(control: Locator) {
  await control.evaluate(element => element.scrollIntoView({ block: "center", behavior: "instant" }));
  const metrics = await control.evaluate(el => {
    const rect = el.getBoundingClientRect();
    return { width: rect.width, height: rect.height, hit: el.contains(document.elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2)) };
  });
  expect(metrics.width, "Complete action hitbox width").toBeGreaterThanOrEqual(44);
  expect(metrics.height, "Complete action hitbox height").toBeGreaterThanOrEqual(44);
  expect(metrics.hit, "Action center is not covered by fixed UI").toBe(true);
  await containedText(control);
}

async function capturePositions(page: Page, info: TestInfo, label: string) {
  const scroll = page.locator(".hint-app-scroll").last();
  for (const [position, fraction] of [["top", 0], ["middle", 0.5], ["bottom", 1]] as const) {
    await scroll.evaluate((el, fraction) => { el.scrollTop = (el.scrollHeight - el.clientHeight) * fraction; }, fraction);
    await page.screenshot({ path: info.outputPath(`${label}-${position}.png`) });
  }
}

async function aboveNavigation(page: Page, finalContent: Locator) {
  const scroll = page.locator(".hint-app-scroll").last();
  await scroll.evaluate(el => { el.scrollTop = el.scrollHeight; });
  const bounds = await finalContent.boundingBox();
  const nav = await page.locator("[data-app-tabbar]").boundingBox();
  expect(bounds, "Final content exists at the bottom of the scroll").not.toBeNull();
  expect(bounds!.y + bounds!.height, "Final content clears the bottom navigation").toBeLessThanOrEqual(nav?.y ?? page.viewportSize()!.height);
}

test("Spanish Profile keeps the complete save action and optional fields at 200% text", async ({ page }, info) => {
  await seed(page, "es");
  await page.goto("/app/profile?hintPreview=embedded");
  await page.getByTestId("button-edit-profile").click();
  const form = page.locator("form");
  await page.getByTestId("input-name").fill("Fictional Reader");
  await page.getByTestId("input-birthdate").fill("2000-02-29");
  await page.getByTestId("input-birthtime").fill("08:00");
  await page.getByTestId("input-birthplace").fill("Fictional city");
  await page.evaluate(() => document.fonts.ready);
  const save = page.getByTestId("button-save-profile");
  const originalSize = await save.evaluate(el => parseFloat(getComputedStyle(el).fontSize));
  await magnifyText(form);
  expect(await save.evaluate(el => parseFloat(getComputedStyle(el).fontSize))).toBeCloseTo(originalSize * 2);
  await expect(save).toHaveText("Guardar cambios");
  const timeLabel = page.getByTestId("input-birthtime").locator("..");
  const placeLabel = page.getByTestId("input-birthplace").locator("..");
  const time = await timeLabel.boundingBox(); const place = await placeLabel.boundingBox();
  expect(place!.y, "Birth place follows birth time on phone widths").toBeGreaterThanOrEqual(time!.y + time!.height);
  for (const field of [timeLabel, placeLabel]) await containedText(field.locator(":scope > span"));
  await reachable(save);
  await capturePositions(page, info, "profile-es-200text");
  const cancel = form.getByRole("button", { name: "Cancelar", exact: true });
  await aboveNavigation(page, cancel);
  await reachable(cancel);
  await cancel.click();
  await expect(page.getByTestId("button-edit-profile")).toBeVisible();
});

for (const [language, reads, daily, questions, open] of historyLocales) {
  test(`History ${language} preserves long questions, contextual counters and 44px reading actions`, async ({ page }, info) => {
    await seed(page, language);
    await page.addInitScript(({ owner, longQuestion, timestamp }) => {
      localStorage.setItem("hint_local_question_history_v1", JSON.stringify([
        { id: "long-quality-question", anonId: owner, question: longQuestion, focus: "Self reflection", spreadType: "single", createdAt: timestamp },
      ]));
      localStorage.setItem("hint_local_daily_readings", JSON.stringify([
        { id: "quality-daily", anonId: owner, source: "daily-pull", cardId: "17-star", cardName: "The Star", whisper: "Fictional daily reflection.", spreadType: "daily-pull", createdAt: timestamp },
      ]));
    }, { owner, longQuestion, timestamp });
    await page.goto("/app/readings?hintPreview=embedded");
    await page.evaluate(() => document.fonts.ready);
    const stats = page.locator(".grid.grid-cols-3").filter({ has: page.getByText(reads, { exact: true }) });
    for (const label of [reads, daily, questions]) {
      const caption = stats.getByText(label, { exact: true });
      await expect(caption).toBeVisible();
      await expect(caption.locator("..").locator("p").first()).toHaveText("1");
      await containedText(caption);
    }
    expect(longQuestion.length).toBeGreaterThan(160);
    const question = page.getByText(longQuestion, { exact: true });
    await expect(question).toHaveText(longQuestion);
    const card = question.locator("..");
    await expect(card.getByRole("link", { name: open, exact: true })).toHaveAttribute("href", /\/app\/readings\/long-quality-question$/);
    expect((await containedText(question)).lines, "The entire unbroken question wraps over multiple lines").toBeGreaterThan(1);
    expect(await card.evaluate(el => el.scrollWidth - el.clientWidth)).toBeLessThanOrEqual(1);
    const action = card.getByRole("link", { name: open, exact: true });
    await reachable(action);
    if (language === "en" || language === "es") await capturePositions(page, info, `history-${language}`);
    await aboveNavigation(page, action);
    await action.click();
    await expect(page).toHaveURL(/\/app\/readings\/long-quality-question$/);
    const fullQuestion = page.locator("p").filter({ hasText: longQuestion });
    await expect(fullQuestion).toContainText(longQuestion);
    await containedText(fullQuestion);
    if (language === "es") await capturePositions(page, info, "history-es-question-detail");
  });
}

test("a fresh device can learn Astrology and enter birth details without onboarding or email", async ({ page }) => {
  await seed(page, "en", false);
  let calculations = 0;
  await page.route("**/api/astro/**", route => { calculations++; return route.fulfill({ status: 503, json: { error: "UNEXPECTED_PERSONAL_CALCULATION" } }); });
  await page.goto("/app/astrology");
  await expect(page.getByRole("heading", { name: "Twelve ways of being", exact: true })).toBeVisible();
  await expect(page.getByTestId("onboarding-flow")).toHaveCount(0);
  await page.getByRole("navigation", { name: "Astrology sections" }).getByRole("button", { name: "My chart", exact: true }).click();
  await page.getByRole("button", { name: "Create my birth chart", exact: true }).click();
  await expect(page.getByLabel("Name", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Review birth details", exact: true })).toBeVisible();
  await expect(page.locator('input[type="email"]')).toHaveCount(0);
  await expect(page.getByTestId("onboarding-flow")).toHaveCount(0);
  expect(await page.evaluate(() => localStorage.getItem("hint_onboarding_complete_v3"))).toBeNull();
  expect(calculations).toBe(0);
});

// Receipt focus/Escape is covered by TarotRoomFlow.component.test.tsx and the
// complete Tarot room journeys; this suite avoids replaying that ritual again.
