import { expect, test, type Page, type Locator } from "./fixtures";
import type { LocalTarotReading } from "../src/modules/readings/localTarotReadings";

const OWNER = "room-visit-fictional-reader";
const QUESTION = "How can I make room for a quieter, more thoughtful week?";
const SUMMARY = "This fictional saved letter asks for one small and thoughtful step.";
const SAVED: LocalTarotReading = {
  schemaVersion: 2, id: "room-visit-saved-letter", anonId: OWNER, source: "tarot",
  spreadType: "single", spreadLabel: "One card", question: "A previously saved fictional question",
  focusLabel: "A saved reflection", createdAt: "2026-09-09T12:00:00.000Z",
  cardArtId: "hint-classic", interpretationStatus: "ready",
  roomDesign: { backgroundId: "sea", cardArtId: "hint-classic", backStyle: "rose", cardBackId: "01_Final_Eight_Set/02_Moon_Tide_Lavender_Gold.png" },
  cards: [{ visualId: "saved-letter-star", cardId: "17-star", name: "The Star", orientation: "upright", positionLabel: "Your message", keywords: ["Hope"] }],
  shortAnswer: SUMMARY, questionMeaning: "A fictional reflection.", cardMeanings: ["A moment to pause."],
  structuredReading: {
    signal_type: "clear_signal", overall_summary: SUMMARY,
    cards: [{ position: "Your message", card_name: "The Star", orientation: "upright", meaning: "A moment to pause." }],
    final_action_advice: "Choose one small next step.", follow_up_invitation: "What would make that step easier?",
  },
  chatMessages: [{ id: "saved-follow-up", role: "user", content: "Keep this saved follow-up exactly." }],
};

async function seed(page: Page, reduced = true, language = "en", theme = "bright") {
  await page.addInitScript(({ owner, saved, reduced, language, theme }) => {
    // Refresh must exercise the real saved visit, never overwrite it with fixtures.
    if (localStorage.getItem("hint_e2e_room_visit_seed") === "1") return;
    localStorage.setItem("hint_e2e_room_visit_seed", "1");
    localStorage.setItem("hint_anon_id", owner);
    localStorage.setItem("hint_onboarding_complete_v3", "1");
    localStorage.setItem("hint_launch_seen_v2", "1");
    localStorage.setItem("hint-language", language);
    localStorage.setItem("hint-theme", theme);
    localStorage.setItem("hint.preferences.v1", JSON.stringify({ reduceMotion: reduced, soundAndHaptics: false }));
    localStorage.setItem("hint_local_tarot_readings_v1", JSON.stringify([saved]));
  }, { owner: OWNER, saved: SAVED, reduced, language, theme });
  await page.route("**/api/profile**", route => route.fulfill({ status: 404, json: { error: "PROFILE_NOT_FOUND" } }));
  await page.route("**/api/readings**", route => route.fulfill({ json: [] }));
  await page.route("**/api/tarot/spread-recommendation", route => route.fulfill({ json: {
    spreadType: "three", reason: "Three cards make a clear starting point for this fictional question.",
    focusLabel: "Fictional reflection", confidence: "high", source: "api",
  } }));
  // The shared fixtures fail every other API. No provider, account or real record is used.
}

