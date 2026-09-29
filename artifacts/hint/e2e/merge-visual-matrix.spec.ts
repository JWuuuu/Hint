import { test, expect, type Page, type TestInfo } from "./fixtures";
import { getTarotCardImage } from "../src/modules/tarot/logic/cardImageMap";

const labels = {
  en: ["Share receipt", "Show receipt", "Check image"],
  zh: ["分享小票", "直接查看小票", "检查分享图片"],
  es: ["Compartir recibo", "Ver recibo", "Revisar imagen"],
  ja: ["レシートを共有", "レシートを見る", "画像を確認"],
  ko: ["영수증 공유", "영수증 보기", "이미지 확인"],
} as const;

async function enlarge(page: Page, selector: string, scale: number) {
  if (scale !== 200) return;
  await page.locator(selector).evaluate(root => {
    // Web text stress, not a claim of native Dynamic Type coverage. Read all
    // original sizes first so nested elements are never accidentally quadrupled.
    const nodes = [...root.querySelectorAll<HTMLElement>("h1,h2,h3,p,button,a,span,small,label,strong,input,textarea")]
      .filter(node => !node.closest('[aria-hidden="true"],.sr-only') && node.getBoundingClientRect().height > 0);
    const sizes = nodes.map(node => [node, parseFloat(getComputedStyle(node).fontSize)] as const);
    for (const [node, size] of sizes) node.style.fontSize = `${size * 2}px`;
  });
}

async function inspectScroll(page: Page, selector: string, name: string, info: TestInfo) {
  const scroll = page.locator(selector).last();
  const frames = [];
  for (const [position, fraction] of [["top", 0], ["middle", .5], ["bottom", 1]] as const) {
    await scroll.evaluate(async (el, fraction) => {
      el.scrollTop = (el.scrollHeight - el.clientHeight) * fraction;
      await new Promise(requestAnimationFrame); await new Promise(requestAnimationFrame);
    }, fraction);
    const geometry = await scroll.evaluate(root => {
      const viewport = root.getBoundingClientRect();
      const nodes = [...root.querySelectorAll<HTMLElement>("h1,h2,h3,p,button,label")].filter(node => {
        const r = node.getBoundingClientRect();
        return r.width > 0 && r.height > 0 && r.bottom > viewport.top && r.top < viewport.bottom && !node.closest('[aria-hidden="true"],.sr-only');
      });
      return { overflowX: root.scrollWidth - root.clientWidth,
        clipped: nodes.filter(node => {
          if (!["hidden", "clip"].includes(getComputedStyle(node).overflowY)) return false;
          const box = node.getBoundingClientRect();
          const walker = document.createTreeWalker(node, NodeFilter.SHOW_TEXT);
          let child: Node | null;
          while ((child = walker.nextNode())) {
            if (!child.textContent?.trim() || child.parentElement?.closest('.sr-only,[aria-hidden="true"]')) continue;
            const range = document.createRange(); range.selectNodeContents(child);
            for (const text of range.getClientRects()) if (text.height > 0 && (text.top < box.top - 2 || text.bottom > box.bottom + 2)) return true;
          }
          // Sparkle pseudo-elements extend button scrollHeight intentionally;
          // only real text bounds establish that its label has been cropped.
          return false;
        })
          .map(node => ({ text: node.textContent, className: node.className, clamp: getComputedStyle(node).webkitLineClamp })),
      };
    });
    expect.soft(geometry.overflowX, `${name}/${position}: horizontal container`).toBeLessThanOrEqual(1);
    // Home summaries deliberately open a complete card detail. All
    // other clipped paragraphs/actions are failures, with screenshots retained.
    expect.soft(geometry.clipped.filter(item => !item.className.includes("hint-home-card-copy")), `${name}/${position}: clipped content`).toEqual([]);
    frames.push({ position, ...geometry });
    await page.screenshot({ path: info.outputPath(`${name}-${position}.png`) });
  }
  await info.attach(`${name}-geometry`, { body: JSON.stringify(frames), contentType: "application/json" });
}

