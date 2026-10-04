import { test, expect, type Page, type TestInfo } from "./fixtures";

test.use({ reducedMotion: "reduce" });
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem("hint_anon_id", "space-navigation-fictional-reader");
    localStorage.setItem("hint_onboarding_complete_v3", "1");
    localStorage.setItem("hint_launch_seen_v2", "1");
    localStorage.setItem("hint-language", "en");
    localStorage.setItem("hint-theme", "bright");
    localStorage.setItem("hint.preferences.v1", JSON.stringify({ reduceMotion: true, soundAndHaptics: false }));
  });
  await page.route("**/api/profile**", route => route.fulfill({ status: 404, json: { error: "PROFILE_NOT_FOUND" } }));
  await page.route("**/api/compatibility/**", route => route.fulfill({ status: 404, json: { error: "NOT_FOUND" } }));
});

async function checkHome(page: Page, route: string, info: TestInfo) {
  await page.goto(`${route}${route.includes("?") ? "&" : "?"}hintPreview=embedded`);
  const home = page.getByRole("link", { name: "Home", exact: true }).first();
  await expect(home).toBeVisible();
  await expect(home).toHaveAttribute("href", "/app");
  const bounds = await home.boundingBox();
  expect(bounds?.width).toBeGreaterThanOrEqual(44);
  expect(bounds?.height).toBeGreaterThanOrEqual(44);
  expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(page.viewportSize()!.height);
  expect(await home.evaluate(element => {
    const r = element.getBoundingClientRect();
    return element.contains(document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2));
  })).toBe(true);
  await page.screenshot({ path: info.outputPath(`${route.replace(/[^a-z0-9]/gi, "-")}.png`) });
  await home.click();
  await expect(page).toHaveURL(/\/app$/);
  await expect(page.locator(".reference-home-crisp")).toBeVisible();
}

for (const [index, routes] of [
  ["/app/astrology", "/app/animal-tarot", "/app/collection", "/app/compatibility"],
  ["/app/daily", "/app/readings", "/app/profile", "/app/rooms"],
  ["/app/tarot", "/app/ask", "/app/personalities"],
  ["/app/journal", "/app/dream", "/app/login", "/app/readings/missing"],
  ["/about", "/privacy", "/terms", "/disclaimer", "/contact"],
].entries()) {
  test(`Every space has a visible direct Home exit: group ${index + 1}`, async ({ page }, info) => {
    for (const route of routes) await checkHome(page, route, info);
  });
}

test("Nested spaces keep a named parent alongside Home after refresh", async ({ page }) => {
  for (const [route, parent] of [
    ["/app/readings/missing", "/app/readings"],
    ["/app/journal", "/app/rooms"],
    ["/app/dream", "/app/rooms"],
    ["/app/login", "/app/profile"],
    ["/privacy", "/app/profile"],
    ["/app/compatibility/invite/missing", "/app/compatibility"],
    ["/app/compatibility/missing", "/app/compatibility"],
  ]) {
    await page.goto(`${route}?hintPreview=embedded`);
    await expect(page.locator("[data-space-navigation]")).toBeVisible();
    await page.reload();
    const nav = page.locator("[data-space-navigation]");
    await expect(nav.getByRole("link", { name: "Home", exact: true })).toHaveAttribute("href", "/app");
    const back = nav.locator(`a[href="${parent}"]`);
    await expect(back).toBeVisible();
    await back.click();
    await expect(page).toHaveURL(new RegExp(`${parent.replaceAll("/", "\\/")}$`));
  }
});

test("Astrology detail returns to signs, birth settings returns to chart, and both retain Home", async ({ page }, info) => {
  await page.goto("/app/astrology?tab=signs&sign=taurus&hintPreview=embedded");
  await page.reload();
  await expect(page.getByRole("heading", { name: "Taurus", exact: true })).toBeVisible();
  await expect(page.locator("[data-space-navigation] [data-space-home]")).toBeVisible();
  await page.getByRole("button", { name: "All twelve signs", exact: true }).click();
  await expect(page).not.toHaveURL(/sign=taurus/);
  await expect(page.locator(".astro-sign-grid")).toBeVisible();
  await page.goto("/app/astrology?tab=birth&hintPreview=embedded");
  await expect(page.locator("form")).toBeVisible();
  await page.locator(".astro-guide-link").filter({ hasText: "My chart" }).first().click();
  await expect(page).toHaveURL(/tab=chart/);
  await expect(page.locator("[data-space-navigation] [data-space-home]")).toBeVisible();
  await page.screenshot({ path: info.outputPath("astrology-parent-and-home.png") });
});
