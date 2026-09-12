import { test, expect } from "./fixtures";
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem("hint_onboarding_complete_v3", "1");
    localStorage.setItem("hint-language", "en");
  });
  await page.route("**/api/**", route => route.fulfill({ status: 503, json: { error: "Isolated test" } }));
  await page.route("**/api/profile**", route => route.fulfill({ json: null }));
});
test("Daily failed notes survive date changes and reload, then retry saves", async ({ page }) => {
  let fail = true;
  const saved = new Map<string, string>();
  await page.route("**/api/daily-pull", route => {
    const data = route.request().postDataJSON();
    if (route.request().method() === "PATCH") {
      if (fail) return route.fulfill({ status: 503, json: { error: "offline" } });
      saved.set(data.date, data.note);
    }
    return route.fulfill({ json: { anonId: data.anonId, pullDate: data.date, cardId: "0-the-fool", cardName: "The Fool", whisper: "A beginning", isFlipped: true, note: saved.get(data.date) ?? "", createdAt: new Date().toISOString() } });
  });
  await page.goto("/app/daily?hintPreview=embedded");
  const note = page.getByTestId("input-pull-note");
  await note.fill("My recoverable note");
  await note.blur();
  await expect(page.getByRole("button", { name: "Not saved. Retry saving" })).toBeVisible();
  await page.getByRole("button", { name: /^Next / }).click();
  await expect(note).toHaveValue("");
  await page.getByRole("button", { name: /^Previous / }).click();
  await expect(note).toHaveValue("My recoverable note");
  await page.reload();
  await expect(note).toHaveValue("My recoverable note");
  fail = false;
  await note.focus(); await note.blur();
  await expect.poll(() => [...saved.values()]).toContain("My recoverable note");
  await page.reload();
  await expect(note).toHaveValue("My recoverable note");
});
test("Ask failed question is still editable after reload", async ({ page }) => {
  await page.goto("/app/ask?hintPreview=embedded");
  const question = page.getByRole("textbox");
  await question.fill("How can I make room to rest?");
  await page.getByRole("button", { name: "Send", exact: true }).click();
  await expect(page.getByRole("button", { name: "Retry", exact: true })).toBeVisible();
  await expect(question).toHaveValue("How can I make room to rest?");
  await page.reload();
  await expect(question).toHaveValue("How can I make room to rest?");
});
test("the offline daily card stays identical through Daily, Home and Collection", async ({ page }) => {
  await page.goto("/app/daily?hintPreview=embedded");
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem("hint_daily_receipt_fallbacks_v1") ?? "[]").find((r: any) => r.featureType === "daily-card")?.openedAt)).toBeTruthy();
  const original = await page.evaluate(() => JSON.parse(localStorage.getItem("hint_daily_receipt_fallbacks_v1")!)[0].assignedCardId);
  const title = await page.evaluate(() => JSON.parse(localStorage.getItem("hint_local_daily_readings")!)[0].cardName);
  await page.goto("/app?hintPreview=embedded");
  await expect(page.getByText(title, { exact: true }).first()).toBeVisible();
  await expect(page.getByRole("button", { name: /Card reflection/ })).toBeVisible();
  await expect(page.getByText("Moon in the 9th house", { exact: true })).toHaveCount(0);
  await expect(page.getByText("Venus conjunct Saturn", { exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: /Card reflection/ }).click();
  await expect(page.getByText(new RegExp(`${title} is your saved daily card`))).toBeVisible();
  await page.goto("/app/collection?hintPreview=embedded");
  await expect(page.getByText(title, { exact: true }).first()).toBeVisible();
  await page.route("**/api/daily-receipts/sync", route => route.fulfill({ status: 409, json: { error: "conflict" } }));
  await page.goto("/app/daily?hintPreview=embedded");
  await expect(page.getByText(/A different revealed server card prevents synchronization/)).toBeVisible();
  await expect(page.getByText(title, { exact: true }).first()).toBeVisible();
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem("hint_daily_receipt_fallbacks_v1")!).find((r: any) => r.featureType === "daily-card").assignedCardId)).toBe(original);
});
for (const status of [404, 410]) {
  test(`direct and legacy invitation links show ${status} without returning Home`, async ({ page }) => {
    await page.route("**/api/compatibility/invite/fixture", route => route.fulfill({ status, json: { error: "fixture" } }));
    await page.goto("/app/compatibility/invite/fixture?hintPreview=embedded");
    await expect(page.getByRole("heading", { name: "Invite unavailable" })).toBeVisible();
    await expect(page.getByText(status === 410 ? "This invitation has expired." : "Invite not found.", { exact: true })).toBeVisible();
    await page.goto("/compatibility/invite/fixture?hintPreview=embedded");
    await expect(page).toHaveURL(/\/app\/compatibility\/invite\/fixture/);
    await expect(page.getByRole("heading", { name: "Invite unavailable" })).toBeVisible();
  });
}

