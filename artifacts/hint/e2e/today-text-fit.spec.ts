import { mockDailyTarot } from "./daily-tarot-fixture";
import { test, expect, type Page } from "./fixtures";

/** Web text stress, as in merge-visual-matrix: every readable size doubled once. Not native Dynamic Type. */
async function doubleText(page: Page) {
  await page.locator(".hint-home-content").evaluate(root => {
    const nodes = [...root.querySelectorAll<HTMLElement>("h1,h2,h3,p,button,a,span,small,label,strong")]
      .filter(node => !node.closest('[aria-hidden="true"],.sr-only') && node.getBoundingClientRect().height > 0);
    const sizes = nodes.map(node => [node, parseFloat(getComputedStyle(node).fontSize)] as const);
    for (const [node, size] of sizes) node.style.fontSize = `${size * 2}px`;
  });
}

// The card decides the theme word: The Star gives "Hope" / "Esperanza"; with no
// server card the local report gives "Uncertainty" / "Incertidumbre".
for (const language of ["en", "es"] as const)
for (const server of ["answers", "is unavailable"] as const) {
  test(`Today keeps its width at 200% text: ${language}, daily server ${server}`, async ({ page }) => {
    await page.clock.setFixedTime(new Date("2026-09-29T12:00:00Z"));
    await page.addInitScript(language => {
      localStorage.setItem("hint_onboarding_complete_v3", "1");
      localStorage.setItem("hint_anon_id", "h2-fictional-reader");
      localStorage.setItem("hint-language", language);
      localStorage.setItem("hint.preferences.v1", JSON.stringify({ reduceMotion: true, soundAndHaptics: false }));
    }, language);
    // Without the fictional server every /api call answers 503 (fixtures.ts).
    if (server === "answers") await mockDailyTarot(page);
    await page.goto("/app?hintPreview=embedded");
    if (server === "answers") await expect(page.getByTestId("home-reveal-action")).toBeEnabled();
    else await expect(page.locator(".hint-home-sync-status")).toBeVisible();
    await doubleText(page);

    const fit = await page.locator(".hint-home-page").evaluate(scroll => {
      const title = scroll.querySelector(".hint-home-theme-title")!;
      const column = title.parentElement!.getBoundingClientRect();
      const range = document.createRange();
      range.selectNodeContents(title);
      return {
        widened: scroll.scrollWidth - scroll.clientWidth,
        word: title.textContent,
        pastColumn: Math.max(...[...range.getClientRects()].map(line => line.right)) - column.right,
      };
    });
    expect(fit.widened, `"${fit.word}" must not widen Today`).toBeLessThanOrEqual(1);
    expect(fit.pastColumn, `"${fit.word}" stays inside the theme column`).toBeLessThanOrEqual(1);
  });
}