const exitDialog = (page: Page) => page.getByRole("dialog", { name: "Leave this space?", exact: true });
const tarotHome = (page: Page) => page.getByRole("link", { name: "Home", exact: true });
async function activeSession(page: Page) {
  return page.evaluate(() => JSON.parse(localStorage.getItem(`hint_active_tarot_reading_v2:${localStorage.getItem("hint_anon_id")}`) ?? "null"));
}
async function enterFromHome(page: Page) {
  await page.goto("/app?hintPreview=embedded");
  await page.locator('.reference-home-crisp a[href$="/app/tarot"]').click();
  await expect(page.getByPlaceholder("Type your question...")).toBeVisible();
}
async function progress(page: Page) {
  await page.getByPlaceholder("Type your question...").fill(QUESTION);
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await expect(page.locator('[data-spread-preview="three"]')).toBeVisible();
  await expect.poll(async () => (await activeSession(page))?.phase).toBe("spreadRecommendation");
  await expect.poll(async () => (await activeSession(page))?.focusLabel).toBe("Fictional reflection");
}
async function approve(page: Page) {
  await expect(exitDialog(page)).toBeVisible();
  await exitDialog(page).getByRole("button", { name: "Leave and start fresh", exact: true }).click();
  await expect(exitDialog(page)).toHaveCount(0);
}
async function assertReadableDialog(dialog: Locator) {
  const dimensions = await dialog.evaluate(element => {
    const bounds = element.getBoundingClientRect();
    const buttons = [...element.querySelectorAll("button")].map(button => {
      const rect = button.getBoundingClientRect();
      return { left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom, width: rect.width, height: rect.height };
    });
    const text = [...element.querySelectorAll("h2,p,button")].flatMap(node => {
      const range = document.createRange(); range.selectNodeContents(node);
      return [...range.getClientRects()].map(rect => ({ left: rect.left, right: rect.right }));
    });
    return { width: innerWidth, height: innerHeight, left: bounds.left, right: bounds.right, top: bounds.top, bottom: bounds.bottom, buttons, text };
  });
  expect(dimensions.left).toBeGreaterThanOrEqual(0);
  expect(dimensions.right).toBeLessThanOrEqual(dimensions.width);
  expect(dimensions.top).toBeGreaterThanOrEqual(0);
  expect(dimensions.bottom).toBeLessThanOrEqual(dimensions.height);
  for (const button of dimensions.buttons) {
    expect(button.width).toBeGreaterThanOrEqual(44); expect(button.height).toBeGreaterThanOrEqual(44);
    expect(button.top).toBeGreaterThanOrEqual(dimensions.top); expect(button.bottom).toBeLessThanOrEqual(dimensions.bottom);
  }
  for (const text of dimensions.text) {
    expect(text.left).toBeGreaterThanOrEqual(dimensions.left - 1);
    expect(text.right).toBeLessThanOrEqual(dimensions.right + 1);
  }
}

test("Tarot progress asks before leaving and Stay or Escape preserves the exact step, question and focus", async ({ page }, info) => {
  await seed(page); await enterFromHome(page); await progress(page);
  const before = await activeSession(page);
  const home = tarotHome(page); await home.focus(); await home.click();
  const dialog = exitDialog(page);
  await expect(dialog).toBeVisible();
  await expect(page).toHaveURL(/\/app\/tarot(?:\?|$)/);
  await expect(dialog).toContainText("Your unfinished Tarot reading will reset.");
  await expect(dialog).toContainText("Saved readings, personal details and today’s cards are kept.");
  await expect(dialog.getByRole("button", { name: "Stay here" })).toBeFocused();
  await assertReadableDialog(dialog);
  await page.screenshot({ path: info.outputPath("leave-dialog.png") });
  // Focus remains in the dialog at either keyboard boundary.
  await page.keyboard.press("Shift+Tab");
  expect(await dialog.evaluate(element => element.contains(document.activeElement))).toBe(true);
  await page.keyboard.press("Tab");
  await dialog.getByRole("button", { name: "Stay here" }).click();
  await expect(dialog).toHaveCount(0); await expect(home).toBeFocused();
  await expect(page.locator('[data-spread-preview="three"]')).toBeVisible();
  expect(await activeSession(page)).toEqual(before);
  await home.click(); await expect(dialog).toBeVisible(); await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0); await expect(home).toBeFocused();
  expect(await activeSession(page)).toEqual(before);
  await page.getByRole("button", { name: "Back", exact: true }).click();
  await expect(page.getByPlaceholder("Type your question...")).toHaveValue(QUESTION);
});

test("confirmed Tarot departure starts a fresh normal visit and preserves the saved archive", async ({ page }) => {
  await seed(page); await enterFromHome(page); await progress(page);
  const archive = await page.evaluate(() => localStorage.getItem("hint_local_tarot_readings_v1"));
  await tarotHome(page).click(); await approve(page);
  await expect(page.locator(".reference-home-crisp")).toBeVisible();
  await page.locator('.reference-home-crisp a[href$="/app/tarot"]').click();
  await expect(page.getByPlaceholder("Type your question...")).toHaveValue("");
  await expect(page.locator("[data-spread-preview]")).toHaveCount(0);
  expect(await page.evaluate(() => localStorage.getItem("hint_local_tarot_readings_v1"))).toBe(archive);
  // A refresh of this new, empty visit must not revive the departed question.
  await page.reload(); await expect(page.getByPlaceholder("Type your question...")).toHaveValue("");
});

test("refresh inside an open Tarot visit restores its exact question and selected spread", async ({ page }) => {
  await seed(page); await enterFromHome(page); await progress(page);
  await page.getByRole("button", { name: "Next spread", exact: true }).click();
  const spread = await page.locator("[data-spread-preview]").getAttribute("data-spread-preview");
  await expect.poll(async () => (await activeSession(page))?.spreadId).toBe(spread);
  const before = await activeSession(page);
  await page.reload();
  await expect(page.locator(`[data-spread-preview="${spread}"]`)).toBeVisible();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  expect(await activeSession(page)).toMatchObject({ question: before.question, phase: before.phase, spreadId: before.spreadId, selectedCards: before.selectedCards });
  await page.getByRole("button", { name: "Back", exact: true }).click();
  await expect(page.getByPlaceholder("Type your question...")).toHaveValue(QUESTION);
});

