import { expect, test } from "./fixtures";

// T19: an explicit crisis statement gets fixed resources and never a reading or a model call.
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem("hint_onboarding_complete_v3", "1");
    localStorage.setItem("hint_launch_seen_v2", "1");
    localStorage.setItem("hint-language", "en");
    localStorage.setItem("hint.preferences.v1", JSON.stringify({ reduceMotion: true, soundAndHaptics: false }));
  });
});

test("a crisis question shows support resources instead of a spread, and Back keeps the question", async ({ page }) => {
  const aiCalls: string[] = [];
  await page.route("**/api/tarot/**", route => { aiCalls.push(new URL(route.request().url()).pathname); return route.fulfill({ status: 500, json: {} }); });
  await page.goto("/app/tarot?hintPreview=embedded");
  await page.getByPlaceholder("Type your question...").fill("I want to end my life");
  await page.getByRole("button", { name: "Next", exact: true }).click();
  const panel = page.getByTestId("crisis-support");
  await expect(panel.getByRole("heading", { name: "You deserve real support right now" })).toBeFocused();
  // The panel must paint above the room's background layers, not just exist in the DOM.
  const heading = panel.getByRole("heading");
  const painted = await heading.screenshot();
  await heading.evaluate(element => { (element as HTMLElement).style.color = "transparent"; });
  expect(Buffer.compare(painted, await heading.screenshot())).not.toBe(0);
  await heading.evaluate(element => { (element as HTMLElement).style.color = ""; });
  await expect(panel).toContainText("988");
  await expect(panel.getByRole("link", { name: "Find a helpline near you" })).toHaveAttribute("href", "https://findahelpline.com");
  await expect(page.locator("[data-spread-preview]")).toHaveCount(0);
  for (const target of [panel.getByRole("link"), panel.getByRole("button")]) {
    const box = (await target.boundingBox())!;
    expect(box.height).toBeGreaterThanOrEqual(44);
  }
  expect(aiCalls).toEqual([]);
  await panel.getByRole("button", { name: "Back to my question" }).click();
  await expect(page.getByTestId("crisis-support")).toHaveCount(0);
  await expect(page.getByPlaceholder("Type your question...")).toBeVisible();
  expect(aiCalls).toEqual([]);
});

test("an ordinary question that mentions dying still gets its spread", async ({ page }) => {
  await page.route("**/api/tarot/spread-recommendation", route => route.fulfill({ json: {
    spreadType: "three", reason: "A fictional reflection with three clear positions.", focusLabel: "Fictional reflection", confidence: "high", source: "api",
  } }));
  await page.goto("/app/tarot?hintPreview=embedded");
  await page.getByPlaceholder("Type your question...").fill("I'm dying to know if he likes me");
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await expect(page.locator('[data-spread-preview="three"]')).toBeVisible();
  await expect(page.getByTestId("crisis-support")).toHaveCount(0);
});

test("the support panel follows the app language", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("hint-language", "zh"));
  await page.goto("/app/tarot?hintPreview=embedded");
  await page.locator("textarea").first().fill("我不想活了");
  await page.getByRole("button", { name: "下一步", exact: true }).click();
  const panel = page.getByTestId("crisis-support");
  await expect(panel.getByRole("heading", { name: "此刻你值得得到真正的支持" })).toBeVisible();
  await expect(panel.getByRole("button", { name: "返回我的问题" })).toBeVisible();
});
