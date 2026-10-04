import { expect, test } from "./fixtures";
import { writeFile } from "node:fs/promises";

const routes = ["/app", "/app/daily", "/app/astrology", "/app/collection", "/app/personalities", "/app/ask", "/app/readings", "/app/readings/missing", "/app/profile", "/app/rooms", "/app/journal", "/app/dream", "/app/compatibility", "/app/login", "/app/not-a-real-page", "/about", "/privacy", "/terms", "/disclaimer", "/contact"];

test("non-Tarot route and phone layout inventory", async ({ page }, testInfo) => {
  test.setTimeout(120_000);
  await page.addInitScript(() => {
    localStorage.setItem("hint_onboarding_complete_v3", "1");
    localStorage.setItem("hint.preferences.v1", JSON.stringify({ reduceMotion: true, soundAndHaptics: false }));
    localStorage.setItem("hint-language", "en");
  });
  await page.route("**/api/**", (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path === "/api/profile") return route.fulfill({ json: null });
    if (path === "/api/journal" || path === "/api/readings" || path === "/api/daily-pulls" || path === "/api/tarot/history") return route.fulfill({ json: [] });
    return route.fulfill({ status: 503, json: { error: "Audit unavailable service" } });
  });
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  const report = [];
  for (const path of routes) {
    const before = errors.length;
    await page.goto(`${path}?hintPreview=embedded`);
    await expect(page.locator("body")).not.toBeEmpty();
    // Collect after the route heading settles; allow unheaded empty states too.
    await page.locator("h1, h2, input, textarea").first().waitFor({ timeout: 8000 }).catch(() => {});
    await expect.poll(() => page.locator("h1,h2").first().evaluate((element) => {
      for (let el: Element | null = element; el; el = el.parentElement) if (Number(getComputedStyle(el).opacity) < 0.98) return false;
      return true;
    }).catch(() => true)).toBe(true);
    const result = await page.evaluate(() => {
      const visible = (el: Element) => el.getBoundingClientRect().width > 0 && getComputedStyle(el).visibility !== "hidden";
      return {
        headings: [...document.querySelectorAll("h1,h2")].filter(visible).map((el) => el.textContent?.trim()),
        horizontalOverflow: [...document.querySelectorAll(".hint-app-scroll, main")].filter(visible).filter((el) => el.scrollWidth > el.clientWidth + 2).map((el) => ({ cls: el.className, width: el.clientWidth, scroll: el.scrollWidth })),
        clippedText: [...document.querySelectorAll("h1,h2,h3,p,button,summary")].filter(visible).filter((el) => {
          const css = getComputedStyle(el);
          return ["hidden", "clip"].includes(css.overflowY) && el.scrollHeight > el.clientHeight + 3;
        }).map((el) => el.textContent?.trim().slice(0, 160)),
        tinyControls: [...document.querySelectorAll("button,input,select,textarea")].filter(visible).filter((el) => el.getBoundingClientRect().height < 40).length,
      };
    });
    report.push({ path, ...result, errors: errors.slice(before) });
    await page.screenshot({ path: testInfo.outputPath(`${path.replaceAll("/", "-")}.png`) });
    expect.soft(errors.slice(before), `${path} runtime errors`).toEqual([]);
    if (!path.startsWith("/app")) await expect(page.getByRole("navigation", { name: "App", exact: true })).toHaveCount(0);
    expect.soft(result.horizontalOverflow, `${path} horizontal overflow`).toEqual([]);
  }
  await writeFile(testInfo.outputPath("audit.json"), JSON.stringify(report, null, 2));
});