test("browser Back explains the completed departure and Forward begins fresh without another history entry", async ({ page }, info) => {
  await seed(page); await enterFromHome(page); await progress(page);
  const length = await page.evaluate(() => history.length);
  await page.goBack();
  const notice = page.getByRole("dialog", { name: "A fresh start next time", exact: true });
  await expect(notice).toBeVisible(); await expect(page.locator(".reference-home-crisp")).toBeVisible();
  await expect(notice).toContainText("saved records and drafts are still available.");
  await assertReadableDialog(notice); await page.screenshot({ path: info.outputPath("browser-back-notice.png") });
  expect(await page.evaluate(() => history.length)).toBe(length);
  await notice.getByRole("button", { name: "Got it" }).click();
  await page.goForward();
  await expect(page.getByPlaceholder("Type your question...")).toHaveValue("");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.locator("[data-room-entrance]")).toHaveCount(0);
  expect(await page.evaluate(() => history.length)).toBe(length);
});

test("repeated exit taps and rapid approval commit only one departure", async ({ page }) => {
  await seed(page); await enterFromHome(page); await progress(page);
  const before = await page.evaluate(() => history.length);
  await tarotHome(page).evaluate(element => { (element as HTMLElement).click(); (element as HTMLElement).click(); });
  await expect(exitDialog(page)).toHaveCount(1);
  await exitDialog(page).getByRole("button", { name: "Leave and start fresh" }).evaluate(element => {
    (element as HTMLElement).click(); (element as HTMLElement).click();
  });
  await expect(page.locator(".reference-home-crisp")).toBeVisible();
  expect(await page.evaluate(() => history.length)).toBe(before + 1);
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.goBack(); await expect(page.getByPlaceholder("Type your question...")).toHaveValue("");
});

