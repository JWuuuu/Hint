import { test, expect, type Page } from "./fixtures";
import { getTarotCardImage } from "../src/modules/tarot/logic/cardImageMap";
import { readFile } from "node:fs/promises";

async function prepare(page: Page, language = "en", theme = "bright", appReduced = true, systemReduced = true) {
  await page.clock.setFixedTime(new Date("2026-09-28T12:00:00Z"));
  await page.addInitScript(({ language, theme, appReduced }) => {
    Object.defineProperty(navigator, "share", { configurable: true, value: undefined });
    Object.defineProperty(navigator, "canShare", { configurable: true, value: undefined });
    localStorage.setItem("hint_onboarding_complete_v3", "1");
    localStorage.setItem("hint_anon_id", "three-way-merge-fixture");
    localStorage.setItem("hint-language", language);
    localStorage.setItem("hint-theme", theme);
    localStorage.setItem("hint.preferences.v1", JSON.stringify({ theme, reduceMotion: appReduced, soundAndHaptics: false }));
  }, { language, theme, appReduced });
  await page.emulateMedia({ reducedMotion: systemReduced ? "reduce" : "no-preference" });
  await page.goto("/app?hintPreview=embedded");
  await expect(page.getByTestId("home-reveal-action")).toBeEnabled();
}
async function reveal(page: Page) {
  await page.getByTestId("home-reveal-action").click();
  await expect(page.getByTestId("home-daily-reveal")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByTestId("home-daily-reveal")).toHaveCount(0);
}
const copy = {
  en: { share: "Share receipt", skip: "Show receipt", preview: "Check image", replay: "Print again" },
  zh: { share: "分享小票", skip: "直接查看小票", preview: "检查分享图片", replay: "再次打印" },
  es: { share: "Compartir recibo", skip: "Ver recibo", preview: "Revisar imagen", replay: "Volver a imprimir" },
  ja: { share: "レシートを共有", skip: "レシートを見る", preview: "画像を確認", replay: "もう一度印刷" },
  ko: { share: "영수증 공유", skip: "영수증 보기", preview: "이미지 확인", replay: "다시 인쇄" },
};
for (const language of ["en", "zh", "es", "ja", "ko"] as const) {
  for (const [appReduced, systemReduced, theme, scale] of [[false, false, "bright", 100], [true, false, "dark", 100], [false, true, "bright", 200], [true, true, "dark", 200]] as const) {
    test(`merged receipt ${language} ${theme} app=${appReduced} system=${systemReduced} text=${scale}`, async ({ page }, info) => {
      await prepare(page, language, theme, appReduced, systemReduced);
      if (language !== "en") await expect(page.locator(".hint-home-sections")).not.toContainText(/Why this hint\?|Questions & spreads|Saved cards & readings|Your chart & transits/);
      await reveal(page);
      const id = await page.locator(".hint-home-hero").getAttribute("data-daily-card-id");
      await page.getByRole("button", { name: copy[language].share, exact: true }).click();
      const dialog = page.getByTestId("receipt-share-dialog");
      await expect(dialog).toBeVisible();
      await expect(page.locator("html")).toHaveAttribute("data-hint-theme", theme);
      await expect(page.locator("html")).toHaveAttribute("data-hint-reduce-motion", String(appReduced || systemReduced));
      const printer = dialog.locator(".receipt-printer");
      if (!appReduced && !systemReduced) {
        await expect(printer).toHaveAttribute("data-phase", "printing");
        await dialog.getByRole("button", { name: copy[language].skip, exact: true }).click();
      }
      const share = dialog.getByRole("button", { name: copy[language].share, exact: true });
      await expect(share).toBeEnabled();
      if (scale === 200) await dialog.evaluate(element => {
        const nodes = [...element.querySelectorAll<HTMLElement>("h2,p,button,span,small,label,strong")].filter(node => node.getBoundingClientRect().height > 1);
        const sizes = nodes.map(node => [node, parseFloat(getComputedStyle(node).fontSize)] as const);
        for (const [node, size] of sizes) node.style.fontSize = `${size * 2}px`;
      });
      const cards = dialog.locator(".receipt-printer__card-image");
      await expect(cards).toHaveCount(1);
      await expect(cards).toHaveAttribute("src", getTarotCardImage(id!, "hint-classic")!);
      await page.keyboard.press("Tab");
      expect(await dialog.evaluate(element => element.contains(document.activeElement))).toBe(true);
      for (const button of await dialog.locator(".receipt-share-footer button").all()) {
        const box = await button.boundingBox();
        expect(box!.height).toBeGreaterThanOrEqual(44); expect(box!.width).toBeGreaterThanOrEqual(44);
        expect(await button.evaluate(element => { const r = element.getBoundingClientRect(); return element.contains(document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2)); })).toBe(true);
      }
      await dialog.locator(".receipt-share-scroll").evaluate(element => { element.scrollTop = element.scrollHeight; });
      await expect(dialog.locator(".receipt-printer__result-content footer")).toBeInViewport();
      await page.screenshot({ path: info.outputPath("receipt-bottom.png") });
      await dialog.getByRole("button", { name: copy[language].preview, exact: true }).click();
      await expect(dialog.getByTestId("receipt-image-preview")).toBeVisible();
      await dialog.locator(".receipt-share-scroll").evaluate(element => { element.scrollTop = 0; });
      await page.screenshot({ path: info.outputPath("receipt-image.png") });
      await page.keyboard.press("Escape");
      await expect(dialog).toHaveCount(0);
      await expect(page.locator(".hint-home-hero")).toHaveAttribute("data-daily-card-id", id!);
      await expect(page.getByRole("button", { name: copy[language].share, exact: true })).toBeFocused();
    });
  }
}

