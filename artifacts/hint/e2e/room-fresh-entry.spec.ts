import { expect, test, type Page, type Locator } from "./fixtures";

async function seed(page: Page) {
  await page.addInitScript(() => {
    if (localStorage.getItem("room-fresh-fixture")) return;
    localStorage.setItem("room-fresh-fixture", "1");
    localStorage.setItem("hint_anon_id", "room-fresh-fictional-reader");
    localStorage.setItem("hint_onboarding_complete_v3", "1");
    localStorage.setItem("hint_launch_seen_v2", "1");
    localStorage.setItem("hint-language", "en");
    localStorage.setItem("hint-theme", "bright");
    localStorage.setItem("hint.preferences.v1", JSON.stringify({ reduceMotion: true, soundAndHaptics: false }));
  });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.route("**/api/profile**", route => route.fulfill({ status: 404, json: { error: "PROFILE_NOT_FOUND" } }));
  await page.route("**/api/journal**", route => route.fulfill({ json: [] }));
}

async function leaveHome(page: Page) {
  const home = new URL(page.url()).pathname.endsWith("/ask")
    ? page.getByRole("banner").getByRole("link", { name: "Home", exact: true })
    : page.getByRole("navigation", { name: "App", exact: true }).locator('a[href="/app"]');
  await home.click();
  const prompt = page.getByRole("dialog", { name: "Leave this space?", exact: true });
  await expect(prompt).toContainText("Saved drafts can be reopened when you choose.");
  await expect(prompt).toContainText("Saved readings, personal details and today’s cards are kept.");
  await prompt.getByRole("button", { name: "Leave and start fresh", exact: true }).click();
  await expect(page).toHaveURL(/\/app(?:\?|$)/);
}

async function accessibleRestore(button: Locator) {
  await expect(button).toBeVisible();
  await button.scrollIntoViewIfNeeded();
  const box = await button.boundingBox();
  expect(box!.height).toBeGreaterThanOrEqual(44);
  expect(await button.evaluate(element => {
    const box = element.getBoundingClientRect();
    const front = document.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2);
    return front === element || element.contains(front);
  })).toBe(true);
}

test("Ask reentry starts blank, manually restores draft, and keeps prior saved conversation readable", async ({ page }, info) => {
  await seed(page);
  await page.route("**/api/hint/chat", route => route.fulfill({ json: { message: "A fictional saved response.", createdAt: "2026-09-10T12:00:00Z" } }));
  await page.goto("/app/ask?hintPreview=embedded");
  const input = page.locator("textarea");
  await input.fill("A fictional completed question");
  await page.getByRole("button", { name: "Send", exact: true }).click();
  await expect(page.getByText("A fictional saved response.", { exact: true })).toBeVisible();
  await input.fill("A private unfinished follow-up");
  await page.reload();
  await expect(input).toHaveValue("A private unfinished follow-up");
  await expect(page.getByText("A fictional saved response.", { exact: true })).toBeVisible();
  await leaveHome(page); await page.goBack();
  await expect(input).toHaveValue("");
  await expect(page.getByText("A fictional saved response.", { exact: true })).toHaveCount(0);
  const restore = page.getByRole("button", { name: "Restore draft", exact: true });
  await accessibleRestore(restore); await page.screenshot({ path: info.outputPath("ask-fresh-with-recovery.png") });
  const thread = page.locator(".hint-app-scroll").filter({ has: page.getByRole("heading", { name: "What is on your mind?", exact: true }) }).last();
  const entryGeometry = await thread.evaluate(element => {
    const viewport = element.getBoundingClientRect();
    const heading = element.querySelector("h1")!.getBoundingClientRect();
    return { scrollTop: element.scrollTop, viewportTop: viewport.top, viewportBottom: viewport.bottom, headingTop: heading.top, headingBottom: heading.bottom };
  });
  await info.attach("ask-fresh-entry-geometry", { contentType: "application/json", body: JSON.stringify(entryGeometry) });
  expect(entryGeometry.scrollTop).toBe(0);
  expect(entryGeometry.headingTop).toBeGreaterThanOrEqual(entryGeometry.viewportTop);
  expect(entryGeometry.headingBottom).toBeLessThanOrEqual(entryGeometry.viewportBottom);
  await restore.click(); await expect(input).toHaveValue("A private unfinished follow-up");
  await page.reload(); await expect(input).toHaveValue("A private unfinished follow-up");
  await expect(page.getByText("A fictional saved response.", { exact: true })).toHaveCount(0);
  await page.locator("details summary").click();
  await page.getByRole("button", { name: "A fictional completed question", exact: true }).click();
  await expect(page.getByText("A fictional saved response.", { exact: true })).toBeVisible();
});

