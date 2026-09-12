import { test, expect, type Page } from "./fixtures";

async function inFront(page: Page, testId: string) {
  const control = page.getByTestId(testId);
  // A fully visible element can still sit beneath fixed app navigation. Settle
  // layout, then make the same centering scroll a person can make in the page.
  await page.evaluate(async () => {
    await document.fonts.ready;
    await Promise.all(document.getAnimations().filter(animation => Number.isFinite(Number(animation.effect?.getTiming().iterations))).map(animation => animation.finished.catch(() => {})));
  });
  await control.evaluate(element => element.scrollIntoView({ block: "center", behavior: "instant" }));
  await expect(control).toBeInViewport();
  await expect.poll(() => control.evaluate(element => {
    const box = element.getBoundingClientRect();
    const front = document.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2);
    return front === element || element.contains(front);
  })).toBe(true);
}

for (const locale of ["en", "zh", "es", "ja", "ko"]) for (const theme of ["bright", "dark"]) for (const reducedMotion of [false, true]) for (const systemReduced of [false, true]) {
  test(`${locale} ${theme} appMotion=${reducedMotion} systemMotion=${systemReduced}: quiz edit, preview and mobile layout`, async ({ page }, info) => {
    const errors: string[] = [];
    page.on("pageerror", error => errors.push(error.message));
    await page.addInitScript(({ locale, theme, reducedMotion }) => {
      localStorage.setItem("hint_onboarding_complete_v3", "1");
      localStorage.setItem("hint-language", locale);
      localStorage.setItem("hint-theme", theme);
      localStorage.setItem("hint.preferences.v1", JSON.stringify({ reduceMotion: reducedMotion, soundAndHaptics: false }));
    }, { locale, theme, reducedMotion });
    await page.emulateMedia({ reducedMotion: systemReduced ? "reduce" : "no-preference" });
    await page.route("**/api/**", route => route.fulfill({ status: 503, json: { error: "Isolated fixture" } }));
    await page.route("**/api/profile**", route => route.fulfill({ json: null }));
    await page.goto("/app/personalities?hintPreview=embedded");
    for (let i = 0; i < 6; i++) await page.getByTestId("personality-option").first().click();
    await page.getByTestId("personality-edit").click();
    await page.getByTestId("personality-option").nth(1).click();
    for (let i = 1; i < 6; i++) await page.getByTestId("personality-option").first().click();
    expect(await page.evaluate(() => JSON.parse(localStorage.getItem(`hint_personality_progress_v3:${encodeURIComponent(localStorage.getItem("hint_anon_id")!)}`)!).answers[0])).toBe("delulu");
    await inFront(page, "personality-share");
    await page.screenshot({ path: info.outputPath("personality-result.png") });
    await page.getByTestId("personality-share").click();
    await expect(page.getByRole("dialog").locator("img")).toBeVisible();
    await inFront(page, "personality-download");
    await page.screenshot({ path: info.outputPath("personality-preview.png") });
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).not.toBeVisible();
    for (const route of ["/app/profile", "/app/daily", "/app/astrology?tab=signs"]) {
      await page.goto(`${route}${route.includes("?") ? "&" : "?"}hintPreview=embedded`);
      await expect(page.getByRole("heading").first()).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
      await page.evaluate(async () => { await Promise.all(document.getAnimations().filter(animation => Number.isFinite(Number(animation.effect?.getTiming().iterations))).map(animation => animation.finished.catch(() => {}))); });
      await page.evaluate(async () => {
        document.querySelectorAll<HTMLElement>(".hint-app-scroll, .overflow-y-auto").forEach(element => element.scrollTo({ top: element.scrollHeight, behavior: "instant" }));
        await new Promise(requestAnimationFrame); await new Promise(requestAnimationFrame);
      });
      expect(await page.locator(".hint-app-scroll").last().evaluate(element => element.scrollHeight - element.scrollTop - element.clientHeight)).toBeLessThanOrEqual(2);
      if (locale !== "en" && route.includes("astrology")) await expect(page.locator("body")).not.toContainText("A sign is one part of a chart");
      await page.screenshot({ path: info.outputPath(`${route.split("/").pop()}-bottom.png`) });
    }
    expect(errors).toEqual([]);
  });
}
