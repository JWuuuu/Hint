import { test, expect, type Page } from "./fixtures";
import { readFile } from "node:fs/promises";

async function seed(page: Page, locale = "en") {
  await page.addInitScript(locale => {
    localStorage.setItem("hint_onboarding_complete_v3", "1");
    localStorage.setItem("hint_anon_id", "sharing-fixture");
    localStorage.setItem("hint-language", locale);
    localStorage.setItem("hint-theme", "bright");
    localStorage.setItem("hint.preferences.v1", JSON.stringify({ reduceMotion: true, soundAndHaptics: false }));
    Object.defineProperty(navigator, "share", { configurable: true, value: undefined });
    Object.defineProperty(navigator, "canShare", { configurable: true, value: undefined });
  }, locale);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.route("**/api/profile**", route => route.fulfill({ json: null }));
}

async function quizResult(page: Page, locale = "en") {
  await seed(page, locale);
  await page.goto("/app/personalities?hintPreview=embedded");
  for (let index = 0; index < 6; index++) await page.getByTestId("personality-option").first().click();
  await expect(page.getByTestId("personality-share")).toBeVisible();
}

async function deferExport(page: Page) {
  await page.evaluate(() => {
    const original = HTMLCanvasElement.prototype.toBlob;
    const state = { waiting: false, release: () => {} };
    Object.assign(window, { personalityDeferredExport: state });
    let first = true;
    HTMLCanvasElement.prototype.toBlob = function(callback, type, quality) {
      if (this.width === 1800 && this.height === 2360 && first) {
        first = false;
        original.call(this, blob => { state.waiting = true; state.release = () => callback(blob); }, type, quality);
      } else original.call(this, callback, type, quality);
    };
  });
  await page.getByTestId("personality-share").click();
  await expect.poll(() => page.evaluate(() => (window as unknown as { personalityDeferredExport: { waiting: boolean } }).personalityDeferredExport.waiting)).toBe(true);
}

async function releaseExport(page: Page) {
  await page.evaluate(async () => {
    (window as unknown as { personalityDeferredExport: { release: () => void } }).personalityDeferredExport.release();
    await new Promise(requestAnimationFrame); await new Promise(requestAnimationFrame);
  });
}

async function capturePersonalityText(page: Page) {
  await page.evaluate(() => {
    const text: string[] = []; Object.assign(window, { personalityPrintedText: text });
    const original = CanvasRenderingContext2D.prototype.fillText;
    CanvasRenderingContext2D.prototype.fillText = function(value, x, y, maxWidth) {
      if (this.canvas.width === 1800 && this.canvas.height === 2360) text.push(value);
      if (maxWidth === undefined) original.call(this, value, x, y); else original.call(this, value, x, y, maxWidth);
    };
  });
}

test("Personality exports a real PNG and cancelling its preview revokes the old image", async ({ page }, info) => {
  await quizResult(page);
  await capturePersonalityText(page);
  await page.getByTestId("personality-share").click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.locator("img")).toBeVisible();
  const source = await dialog.locator("img").getAttribute("src");
  const download = page.waitForEvent("download");
  await page.getByTestId("personality-download").click();
  const image = await download;
  expect(image.suggestedFilename()).toBe("hint-personality.png");
  expect(await image.failure()).toBeNull();
  await image.saveAs(info.outputPath("personality-download.png"));
  const bytes = await readFile((await image.path())!);
  expect(bytes.subarray(0, 8)).toEqual(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  expect(bytes.readUInt32BE(16)).toBe(1800); expect(bytes.readUInt32BE(20)).toBe(2360);
  expect(bytes.length).toBeGreaterThan(50_000);
  const lines = await page.evaluate(() => (window as unknown as { personalityPrintedText: string[] }).personalityPrintedText);
  expect(lines.some(line => /\bAvoider\b/.test(line))).toBe(true);
  expect(lines.some(line => /\bOlympic\b/.test(line))).toBe(true);
  await expect(dialog.getByRole("status")).toContainText("Download started");
  await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(dialog).not.toBeVisible();
  expect(await page.evaluate(async source => { try { await fetch(source!); return false; } catch { return true; } }, source)).toBe(true);
  await page.getByTestId("personality-share").click();
  await expect(dialog.locator("img")).toBeVisible();
  const reopenedSource = await dialog.locator("img").getAttribute("src");
  expect(reopenedSource).not.toBe(source);
  const close = dialog.getByRole("button", { name: "Close", exact: true });
  const closeBox = await close.boundingBox();
  expect(closeBox).not.toBeNull();
  expect(closeBox!.width).toBeGreaterThanOrEqual(44);
  expect(closeBox!.height).toBeGreaterThanOrEqual(44);
  expect(await close.evaluate(element => {
    const box = element.getBoundingClientRect();
    const front = document.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2);
    return front === element || element.contains(front);
  })).toBe(true);
  await close.click({ position: { x: 4, y: 22 } });
  await expect(dialog).not.toBeVisible();
  expect(await page.evaluate(async source => { try { await fetch(source!); return false; } catch { return true; } }, reopenedSource)).toBe(true);
});