test("explicit History restore remains available after leaving a reading and does not recreate saved records", async ({ page }) => {
  await seed(page); await enterFromHome(page); await progress(page);
  await tarotHome(page).click(); await approve(page);
  await page.goto("/app/readings?hintPreview=embedded");
  await page.locator(`a[href$="/app/readings/${SAVED.id}"]`).first().click();
  await expect(page.getByTestId("tarot-history-detail")).toBeVisible();
  await expect(page.getByText(SUMMARY, { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Return to chat", exact: true }).click();
  await expect(page).toHaveURL(/\/app\/tarot\?reading=room-visit-saved-letter&returnTo=detail/);
  await expect(page.getByText(SUMMARY, { exact: true })).toBeVisible();
  await expect(page.getByRole("main").getByText(SAVED.chatMessages[0]!.content, { exact: true })).toBeVisible();
  await page.reload(); await expect(page.getByText(SUMMARY, { exact: true })).toBeVisible();
  const archive = await page.evaluate(() => JSON.parse(localStorage.getItem("hint_local_tarot_readings_v1") ?? "[]"));
  expect(archive).toHaveLength(1);
  expect(archive[0]).toMatchObject({ id: SAVED.id, cards: SAVED.cards, structuredReading: SAVED.structuredReading, chatMessages: SAVED.chatMessages });
});

test("a delayed approved departure from a saved Tarot reading keeps the destination entrance", async ({ page }, info) => {
  await seed(page, false);
  await page.goto(`/app/tarot?reading=${SAVED.id}&returnTo=detail&hintPreview=embedded`);
  await expect(page.getByText(SUMMARY, { exact: true })).toBeVisible();
  await page.evaluate(() => {
    const found = new Set<string>();
    (window as unknown as { visitEntrances: string[] }).visitEntrances = [];
    const observer = new MutationObserver(() => {
      for (const layer of document.querySelectorAll("[data-room-entrance]")) {
        const id = layer.getAttribute("data-room-arrival-id")!;
        if (found.has(id)) continue; found.add(id);
        (window as unknown as { visitEntrances: string[] }).visitEntrances.push(layer.getAttribute("data-room-entrance")!);
      }
    });
    observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ["data-room-entrance", "data-room-arrival-id"] });
  });
  const history = page.getByRole("button", { name: "Open reading history", exact: true });
  await history.focus(); await history.click();
  await expect(exitDialog(page)).toBeVisible();
  // The reviewed choice must survive longer than the normal 800ms click-intent lifetime.
  await page.waitForTimeout(1_100);
  await expect(page.getByText(SUMMARY, { exact: true })).toBeVisible();
  await approve(page);
  await expect(page).toHaveURL(/\/app\/readings$/);
  await expect.poll(() => page.evaluate(() => (window as unknown as { visitEntrances: string[] }).visitEntrances)).toEqual(["readings"]);
  await expect(page.locator("[data-room-entrance]")).toHaveCount(0);
  await info.attach("delayed-departure-entrances", { body: JSON.stringify(await page.evaluate(() => (window as unknown as { visitEntrances: string[] }).visitEntrances)), contentType: "application/json" });
  await expect(page.locator(`a[href$="/app/readings/${SAVED.id}"]`).first()).toBeVisible();
});

test("an empty Tarot visit returns Home directly without an unnecessary reset dialog", async ({ page }) => {
  await seed(page); await enterFromHome(page);
  await tarotHome(page).click();
  await expect(page.locator(".reference-home-crisp")).toBeVisible();
  await expect(page.getByRole("dialog")).toHaveCount(0);
});

for (const theme of ["bright", "dark"]) test(`Spanish 200% exit dialog ${theme} keeps its full text and actions reachable on SE`, async ({ page }, info) => {
  test.skip(info.project.name !== "iphone-se", "The text-reflow stress case targets SE; both phone sizes run the full visit journeys.");
  await seed(page, true, "es", theme);
  await page.goto("/app/tarot?hintPreview=embedded");
  const question = page.getByPlaceholder("Escribe tu pregunta…");
  await question.fill(QUESTION);
  await page.getByRole("link", { name: "Inicio", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "¿Salir de este espacio?", exact: true });
  await expect(dialog).toBeVisible(); await expect(dialog).toHaveAttribute("data-reduced", "true");
  // Text-only browser reflow is separate evidence from physical iOS Dynamic Type.
  await dialog.evaluate(element => {
    const sizes = [...element.querySelectorAll<HTMLElement>("h2,p,button")].map(node => [node, parseFloat(getComputedStyle(node).fontSize)] as const);
    for (const [node, size] of sizes) node.style.fontSize = `${size * 2}px`;
    element.scrollTop = 0;
  });
  const geometry = await dialog.evaluate(element => {
    const bounds = element.getBoundingClientRect();
    const text = [...element.querySelectorAll("h2,p,button")].flatMap(node => {
      const range = document.createRange(); range.selectNodeContents(node);
      return [...range.getClientRects()].map(rect => ({ left: rect.left, right: rect.right }));
    });
    return { left: bounds.left, right: bounds.right, top: bounds.top, bottom: bounds.bottom, height: innerHeight, width: innerWidth, text };
  });
  expect(geometry.left).toBeGreaterThanOrEqual(0); expect(geometry.right).toBeLessThanOrEqual(geometry.width);
  expect(geometry.top).toBeGreaterThanOrEqual(0); expect(geometry.bottom).toBeLessThanOrEqual(geometry.height);
  for (const rect of geometry.text) {
    expect(rect.left).toBeGreaterThanOrEqual(geometry.left); expect(rect.right).toBeLessThanOrEqual(geometry.right);
  }
  await page.screenshot({ path: info.outputPath(`exit-es-${theme}-200text-top.png`) });
  await dialog.evaluate(element => { element.scrollTop = (element.scrollHeight - element.clientHeight) / 2; });
  await page.screenshot({ path: info.outputPath(`exit-es-${theme}-200text-middle.png`) });
  for (const name of ["Quedarme aquí", "Salir y empezar de nuevo"]) {
    const button = dialog.getByRole("button", { name, exact: true });
    await button.scrollIntoViewIfNeeded();
    const box = await button.boundingBox(); const surface = await dialog.boundingBox();
    expect(box).not.toBeNull(); expect(surface).not.toBeNull();
    expect(box!.height).toBeGreaterThanOrEqual(44); expect(box!.width).toBeGreaterThanOrEqual(44);
    expect(box!.y).toBeGreaterThanOrEqual(surface!.y);
    expect(box!.y + box!.height).toBeLessThanOrEqual(surface!.y + surface!.height);
    expect(await button.evaluate(element => { const rect = element.getBoundingClientRect(); return element.contains(document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2)); })).toBe(true);
  }
  await page.screenshot({ path: info.outputPath(`exit-es-${theme}-200text-bottom.png`) });
  await dialog.getByRole("button", { name: "Quedarme aquí" }).click();
  await expect(dialog).toHaveCount(0); await expect(question).toHaveValue(QUESTION);
});