async function inspectDock(page: Page) {
  const labels = await page.locator(".hint-app-tab-label").evaluateAll(nodes => nodes.map(node => {
    const text = node.getBoundingClientRect();
    const button = node.closest("a")!.getBoundingClientRect();
    const orb = node.closest("a")!.querySelector(".hint-app-tab-orb")?.getBoundingClientRect();
    const ink = getComputedStyle(node).color.match(/[\d.]+/g)!.slice(0, 3).map(Number).reduce((sum, value) => sum + value, 0) / 3;
    return { label: node.textContent, top: text.top, bottom: text.bottom, left: text.left, right: text.right,
      button: { top: button.top, bottom: button.bottom, left: button.left, right: button.right }, orbBottom: orb?.bottom,
      dark: document.documentElement.dataset.hintTheme === "dark", ink };
  }));
  for (const item of labels) {
    expect.soft(item.top, `${item.label}: label stays inside its button`).toBeGreaterThanOrEqual(item.button.top - 1);
    expect.soft(item.bottom, `${item.label}: label stays inside its button`).toBeLessThanOrEqual(item.button.bottom + 1);
    expect.soft(item.left).toBeGreaterThanOrEqual(item.button.left - 1);
    expect.soft(item.right).toBeLessThanOrEqual(item.button.right + 1);
    if (item.orbBottom !== undefined) expect.soft(item.top, `${item.label}: label clears the Ask orb`).toBeGreaterThanOrEqual(item.orbBottom + 1);
    if (item.dark) expect.soft(item.ink, `${item.label}: dark dock uses the night text palette`).toBeGreaterThan(150);
  }
}