test("Home, Daily and receipt keep the locked card after refresh and export an actual PNG", async ({ page }, info) => {
  await prepare(page); await reveal(page);
  const id = await page.locator(".hint-home-hero").getAttribute("data-daily-card-id");
  const title = await page.locator("#hint-home-card-title").innerText();
  await page.goto("/app/daily?hintPreview=embedded");
  await expect(page.getByRole("button", { name: "Share receipt", exact: true })).toBeEnabled();
  await page.getByRole("button", { name: "Share receipt", exact: true }).click();
  const dialog = page.getByTestId("receipt-share-dialog");
  await expect(dialog.locator(".receipt-printer__card-block h2")).toHaveText(title);
  await expect(dialog.locator(".receipt-printer__card-image")).toHaveAttribute("src", getTarotCardImage(id!, "hint-classic")!);
  const download = page.waitForEvent("download");
  await dialog.getByRole("button", { name: "Share receipt", exact: true }).click();
  const file = await download; await file.saveAs(info.outputPath("daily-receipt.png"));
  const bytes = await readFile((await file.path())!);
  expect(bytes.subarray(0, 8)).toEqual(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  expect(bytes.readUInt32BE(16)).toBe(1800);
  await page.keyboard.press("Escape"); await page.reload();
  await page.getByRole("button", { name: "Share receipt", exact: true }).click();
  await expect(dialog.locator(".receipt-printer__card-block h2")).toHaveText(title);
});

test("a saved historical Daily card wins over an unopened allocation and shares without invented scores", async ({ page }) => {
  await prepare(page);
  await page.evaluate(() => {
    const owner = localStorage.getItem("hint_anon_id");
    localStorage.setItem("hint_local_daily_readings", JSON.stringify([{ id: "daily-2026-09-27", anonId: owner, source: "daily-pull", cardId: "18-moon", cardName: "The Moon", spreadType: "daily-pull", question: "daily", whisper: "A saved reflection.", createdAt: "2026-09-27T12:00:00Z" }]));
    localStorage.setItem("hint_daily_receipt_fallbacks_v1", JSON.stringify([{ anonId: owner, anonymousDeviceId: owner, featureType: "daily-card", dailyKey: "2026-09-27", assignedCardId: "17-star", assignedAt: "2026-09-27T12:00:00Z", openedAt: null, expiresAt: "2026-09-28T00:00:00Z", source: "local" }]));
  });
  await page.goto("/app/daily?hintPreview=embedded");
  await page.getByRole("button", { name: "Previous Day", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Saved daily card" })).toBeVisible();
  await expect(page.locator(".hint-report-card-intro h3")).toHaveText("The Moon");
  await expect(page.locator(".hint-report-overall-score")).toHaveCount(0);
  await expect(page.locator(".hint-report-lucky-grid")).toHaveCount(0);
  await page.getByRole("button", { name: "Share receipt", exact: true }).click();
  const dialog = page.getByTestId("receipt-share-dialog");
  await expect(dialog.locator(".receipt-printer__card-block h2")).toHaveText("The Moon");
  await expect(dialog.locator(".receipt-paper-date")).toHaveText("September 27, 2026");
  await expect(dialog.locator(".receipt-paper-detail")).toHaveCount(0);
});

test("an unopened server allocation is not presented as a saved historical Daily card", async ({ page }) => {
  await prepare(page);
  await page.route("**/api/daily-pull", route => route.fulfill({ json: {
    anonId: "three-way-merge-fixture", pullDate: route.request().postDataJSON().date,
    cardId: "17-star", cardName: "The Star", whisper: "An unopened server assignment.",
    isFlipped: false, note: "A note without a revealed card.", createdAt: "2026-09-27T12:00:00Z",
  } }));
  await page.goto("/app/daily?hintPreview=embedded");
  await Promise.all([
    page.waitForResponse(response => response.url().endsWith("/api/daily-pull") && response.request().postDataJSON().date === "2026-09-27"),
    page.getByRole("button", { name: "Previous Day", exact: true }).click(),
  ]);
  await expect(page.getByTestId("input-pull-note")).toHaveValue("A note without a revealed card.");
  await expect(page.getByText("No saved card for this date.", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Share receipt", exact: true })).toHaveCount(0);
});

test("selectable iPhone frame keeps Home, Daily and receipt controls inside safe areas", async ({ page }, info) => {
  await prepare(page);
  await page.setViewportSize({ width: 1100, height: 1120 });
  await page.goto("/app?hintPreview=frame");
  await page.getByRole("combobox", { name: "Preview device" }).selectOption(info.project.name);
  const phone = page.frameLocator(".hint-preview-screen");
  const safeBottom = info.project.name === "iphone-se" ? 0 : 34;
  await expect(phone.getByTestId("home-reveal-action")).toBeEnabled();
  await page.screenshot({ path: info.outputPath("phone-home.png") });
  await phone.getByTestId("home-reveal-action").click();
  await expect(phone.getByTestId("home-daily-reveal")).toBeVisible();
  await page.keyboard.press("Escape");
  await phone.getByRole("button", { name: "Share receipt", exact: true }).click();
  const dialog = phone.getByTestId("receipt-share-dialog");
  await expect(dialog.getByRole("button", { name: "Share receipt", exact: true })).toBeEnabled();
  const bounds = await dialog.locator(".receipt-share-footer button").evaluateAll(buttons => buttons.map(button => {
    const rect = button.getBoundingClientRect();
    return { height: rect.height, bottomSpace: window.innerHeight - rect.bottom,
      reachable: button.contains(document.elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2)) };
  }));
  for (const bound of bounds) {
    expect(bound.height).toBeGreaterThanOrEqual(44);
    expect(bound.bottomSpace).toBeGreaterThanOrEqual(safeBottom);
    expect(bound.reachable).toBe(true);
  }
  await page.screenshot({ path: info.outputPath("phone-printer.png") });
  await dialog.locator(".receipt-share-scroll").evaluate(element => { element.scrollTop = element.scrollHeight; });
  await expect(dialog.locator(".receipt-printer__result-content footer")).toBeInViewport();
  await page.screenshot({ path: info.outputPath("phone-receipt-bottom.png") });
  await page.keyboard.press("Escape");
  await phone.locator('.hint-app-dock a[href$="/app/daily"]').click();
  await expect(phone.getByTestId("daily-date-strip")).toBeVisible();
  await page.screenshot({ path: info.outputPath("phone-daily.png") });
});

test("printer frame sample: preparation, printing and replay stay responsive", async ({ page }, info) => {
  test.skip(info.project.name !== "iphone-17-pro-max", "Sequential primary browser performance run");
  await prepare(page, "en", "bright", false, false); await reveal(page);
  await page.evaluate(() => {
    const state = window as Window & { printerFrames: number[]; printerRaf: number; printerStart: number; printerFeedback: number };
    state.printerFrames = []; state.printerFeedback = 0;
    let previous = performance.now();
    const tick = (now: number) => { state.printerFrames.push(now - previous); previous = now; state.printerRaf = requestAnimationFrame(tick); };
    state.printerRaf = requestAnimationFrame(tick);
    document.querySelector(".receipt-share-trigger")!.addEventListener("click", () => {
      state.printerStart = performance.now();
      const observer = new MutationObserver(() => {
        if (document.querySelector(".receipt-share-dialog")) {
          observer.disconnect(); requestAnimationFrame(() => { state.printerFeedback = performance.now() - state.printerStart; });
        }
      });
      observer.observe(document.body, { subtree: true, childList: true });
    }, { once: true });
  });
  await page.getByRole("button", { name: "Share receipt", exact: true }).click();
  const dialog = page.getByTestId("receipt-share-dialog");
  await expect(dialog.locator(".receipt-printer")).toHaveAttribute("data-phase", "printing");
  await expect(dialog.getByRole("button", { name: "Share receipt", exact: true })).toBeEnabled();
  await dialog.getByRole("button", { name: "Print again", exact: true }).click();
  await expect(dialog.locator(".receipt-printer")).toHaveAttribute("data-phase", "printing");
  await expect(dialog.locator(".receipt-printer")).toHaveAttribute("data-phase", "complete");
  const metrics = await page.evaluate(() => {
    const state = window as Window & { printerFrames: number[]; printerRaf: number; printerFeedback: number };
    cancelAnimationFrame(state.printerRaf);
    const frames = state.printerFrames.slice(1), ordered = [...frames].sort((a,b) => a-b);
    let run = 0, longestStallRun = 0;
    for (const gap of frames) { run = gap >= 100 ? run + 1 : 0; longestStallRun = Math.max(run, longestStallRun); }
    return { browserOnly: true, samples: frames.length, p95: ordered[Math.floor(ordered.length * .95)], max: ordered.at(-1), over100: frames.filter(gap => gap >= 100).length, longestStallRun, clickToFrame: state.printerFeedback };
  });
  await info.attach("printer-web-frames", { body: JSON.stringify(metrics, null, 2), contentType: "application/json" });
  expect(metrics.samples).toBeGreaterThan(100);
  expect(metrics.p95).toBeLessThan(90);
  expect(metrics.longestStallRun).toBeLessThan(2);
  await page.keyboard.press("Escape");
  await expect(page.locator(".receipt-printer")).toHaveCount(0);
  expect(await page.evaluate(() => document.getAnimations().filter(animation => (animation.effect as KeyframeEffect | null)?.target instanceof Element && ((animation.effect as KeyframeEffect).target as Element).closest(".receipt-printer")).length)).toBe(0);
});