test("a new local beta profile returns to the invitation after onboarding", async ({ page }) => {
  await page.addInitScript(() => localStorage.removeItem("hint_onboarding_complete_v3"));
  await page.route("**/api/profile", async route => route.fulfill({ json: { ...route.request().postDataJSON(), updatedAt: new Date().toISOString() } }));
  await page.route("**/api/compatibility/invite/onboarding-fixture", route => route.fulfill({ status: 404, json: { error: "missing" } }));
  await page.goto("/app/compatibility/invite/onboarding-fixture?hintPreview=embedded&onboarding=reset");
  await page.getByTestId("button-start-onboarding").click();
  await page.getByTestId("onboarding-name").fill("Fictional Reader");
  await page.getByTestId("onboarding-birth-month").selectOption("02");
  await page.getByTestId("onboarding-birth-day").selectOption("29");
  await page.getByTestId("onboarding-birth-year").selectOption("2000");
  await page.getByTestId("button-save-onboarding-profile").click();
  await page.getByTestId("onboarding-focus-self").click();
  await page.getByTestId("button-save-onboarding-focus").click();
  await page.getByTestId("onboarding-email").fill("fictional@hint.test");
  await page.getByTestId("button-onboarding-auth").click();
  const code = await page.locator("strong.tracking-\\[0\\.18em\\]").textContent();
  await page.getByTestId("onboarding-code").fill(code!.trim());
  await page.getByTestId("button-onboarding-auth").click();
  await expect(page).toHaveURL(/\/app\/compatibility\/invite\/onboarding-fixture/);
  await expect(page.getByRole("heading", { name: "Invite unavailable" })).toBeVisible();
});

test("language options escape the settings card and support dismissal", async ({ page }) => {
  await page.goto("/app/me?hintPreview=embedded");
  const toggle = page.getByTestId("button-language-toggle").last();
  await toggle.click();
  const menu = page.getByRole("listbox");
  await expect(menu).toBeVisible();
  for (const option of await menu.getByRole("option").all()) await expect(option).toBeInViewport();
  await page.getByRole("option", { name: "한국어" }).click();
  await expect(page).toHaveURL(/\/app\/profile/);
  await expect(page.locator("html")).toHaveAttribute("lang", "ko");
  await toggle.click(); await page.keyboard.press("Escape");
  await expect(menu).not.toBeVisible();
  await expect(toggle).toBeFocused();
  await toggle.click(); await page.mouse.click(10, 10);
  await expect(menu).not.toBeVisible();
});

