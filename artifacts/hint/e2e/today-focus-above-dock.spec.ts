import { mockDailyTarot } from "./daily-tarot-fixture";
import { appHref, test, expect } from "./fixtures";

for (const opened of [false, true]) {
  test(`keyboard focus on Today never rests under the tab bar: card ${opened ? "revealed" : "waiting"}`, async ({ page }) => {
    await page.clock.setFixedTime(new Date("2026-09-29T12:00:00Z"));
    await page.addInitScript(() => {
      localStorage.setItem("hint_onboarding_complete_v3", "1");
      localStorage.setItem("hint_anon_id", "h2-fictional-reader");
      localStorage.setItem("hint-language", "en");
      localStorage.setItem("hint.preferences.v1", JSON.stringify({ reduceMotion: true, soundAndHaptics: false }));
    });
    await mockDailyTarot(page, { opened });
    await page.goto("/app?hintPreview=embedded");
    await expect(page.getByTestId(opened ? "home-reveal-trigger" : "home-reveal-action").first()).toBeEnabled();

    const hidden: string[] = [];
    let stops = 0;
    for (let press = 0; press < 40; press++) {
      await page.keyboard.press("Tab");
      const stop = await page.evaluate(async () => {
        await new Promise(requestAnimationFrame);
        const focused = document.activeElement;
        if (!focused || focused === document.body) return null;
        if (!focused.closest(".hint-home-page") || focused.closest('[role="dialog"]')) return { inPage: false, name: "", under: 0 };
        const box = focused.getBoundingClientRect();
        const dock = document.querySelector(".hint-mascot-dock")!.getBoundingClientRect();
        return { inPage: true, name: focused.getAttribute("aria-label") || focused.textContent!.trim().slice(0, 30), under: box.bottom - dock.top };
      });
      if (!stop) break;
      if (!stop.inPage) { if (stops) break; continue; }
      stops++;
      if (stop.under > 1) hidden.push(`${stop.name}: ${Math.round(stop.under)}px under the tab bar`);
    }
    expect(stops, "Tab reached Today's controls").toBeGreaterThan(0);
    // Windows WebKit's default Tab cycle omits links. Exercise native focus
    // scrolling on every affected destination as well; never scroll it manually.
    for (const path of ["/app/tarot", "/app/astrology", "/app/collection", "/app/personalities"]) {
      const tile = page.locator(`.hint-home-spaces a[href="${appHref(path)}"]`);
      await tile.focus();
      await expect(tile).toBeFocused();
      const under = await tile.evaluate(async focused => {
        await new Promise(requestAnimationFrame);
        return focused.getBoundingClientRect().bottom - document.querySelector(".hint-mascot-dock")!.getBoundingClientRect().top;
      });
      if (under > 1) hidden.push(`${path}: ${Math.round(under)}px under the tab bar`);
    }
    expect(hidden).toEqual([]);
  });
}