test("Personality exports complete Japanese text in a real PNG", async ({ page }, info) => {
  await quizResult(page, "ja");
  const title = await page.getByRole("heading", { level: 2 }).innerText();
  await capturePersonalityText(page);
  await page.getByTestId("personality-share").click();
  await expect(page.getByRole("dialog").locator("img")).toBeVisible();
  const pending = page.waitForEvent("download");
  await page.getByTestId("personality-download").click();
  const image = await pending; expect(await image.failure()).toBeNull();
  await image.saveAs(info.outputPath("personality-japanese.png"));
  const bytes = await readFile((await image.path())!);
  expect(bytes.readUInt32BE(16)).toBe(1800); expect(bytes.readUInt32BE(20)).toBe(2360);
  const text = await page.evaluate(() => (window as unknown as { personalityPrintedText: string[] }).personalityPrintedText.join(""));
  expect(text).toContain(title); expect(text).toContain("あなたのタイプを見つける");
});

test("Personality retries a real canvas export after a synthetic generation failure", async ({ page }) => {
  await quizResult(page);
  await page.evaluate(() => {
    const original = HTMLCanvasElement.prototype.toBlob;
    let first = true;
    HTMLCanvasElement.prototype.toBlob = function(callback, type, quality) {
      if (this.width === 1800 && this.height === 2360 && first) { first = false; callback(null); }
      else original.call(this, callback, type, quality);
    };
  });
  await page.getByTestId("personality-share").click();
  await expect(page.getByText("Could not create or download the image. Please retry.", { exact: true })).toBeVisible();
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await page.getByTestId("personality-share").click();
  await expect(page.getByRole("dialog").locator("img")).toBeVisible();
});

test("Personality keeps the preview and retries when browser download initiation throws", async ({ page }) => {
  await quizResult(page);
  await page.getByTestId("personality-share").click();
  await expect(page.getByRole("dialog").locator("img")).toBeVisible();
  await page.evaluate(() => {
    const original = HTMLAnchorElement.prototype.click;
    let first = true;
    HTMLAnchorElement.prototype.click = function() {
      if (this.download === "hint-personality.png" && first) { first = false; throw new DOMException("Synthetic download denial", "NotAllowedError"); }
      original.call(this);
    };
  });
  await page.getByTestId("personality-download").click();
  await expect(page.getByRole("dialog").getByRole("status")).toContainText("Could not create or download");
  await expect(page.getByRole("dialog").locator("img")).toBeVisible();
  const pending = page.waitForEvent("download");
  await page.getByTestId("personality-download").click();
  expect(await (await pending).failure()).toBeNull();
});

test("Personality ignores a late English export after changing language and creating a new preview", async ({ page }, info) => {
  await quizResult(page);
  await deferExport(page);
  await page.getByRole("navigation", { name: "App", exact: true }).getByRole("link", { name: "Me", exact: true }).click();
  await page.getByRole("button", { name: "Leave and start fresh", exact: true }).click();
  await page.getByTestId("button-language-toggle").first().click();
  await page.getByRole("option", { name: "日本語", exact: true }).click();
  await expect(page.locator("html")).toHaveAttribute("lang", "ja");
  await page.goBack();
  await expect(page.getByTestId("personality-share")).toHaveCount(0);
  await page.getByRole("button", { name: "前の診断に戻る", exact: true }).click();
  await expect(page.getByTestId("personality-share")).toBeEnabled();
  await page.getByTestId("personality-share").click();
  const preview = page.getByRole("dialog").locator("img");
  await expect(preview).toBeVisible();
  const source = await preview.getAttribute("src");
  await releaseExport(page);
  await expect(preview).toHaveAttribute("src", source!);
  await page.screenshot({ path: info.outputPath("japanese-preview-after-late-export.png") });
});

test("Leaving Personality cancels a pending export without reopening a preview on return", async ({ page }) => {
  await quizResult(page);
  await deferExport(page);
  await page.getByRole("banner").getByRole("link", { name: /Home$/ }).click();
  await page.getByRole("button", { name: "Leave and start fresh", exact: true }).click();
  await expect(page.getByTestId("personality-share")).toHaveCount(0);
  await releaseExport(page);
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await page.goBack();
  await expect(page.getByTestId("personality-share")).toHaveCount(0);
  await page.getByRole("button", { name: "Return to previous quiz", exact: true }).click();
  await expect(page.getByTestId("personality-share")).toBeEnabled();
  await expect(page.getByRole("dialog")).not.toBeVisible();
});

