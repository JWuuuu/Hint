import { test, expect } from "./fixtures";

test.use({ reducedMotion: "reduce" });

for (const locale of ["en", "zh", "es", "ja", "ko"]) {
  test(`Navigation ${locale} keeps complete labels and reachable targets at 200% text`, async ({ page }, info) => {
    await page.addInitScript(locale => {
      localStorage.setItem("hint_anon_id", "navigation-text-fixture");
      localStorage.setItem("hint_onboarding_complete_v3", "1");
      localStorage.setItem("hint-language", locale);
      localStorage.setItem("hint-theme", "bright");
      localStorage.setItem("hint.preferences.v1", JSON.stringify({ reduceMotion: true, soundAndHaptics: false }));
    }, locale);
    await page.route("**/api/profile**", route => route.fulfill({ json: null }));
    await page.goto("/app/profile?hintPreview=embedded");
    const nav = page.locator("[data-app-tabbar]");
    await expect(nav).toBeVisible();
    await page.evaluate(() => document.fonts.ready);
    const dock = nav.locator(".hint-app-dock");
    const scroll = page.locator(".hint-app-scroll").last();
    const baseline = await dock.evaluate(element => element.getBoundingClientRect().height);
    const padding = await scroll.evaluate(element => parseFloat(getComputedStyle(element).paddingBottom));
    await page.screenshot({ path: info.outputPath(`navigation-${locale}-normal.png`) });

    // Web text magnification exercises reflow; physical iOS Dynamic Type remains a device check.
    await nav.locator(".hint-app-tab-label").evaluateAll(labels => {
      const sizes = labels.map(label => [label as HTMLElement, parseFloat(getComputedStyle(label).fontSize)] as const);
      for (const [label, size] of sizes) label.style.fontSize = `${size * 2}px`;
    });
    await expect.poll(async () => dock.evaluate(element => element.getBoundingClientRect().height)).toBeGreaterThan(baseline);
    const magnified = await dock.evaluate(element => element.getBoundingClientRect().height);
    await expect.poll(async () => scroll.evaluate(element => parseFloat(getComputedStyle(element).paddingBottom))).toBeGreaterThanOrEqual(padding + magnified - baseline - 1);
    const metrics = await nav.locator("a").evaluateAll(links => links.map(link => {
      const rect = link.getBoundingClientRect();
      const label = link.querySelector<HTMLElement>(".hint-app-tab-label");
      const labelRect = label?.getBoundingClientRect();
      const range = document.createRange();
      if (label) range.selectNodeContents(label);
      return {
        name: link.textContent,
        width: rect.width,
        height: rect.height,
        bottom: rect.bottom,
        hit: link.contains(document.elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2)),
        overflow: label ? label.scrollWidth - label.clientWidth : 0,
        ellipsis: label ? getComputedStyle(label).textOverflow : "clip",
        outside: labelRect ? [...range.getClientRects()].some(text => text.left < labelRect.left - 1 || text.right > labelRect.right + 1 || text.top < rect.top - 1 || text.bottom > rect.bottom + 1) : false,
      };
    }));
    for (const metric of metrics) {
      expect(metric.width, `${metric.name}: target width`).toBeGreaterThanOrEqual(44);
      expect(metric.height, `${metric.name}: target height`).toBeGreaterThanOrEqual(44);
      expect(metric.bottom, `${metric.name}: target remains inside viewport`).toBeLessThanOrEqual(page.viewportSize()!.height);
      expect(metric.hit, `${metric.name}: target is actionable`).toBe(true);
      expect(metric.overflow, `${metric.name}: label is not horizontally clipped`).toBeLessThanOrEqual(1);
      expect(metric.ellipsis, `${metric.name}: label is complete`).not.toBe("ellipsis");
      expect(metric.outside, `${metric.name}: all text lines remain inside target`).toBe(false);
    }
    await page.screenshot({ path: info.outputPath(`navigation-${locale}-200.png`) });

    // Reducing text restores clearance instead of accumulating height across updates.
    await nav.locator(".hint-app-tab-label").evaluateAll(labels => labels.forEach(label => (label as HTMLElement).style.removeProperty("font-size")));
    await expect.poll(async () => dock.evaluate(element => element.getBoundingClientRect().height)).toBe(baseline);
    await expect.poll(async () => scroll.evaluate(element => parseFloat(getComputedStyle(element).paddingBottom))).toBe(padding);
    await nav.locator('a[href$="/app/ask"]').click();
    await expect(nav).toHaveCount(0);
    await expect.poll(async () => page.evaluate(() => document.documentElement.style.getPropertyValue("--hint-nav-extra-height"))).toBe("");
  });
}
