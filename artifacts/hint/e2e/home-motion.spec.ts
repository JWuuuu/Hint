import { mockDailyTarot } from "./daily-tarot-fixture";
import { appHref, expect, test, type Page } from "./fixtures";

async function prepare(page: Page, app: boolean, system: boolean, cardId = "17-star", opened = false) {
  await page.addInitScript(app => {
    localStorage.setItem("hint_onboarding_complete_v3", "1");
    localStorage.setItem("hint_anon_id", "motion-fixture");
    if (!localStorage.getItem("hint-language")) localStorage.setItem("hint-language", "en");
    localStorage.setItem("hint.preferences.v1", JSON.stringify({ reduceMotion: app, soundAndHaptics: false }));
  }, app);
  await page.emulateMedia({ reducedMotion: system ? "reduce" : "no-preference" });
  await page.route("**/api/**", route => route.fulfill({ status: 503, json: { error: "Isolated fixture" } }));
  await mockDailyTarot(page, { cardId, opened });
  await page.goto("/app?hintPreview=embedded");
  if (opened) await expect(page.locator(".hint-home-hero")).toHaveAttribute("data-revealed", "true");
  else await expect(page.getByRole("button", { name: "Reveal today's Hint card" })).toBeEnabled();
}
for (const [app, system] of [[false, false], [true, false], [false, true], [true, true]]) {
  test(`Home respects app=${app} OS=${system}, waits for server reveal, and restores modal focus`, async ({ page }) => {
    await prepare(page, app!, system!);
    // A reveal must stay closed until the server confirms persistence.
    let release!: () => void;
    const pending = new Promise<void>(resolve => { release = resolve; });
    await page.route("**/api/daily-receipts/open", async route => { await pending; await route.fallback(); });
    try {
      const reveal = page.getByRole("button", { name: "Reveal today's Hint card" });
      const opening = page.waitForRequest(request => request.url().endsWith("/api/daily-receipts/open"));
      await reveal.click();
      await opening;
      await expect(page.getByTestId("home-daily-reveal")).toHaveCount(0);
      release();
      // With motion on, the Oct 27-30 Today redesign first plays the mascot's letter delivery.
      const motion = !app && !system;
      if (motion) await page.getByRole("button", { name: "Show my card", exact: true }).click({ timeout: 15000 });
      // The card then turns (about 1.9 s by design) before the interpretation link appears.
      await expect(page.getByRole("link", { name: "Read interpretation" })).toBeVisible({ timeout: motion ? 10000 : 3000 });
      // The full-height card layer must not intercept the visible companion's tap target.
      await page.getByTestId("home-daily-reveal").getByRole("button", { name: "Hint", exact: true }).click();
      await expect(page.getByTestId("home-daily-reveal")).toBeVisible();
      await expect(page.locator("html")).toHaveAttribute("data-hint-reduce-motion", String(app || system));
      if (app || system) await expect.poll(() => page.evaluate(() => document.getAnimations().filter(animation => animation.playState === "running" && animation.effect?.getTiming().iterations === Infinity).length)).toBe(0);
      await page.keyboard.press("Tab");
      expect(await page.getByTestId("home-daily-reveal").evaluate(element => element.contains(document.activeElement))).toBe(true);
      await page.keyboard.press("Escape");
      await expect(page.getByTestId("home-daily-reveal")).toHaveCount(0);
      await expect(page.getByTestId("home-reveal-trigger")).toBeFocused();
    } finally { release(); }
  });
}
test("Home save reports quota failure, retries once and keeps long result actions reachable", async ({ page }, info) => {
  await prepare(page, true, false);
  await page.evaluate(() => {
    const original = Storage.prototype.setItem;
    (window as unknown as { restoreStorage: () => void }).restoreStorage = () => { Storage.prototype.setItem = original; };
    Storage.prototype.setItem = function(key, value) {
      if (key === "hint_local_daily_readings" || key === "hint_local_collection_unlocks_v1") throw new DOMException("fixture quota", "QuotaExceededError");
      return original.call(this, key, value);
    };
  });
  await page.getByRole("button", { name: "Reveal today's Hint card" }).click();
  const save = page.getByTestId("home-save-card");
  await expect(save).toBeEnabled();
  await save.click();
  await expect(page.getByRole("alert")).toContainText("Not saved");
  await page.evaluate(() => (window as unknown as { restoreStorage: () => void }).restoreStorage());
  await save.click();
  await expect(save).toHaveAttribute("aria-pressed", "true");
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem("hint_local_collection_unlocks_v1")!).length)).toBe(1);
  const action = page.getByRole("button", { name: "Return to Today" });
  await action.scrollIntoViewIfNeeded();
  await expect(action).toBeInViewport();
  expect(await action.evaluate(element => { const r = element.getBoundingClientRect(); return element.contains(document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2)); })).toBe(true);
  await page.screenshot({ path: info.outputPath("home-reveal-actions.png") });
  await action.click();
  await page.getByTestId("home-reveal-trigger").click();
  await expect(save).toHaveAttribute("aria-pressed", "true");
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem("hint_local_collection_unlocks_v1")!).length)).toBe(1);
});

