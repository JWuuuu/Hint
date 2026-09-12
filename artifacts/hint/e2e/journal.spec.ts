import { expect, test, type Page } from "./fixtures";
import AxeBuilder from "@axe-core/playwright";

async function openJournal(page: Page) {
  await page.addInitScript(() => {
    localStorage.setItem("hint_onboarding_complete_v3", "1");
    localStorage.setItem("hint-language", "en");
  });
  await page.route("**/api/profile**", (route) => route.fulfill({ json: null }));
  await page.goto("/app/journal?hintPreview=embedded");
  await expect(page.getByLabel("Your page", { exact: true })).toBeVisible();
}

test("draft survives departure for manual recovery and reload, then a failed save can be retried once", async ({ page }) => {
  let saves = 0;
  const entries: object[] = [];
  await page.route("**/api/journal**", async (route) => {
    if (route.request().method() === "GET") return route.fulfill({ json: entries });
    saves++;
    if (saves === 1) return route.fulfill({ status: 503, json: { error: "Unavailable" } });
    await new Promise((resolve) => setTimeout(resolve, 250));
    const entry = { ...route.request().postDataJSON(), id: "journal-test-1", createdAt: new Date().toISOString() };
    entries.unshift(entry);
    return route.fulfill({ json: entry });
  });
  await openJournal(page);
  await expect(page.getByTestId("button-save-journal")).toBeDisabled();
  await page.getByLabel("Title (optional)", { exact: true }).fill("A little breathing room");
  await page.getByLabel("Your page", { exact: true }).fill("Today I made room for a slow walk.\nIt helped me reset.");
  await page.getByRole("button", { name: "Hopeful", exact: true }).click();
  await expect(page.getByText("Draft saved on this device.", { exact: false })).toBeVisible();
  await page.getByRole("banner").getByRole("link", { name: "Rooms", exact: true }).click();
  await page.getByRole("button", { name: "Leave and start fresh", exact: true }).click();
  await expect(page).toHaveURL(/\/app\/rooms/);
  await page.goBack();
  await expect(page.getByLabel("Your page", { exact: true })).toHaveValue("");
  await page.getByRole("button", { name: "Restore draft", exact: true }).click();
  await page.reload();
  await expect(page.getByLabel("Title (optional)", { exact: true })).toHaveValue("A little breathing room");
  await expect(page.getByLabel("Your page", { exact: true })).toHaveValue("Today I made room for a slow walk.\nIt helped me reset.");
  await expect(page.getByRole("button", { name: "Hopeful", exact: true })).toHaveAttribute("aria-pressed", "true");
  await page.getByTestId("button-save-journal").click();
  await expect(page.getByRole("alert")).toContainText("We couldn’t confirm the save");
  await expect(page.getByLabel("Your page", { exact: true })).not.toHaveValue("");
  await page.getByTestId("button-save-journal").click();
  await expect(page.getByLabel("Your page", { exact: true })).toBeDisabled();
  await expect(page.getByText("Page kept in your journal.", { exact: true })).toBeVisible();
  await expect(page.getByRole("article")).toHaveCount(1);
  await expect(page.getByLabel("Your page", { exact: true })).toHaveValue("");
  expect(saves).toBe(2);
  await page.reload();
  await expect(page.getByRole("article")).toHaveCount(1);
  await expect(page.getByLabel("Your page", { exact: true })).toHaveValue("");
});

test("history errors are distinct from empty pages and retry recovers", async ({ page }) => {
  let fail = true;
  await page.route("**/api/journal**", (route) => fail
    ? route.fulfill({ status: 503, json: { error: "Unavailable" } })
    : route.fulfill({ json: [] }));
  await openJournal(page);
  await expect(page.getByRole("alert")).toContainText("Your past pages couldn’t be loaded");
  await expect(page.getByText("Nothing kept yet.", { exact: false })).toHaveCount(0);
  fail = false;
  await page.getByRole("button", { name: "Try again", exact: true }).click();
  await expect(page.getByText("Nothing kept yet.", { exact: false })).toBeVisible();
  await expect(page.getByRole("alert")).toHaveCount(0);
});

test("confirmed save stays visible when refreshing history fails", async ({ page }) => {
  let saved = false;
  await page.route("**/api/journal**", (route) => {
    if (route.request().method() === "POST") {
      saved = true;
      return route.fulfill({ json: { ...route.request().postDataJSON(), id: "confirmed", createdAt: new Date().toISOString() } });
    }
    return saved ? route.fulfill({ status: 503, json: {} }) : route.fulfill({ json: [] });
  });
  await openJournal(page);
  await page.getByLabel("Your page", { exact: true }).fill("This page has been saved.");
  await page.getByTestId("button-save-journal").click();
  await expect(page.getByRole("article")).toContainText("This page has been saved.");
  await expect(page.getByRole("alert")).toContainText("Your past pages couldn’t be loaded");
  await expect(page.getByText("Page kept in your journal.", { exact: true })).toBeVisible();
});

for (const theme of ["bright", "dark"]) {
  test(`${theme} journal has readable controls, bounded inputs and no horizontal overflow`, async ({ page }, testInfo) => {
    await page.addInitScript((value) => localStorage.setItem("hint-theme", value), theme);
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.route("**/api/journal**", (route) => route.fulfill({ json: [{
      id: "long-page", anonId: "test", title: "An unhurried evening and a small thing worth remembering",
      body: "A long reflection\n" + "unbroken".repeat(75), mood: "tender", createdAt: "2025-09-02T12:00:00Z",
    }] }));
    await openJournal(page);
    await expect(page.getByLabel("Title (optional)", { exact: true })).toHaveAttribute("maxlength", "200");
    await page.getByLabel("Your page", { exact: true }).fill("x".repeat(8010));
    await expect(page.getByLabel("Your page", { exact: true })).toHaveValue("x".repeat(8000));
    await expect(page.locator("#journal-count")).toHaveText("8,000 / 8,000");
    await page.getByLabel("Your page", { exact: true }).fill("");
    const metrics = await page.locator(".hint-journal").evaluate((root) => ({
      width: root.clientWidth, scroll: root.scrollWidth,
      inputFont: getComputedStyle(root.querySelector("textarea")!).fontSize,
      moodHeights: [...root.querySelectorAll(".journal-mood")].map((button) => button.getBoundingClientRect().height),
    }));
    expect(metrics.scroll).toBeLessThanOrEqual(metrics.width);
    expect(metrics.inputFont).toBe("16px");
    expect(metrics.moodHeights.every((height) => height >= 44)).toBe(true);
    const accessibility = await new AxeBuilder({ page }).include(".hint-journal").withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze();
    expect(accessibility.violations).toEqual([]);
    await page.screenshot({ path: testInfo.outputPath(`journal-${theme}.png`) });
  });
}