for (const language of ["en", "zh", "es", "ja", "ko"] as const)
for (const theme of ["bright", "dark"] as const)
for (const [appReduced, systemReduced] of [[false, false], [true, false], [false, true], [true, true]])
for (const scale of [100, 200]) {
  test(`merge matrix ${language} ${theme} app=${appReduced} system=${systemReduced} text=${scale}`, async ({ page }, info) => {
    const errors: string[] = [];
    page.on("pageerror", error => errors.push(error.message));
    await page.clock.setFixedTime(new Date("2026-09-29T12:00:00Z"));
    await page.addInitScript(({ language, theme, appReduced }) => {
      localStorage.setItem("hint_onboarding_complete_v3", "1");
      localStorage.setItem("hint_anon_id", "matrix-fictional-reader");
      localStorage.setItem("hint-language", language);
      localStorage.setItem("hint-theme", theme);
      localStorage.setItem("hint.preferences.v1", JSON.stringify({ reduceMotion: appReduced, soundAndHaptics: false }));
    }, { language, theme, appReduced });
    await page.emulateMedia({ reducedMotion: systemReduced ? "reduce" : "no-preference" });
    await page.goto("/app?hintPreview=embedded");
    await page.getByTestId("home-reveal-action").click();
    await expect(page.getByTestId("home-daily-reveal")).toBeVisible();
    await page.keyboard.press("Escape");
    const id = await page.locator(".hint-home-hero").getAttribute("data-daily-card-id");
    await enlarge(page, ".hint-home-content", scale);
    await enlarge(page, "[data-app-tabbar]", scale);
    await inspectDock(page);
    const title = page.locator("#hint-home-card-title");
    expect.soft(await title.evaluate(el => el.scrollWidth - el.clientWidth), "card title stays clear of its artwork").toBeLessThanOrEqual(1);
    const homeInk = await title.evaluate(el => getComputedStyle(el).color.match(/[\d.]+/g)!.slice(0, 3).map(Number).reduce((sum, value) => sum + value, 0) / 3);
    expect.soft(homeInk > 150, "Home text uses the selected light/dark palette").toBe(theme === "dark");
    const energy = await page.locator(".hint-home-energy-summary").evaluate(el => ({
      numberRight: el.querySelector(".hint-home-energy-total")!.getBoundingClientRect().right,
      themeLeft: el.querySelector(".hint-home-theme")!.getBoundingClientRect().left,
    }));
    expect.soft(energy.numberRight, "energy total never overlaps the adjacent theme").toBeLessThanOrEqual(energy.themeLeft - 4);
    await inspectScroll(page, ".hint-home-page", "home", info);

    const [shareLabel, skipLabel, previewLabel] = labels[language];
    const trigger = page.getByRole("button", { name: shareLabel, exact: true });
    await trigger.scrollIntoViewIfNeeded();
    const before = await page.locator(".hint-home-page").evaluate(el => el.scrollTop);
    await trigger.click();
    const dialog = page.getByTestId("receipt-share-dialog");
    await expect(page.locator("html")).toHaveAttribute("data-hint-theme", theme);
    await expect(page.locator("html")).toHaveAttribute("data-hint-reduce-motion", String(appReduced || systemReduced));
    if (!appReduced && !systemReduced) {
      await expect(dialog.locator(".receipt-printer")).toHaveAttribute("data-phase", "printing");
      await dialog.getByRole("button", { name: skipLabel, exact: true }).click();
    }
    await expect(dialog.getByRole("button", { name: shareLabel, exact: true })).toBeEnabled();
    await expect(dialog.locator(".receipt-printer__card-image")).toHaveAttribute("src", getTarotCardImage(id!, "hint-classic")!);
    await enlarge(page, '[data-testid="receipt-share-dialog"]', scale);
    await inspectScroll(page, ".receipt-share-scroll", "receipt", info);
    await expect(dialog.locator(".receipt-printer__result-content footer")).toBeInViewport();
    for (const button of await dialog.locator(".receipt-share-footer button").all()) {
      const box = (await button.boundingBox())!;
      expect(box.height).toBeGreaterThanOrEqual(44); expect(box.width).toBeGreaterThanOrEqual(44);
      expect(await button.evaluate(el => { const r = el.getBoundingClientRect(); return el.contains(document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2)); })).toBe(true);
    }
    await page.keyboard.press("Tab");
    expect(await dialog.evaluate(el => el.contains(document.activeElement))).toBe(true);
    await dialog.getByRole("button", { name: previewLabel, exact: true }).click();
    await expect(dialog.getByTestId("receipt-image-preview")).toBeVisible();
    await dialog.locator(".receipt-share-scroll").evaluate(el => { el.scrollTop = 0; });
    await page.screenshot({ path: info.outputPath("receipt-png-preview.png") });
    await page.keyboard.press("Escape");
    await expect(trigger).toBeFocused();
    expect(await page.locator(".hint-home-page").evaluate(el => el.scrollTop)).toBeCloseTo(before, 0);

    await page.goto("/app/daily?hintPreview=embedded");
    await expect(page.getByTestId("input-pull-note")).toBeVisible();
    const dailyInk = await page.locator(".hint-daily-page h1").evaluate(el => getComputedStyle(el).color.match(/[\d.]+/g)!.slice(0, 3).map(Number).reduce((sum, value) => sum + value, 0) / 3);
    expect.soft(dailyInk > 150, "Daily text uses the selected light/dark palette").toBe(theme === "dark");
    await enlarge(page, ".hint-app-scroll", scale);
    await enlarge(page, "[data-app-tabbar]", scale);
    await inspectDock(page);
    await inspectScroll(page, ".hint-app-scroll", "daily", info);
    await page.getByRole("button", { name: shareLabel, exact: true }).click();
    await expect(dialog.locator(".receipt-printer__card-image")).toHaveAttribute("src", getTarotCardImage(id!, "hint-classic")!);
    await page.keyboard.press("Escape");
    await expect(dialog).toHaveCount(0);
    expect(errors).toEqual([]);
  });
}