test("a failed room chunk can be reloaded without losing its destination", async ({ page }) => {
  await prepare(page, true, false);
  await page.route("**/PersonalitiesView*", route => route.abort("failed"));
  await page.goto("/app/personalities?hintPreview=embedded");
  await expect(page.getByRole("alert")).toContainText("This room could not be loaded");
  await page.unroute("**/PersonalitiesView*");
  await page.getByRole("button", { name: "Reload room" }).click();
  await expect(page.getByRole("heading", { name: "Find Your Type" })).toBeVisible();
  await expect(page).toHaveURL(/\/app\/personalities/);
});

for (const locale of ["en", "zh", "es", "ja", "ko"]) {
  test(`Home reveal action has localized copy and a reachable 44px target (${locale})`, async ({ page }, info) => {
    await page.addInitScript(locale => localStorage.setItem("hint-language", locale), locale);
    await page.addInitScript(() => {
      localStorage.setItem("hint_onboarding_complete_v3", "1");
      localStorage.setItem("hint_anon_id", "home-control-fixture");
      localStorage.setItem("hint.preferences.v1", JSON.stringify({ reduceMotion: true, soundAndHaptics: false }));
    });
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.route("**/api/**", route => route.fulfill({ status: 503, json: { error: "Isolated fixture" } }));
    await mockDailyTarot(page);
    await page.goto("/app?hintPreview=embedded");
    const action = page.getByTestId("home-reveal-action");
    await expect(action).toBeEnabled();
    const expected = { en: "Reveal Today’s Hint", zh: "揭示今日 Hint", es: "Revelar el Hint de hoy", ja: "今日のHintをめくる", ko: "오늘의 Hint 공개" }[locale]!;
    await expect(action).toContainText(expected);
    await action.scrollIntoViewIfNeeded();
    const bounds = await action.boundingBox();
    expect(bounds!.height).toBeGreaterThanOrEqual(44);
    expect(bounds!.width).toBeGreaterThanOrEqual(44);
    expect(await action.evaluate(element => {
      const r = element.getBoundingClientRect();
      return element.contains(document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2)) && element.scrollWidth <= element.clientWidth + 1;
    })).toBe(true);
    await page.screenshot({ path: info.outputPath(`home-control-${locale}.png`) });
    await action.click();
    await expect(page.getByTestId("home-daily-reveal")).toBeVisible();
  });
  test(`Home long card result at 200% text stays readable and scrollable (${locale})`, async ({ page }, info) => {
    await prepare(page, true, false, "knight-pentacles", true);
    await page.evaluate(locale => localStorage.setItem("hint-language", locale), locale);
    await page.reload();
    await page.getByTestId("home-reveal-trigger").click();
    const dialog = page.getByTestId("home-daily-reveal");
    const read = dialog.locator(`a[href="${appHref("/app/daily")}"]`);
    await expect(read).toBeVisible();
    await dialog.evaluate(element => {
      const targets = [...element.querySelectorAll<HTMLElement>("h1,h2,p,button,a,span")].filter(node => !node.closest('[aria-hidden="true"],.sr-only') && node.getBoundingClientRect().height > 1);
      const sizes = targets.map(node => [node, parseFloat(getComputedStyle(node).fontSize)] as const);
      for (const [node, size] of sizes) node.style.fontSize = `${size * 2}px`;
    });
    for (const [position, fraction] of [["top", 0], ["middle", 0.5], ["bottom", 1]] as const) {
      await dialog.evaluate((element, fraction) => { element.scrollTop = (element.scrollHeight - element.clientHeight) * fraction; }, fraction);
      await page.screenshot({ path: info.outputPath(`home-text-200-${locale}-${position}.png`) });
    }
    await read.scrollIntoViewIfNeeded();
    await expect(read).toBeInViewport();
    expect(await read.evaluate(element => { const r = element.getBoundingClientRect(); const target = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2); return target === element || element.contains(target); })).toBe(true);
    expect(await dialog.evaluate(element => element.scrollWidth <= element.clientWidth + 1)).toBe(true);
    const back = dialog.locator("button").last();
    await back.scrollIntoViewIfNeeded();
    expect(await back.evaluate(element => { const r = element.getBoundingClientRect(); return element.contains(document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2)); })).toBe(true);
    await back.click(); await expect(dialog).toHaveCount(0);
  });
}