test("Journal reentry is blank while its saved draft is recoverable and refreshed within the visit", async ({ page }, info) => {
  await seed(page); await page.goto("/app/journal?hintPreview=embedded");
  const body = page.getByTestId("input-journal-body");
  await body.fill("A page preserved until I choose to resume it.");
  await leaveHome(page); await page.goBack();
  await expect(body).toHaveValue(""); await page.reload(); await expect(body).toHaveValue("");
  const restore = page.getByRole("button", { name: "Restore draft", exact: true });
  await accessibleRestore(restore); await page.screenshot({ path: info.outputPath("journal-fresh-with-recovery.png") });
  await restore.click(); await expect(body).toHaveValue("A page preserved until I choose to resume it.");
  await page.reload(); await expect(body).toHaveValue("A page preserved until I choose to resume it.");
});

test("Quiz starts again after leaving and preserves a completed result when new answers begin", async ({ page }, info) => {
  await seed(page); await page.goto("/app/personalities?hintPreview=embedded");
  for (let index = 0; index < 6; index++) await page.getByTestId("personality-option").first().click();
  await expect(page.getByTestId("personality-share")).toBeVisible();
  await leaveHome(page); await page.goBack();
  await expect(page.getByText("1 / 6", { exact: true })).toBeVisible();
  await expect(page.getByTestId("personality-share")).toHaveCount(0);
  const restore = page.getByRole("button", { name: "Return to previous quiz", exact: true });
  await accessibleRestore(restore); await page.screenshot({ path: info.outputPath("quiz-fresh-with-recovery.png") });
  await page.getByTestId("personality-option").nth(2).click();
  await page.reload(); await expect(page.getByText("2 / 6", { exact: true })).toBeVisible();
  await page.getByText("View previous result", { exact: true }).click();
  await page.getByRole("button", { name: "The Professional Avoider", exact: true }).click();
  await expect(page.getByTestId("personality-share")).toBeVisible();
});

test("Animal reentry reveals the same daily identity and refresh keeps the new visit open", async ({ page }, info) => {
  await seed(page); await page.goto("/app/animal-tarot?hintPreview=embedded");
  const draw = page.getByRole("button", { name: "Draw animal card", exact: true });
  await expect(page.locator(".animal-card-front")).toBeHidden();
  await draw.click(); await expect(page.locator(".animal-reading h2")).toBeVisible();
  await expect(page.locator(".animal-card-front")).toBeVisible();
  const name = await page.locator(".animal-reading h2").innerText();
  const card = await page.evaluate(() => JSON.parse(localStorage.getItem("hint_daily_receipt_fallbacks_v1") || "[]").find((row: { featureType: string }) => row.featureType === "animal-tarot"));
  await leaveHome(page); await page.goBack();
  await expect(page.locator(".animal-reading")).toHaveCount(0); await expect(draw).toBeVisible();
  await expect(page.locator(".animal-card-front")).toBeHidden();
  await page.screenshot({ path: info.outputPath("animal-fresh-same-daily-card.png") });
  await draw.click(); await expect(page.locator(".animal-reading h2")).toHaveText(name);
  await expect(page.locator(".animal-card-front")).toBeVisible();
  await page.locator(".animal-spirit-card").scrollIntoViewIfNeeded();
  await page.locator(".animal-card-front img").evaluate(image => (image as HTMLImageElement).decode());
  await page.screenshot({ path: info.outputPath("animal-revealed-same-daily-card.png") });
  await page.reload(); await expect(page.locator(".animal-reading h2")).toHaveText(name);
  const refreshed = await page.evaluate(() => JSON.parse(localStorage.getItem("hint_daily_receipt_fallbacks_v1") || "[]").find((row: { featureType: string }) => row.featureType === "animal-tarot"));
  expect(refreshed.assignedCardId).toBe(card.assignedCardId); expect(refreshed.openedAt).toBe(card.openedAt);
});