test("Animal Tarot quota failures retain the result and permit collection retry", async ({ page }) => {
  await page.goto("/app/animal-tarot?hintPreview=embedded");
  await page.getByRole("button", { name: "Draw animal card" }).click();
  const save = page.getByRole("button", { name: "Save to Collection", exact: true });
  await expect(save).toBeVisible();
  await page.evaluate(() => {
    const original = Storage.prototype.setItem;
    (window as any).__restoreStorage = () => { Storage.prototype.setItem = original; };
    Storage.prototype.setItem = function (key, value) {
      if (key === "hint_local_collection_unlocks_v1") throw new DOMException("Full", "QuotaExceededError");
      return original.call(this, key, value);
    };
  });
  await save.click();
  await expect(page.getByRole("button", { name: "Not saved. Retry saving" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Saved locally" })).not.toBeVisible();
  await page.evaluate(() => (window as any).__restoreStorage());
  await page.getByRole("button", { name: "Not saved. Retry saving" }).click();
  await expect(page.getByRole("button", { name: "Saved locally" })).toBeVisible();
});

test("leaving during Animal Tarot reveal retains the already visible animal", async ({ page }) => {
  await page.goto("/app/animal-tarot?hintPreview=embedded");
  await page.getByRole("button", { name: "Draw animal card" }).click();
  const receipt = await page.evaluate(() => JSON.parse(localStorage.getItem("hint_daily_receipt_fallbacks_v1") ?? "[]").find((item: any) => item.featureType === "animal-tarot"));
  expect(receipt.openedAt).toBeTruthy();
  await page.reload();
  await expect(page.getByRole("button", { name: "Save to Collection", exact: true })).toBeVisible();
  const restored = await page.evaluate(() => JSON.parse(localStorage.getItem("hint_daily_receipt_fallbacks_v1") ?? "[]").find((item: any) => item.featureType === "animal-tarot"));
  expect(restored.assignedCardId).toBe(receipt.assignedCardId);
  expect(restored.openedAt).toBe(receipt.openedAt);
});

test("history errors retain local records and provide retry", async ({ page }) => {
  await page.goto("/app/daily?hintPreview=embedded");
  await expect.poll(() => page.evaluate(() => localStorage.getItem("hint_local_daily_readings"))).toBeTruthy();
  await page.goto("/app/readings?hintPreview=embedded");
  await expect(page.getByText(/History could not be loaded/)).toBeVisible();
  await expect(page.getByRole("button", { name: "Retry", exact: true })).toBeVisible();
  await expect(page.locator("body")).not.toContainText("No readings yet");
});

test("history deletion failure preserves data and successful retry keeps preferences", async ({ page }) => {
  let fail = true;
  await page.route("**/api/history?**", route => route.fulfill({ status: fail ? 503 : 204, body: "" }));
  page.on("dialog", dialog => dialog.accept());
  await page.goto("/app/me?hintPreview=embedded");
  await page.evaluate(() => localStorage.setItem("hint_text_draft_v1:fixture:ask:", "keep-other-owner"));
  const identity = await page.evaluate(() => localStorage.getItem("hint_anon_id"));
  await page.locator("summary").filter({ hasText: "Manage saved history" }).click();
  await page.getByTestId("button-clear-history").click();
  await expect(page.getByRole("alert")).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem("hint_anon_id"))).toBe(identity);
  fail = false;
  await page.getByRole("button", { name: "Retry", exact: true }).click();
  await expect(page.getByRole("alert")).not.toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem("hint-language"))).toBe("en");
  expect(await page.evaluate(() => localStorage.getItem("hint_text_draft_v1:fixture:ask:"))).toBe("keep-other-owner");
});

test("Daily late save responses cannot clear a newer draft", async ({ page }) => {
  let release!: () => void;
  await page.route("**/api/daily-pull", async route => {
    const data = route.request().postDataJSON();
    if (route.request().method() === "PATCH") await new Promise<void>(resolve => { release = resolve; });
    await route.fulfill({ json: { anonId: data.anonId, pullDate: data.date, cardId: "0-fool", cardName: "The Fool", whisper: "A beginning", isFlipped: true, note: data.note ?? "", createdAt: new Date().toISOString() } });
  });
  await page.goto("/app/daily?hintPreview=embedded");
  const note = page.getByTestId("input-pull-note");
  await note.fill("Old draft"); await note.blur();
  await expect.poll(() => Boolean(release)).toBe(true);
  await note.fill("New draft while saving"); release();
  await expect(note).toHaveValue("New draft while saving");
  await expect.poll(() => page.evaluate(() => Object.keys(localStorage).filter(key => key.startsWith("hint_text_draft_v1:")).map(key => JSON.parse(localStorage.getItem(key)!).text))).toContain("New draft while saving");
});

test.describe("calendar rollover", () => {
  test.use({ timezoneId: "UTC" });
  test("midnight starts a new dated receipt while preserving the previous revealed card", async ({ page }) => {
    await page.clock.install({ time: new Date("2026-09-09T23:59:50Z") });
    await page.goto("/app/daily?hintPreview=embedded");
    const receipts = () => page.evaluate(() => JSON.parse(localStorage.getItem("hint_daily_receipt_fallbacks_v1") ?? "[]").filter((item: any) => item.featureType === "daily-card"));
    await expect.poll(async () => (await receipts()).find((item: any) => item.dailyKey === "2026-09-09")?.openedAt).toBeTruthy();
    const original = (await receipts()).find((item: any) => item.dailyKey === "2026-09-09");
    await page.clock.fastForward(20_000);
    await expect.poll(async () => (await receipts()).find((item: any) => item.dailyKey === "2026-09-10")?.openedAt).toBeTruthy();
    expect((await receipts()).find((item: any) => item.dailyKey === "2026-09-09").assignedCardId).toBe(original.assignedCardId);
    await page.goto("/app?hintPreview=embedded");
    const today = await page.evaluate(() => JSON.parse(localStorage.getItem("hint_local_daily_readings") ?? "[]").find((item: any) => item.createdAt.startsWith("2026-09-10")));
    await expect(page.getByText(today.cardName, { exact: true }).first()).toBeVisible();
  });
});
