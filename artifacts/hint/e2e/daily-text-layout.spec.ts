import { test, expect } from "./fixtures";

const copy = {
  zh: ["贝壳项链", "满天星", "正位", "更深的讯息"],
  es: ["Collar de concha", "Paniculata", "Al derecho", "Mensaje más amplio"],
  ja: ["貝殻のネックレス", "カスミソウ", "正位置", "大きなメッセージ"],
  ko: ["조개 목걸이", "안개꽃", "정방향", "더 큰 메시지"],
} as const;

test.use({ timezoneId: "UTC", reducedMotion: "reduce" });
for (const locale of ["zh", "es", "ja", "ko"] as const) for (const theme of ["bright", "dark"]) {
  test(`Daily ${locale} ${theme} keeps localized lucky artwork and full text at 200%`, async ({ page }, info) => {
    test.skip(info.project.name !== "iphone-se", "Targeted SE text stress; normal layout already covers both phone sizes.");
    const errors: string[] = [];
    page.on("pageerror", error => errors.push(error.message));
    await page.clock.setFixedTime(new Date("2026-09-09T12:00:00Z"));
    await page.addInitScript(({ locale, theme }) => {
      localStorage.setItem("hint_anon_id", "daily-text-fixture-35");
      localStorage.setItem("hint_onboarding_complete_v3", "1");
      localStorage.setItem("hint-language", locale);
      localStorage.setItem("hint-theme", theme);
      localStorage.setItem("hint.preferences.v1", JSON.stringify({ reduceMotion: true, soundAndHaptics: false }));
    }, { locale, theme });
    await page.route("**/api/profile**", route => route.fulfill({ json: null }));
    await page.route("**/api/readings**", route => route.fulfill({ json: [] }));
    await page.route("**/api/reading-days**", route => route.fulfill({ json: [] }));
    await page.route("**/api/daily-pull", route => route.fulfill({ json: { anonId: "daily-text-fixture-35", pullDate: "2026-09-09", cardId: "17-star", cardName: "The Star", isFlipped: true, note: "", createdAt: "2026-09-09T12:00:00Z" } }));
    await page.route("**/api/daily-receipts/**", route => {
      const data = route.request().postDataJSON();
      return route.fulfill({ json: { ...data, anonId: "daily-text-fixture-35", anonymousDeviceId: "daily-text-fixture-35", assignedCardId: "17-star", assignedAt: "2026-09-09T12:00:00Z", openedAt: "2026-09-09T12:00:00Z", expiresAt: "2026-09-10T00:00:00Z", source: "server" } });
    });
    await page.goto("/app/daily?hintPreview=embedded");
    await expect(page.getByTestId("input-pull-note")).toBeVisible();
    const [jewelry, flower, upright, major] = copy[locale];
    await expect(page.getByText(upright, { exact: true })).toBeAttached();
    await expect(page.getByText(major, { exact: true })).toBeAttached();
    for (const [label, path] of [[jewelry, "/lucky/jewelry/shell-necklace.png"], [flower, "/lucky/flower/babys-breath.png"]]) {
      const artwork = page.getByRole("img", { name: label, exact: true });
      await expect(artwork).toBeAttached();
      expect(await artwork.locator("img").evaluate(image => new URL((image as HTMLImageElement).src).pathname)).toBe(path);
      await expect(artwork.locator("img")).toHaveAttribute("alt", "");
    }
    await expect(page.locator("body")).not.toContainText(/Upright|Bigger message|Shell Necklace|Good for a softer pace|Baby's Breath/);
    // Simulates web text magnification; this does not claim physical iOS Dynamic Type coverage.
    await page.evaluate(() => {
      const targets = [...document.querySelectorAll<HTMLElement>("h1,h2,h3,p,button,a,span,label,input,textarea")].filter(node => !node.closest('[aria-hidden="true"],.sr-only') && node.getBoundingClientRect().height > 1);
      const sizes = targets.map(node => [node, parseFloat(getComputedStyle(node).fontSize)] as const);
      for (const [node, size] of sizes) node.style.fontSize = `${size * 2}px`;
    });
    const periods = page.getByTestId("button-calendar-jump").locator("..").locator("button[aria-pressed]");
    await expect(periods).toHaveCount(4);
    const periodBounds = await periods.evaluateAll(buttons => buttons.map(button => {
      const box = button.getBoundingClientRect();
      const range = document.createRange(); range.selectNodeContents(button);
      const text = range.getBoundingClientRect();
      return { label: button.textContent, left: text.left - box.left, right: box.right - text.right, overflow: button.scrollWidth - button.clientWidth };
    }));
    for (const bound of periodBounds) {
      expect.soft(bound.left, `${bound.label}: text starts inside its own button`).toBeGreaterThanOrEqual(-1);
      expect.soft(bound.right, `${bound.label}: text ends inside its own button`).toBeGreaterThanOrEqual(-1);
      expect.soft(bound.overflow, `${bound.label}: no overflow into neighboring period`).toBeLessThanOrEqual(1);
    }
    const dateNumbers = page.locator("button[aria-label] span.tabular-nums");
    await expect(dateNumbers).toHaveCount(5);
    for (const number of await dateNumbers.all()) {
      const line = await number.evaluate(element => ({ font: parseFloat(getComputedStyle(element).fontSize), height: parseFloat(getComputedStyle(element).lineHeight) }));
      expect.soft(line.height, "enlarged date glyphs have enough line height").toBeGreaterThanOrEqual(line.font);
    }
    const scroll = page.locator(".hint-app-scroll").last();
    for (const [position, fraction] of [["top", 0], ["middle", 0.5], ["bottom", 1]] as const) {
      await scroll.evaluate(async (element, fraction) => { element.scrollTop = (element.scrollHeight - element.clientHeight) * fraction; await new Promise(requestAnimationFrame); await new Promise(requestAnimationFrame); }, fraction);
      await page.screenshot({ path: info.outputPath(`daily-text-200-${locale}-${theme}-${position}.png`) });
    }
    const lucky = page.getByRole("img", { name: jewelry, exact: true }).locator("..");
    await lucky.scrollIntoViewIfNeeded();
    await page.screenshot({ path: info.outputPath(`daily-text-200-${locale}-${theme}-lucky.png`) });
    const tileMetrics = await lucky.locator("p").evaluateAll(nodes => nodes.map(node => ({ text: node.textContent, width: node.scrollWidth - node.clientWidth, height: node.scrollHeight - node.clientHeight, clamp: getComputedStyle(node).webkitLineClamp, overflow: getComputedStyle(node).overflow })));
    for (const metric of tileMetrics) {
      expect(metric.width, `${metric.text}: horizontal clipping`).toBeLessThanOrEqual(1);
      expect(metric.height, `${metric.text}: vertical clipping`).toBeLessThanOrEqual(1);
      expect(metric.clamp, `${metric.text}: text remains complete`).toBe("none");
    }
    expect(await scroll.evaluate(element => element.scrollWidth <= element.clientWidth + 1)).toBe(true);
    expect(errors).toEqual([]);
  });
}