const receiptLocales = [
  { code: "zh", orientation: "逆位", receive: "收下解读", share: "分享小票", card: "愚者", heading: "你的解读", original: "牌卡反思 · 英文原文" },
  { code: "es", orientation: "Invertida", receive: "Recibir", share: "Compartir recibo", card: "El Loco", heading: "TU LECTURA", original: "Reflexión de las cartas · original en inglés" },
  { code: "ja", orientation: "逆位置", receive: "受け取る", share: "レシートを共有", card: "愚者", heading: "あなたのリーディング", original: "カードの振り返り・英語の原文" },
  { code: "ko", orientation: "역방향", receive: "받기", share: "영수증 공유", card: "바보", heading: "나의 리딩", original: "카드 성찰 · 영어 원문" },
];
for (const locale of receiptLocales) test(`${locale.code} Tarot printer exports a localized public PNG with the original reversed card`, async ({ page }, info) => {
  await seed(page, locale.code);
  // Same persisted reading-phase shape used by tarot-room.spec.ts; no ritual shortcuts in app code.
  await page.addInitScript(() => {
    const card = { cardId: "0-fool", name: "The Fool", visualId: "receipt-fixture-1", orientation: "reversed", x: 0, y: 0, rotation: 0, rotate: 0, zIndex: 0, selected: true, revealed: true };
    sessionStorage.setItem("hint_active_tarot_reading_v1", JSON.stringify({ version: 1, savedAt: Date.now(), phase: "reading", question: "CONFIDENTIAL FIXTURE QUESTION", spreadId: "single", focusLabel: "Clear signal", design: { id: "stars", label: "Star Field", mood: "Quiet", deckStyleId: "nocturne", backStyle: "nocturne", cardBackId: "07_Zodiac_Set_A_Detailed/11_Aquarius_Waterbearer_Teal_Gold.png", cardArtId: "hint-card-2", backgroundId: "stars", background: "linear-gradient(180deg,#fff8f1,#ece4ff)", glow: "rgba(171,151,255,0.42)" }, selectedCards: [card], revealedIds: [card.visualId] }));
  });
  await page.route("**/api/tarot/structured-reading", async route => {
    const request = route.request().postDataJSON();
    await route.fulfill({ json: { source: "api", signal_type: "clear_signal", overall_summary: "CONFIDENTIAL GENERATED ANSWER", cards: request.cards.map((card: { name: string; position: string; orientation: string }) => ({ card_name: card.name, position: card.position, orientation: card.orientation, meaning: "A complete fictional explanation." })), final_action_advice: "Pause before deciding.", follow_up_invitation: "What would help?" } });
  });
  await page.goto("/app/tarot?hintPreview=embedded");
  await expect(page.getByText("CONFIDENTIAL GENERATED ANSWER", { exact: true })).toBeVisible();
  // The new printer prepares its PNG on opening, before the share action.
  await page.evaluate(() => {
    const text: string[] = []; Object.assign(window, { exportedReceiptText: text });
    const rotations: number[] = []; Object.assign(window, { exportedReceiptRotations: rotations });
    const original = CanvasRenderingContext2D.prototype.fillText;
    CanvasRenderingContext2D.prototype.fillText = function(value, x, y, maxWidth) {
      if (this.canvas.width === 1800) text.push(value);
      if (maxWidth === undefined) original.call(this, value, x, y); else original.call(this, value, x, y, maxWidth);
    };
    const rotate = CanvasRenderingContext2D.prototype.rotate;
    CanvasRenderingContext2D.prototype.rotate = function(angle) {
      if (this.canvas.width === 1800) rotations.push(angle);
      rotate.call(this, angle);
    };
  });
  await page.getByRole("button", { name: locale.receive, exact: true }).click();
  const receipt = page.getByRole("dialog");
  await expect(receipt.getByRole("button", { name: locale.share, exact: true })).toBeEnabled();
  await expect(receipt).toContainText(locale.card); await expect(receipt).toContainText(locale.original);
  await expect(receipt).not.toContainText("CONFIDENTIAL");
  await expect(receipt.getByRole("checkbox")).not.toBeChecked();
  await expect(receipt.getByRole("img", { name: locale.card, exact: true })).toHaveCSS("transform", "matrix(-1, 0, 0, -1, 0, 0)");
  await expect(receipt.getByText(locale.orientation, { exact: true })).toBeVisible();
  expect(await page.evaluate(() => (window as unknown as { exportedReceiptRotations: number[] }).exportedReceiptRotations)).toEqual([Math.PI]);
  const pending = page.waitForEvent("download");
  await receipt.getByRole("button", { name: locale.share, exact: true }).click();
  const image = await pending; expect(await image.failure()).toBeNull();
  await image.saveAs(info.outputPath(`tarot-${locale.code}.png`));
  const bytes = await readFile((await image.path())!);
  expect(bytes.readUInt32BE(16)).toBe(1800); expect(bytes.readUInt32BE(20)).toBeGreaterThanOrEqual(2800);
  expect(bytes.readUInt32BE(20)).toBeLessThanOrEqual(8192); expect(bytes.length).toBeGreaterThan(50_000);
  const printed = await page.evaluate(() => (window as unknown as { exportedReceiptText: string[] }).exportedReceiptText.join(" "));
  for (const text of [locale.card, locale.heading, locale.original]) expect(printed).toContain(text);
  expect(printed).not.toContain("YOUR READING"); expect(printed).not.toContain("CONFIDENTIAL");
  const previewInsight = await receipt.getByTestId("receipt-insight").innerText();
  expect(printed.replace(/\s/g, "")).toContain(previewInsight.replace(/\s/g, ""));
  await page.screenshot({ path: info.outputPath(`tarot-${locale.code}-preview.png`) });
});
